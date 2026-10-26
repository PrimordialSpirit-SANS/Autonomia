import { t } from "../../../i18n/core";
import { apiFetch } from "../../../services/api";
import type {
  AutonomiaChatMessage,
  AutonomiaChatUsage,
  AutonomiaPublicErrorCode,
  AutonomiaStreamChunk,
} from "../types";
import {
  getAutonomiaAccountChatCompletionsPath,
  getAutonomiaChatCompletionsUrl,
} from "./autonomiaDeveloperApi";
import {
  hasAutonomiaErrorEnvelope,
  normalizeAutonomiaError,
  normalizeAutonomiaStreamChunk,
} from "./autonomiaPublicContract";
import { consumeSseEventsToDone, type ParsedSseEvent, readSseEvents } from "./sseEventParser";

export interface AutonomiaStreamDeltaEvent {
  content: string;
  reasoning: string;
  elapsedMs: number;
}

export interface AutonomiaStreamMetrics {
  headersLatencyMs: number;
  firstDeltaLatencyMs: number | null;
  firstContentLatencyMs: number | null;
  totalLatencyMs: number;
}

export interface AutonomiaStreamResult {
  content: string;
  reasoning: string;
  usage: AutonomiaChatUsage | null;
  finishReason: string | null;
  requestId: string | null;
  metrics: AutonomiaStreamMetrics;
}

export interface StreamAutonomiaChatOptions {
  authMode?: "api-key" | "account";
  apiKey?: string;
  model: string;
  messages: AutonomiaChatMessage[];
  maxCompletionTokens: number;
  thinking?: boolean;
  signal?: AbortSignal;
  onDelta?: (event: AutonomiaStreamDeltaEvent) => void;
  onUsage?: (usage: AutonomiaChatUsage) => void;
}

export class AutonomiaStreamError extends Error {
  readonly status: number;
  readonly code: AutonomiaPublicErrorCode | null;
  readonly requestId: string | null;

