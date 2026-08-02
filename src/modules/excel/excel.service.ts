import ExcelJS from "exceljs";
import type { PrismaClient } from "@prisma/client";
import { getLogger } from "../../shared/logger/index.js";
import type { AuditLogService } from "../users/audit-log.service.js";
import { ROLE_PERMISSIONS, Permission } from "../../shared/types/index.js";
import { ForbiddenError, ValidationError } from "../../shared/errors/index.js";

interface ImportRow {
  rowNumber: number;
  data: Record<string, string>;
  isValid: boolean;
  errors: string[];
}

interface ImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  preview: ImportRow[];
  columns: string[];
}

export class ExcelService {
  private readonly prisma: PrismaClient;
  private readonly auditLogService: AuditLogService;
  private readonly logger = getLogger("excel-service");

  constructor(prisma: PrismaClient, auditLogService: AuditLogService) {
    this.prisma = prisma;
    this.auditLogService = auditLogService;
  }

  async exportTransactions(userId: string, userRole: string, filters?: Record<string, unknown>): Promise<Buffer> {
    this.requirePermission(userRole, Permission.EXCEL_EXPORT);

    // Diqqat: filtrlar `createdBy` dan KEYIN yoyilmaydi — aks holda
    // chaqiruvchi `createdBy` ni almashtirib, birovning ma'lumotini
    // eksport qila olardi.
    const where: Record<string, unknown> = {
      ...(filters ?? {}),
      createdBy: userId,
      isArchived: false,
    };

    const transactions = await this.prisma.transaction.findMany({
      where,
      orderBy: { transactionDate: "desc" },
      include: {
        category: true,
        source: true,
        transferSource: true,
        transferTarget: true,
      },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Finance Manager";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Tranzaksiyalar", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    sheet.columns = [
      { header: "ID", key: "id", width: 25 },
      { header: "Turi", key: "type", width: 12 },
      { header: "Miqdor", key: "amount", width: 18 },
      { header: "Valyuta", key: "currency", width: 10 },
      { header: "Tavsif", key: "description", width: 30 },
      { header: "Kategoriya", key: "category", width: 20 },
      { header: "Manba", key: "source", width: 20 },
      { header: "Sana", key: "transactionDate", width: 14 },
      { header: "Holat", key: "status", width: 12 },
      { header: "Yaratilgan", key: "createdAt", width: 14 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, size: 11 };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4CAF50" },
    };
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };

    for (const tx of transactions) {
      sheet.addRow({
        id: tx.id,
        type: tx.type === "INCOME" ? "Kirim" : tx.type === "EXPENSE" ? "Chiqim" : "O'tkazma",
        amount: Number(tx.amount),
        currency: tx.currency,
        description: tx.description ?? "",
        category: (tx.category as Record<string, unknown> | null)?.name ?? "",
        source: (tx.source as Record<string, unknown> | null)?.name ?? "",
        transactionDate: (tx.transactionDate as Date).toLocaleDateString("uz-UZ"),
        status: tx.isCancelled ? "Bekor qilingan" : "Faol",
        createdAt: (tx.createdAt as Date).toLocaleDateString("uz-UZ"),
      });
    }

    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 10 },
    };

    const buffer = await workbook.xlsx.writeBuffer() as unknown as Buffer;

    await this.auditLogService.logExport(userId, "TRANSACTION", {
      count: transactions.length,
    });

    this.logger.info({ userId, count: transactions.length }, "Transactions exported to Excel");

