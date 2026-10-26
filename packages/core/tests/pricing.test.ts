import assert from "node:assert/strict";
import test from "node:test";

import {
  BACKEND_PRICING,
  calculateActualCostMicros,
  calculateActualCostMicrosBigInt,
  calculateReservationCostMicros,
  createBillingSnapshot,
  getModelPricing,
  listCandidateRoutes,
  listEnabledModels,
  parseUsdToMicros,
  requireModelPricing,
} from "../src/pricing.ts";

const GPT_6_ASTRA = "autonomia/gpt-6-astra";
const GPT_61_SOL = "autonomia/gpt-6.1-sol";
const GPT_53_CODEX = "autonomia/gpt-5.3-codex";
const CLAUDE_FABLE_51 = "autonomia/claude-fable-5-1";
const CLAUDE_OPUS_55 = "autonomia/claude-opus-5-5";
const QWEN_38_27B = "autonomia/qwen-3.8-27b";
const QWEN_38_FLASH = "autonomia/qwen-3.8-flash";

function createSyntheticModel(billing: any) {
  return {
    billing,
    limits: {
      context_tokens: 10,
      max_input_tokens: 5,
      default_max_completion_tokens: 1,
      max_completion_tokens: 5,
    },
  };
}

test("canonical pricing exposes only enabled public models", () => {
  assert.deepEqual(
    listEnabledModels().map((model) => model.id),
    [
      GPT_6_ASTRA,
      GPT_61_SOL,
      GPT_53_CODEX,
      CLAUDE_FABLE_51,
      CLAUDE_OPUS_55,
      "autonomia/claude-sonnet-5-5",
      "autonomia/claude-haiku-5-5",
      "autonomia/gemini-4-argon",
      "autonomia/gemini-3.8-flash",
      "autonomia/gemini-3.5-flash-lite",
      "autonomia/grok-4.7",
      "autonomia/grok-4.3",
      "autonomia/deepseek-v4-pro",
      "autonomia/deepseek-v4.1-flash",
      "autonomia/kimi-k3",
      "autonomia/glm-5.3",
      "autonomia/glm-5.3-flash",
      "autonomia/qwen-3.8-max",
      QWEN_38_FLASH,
      QWEN_38_27B,
      "autonomia/text-embedding-3-small",
      "autonomia/text-embedding-3-large",
    ],
  );
  assert.equal(getModelPricing(GPT_6_ASTRA), BACKEND_PRICING.models[GPT_6_ASTRA]);
  assert.equal(getModelPricing(GPT_61_SOL), BACKEND_PRICING.models[GPT_61_SOL]);
  assert.equal(getModelPricing(GPT_53_CODEX), BACKEND_PRICING.models[GPT_53_CODEX]);
  assert.equal(getModelPricing(CLAUDE_FABLE_51), BACKEND_PRICING.models[CLAUDE_FABLE_51]);
  assert.equal(getModelPricing(QWEN_38_27B), BACKEND_PRICING.models[QWEN_38_27B]);
  assert.equal(getModelPricing("autonomia/unknown"), null);
  assert.throws(() => requireModelPricing("autonomia/unknown"), {
    name: "RangeError",
    message: "Unknown or disabled Autonomia model: autonomia/unknown",
  });
});

test("USD billing is exact to micro-USD, rounds up once, and applies the minimum charge", () => {
  // 0 tokens 仍收最低消費 $0.0001 = 100 µUSD
  assert.equal(calculateActualCostMicros(QWEN_38_FLASH, 0, 0), 100);
  // 1M in ($0.15) + 0.5M out ($0.24) = $0.39 = 390000 µUSD,無須進位
  assert.equal(calculateActualCostMicros(QWEN_38_FLASH, 1_000_000, 500_000), 390000);

  const model = createSyntheticModel({
    input_usd_per_million_tokens: "0.40",
    output_usd_per_million_tokens: "0.40",
    minimum_charge_usd: "0",
  });
  // 1 token × $0.40/1M = 0.4 µUSD,單次向上取整到 1 µUSD
  assert.equal(calculateActualCostMicros(model, 1, 1), 1);
  assert.throws(
    () =>
      calculateActualCostMicros(
        createSyntheticModel({
          input_usd_per_million_tokens: "0.1234567",
          output_usd_per_million_tokens: "0.40",
          minimum_charge_usd: "0",
        }),
        1,
        1,
      ),
    { name: "TypeError" },
  );
});

test("USD rates pass through upstream provider prices exactly", () => {
  for (const [modelId, inputUsd, outputUsd] of [
    ["autonomia/qwen-3.8-max", "2.01", "6.00"],
    [QWEN_38_FLASH, "0.15", "0.48"],
    ["autonomia/glm-5.3", "1.41", "4.41"],
    ["autonomia/kimi-k3", "3.00", "15.00"],
    ["autonomia/deepseek-v4.1-flash", "0.15", "0.60"],
    ["autonomia/deepseek-v4-pro", "1.32", "3.96"],
  ] as const) {
    assert.equal(calculateActualCostMicros(modelId, 1_000_000, 0), Number(parseUsdToMicros(inputUsd)));
    assert.equal(calculateActualCostMicros(modelId, 0, 1_000_000), Number(parseUsdToMicros(outputUsd)));
    assert.equal(calculateActualCostMicros(modelId, 1, 1), 100);
  }
});

