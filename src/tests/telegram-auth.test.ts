import crypto from "node:crypto";
import { describe, it, expect } from "vitest";
import { verifyTelegramInitData } from "../api/api-auth.middleware.js";

const BOT_TOKEN = "123456:TEST-TOKEN";

function buildInitData(
  user: Record<string, unknown>,
  authDate: number = Math.floor(Date.now() / 1000),
  token: string = BOT_TOKEN,
): string {
  const params = new URLSearchParams({
    auth_date: String(authDate),
    query_id: "AAE",
    user: JSON.stringify(user),
  });

  const dataCheckString = Array.from(params.entries())
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  params.set("hash", hash);
  return params.toString();
}

describe("verifyTelegramInitData", () => {
  it("accepts a correctly signed payload", () => {
    const initData = buildInitData({ id: 42, first_name: "Ali", username: "ali" });

    const user = verifyTelegramInitData(initData, BOT_TOKEN);

    expect(user).not.toBeNull();
    expect(user?.id).toBe(42);
    expect(user?.first_name).toBe("Ali");
  });

  it("rejects an empty payload", () => {
    expect(verifyTelegramInitData("", BOT_TOKEN)).toBeNull();
  });

  it("rejects a payload without a hash", () => {
    expect(verifyTelegramInitData("auth_date=1&user=%7B%7D", BOT_TOKEN)).toBeNull();
  });

  it("rejects a payload signed with a different bot token", () => {
    const initData = buildInitData({ id: 42, first_name: "Ali" }, undefined, "999:OTHER");

    expect(verifyTelegramInitData(initData, BOT_TOKEN)).toBeNull();
  });

  it("rejects a tampered user field", () => {
    const initData = buildInitData({ id: 42, first_name: "Ali" });
    const tampered = initData.replace("Ali", "Bob");

    expect(verifyTelegramInitData(tampered, BOT_TOKEN)).toBeNull();
  });

  it("rejects an expired payload", () => {
    const twoDaysAgo = Math.floor(Date.now() / 1000) - 2 * 24 * 60 * 60;
    const initData = buildInitData({ id: 42, first_name: "Ali" }, twoDaysAgo);

    expect(verifyTelegramInitData(initData, BOT_TOKEN)).toBeNull();
  });

  it("accepts an old payload when maxAge allows it", () => {
    const twoDaysAgo = Math.floor(Date.now() / 1000) - 2 * 24 * 60 * 60;
    const initData = buildInitData({ id: 42, first_name: "Ali" }, twoDaysAgo);

    expect(verifyTelegramInitData(initData, BOT_TOKEN, 7 * 24 * 60 * 60)).not.toBeNull();
  });
});
