const API_BASE = "/api/v1";

function getHeaders(): Record<string, string> {
  const telegramWindow = window as unknown as { Telegram?: { WebApp?: { initData?: string } } };
  const initData = telegramWindow.Telegram?.WebApp?.initData;
  return {
    "Content-Type": "application/json",
    "x-telegram-init-data": typeof initData === "string" ? initData : "",
  };
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...getHeaders(), ...options?.headers },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: "Network error" } }));
    throw new Error((error as Record<string, { message: string }>).error?.message || "Request failed");
  }

  const json = await response.json() as { success: boolean; data: T };
  return json.data;
}

export const api = {
  // Dashboard
  getDashboard: () => request<import("../types/index.js").Dashboard>("/reports/dashboard"),

  // Sources
  getSources: (page = 1) => request<import("../types/index.js").PaginatedResult<import("../types/index.js").Source>>(`/sources?page=${page}`),
  getSource: (id: string) => request<import("../types/index.js").Source>(`/sources/${id}`),
  createSource: (data: Partial<import("../types/index.js").Source>) => request<import("../types/index.js").Source>("/sources", { method: "POST", body: JSON.stringify(data) }),

  // Categories
  getCategories: (page = 1, type?: string) => request<import("../types/index.js").PaginatedResult<import("../types/index.js").Category>>(`/categories?page=${page}${type ? `&type=${type}` : ""}`),

  // Transactions
  getTransactions: (page = 1, type?: string) => request<import("../types/index.js").PaginatedResult<import("../types/index.js").Transaction>>(`/transactions?page=${page}${type ? `&type=${type}` : ""}`),
  createTransaction: (data: Record<string, unknown>) => request<import("../types/index.js").Transaction>("/transactions", { method: "POST", body: JSON.stringify(data) }),
  cancelTransaction: (id: string) => request<void>(`/transactions/${id}/cancel`, { method: "POST", body: JSON.stringify({}) }),

  // Credits
  getCredits: (page = 1) => request<import("../types/index.js").PaginatedResult<import("../types/index.js").Credit>>(`/credits?page=${page}`),

  // Reports
  getReport: (period: string, currency = "UZS") => request<unknown>(`/reports/report?period=${period}&currency=${currency}`),
  getKpi: () => request<import("../types/index.js").Kpi>("/reports/kpi"),

  // Excel
  getExportUrl: (type: string) => `${API_BASE}/excel/export/${type}`,
  getTemplateUrl: () => `${API_BASE}/excel/template`,
  getPdfUrl: (period: string) => `${API_BASE}/reports/pdf?period=${period}`,
};
