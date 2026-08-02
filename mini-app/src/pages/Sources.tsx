import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import { SkeletonList } from "../components/Skeleton";
import type { Source, PaginatedResult } from "../types";
import { formatMoney } from "../utils/format";

export function Sources() {
  const { data, isLoading, error } = useQuery<PaginatedResult<Source>>({
    queryKey: ["sources"],
    queryFn: () => api.getSources(),
  });

  if (error) {
    return <div className="p-4 text-center text-red-500">❌ {(error as Error).message}</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">💰 Mablag' manbalari</h2>

      {isLoading ? (
        <SkeletonList count={5} />
      ) : data && data.data.length > 0 ? (
        <div className="space-y-2">
          {data.data.map((source) => (
            <div key={source.id} className="bg-[var(--tg-theme-secondary-bg-color)] rounded-xl p-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{source.emoji}</span>
                  <div>
                    <p className="font-semibold">{source.name}</p>
                    <p className="text-xs text-[var(--tg-theme-hint-color)]">{source.currency}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${source.balance.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatMoney(source.balance.net, source.currency)}
                  </p>
                  <p className="text-xs text-[var(--tg-theme-hint-color)]">
                    🟢 {formatMoney(source.balance.income)} / 🔴 {formatMoney(source.balance.expense)}
                  </p>
                </div>
              </div>
              {source.description && (
                <p className="text-xs text-[var(--tg-theme-hint-color)] mt-2">{source.description}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-[var(--tg-theme-hint-color)]">
          <p className="text-4xl mb-2">💰</p>
          <p>Manbalar topilmadi</p>
        </div>
      )}
    </div>
  );
}
