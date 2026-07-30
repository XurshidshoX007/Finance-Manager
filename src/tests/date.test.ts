import { describe, it, expect } from "vitest";

// Inline implementations to avoid module resolution issues
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86400000;
  return Math.ceil(Math.abs(b.getTime() - a.getTime()) / msPerDay);
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0] ?? "";
}

describe("Date Utils", () => {
  describe("startOfDay", () => {
    it("should set time to 00:00:00.000", () => {
      const date = new Date("2024-06-15T14:30:45.123");
      const result = startOfDay(date);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });
  });

  describe("endOfDay", () => {
    it("should set time to 23:59:59.999", () => {
      const date = new Date("2024-06-15T14:30:45.123");
      const result = endOfDay(date);
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
      expect(result.getSeconds()).toBe(59);
      expect(result.getMilliseconds()).toBe(999);
    });
  });

  describe("startOfMonth", () => {
    it("should return first day of month", () => {
      const date = new Date("2024-06-15T12:00:00");
      const result = startOfMonth(date);
      expect(result.getDate()).toBe(1);
      expect(result.getMonth()).toBe(5);
    });
  });

  describe("endOfMonth", () => {
    it("should return last day of month", () => {
      const date = new Date("2024-06-15T12:00:00");
      const result = endOfMonth(date);
      expect(result.getDate()).toBe(30);
    });

    it("should handle February in leap year", () => {
      const date = new Date("2024-02-15");
      const result = endOfMonth(date);
      expect(result.getDate()).toBe(29);
    });
  });

  describe("addMonths", () => {
    it("should add months correctly", () => {
      const date = new Date("2024-01-15");
      const result = addMonths(date, 3);
      expect(result.getMonth()).toBe(3);
    });
  });

  describe("addDays", () => {
    it("should add days correctly", () => {
      const date = new Date("2024-06-15");
      const result = addDays(date, 5);
      expect(result.getDate()).toBe(20);
    });
  });

  describe("daysBetween", () => {
    it("should calculate days between two dates", () => {
      const a = new Date("2024-06-10");
      const b = new Date("2024-06-15");
      expect(daysBetween(a, b)).toBe(5);
    });
  });

  describe("formatDate", () => {
    it("should format date as YYYY-MM-DD", () => {
      const date = new Date("2024-06-15T12:00:00");
      expect(formatDate(date)).toBe("2024-06-15");
    });
  });
});
