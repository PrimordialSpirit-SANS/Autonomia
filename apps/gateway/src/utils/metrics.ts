// 程序內 Prometheus 計數器與 /metrics 輸出。Node 自架拓撲由 nodeServer 掛載
// /metrics;Workers 拓撲不掛載(隔離區生命週期使程序內計數失去意義,觀測走
// Cloudflare observability)。零依賴:僅以 Map 累加,輸出為純字串組裝,
// 不使用任何 Node 專屬 API,因此在兩種拓撲都能安全 import。

const METRIC_FAMILIES: Array<{ name: string; help: string; type: "counter" | "gauge" }> = [
  {
    name: "autonomia_ai_requests_total",
    help: "Autonomia public AI requests by endpoint and HTTP status code.",
    type: "counter",
  },
  {
    name: "autonomia_ai_request_duration_seconds",
    help: "Autonomia public AI request duration in seconds (sum and count per endpoint).",
    type: "counter",
  },
  {
    name: "autonomia_ai_tokens_total",
    help: "Autonomia settled token usage by direction (input or output).",
    type: "counter",
  },
  {
    name: "autonomia_ai_spend_usd_micros_total",
    help: "Autonomia settled spend in micro-USD (1 USD = 1000000 micros).",
    type: "counter",
  },
  {
    name: "autonomia_provider_attempts_total",
    help: "Autonomia upstream provider attempts by provider and outcome.",
    type: "counter",
  },
  {
    name: "autonomia_provider_failures_total",
    help: "Autonomia upstream provider failures by provider and error category.",
    type: "counter",
  },
  {
    name: "autonomia_provider_attempt_duration_seconds",
    help: "Autonomia upstream provider attempt duration in seconds (sum and count per provider and outcome).",
    type: "counter",
  },
  {
    name: "autonomia_up",
    help: "Whether the Autonomia process reports itself as up.",
    type: "gauge",
  },
  {
    name: "autonomia_process_uptime_seconds",
    help: "Seconds since the Autonomia process started serving requests.",
    type: "gauge",
  },
  {
    name: "autonomia_db_up",
    help: "Whether the database answered the latest scrape probe.",
    type: "gauge",
  },
];

const series = new Map<string, number>();
const startedAtMs = performance.now();

function escapeLabelValue(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "\\n");
}

function seriesName(name: string, labels: Record<string, string | number>) {
  const entries = Object.entries(labels);
  if (entries.length === 0) return name;
  entries.sort(([left], [right]) => left.localeCompare(right));
  const rendered = entries.map(([key, value]) => `${key}="${escapeLabelValue(String(value))}"`).join(",");
  return `${name}{${rendered}}`;
}

function record(name: string, labels: Record<string, string | number>, delta: number) {
  const key = seriesName(name, labels);
  series.set(key, (series.get(key) || 0) + delta);
}

export function recordAutonomiaAiRequest(endpoint: string, status: number, durationMs: number) {
  const statusLabel = status > 0 ? String(status) : "unknown";
  record("autonomia_ai_requests_total", { endpoint, status: statusLabel }, 1);
  const durationSeconds = Math.max(0, durationMs) / 1000;
  record("autonomia_ai_request_duration_seconds_sum", { endpoint }, durationSeconds);
  record("autonomia_ai_request_duration_seconds_count", { endpoint }, 1);
}

// AutonomiaBillingSettleInput 的數值欄位接受 number/string/bigint
// (AutonomiaMicrosInput);指標統一正規化為安全整數,不合法值記為 0。
function toSafeCount(value: unknown): number {
  if (typeof value === "bigint") {
    return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : 0;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : 0;
  }
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value;
  return 0;
}

export function recordAutonomiaSettlement(input: {
  inputTokens?: unknown;
  outputTokens?: unknown;
  actualCostMicros?: unknown;
}) {
  const inputTokens = toSafeCount(input.inputTokens);
  if (inputTokens > 0) {
    record("autonomia_ai_tokens_total", { direction: "input" }, inputTokens);
  }
  const outputTokens = toSafeCount(input.outputTokens);
  if (outputTokens > 0) {
    record("autonomia_ai_tokens_total", { direction: "output" }, outputTokens);
  }
  const costMicros = toSafeCount(input.actualCostMicros);
  if (costMicros > 0) {
    record("autonomia_ai_spend_usd_micros_total", {}, costMicros);
  }
}

// 標籤值防護:provider 是設定檔 slug、error_category 是上游錯誤分類字串,
// 一律正規化為 Prometheus 標籤安全字元並截斷——未受控的類別字串(如含
// 任意 UTF-8)會撐爆標籤基數或破壞 exposition 格式。
function metricLabel(value: unknown, maxLength = 64): string {
  const normalized = String(value ?? "")
    .slice(0, maxLength)
    .replace(/[^a-zA-Z0-9_.-]/g, "_");
  return normalized || "unknown";
}

