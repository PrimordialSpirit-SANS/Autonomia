import type { AutonomiaQuery } from "@autonomia/core/query";
import type { AutonomiaRuntimeEnv } from "../types.ts";
// DB adapter 註冊點:gateway 其餘程式只依賴這個模組的查詢介面,實作可替換:
// - Node 進入點(nodeServer、migrate/reconcile scripts)啟動時呼叫
//   installNodeAutonomiaDbAdapter(),依 DATABASE_URL / AUTONOMIA_PG_DRIVER
//   動態載入本目錄的 db.node.ts(node:sqlite)、db.pg.ts(TCP pg Pool)
//   或 db.pg.serverless.ts(Neon 相容 WebSocket 無伺服器驅動)。
// - Cloudflare Workers:預設 DO-SQLite 拓撲由 Durable Object 建構子安裝
//   src/worker/doDb.ts;PG 模式(DATABASE_URL 或 HYPERDRIVE 綁定)由
//   src/worker/pgRuntime.ts 經 db.runtime.ts 載入 PG adapter。
// 所有 adapter 契約相同:(sql, params) => { rows },交易以
// withAutonomiaTransaction(env, fn) 包裝,fn 內不得有真實 I/O await
// (provider 呼叫一律在交易外)。

export interface AutonomiaDbQueryResult {
  rows: any[];
}

export type AutonomiaDbAdapter = {
  dbQuery: (env: AutonomiaRuntimeEnv, sql: string, params?: any[]) => Promise<AutonomiaDbQueryResult>;
  dbGet: (env: AutonomiaRuntimeEnv, sql: string, params?: any[]) => Promise<any | null>;
  withAutonomiaTransaction: (env: AutonomiaRuntimeEnv, fn: () => Promise<any>) => Promise<any>;
  createAutonomiaQuery: (env: AutonomiaRuntimeEnv) => AutonomiaQuery;
  closePostgresClients: () => Promise<void>;
};

let installedAdapter: AutonomiaDbAdapter | null = null;

export function installAutonomiaDbAdapter(adapter: AutonomiaDbAdapter) {
  installedAdapter = adapter;
}

// Node 部署的運行方言:DATABASE_URL 為 postgres(ql):// 時使用 PostgreSQL
// adapter,其餘(含預設 AUTONOMIA_DB_PATH)走 node:sqlite。Workers 的
// DO-SQLite 拓撲不經此函式。
export function isPostgresDatabaseUrl(value: unknown): boolean {
  return /^postgres(ql)?:\/\//i.test(String(value || "").trim());
}

export function runtimeDialect(env: AutonomiaRuntimeEnv): "postgres" | "sqlite" {
  return isPostgresDatabaseUrl(env?.DATABASE_URL) ? "postgres" : "sqlite";
}

// ---------------------------------------------------------------------------
// PostgreSQL 驅動選擇:TCP pg Pool(VPS / Render / Vercel-Netlify Node 函式 /
// Workers+Hyperdrive)vs Neon 相容 WebSocket 無伺服器驅動(邊緣 runtime、
// Neon、自架 WS 閘道)。規則:
//   1. AUTONOMIA_PG_DRIVER 明確指定(別名見下),無效值 fail-fast;
//   2. HYPERDRIVE 綁定存在 → pg-pool(binding 的本地通道即為 TCP pg);
//   3. AUTONOMIA_PG_WS_PROXY 已設定(自架 pg-gateway/supavisor)→ neon;
//   4. DATABASE_URL 主機為 *.neon.tech → neon;
//   5. 其餘 → pg-pool。
// ---------------------------------------------------------------------------

export type AutonomiaPgDriver = "pg-pool" | "neon";

const PG_POOL_DRIVER_ALIASES = new Set(["pg-pool", "pg", "node", "tcp"]);
const NEON_DRIVER_ALIASES = new Set(["neon", "neon-ws", "serverless", "ws"]);

function pgUrlHost(connectionString: string): string {
  try {
    return new URL(connectionString).hostname.toLowerCase();
  } catch {
    const keyword = /(?:^|\s)host\s*=\s*(\S+)/.exec(connectionString);
    return (keyword?.[1] ?? "").toLowerCase();
  }
}

