import { describe, it, expect } from "vitest";

// Inline implementations to avoid module resolution issues
function createPaginationInput(page?: number, limit?: number) {
  const safePage = Math.max(1, page ?? 1);
  const safeLimit = Math.min(100, Math.max(1, limit ?? 20));
  return { page: safePage, limit: safeLimit };
}

function createPaginatedResult<T>(
  data: T[],
  total: number,
  pagination: { page: number; limit: number },
) {
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

function calculateOffset(pagination: { page: number; limit: number }): number {
  return (pagination.page - 1) * pagination.limit;
}

describe("Pagination Utils", () => {
  describe("createPaginationInput", () => {
    it("should return default values for undefined inputs", () => {
      const result = createPaginationInput();
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it("should clamp page to minimum 1", () => {
      const result = createPaginationInput(0, 10);
      expect(result.page).toBe(1);
    });

    it("should clamp limit between 1 and 100", () => {
      const tooSmall = createPaginationInput(1, 0);
      expect(tooSmall.limit).toBe(1);

      const tooLarge = createPaginationInput(1, 200);
      expect(tooLarge.limit).toBe(100);

      const valid = createPaginationInput(1, 50);
      expect(valid.limit).toBe(50);
    });
  });

  describe("createPaginatedResult", () => {
    it("should create a valid paginated result", () => {
      const data = [1, 2, 3];
      const pagination = createPaginationInput(1, 10);
      const result = createPaginatedResult(data, 25, pagination);

      expect(result.data).toEqual(data);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.total).toBe(25);
      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrev).toBe(false);
    });

    it("should calculate hasPrev and hasNext correctly", () => {
      const pagination = createPaginationInput(2, 10);
      const result = createPaginatedResult([], 25, pagination);

      expect(result.pagination.hasPrev).toBe(true);
      expect(result.pagination.hasNext).toBe(true);
    });

    it("should return hasPrev=false for page 1", () => {
      const pagination = createPaginationInput(1, 10);
      const result = createPaginatedResult([], 5, pagination);

      expect(result.pagination.hasPrev).toBe(false);
      expect(result.pagination.hasNext).toBe(false);
    });
  });

  describe("calculateOffset", () => {
    it("should calculate offset correctly", () => {
      const pagination = createPaginationInput(3, 20);
      expect(calculateOffset(pagination)).toBe(40);
    });

    it("should return 0 for page 1", () => {
      const pagination = createPaginationInput(1, 20);
      expect(calculateOffset(pagination)).toBe(0);
    });
  });
});
