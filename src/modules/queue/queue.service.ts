import { Queue, Worker, type Job } from "bullmq";
import { getLogger } from "../../shared/logger/index.js";

export interface DailyReminderJob {
  type: "daily_reminder";
  userId: string;
  telegramId: string;
}

export interface CreditReminderJob {
  type: "credit_reminder";
  creditId: string;
  userId: string;
  telegramId: string;
  creditName: string;
  amount: string;
  paymentDate: string;
}

export interface BackupJob {
  type: "backup";
}

export type AppJob = DailyReminderJob | CreditReminderJob | BackupJob;

export class QueueService {
  private readonly queue: Queue<AppJob>;
  private readonly logger = getLogger("queue-service");
  private readonly redisHost: string;
  private readonly redisPort: number;
  private readonly redisPassword: string | undefined;

  constructor(redisHost: string, redisPort: number, redisPassword?: string) {
    this.redisHost = redisHost;
    this.redisPort = redisPort;
    this.redisPassword = redisPassword;

    const connection = {
      host: redisHost,
      port: redisPort,
      password: redisPassword,
    };

    this.queue = new Queue<AppJob>("finance-manager", { connection });
    this.logger.info("Queue service initialized");
  }

  async addDailyReminder(userId: string, telegramId: string): Promise<void> {
    await this.queue.add("daily_reminder", {
      type: "daily_reminder",
      userId,
      telegramId,
    }, {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    });
    this.logger.debug({ userId }, "Daily reminder job added");
  }

  async addCreditReminder(
    creditId: string,
    userId: string,
    telegramId: string,
    creditName: string,
    amount: string,
    paymentDate: string,
  ): Promise<void> {
    await this.queue.add("credit_reminder", {
      type: "credit_reminder",
      creditId,
      userId,
      telegramId,
      creditName,
      amount,
      paymentDate,
    }, {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    });
    this.logger.debug({ creditId, userId }, "Credit reminder job added");
  }

  async addBackupJob(): Promise<void> {
    await this.queue.add("backup", {
      type: "backup",
    }, {
      attempts: 2,
      backoff: { type: "exponential", delay: 10000 },
    });
    this.logger.info("Backup job added");
  }

  createWorker(processor: (job: Job<AppJob>) => Promise<void>): Worker<AppJob> {
    const connection = {
      host: this.redisHost,
      port: this.redisPort,
      password: this.redisPassword,
    };

    const worker = new Worker<AppJob>("finance-manager", processor, { connection });

    worker.on("completed", (job) => {
      this.logger.info({ jobId: job.id, type: job.data.type }, "Job completed");
    });

    worker.on("failed", (job, err) => {
      this.logger.error({ jobId: job?.id, type: job?.data?.type, error: err.message }, "Job failed");
    });

    return worker;
  }

  async getQueueStats(): Promise<{ waiting: number; active: number; completed: number; failed: number }> {
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  }

  async close(): Promise<void> {
    await this.queue.close();
    this.logger.info("Queue service closed");
  }
}
