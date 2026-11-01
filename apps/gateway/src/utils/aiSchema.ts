import { assertAutonomiaSchemaReady } from "@autonomia/core/schemaReadiness";
import type { AutonomiaRuntimeEnv } from "../types.ts";
import { createAutonomiaQuery } from "./db.ts";

const schemaPromises = new Map();

function databaseKey(env: AutonomiaRuntimeEnv) {
  // S-10 修復:與 rateLimit、aiBilling、aiProviderPool 等模組的 store 鍵對齊
  // —— 涵蓋 AUTONOMIA_DB_PATH。修復前只認 DATABASE_URL:單一程序服務兩個
  // SQLite 路徑時,第二個路徑的就緒檢查被第一個路徑的快取短路,查詢打到
  // 未遷移的資料庫並回 500(SN-13 修的是其他模組,此處是同一模式的漏網)。
  return (
    env?.DATABASE_URL?.trim() || env?.AUTONOMIA_DB_PATH?.trim() || "unconfigured-main"
  );
}

export function ensureAiSchema(env: AutonomiaRuntimeEnv) {
  const key = databaseKey(env);
  if (schemaPromises.has(key)) return schemaPromises.get(key);

  const promise = (async () => {
    // createAutonomiaQuery 提供 dialect 標註:就緒檢查依此選擇 SQLite/PostgreSQL
    // 的 catalog 語法(裸函式包裝會被誤判為 SQLite)。
    await assertAutonomiaSchemaReady(createAutonomiaQuery(env));
  })().catch((error: any) => {
    schemaPromises.delete(key);
    throw error;
  });

  schemaPromises.set(key, promise);
  return promise;
}

export function resetAiSchemaPromiseForTests(databaseUrl: any) {
  if (databaseUrl) schemaPromises.delete(String(databaseUrl).trim());
  else schemaPromises.clear();
}
