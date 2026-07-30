import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import { SkeletonList } from "../components/Skeleton";
import type { Credit, PaginatedResult } from "../types";

function formatMoney(amount: number, currency = "UZS"): string {
  return new Intl.NumberFormat("uz-UZ").format(amount) + " " + currency;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "🟢 Faol", color: "text-green-600" },
  COMPLETED: { label: "✅ Yakunlangan", color: "text-blue-600" },
  CANCELLED: { label: "🔴 Bekor", color: "text-red-600" },
};

export function Credits() {
  const { data, isLoading, error } = useQuery<PaginatedResult<Credit>>({
    queryKey: ["credits"],
    queryFn: () => api.getCredits(),
  });

  if (error) {
    return <div className="p-4 text-center text-red-500">❌ {(error as Error).message}</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">🏦 Kreditlar</h2>

      {isLoading ? (
        <SkeletonList count={3} />
      ) : data && data.data.length > 0 ? (
        <div className="space-y-3">
          {data.data.map((credit) => {
            const status = statusLabels[credit.status] ?? statusLabels.ACTIVE;
            const progress = credit.termMonths > 0 ? (credit.paidMonths / credit.termMonths) * 100 : 0;

            return (
              <div key={credit.id} className="bg-[var(--tg-theme-secondary-bg-color)] rounded-xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold">{credit.name}</p>
                    <p className="text-xs text-[var(--tg-theme-hint-color)]">
                      {credit.type === "ANNUITY" ? "📋 Annuitet" : "📊 Differensial"} • {credit.termMonths} oy
                    </p>
                  </div>
                  <span className={`text-sm ${status.color}`}>{status.label}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                  <div>
                    <p className="text-[var(--tg-theme-hint-color)]">Umumiy</p>
                    <p className="font-medium">{formatMoney(Number(credit.totalAmount))}</p>
                  </div>
                  <div>
                    <p className="text-[var(--tg-theme-hint-color)]">Qolgan</p>
                    <p className="font-medium text-orange-600">{formatMoney(Number(credit.remainingDebt))}</p>
                  </div>
                  <div>
                    <p className="text-[var(--tg-theme-hint-color)]">Oylik to'lov</p>
                    <p className="font-medium">{formatMoney(Number(credit.monthlyPayment))}</p>
                  </div>
                  <div>
                    <p className="text-[var(--tg-theme-hint-color)]">Foiz</p>
                    <p className="font-medium">{credit.interestRate}%</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-[var(--tg-theme-hint-color)] mb-1">
                    <span>{credit.paidMonths} / {credit.termMonths} oy</span>
                    <span>{progress.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-[var(--tg-theme-button-color)] h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(100, progress)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-[var(--tg-theme-hint-color)]">
          <p className="text-4xl mb-2">🏦</p>
          <p>Kreditlar topilmadi</p>
        </div>
      )}
    </div>
  );
}
