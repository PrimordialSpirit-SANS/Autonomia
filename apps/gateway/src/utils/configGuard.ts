import { BACKEND_PRICING } from "@autonomia/core/pricing";
import { PROVIDER_POOLS } from "@autonomia/core/providers";
import { assertValidConfigBundle } from "@autonomia/core/validation";
import { logAutonomiaEvent } from "./logger.ts";

// FN-7 fix:設定檔驗證(HTTPS-only base_url、timeout 上限、價格格式、
// pool/route 交叉引用)原本只在測試執行;繞過 CI 手改設定檔部署時,
// runtime 不會 fail-fast。此 guard 在 gateway 啟動時(兩個拓撲的進入點
// 都呼叫)強制驗證凍結的設定常數,壞設定直接中止啟動,不帶病上線。
export function assertAutonomiaConfigBundleAtStartup(
  pricing: Record<string, any> = BACKEND_PRICING,
  pools: Record<string, any> = PROVIDER_POOLS,
) {
  try {
    assertValidConfigBundle(pricing, pools);
  } catch (error: any) {
    logAutonomiaEvent("error", "fatal_config_validation_failed", {
      detail: String(error?.message || error),
    });
    throw error;
  }
  return true;
}

/**
 * S-21 修復:啟動時對「AUTONOMIA_ENABLED=true 但密鑰缺失/過短」輸出警告。
 * 行為本身已經 fail-closed(逐請求 503 auth_configuration_unavailable、
 * 金鑰驗證直接拋錯),但啟動時沒有任何信號 —— 服務看起來健康、/healthz
 * 回 200,問題由第一位真實使用者發現。刻意只警告不中止:維持
 * healthz-first 契約(先起來、可診斷),警告讓維運在第一位使用者之前看到。
 */
export function warnOnMissingAutonomiaSecrets(env: Record<string, unknown> = {}) {
  if (
    String(env.AUTONOMIA_ENABLED || "")
      .trim()
      .toLowerCase() !== "true"
  )
    return;
  const jwtSecret = String(env.JWT_SECRET || "");
  if (jwtSecret.length < 32) {
    logAutonomiaEvent("warn", "autonomia_jwt_secret_missing_or_short", {
      hint: "JWT_SECRET is missing or shorter than 32 bytes; session authentication will return 503 auth_configuration_unavailable until it is set",
    });
  }
  const pepper = String(env.AUTONOMIA_API_KEY_PEPPER || "");
  if (pepper.length < 32) {
    logAutonomiaEvent("warn", "autonomia_api_key_pepper_missing_or_short", {
      hint: "AUTONOMIA_API_KEY_PEPPER is missing or shorter than 32 bytes; API key authentication is unavailable until it is set",
    });
  }
}