// 每筆上游供應商嘗試結束時計數(failover 健康度的核心觀測:哪家供應商
// 在退避、退多久、錯什麼)。與 ai_provider_attempts 表同口徑——僅在 audit
// 落地成功後由呼叫端記錄;Workers 拓撲計數留在隔離區內不輸出,成本可忽略。
export function recordAutonomiaProviderAttempt(input: {
  provider?: unknown;
  success?: unknown;
  errorCategory?: unknown;
  latencyMs?: unknown;
}) {
  const provider = metricLabel(input.provider);
  const outcome = input.success ? "succeeded" : "failed";
  record("autonomia_provider_attempts_total", { provider, outcome }, 1);
  if (!input.success) {
    record(
      "autonomia_provider_failures_total",
      { provider, error_category: metricLabel(input.errorCategory) },
      1,
    );
  }
  const latencySeconds = Math.max(0, Number(input.latencyMs) || 0) / 1000;
  record("autonomia_provider_attempt_duration_seconds_sum", { provider, outcome }, latencySeconds);
  record("autonomia_provider_attempt_duration_seconds_count", { provider, outcome }, 1);
}

function renderSeries(ready: string[], baseName: string, prefixes: string[]) {
  const matching = [...series.entries()].filter(([key]) =>
    prefixes.some((prefix) => key === prefix || key.startsWith(`${prefix}{`)),
  );
  if (matching.length === 0) return;
  const family = METRIC_FAMILIES.find((candidate) => candidate.name === baseName);
  if (family) {
    ready.push(`# HELP ${family.name} ${family.help}`);
    ready.push(`# TYPE ${family.name} ${family.type}`);
  }
  for (const [key, value] of matching) ready.push(`${key} ${value}`);
}

export function renderAutonomiaPrometheus({ dbUp }: { dbUp: boolean }) {
  const ready: string[] = [];
  for (const family of METRIC_FAMILIES) {
    if (family.name === "autonomia_ai_request_duration_seconds") {
      renderSeries(ready, family.name, [
        "autonomia_ai_request_duration_seconds_sum",
        "autonomia_ai_request_duration_seconds_count",
      ]);
      continue;
    }
    if (family.name === "autonomia_provider_attempt_duration_seconds") {
      renderSeries(ready, family.name, [
        "autonomia_provider_attempt_duration_seconds_sum",
        "autonomia_provider_attempt_duration_seconds_count",
      ]);
      continue;
    }
    renderSeries(ready, family.name, [family.name]);
  }
  ready.push(`# HELP autonomia_up Whether the Autonomia process reports itself as up.`);
  ready.push(`# TYPE autonomia_up gauge`);
  ready.push(`autonomia_up 1`);
  ready.push(
    `# HELP autonomia_process_uptime_seconds Seconds since the Autonomia process started serving requests.`,
  );
  ready.push(`# TYPE autonomia_process_uptime_seconds gauge`);
  ready.push(`autonomia_process_uptime_seconds ${((performance.now() - startedAtMs) / 1000).toFixed(3)}`);
  ready.push(`# HELP autonomia_db_up Whether the database answered the latest scrape probe.`);
  ready.push(`# TYPE autonomia_db_up gauge`);
  ready.push(`autonomia_db_up ${dbUp ? 1 : 0}`);
  ready.push("");
  return ready.join("\n");
}

// /metrics 探針:與 /healthz 相同立場——不屬於 AUTONOMIA_ENABLED fail-closed
// 閘門,但只在 Node 進入點掛載,Workers 部署不暴露。回傳 Hono 相容 handler。
//
// SN-1 fix:/metrics 輸出含端點量、token 用量、消費金額等業務敏感指標,
// 且每次 scrape 觸發一次 DB 探測;原實作無認證、無限流。存取規則:
// 1. AUTONOMIA_METRICS_TOKEN 已設 → 要求 Authorization: Bearer <token>
//    (常數時間比對);不符回 401。
// 2. 未設 token → 僅放行 loopback 來源(本地開發 127.0.0.1 維持可用);
//    其餘回 404(不暴露端點存在)。對外部署必須設 token 或由反向代理
//    遮蔽 /metrics 路徑(部署文件同步要求)。
// 3. 每來源位址每 60 秒最多 12 次 scrape,超過回 429 —— 阻止高頻 scrape
//    作為免認證的 DB 負載源。
const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const METRICS_SCRAPE_WINDOW_MS = 60_000;
const METRICS_SCRAPE_MAX_PER_WINDOW = 12;
const METRICS_SCRAPE_MAX_TRACKED_KEYS = 4096;
const metricsScrapeWindows = new Map<string, { windowStart: number; count: number }>();

