import assert from "node:assert/strict";
import test from "node:test";
import {
  autonomiaMetricsHandler,
  evaluateMetricsAccess,
  recordAutonomiaAiRequest,
  recordAutonomiaProviderAttempt,
  recordAutonomiaSettlement,
  renderAutonomiaPrometheus,
  resetMetricsScrapeWindowsForTests,
} from "../src/utils/metrics.ts";

test("metrics render Prometheus text format with labels, sums, and gauges", () => {
  recordAutonomiaAiRequest("chat.completions", 200, 1500);
  recordAutonomiaAiRequest("embeddings", 200, 250);
  recordAutonomiaAiRequest("embeddings", 401, 1);
  recordAutonomiaSettlement({ inputTokens: "120", outputTokens: 8, actualCostMicros: 250 });
  recordAutonomiaSettlement({ inputTokens: 40, outputTokens: 0, actualCostMicros: 100 });

  const body = renderAutonomiaPrometheus({ dbUp: true });
  const lines = body.split("\n");

  assert.ok(lines.includes("# TYPE autonomia_ai_requests_total counter"));
  assert.ok(lines.includes('autonomia_ai_requests_total{endpoint="chat.completions",status="200"} 1'));
  assert.ok(lines.includes('autonomia_ai_requests_total{endpoint="embeddings",status="401"} 1'));
  // 250ms + 1ms 的浮點加總;以正規表達式避免浮點尾數。
  assert.match(body, /autonomia_ai_request_duration_seconds_sum\{endpoint="embeddings"\} 0\.251/);
  assert.ok(lines.includes('autonomia_ai_request_duration_seconds_count{endpoint="embeddings"} 2'));
  assert.ok(lines.includes('autonomia_ai_tokens_total{direction="input"} 160'));
  assert.ok(lines.includes('autonomia_ai_tokens_total{direction="output"} 8'));
  assert.ok(lines.includes("autonomia_ai_spend_usd_micros_total 350"));
  assert.ok(lines.includes("# TYPE autonomia_db_up gauge"));
  assert.ok(lines.includes("autonomia_db_up 1"));
  assert.ok(lines.includes("autonomia_up 1"));
  // 結尾換行:Prometheus 解析器期望最後一行終止。
  assert.ok(body.endsWith("\n"));
});

test("provider attempt metrics record outcome, error category, and latency", () => {
  recordAutonomiaProviderAttempt({ provider: "openrouter", success: true, latencyMs: 1200 });
  recordAutonomiaProviderAttempt({
    provider: "openrouter",
    success: false,
    errorCategory: "upstream_5xx",
    latencyMs: 300,
  });
  recordAutonomiaProviderAttempt({
    provider: "qwencloud",
    success: false,
    errorCategory: "timeout",
    latencyMs: 60_000,
  });
  // 標籤防護:非標籤安全字元正規化為底線、缺值 → unknown、負延遲夾為 0。
  recordAutonomiaProviderAttempt({ success: false, errorCategory: "weird category/值!", latencyMs: -5 });

  const body = renderAutonomiaPrometheus({ dbUp: true });
  const lines = body.split("\n");

  assert.ok(lines.includes("# TYPE autonomia_provider_attempts_total counter"));
  assert.ok(lines.includes('autonomia_provider_attempts_total{outcome="succeeded",provider="openrouter"} 1'));
  assert.ok(lines.includes('autonomia_provider_attempts_total{outcome="failed",provider="openrouter"} 1'));
  assert.ok(lines.includes("# TYPE autonomia_provider_failures_total counter"));
  assert.ok(
    lines.includes(
      'autonomia_provider_failures_total{error_category="upstream_5xx",provider="openrouter"} 1',
    ),
  );
  assert.ok(
    lines.includes('autonomia_provider_failures_total{error_category="timeout",provider="qwencloud"} 1'),
  );
  assert.ok(
    lines.includes(
      'autonomia_provider_failures_total{error_category="weird_category___",provider="unknown"} 1',
    ),
  );
  assert.ok(lines.includes("# TYPE autonomia_provider_attempt_duration_seconds counter"));
  // 浮點加總以正規表達式比對,避免尾數差異。
  assert.match(
    body,
    /autonomia_provider_attempt_duration_seconds_sum\{outcome="succeeded",provider="openrouter"\} 1\.2/,
  );
  assert.match(
    body,
    /autonomia_provider_attempt_duration_seconds_sum\{outcome="failed",provider="openrouter"\} 0\.3/,
  );
  assert.match(
    body,
    /autonomia_provider_attempt_duration_seconds_sum\{outcome="failed",provider="qwencloud"\} 60/,
  );
  assert.ok(
    lines.includes(
      'autonomia_provider_attempt_duration_seconds_count{outcome="failed",provider="openrouter"} 1',
    ),
  );
  assert.ok(
    lines.includes(
      'autonomia_provider_attempt_duration_seconds_count{outcome="succeeded",provider="openrouter"} 1',
    ),
  );
});

test("metrics handler probes the database and serves the exposition format", async () => {
  const handler = autonomiaMetricsHandler(async () => true);
  const headers = new Map<string, string>();
  const response = await handler({
    header: (name: string, value: string) => headers.set(name, value),
    env: { AUTONOMIA_REMOTE_ADDR: "127.0.0.1" },
  });
  assert.equal(response.status, 200);
  assert.equal(headers.get("Cache-Control"), "no-store");
  assert.match(String(response.headers.get("content-type")), /text\/plain/);
  const body = await response.text();
  assert.match(body, /autonomia_db_up 1/);

  const degraded = await autonomiaMetricsHandler(async () => false)({
    header: () => {},
    env: { AUTONOMIA_REMOTE_ADDR: "127.0.0.1" },
  });
  assert.match(await degraded.text(), /autonomia_db_up 0/);
});

