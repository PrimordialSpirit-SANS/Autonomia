import assert from "node:assert/strict";
import test from "node:test";
import type { AutonomiaRuntimeEnv } from "../src/types.ts";
import { resolveWsProxySetting } from "../src/utils/db.pg.serverless.ts";
import {
  type AutonomiaPgLikeClient,
  type AutonomiaPgLikePool,
  createAutonomiaPgAdapter,
  defaultPgPoolMax,
  isPrivatePgHost,
  normalizePgParam,
  postgresPlaceholders,
  resolvePgSslOptions,
} from "../src/utils/db.pg.shared.ts";
import { isWorkerPgRuntime, selectAutonomiaPgDriver } from "../src/utils/db.ts";

// 無伺服器 PostgreSQL 支援的契約測試:驅動選擇、SSL 推導、池尺寸與
// 兩種驅動共用的 adapter 交易語意(以 fake pool 驅動,不觸網)。
// PG 方言的 SQL 行為(FOR UPDATE、advisory lock)由 pgDialect.test.ts
// 以 pglite 端到端釘死,這裡不重複。

// ---------------------------------------------------------------------------
// 驅動選擇:AUTONOMIA_PG_DRIVER 明確指定 > HYPERDRIVE 綁定 > WS proxy /
// *.neon.tech 特徵 > pg-pool。
// ---------------------------------------------------------------------------

test("selectAutonomiaPgDriver honors explicit driver aliases and rejects unknown values", () => {
  const env = { DATABASE_URL: "postgres://db.example.com:5432/autonomia" } as AutonomiaRuntimeEnv;
  assert.equal(selectAutonomiaPgDriver({ ...env, AUTONOMIA_PG_DRIVER: "pg-pool" }), "pg-pool");
  assert.equal(selectAutonomiaPgDriver({ ...env, AUTONOMIA_PG_DRIVER: "tcp" }), "pg-pool");
  assert.equal(selectAutonomiaPgDriver({ ...env, AUTONOMIA_PG_DRIVER: "neon" }), "neon");
  assert.equal(selectAutonomiaPgDriver({ ...env, AUTONOMIA_PG_DRIVER: "serverless" }), "neon");
  assert.throws(
    () => selectAutonomiaPgDriver({ ...env, AUTONOMIA_PG_DRIVER: "mysql" }),
    /AUTONOMIA_PG_DRIVER/,
  );
});

test("selectAutonomiaPgDriver auto-detects Neon hosts and explicit WebSocket proxies", () => {
  const neon = { DATABASE_URL: "postgres://user@ep-cool-name-pooler.aws.region.aws.neon.tech/neondb" };
  assert.equal(selectAutonomiaPgDriver(neon as AutonomiaRuntimeEnv), "neon");

  const proxied = {
    DATABASE_URL: "postgres://user@db.internal.example.com:5432/autonomia",
    AUTONOMIA_PG_WS_PROXY: "ws-proxy.internal.example.com:5432/v1",
  };
  assert.equal(selectAutonomiaPgDriver(proxied as AutonomiaRuntimeEnv), "neon");

  const plain = { DATABASE_URL: "postgres://user@db.internal.example.com:5432/autonomia" };
  assert.equal(selectAutonomiaPgDriver(plain as AutonomiaRuntimeEnv), "pg-pool");

  const empty = {};
  assert.equal(selectAutonomiaPgDriver(empty as AutonomiaRuntimeEnv), "pg-pool");
});

