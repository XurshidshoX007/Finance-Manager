import { createId } from "@paralleldrive/cuid2";

export function generateId(): string {
  return createId();
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

export function parseAdminIds(ids: string): bigint[] {
  if (!ids.trim()) return [];
  return ids
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
    .map((id) => BigInt(id));
}
