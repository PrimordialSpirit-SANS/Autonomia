import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import { createApp } from "../src/app.ts";
import { ensureAutonomiaSchemaReady } from "../src/utils/bootstrap.ts";
import { installNodeAutonomiaDbAdapter } from "../src/utils/db.ts";
import { configuredPbkdf2Iterations, findUserByEmail, findUserPasswordHash } from "../src/utils/users.ts";

// 註冊防帳號枚舉的真實 DB 行為(時序等化 + 重複信箱隱匿):
// - 預設:重複信箱回 202 受理訊息,不發 session、不揭露 email_taken。
// - AUTONOMIA_SIGNUP_ANTI_ENUMERATION=false:私有部署可還原明確 409 合約。
// 搭配 node:sqlite :memory: DB,與 bootstrap.test.ts 同一拓撲。

const SECRET = "x".repeat(32);

// createApp 只把 env 烘進 fail-closed 閘門;路由內部讀的是 c.env(Worker
// 執行期注入)。測試以一層 middleware 模擬這個注入。
function createTestApp(env: any = {}) {
  const outer = new Hono();
  outer.use("*", async (c: any, next: any) => {
    c.env = env;
    await next();
  });
  outer.route("/", createApp(env));
  return outer;
}

async function createSchemaReadyEnv(extra: Record<string, unknown> = {}) {
  const env: any = {
    AUTONOMIA_ENABLED: "true",
    JWT_SECRET: SECRET,
    AUTONOMIA_DB_PATH: ":memory:",
    ...extra,
  };
  await ensureAutonomiaSchemaReady(env);
  return env;
}

function registerRequest(email: string, username: string, password: string) {
  return {
    method: "POST",
    body: JSON.stringify({ email, username, password }),
    headers: { "Content-Type": "application/json" },
  };
}

test("anti-enumeration mode returns identical 202 responses for fresh and duplicate signups", async () => {
  await installNodeAutonomiaDbAdapter();
  const env = await createSchemaReadyEnv();
  const app = createTestApp(env);

  const first = await app.request(
    "/api/auth/register",
    registerRequest("taken@example.com", "alice", "longenough1"),
  );
  // 新註冊與重複信箱必須完全同形:狀態碼、主體、cookie 一致 ——
  // 201 vs 202 的差異本身就是枚舉 oracle(README 承諾的「不可區分」)。
  assert.equal(first.status, 202);
  const firstBody = (await first.json()) as any;
  assert.equal(firstBody.ok, true);
  assert.equal(firstBody.user, undefined, "fresh signup must not leak the created user");
  assert.equal(
    first.headers.get("set-cookie"),
    null,
    "fresh signup must not auto-issue a session in anti-enumeration mode",
  );

  const duplicate = await app.request(
    "/api/auth/register",
    registerRequest("taken@example.com", "mallory", "longenough2"),
  );
  assert.equal(duplicate.status, 202);
  const duplicateBody = (await duplicate.json()) as any;
  assert.equal(duplicateBody.ok, true);
  assert.equal(duplicateBody.user, undefined, "concealed response must not leak the account");
  assert.equal(duplicateBody.code, undefined, "concealed response must not expose email_taken");
  assert.equal(duplicate.headers.get("set-cookie"), null, "concealed response must not issue a session");

  // 回應完全同形:狀態碼與主體逐位元組一致,枚舉者無從區分。
  assert.deepEqual(duplicateBody, firstBody);

  // 受理語意為真:新註冊的帳號可立即以註冊憑證登入。
  const login = await app.request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "taken@example.com", password: "longenough1" }),
    headers: { "Content-Type": "application/json" },
  });
  assert.equal(login.status, 200);
  assert.equal(((await login.json()) as any).user.username, "alice");
});

test("AUTONOMIA_SIGNUP_ANTI_ENUMERATION=false restores the explicit 409 contract", async () => {
  await installNodeAutonomiaDbAdapter();
  const env = await createSchemaReadyEnv({ AUTONOMIA_SIGNUP_ANTI_ENUMERATION: "false" });
  const app = createTestApp(env);

  const first = await app.request(
    "/api/auth/register",
    registerRequest("explicit@example.com", "bob", "longenough1"),
  );
  assert.equal(first.status, 201);

  const duplicate = await app.request(
    "/api/auth/register",
    registerRequest("explicit@example.com", "mallory", "longenough2"),
  );
  assert.equal(duplicate.status, 409);
  assert.equal(((await duplicate.json()) as any).code, "email_taken");
});