export type AutonomiaMetricsAccessVerdict = "allow" | "unauthorized" | "forbidden" | "rate_limited";

export function evaluateMetricsAccess(input: {
  token?: string;
  remoteAddr?: string;
  authorization?: string;
  now?: number;
}): AutonomiaMetricsAccessVerdict {
  const token = String(input?.token || "").trim();
  const remoteAddr = String(input?.remoteAddr || "").trim();
  const authorization = String(input?.authorization || "").trim();
  if (token) {
    const expected = `Bearer ${token}`;
    if (authorization.length !== expected.length) return "unauthorized";
    let diff = 0;
    for (let index = 0; index < expected.length; index += 1) {
      diff |= authorization.charCodeAt(index) ^ expected.charCodeAt(index);
    }
    if (diff !== 0) return "unauthorized";
  } else if (!LOOPBACK_ADDRESSES.has(remoteAddr)) {
    return "forbidden";
  }
  const now = Number.isFinite(input?.now) ? Number(input?.now) : Date.now();
  const key = remoteAddr || "unknown";
  const bucket = metricsScrapeWindows.get(key);
  if (!bucket || now - bucket.windowStart >= METRICS_SCRAPE_WINDOW_MS) {
    // SN-14 fix (audit N1):原本超量時呼叫 clear() 整表清除,與 rateLimit.ts
    // 明確避免的反模式相同——攻擊者可藉觸發桶上限歸零既有計數。改為只淘汰
    // 已過期的桶(窗口已滾出),仍滿時對新身份直接 429(下方 rate_limited
    // 分支),既有計數保持不變。對外公開部署仍建議設 AUTONOMIA_METRICS_TOKEN,
    // 此處只是防禦縱深。
    if (metricsScrapeWindows.size > METRICS_SCRAPE_MAX_TRACKED_KEYS) {
      for (const [existingKey, existingBucket] of metricsScrapeWindows) {
        if (now - existingBucket.windowStart >= METRICS_SCRAPE_WINDOW_MS) {
          metricsScrapeWindows.delete(existingKey);
        }
      }
      if (metricsScrapeWindows.size >= METRICS_SCRAPE_MAX_TRACKED_KEYS) {
        // 仍滿(全在窗口內):對新身份回 429,既有計數保持不變。
        return "rate_limited";
      }
    }
    metricsScrapeWindows.set(key, { windowStart: now, count: 1 });
    return "allow";
  }
  bucket.count += 1;
  if (bucket.count > METRICS_SCRAPE_MAX_PER_WINDOW) return "rate_limited";
  return "allow";
}

// 測試專用:重置模組級 scrapeWindows Map,避免跨測試污染(與 rateLimit.ts
// 的 resetRateLimitsForTests 同一目的)。生產程式碼不應呼叫。
export function resetMetricsScrapeWindowsForTests(): void {
  metricsScrapeWindows.clear();
}

const METRICS_ERROR_BODIES: Record<AutonomiaMetricsAccessVerdict, { status: number; code: string }> = {
  allow: { status: 200, code: "" },
  unauthorized: { status: 401, code: "metrics_token_required" },
  forbidden: { status: 404, code: "not_found" },
  rate_limited: { status: 429, code: "metrics_rate_limited" },
};

export function autonomiaMetricsHandler(probeDatabase: () => Promise<boolean>) {
  return async (c: {
    header: (name: string, value: string) => void;
    req?: { header: (name: string) => string | undefined };
    env?: Record<string, unknown>;
  }) => {
    const env = (c as { env?: Record<string, unknown> }).env;
    const verdict = evaluateMetricsAccess({
      token: String((env?.AUTONOMIA_METRICS_TOKEN as string | undefined) || ""),
      remoteAddr: String((env?.AUTONOMIA_REMOTE_ADDR as string | undefined) || ""),
      authorization: c.req?.header?.("authorization") || "",
    });
    if (verdict !== "allow") {
      const { status, code } = METRICS_ERROR_BODIES[verdict];
      c.header("Cache-Control", "no-store");
      return new Response(JSON.stringify({ error: "Metrics access is protected.", code }), {
        status,
        headers: { "content-type": "application/json" },
      });
    }
    const dbUp = await probeDatabase().catch(() => false);
    c.header("Cache-Control", "no-store");
    return new Response(renderAutonomiaPrometheus({ dbUp }), {
      status: 200,
      headers: { "content-type": "text/plain; version=0.0.4; charset=utf-8" },
    });
  };
}
