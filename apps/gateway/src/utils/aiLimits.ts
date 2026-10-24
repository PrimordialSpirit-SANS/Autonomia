import { createAutonomiaApiLimitStore } from "@autonomia/core/apiLimits";
import type { AutonomiaRuntimeEnv } from "../types.ts";
import { ensureAiSchema } from "./aiSchema.ts";
import { createAutonomiaQuery } from "./db.ts";

const stores = new Map();

function storeFor(env: AutonomiaRuntimeEnv) {
  // SN-13 fix:與 rateLimit 的 limiterStoreKey 對齊,額外涵蓋
  // AUTONOMIA_DB_PATH —— 單行程多 SQLite 路徑(測試情境)時,
  // 只認 DATABASE_URL 會讓不同路徑共用同一個 store(錯的 query 閉包)。
  const key = env?.DATABASE_URL?.trim() || env?.AUTONOMIA_DB_PATH?.trim() || "unconfigured-main";
  if (!stores.has(key)) {
    stores.set(key, createAutonomiaApiLimitStore(createAutonomiaQuery(env)));
  }
  return stores.get(key);
}

export async function acquireAutonomiaApiLimit(env: AutonomiaRuntimeEnv, input: any) {
  await ensureAiSchema(env);
  return storeFor(env).acquire(input);
}

export async function releaseAutonomiaApiLimit(env: AutonomiaRuntimeEnv, requestId: any) {
  await ensureAiSchema(env);
  return storeFor(env).release(requestId);
}