test("metrics access control requires a token or a loopback source (SN-1)", async () => {
  const base = { now: 1_000_000 };
  // 未設 token:僅 loopback 放行,外部來源 404(不暴露端點存在)。
  assert.equal(evaluateMetricsAccess({ ...base, remoteAddr: "127.0.0.1" }), "allow");
  assert.equal(evaluateMetricsAccess({ ...base, remoteAddr: "::1" }), "allow");
  assert.equal(evaluateMetricsAccess({ ...base, remoteAddr: "203.0.113.7" }), "forbidden");
  assert.equal(evaluateMetricsAccess({ ...base }), "forbidden");
  // 設了 token:Bearer 比對正確才放行;外部來源 + 有效 token 也放行。
  const token = { token: "metrics-secret-32-chars-long-token!", ...base };
  assert.equal(
    evaluateMetricsAccess({
      ...token,
      remoteAddr: "203.0.113.7",
      authorization: "Bearer metrics-secret-32-chars-long-token!",
    }),
    "allow",
  );
  assert.equal(
    evaluateMetricsAccess({ ...token, remoteAddr: "203.0.113.7", authorization: "Bearer wrong-token" }),
    "unauthorized",
  );
  assert.equal(evaluateMetricsAccess({ ...token, remoteAddr: "203.0.113.7" }), "unauthorized");
  assert.equal(
    evaluateMetricsAccess({
      ...token,
      remoteAddr: "127.0.0.1",
      authorization: "Bearer wrong-token",
    }),
    "unauthorized",
  );
  // 每來源 60 秒視窗最多 12 次 scrape,超過 429。
  let windowStart = 5_000_000;
  let verdict: string = "allow";
  for (let i = 0; i < 13; i += 1) {
    verdict = evaluateMetricsAccess({
      token: "t",
      remoteAddr: "198.51.100.9",
      authorization: "Bearer t",
      now: windowStart,
    });
  }
  assert.equal(verdict, "rate_limited");
  // 下一個視窗恢復。
  windowStart += 61_000;
  assert.equal(
    evaluateMetricsAccess({
      token: "t",
      remoteAddr: "198.51.100.9",
      authorization: "Bearer t",
      now: windowStart,
    }),
    "allow",
  );
  // handler 層的 401/404/429 回應形狀。
  const handler = autonomiaMetricsHandler(async () => true);
  const unauthorized = await handler({
    header: () => {},
    env: { AUTONOMIA_METRICS_TOKEN: "metrics-secret-32-chars-long-token!" },
    req: { header: () => undefined },
  });
  assert.equal(unauthorized.status, 401);
  const forbidden = await handler({
    header: () => {},
    env: { AUTONOMIA_REMOTE_ADDR: "203.0.113.7" },
    req: { header: () => undefined },
  });
  assert.equal(forbidden.status, 404);
});

test("metrics scrape bucket overflow evicts only expired entries (SN-14, audit N1)", () => {
  // 反模式防御:原本超量時呼叫 clear() 整表清除,允許攻擊者藉觸發桶上限
  // 把既有計數歸零。修復後只淘汰已過期的桶,仍滿時對新身份回 429,既有
  // 計數保持不變。本測試釘死此不變量。
  resetMetricsScrapeWindowsForTests();
  const token = { token: "t", authorization: "Bearer t" };
  const baseNow = 10_000_000;
  const freshKey = (i: number) => `198.51.100.${i}`;
  // 容量語意:`size > MAX_TRACKED_KEYS (=4096)` 才觸發淘汰,故可容納至
  // 4097 個並存桶;第 4098 個新身份(仍在窗口內)會觸發淘汰 — 全部都未
  // 過期,淘汰後 size 仍 >= MAX,回 429。本迴圈驗證 1..4097 全部 allow。
  for (let i = 1; i <= 4097; i += 1) {
    const verdict = evaluateMetricsAccess({
      ...token,
      remoteAddr: freshKey(i),
      now: baseNow,
    });
    assert.equal(verdict, "allow", `bucket ${i} should be allowed while under capacity`);
  }
  // 第 4098 個新身份(仍在窗口內)應被 429:所有桶都未過期,淘汰後
  // size 仍 >= MAX,既有計數保持不變(不被歸零)。
  assert.equal(evaluateMetricsAccess({ ...token, remoteAddr: "203.0.113.99", now: baseNow }), "rate_limited");
  // 既有身份的計數仍可讀(允許 retry):立即再呼叫同一既有身份,其
  // windowStart 仍在窗口內、count=1 → 2 < 12,應為 allow。
  assert.equal(evaluateMetricsAccess({ ...token, remoteAddr: freshKey(1), now: baseNow }), "allow");
  // 推進時間到所有桶過期後,新身份應可再度進入(淘汰已過期桶,釋出空間)。
  const later = baseNow + 61_000;
  assert.equal(evaluateMetricsAccess({ ...token, remoteAddr: "203.0.113.99", now: later }), "allow");
  // 重置以避免影響後續測試。
  resetMetricsScrapeWindowsForTests();
});
