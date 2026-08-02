import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import Archiver from "archiver";
import { loadConfig } from "../../shared/config/index.js";
import { getLogger } from "../../shared/logger/index.js";
import { formatDate } from "../../shared/utils/index.js";

const execFileAsync = promisify(execFile);

export class BackupService {
  private readonly logger = getLogger("backup-service");

  async createBackup(): Promise<string> {
    const config = loadConfig();
    const backupDir = config.BACKUP_DIR;

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Ilgari faqat sana ishlatilardi: bir kunda ikkinchi backup
    // birinchisining ustiga yozilib ketardi.
    const now = new Date();
    const timestamp =
      formatDate(now).replace(/-/g, "_") +
      "_" +
      String(now.getHours()).padStart(2, "0") +
      String(now.getMinutes()).padStart(2, "0") +
      String(now.getSeconds()).padStart(2, "0");
    const sqlFileName = `finance_manager_${timestamp}.sql`;
    const sqlFilePath = path.join(backupDir, sqlFileName);
    const zipFileName = `finance_manager_${timestamp}.zip`;
    const zipFilePath = path.join(backupDir, zipFileName);

    this.logger.info({ sqlFilePath, zipFilePath }, "Starting backup...");

    try {
      const dbUrl = new URL(config.DATABASE_URL);
      const host = dbUrl.hostname;
      const port = dbUrl.port || "5432";
      const dbName = dbUrl.pathname.slice(1);
      const user = dbUrl.username;
      const password = dbUrl.password;

      const env = { ...process.env, PGPASSWORD: password };

      await execFileAsync(
        "pg_dump",
        [
          "-h",
          host,
          "-p",
          port,
          "-U",
          user,
          "-d",
          dbName,
          "--no-owner",
          "--no-privileges",
          "-f",
          sqlFilePath,
        ],
        { env, timeout: 300000 },
      );

      this.logger.info({ sqlFilePath }, "SQL dump created");

      await this.zipFile(sqlFilePath, zipFilePath);

      this.logger.info({ zipFilePath }, "Backup zip created");

      await this.cleanOldBackups(backupDir, config.BACKUP_RETENTION_DAYS);

      return zipFilePath;
    } catch (error) {
      this.logger.error({ error }, "Backup failed");

      // Yarim qolgan zip faylni tozalaymiz, aks holda buzuq
      // arxiv "haqiqiy backup" sifatida ro'yxatda turaverardi
      this.safeUnlink(zipFilePath);
      throw error;
    } finally {
      // Xato bo'lsa ham vaqtinchalik .sql fayl qolib ketmasin
      this.safeUnlink(sqlFilePath);
    }
  }

  async restoreBackup(zipFilePath: string): Promise<void> {
    const config = loadConfig();
    const backupDir = config.BACKUP_DIR;
    const sqlFileName = path.basename(zipFilePath, ".zip") + ".sql";
    const sqlFilePath = path.join(backupDir, sqlFileName);

    this.logger.info({ zipFilePath }, "Starting restore...");

    try {
      await this.unzipFile(zipFilePath, sqlFilePath);

      const dbUrl = new URL(config.DATABASE_URL);
      const host = dbUrl.hostname;
      const port = dbUrl.port || "5432";
      const dbName = dbUrl.pathname.slice(1);
      const user = dbUrl.username;
      const password = dbUrl.password;

      const env = { ...process.env, PGPASSWORD: password };

      await execFileAsync(
        "psql",
        ["-h", host, "-p", port, "-U", user, "-d", dbName, "-f", sqlFilePath],
        { env, timeout: 300000 },
      );

      this.logger.info("Restore completed successfully");
    } catch (error) {
      this.logger.error({ error }, "Restore failed");
      throw error;
    } finally {
      this.safeUnlink(sqlFilePath);
    }
  }

  private safeUnlink(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      this.logger.warn({ error, filePath }, "Failed to remove temporary file");
    }
  }

  async listBackups(): Promise<Array<{ fileName: string; size: number; createdAt: Date }>> {
    const config = loadConfig();
    const backupDir = config.BACKUP_DIR;

    if (!fs.existsSync(backupDir)) {
      return [];
    }

    type BackupInfo = { fileName: string; size: number; createdAt: Date };

    const files = fs
      .readdirSync(backupDir)
      .filter((f) => f.endsWith(".zip"))
      .map((f): BackupInfo | null => {
        try {
          const stat = fs.statSync(path.join(backupDir, f));
          return { fileName: f, size: stat.size, createdAt: stat.mtime };
        } catch {
          // Fayl parallel o'chirilgan bo'lishi mumkin
          return null;
        }
      })
      .filter((f): f is BackupInfo => f !== null)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return files;
  }

  private async zipFile(sourcePath: string, targetPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(targetPath);
      const archive = Archiver("zip", { zlib: { level: 9 } });

      output.on("close", () => {
        this.logger.info({ size: archive.pointer() }, "Zip archive created");
        resolve();
      });

      archive.on("error", (err) => reject(err));

      archive.pipe(output);
      archive.file(sourcePath, { name: path.basename(sourcePath) });
      archive.finalize();
    });
  }

  private async unzipFile(zipPath: string, targetPath: string): Promise<void> {
    const { default: AdmZip } = await import("adm-zip");
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(path.dirname(targetPath), true);
  }

  private async cleanOldBackups(backupDir: string, retentionDays: number): Promise<void> {
    if (!fs.existsSync(backupDir)) return;

    const now = Date.now();
    const maxAge = retentionDays * 24 * 60 * 60 * 1000;

    const files = fs.readdirSync(backupDir).filter((f) => f.endsWith(".zip"));

    for (const file of files) {
      const filePath = path.join(backupDir, file);

      try {
        // birthtime ba'zi FS'larda 0 qaytaradi — mtime ishonchliroq
        const stat = fs.statSync(filePath);
        if (now - stat.mtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
          this.logger.info({ file }, "Old backup deleted");
        }
      } catch (error) {
        this.logger.warn({ error, file }, "Failed to inspect/delete old backup");
      }
    }
  }
}
