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

interface ImportResult {
  imported: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

type Currency = "UZS" | "USD" | "EUR" | "RUB" | "GBP" | "CNY";
type TxType = "INCOME" | "EXPENSE";

const VALID_CURRENCIES: Currency[] = ["UZS", "USD", "EUR", "RUB", "GBP", "CNY"];

const FIELD_ALIASES: Record<string, string[]> = {
  type: [
    "type",
    "turi",
    "transaction type",
    "transaction_type",
    "turi (income/expense)",
    "turi (kirim/chiqim)",
    "turi (income/expense/transfer)",
    "kir/ch",
    "operation",
    "operatsiya",
  ],
  amount: [
    "amount",
    "miqdor",
    "summa",
    "sum",
    "value",
    "qiymat",
    "price",
    "pul",
    "amount (uzs)",
    "amount uzs",
  ],
  currency: ["currency", "valyuta", "valuta", "curr", "pul birligi"],
  description: [
    "description",
    "tavsif",
    "izoh",
    "comment",
    "note",
    "purpose",
    "memo",
    "tavar",
    "detail",
  ],
  date: [
    "date",
    "sana",
    "transactiondate",
    "transaction_date",
    "transaction date",
    "sana (yyyy-mm-dd)",
    "tranzaksiya sanasi",
    "time",
    "datetime",
    "vaqt",
  ],
  category: ["category", "kategoriya", "cat", "toifa", "category name", "kategoriya nomi"],
  source: ["source", "manba", "account", "hisob", "source name", "manba nomi", "wallet"],
  referenceId: [
    "referenceid",
    "reference_id",
    "ref",
    "refid",
    "external_id",
    "externalid",
    "id",
    "transactionid",
  ],
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[:()]/g, "").replace(/\s+/g, " ").trim();
}

function getCellRawValue(cell: ExcelJS.Cell): unknown {
  const v = cell.value as unknown;
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if (obj instanceof Date) return obj as unknown as Date;
    if ("text" in obj && typeof obj.text === "string") {
      return obj.text as string;
    }
    if ("richText" in obj && Array.isArray(obj.richText)) {
      return (obj.richText as Array<{ text: string }>).map((rt) => rt.text).join("");
    }
    if ("result" in obj) {
      return obj.result as unknown;
    }
    // Fallback
    return "";
  }
  return v;
}

function getCellString(cell: ExcelJS.Cell): string {
  const raw = getCellRawValue(cell);
  if (raw === null || raw === undefined) return "";
  if (raw instanceof Date) return raw.toISOString();
  return String(raw).trim();
}

function normalizeTransactionType(raw: string): TxType | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  const incomeTokens = ["income", "kirim", "kiritma", "in", "kirk", "daromad", "+"];
  const expenseTokens = ["expense", "chiqim", "chiqish", "out", "chi", "xarajat", "-", "cost"];

  if (incomeTokens.includes(s)) return "INCOME";
  if (expenseTokens.includes(s)) return "EXPENSE";

  if (s.includes("kirim") || s.includes("income") || s.includes("daromad")) return "INCOME";
  if (s.includes("chiqim") || s.includes("expense") || s.includes("xarajat") || s.includes("chiq"))
    return "EXPENSE";

  const up = s.toUpperCase();
  if (up === "INCOME") return "INCOME";
  if (up === "EXPENSE") return "EXPENSE";

  return null;
}

function parseAmount(raw: string): number | null {
  if (!raw) return null;
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/\u00A0/g, " ");
  cleaned = cleaned
    .replace(/[A-Z]{3}/g, "")
    .replace(/UZS|USD|EUR|RUB|GBP|CNY/gi, "")
    .trim();
  cleaned = cleaned.replace(/\s/g, "");

  if (cleaned.includes(",") && cleaned.includes(".")) {
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    if (lastDot > lastComma) {
      cleaned = cleaned.replace(/,/g, "");
    } else {
      cleaned = cleaned.replace(/\./g, "").replace(/,/g, ".");
    }
  } else if (cleaned.includes(",") && !cleaned.includes(".")) {
    const parts = cleaned.split(",");
    const lastPart = parts[parts.length - 1] ?? "";
    if (lastPart.length <= 2) {
      cleaned = cleaned.replace(/,/g, ".");
      if (cleaned.split(".").length > 2) {
        const segs = cleaned.split(".");
        const dec = segs.pop() ?? "";
        cleaned = segs.join("") + "." + dec;
      }
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  }

  const num = Number(cleaned);
  if (isNaN(num) || !isFinite(num)) return null;
  return num;
}

