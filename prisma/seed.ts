import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create default categories
  const incomeCategories = [
    { name: "Maosh", emoji: "💰", color: "#4CAF50", type: "INCOME" as const },
    { name: "Bonus", emoji: "🎁", color: "#8BC34A", type: "INCOME" as const },
    { name: "Investitsiya", emoji: "📈", color: "#CDDC39", type: "INCOME" as const },
    { name: "Boshqa kirim", emoji: "💵", color: "#00BCD4", type: "INCOME" as const },
  ];

  const expenseCategories = [
    { name: "Oziq-ovqat", emoji: "🍔", color: "#F44336", type: "EXPENSE" as const },
    { name: "Transport", emoji: "🚗", color: "#FF9800", type: "EXPENSE" as const },
    { name: "Ijarа", emoji: "🏠", color: "#E91E63", type: "EXPENSE" as const },
    { name: "Kommunal", emoji: "💡", color: "#9C27B0", type: "EXPENSE" as const },
    { name: "Kiyim", emoji: "👕", color: "#673AB7", type: "EXPENSE" as const },
    { name: "Sog'liq", emoji: "🏥", color: "#3F51B5", type: "EXPENSE" as const },
    { name: "Ta'lim", emoji: "📚", color: "#2196F3", type: "EXPENSE" as const },
    { name: "Ko'ngil ochar", emoji: "🎬", color: "#009688", type: "EXPENSE" as const },
    { name: "Boshqa chiqim", emoji: "💸", color: "#795548", type: "EXPENSE" as const },
  ];

  console.log("Seed completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
