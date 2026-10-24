import assert from "node:assert/strict";
import test from "node:test";
import { digestAutonomiaApiKey, generateAutonomiaApiKey } from "../../../apps/gateway/src/utils/aiApiKeys.ts";
import {
  isAutonomiaApiKey,
  isAutonomiaServiceRestricted,
  maskAutonomiaApiKey,
  normalizeAutonomiaKeyOptions,
  parseAutonomiaKeyId,
  serializeAutonomiaApiKey,
} from "../src/apiKeys.ts";

const TEST_PEPPER = "test-only-autonomia-pepper-with-at-least-32-bytes";

test("Hono backend generates opaque Autonomia keys", () => {
  for (const key of [generateAutonomiaApiKey("live"), generateAutonomiaApiKey("test")]) {
    assert.equal(isAutonomiaApiKey(key), true);
    assert.equal(key.includes("="), false);
  }
});

test("Hono backend derives deterministic HMAC digests", async () => {
  const secret = "sk-autonomia-live_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnop";
  const digest = await digestAutonomiaApiKey({}, secret, TEST_PEPPER);
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.equal(digest, await digestAutonomiaApiKey({}, secret, TEST_PEPPER));
  assert.notEqual(digest, await digestAutonomiaApiKey({}, secret, `${TEST_PEPPER}-other`));
});

test("key options are strict, bounded, and model-aware", () => {
  const expiresAt = new Date(Date.now() + 2 * 60 * 60_000).toISOString();
  const clean = normalizeAutonomiaKeyOptions(
    {
      name: " Production ",
      environment: "live",
      model_allowlist: ["autonomia/model-a", "autonomia/model-a"],
      rpm_limit: 120,
      max_in_flight: 8,
      spend_limit_usd: "500.00",
      expires_at: expiresAt,
    },
    ["autonomia/model-a"],
  );

  assert.deepEqual(clean, {
    name: "Production",
    environment: "live",
    modelAllowlist: ["autonomia/model-a"],
    rpmLimit: 120,
    maxInFlight: 8,
    spendLimitUsdMicros: 500000000,
    expiresAt,
    idempotencyReplayTtlSeconds: 0,
  });
  // 冪等重放 TTL:0-604800 秒(7 天),非整數或超界一律拒絕。
  assert.equal(
    normalizeAutonomiaKeyOptions({ name: "Replay", idempotency_replay_ttl_seconds: 3600 })
      .idempotencyReplayTtlSeconds,
    3600,
  );
  assert.throws(
    () => normalizeAutonomiaKeyOptions({ name: "Replay", idempotency_replay_ttl_seconds: 604801 }),
    /idempotency_replay_ttl_seconds/,
  );
  assert.throws(
    () => normalizeAutonomiaKeyOptions({ name: "Replay", idempotency_replay_ttl_seconds: 1.5 }),
    /idempotency_replay_ttl_seconds/,
  );
  assert.throws(() => normalizeAutonomiaKeyOptions({ name: "" }), /1 to 80/);
  assert.throws(() => normalizeAutonomiaKeyOptions({ name: "bad", rpm_limit: 1.5 }), /rpm_limit/);
  assert.throws(
    () =>
      normalizeAutonomiaKeyOptions({ name: "bad", model_allowlist: ["autonomia/unknown"] }, [
        "autonomia/model-a",
      ]),
    /Unknown or disabled/,
  );
  assert.throws(() => normalizeAutonomiaKeyOptions({ name: "bad", extra: true }), /Unsupported/);
  assert.equal(
    normalizeAutonomiaKeyOptions({ name: "Zero budget", spend_limit_usd: "0.00" }).spendLimitUsdMicros,
    0,
  );
  assert.throws(
    () =>
      normalizeAutonomiaKeyOptions({
        name: "Too soon",
        expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
      }),
    /at least 1 hour/,
  );
});

test("key IDs preserve PostgreSQL BIGINT precision", () => {
  assert.equal(parseAutonomiaKeyId("1"), "1");
  assert.equal(parseAutonomiaKeyId("9223372036854775807"), "9223372036854775807");
  assert.equal(parseAutonomiaKeyId("9223372036854775808"), null);
  assert.equal(parseAutonomiaKeyId("01"), null);
  assert.equal(parseAutonomiaKeyId("1.5"), null);
});

test("developer metadata never serializes a full secret", () => {
  const secret = generateAutonomiaApiKey();
  const mask = maskAutonomiaApiKey(secret);
  const metadata: any = serializeAutonomiaApiKey({
    id: "9007199254740993",
    name: "CI",
    environment: "test",
    key_prefix: mask.key_prefix,
    key_suffix: mask.key_suffix,
    scopes: '["models:read"]',
    model_allowlist: "[]",
    rpm_limit: 60,
    max_in_flight: 4,
    spend_limit_usd_micros: null,
    spend_used_usd_micros: 25,
    is_active: true,
    expires_at: null,
    last_used_at: null,
    rotated_at: null,
    revoked_at: null,
    created_at: "2026-07-11T00:00:00Z",
  });

  assert.equal(metadata.id, "9007199254740993");
  assert.equal(metadata.key_prefix, mask.key_prefix);
  assert.equal(metadata.key_suffix, mask.key_suffix);
  assert.equal(metadata.spend_used_usd, "0.000025");
  assert.equal(JSON.stringify(metadata).includes(secret), false);
  assert.equal("secret" in metadata, false);
});

test("service restriction aliases cover parent and canonical Autonomia links", () => {
  assert.equal(
    isAutonomiaServiceRestricted({
      is_flagged: true,
      restricted_services: '["/Developer"]',
    }),
    true,
  );
  assert.equal(
    isAutonomiaServiceRestricted({
      is_flagged: true,
      restricted_services: ["/Developer/ai-api"],
    }),
    true,
  );
  assert.equal(
    isAutonomiaServiceRestricted({
      is_flagged: false,
      restricted_services: ["/Developer/ai-api"],
    }),
    false,
  );
});
