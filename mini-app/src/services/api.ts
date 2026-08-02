const API_BASE = "/api/v1";

function getHeaders(): Record<string, string> {
  const telegramWindow = window as unknown as { Telegram?: { WebApp?: { initData?: string } } };
  const initData = telegramWindow.Telegram?.WebApp?.initData;
  return {
    "Content-Type": "application/json",
    "x-telegram-init-data": typeof initData === "string" ? initData : "",
  };
}

const REQUEST_TIMEOUT_MS = 20_000;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  // Osilib qolgan so'rovlarni to'xtatish uchun timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { ...getHeaders(), ...options?.headers },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("So'rov vaqti tugadi. Internetni tekshirib, qaytadan urining.");
    }
    throw new Error("Tarmoq xatosi. Internetni tekshiring.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as
      | { error?: { message?: string } }
      | null;

    if (response.status === 401) {
      throw new Error("Sessiya tugagan. Mini App'ni Telegram orqali qayta oching.");
    }
    if (response.status === 403) {
      throw new Error(payload?.error?.message ?? "Bu amal uchun ruxsat yo'q.");
    }

    throw new Error(payload?.error?.message ?? `Xatolik (${response.status})`);
  }

  if (response.status === 204) {
    return undefined as T;
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

  createDefaultCategories: () => request<{ created: number }>("/categories/defaults", { method: "POST", body: JSON.stringify({}) }),

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