function parseCurrency(raw: string): Currency {
  if (!raw) return "UZS";
  const up = raw.trim().toUpperCase();
  if ((VALID_CURRENCIES as string[]).includes(up)) return up as Currency;
  const map: Record<string, Currency> = {
    "SO'M": "UZS",
    SOM: "UZS",
    СЎМ: "UZS",
    DOLLAR: "USD",
    EURO: "EUR",
    EVRO: "EUR",
    RUBL: "RUB",
    РУБ: "RUB",
  };
  if (map[up]) return map[up];
  return "UZS";
}

function parseDate(raw: unknown): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) {
    if (!isNaN(raw.getTime())) return raw;
    return null;
  }
  if (typeof raw === "number") {
    if (raw > 0 && raw < 60000) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const d = new Date(excelEpoch.getTime() + raw * 24 * 60 * 60 * 1000);
      if (!isNaN(d.getTime())) return d;
    }
    if (raw > 1000000000000) {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  }

  const s = String(raw).trim();
  if (!s) return null;

  const iso = new Date(s);
  if (!isNaN(iso.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(s)) {
    return iso;
  }

  const dmYRegex = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/;
  const yMdRegex = /^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/;
  const dmyWithTime = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/;

  let m = s.match(dmyWithTime);
  if (m) {
    const day = parseInt(m[1] ?? "0", 10);
    const month = parseInt(m[2] ?? "0", 10) - 1;
    let year = parseInt(m[3] ?? "0", 10);
    const hour = parseInt(m[4] ?? "0", 10);
    const minute = parseInt(m[5] ?? "0", 10);
    const second = m[6] ? parseInt(m[6], 10) : 0;
    if (year < 100) year += 2000;
    const d = new Date(year, month, day, hour, minute, second);
    if (!isNaN(d.getTime())) return d;
  }

  m = s.match(dmYRegex);
  if (m) {
    const day = parseInt(m[1] ?? "0", 10);
    const month = parseInt(m[2] ?? "0", 10) - 1;
    let year = parseInt(m[3] ?? "0", 10);
    if (year < 100) year += 2000;
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  m = s.match(yMdRegex);
  if (m) {
    const year = parseInt(m[1] ?? "0", 10);
    const month = parseInt(m[2] ?? "0", 10) - 1;
    const day = parseInt(m[3] ?? "0", 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  const fallback = new Date(s);
  if (!isNaN(fallback.getTime())) return fallback;

  return null;
}

function resolveColumnIndex(
  sourceColumn: string,
  columns: string[],
  normalizedColumns: string[],
  headerIndexMap: Map<string, number>,
): number | null {
  if (!sourceColumn) return null;
  const trimmed = sourceColumn.trim();
  const num = parseInt(trimmed, 10);
  if (!isNaN(num) && String(num) === trimmed) {
    if (num >= 1 && num <= columns.length) return num;
    return null;
  }
  const norm = normalizeHeader(trimmed);
  const mappedIdx = headerIndexMap.get(norm);
  if (mappedIdx !== undefined) {
    return mappedIdx;
  }
  for (let i = 0; i < normalizedColumns.length; i++) {
    const colNorm = normalizedColumns[i];
    if (!colNorm) continue;
    if (colNorm.includes(norm) || norm.includes(colNorm)) {
      return i + 1;
    }
  }
  return null;
}

function autoDetectMapping(
  _columns: string[],
  normalizedColumns: string[],
): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (let i = 0; i < normalizedColumns.length; i++) {
      const col = normalizedColumns[i];
      if (!col) continue;
      for (const alias of aliases) {
        const normAlias = normalizeHeader(alias);
        if (col === normAlias || col.includes(normAlias) || normAlias.includes(col)) {
          if (!mapping[field]) {
            mapping[field] = String(i + 1);
            break;
          }
        }
      }
      if (mapping[field]) break;
    }
  }
  return mapping;
}

export class ExcelService {
  private readonly prisma: PrismaClient;
  private readonly auditLogService: AuditLogService;
  private readonly logger = getLogger("excel-service");

  constructor(prisma: PrismaClient, auditLogService: AuditLogService) {
    this.prisma = prisma;
    this.auditLogService = auditLogService;
  }

  async exportTransactions(
    userId: string,
    userRole: string,
    filters?: Record<string, unknown>,
  ): Promise<Buffer> {
    this.requirePermission(userRole, Permission.EXCEL_EXPORT);
    const where: Record<string, unknown> = {
      createdBy: userId,
      isArchived: false,
      ...filters,
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
      { header: "Reference ID", key: "referenceId", width: 20 },
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
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4CAF50" },
    };
    for (const tx of transactions) {
      sheet.addRow({
        id: (tx as Record<string, unknown>).id,
        referenceId: (tx as Record<string, unknown>).referenceId ?? "",
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
      to: { row: 1, column: 11 },
    };
    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
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
        status:
          credit.status === "ACTIVE"
            ? "Faol"
            : credit.status === "COMPLETED"
              ? "Yakunlangan"
              : "Bekor qilingan",
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
    if (!buffer || buffer.length === 0) {
      throw new ValidationError("Empty file buffer");
    }
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new ValidationError("Excel file has no worksheets");
    }
    const columns: string[] = [];
    const normalizedColumns: string[] = [];
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      const raw = getCellString(cell);
      const name = raw || `Column_${colNumber}`;
      columns.push(name);
      normalizedColumns.push(normalizeHeader(name));
    });
    if (columns.length === 0) {
      throw new ValidationError("Excel header row is empty");
    }
    const autoMapping = autoDetectMapping(columns, normalizedColumns);
    const totalRows = Math.max(sheet.rowCount - 1, 0);
    let validRows = 0;
    let invalidRows = 0;
    const preview: ImportRow[] = [];
    const maxPreviewRows = 20;
    let previewCollected = 0;

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      let isEmptyRow = true;
      for (let c = 1; c <= columns.length; c++) {
        if (getCellString(row.getCell(c))) {
          isEmptyRow = false;
          break;
        }
      }
      if (isEmptyRow) continue;

      const data: Record<string, string> = {};
      const errors: string[] = [];

      columns.forEach((col, index) => {
        const cell = row.getCell(index + 1);
        data[col] = getCellString(cell);
      });

      const extract = (field: string): string => {
        const mappedIdxStr = autoMapping[field];
        if (mappedIdxStr) {
          const idx = parseInt(mappedIdxStr, 10);
          const colName = columns[idx - 1] ?? "";
          if (!isNaN(idx) && colName) {
            return data[colName] ?? "";
          }
        }
        for (const alias of FIELD_ALIASES[field] || []) {
          const normAlias = normalizeHeader(alias);
          for (let i = 0; i < normalizedColumns.length; i++) {
            if (normalizedColumns[i] === normAlias) {
              const colName = columns[i];
              if (colName) return data[colName] ?? "";
            }
          }
        }
        return "";
      };

      let amountStr = extract("amount");
      if (!amountStr) {
        amountStr =
          data["amount"] ??
          data["Amount"] ??
          data["miqdor"] ??
          data["Miqdor"] ??
          data["summa"] ??
          "";
      }
      const amount = parseAmount(amountStr);
      if (amount === null || amount <= 0) {
        errors.push(`Invalid amount '${amountStr}'`);
      }

      let typeRaw = extract("type");
      if (!typeRaw) {
        typeRaw = data["type"] ?? data["Turi"] ?? data["turi"] ?? "";
      }
      const normalizedType = normalizeTransactionType(typeRaw);
      if (!normalizedType) {
        errors.push(`Invalid type '${typeRaw}'`);
      }

      const dateRaw = extract("date");
      if (dateRaw) {
        const parsed = parseDate(dateRaw);
        if (!parsed) {
          errors.push(`Invalid date '${dateRaw}'`);
        }
      }

      if (errors.length === 0) validRows++;
      else invalidRows++;

      if (previewCollected < maxPreviewRows) {
        preview.push({
          rowNumber,
          data,
          isValid: errors.length === 0,
          errors,
        });
        previewCollected++;
      }
    }

    return {
      totalRows,
      validRows,
      invalidRows,
      preview,
      columns,
    };
  }

  async importTransactions(
    userId: string,
    userRole: string,
    buffer: Buffer,
    columnMapping: Record<string, string> = {},
  ): Promise<ImportResult> {
    this.requirePermission(userRole, Permission.EXCEL_IMPORT);
    if (!buffer || buffer.length === 0) {
      throw new ValidationError("Empty file buffer");
    }
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new ValidationError("Excel file has no worksheets");
    }
    const columns: string[] = [];
    const normalizedColumns: string[] = [];
    const headerIndexMap = new Map<string, number>();
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      const raw = getCellString(cell);
      const name = raw || `Column_${colNumber}`;
      columns.push(name);
      const norm = normalizeHeader(name);
      normalizedColumns.push(norm);
      if (!headerIndexMap.has(norm)) headerIndexMap.set(norm, colNumber);
    });
    if (columns.length === 0) {
      throw new ValidationError("Header row empty");
    }

    const autoMapping = autoDetectMapping(columns, normalizedColumns);
    const effectiveMapping: Record<string, number> = {};
    const allFields = new Set<string>([
      ...Object.keys(FIELD_ALIASES),
      ...Object.keys(columnMapping),
    ]);
    for (const field of allFields) {
      const userMapped = columnMapping[field];
      let idx: number | null = null;
      if (userMapped) {
        idx = resolveColumnIndex(userMapped, columns, normalizedColumns, headerIndexMap);
      }
      if (idx === null && autoMapping[field]) {
        const autoMapped = autoMapping[field];
        if (autoMapped) {
          idx = resolveColumnIndex(autoMapped, columns, normalizedColumns, headerIndexMap);
        }
      }
      if (idx !== null) {
        effectiveMapping[field] = idx;
      }
    }

    if (!effectiveMapping["type"] && !effectiveMapping["amount"]) {
      this.logger.warn(
        { userId, columns },
        "Could not auto-detect essential columns, will use heuristic",
      );
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    const categoryCache = new Map<string, string>();
    const sourceCache = new Map<string, string>();

    try {
      const existingCategories = await this.prisma.category.findMany({
        where: { createdBy: userId, isArchived: false },
        select: { id: true, name: true, type: true },
      });
      for (const c of existingCategories) {
        categoryCache.set(`${c.type}:${c.name.toLowerCase()}`, c.id);
      }
      const existingSources = await this.prisma.source.findMany({
        where: { createdBy: userId, isArchived: false },
        select: { id: true, name: true },
      });
      for (const s of existingSources) {
        sourceCache.set(s.name.toLowerCase(), s.id);
      }
    } catch (preloadError) {
      this.logger.warn({ error: preloadError }, "Failed to preload categories/sources cache");
    }

    const getMappedValue = (row: ExcelJS.Row, field: string): string => {
      const colIdx = effectiveMapping[field];
      if (colIdx) {
        return getCellString(row.getCell(colIdx));
      }
      for (const alias of FIELD_ALIASES[field] || []) {
        const normAlias = normalizeHeader(alias);
        const idx = headerIndexMap.get(normAlias);
        if (idx) return getCellString(row.getCell(idx));
      }
      return "";
    };

    const getMappedRaw = (row: ExcelJS.Row, field: string): unknown => {
      const colIdx = effectiveMapping[field];
      if (colIdx) {
        return getCellRawValue(row.getCell(colIdx));
      }
      return "";
    };

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      let empty = true;
      for (let c = 1; c <= columns.length; c++) {
        if (getCellString(row.getCell(c))) {
          empty = false;
          break;
        }
      }
      if (empty) continue;

      const typeRaw = getMappedValue(row, "type");
      const amountRawStr = getMappedValue(row, "amount");
      const amountRawRaw = getMappedRaw(row, "amount");
      const currencyRaw = getMappedValue(row, "currency");
      const descriptionRaw = getMappedValue(row, "description");
      const dateRawRaw = getMappedRaw(row, "date");
      const dateRawStr = getMappedValue(row, "date");
      const categoryRaw = getMappedValue(row, "category");
      const sourceRaw = getMappedValue(row, "source");
      const referenceIdRaw = getMappedValue(row, "referenceId") || "";

      const type = normalizeTransactionType(typeRaw);
      if (!type) {
        skipped++;
        errors.push(`Row ${rowNumber}: Invalid type '${typeRaw}'`);
        continue;
      }

      let amount: number | null = null;
      if (typeof amountRawRaw === "number") {
        amount = amountRawRaw;
      } else {
        amount = parseAmount(amountRawStr || String(amountRawRaw ?? ""));
      }
      if (amount === null || amount <= 0 || isNaN(amount)) {
        skipped++;
        errors.push(`Row ${rowNumber}: Invalid amount '${amountRawStr}'`);
        continue;
      }

      const currency = parseCurrency(currencyRaw);

      let transactionDate: Date = new Date();
      if (dateRawRaw || dateRawStr) {
        const parsed = parseDate(dateRawRaw) ?? parseDate(dateRawStr);
        if (parsed) {
          transactionDate = parsed;
        } else if (dateRawStr) {
          this.logger.warn({ rowNumber, dateRawStr }, "Invalid date, using current date");
        }
      }

      let categoryId: string | undefined = undefined;
      if (categoryRaw) {
        const key = `${type}:${categoryRaw.toLowerCase()}`;
        let cachedId = categoryCache.get(key);
        if (!cachedId) {
          try {
            const existing = await this.prisma.category.findFirst({
              where: {
                createdBy: userId,
                name: { equals: categoryRaw, mode: "insensitive" } as unknown as string,
                type: type as "INCOME" | "EXPENSE" | "TRANSFER",
                isArchived: false,
              },
            });
            if (existing) {
              cachedId = existing.id;
              categoryCache.set(key, existing.id);
            } else {
              const createdCat = await this.prisma.category.create({
                data: {
                  name: categoryRaw,
                  type: type as "INCOME" | "EXPENSE" | "TRANSFER",
                  createdBy: userId,
                  emoji: type === "INCOME" ? "💰" : "💸",
                  color: type === "INCOME" ? "#4CAF50" : "#F44336",
                },
              });
              cachedId = createdCat.id;
              categoryCache.set(key, createdCat.id);
            }
          } catch (catErr) {
            this.logger.warn({ rowNumber, categoryRaw, error: catErr }, "Category resolve failed");
          }
        }
        categoryId = cachedId;
      }

      let sourceId: string | undefined = undefined;
      if (sourceRaw) {
        const key = sourceRaw.toLowerCase();
        let cachedId = sourceCache.get(key);
        if (!cachedId) {
          try {
            const existing = await this.prisma.source.findFirst({
              where: {
                createdBy: userId,
                name: { equals: sourceRaw, mode: "insensitive" } as unknown as string,
                isArchived: false,
              },
            });
            if (existing) {
              cachedId = existing.id;
              sourceCache.set(key, existing.id);
            } else {
              const createdSrc = await this.prisma.source.create({
                data: {
                  name: sourceRaw,
                  currency: currency as "UZS" | "USD" | "EUR" | "RUB" | "GBP" | "CNY",
                  createdBy: userId,
                  emoji: "💰",
                  color: "#4CAF50",
                },
              });
              cachedId = createdSrc.id;
              sourceCache.set(key, createdSrc.id);
            }
          } catch (srcErr) {
            this.logger.warn({ rowNumber, sourceRaw, error: srcErr }, "Source resolve failed");
          }
        }
        sourceId = cachedId;
      }

      const refId = referenceIdRaw ? String(referenceIdRaw).trim() : null;
      const uniqueRef = refId ? `${userId}_${refId}`.substring(0, 200) : null;

      try {
        if (uniqueRef) {
          const existingTx = await this.prisma.transaction.findFirst({
            where: {
              referenceId: uniqueRef,
              createdBy: userId,
            },
          });
          if (existingTx) {
            await this.prisma.transaction.update({
              where: { id: existingTx.id },
              data: {
                type: type as "INCOME" | "EXPENSE",
                amount: String(amount),
                currency: currency as "UZS" | "USD" | "EUR" | "RUB" | "GBP" | "CNY",
                description: descriptionRaw || null,
                transactionDate,
                categoryId: categoryId ?? existingTx.categoryId,
                sourceId: sourceId ?? existingTx.sourceId,
              },
            });
            updated++;
            continue;
          }
        }

        await this.prisma.transaction.create({
          data: {
            type: type as "INCOME" | "EXPENSE",
            amount: String(amount),
            currency: currency as "UZS" | "USD" | "EUR" | "RUB" | "GBP" | "CNY",
            description: descriptionRaw || null,
            transactionDate,
            createdBy: userId,
            referenceId: uniqueRef,
            categoryId,
            sourceId,
          },
        });
        created++;
      } catch (error) {
        skipped++;
        const msg = error instanceof Error ? error.message : "Unknown error";
        if (msg.includes("Unique constraint") && uniqueRef) {
          try {
            const existing = await this.prisma.transaction.findFirst({
              where: { referenceId: uniqueRef },
            });
            if (existing) {
              await this.prisma.transaction.update({
                where: { id: existing.id },
                data: {
                  type: type as "INCOME" | "EXPENSE",
                  amount: String(amount),
                  currency: currency as "UZS" | "USD" | "EUR" | "RUB" | "GBP" | "CNY",
                  description: descriptionRaw || null,
                  transactionDate,
                  categoryId,
                  sourceId,
                },
              });
              updated++;
              skipped--;
              continue;
            }
          } catch {
            // ignore
          }
        }
        errors.push(`Row ${rowNumber}: ${msg}`);
        this.logger.warn({ rowNumber, error: msg }, "Failed to import row");
      }
    }

    await this.auditLogService.logImport(userId, "TRANSACTION", {
      imported: created,
      created,
      updated,
      skipped,
      errors: errors.length,
    });

    this.logger.info(
      { userId, created, updated, skipped, errorCount: errors.length },
      `Import finished for user ${userId}. Created: ${created}, updated: ${updated}.`,
    );

    this.logger.info(
      `Import finished for user ${userId}. Created: ${created}, updated: ${updated}.`,
    );

    return {
      imported: created,
      created,
      updated,
      skipped,
      errors,
    };
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
      { header: "Valyuta", key: "currency", width: 12 },
      { header: "Tavsif", key: "description", width: 30 },
      { header: "Kategoriya", key: "category", width: 20 },
      { header: "Manba", key: "source", width: 20 },
      { header: "Sana (YYYY-MM-DD)", key: "date", width: 18 },
      { header: "Reference ID", key: "referenceId", width: 22 },
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
      category: "Maosh",
      source: "Naqd",
      date: new Date().toISOString().split("T")[0],
      referenceId: "REF001",
    });
    sheet.addRow({
      type: "EXPENSE",
      amount: 50000,
      currency: "UZS",
      description: "Transport",
      category: "Transport",
      source: "Naqd",
      date: new Date().toISOString().split("T")[0],
      referenceId: "REF002",
    });
    sheet.addRow({
      type: "EXPENSE",
      amount: 120000,
      currency: "UZS",
      description: "Oziq-ovqat",
      category: "Oziq-ovqat",
      source: "Karta",
      date: new Date().toISOString().split("T")[0],
      referenceId: "REF003",
    });
    sheet.getRow(2).font = { size: 11 };
    sheet.getRow(3).font = { size: 11 };
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
