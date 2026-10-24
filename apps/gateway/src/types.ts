import type { Context, Next } from "hono";
import type { AutonomiaAccount } from "./utils/users.ts";

// Cloudflare Hyperdrive 綁定(僅 Workers 部署):存在時 Workers 進入點切換
// 為 PG 執行模式,pg adapter 以 binding 的本地通道連線(TLS 由 Hyperdrive
// 對外代管)。連線字串由 Cloudflare runtime 提供。
export interface AutonomiaHyperdriveBinding {
  connectionString?: string;
}

// Gateway 的執行期環境:Node 自架部署是 process.env,Workers 部署是 bindings。
// 已知變數逐一宣告;供應商金鑰(OPENROUTER_API_KEY_1 …)等其餘項目由索引
// 簽章涵蓋,讀取端就近以 String()/Number() 轉型,不假設任意欄位的型別。
export interface AutonomiaRuntimeEnv {
  AUTONOMIA_ENABLED?: string;
  AUTONOMIA_DB_PATH?: string;
  AUTONOMIA_API_KEY_PEPPER?: string;
  AUTONOMIA_DISABLE_REGISTRATION?: string;
  AUTONOMIA_SIGNUP_BONUS_USD?: string;
  AUTONOMIA_ADMIN_STARTING_CREDITS_USD?: string;
  AUTONOMIA_PBKDF2_ITERATIONS?: string;
  AUTONOMIA_PUBLIC_ORIGINS?: string;
  AUTONOMIA_TRUST_PROXY?: string;
  // PostgreSQL(無伺服器支援,見 docs/DEPLOYMENT.md):
  // - AUTONOMIA_PG_DRIVER:auto(預設)| pg-pool(TCP,含 Hyperdrive)| neon
  //   (Neon 相容 WebSocket 無伺服器驅動;*.neon.tech 自動選用)。
  // - AUTONOMIA_PG_SSL:disable | require | verify-full(預設 auto:
  //   沿用連線字串 sslmode;遠端主機自動 require,本機/內網不加密)。
  // - AUTONOMIA_PG_WS_PROXY:自架 pg-gateway/supavisor 的 WebSocket 閘道
  //   (靜態 host[:port][/path] 或含 {host} 的模板)。
  // - AUTONOMIA_PG_WS_SECURE:WS 閘道是否走 wss(預設 true;本地開發閘道
  //   在 TLS 終結之後時設 false)。
  // - AUTONOMIA_PG_POOL_MAX:連線池上限(無伺服器函式環境預設 1,其餘 10)。
  AUTONOMIA_PG_DRIVER?: string;
  AUTONOMIA_PG_SSL?: string;
  AUTONOMIA_PG_WS_PROXY?: string;
  AUTONOMIA_PG_WS_SECURE?: string;
  AUTONOMIA_PG_POOL_MAX?: string;
  // Cloudflare Workers 的 Hyperdrive 綁定(PG 模式;DO-SQLite 拓撲不適用)。
  HYPERDRIVE?: AutonomiaHyperdriveBinding;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_USERNAME?: string;
  DATABASE_URL?: string;
  JWT_SECRET?: string;
  FRONTEND_ORIGINS?: string;
  FRONTEND_BASE_URL?: string;
  PUBLIC_BASE_URL?: string;
  OAUTH_PUBLIC_BASE_URL?: string;
  ENVIRONMENT?: string;
  PORT?: string;
  AUTONOMIA_PORT?: string;
  HOST?: string;
  AUTONOMIA_HOST?: string;
  AUTONOMIA_SIGNUP_ANTI_ENUMERATION?: string;
  AUTONOMIA_MAINTENANCE_INTERVAL_MS?: string;
  AUTONOMIA_RECONCILE_LIMIT?: string;
  [key: string]: unknown;
}

// 金鑰查驗(aiAuth)與開發者 session 憑證(ensureAutonomiaSessionCredential)
// 放進 context 的共用形狀。session 憑證沒有 prefix/suffix,故為選配。
export interface AutonomiaKeyUser {
  id: string;
  username: string;
  role: string;
  is_banned: boolean;
  is_flagged: boolean;
  restricted_services: unknown;
}

export interface AutonomiaAuthenticatedKey {
  id: string;
  user_id: number | string;
  name: string;
  prefix?: string;
  suffix?: string;
  scopes: string[];
  model_allowlist: string[];
  rpm_limit: number;
  max_in_flight: number;
  spend_limit_usd_micros: number | null;
  spend_used_usd_micros: number;
  idempotency_replay_ttl_seconds: number;
  user: AutonomiaKeyUser;
}

export interface AutonomiaVariables {
  user?: AutonomiaAccount;
  aiKey?: AutonomiaAuthenticatedKey;
  aiUser?: AutonomiaKeyUser;
  aiRequestId?: string;
}

export type AutonomiaEnv = { Bindings: AutonomiaRuntimeEnv; Variables: AutonomiaVariables };
export type AutonomiaContext = Context<AutonomiaEnv>;
export type AutonomiaNext = Next;
