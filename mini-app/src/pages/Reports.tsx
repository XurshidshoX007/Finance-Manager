import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../services/api";
import { SkeletonCard } from "../components/Skeleton";
import type { Kpi } from "../types";

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("uz-UZ").format(amount) + " UZS";
}

const periods = [
  { value: "today", label: "📅 Bugun" },
  { value: "weekly", label: "📅 Haftalik" },
  { value: "monthly", label: "📅 Oylik" },
  { value: "yearly", label: "📅 Yillik" },
];

export function Reports() {
  const [period, setPeriod] = useState("monthly");

  const { data: kpi, isLoading: kpiLoading } = useQuery<Kpi>({
    queryKey: ["kpi"],
    queryFn: api.getKpi,
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">📈 Hisobotlar</h2>

      {/* Period selector */}
      <div className="flex gap-2 overflow-x-auto">
        {periods.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition ${
              period === p.value
                ? "bg-[var(--tg-theme-button-color)] text-white"
                : "bg-[var(--tg-theme-secondary-bg-color)]"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* KPI */}
      {kpiLoading ? (
        <SkeletonCard />
      ) : kpi ? (
        <div className="bg-[var(--tg-theme-secondary-bg-color)] rounded-xl p-4 space-y-3">
          <p className="font-semibold">📈 KPI Ko'rsatkichlari</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[var(--tg-theme-bg-color)] rounded-lg p-3">
              <p className="text-xs text-[var(--tg-theme-hint-color)]">Tejash darajasi</p>
              <p className={`text-lg font-bold ${kpi.savingsRate >= 0 ? "text-green-600" : "text-red-600"}`}>
                {kpi.savingsRate.toFixed(1)}%
              </p>
            </div>
            <div className="bg-[var(--tg-theme-bg-color)] rounded-lg p-3">
              <p className="text-xs text-[var(--tg-theme-hint-color)]">Net qiymat</p>
              <p className="text-lg font-bold">{formatMoney(kpi.netWorth)}</p>
            </div>
            <div className="bg-[var(--tg-theme-bg-color)] rounded-lg p-3">
              <p className="text-xs text-[var(--tg-theme-hint-color)]">Kirim o'sishi</p>
              <p className={`text-lg font-bold ${kpi.incomeGrowth >= 0 ? "text-green-600" : "text-red-600"}`}>
                {kpi.incomeGrowth > 0 ? "+" : ""}{kpi.incomeGrowth.toFixed(1)}%
              </p>
            </div>
            <div className="bg-[var(--tg-theme-bg-color)] rounded-lg p-3">
              <p className="text-xs text-[var(--tg-theme-hint-color)]">Chiqim o'sishi</p>
              <p className={`text-lg font-bold ${kpi.expenseGrowth <= 0 ? "text-green-600" : "text-red-600"}`}>
                {kpi.expenseGrowth > 0 ? "+" : ""}{kpi.expenseGrowth.toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="bg-[var(--tg-theme-bg-color)] rounded-lg p-3">
            <p className="text-xs text-[var(--tg-theme-hint-color)]">Qarz/Kirim nisbati</p>
            <p className="text-lg font-bold">{kpi.debtToIncomeRatio.toFixed(2)}</p>
          </div>
        </div>
      ) : null}

      {/* Export buttons */}
      <div className="bg-[var(--tg-theme-secondary-bg-color)] rounded-xl p-4 space-y-2">
        <p className="font-semibold">📤 Eksport</p>
        <div className="grid grid-cols-2 gap-2">
          <a
            href={api.getExportUrl("transactions")}
            className="block text-center py-2 bg-green-600 text-white rounded-lg text-sm"
          >
            📊 Excel (Tranzaksiyalar)
          </a>
          <a
            href={api.getExportUrl("credits")}
            className="block text-center py-2 bg-blue-600 text-white rounded-lg text-sm"
          >
            📊 Excel (Kreditlar)
          </a>
          <a
            href={api.getPdfUrl(period)}
            className="block text-center py-2 bg-red-600 text-white rounded-lg text-sm col-span-2"
          >
            📄 PDF Hisobot
          </a>
        </div>
      </div>
    </div>
  );
}