test("BigInt billing remains exact beyond Number.MAX_SAFE_INTEGER", () => {
  const model = createSyntheticModel({
    input_usd_per_million_tokens: "3.00",
    output_usd_per_million_tokens: "7.00",
    minimum_charge_usd: "0",
  });

  // 1e18 tokens × $3.00/1M = $3e12 = 3e18 µUSD
  assert.equal(calculateActualCostMicrosBigInt(model, "1000000000000000000", "0"), 3000000000000000000n);
  assert.throws(() => calculateActualCostMicros(model, "10000000000000000000000", "0"), {
    name: "RangeError",
    message: "The calculated cost exceeds Number.MAX_SAFE_INTEGER micro-USD.",
  });
});

test("reservation billing uses the configured default and enforces model limits", () => {
  const model = requireModelPricing(QWEN_38_27B);
  assert.equal(
    calculateReservationCostMicros(QWEN_38_27B, 10_000),
    calculateReservationCostMicros(QWEN_38_27B, 10_000, model.limits.default_max_completion_tokens),
  );
  assert.throws(
    () => calculateReservationCostMicros(QWEN_38_27B, model.limits.max_input_tokens + 1, 1),
    /Estimated input tokens exceed the model input limit/,
  );
  assert.throws(
    () => calculateReservationCostMicros(QWEN_38_27B, 1, model.limits.max_completion_tokens + 1),
    /Requested output tokens exceed the model output limit/,
  );
});

test("billing snapshots are auditable and candidate routes are priority ordered", () => {
  const snapshot = createBillingSnapshot(QWEN_38_27B);
  assert.deepEqual(snapshot, {
    pricing_revision: BACKEND_PRICING.revision,
    model: QWEN_38_27B,
    currency: { ...BACKEND_PRICING.currency },
    billing: { ...BACKEND_PRICING.models[QWEN_38_27B].billing },
    limits: { ...BACKEND_PRICING.models[QWEN_38_27B].limits },
  });
  assert.deepEqual(
    listCandidateRoutes(QWEN_38_27B).map((route) => route.route_id),
    ["qwen-3.8-27b-cloudflare"],
  );
});

test("GPT-6 Astra bills its documented USD rate via the OpenAI route", () => {
  assert.equal(calculateActualCostMicros(GPT_6_ASTRA, 1_000_000, 1_000_000), 60010000);
  assert.deepEqual(
    listCandidateRoutes(GPT_6_ASTRA).map((route) => route.upstream_model),
    ["gpt-6-astra"],
  );
});

test("GPT-6.1 Sol bills its documented USD rate via the OpenAI route", () => {
  assert.equal(calculateActualCostMicros(GPT_61_SOL, 1_000_000, 1_000_000), 12010000);
  assert.deepEqual(
    listCandidateRoutes(GPT_61_SOL).map((route) => route.upstream_model),
    ["gpt-6.1-sol"],
  );
});

test("GPT-5.3 Codex exposes its dedicated OpenAI coding route", () => {
  assert.equal(calculateActualCostMicros(GPT_53_CODEX, 1_000_000, 1_000_000), 15760000);
  assert.deepEqual(
    listCandidateRoutes(GPT_53_CODEX).map((route) => route.upstream_model),
    ["gpt-5.3-codex"],
  );
});

test("Claude Fable 5.1 keeps its official Anthropic route", () => {
  assert.equal(calculateActualCostMicros(CLAUDE_FABLE_51, 1_000_000, 1_000_000), 60010000);
  assert.deepEqual(
    listCandidateRoutes(CLAUDE_FABLE_51).map((route) => route.upstream_model),
    ["claude-fable-5-1"],
  );
});

test("Gemini 4 Argon bills through the official Gemini API route", () => {
  assert.equal(calculateActualCostMicros("autonomia/gemini-4-argon", 1_000_000, 1_000_000), 12010000);
  assert.deepEqual(
    listCandidateRoutes("autonomia/gemini-4-argon").map((route) => route.upstream_model),
    ["gemini-4-argon"],
  );
});

test("Grok 4.7 bills through the official xAI route", () => {
  assert.equal(calculateActualCostMicros("autonomia/grok-4.7", 1_000_000, 1_000_000), 8010000);
  assert.deepEqual(
    listCandidateRoutes("autonomia/grok-4.7").map((route) => route.upstream_model),
    ["grok-4.7"],
  );
});

test("DeepSeek V4 Pro falls back from the official API to QwenCloud", () => {
  assert.equal(calculateActualCostMicros("autonomia/deepseek-v4-pro", 1_000_000, 1_000_000), 5280000);
  assert.deepEqual(
    listCandidateRoutes("autonomia/deepseek-v4-pro").map((route) => route.route_id),
    ["deepseek-v4-pro-deepseek", "deepseek-v4-pro-qwencloud"],
  );
});

test("Kimi K3 falls back from Moonshot AI to QwenCloud", () => {
  assert.equal(calculateActualCostMicros("autonomia/kimi-k3", 1_000_000, 1_000_000), 18000000);
  assert.deepEqual(
    listCandidateRoutes("autonomia/kimi-k3").map((route) => route.route_id),
    ["kimi-k3-moonshot", "kimi-k3-qwencloud"],
  );
});

test("GLM-5.3 falls back from Z.ai to QwenCloud", () => {
  assert.equal(calculateActualCostMicros("autonomia/glm-5.3", 1_000_000, 1_000_000), 5820000);
  assert.deepEqual(
    listCandidateRoutes("autonomia/glm-5.3").map((route) => route.route_id),
    ["glm-5.3-zhipu", "glm-5.3-qwencloud"],
  );
});

test("Qwen 3.8 27B exposes its separate paid Cloudflare route", () => {
  assert.equal(calculateActualCostMicros(QWEN_38_27B, 1_000_000, 1_000_000), 3420000);
  assert.deepEqual(
    listCandidateRoutes(QWEN_38_27B).map((route) => route.upstream_model),
    ["@cf/qwen/qwen3.8-27b"],
  );
});