test("selectAutonomiaPgDriver prefers the Hyperdrive binding unless neon is forced", () => {
  const hyperdrive = { connectionString: "postgres://user@hyperdrive.local:5432/autonomia" };
  const neonUrl = { DATABASE_URL: "postgres://user@ep-x.aws.neon.tech/neondb" };
  // 綁定存在 → TCP pg 驅動走 Hyperdrive 通道(即使 DATABASE_URL 是 Neon)。
  assert.equal(
    selectAutonomiaPgDriver({ ...neonUrl, HYPERDRIVE: hyperdrive } as AutonomiaRuntimeEnv),
    "pg-pool",
  );
  // 明確指定 neon 則尊重(直連 Neon WS,不經 Hyperdrive)。
  assert.equal(
    selectAutonomiaPgDriver({
      ...neonUrl,
      HYPERDRIVE: hyperdrive,
      AUTONOMIA_PG_DRIVER: "neon",
    } as AutonomiaRuntimeEnv),
    "neon",
  );
  // 僅綁定、無 URL(auto 下 PG 模式仍成立,連線字串取自綁定)。
  assert.equal(selectAutonomiaPgDriver({ HYPERDRIVE: hyperdrive } as AutonomiaRuntimeEnv), "pg-pool");
});

test("isWorkerPgRuntime switches the Workers entry off the Durable Object path", () => {
  assert.equal(
    isWorkerPgRuntime({ DATABASE_URL: "postgres://db.example.com/db" } as AutonomiaRuntimeEnv),
    true,
  );
  assert.equal(
    isWorkerPgRuntime({ HYPERDRIVE: { connectionString: "postgres://x/y" } } as AutonomiaRuntimeEnv),
    true,
  );
  assert.equal(isWorkerPgRuntime({ DATABASE_URL: "sqlite://./autonomia.db" } as AutonomiaRuntimeEnv), false);
  assert.equal(isWorkerPgRuntime({ AUTONOMIA_DB_PATH: "./autonomia.db" } as AutonomiaRuntimeEnv), false);
  assert.equal(isWorkerPgRuntime(undefined), false);
});

// ---------------------------------------------------------------------------
// SSL 推導:環境變數 > 連線字串 sslmode/ssl > 主機啟發式;Hyperdrive 恆不加密。
// ---------------------------------------------------------------------------

test("resolvePgSslOptions infers TLS from remote hosts and honors explicit modes", () => {
  const remote = "postgres://user@db.managed.example.com:5432/autonomia";
  assert.deepEqual(resolvePgSslOptions(remote), { rejectUnauthorized: false });
  assert.deepEqual(resolvePgSslOptions(`${remote}?sslmode=require`), { rejectUnauthorized: false });
  assert.deepEqual(resolvePgSslOptions(`${remote}?sslmode=verify-full`), { rejectUnauthorized: true });
  assert.equal(resolvePgSslOptions(`${remote}?sslmode=disable`), false);
  assert.deepEqual(resolvePgSslOptions(`${remote}?ssl=true`), { rejectUnauthorized: false });
  assert.equal(resolvePgSslOptions(`${remote}?ssl=false`), false);
  // 環境變數優先於連線字串。
  assert.equal(
    resolvePgSslOptions(`${remote}?sslmode=require`, { env: { AUTONOMIA_PG_SSL: "disable" } }),
    false,
  );
  assert.deepEqual(resolvePgSslOptions(remote, { env: { AUTONOMIA_PG_SSL: "verify-full" } }), {
    rejectUnauthorized: true,
  });
});

test("resolvePgSslOptions keeps local and private hosts plaintext", () => {
  for (const url of [
    "postgres://user@localhost:5432/autonomia",
    "postgres://user@127.0.0.1:5432/autonomia",
    "postgres://user@10.1.2.3:5432/autonomia",
    "postgres://user@192.168.1.10:5432/autonomia",
    "postgres://user@172.20.0.5:5432/autonomia",
    "postgres://user@db.rinternal.internal:5432/autonomia",
    "postgres://user@autonomia-db.local:5432/autonomia",
    "postgres://user@hyperdrive.local:5432/autonomia",
    "postgres:///var/run/postgresql/autonomia", // unix socket:無 host
  ]) {
    assert.equal(resolvePgSslOptions(url), false, url);
  }
  // 明確要求加密時,內網也照辦(部署層總開關)。
  assert.deepEqual(
    resolvePgSslOptions("postgres://user@10.1.2.3:5432/autonomia", { env: { AUTONOMIA_PG_SSL: "require" } }),
    { rejectUnauthorized: false },
  );
});

