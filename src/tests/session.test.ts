import { describe, it, expect, vi, afterEach } from "vitest";
import { SessionStore } from "../shared/session/index.js";

describe("SessionStore", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores and reads a value", () => {
    const store = new SessionStore<{ step: string }>();
    store.set("user-1", { step: "amount" });

    expect(store.get("user-1")).toEqual({ step: "amount" });
    expect(store.has("user-1")).toBe(true);
  });

  it("returns undefined for unknown keys", () => {
    const store = new SessionStore<string>();
    expect(store.get("nope")).toBeUndefined();
    expect(store.has("nope")).toBe(false);
  });

  it("expires entries after the TTL", () => {
    vi.useFakeTimers();
    const store = new SessionStore<string>(1000);

    store.set("user-1", "value");
    expect(store.get("user-1")).toBe("value");

    vi.advanceTimersByTime(1001);

    expect(store.get("user-1")).toBeUndefined();
    expect(store.size).toBe(0);
  });

  it("deletes entries explicitly", () => {
    const store = new SessionStore<string>();
    store.set("a", "1");

    expect(store.delete("a")).toBe(true);
    expect(store.delete("a")).toBe(false);
  });

  it("evicts expired entries and respects max size", () => {
    vi.useFakeTimers();
    const store = new SessionStore<string>(1000, 2);

    store.set("a", "1");
    store.set("b", "2");
    vi.advanceTimersByTime(1001);

    store.set("c", "3");

    expect(store.get("a")).toBeUndefined();
    expect(store.get("b")).toBeUndefined();
    expect(store.get("c")).toBe("3");
  });

  it("clears everything", () => {
    const store = new SessionStore<string>();
    store.set("a", "1");
    store.set("b", "2");

    store.clear();

    expect(store.size).toBe(0);
  });
});
