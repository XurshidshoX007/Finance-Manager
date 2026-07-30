import type { PrismaClient } from "@prisma/client";

export class SettingsRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async get(userId: string, key: string): Promise<string | null> {
    const setting = await this.prisma.userSetting.findUnique({
      where: { userId_key: { userId, key } },
    });
    return setting?.value ?? null;
  }

  async set(userId: string, key: string, value: string): Promise<void> {
    await this.prisma.userSetting.upsert({
      where: { userId_key: { userId, key } },
      create: { userId, key, value },
      update: { value },
    });
  }

  async getByUser(userId: string): Promise<Array<{ key: string; value: string }>> {
    const settings = await this.prisma.userSetting.findMany({
      where: { userId },
      orderBy: { key: "asc" },
    });
    return settings.map((s: { key: string; value: string }) => ({ key: s.key, value: s.value }));
  }

  async delete(userId: string, key: string): Promise<void> {
    await this.prisma.userSetting.deleteMany({
      where: { userId, key },
    });
  }
}