test("resolvePgSslOptions parses pg keyword/value connection strings and Hyperdrive", () => {
  const keyword = "host=db.managed.example.com port=5432 user=autonomia sslmode=require";
  assert.deepEqual(resolvePgSslOptions(keyword), { rejectUnauthorized: false });
  const keywordRemote = "host=db.managed.example.com port=5432 user=autonomia";
  assert.deepEqual(resolvePgSslOptions(keywordRemote), { rejectUnauthorized: false });
  // Hyperdrive 的本地通道:對外 TLS 由 Hyperdrive 代管,client 不加密。
  assert.equal(
    resolvePgSslOptions("postgres://user@hyperdrive.local:5432/db", { viaHyperdrive: true }),
    false,
  );
});

test("isPrivatePgHost classifies loopback, private ranges and unix sockets", () => {
  assert.equal(isPrivatePgHost(""), true);
  assert.equal(isPrivatePgHost("localhost"), true);
  assert.equal(isPrivatePgHost("db.lan.internal"), true);
  assert.equal(isPrivatePgHost("172.31.255.1"), true);
  assert.equal(isPrivatePgHost("db.neon.tech"), false);
  assert.equal(isPrivatePgHost("db.example.com"), false);
});

// ---------------------------------------------------------------------------
// 池尺寸:無伺服器函式環境(Vercel/Netlify/Lambda)每實例一條連線,
// 常駐程序(Node VPS / Render)維持 10;AUTONOMIA_PG_POOL_MAX 恆可覆寫。
// ---------------------------------------------------------------------------

test("defaultPgPoolMax shrinks pools in serverless compute environments", () => {
  assert.equal(defaultPgPoolMax({}), 10);
  assert.equal(defaultPgPoolMax({ AUTONOMIA_PG_POOL_MAX: "4" }), 4);
  assert.equal(defaultPgPoolMax({ AUTONOMIA_PG_POOL_MAX: "0" }), 10, "0 與負值視為未設定");

  const originalVercel = process.env.VERCEL;
  try {
    process.env.VERCEL = "1";
    assert.equal(defaultPgPoolMax({}), 1);
    assert.equal(defaultPgPoolMax({ AUTONOMIA_PG_POOL_MAX: "3" }), 3);
    delete process.env.VERCEL;
    const originalNetlify = process.env.NETLIFY;
    process.env.NETLIFY = "true";
    assert.equal(defaultPgPoolMax({}), 1);
    process.env.NETLIFY = originalNetlify;
  } finally {
    if (originalVercel === undefined) {
      delete process.env.VERCEL;
    } else {
      process.env.VERCEL = originalVercel;
    }
  }
});

// ---------------------------------------------------------------------------
// adapter 工廠的交易語意(fake pool,不觸網):BEGIN/COMMIT/ROLLBACK 順序、
// 交易內語句綁定同一 client、巢狀沿用、close 釋放。
// ---------------------------------------------------------------------------

class RecordingClient implements AutonomiaPgLikeClient {
  readonly queries: Array<{ text: string; params: unknown[] }> = [];
  id = 0;
  pool: RecordingPool | null = null;
  async query(text: string, params: unknown[] = []): Promise<{ rows: any[] }> {
    this.queries.push({ text, params });
    return { rows: [] };
  }
  release(): void {
    if (this.pool) this.pool.releasedClientIds.push(this.id);
  }
}

class RecordingPool implements AutonomiaPgLikePool {
  readonly clients: RecordingClient[] = [];
  readonly poolQueries: Array<{ text: string; params: unknown[] }> = [];
  readonly releasedClientIds: number[] = [];
  readonly errorListeners: Array<(error: unknown) => void> = [];
  readonly connectionString: string;
  ended = false;
  private nextClientId = 0;
  constructor(url: string) {
    this.connectionString = url;
  }
  async connect(): Promise<RecordingClient> {
    this.nextClientId += 1;
    const client = new RecordingClient();
    client.id = this.nextClientId;
    client.pool = this;
    this.clients.push(client);
    return client;
  }
  async query(text: string, params: unknown[] = []): Promise<{ rows: any[] }> {
    this.poolQueries.push({ text, params });
    return { rows: [] };
  }
  async end(): Promise<void> {
    this.ended = true;
  }
  on(_event: "error", listener: (error: unknown) => void): unknown {
    this.errorListeners.push(listener);
    return this;
  }
}

