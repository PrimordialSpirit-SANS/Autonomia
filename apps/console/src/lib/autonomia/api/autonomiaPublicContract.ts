import { type TranslationKey, t } from "../../../i18n/core";
import type {
  AutonomiaLogsPage,
  AutonomiaPublicErrorCode,
  AutonomiaRequestDetail,
  AutonomiaRequestStatus,
  AutonomiaStreamChoice,
  AutonomiaStreamChunk,
  AutonomiaUsageLog,
  AutonomiaUsageSummary,
} from "../types";

type AutonomiaErrorContext = "developer" | "inference" | "stream";

interface NormalizeErrorOptions {
  status?: number;
  context?: AutonomiaErrorContext;
  fallbackCode?: AutonomiaPublicErrorCode;
}

export interface NormalizedAutonomiaError {
  code: AutonomiaPublicErrorCode;
  message: string;
}

// 錯誤代碼 → i18n 鍵:顯示文字由 t() 依當前語系產生(見 src/i18n)。
const ERROR_MESSAGE_KEYS = Object.freeze({
  invalid_request: "errors.invalid_request",
  unsupported_parameter: "errors.unsupported_parameter",
  unsupported_feature: "errors.unsupported_feature",
  invalid_api_key: "errors.invalid_api_key",
  authentication_required: "errors.authentication_required",
  insufficient_scope: "errors.insufficient_scope",
  access_denied: "errors.access_denied",
  model_not_found: "errors.model_not_found",
  model_not_allowed: "errors.model_not_allowed",
  spend_limit_exceeded: "errors.spend_limit_exceeded",
  insufficient_balance: "errors.insufficient_balance",
  free_quota_exceeded: "errors.free_quota_exceeded",
  rate_limit_exceeded: "errors.rate_limit_exceeded",
  max_in_flight_exceeded: "errors.max_in_flight_exceeded",
  request_cancelled: "errors.request_cancelled",
  service_unavailable: "errors.service_unavailable",
  request_failed: "errors.request_failed",
  not_found: "errors.not_found",
  conflict: "errors.conflict",
  connection_error: "errors.connection_error",
  invalid_response: "errors.invalid_response",
  invalid_stream_payload: "errors.invalid_stream_payload",
  invalid_stream_response: "errors.invalid_stream_response",
  stream_interrupted: "errors.stream_interrupted",
  stream_truncated: "errors.stream_truncated",
  AI_KEY_LIMIT: "errors.AI_KEY_LIMIT",
  INVALID_AI_KEY_OPTIONS: "errors.INVALID_AI_KEY_OPTIONS",
  AI_KEY_UNAVAILABLE: "errors.AI_KEY_UNAVAILABLE",
  INVALID_AI_KEY_ID: "errors.INVALID_AI_KEY_ID",
  AI_KEY_NOT_FOUND: "errors.AI_KEY_NOT_FOUND",
  INVALID_AI_USAGE_QUERY: "errors.INVALID_AI_USAGE_QUERY",
  AI_USAGE_UNAVAILABLE: "errors.AI_USAGE_UNAVAILABLE",
  USER_NOT_FOUND: "errors.USER_NOT_FOUND",
  AI_REQUEST_NOT_FOUND: "errors.AI_REQUEST_NOT_FOUND",
} satisfies Record<AutonomiaPublicErrorCode, TranslationKey>);

const REQUEST_STATUSES = new Set<AutonomiaRequestStatus>([
  "pending_reservation",
  "reserved",
  "dispatched",
  "succeeded",
  "partially_succeeded",
  "rejected",
  "refunded",
  "needs_reconciliation",
  "replayed",
]);