test("concealed duplicate signup does not alter or take over the existing account", async () => {
  await installNodeAutonomiaDbAdapter();
  const env = await createSchemaReadyEnv();
  const app = createTestApp(env);

  const first = await app.request(
    "/api/auth/register",
    registerRequest("owner@example.com", "owner", "ownerpass99"),
  );
  assert.equal(first.status, 202);

  const probe = await app.request(
    "/api/auth/register",
    registerRequest("owner@example.com", "attacker", "attackerpass1"),
  );
  assert.equal(probe.status, 202);

  // 攻擊者的密碼不得覆寫既有帳號:僅原密碼能登入。
  const stolenLogin = await app.request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "owner@example.com", password: "attackerpass1" }),
    headers: { "Content-Type": "application/json" },
  });
  assert.equal(stolenLogin.status, 401);

  const ownerLogin = await app.request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "owner@example.com", password: "ownerpass99" }),
    headers: { "Content-Type": "application/json" },
  });
  assert.equal(ownerLogin.status, 200);
  const ownerBody = (await ownerLogin.json()) as any;
  assert.equal(ownerBody.user.username, "owner", "account identity is unchanged");
});

// SN-5 fix:isSecureRequest 原本無條件信任 x-forwarded-proto,純 HTTP 下
// 偽造 https 可翻轉 session cookie 的 Secure 屬性。修復後僅在
// AUTONOMIA_TRUST_PROXY=true 時採信該標頭,與 requestOwnOrigin 的信任
// 邊界一致。
test("session cookie Secure attribute follows the trust-proxy boundary (SN-5)", async () => {
  await installNodeAutonomiaDbAdapter();
  const env = await createSchemaReadyEnv();
  const app = createTestApp(env);

  const register = await app.request(
    "/api/auth/register",
    registerRequest("secure-cookie@example.com", "secureuser", "longenough1"),
  );
  assert.equal(register.status, 202);

  // 登入成功會 Set-Cookie;此測試殼跑在純 HTTP(c.req.url 是 http:)。
  const login = {
    method: "POST",
    body: JSON.stringify({ email: "secure-cookie@example.com", password: "longenough1" }),
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-proto": "https",
    },
  };
  const untrusted = await app.request("/api/auth/login", login);
  assert.equal(untrusted.status, 200);
  // 未宣告信任代理:偽造的 x-forwarded-proto 不採信,cookie 不得帶 Secure。
  assert.equal(untrusted.headers.get("set-cookie")?.includes("Secure"), false);

  const trusted = await createTestApp(await createSchemaReadyEnv({ AUTONOMIA_TRUST_PROXY: "true" })).request(
    "/api/auth/login",
    login,
  );
  assert.equal(trusted.status, 200);
  // 宣告信任代理(前方有 TLS 終止的受信賴代理):採信 https,cookie 帶 Secure。
  assert.equal(trusted.headers.get("set-cookie")?.includes("Secure"), true);
});

