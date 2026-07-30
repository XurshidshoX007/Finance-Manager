import type { PaginationInput, PaginatedResult } from "../types/index.js";

export function createPaginationInput(page?: number, limit?: number): PaginationInput {
  const safePage = Math.max(1, page ?? 1);
  const safeLimit = Math.min(100, Math.max(1, limit ?? 20));
  return { page: safePage, limit: safeLimit };
}

export function createPaginatedResult<T>(
  data: T[],
  total: number,
  pagination: PaginationInput,
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / pagination.limit);
  return {
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages,
      hasNext: pagination.page < totalPages,
      hasPrev: pagination.page > 1,
    },
  };
}

export function calculateOffset(pagination: PaginationInput): number {
  return (pagination.page - 1) * pagination.limit;
}