function fakeAdapter(connectionString = "postgres://fake.internal/autonomia") {
  const pools = new Map<string, AutonomiaPgLikePool>();
  let created = 0;
  const adapter = createAutonomiaPgAdapter({
    pools,
    createPool(url) {
      created += 1;
      return new RecordingPool(url);
    },
    resolveConnectionString: () => connectionString,
  });
  return { adapter, pools, createdCount: () => created };
}

test("pg adapter factory wraps transactions in BEGIN/COMMIT on one dedicated client", async () => {
  const { adapter, pools } = fakeAdapter();
  const env = {} as AutonomiaRuntimeEnv;

  await adapter.withAutonomiaTransaction(env, async () => {
    await adapter.dbQuery(env, "UPDATE ledger_entries SET amount = ? WHERE id = ?", ["5", 7]);
    await adapter.dbQuery(env, "SELECT balance_usd_micros FROM users WHERE id = ? FOR UPDATE", [7]);
  });

  const pool = pools.get("postgres://fake.internal/autonomia") as RecordingPool;
  assert.equal(pool.clients.length, 1, "交易只借用一條專屬連線");
  const [client] = pool.clients;
  assert.deepEqual(
    client.queries.map((entry) => entry.text),
    [
      "BEGIN",
      "UPDATE ledger_entries SET amount = $1 WHERE id = $2",
      "SELECT balance_usd_micros FROM users WHERE id = $1 FOR UPDATE",
      "COMMIT",
    ],
  );
  assert.deepEqual(client.queries[1].params, ["5", 7]);
  assert.deepEqual(pool.releasedClientIds, [1], "client 於交易結束後釋放");
});

test("pg adapter factory rolls back and releases on failure", async () => {
  const { adapter, pools } = fakeAdapter();
  const env = {} as AutonomiaRuntimeEnv;

  await assert.rejects(
    adapter.withAutonomiaTransaction(env, async () => {
      await adapter.dbQuery(env, "UPDATE users SET balance_usd_micros = 0");
      throw new Error("boom");
    }),
    /boom/,
  );

  const pool = pools.get("postgres://fake.internal/autonomia") as RecordingPool;
  const [client] = pool.clients;
  assert.deepEqual(
    client.queries.map((entry) => entry.text),
    ["BEGIN", "UPDATE users SET balance_usd_micros = 0", "ROLLBACK"],
  );
  assert.deepEqual(pool.releasedClientIds, [1]);
});

test("pg adapter factory reuses the outer transaction for nested calls", async () => {
  const { adapter, pools } = fakeAdapter();
  const env = {} as AutonomiaRuntimeEnv;

  await adapter.withAutonomiaTransaction(env, async () => {
    await adapter.dbQuery(env, "SELECT 1");
    await adapter.withAutonomiaTransaction(env, async () => {
      await adapter.dbQuery(env, "SELECT 2");
    });
  });

  const pool = pools.get("postgres://fake.internal/autonomia") as RecordingPool;
  assert.equal(pool.clients.length, 1, "巢狀交易不得另開連線");
  assert.deepEqual(
    pool.clients[0].queries.map((entry) => entry.text),
    ["BEGIN", "SELECT 1", "SELECT 2", "COMMIT"],
  );
});