    return Buffer.from(buffer);
  }

  async exportCredits(userId: string, userRole: string): Promise<Buffer> {
    this.requirePermission(userRole, Permission.EXCEL_EXPORT);

    const credits = await this.prisma.credit.findMany({
      where: { createdBy: userId, isArchived: false },
      include: {
        source: true,
        schedule: { orderBy: { monthNumber: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Finance Manager";
    workbook.created = new Date();

    const creditsSheet = workbook.addWorksheet("Kreditlar", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    creditsSheet.columns = [
      { header: "ID", key: "id", width: 25 },
      { header: "Nomi", key: "name", width: 25 },
      { header: "Umumiy miqdor", key: "totalAmount", width: 18 },
      { header: "Qolgan qarz", key: "remainingDebt", width: 18 },
      { header: "Oylik to'lov", key: "monthlyPayment", width: 18 },
      { header: "Foiz stavkasi", key: "interestRate", width: 14 },
      { header: "Muddat", key: "termMonths", width: 10 },
      { header: "Turi", key: "type", width: 14 },
      { header: "Status", key: "status", width: 14 },
      { header: "Boshlanish", key: "startDate", width: 14 },
      { header: "Tugash", key: "endDate", width: 14 },
    ];

    const headerRow = creditsSheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2196F3" },
    };

    for (const credit of credits) {
      creditsSheet.addRow({
        id: credit.id,
        name: credit.name,
        totalAmount: Number(credit.totalAmount),
        remainingDebt: Number(credit.remainingDebt),
        monthlyPayment: Number(credit.monthlyPayment),
        interestRate: Number(credit.interestRate),
        termMonths: credit.termMonths,
        type: credit.type === "ANNUITY" ? "Annuitet" : "Differensial",
        status: credit.status === "ACTIVE" ? "Faol" : credit.status === "COMPLETED" ? "Yakunlangan" : "Bekor qilingan",
        startDate: (credit.startDate as Date).toLocaleDateString("uz-UZ"),
        endDate: (credit.endDate as Date).toLocaleDateString("uz-UZ"),
      });
    }

    for (const credit of credits) {
      const schedule = credit.schedule as Array<Record<string, unknown>>;
      if (schedule.length === 0) continue;

      const scheduleSheet = workbook.addWorksheet(`Jadval - ${credit.name}`.substring(0, 31), {
        views: [{ state: "frozen", ySplit: 1 }],
      });

      scheduleSheet.columns = [
        { header: "Oy", key: "month", width: 8 },
        { header: "To'lov sanasi", key: "paymentDate", width: 14 },
        { header: "Asosiy qarz", key: "principal", width: 18 },
        { header: "Foiz", key: "interest", width: 18 },
        { header: "Jami to'lov", key: "total", width: 18 },
        { header: "Qolgan qarz", key: "remaining", width: 18 },
        { header: "Holat", key: "status", width: 12 },
      ];

      const scheduleHeaderRow = scheduleSheet.getRow(1);
      scheduleHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      scheduleHeaderRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFF9800" },
      };

      for (const entry of schedule) {
        scheduleSheet.addRow({
          month: entry.monthNumber,
          paymentDate: (entry.paymentDate as Date).toLocaleDateString("uz-UZ"),
          principal: Number(entry.principalAmount),
          interest: Number(entry.interestAmount),
          total: Number(entry.totalPayment),
          remaining: Number(entry.remainingDebt),
          status: entry.isPaid ? "To'langan" : "Kutilmoqda",
        });
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();

    await this.auditLogService.logExport(userId, "CREDIT", {
      count: credits.length,
    });

    this.logger.info({ userId, count: credits.length }, "Credits exported to Excel");

    return Buffer.from(buffer as unknown as ArrayBuffer);
  }

  async importPreview(_userId: string, userRole: string, buffer: Buffer): Promise<ImportPreview> {
    this.requirePermission(userRole, Permission.EXCEL_IMPORT);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new ValidationError("Excel file has no worksheets");
    }

    const columns: string[] = [];
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      columns.push(String(cell.value ?? `Column_${colNumber}`));
    });

    const preview: ImportRow[] = [];
    let validRows = 0;
    let invalidRows = 0;

    const dataRowCount = Math.max(0, sheet.rowCount - 1);
    const maxPreviewRows = Math.min(dataRowCount, 20);

    for (let rowNumber = 2; rowNumber <= maxPreviewRows + 1; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const data: Record<string, string> = {};
      const errors: string[] = [];

      columns.forEach((col, index) => {
        const cell = row.getCell(index + 1);
        data[col] = String(cell.value ?? "");
      });

      const amount = Number(data["amount"] ?? data["miqdor"] ?? 0);
      if (isNaN(amount) || amount <= 0) {
        errors.push("Invalid amount");
      }

      const type = data["type"] ?? data["turi"] ?? "";
      if (type !== "INCOME" && type !== "EXPENSE" && type !== "Kirim" && type !== "Chiqim") {
        errors.push("Invalid type");
      }

      if (errors.length === 0) {
        validRows++;
      } else {
        invalidRows++;
      }

      preview.push({
        rowNumber,
        data,
        isValid: errors.length === 0,
        errors,
      });
    }

    return {
      totalRows: dataRowCount,
      validRows,
      invalidRows,
      preview,
      columns,
    };
  }

  async importTransactions(userId: string, userRole: string, buffer: Buffer, columnMapping: Record<string, string>): Promise<{ imported: number; skipped: number; errors: string[] }> {
    this.requirePermission(userRole, Permission.EXCEL_IMPORT);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new ValidationError("Excel file has no worksheets");
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Cheklov: juda katta fayl serverni qotirib qo'ymasligi uchun
    const MAX_IMPORT_ROWS = 5000;
    const lastRow = Math.min(sheet.rowCount, MAX_IMPORT_ROWS + 1);

    if (sheet.rowCount - 1 > MAX_IMPORT_ROWS) {
      errors.push(`Faqat dastlabki ${MAX_IMPORT_ROWS} qator import qilindi`);
    }

    const pending: Array<{
      type: "INCOME" | "EXPENSE";
      amount: string;
      currency: "UZS" | "USD" | "EUR" | "RUB" | "GBP" | "CNY";
      description: string | null;
      transactionDate: Date;
      createdBy: string;
    }> = [];

    const VALID_CURRENCIES = new Set(["UZS", "USD", "EUR", "RUB", "GBP", "CNY"]);

    for (let rowNumber = 2; rowNumber <= lastRow; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const data: Record<string, string> = {};

      Object.entries(columnMapping).forEach(([targetField, sourceColumn]) => {
        const colIndex = parseInt(sourceColumn, 10);
        if (!isNaN(colIndex)) {
          const cell = row.getCell(colIndex);
          data[targetField] = String(cell.value ?? "");
        }
      });

      const typeRaw = data["type"] ?? "";
      const type = typeRaw === "Kirim" ? "INCOME" : typeRaw === "Chiqim" ? "EXPENSE" : typeRaw;

      if (type !== "INCOME" && type !== "EXPENSE") {
        skipped++;
        errors.push(`Row ${rowNumber}: Invalid type '${typeRaw}'`);
        continue;
      }

      const amount = Number(data["amount"] ?? 0);
      if (isNaN(amount) || amount <= 0) {
        skipped++;
        errors.push(`Row ${rowNumber}: Invalid amount '${data["amount"]}'`);
        continue;
      }

      // Sana tekshiruvi: ilgari "Invalid Date" bazaga yozilib ketardi
      let transactionDate = new Date();
      if (data["date"]) {
        const parsed = new Date(data["date"]);
        if (Number.isNaN(parsed.getTime())) {
          skipped++;
          errors.push(`Row ${rowNumber}: Invalid date '${data["date"]}'`);
          continue;
        }
        transactionDate = parsed;
      }

      const rawCurrency = (data["currency"] ?? "UZS").toUpperCase();
      if (!VALID_CURRENCIES.has(rawCurrency)) {
        skipped++;
        errors.push(`Row ${rowNumber}: Invalid currency '${data["currency"]}'`);
        continue;
      }

      pending.push({
        type,
        amount: amount.toFixed(2),
        currency: rawCurrency as "UZS" | "USD" | "EUR" | "RUB" | "GBP" | "CNY",
        description: data["description"] ? String(data["description"]).slice(0, 500) : null,
        transactionDate,
        createdBy: userId,
      });
    }

    // Ilgari har bir qator uchun alohida `create` chaqirilardi
    // (1000 qator = 1000 ta so'rov). Endi bo'laklab createMany.
    const BATCH_SIZE = 500;
    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE);
      try {
        const result = await this.prisma.transaction.createMany({ data: batch });
        imported += result.count;
      } catch (error) {
        skipped += batch.length;
        errors.push(
          `Batch ${i / BATCH_SIZE + 1}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }

    await this.auditLogService.logImport(userId, "TRANSACTION", {
      imported,
      skipped,
      errors: errors.length,
    });

    this.logger.info({ userId, imported, skipped }, "Transactions imported from Excel");

    return { imported, skipped, errors };
  }

  async generateTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Finance Manager";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Tranzaksiya shabloni", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    sheet.columns = [
      { header: "Turi (INCOME/EXPENSE)", key: "type", width: 22 },
      { header: "Miqdor", key: "amount", width: 18 },
      { header: "Valyuta", key: "currency", width: 10 },
      { header: "Tavsif", key: "description", width: 30 },
      { header: "Sana (YYYY-MM-DD)", key: "date", width: 18 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4CAF50" },
    };

    sheet.addRow({
      type: "INCOME",
      amount: 500000,
      currency: "UZS",
      description: "Maosh",
      date: new Date().toISOString().split("T")[0],
    });

    sheet.addRow({
      type: "EXPENSE",
      amount: 50000,
      currency: "UZS",
      description: "Transport",
      date: new Date().toISOString().split("T")[0],
    });

    // Note: Data validation for ExcelJS requires manual implementation
    // The template uses simple column headers with example rows

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer as unknown as ArrayBuffer);
  }

  private requirePermission(userRole: string, permission: string): void {
    const permissions = ROLE_PERMISSIONS[userRole as keyof typeof ROLE_PERMISSIONS];
    if (!permissions || !permissions.includes(permission as Permission)) {
      throw new ForbiddenError(`Permission '${permission}' is required`);
    }
  }
}
