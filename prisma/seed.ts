import { PrismaClient } from "@prisma/client";
import { DEFAULT_CATEGORIES } from "../src/modules/categories/default-categories.js";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log("Seeding database...");

  const users = await prisma.user.findMany({ select: { id: true, firstName: true } });

  if (users.length === 0) {
    console.log("No users found — categories are created per user on first use.");
    return;
  }

  let totalCreated = 0;

  for (const user of users) {
    const existing = await prisma.category.count({
      where: { createdBy: user.id, isArchived: false },
    });

    if (existing > 0) {
      console.log(`- ${user.firstName}: ${existing} ta kategoriya mavjud, o'tkazib yuborildi`);
      continue;
    }

    const result = await prisma.category.createMany({
      data: DEFAULT_CATEGORIES.map((category) => ({
        name: category.name,
        emoji: category.emoji,
        color: category.color,
        type: category.type,
        createdBy: user.id,
      })),
      skipDuplicates: true,
    });

    totalCreated += result.count;
    console.log(`- ${user.firstName}: ${result.count} ta standart kategoriya qo'shildi`);
  }

  console.log(`Seed completed! Jami ${totalCreated} ta kategoriya yaratildi.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
