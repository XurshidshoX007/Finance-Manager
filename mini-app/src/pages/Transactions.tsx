import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../services/api";
import { SkeletonList } from "../components/Skeleton";
import type { Transaction, PaginatedResult } from "../types";

function formatMoney(amount: number, currency = "UZS"): string {
  return new Intl.NumberFormat("uz-UZ").format(amount) + " " + currency;
}

const typeLabels: Record<string, string> = {
  INCOME: "🟢 Kirim",
  EXPENSE: "🔴 Chiqim",
  TRANSFER: "🔄 O'tkazma",
};

export function Transactions() {
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState<string>("");

  const { data, isLoading, error } = useQuery<PaginatedResult<Transaction>>({
    queryKey: ["transactions", page, filterType],
    queryFn: () => api.getTransactions(page, filterType || undefined),
  });

  if (error) {
    return <div className="p-4 text-center text-red-500">❌ {(error as Error).message}</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">💵 Tranzaksiyalar</h2>

      {/* Filter */}
      <div className="flex gap-2">
        {["", "INCOME", "EXPENSE", "TRANSFER"].map((type) => (
          <button
            key={type}
            onClick={() => { setFilterType(type); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm transition ${
              filterType === type
                ? "bg-[var(--tg-theme-button-color)] text-white"
                : "bg-[var(--tg-theme-secondary-bg-color)]"
            }`}
          >
            {type ? typeLabels[type] : "Barchasi"}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <SkeletonList count={5} />
      ) : data && data.data.length > 0 ? (
        <div className="space-y-2">
          {data.data.map((tx) => (
            <div
              key={tx.id}
              className={`bg-[var(--tg-theme-secondary-bg-color)] rounded-xl p-3 ${
                tx.isCancelled ? "opacity-50" : ""
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-sm">{typeLabels[tx.type]}</span>
                  <p className="text-sm text-[var(--tg-theme-hint-color)] mt-0.5">
                    {new Date(tx.transactionDate).toLocaleDateString("uz-UZ")}
                    {tx.category ? ` • ${tx.category.emoji} ${tx.category.name}` : ""}
                    {tx.source ? ` • ${tx.source.emoji} ${tx.source.name}` : ""}
                  </p>
                  {tx.description && (
                    <p className="text-xs text-[var(--tg-theme-hint-color)] mt-0.5">{tx.description}</p>
                  )}
                </div>
                <span className={`font-bold ${tx.type === "INCOME" ? "text-green-600" : "text-red-600"}`}>
                  {tx.type === "INCOME" ? "+" : "-"}{formatMoney(Number(tx.amount), tx.currency)}
                </span>
              </div>
              {tx.isCancelled && (
                <p className="text-xs text-red-500 mt-1">❌ Bekor qilingan</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-[var(--tg-theme-hint-color)]">
          <p className="text-4xl mb-2">📋</p>
          <p>Tranzaksiyalar topilmadi</p>
        </div>
      )}

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={!data.pagination.hasPrev}
            className="px-3 py-1.5 rounded-lg bg-[var(--tg-theme-secondary-bg-color)] disabled:opacity-50"
          >
            ← Oldingi
          </button>
          <span className="px-3 py-1.5">
            {page} / {data.pagination.totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(data.pagination.totalPages, page + 1))}
            disabled={!data.pagination.hasNext}
            className="px-3 py-1.5 rounded-lg bg-[var(--tg-theme-secondary-bg-color)] disabled:opacity-50"
          >
            Keyingi →
          </button>
        </div>
      )}
    </div>
  );
}