function hasHyperdriveBinding(env: AutonomiaRuntimeEnv | undefined): boolean {
  const binding = env?.HYPERDRIVE as { connectionString?: unknown } | undefined;
  return typeof binding?.connectionString === "string" && binding.connectionString.length > 0;
}

export function selectAutonomiaPgDriver(env?: AutonomiaRuntimeEnv): AutonomiaPgDriver {
  const explicit = String(env?.AUTONOMIA_PG_DRIVER || "")
    .trim()
    .toLowerCase();
  if (explicit) {
    if (PG_POOL_DRIVER_ALIASES.has(explicit)) return "pg-pool";
    if (NEON_DRIVER_ALIASES.has(explicit)) return "neon";
    throw new Error(`AUTONOMIA_PG_DRIVER "${explicit}" is not recognized: expected auto | pg-pool | neon.`);
  }
  if (hasHyperdriveBinding(env)) return "pg-pool";
  const url = String(env?.DATABASE_URL || "").trim();
  if (String(env?.AUTONOMIA_PG_WS_PROXY || "").trim()) return "neon";
  if (/(^|\.)neon\.tech$/i.test(pgUrlHost(url))) return "neon";
  return "pg-pool";
}

// Workers 進入點的 PG 模式判定:DATABASE_URL 為 postgres:// 或設有
// HYPERDRIVE 綁定時,流量不再進 Durable Object,改由 worker/pgRuntime.ts
// 直接跑 Hono app + PG adapter(見 src/worker.ts)。
export function isWorkerPgRuntime(env?: AutonomiaRuntimeEnv): boolean {
  return isPostgresDatabaseUrl(env?.DATABASE_URL) || hasHyperdriveBinding(env);
}

// Node 進入點啟動時呼叫一次(依 DATABASE_URL 與驅動選擇 adapter)。
// specifier 刻意以非字面量的形式動態 import:讓 Workers 打包(esbuild)
// 無法靜態解析、不會把 node:sqlite / pg / @neondatabase/serverless 拉進
// bundle;Node 執行期仍以相對於本檔的 URL 正常解析。Workers 的 PG 模式
// 改用 db.runtime.ts 的字面量動態 import(esbuild 會切成獨立 chunk)。
export async function installNodeAutonomiaDbAdapter() {
  if (installedAdapter) return;
  if (isPostgresDatabaseUrl(process.env?.DATABASE_URL)) {
    const driver = selectAutonomiaPgDriver(process.env as AutonomiaRuntimeEnv);
    const specifier =
      driver === "neon" ? ["./db", "pg", "serverless", "ts"].join(".") : ["./db", "pg", "ts"].join(".");
    installedAdapter = (await import(specifier)) as AutonomiaDbAdapter;
    return;
  }
  installedAdapter = (await import(["./db", "node", "ts"].join("."))) as AutonomiaDbAdapter;
}

function requireAdapter(): AutonomiaDbAdapter {
  if (installedAdapter) return installedAdapter;
  throw new Error(
    "Autonomia DB adapter is not installed: Node entries must call installNodeAutonomiaDbAdapter() " +
      "at startup; on Cloudflare Workers the request must run inside the AUTONOMIA_DO Durable Object " +
      "(SQLite topology) or through the PG runtime (worker/pgRuntime.ts).",
  );
}

export function dbQuery(
  env: AutonomiaRuntimeEnv,
  sql: string,
  params: any[] = [],
): Promise<AutonomiaDbQueryResult> {
  return requireAdapter().dbQuery(env, sql, params);
}

export function dbGet(env: AutonomiaRuntimeEnv, sql: string, params: any[] = []): Promise<any | null> {
  return requireAdapter().dbGet(env, sql, params);
}

export function withAutonomiaTransaction<T>(env: AutonomiaRuntimeEnv, fn: () => Promise<T>): Promise<T> {
  return requireAdapter().withAutonomiaTransaction(env, fn) as Promise<T>;
}

export function createAutonomiaQuery(env: AutonomiaRuntimeEnv): AutonomiaQuery {
  return requireAdapter().createAutonomiaQuery(env);
}

export function closePostgresClients(): Promise<void> {
  return requireAdapter().closePostgresClients();
}
