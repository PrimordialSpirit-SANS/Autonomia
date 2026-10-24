import type {
  AutonomiaBillingMarkNeedsReconciliationInput,
  AutonomiaBillingQuarantineOptions,
  AutonomiaBillingReconcileOptions,
  AutonomiaBillingRefundInput,
  AutonomiaBillingReserveInput,
  AutonomiaBillingSettleInput,
} from "@autonomia/core/billing";
import { createAutonomiaBillingStore } from "@autonomia/core/billing";
import type { AutonomiaRuntimeEnv } from "../types.ts";
import { ensureAiSchema } from "./aiSchema.ts";
import { createAutonomiaQuery, dbQuery } from "./db.ts";
import { recordAutonomiaSettlement } from "./metrics.ts";

const stores = new Map<string, ReturnType<typeof createAutonomiaBillingStore>>();

function databaseKey(env: AutonomiaRuntimeEnv) {
  // SN-13 fix:與 rateLimit 的 limiterStoreKey 對齊,額外涵蓋
  // AUTONOMIA_DB_PATH —— 單行程多 SQLite 路徑(測試情境)時,
  // 只認 DATABASE_URL 會讓不同路徑共用同一個 store(錯的 query 閉包)。
  return env?.DATABASE_URL?.trim() || env?.AUTONOMIA_DB_PATH?.trim() || "unconfigured-main";
}

function billingStore(env: AutonomiaRuntimeEnv) {
  const key = databaseKey(env);
  if (!stores.has(key)) {
    stores.set(key, createAutonomiaBillingStore(createAutonomiaQuery(env)));
  }
  return stores.get(key);
}

async function withStore<T>(
  env: AutonomiaRuntimeEnv,
  run: (store: ReturnType<typeof createAutonomiaBillingStore>) => Promise<T>,
): Promise<T> {
  await ensureAiSchema(env);
  return run(billingStore(env)!);
}

export const reserveAutonomiaSpend = (env: AutonomiaRuntimeEnv, input: AutonomiaBillingReserveInput) =>
  withStore(env, (store) => store.reserve(input));
export const readAutonomiaBilling = (env: AutonomiaRuntimeEnv, requestId: string) =>
  withStore(env, (store) => store.read(requestId));
export const markAutonomiaDispatched = (env: AutonomiaRuntimeEnv, requestId: string) =>
  withStore(env, (store) => store.markDispatched(requestId));
// 結算成功後累計 tokens/spend 指標(供 /metrics 輸出)。settle 失敗時拋錯,
// 不會記入——指標只反映實際落帳的金額與用量。
export const settleAutonomiaSpend = async (env: AutonomiaRuntimeEnv, input: AutonomiaBillingSettleInput) => {
  const result = await withStore(env, (store) => store.settle(input));
  recordAutonomiaSettlement(input);
  return result;
};
export const refundAutonomiaSpend = (env: AutonomiaRuntimeEnv, input: AutonomiaBillingRefundInput) =>
  withStore(env, (store) => store.refund(input));
export const markAutonomiaNeedsReconciliation = (
  env: AutonomiaRuntimeEnv,
  input: AutonomiaBillingMarkNeedsReconciliationInput,
) => withStore(env, (store) => store.markNeedsReconciliation(input));
export const reconcileStaleAutonomiaReservations = (
  env: AutonomiaRuntimeEnv,
  input: AutonomiaBillingReconcileOptions = {},
) => withStore(env, (store) => store.reconcileStale(input));
export const resolveQuarantinedAutonomiaReservations = (
  env: AutonomiaRuntimeEnv,
  input: AutonomiaBillingQuarantineOptions = {},
) => withStore(env, (store) => store.resolveQuarantined(input));

// ai_rate_limit_buckets 以 (api_key_id, window_start) 為鍵逐請求寫入:
// 分鐘視窗(正數 key id)與免費額度月視窗(負數合成 id)都不會再被讀取,
// 需定期清除,否則表格無限成長並拖慢熱路徑的 ON CONFLICT upsert。
export async function cleanupAutonomiaRateLimitBuckets(env: AutonomiaRuntimeEnv) {
  await ensureAiSchema(env);
  await dbQuery(
    env,
    `
    DELETE FROM ai_rate_limit_buckets
    WHERE (api_key_id > 0 AND window_start < ?)
       OR (api_key_id < 0 AND window_start < ?)
  `,
    [
      new Date(Date.now() - 3_600_000).toISOString(),
      new Date(Date.now() - 2 * 30 * 86_400_000).toISOString(),
    ],
  );
  const expiredLeases = await dbQuery(
    env,
    `
    DELETE FROM ai_api_inflight_leases
    WHERE expires_at <= ?
      AND released_at IS NULL
    RETURNING request_id
  `,
    [new Date().toISOString()],
  );
  return { expiredLeases: expiredLeases.rows?.length || 0 };
}
