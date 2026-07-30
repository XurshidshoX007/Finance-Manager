import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../services/api";
import { SkeletonList } from "../components/Skeleton";
import type { Category, PaginatedResult } from "../types";

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("uz-UZ").format(amount) + " UZS";
}

export function Categories() {
  const [type, setType] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const { data, isLoading, error } = useQuery<PaginatedResult<Category>>({
    queryKey: ["categories", type],
    queryFn: () => api.getCategories(1, type),
  });

  if (error) {
    return <div className="p-4 text-center text-red-500">❌ {(error as Error).message}</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">📂 Kategoriyalar</h2>

      <div className="flex gap-2">
        <button
          onClick={() => setType("INCOME")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
            type === "INCOME"
              ? "bg-green-600 text-white"
              : "bg-[var(--tg-theme-secondary-bg-color)]"
          }`}
        >
          🟢 Kirim
        </button>
        <button
          onClick={() => setType("EXPENSE")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
            type === "EXPENSE"
              ? "bg-red-600 text-white"
              : "bg-[var(--tg-theme-secondary-bg-color)]"
          }`}
        >
          🔴 Chiqim
        </button>
      </div>

      {isLoading ? (
        <SkeletonList count={5} />
      ) : data && data.data.length > 0 ? (
        <div className="space-y-2">
          {data.data.map((cat) => (
            <div key={cat.id} className="bg-[var(--tg-theme-secondary-bg-color)] rounded-xl p-3 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-xl">{cat.emoji}</span>
                <div>
                  <p className="font-medium">{cat.name}</p>
                  {cat.groupName && (
                    <p className="text-xs text-[var(--tg-theme-hint-color)]">📁 {cat.groupName}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium">{formatMoney(cat.stats.total)}</p>
                <p className="text-xs text-[var(--tg-theme-hint-color)]">{cat.stats.count} ta</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-[var(--tg-theme-hint-color)]">
          <p className="text-4xl mb-2">📂</p>
          <p>Kategoriyalar topilmadi</p>
        </div>
      )}
    </div>
  );
}
