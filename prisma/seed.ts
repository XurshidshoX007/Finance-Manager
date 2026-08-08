import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const defaultCategories = [
  // Kirim kategoriyalari
  { id: "system-income-oylik", name: "Oylik", emoji: "💼", color: "#4CAF50", type: "INCOME" as const },
  { id: "system-income-bonus", name: "Bonus", emoji: "💰", color: "#8BC34A", type: "INCOME" as const },
  { id: "system-income-biznes", name: "Biznes", emoji: "🏢", color: "#009688", type: "INCOME" as const },
  { id: "system-income-savdo", name: "Savdo", emoji: "🛍", color: "#00BCD4", type: "INCOME" as const },
  { id: "system-income-ijara-daromadi", name: "Ijara daromadi", emoji: "🏠", color: "#3F51B5", type: "INCOME" as const },
  { id: "system-income-investitsiya", name: "Investitsiya", emoji: "📈", color: "#CDDC39", type: "INCOME" as const },
  { id: "system-income-sovga", name: "Sovg'a", emoji: "🎁", color: "#9C27B0", type: "INCOME" as const },
  { id: "system-income-qarz-qaytishi", name: "Qarz qaytishi", emoji: "↩️", color: "#607D8B", type: "INCOME" as const },
  { id: "system-income-boshqa", name: "Boshqa kirim", emoji: "📝", color: "#795548", type: "INCOME" as const },

  // Chiqim kategoriyalari
  { id: "system-expense-oziq-ovqat", name: "Oziq-ovqat", emoji: "🍽", color: "#F44336", type: "EXPENSE" as const },
  { id: "system-expense-transport", name: "Transport", emoji: "🚕", color: "#FF9800", type: "EXPENSE" as const },
  { id: "system-expense-uy-joy-ijara", name: "Uy-joy / Ijara", emoji: "🏠", color: "#E91E63", type: "EXPENSE" as const },
  { id: "system-expense-kommunal", name: "Kommunal to'lovlar", emoji: "💡", color: "#9C27B0", type: "EXPENSE" as const },
  { id: "system-expense-aloqa-internet", name: "Aloqa / Internet", emoji: "📱", color: "#3F51B5", type: "EXPENSE" as const },
  { id: "system-expense-sogliq", name: "Sog'liq", emoji: "🏥", color: "#2196F3", type: "EXPENSE" as const },
  { id: "system-expense-talim", name: "Ta'lim", emoji: "🎓", color: "#00BCD4", type: "EXPENSE" as const },
  { id: "system-expense-kiyim", name: "Kiyim-kechak", emoji: "👕", color: "#673AB7", type: "EXPENSE" as const },
  { id: "system-expense-bozor-xaridlar", name: "Bozor / Xaridlar", emoji: "🛒", color: "#8BC34A", type: "EXPENSE" as const },
  { id: "system-expense-kongilochar", name: "Ko'ngilochar", emoji: "🎮", color: "#009688", type: "EXPENSE" as const },
  { id: "system-expense-sayohat", name: "Sayohat", emoji: "✈️", color: "#03A9F4", type: "EXPENSE" as const },
  { id: "system-expense-oila-bolalar", name: "Oila / Bolalar", emoji: "👨‍👩‍👧", color: "#FF5722", type: "EXPENSE" as const },
  { id: "system-expense-kredit-qarz", name: "Kredit / Qarz to'lovi", emoji: "🏦", color: "#795548", type: "EXPENSE" as const },
  { id: "system-expense-xayriya", name: "Xayriya", emoji: "🤲", color: "#4CAF50", type: "EXPENSE" as const },
  { id: "system-expense-soliq-jarima", name: "Soliq / Jarima", emoji: "🧾", color: "#607D8B", type: "EXPENSE" as const },
  { id: "system-expense-boshqa", name: "Boshqa chiqim", emoji: "📝", color: "#9E9E9E", type: "EXPENSE" as const },
];

async function main() {
  console.log("Seeding database...");

  for (const category of defaultCategories) {
    await prisma.category.upsert({
      where: { id: category.id },
      update: {
        name: category.name,
        emoji: category.emoji,
        color: category.color,
        type: category.type,
        createdBy: null,
        groupId: null,
        isSystem: true,
        isArchived: false,
        archivedAt: null,
      },
      create: {
        id: category.id,
        name: category.name,
        emoji: category.emoji,
        color: category.color,
        type: category.type,
        createdBy: null,
        isSystem: true,
      },
    });
  }

  console.log(`Seed completed! ${defaultCategories.length} default categories are ready.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
