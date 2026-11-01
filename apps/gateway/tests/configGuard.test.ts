import assert from "node:assert/strict";
import test from "node:test";
import { BACKEND_PRICING } from "@autonomia/core/pricing";
import { PROVIDER_POOLS } from "@autonomia/core/providers";
import { assertAutonomiaConfigBundleAtStartup } from "../src/utils/configGuard.ts";

// FN-7 fix:gateway 啟動時(nodeServer.ts 與 Worker DO 建構兩個拓撲)強制
// 驗證凍結的設定常數;此前驗證只在 CI 測試執行,手改設定檔部署時
// runtime 不會 fail-fast。

test("startup config guard accepts the shipped config bundle", () => {
  assert.equal(assertAutonomiaConfigBundleAtStartup(), true);
});

test("startup config guard rejects a tampered route timeout beyond the 240s ceiling", () => {
  // FN-5 fix 同場驗證:timeout 上限 300000 -> 240000 後,塞入 300000 的
  // 路由必須在啟動時被擋下,而非帶病上線等待結算 race。
  const tampered = structuredClone(BACKEND_PRICING);
  const firstModel = Object.values(tampered.models)[0] as any;
  firstModel.routes[0].timeout_ms = 300000;
  assert.throws(
    () => assertAutonomiaConfigBundleAtStartup(tampered as any, PROVIDER_POOLS),
    (error: any) => /timeout_ms/.test(String(error?.message || error)),
  );
});

test("startup config guard rejects an http provider base_url", () => {
  // HTTPS-only 不變式原本只由 CI 測試把關(F8 core 發現);啟動 guard 補上。
  const tamperedPools = structuredClone(PROVIDER_POOLS) as any;
  const firstPool = Object.values(tamperedPools.pools)[0] as Record<string, unknown>;
  firstPool.base_url = "http://insecure-upstream.example.com/v1";
  assert.throws(
    () => assertAutonomiaConfigBundleAtStartup(BACKEND_PRICING, tamperedPools),
    (error: any) => /base_url|https/i.test(String(error?.message || error)),
  );
});

// ── S-21 修復釘死:已啟用但密鑼缺失/過短時,啟動必須輸出警告 ──────────────
// 修復前行為 fail-closed 但零信號:服務看起來健康、/healthz 回 200,
// 問題由第一位真實使用者發現。
test("S-21: warnOnMissingAutonomiaSecrets signals missing or short secrets only when enabled", async () => {
  const { warnOnMissingAutonomiaSecrets } = await import("../src/utils/configGuard.ts");
  const warnings: string[] = [];
  const originalWarn = console.warn;
  (console as any).warn = (...args: unknown[]) => {
    warnings.push(String(args[0] || ""));
  };
  try {
    // 未啟用:不警告(服務尚未上線,密鑼問題無關緊要)。
    warnOnMissingAutonomiaSecrets({ JWT_SECRET: "" });
    assert.equal(warnings.length, 0);

    // 已啟用 + 密鑼缺失:兩條警告(JWT 與 pepper)。
    warnOnMissingAutonomiaSecrets({ AUTONOMIA_ENABLED: "true" });
    assert.equal(warnings.length, 2);
    assert.ok(warnings.some((line) => line.includes("autonomia_jwt_secret_missing_or_short")));
    assert.ok(warnings.some((line) => line.includes("autonomia_api_key_pepper_missing_or_short")));

    // 已啟用 + 密鑼過短(< 32 bytes):同樣警告。
    warnings.length = 0;
    warnOnMissingAutonomiaSecrets({
      AUTONOMIA_ENABLED: "true",
      JWT_SECRET: "short",
      AUTONOMIA_API_KEY_PEPPER: "x".repeat(31),
    });
    assert.equal(warnings.length, 2);

    // 已啟用 + 密鑼健全:零警告(回歸保護,避免噪音)。
    warnings.length = 0;
    warnOnMissingAutonomiaSecrets({
      AUTONOMIA_ENABLED: "true",
      JWT_SECRET: "j".repeat(32),
      AUTONOMIA_API_KEY_PEPPER: "p".repeat(32),
    });
    assert.equal(warnings.length, 0);
  } finally {
    (console as any).warn = originalWarn;
  }
});