test("pg adapter factory routes non-transactional queries through the pool and registers error handlers", async () => {
  const { adapter, pools, createdCount } = fakeAdapter();
  const env = {} as AutonomiaRuntimeEnv;

  await adapter.dbQuery(env, "SELECT * FROM models WHERE id = ?", ["m1"]);

  const pool = pools.get("postgres://fake.internal/autonomia") as RecordingPool;
  assert.deepEqual(pool.poolQueries, [{ text: "SELECT * FROM models WHERE id = $1", params: ["m1"] }]);
  assert.equal(pool.clients.length, 0, "交易外查詢不借用專屬 client");
  assert.equal(pool.errorListeners.length, 1, "pool 背景錯誤必須有 handler,避免未處理事件");
  assert.equal(await adapter.dbGet(env, "SELECT 1"), null, "空結果集回 null");

  await adapter.dbQuery(env, "SELECT 2");
  assert.equal(createdCount(), 1, "相同連線字串共用同一池");

  await adapter.closePostgresClients();
  assert.equal(pool.ended, true);
  assert.equal(pools.size, 0);
});

test("pg adapter factory exposes the postgres dialect and query.transaction", async () => {
  const { adapter } = fakeAdapter();
  const env = {} as AutonomiaRuntimeEnv;
  const query = adapter.createAutonomiaQuery(env);
  assert.equal(typeof query, "function");
  assert.equal(query.dialect, "postgres");
  assert.equal(typeof query.transaction, "function");
  await query("SELECT ?", [1]);
});

test("pg param normalization and placeholder conversion stay SQLite-compatible", () => {
  assert.equal(
    postgresPlaceholders("UPDATE t SET a = ?, b = ? WHERE c = ?"),
    "UPDATE t SET a = $1, b = $2 WHERE c = $3",
  );
  assert.equal(postgresPlaceholders("SELECT 1"), "SELECT 1");
  assert.equal(normalizePgParam(true), 1);
  assert.equal(normalizePgParam(false), 0);
  assert.equal(normalizePgParam(undefined), null);
  assert.equal(normalizePgParam(10n ** 18n), "1000000000000000000");
  assert.equal(normalizePgParam(["a", "b"]), '["a","b"]');
  assert.equal(normalizePgParam({ x: 1 }), '{"x":1}');
  assert.equal(normalizePgParam(42), 42);
});

// ---------------------------------------------------------------------------
// Neon 相容驅動的 WebSocket proxy 設定解析。
// ---------------------------------------------------------------------------

test("resolveWsProxySetting accepts static hosts and {host} templates", () => {
  assert.equal(resolveWsProxySetting(""), null);
  assert.equal(resolveWsProxySetting("   "), null);
  assert.equal(
    resolveWsProxySetting("ws-proxy.internal.example.com:5432/v1"),
    "ws-proxy.internal.example.com:5432/v1",
  );

  const template = resolveWsProxySetting("pg-gateway.{host}:5432");
  assert.equal(typeof template, "function");
  if (typeof template === "function") {
    assert.equal(template("db.internal.example.com", 5432), "pg-gateway.db.internal.example.com:5432");
  }
});

// ---------------------------------------------------------------------------
// 動態載入的 specifier 煙霧測試:兩個 PG adapter 模組必須存在且匯出完整
// 契約(installNodeAutonomiaDbAdapter / db.runtime.ts 以非字面量/字面量
// specifier 引用,拼字錯誤要到運行期才會爆)。
// ---------------------------------------------------------------------------

test("obfuscated adapter specifiers resolve to complete adapter modules", async () => {
  const classic = (await import(["../src/utils/db", "pg", "ts"].join("."))) as Record<string, unknown>;
  const serverless = (await import(["../src/utils/db", "pg", "serverless", "ts"].join("."))) as Record<
    string,
    unknown
  >;
  const expected = [
    "dbQuery",
    "dbGet",
    "withAutonomiaTransaction",
    "createAutonomiaQuery",
    "closePostgresClients",
  ];
  for (const mod of [classic, serverless]) {
    for (const name of expected) {
      assert.equal(typeof mod[name], "function", `${name} must be exported`);
    }
  }
  assert.equal(typeof classic.postgresPlaceholders, "function", "postgresPlaceholders 保持匯出(相容性)");
});