// ── S-01 修復釘死:登入兩條路徑(dummy hash 與真實雜湊)的 PBKDF2 迭代數 ──
// 必須來自同一個設定來源,否則自訂 AUTONOMIA_PBKDF2_ITERATIONS 的部署下,
// 量測 /api/auth/login 回應延遲即可枚舉已註冊信箱(修復前差異約 60 倍)。
test("S-01: dummy hash iterations must follow AUTONOMIA_PBKDF2_ITERATIONS (anti-enumeration timing parity)", async () => {
  await installNodeAutonomiaDbAdapter();
  const env = await createSchemaReadyEnv({
    AUTONOMIA_SIGNUP_ANTI_ENUMERATION: "false",
    AUTONOMIA_PBKDF2_ITERATIONS: "10000",
  });
  const app = createTestApp(env);

  // 單元層:解析函數必須採用設定值(下限 10,000 之上才採信)。
  assert.equal(configuredPbkdf2Iterations(env), 10_000);
  assert.equal(configuredPbkdf2Iterations({}), 600_000, "unset config must fall back to the default");

  const registered = await app.request(
    "/api/auth/register",
    registerRequest("timing@example.com", "carol", "longenough1"),
  );
  assert.equal(registered.status, 201);

  // 資料層(對照組):真實帳號的雜湊字串本身記錄設定值 10,000。
  const stored = await findUserPasswordHash(env, "timing@example.com");
  assert.ok(
    stored?.startsWith("pbkdf2$10000$"),
    `real-account hash must embed configured iterations: ${stored}`,
  );

  const loginRequest = (email: string, password: string) => ({
    method: "POST",
    body: JSON.stringify({ email, password }),
    headers: { "Content-Type": "application/json" },
  });

  // 暖身兩次:預載 WebCrypto 模組與路由,避免首次呼叫的固定成本污染量測。
  await app.request("/api/auth/login", loginRequest("warmup@example.com", "irrelevant0"));
  await app.request("/api/auth/login", loginRequest("warmup@example.com", "irrelevant0"));

  // 量測層:不存在的帳號走 dummy hash 路徑,迭代數必須是 10,000 而非
  // 修復前寫死的 600,000。600k 次 PBKDF2-SHA256 即使在快機上也遠超
  // 90ms;10k 次(含請求開銷)通常 < 10ms。
  const missingStart = performance.now();
  const missing = await app.request("/api/auth/login", loginRequest("nobody@example.com", "whatever12"));
  const missingMs = performance.now() - missingStart;
  assert.equal(missing.status, 401);
  assert.ok(
    missingMs < 90,
    `dummy hash must burn configured (10k) iterations, took ${missingMs.toFixed(1)}ms — likely regressed to the 600k constant`,
  );

  // 回歸保護:低於下限的設定值不得被採信(防止弱雜湊被寫入)。
  const weak = await createSchemaReadyEnv({
    AUTONOMIA_SIGNUP_ANTI_ENUMERATION: "false",
    AUTONOMIA_PBKDF2_ITERATIONS: "1000",
  });
  assert.equal(configuredPbkdf2Iterations(weak), 600_000, "iterations below the 10k floor must be ignored");

  // 正確密碼登入仍可用(10,000 迭代產生的雜湊可通過驗證)。
  const ok = await app.request("/api/auth/login", loginRequest("timing@example.com", "longenough1"));
  assert.equal(ok.status, 200);
});

// ── S-09 修復釘死:註冊贈點的解析失敗必須回退到安全側(0 元)─────
// 修復前 catch 一律回傳 5 美元 —— 公開註冊部署上一個打錯的
// AUTONOMIA_SIGNUP_BONUS_USD 讓每個機器人帳號自動獲得 5 美元且無信號。
test("S-09: unparseable signup bonus falls back to 0 USD, not 5.00", async () => {
  await installNodeAutonomiaDbAdapter();
  const env = await createSchemaReadyEnv({
    AUTONOMIA_SIGNUP_ANTI_ENUMERATION: "false",
    AUTONOMIA_SIGNUP_BONUS_USD: "0.0.0",
  });
  const app = createTestApp(env);

  const registered = await app.request(
    "/api/auth/register",
    registerRequest("bonus-typo@example.com", "bonus", "longenough1"),
  );
  assert.equal(registered.status, 201);
  const account = await findUserByEmail(env, "bonus-typo@example.com");
  assert.equal(account?.balanceUsdMicros, "0", "misconfigured bonus must fall back to 0");

  // 合法值照常生效。
  const validEnv = await createSchemaReadyEnv({
    AUTONOMIA_SIGNUP_ANTI_ENUMERATION: "false",
    AUTONOMIA_SIGNUP_BONUS_USD: "1.23",
  });
  const validApp = createTestApp(validEnv);
  const ok = await validApp.request(
    "/api/auth/register",
    registerRequest("bonus-valid@example.com", "bonus", "longenough1"),
  );
  assert.equal(ok.status, 201);
  assert.equal((await findUserByEmail(validEnv, "bonus-valid@example.com"))?.balanceUsdMicros, "1230000");

  // 未設定:保留 5 美元預設(回歸保護)。
  const defaultEnv = await createSchemaReadyEnv({ AUTONOMIA_SIGNUP_ANTI_ENUMERATION: "false" });
  const defaultApp = createTestApp(defaultEnv);
  const byDefault = await defaultApp.request(
    "/api/auth/register",
    registerRequest("bonus-default@example.com", "bonus", "longenough1"),
  );
  assert.equal(byDefault.status, 201);
  assert.equal((await findUserByEmail(defaultEnv, "bonus-default@example.com"))?.balanceUsdMicros, "5000000");
});