const FINISH_REASONS = new Set(["stop", "length", "content_filter"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.hasOwn(record, key);
}

function knownErrorCode(value: unknown): AutonomiaPublicErrorCode | null {
  if (typeof value !== "string") return null;
  const code = value.trim();
  if (!code || code.length > 100) return null;
  if (hasOwn(ERROR_MESSAGE_KEYS, code)) return code as AutonomiaPublicErrorCode;

  return null;
}

function payloadErrorCode(payload: unknown): unknown {
  if (!isRecord(payload)) return null;
  if (isRecord(payload.error)) return payload.error.code;
  return payload.code;
}

function statusErrorCode(status: number, context: AutonomiaErrorContext): AutonomiaPublicErrorCode {
  if (status === 400 || status === 422) return "invalid_request";
  if (status === 401) {
    return context === "developer" ? "authentication_required" : "invalid_api_key";
  }
  if (status === 402) return "insufficient_balance";
  if (status === 403) {
    return context === "developer" ? "access_denied" : "service_unavailable";
  }
  if (status === 404) return context === "developer" ? "not_found" : "model_not_found";
  if (status === 408) return "request_cancelled";
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limit_exceeded";
  if (status >= 500) return "service_unavailable";
  return "request_failed";
}

export function normalizeAutonomiaError(
  payload: unknown,
  options: NormalizeErrorOptions = {},
): NormalizedAutonomiaError {
  const status = Number.isInteger(options.status) ? Number(options.status) : 0;
  const context = options.context ?? "inference";
  const code =
    knownErrorCode(payloadErrorCode(payload)) ?? options.fallbackCode ?? statusErrorCode(status, context);
  return { code, message: t(ERROR_MESSAGE_KEYS[code]) };
}

export function normalizeAutonomiaUsageErrorCode(value: unknown): AutonomiaPublicErrorCode | null {
  if (value === null || value === undefined || value === "") return null;
  return knownErrorCode(value) ?? "request_failed";
}

export function hasAutonomiaErrorEnvelope(payload: unknown): boolean {
  if (!isRecord(payload)) return false;
  if (hasOwn(payload, "error") && payload.error !== null && payload.error !== undefined) {
    return true;
  }
  return typeof payload.message === "string" && hasOwn(payload, "code");
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function requestStatus(value: unknown): AutonomiaRequestStatus {
  return typeof value === "string" && REQUEST_STATUSES.has(value as AutonomiaRequestStatus)
    ? (value as AutonomiaRequestStatus)
    : "rejected";
}

function normalizeUsageLog(value: unknown): AutonomiaUsageLog {
  const record = isRecord(value) ? value : {};
  const requestedModel = text(record.requested_model);
  return {
    request_id: text(record.request_id),
    created_at: text(record.created_at),
    api_key_id: nullableText(record.api_key_id),
    key_name: nullableText(record.key_name),
    requested_model: requestedModel,
    actual_model: requestedModel,
    provider: "autonomia",
    status: requestStatus(record.status),
    input_tokens: number(record.input_tokens),
    output_tokens: number(record.output_tokens),
    total_tokens: number(record.total_tokens),
    reserved_usd: String(number(record.reserved_usd)),
    charged_usd: String(number(record.charged_usd)),
    refunded_usd: String(number(record.refunded_usd)),
    latency_ms: nullableNumber(record.latency_ms),
    error_code: normalizeAutonomiaUsageErrorCode(record.error_code),
    replay_of_request_id: nullableText(record.replay_of_request_id),
  };
}

export function normalizeAutonomiaUsageSummary(value: unknown): AutonomiaUsageSummary {
  const record = isRecord(value) ? value : {};
  const freeModelQuotas = isRecord(record.free_model_quotas) ? record.free_model_quotas : {};
  const normalizedFreeModelQuotas = Object.fromEntries(
    Object.entries(freeModelQuotas).flatMap(([modelId, quota]) => {
      if (!isRecord(quota)) return [];
      return [[modelId, { used: number(quota.used), limit: number(quota.limit) }]];
    }),
  );
  return {
    balance_usd: String(number(record.balance_usd)),
    requests: number(record.requests),
    succeeded: number(record.succeeded),
    failed: number(record.failed),
    input_tokens: number(record.input_tokens),
    output_tokens: number(record.output_tokens),
    total_tokens: number(record.total_tokens),
    charged_usd: String(number(record.charged_usd)),
    period_days: number(record.period_days),
    free_model_quotas: normalizedFreeModelQuotas,
  };
}

export function normalizeAutonomiaLogsPage(value: unknown): AutonomiaLogsPage {
  const record = isRecord(value) ? value : {};
  const pagination = isRecord(record.pagination) ? record.pagination : {};
  return {
    logs: Array.isArray(record.logs) ? record.logs.map(normalizeUsageLog) : [],
    pagination: {
      next_cursor: nullableText(pagination.next_cursor),
      has_more: pagination.has_more === true,
    },
  };
}

export function normalizeAutonomiaRequestDetail(value: unknown): AutonomiaRequestDetail {
  const record = isRecord(value) ? value : {};
  return {
    ...normalizeUsageLog(record),
    completed_at: nullableText(record.completed_at),
    pricing_revision: nullableText(record.pricing_revision),
    fallback_count: 0,
    first_token_latency_ms: nullableNumber(record.first_token_latency_ms),
  };
}

function normalizeStreamChoice(value: unknown, fallbackIndex: number): AutonomiaStreamChoice | null {
  if (!isRecord(value)) return null;
  const delta = isRecord(value.delta) ? value.delta : {};
  const index = Number(value.index);
  const finishReason: AutonomiaStreamChoice["finish_reason"] =
    typeof value.finish_reason === "string"
      ? FINISH_REASONS.has(value.finish_reason)
        ? (value.finish_reason as Exclude<AutonomiaStreamChoice["finish_reason"], null>)
        : "stop"
      : null;
  return {
    index: Number.isSafeInteger(index) && index >= 0 ? index : fallbackIndex,
    delta: {
      ...(delta.role === "assistant" ? { role: "assistant" } : {}),
      ...(typeof delta.content === "string" || delta.content === null ? { content: delta.content } : {}),
      ...(typeof delta.reasoning === "string" || delta.reasoning === null
        ? { reasoning: delta.reasoning }
        : {}),
      ...(typeof delta.reasoning_content === "string" || delta.reasoning_content === null
        ? { reasoning_content: delta.reasoning_content }
        : {}),
    },
    finish_reason: finishReason,
  };
}

export function normalizeAutonomiaStreamChunk(value: unknown): AutonomiaStreamChunk {
  const record = isRecord(value) ? value : {};
  const choices = Array.isArray(record.choices)
    ? record.choices
        .map(normalizeStreamChoice)
        .filter((choice): choice is AutonomiaStreamChoice => choice !== null)
    : [];
  const usageRecord = isRecord(record.usage) ? record.usage : null;
  const promptTokens = nullableNumber(usageRecord?.prompt_tokens);
  const completionTokens = nullableNumber(usageRecord?.completion_tokens);
  const totalTokens = nullableNumber(usageRecord?.total_tokens);
  const details = isRecord(usageRecord?.completion_tokens_details)
    ? usageRecord.completion_tokens_details
    : null;
  const reasoningTokens = details?.reasoning_tokens;
  const reasoningDetails =
    typeof reasoningTokens === "number" &&
    Number.isSafeInteger(reasoningTokens) &&
    reasoningTokens >= 0 &&
    completionTokens !== null &&
    reasoningTokens <= completionTokens
      ? { reasoning_tokens: reasoningTokens }
      : null;
  const usage =
    usageRecord && promptTokens !== null && completionTokens !== null && totalTokens !== null
      ? {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: totalTokens,
          ...(reasoningDetails ? { completion_tokens_details: reasoningDetails } : {}),
        }
      : null;
  return { choices, usage };
}