  constructor(
    message: string,
    options: {
      status?: number;
      code?: AutonomiaPublicErrorCode | null;
      requestId?: string | null;
    } = {},
  ) {
    super(message);
    this.name = "AutonomiaStreamError";
    this.status = options.status ?? 0;
    this.code = options.code ?? null;
    this.requestId = options.requestId ?? null;
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return;
  if (signal.reason instanceof Error) throw signal.reason;
  throw new DOMException("The request was aborted.", "AbortError");
}

async function httpError(
  response: Response,
  signal?: AbortSignal,
  context: "developer" | "inference" = "inference",
): Promise<AutonomiaStreamError> {
  const requestId = response.headers.get("x-request-id");
  let text = "";
  try {
    text = await response.text();
  } catch {
    throwIfAborted(signal);
    // The status code remains available even if the error body is unreadable.
  }
  throwIfAborted(signal);

  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  const error = normalizeAutonomiaError(payload, {
    status: response.status,
    context,
  });
  return new AutonomiaStreamError(error.message, {
    status: response.status,
    code: error.code,
    requestId,
  });
}

function parseEventPayload(event: ParsedSseEvent, requestId: string | null): AutonomiaStreamChunk {
  let payload: unknown;
  try {
    payload = JSON.parse(event.data);
  } catch {
    throw new AutonomiaStreamError(t("errors.invalid_stream_payload"), {
      code: "invalid_stream_payload",
      requestId,
    });
  }

  if (event.type === "error" || hasAutonomiaErrorEnvelope(payload)) {
    const error = normalizeAutonomiaError(payload, {
      context: "stream",
      fallbackCode: "stream_interrupted",
    });
    throw new AutonomiaStreamError(error.message, {
      code: error.code,
      requestId,
    });
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new AutonomiaStreamError(t("errors.unsupportedStreamData"), {
      code: "invalid_stream_payload",
      requestId,
    });
  }
  return normalizeAutonomiaStreamChunk(payload);
}

export async function streamAutonomiaChat(
  options: StreamAutonomiaChatOptions,
): Promise<AutonomiaStreamResult> {
  const authMode = options.authMode || "api-key";
  const apiKey = options.apiKey?.trim() || "";
  if (authMode === "api-key" && !apiKey) {
    throw new AutonomiaStreamError(t("errors.enterApiKey"), { code: "invalid_request" });
  }
  if (!options.model) throw new AutonomiaStreamError(t("errors.chooseModel"), { code: "invalid_request" });
  if (!options.messages.some((message) => message.content.trim())) {
    throw new AutonomiaStreamError(t("errors.enterMessage"), { code: "invalid_request" });
  }

  throwIfAborted(options.signal);
  const startedAt = performance.now();
  const requestBody: Record<string, unknown> = {
    model: options.model,
    messages: options.messages,
    stream: true,
    stream_options: { include_usage: true },
    max_completion_tokens: Math.max(1, Math.trunc(options.maxCompletionTokens)),
    // FN-10 fix:thinking 選項此前被接受但從未序列化(靜默 no-op);後端
    // 現已真實支援 {thinking: boolean}(FN-4),前端把它帶進請求體。
    ...(options.thinking === undefined ? {} : { chat_template_kwargs: { thinking: options.thinking } }),
  };

  let response: Response;
  try {
    const headers: Record<string, string> = {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
    };
    if (authMode === "api-key") headers.Authorization = `Bearer ${apiKey}`;

    const request = authMode === "account" ? apiFetch : fetch;
    const endpoint =
      authMode === "account" ? getAutonomiaAccountChatCompletionsPath() : getAutonomiaChatCompletionsUrl();
    response = await request(endpoint, {
      method: "POST",
      headers,
      credentials: authMode === "account" ? "include" : "omit",
      body: JSON.stringify(requestBody),
      signal: options.signal,
    });
  } catch {
    throwIfAborted(options.signal);
    const error = normalizeAutonomiaError(null, { fallbackCode: "connection_error" });
    throw new AutonomiaStreamError(error.message, { code: error.code });
  }

  const headersLatencyMs = performance.now() - startedAt;
  if (!response.ok) {
    throw await httpError(response, options.signal, authMode === "account" ? "developer" : "inference");
  }

  const requestId = response.headers.get("x-request-id");
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  if (!response.body || !contentType.includes("text/event-stream")) {
    await response.body?.cancel().catch(() => {});
    throw new AutonomiaStreamError(t("errors.streamNoSse"), {
      status: response.status,
      code: "invalid_stream_response",
      requestId,
    });
  }

  let content = "";
  let reasoning = "";
  let usage: AutonomiaChatUsage | null = null;
  let finishReason: string | null = null;
  let firstDeltaLatencyMs: number | null = null;
  let firstContentLatencyMs: number | null = null;
  let sawDone = false;
  try {
    sawDone = await consumeSseEventsToDone(readSseEvents(response.body, options.signal), (event) => {
      const payload = parseEventPayload(event, requestId);
      if (payload.usage) {
        usage = payload.usage;
        options.onUsage?.(payload.usage);
      }

      for (const choice of payload.choices || []) {
        const delta = choice.delta || {};
        const contentDelta = typeof delta.content === "string" ? delta.content : "";
        const reasoningDelta =
          typeof delta.reasoning === "string"
            ? delta.reasoning
            : typeof delta.reasoning_content === "string"
              ? delta.reasoning_content
              : "";

        if (choice.finish_reason) finishReason = choice.finish_reason;
        if (!contentDelta && !reasoningDelta) continue;

        const elapsedMs = performance.now() - startedAt;
        if (firstDeltaLatencyMs === null) firstDeltaLatencyMs = elapsedMs;
        if (contentDelta && firstContentLatencyMs === null) {
          firstContentLatencyMs = elapsedMs;
        }
        content += contentDelta;
        reasoning += reasoningDelta;
        options.onDelta?.({
          content: contentDelta,
          reasoning: reasoningDelta,
          elapsedMs,
        });
      }
    });
  } catch (cause) {
    throwIfAborted(options.signal);
    if (cause instanceof AutonomiaStreamError) throw cause;
    const error = normalizeAutonomiaError(null, { fallbackCode: "stream_interrupted" });
    throw new AutonomiaStreamError(error.message, {
      code: error.code,
      requestId,
    });
  }

  throwIfAborted(options.signal);
  if (!sawDone) {
    throw new AutonomiaStreamError(t("errors.stream_truncated"), {
      code: "stream_truncated",
      requestId,
    });
  }

  return {
    content,
    reasoning,
    usage,
    finishReason,
    requestId,
    metrics: {
      headersLatencyMs,
      firstDeltaLatencyMs,
      firstContentLatencyMs,
      totalLatencyMs: performance.now() - startedAt,
    },
  };
}
