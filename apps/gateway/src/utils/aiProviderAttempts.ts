import type { AutonomiaAttemptAuditor } from "@autonomia/core/providerAttempts";
import { createAutonomiaProviderAttemptStore } from "@autonomia/core/providerAttempts";
import type { AutonomiaRuntimeEnv } from "../types.ts";
import { ensureAiSchema } from "./aiSchema.ts";
import { createAutonomiaQuery } from "./db.ts";

const stores = new Map<string, ReturnType<typeof createAutonomiaProviderAttemptStore>>();

type AutonomiaAttemptFinish = NonNullable<AutonomiaAttemptAuditor["finish"]>;

function storeFor(env: AutonomiaRuntimeEnv) {
  // SN-13 fix:與 rateLimit 的 limiterStoreKey 對齊,額外涵蓋
  // AUTONOMIA_DB_PATH —— 單行程多 SQLite 路徑(測試情境)時,
  // 只認 DATABASE_URL 會讓不同路徑共用同一個 store(錯的 query 閉包)。
  const key = env?.DATABASE_URL?.trim() || env?.AUTONOMIA_DB_PATH?.trim() || "unconfigured-main";
  if (!stores.has(key)) {
    stores.set(key, createAutonomiaProviderAttemptStore(createAutonomiaQuery(env)));
  }
  return stores.get(key)!;
}

export async function startAutonomiaProviderAttempt(
  env: AutonomiaRuntimeEnv,
  input: Parameters<AutonomiaAttemptAuditor["start"]>[0],
) {
  await ensureAiSchema(env);
  return storeFor(env).start(input);
}

export async function finishAutonomiaProviderAttempt(
  env: AutonomiaRuntimeEnv,
  attempt: unknown,
  outcome: Parameters<AutonomiaAttemptFinish>[1],
) {
  await ensureAiSchema(env);
  return storeFor(env).finish(attempt, outcome);
}
