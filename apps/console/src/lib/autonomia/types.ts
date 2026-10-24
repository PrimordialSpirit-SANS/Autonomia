export type AutonomiaProviderId =
  | "cloudflare"
  | "openrouter"
  | "huggingface"
  | "qwencloud"
  | "openai"
  | "anthropic"
  | "google"
  | "xai"
  | "groq"
  | "mistral"
  | "deepseek"
  | "together"
  | "fireworks"
  | "cerebras"
  | "perplexity"
  | "cohere"
  | "moonshot"
  | "zhipu"
  | "minimax"
  | "nvidia"
  | "deepinfra"
  | "sambanova"
  | "lambda"
  | "friendli"
  | "baichuan"
  | "stepfun"
  | "hunyuan"
  | "spark"
  | "ernie"
  | "ai21"
  | "amazon-bedrock"
  | "azure-openai"
  | "scaleway"
  | "ovhcloud"
  | "custom";

export type AutonomiaRequestStatus =
  | "pending_reservation"
  | "reserved"
  | "dispatched"
  | "succeeded"
  | "partially_succeeded"
  | "rejected"
  | "refunded"
  | "needs_reconciliation"
  | "replayed";

export type AutonomiaPublicErrorCode =
  | "invalid_request"
  | "unsupported_parameter"
  | "unsupported_feature"
  | "invalid_api_key"
  | "authentication_required"
  | "insufficient_scope"
  | "access_denied"
  | "model_not_found"
  | "model_not_allowed"
  | "spend_limit_exceeded"
  | "insufficient_balance"
  | "free_quota_exceeded"
  | "rate_limit_exceeded"
  | "max_in_flight_exceeded"
  | "request_cancelled"
  | "service_unavailable"
  | "request_failed"
  | "not_found"
  | "conflict"
  | "connection_error"
  | "invalid_response"
  | "invalid_stream_payload"
  | "invalid_stream_response"
  | "stream_interrupted"
  | "stream_truncated"
  | "AI_KEY_LIMIT"
  | "INVALID_AI_KEY_OPTIONS"
  | "AI_KEY_UNAVAILABLE"
  | "INVALID_AI_KEY_ID"
  | "AI_KEY_NOT_FOUND"
  | "INVALID_AI_USAGE_QUERY"
  | "AI_USAGE_UNAVAILABLE"
  | "USER_NOT_FOUND"
  | "AI_REQUEST_NOT_FOUND";

export type AutonomiaChatRole = "system" | "user" | "assistant";

export interface AutonomiaChatMessage {
  role: AutonomiaChatRole;
  content: string;
}

export interface AutonomiaChatUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  completion_tokens_details?: {
    reasoning_tokens: number;
  };
}

export interface AutonomiaStreamDelta {
  role?: "assistant";
  content?: string | null;
  reasoning?: string | null;
  reasoning_content?: string | null;
}

export interface AutonomiaStreamChoice {
  index: number;
  delta: AutonomiaStreamDelta;
  finish_reason: "stop" | "length" | "content_filter" | null;
}

export interface AutonomiaStreamChunk {
  choices: AutonomiaStreamChoice[];
  usage: AutonomiaChatUsage | null;
}

export interface AutonomiaApiKey {
  id: string;
  name: string;
  environment?: "live" | "test";
  key_prefix: string;
  key_suffix: string;
  scopes: string[];
  model_allowlist: string[] | null;
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  revoked_at: string | null;
  rpm_limit?: number;
  max_in_flight?: number;
  spend_limit_usd?: string | null;
  spend_used_usd: string;
  idempotency_replay_ttl_seconds?: number;
}

export interface AutonomiaKeyCreateOptions {
  name: string;
  expires_at?: string | null;
  spend_limit_usd?: string | null;
  idempotency_replay_ttl_seconds?: number;
}

export interface AutonomiaKeyMutationResult {
  key: AutonomiaApiKey;
  api_key: string;
}

export interface AutonomiaFreeModelQuota {
  used: number;
  limit: number;
}

export interface AutonomiaUsageSummary {
  balance_usd: string;
  requests: number;
  succeeded: number;
  failed: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  charged_usd: string;
  period_days: number;
  free_model_quotas: Record<string, AutonomiaFreeModelQuota>;
}

export interface AutonomiaUsageLog {
  request_id: string;
  created_at: string;
  api_key_id: string | null;
  key_name: string | null;
  requested_model: string;
  actual_model: string;
  provider: "autonomia";
  status: AutonomiaRequestStatus;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  reserved_usd: string;
  charged_usd: string;
  refunded_usd: string;
  latency_ms: number | null;
  error_code: AutonomiaPublicErrorCode | null;
  replay_of_request_id: string | null;
}

export interface AutonomiaRequestDetail extends AutonomiaUsageLog {
  completed_at: string | null;
  pricing_revision: string | null;
  fallback_count: 0;
  first_token_latency_ms: number | null;
}

export interface AutonomiaLogsPage {
  logs: AutonomiaUsageLog[];
  pagination: {
    next_cursor: string | null;
    has_more: boolean;
  };
}

export interface AutonomiaLogsQuery {
  cursor?: string | null;
  limit?: number;
  model?: string;
  status?: string;
  from?: string;
  to?: string;
}

export type BrandAssetStatus = "official-remote-reference" | "official-download" | "permission-required";

export interface AutonomiaBrandAsset {
  id: string;
  kind: "provider" | "model-owner";
  name: string;
  display_asset_url: string | null;
  official_asset_url: string;
  source_page_url: string;
  status: BrandAssetStatus;
  fallback_label: string;
  attribution: string;
}

export interface AutonomiaBrandManifest {
  schema_version: 1;
  updated_at: string;
  assets: AutonomiaBrandAsset[];
}

export interface AutonomiaModel {
  id: string;
  display_name: string;
  owner: string;
  owner_brand_asset_id: string;
  description: string;
  status: "available" | "preview" | "maintenance";
  capabilities: string[];
  input_modalities: string[];
  output_modalities: string[];
  context_window_tokens: number;
  max_output_tokens: number;
  provider_ids: AutonomiaProviderId[];
  tags: string[];
  official_docs_url: string;
  billing: {
    input_usd_per_million_tokens: string;
    output_usd_per_million_tokens: string;
    minimum_charge_usd: string;
    monthly_request_limit?: number;
  };
}

export interface AutonomiaModelsCatalog {
  schema_version: 1;
  pricing_revision: string;
  updated_at: string;
  billing_disclaimer: string;
  models: AutonomiaModel[];
}

export interface AutonomiaProviderOffering {
  id: string;
  model_id: string;
  provider_id: AutonomiaProviderId;
  provider_name: string;
  brand_asset_id: string;
  status: "available" | "degraded" | "maintenance";
  input_usd_per_million_tokens: string;
  output_usd_per_million_tokens: string;
  minimum_charge_usd: string;
  capabilities: string[];
  official_docs_url: string;
  note: string;
}

export interface AutonomiaProviderOfferingsCatalog {
  schema_version: 1;
  pricing_revision: string;
  effective_at: string;
  updated_at: string;
  currency: "autonomia_point";
  billing_unit: "per_million_tokens";
  offerings: AutonomiaProviderOffering[];
}

export interface AutonomiaConsoleUser {
  id: string;
  username: string;
  email: string;
  display_name: string;
  role: string;
  balance_usd: string;
}
