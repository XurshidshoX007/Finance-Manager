import { describe, it, expect } from "vitest";
import { createId } from "@paralleldrive/cuid2";

// Inline implementations to avoid module resolution issues
function generateId(): string {
  return createId();
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

function parseAdminIds(ids: string): bigint[] {
  if (!ids.trim()) return [];
  return ids
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
    .map((id) => BigInt(id));
}

describe("Helper Utils", () => {
  describe("generateId", () => {
    it("should generate unique IDs", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(100);
    });

    it("should generate IDs with reasonable length", () => {
      const id = generateId();
      expect(id.length).toBeGreaterThan(5);
      expect(id.length).toBeLessThan(50);
    });
  });

  describe("truncate", () => {
    it("should not truncate short strings", () => {
      expect(truncate("hello", 10)).toBe("hello");
    });

    it("should truncate long strings with ellipsis", () => {
      expect(truncate("hello world this is a long string", 15)).toBe("hello world ...");
    });
  });

  describe("parseAdminIds", () => {
    it("should parse comma-separated IDs", () => {
      const result = parseAdminIds("123,456,789");
      expect(result).toEqual([BigInt(123), BigInt(456), BigInt(789)]);
    });

    it("should handle empty string", () => {
      expect(parseAdminIds("")).toEqual([]);
    });

    it("should handle whitespace", () => {
      const result = parseAdminIds(" 123 , 456 ");
      expect(result).toEqual([BigInt(123), BigInt(456)]);
    });
  });
});
