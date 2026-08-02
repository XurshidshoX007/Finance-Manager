import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import { SkeletonCard } from "../components/Skeleton";
import type { Dashboard as DashboardType } from "../types";
import { formatMoney } from "../utils/format";

export function Dashboard() {
  const { data, isLoading, error } = useQuery<DashboardType>({
    queryKey: ["dashboard"],
    queryFn: api.getDashboard,
  });

  if (error) {
    return (
      <div className="p-4 text-center text-red-500">
        <p>❌ Xatolik: {(error as Error).message}</p>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const uzsBalance = data.totalBalance["UZS"];

  return (
    <div className="space-y-4">
      {/* Balance Card */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-5 text-white shadow-lg">
        <p className="text-sm opacity-80">Jami balans</p>
        <p className="text-3xl font-bold mt-1">
          {uzsBalance ? formatMoney(uzsBalance.net) : "0 UZS"}
        </p>
        <div className="flex gap-6 mt-4">
          <div>
            <p className="text-xs opacity-70">Kirim</p>
            <p className="text-sm font-semibold">🟢 {formatMoney(data.monthlyIncome)}</p>
          </div>
          <div>
            <p className="text-xs opacity-70">Chiqim</p>
            <p className="text-sm font-semibold">🔴 {formatMoney(data.monthlyExpense)}</p>
          </div>
        </div>
      </div>

      {/* Today Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[var(--tg-theme-secondary-bg-color)] rounded-xl p-4">
          <p className="text-xs text-[var(--tg-theme-hint-color)]">Bugungi kirim</p>
          <p className="text-lg font-bold text-green-600">🟢 {formatMoney(data.todayIncome)}</p>
        </div>
        <div className="bg-[var(--tg-theme-secondary-bg-color)] rounded-xl p-4">
          <p className="text-xs text-[var(--tg-theme-hint-color)]">Bugungi chiqim</p>
          <p className="text-lg font-bold text-red-600">🔴 {formatMoney(data.todayExpense)}</p>
        </div>
      </div>

      {/* Credits */}
      {data.activeCredits > 0 && (
        <div className="bg-[var(--tg-theme-secondary-bg-color)] rounded-xl p-4">
          <p className="text-sm font-semibold mb-2">🏦 Kreditlar</p>
          <div className="flex justify-between items-center">
            <span className="text-[var(--tg-theme-hint-color)]">Faol kreditlar</span>
            <span className="font-bold">{data.activeCredits}</span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-[var(--tg-theme-hint-color)]">Qolgan qarz</span>
            <span className="font-bold text-orange-600">{formatMoney(Number(data.totalRemainingDebt))}</span>
          </div>
        </div>
      )}

      {/* Top Categories */}
      {data.topExpenseCategories.length > 0 && (
        <div className="bg-[var(--tg-theme-secondary-bg-color)] rounded-xl p-4">
          <p className="text-sm font-semibold mb-3">📊 Top chiqim kategoriyalari</p>
          {data.topExpenseCategories.slice(0, 5).map((cat) => (
            <div key={cat.id} className="flex justify-between items-center py-1.5">
              <span>{cat.emoji} {cat.name}</span>
              <span className="font-medium">{formatMoney(cat.total)}</span>
            </div>
          ))}
        </div>
      )}

      {data.topIncomeCategories.length > 0 && (
        <div className="bg-[var(--tg-theme-secondary-bg-color)] rounded-xl p-4">
          <p className="text-sm font-semibold mb-3">📊 Top kirim kategoriyalari</p>
          {data.topIncomeCategories.slice(0, 5).map((cat) => (
            <div key={cat.id} className="flex justify-between items-center py-1.5">
              <span>{cat.emoji} {cat.name}</span>
              <span className="font-medium">{formatMoney(cat.total)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
