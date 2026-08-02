import { describe, it, expect } from "vitest";
import { parseAmountInput } from "../modules/transactions/transactions.handler.js";

describe("parseAmountInput", () => {
  it("parses plain integers", () => {
    expect(parseAmountInput("50000")).toBe("50000.00");
  });

  it("parses decimals with a dot or comma", () => {
    expect(parseAmountInput("1500.5")).toBe("1500.50");
    expect(parseAmountInput("1500,5")).toBe("1500.50");
  });

  it("ignores spaces and underscores used as separators", () => {
    expect(parseAmountInput("1 500 000")).toBe("1500000.00");
    expect(parseAmountInput("1_500_000")).toBe("1500000.00");
  });

  it("supports thousand suffixes", () => {
    expect(parseAmountInput("250k")).toBe("250000.00");
    expect(parseAmountInput("250ming")).toBe("250000.00");
  });

  it("supports million suffixes", () => {
    expect(parseAmountInput("1.5mln")).toBe("1500000.00");
    expect(parseAmountInput("2m")).toBe("2000000.00");
    expect(parseAmountInput("3million")).toBe("3000000.00");
  });

  it("rejects zero and negative values", () => {
    expect(parseAmountInput("0")).toBeNull();
    expect(parseAmountInput("-500")).toBeNull();
  });

  it("rejects non-numeric input", () => {
    expect(parseAmountInput("")).toBeNull();
    expect(parseAmountInput("salom")).toBeNull();
    expect(parseAmountInput("12abc")).toBeNull();
    expect(parseAmountInput("1.2.3")).toBeNull();
  });

  it("rejects absurdly large values", () => {
    expect(parseAmountInput("999999999999999999")).toBeNull();
  });
});
