import { apiFetch, getExternalDeveloperApiBase } from "../../../services/api";
import type {
  AutonomiaApiKey,
  AutonomiaKeyCreateOptions,
  AutonomiaKeyMutationResult,
  AutonomiaLogsPage,
  AutonomiaLogsQuery,
  AutonomiaPublicErrorCode,
  AutonomiaRequestDetail,
  AutonomiaUsageSummary,
} from "../types";
import {
  normalizeAutonomiaError,
  normalizeAutonomiaLogsPage,
  normalizeAutonomiaRequestDetail,
  normalizeAutonomiaUsageSummary,
} from "./autonomiaPublicContract";

const DEVELOPER_ROOT = "/ai/developer";

export class AutonomiaApiError extends Error {
  readonly status: number;
  readonly code: AutonomiaPublicErrorCode | null;

  constructor(message: string, status: number, code: AutonomiaPublicErrorCode | null = null) {
    super(message);
    this.name = "AutonomiaApiError";
    this.status = status;
    this.code = code;
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const error = normalizeAutonomiaError(payload, {
      status: response.status,
      context: "developer",
    });
    throw new AutonomiaApiError(error.message, response.status, error.code);
  }

  if (payload === null) {
    const error = normalizeAutonomiaError(null, { fallbackCode: "invalid_response" });
    throw new AutonomiaApiError(error.message, response.status, error.code);
  }

  return payload as T;
}

function isAbortError(cause: unknown): boolean {
  return typeof cause === "object" && cause !== null && "name" in cause && cause.name === "AbortError";
}

async function developerFetch(path: string, init: RequestInit): Promise<Response> {
  try {
    return await apiFetch(`${DEVELOPER_ROOT}${path}`, init);
  } catch (cause) {
    if (init.signal?.aborted || isAbortError(cause)) throw cause;
    const error = normalizeAutonomiaError(null, { fallbackCode: "connection_error" });
    throw new AutonomiaApiError(error.message, 0, error.code);
  }
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await developerFetch(path, {
    ...init,
    headers,
  });
  return readJson<T>(response);
}

export function getAutonomiaPublicApiRoot(): string {
  const base = getExternalDeveloperApiBase()
    .replace(/\/$/, "")
    .replace(/\/api$/, "");
  return `${base}/api/ai/v1`;
}

export function getAutonomiaChatCompletionsUrl(): string {
  return `${getAutonomiaPublicApiRoot()}/chat/completions`;
}

export function getAutonomiaAccountChatCompletionsPath(): string {
  return `${DEVELOPER_ROOT}/chat/completions`;
}

export async function listAutonomiaKeys(signal?: AbortSignal): Promise<AutonomiaApiKey[]> {
  const payload = await requestJson<{ keys: AutonomiaApiKey[] }>("/keys", { signal });
  return payload.keys;
}

export async function createAutonomiaKey(
  options: AutonomiaKeyCreateOptions,
): Promise<AutonomiaKeyMutationResult> {
  return requestJson<AutonomiaKeyMutationResult>("/keys", {
    method: "POST",
    body: JSON.stringify(options),
  });
}

export async function rotateAutonomiaKey(id: string): Promise<AutonomiaKeyMutationResult> {
  return requestJson<AutonomiaKeyMutationResult>(`/keys/${encodeURIComponent(id)}/rotate`, {
    method: "POST",
  });
}

export async function revokeAutonomiaKey(id: string): Promise<void> {
  const response = await developerFetch(`/keys/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    await readJson<never>(response);
  }
}

export async function getAutonomiaUsageSummary(signal?: AbortSignal): Promise<AutonomiaUsageSummary> {
  const payload = await requestJson<{ usage: AutonomiaUsageSummary }>("/usage/summary", { signal });
  return normalizeAutonomiaUsageSummary(payload?.usage);
}

export async function listAutonomiaLogs(
  query: AutonomiaLogsQuery,
  signal?: AbortSignal,
): Promise<AutonomiaLogsPage> {
  const params = new URLSearchParams();
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.limit) params.set("limit", String(query.limit));
  if (query.model) params.set("model", query.model);
  if (query.status) params.set("status", query.status);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  const suffix = params.size ? `?${params.toString()}` : "";
  const payload = await requestJson<unknown>(`/logs${suffix}`, { signal });
  return normalizeAutonomiaLogsPage(payload);
}

export async function getAutonomiaRequestDetail(
  requestId: string,
  signal?: AbortSignal,
): Promise<AutonomiaRequestDetail> {
  const payload = await requestJson<unknown>(`/requests/${encodeURIComponent(requestId)}`, { signal });
  return normalizeAutonomiaRequestDetail(payload);
}
