import PDFDocument from "pdfkit";
import type { PrismaClient } from "@prisma/client";
import type { AuditLogService } from "../users/audit-log.service.js";
import { ROLE_PERMISSIONS, Permission } from "../../shared/types/index.js";
import { ForbiddenError } from "../../shared/errors/index.js";
import { getLogger } from "../../shared/logger/index.js";
import { formatMoney } from "../../shared/utils/index.js";

interface ReportData {
  period: string;
  currency: string;
  income: number;
  expense: number;
  net: number;
  topCategories: Array<{ name: string; emoji: string; total: number; percentage: number }>;
  topSources: Array<{ name: string; emoji: string; total: number; percentage: number }>;
}

export class PdfService {
  private readonly auditLogService: AuditLogService;
  private readonly logger = getLogger("pdf-service");

  constructor(_prisma: PrismaClient, auditLogService: AuditLogService) {
    this.auditLogService = auditLogService;
  }

  async exportReport(userId: string, userRole: string, report: ReportData): Promise<Buffer> {
    this.requirePermission(userRole, Permission.REPORTS_EXPORT);

    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    const title = `Finance Manager — ${report.period} Hisobot`;
    const dateStr = new Date().toLocaleDateString("uz-UZ");

    // Header
    doc.fontSize(24).fillColor("#1a237e").text(title, { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("#666666").text(`Sana: ${dateStr} | Valyuta: ${report.currency}`, { align: "center" });
    doc.moveDown(1.5);

    // Divider
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#1a237e").lineWidth(2).stroke();
    doc.moveDown(1);

    // Summary
    doc.fontSize(16).fillColor("#1a237e").text("Umumiy ko'rsatkichlar");
    doc.moveDown(0.5);

    const summaryY = doc.y;
    const boxWidth = 150;
    const boxHeight = 70;

    // Income box
    doc.rect(50, summaryY, boxWidth, boxHeight).fillColor("#e8f5e9").fill();
    doc.fontSize(9).fillColor("#2e7d32").text("KIRIM", 60, summaryY + 10);
    doc.fontSize(16).fillColor("#1b5e20").text(formatMoney(report.income, report.currency), 60, summaryY + 30);

    // Expense box
    doc.rect(210, summaryY, boxWidth, boxHeight).fillColor("#ffebee").fill();
    doc.fontSize(9).fillColor("#c62828").text("CHIQIM", 220, summaryY + 10);
    doc.fontSize(16).fillColor("#b71c1c").text(formatMoney(report.expense, report.currency), 220, summaryY + 30);

    // Net box
    doc.rect(370, summaryY, boxWidth, boxHeight).fillColor(report.net >= 0 ? "#e3f2fd" : "#fff3e0").fill();
    doc.fontSize(9).fillColor(report.net >= 0 ? "#1565c0" : "#e65100").text("NET", 380, summaryY + 10);
    doc.fontSize(16).fillColor(report.net >= 0 ? "#0d47a1" : "#bf360c").text(formatMoney(report.net, report.currency), 380, summaryY + 30);

    doc.y = summaryY + boxHeight + 30;

    // Top Categories
    if (report.topCategories.length > 0) {
      doc.fontSize(16).fillColor("#1a237e").text("Top Kategoriyalar");
      doc.moveDown(0.5);

      for (const cat of report.topCategories.slice(0, 10)) {
        const barWidth = Math.max(10, (cat.percentage / 100) * 400);

        doc.fontSize(10).fillColor("#333333").text(`${cat.emoji} ${cat.name}`, 50, doc.y, { continued: true });
        doc.fillColor("#666666").text(` — ${formatMoney(cat.total, report.currency)} (${cat.percentage.toFixed(1)}%)`);

        doc.rect(50, doc.y + 2, barWidth, 8).fillColor("#1a237e").fill();
        doc.moveDown(0.8);
      }
      doc.moveDown(1);
    }

    // Top Sources
    if (report.topSources.length > 0) {
      doc.fontSize(16).fillColor("#1a237e").text("Top Manbalar");
      doc.moveDown(0.5);

      for (const src of report.topSources.slice(0, 10)) {
        const barWidth = Math.max(10, (src.percentage / 100) * 400);

        doc.fontSize(10).fillColor("#333333").text(`${src.emoji} ${src.name}`, 50, doc.y, { continued: true });
        doc.fillColor("#666666").text(` — ${formatMoney(src.total, report.currency)} (${src.percentage.toFixed(1)}%)`);

        doc.rect(50, doc.y + 2, barWidth, 8).fillColor("#0d47a1").fill();
        doc.moveDown(0.8);
      }
    }

    // Footer
    doc.moveDown(3);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#cccccc").lineWidth(0.5).stroke();
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor("#999999").text("Finance Manager — Avtomatik hisobot", { align: "center" });

    doc.end();

    await this.auditLogService.logExport(userId, "REPORT_PDF", {
      period: report.period,
      currency: report.currency,
    });

    this.logger.info({ userId, period: report.period }, "PDF report exported");

    return Buffer.concat(chunks);
  }

  async exportTransactionsList(
    userId: string,
    userRole: string,
    transactions: Array<{
      type: string;
      amount: string;
      currency: string;
      description: string | null;
      category: string | null;
      source: string | null;
      transactionDate: Date;
      isCancelled: boolean;
    }>,
  ): Promise<Buffer> {
    this.requirePermission(userRole, Permission.TRANSACTIONS_EXPORT);

    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "A4", margin: 50, layout: "landscape" });
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    doc.fontSize(18).fillColor("#1a237e").text("Tranzaksiyalar ro'yxati", { align: "center" });
    doc.moveDown(1);

    const tableTop = doc.y;
    const colWidths = [80, 100, 120, 180, 120, 100];
    const headers = ["Sana", "Turi", "Miqdor", "Tavsif", "Kategoriya", "Holat"];

    let x = 50;
    doc.rect(50, tableTop, 750, 25).fillColor("#1a237e").fill();
    headers.forEach((header, index) => {
      const width = colWidths[index] ?? 0;
      doc.fontSize(9).fillColor("#ffffff").text(header, x + 5, tableTop + 7, { width });
      x += width;
    });

    let rowY = tableTop + 30;
    for (const [index, tx] of transactions.slice(0, 50).entries()) {
      if (rowY > 550) {
        doc.addPage();
        rowY = 50;
      }

      if (index % 2 === 0) {
        doc.rect(50, rowY - 3, 750, 22).fillColor("#f5f5f5").fill();
      }

      x = 50;
      const typeLabel = tx.type === "INCOME" ? "Kirim" : tx.type === "EXPENSE" ? "Chiqim" : "O'tkazma";
      const rowData = [
        tx.transactionDate.toLocaleDateString("uz-UZ"),
        typeLabel,
        formatMoney(Number(tx.amount), tx.currency),
        (tx.description ?? "").substring(0, 30),
        (tx.category ?? "").substring(0, 15),
        tx.isCancelled ? "Bekor" : "Faol",
      ];

      rowData.forEach((value, index) => {
        const width = colWidths[index] ?? 0;
        doc.fontSize(8).fillColor(tx.isCancelled ? "#999999" : "#333333").text(value, x + 5, rowY, { width });
        x += width;
      });

      rowY += 22;
    }

    doc.end();

    await this.auditLogService.logExport(userId, "TRANSACTIONS_PDF", {
      count: transactions.length,
    });

    this.logger.info({ userId, count: transactions.length }, "Transactions PDF exported");

    return Buffer.concat(chunks);
  }

  private requirePermission(userRole: string, permission: string): void {
    const permissions = ROLE_PERMISSIONS[userRole as keyof typeof ROLE_PERMISSIONS];
    if (!permissions || !permissions.includes(permission as Permission)) {
      throw new ForbiddenError(`Permission '${permission}' is required`);
    }
  }
}
