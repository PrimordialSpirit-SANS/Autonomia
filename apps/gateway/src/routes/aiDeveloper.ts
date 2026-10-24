import { isAutonomiaServiceRestricted, parseAutonomiaKeyId } from "@autonomia/core/apiKeys";
import { Hono } from "hono";
import { createRateLimit } from "../middleware/rateLimit.ts";
import type { AutonomiaContext, AutonomiaEnv, AutonomiaNext } from "../types.ts";
import {
  createAutonomiaApiKey,
  ensureAutonomiaSessionCredential,
  listAutonomiaApiKeys,
  revokeAutonomiaApiKey,
  rotateAutonomiaApiKey,
} from "../utils/aiApiKeys.ts";
import { AutonomiaError, sendOpenAiError } from "../utils/aiErrors.ts";
import {
  getAutonomiaUsageDetail,
  getAutonomiaUsageSummary,
  listAutonomiaUsageLogs,
} from "../utils/aiUsage.ts";
import { logAutonomiaEvent } from "../utils/logger.ts";
import { readJsonObject } from "../utils/request.ts";
import { handleAutonomiaChatCompletions } from "./aiPublic.ts";
import { authenticateToken } from "./auth.ts";

export const aiDeveloperRoutes = new Hono<AutonomiaEnv>();
const keyManagementLimiter = createRateLimit({
  keyPrefix: "autonomia-key-management",
  windowMs: 15 * 60 * 1000,
  max: 120,
  keyGenerator: (c) => String(c.get("user")?.id || "unknown"),
});

function sendKeyError(c: AutonomiaContext, error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === "AI_KEY_LIMIT") {
    return c.json({ error: (error as Error).message, code: "AI_KEY_LIMIT" }, 409);
  }
  if (error instanceof TypeError) {
    return c.json(
      {
        error: (error as Error).message,
        code: code || "INVALID_AI_KEY_CONFIGURATION",
      },
      400,
    );
  }
  if (code === "AUTONOMIA_API_KEY_PEPPER_INVALID") {
    return c.json(
      {
        error: "Autonomia key management is temporarily unavailable.",
        code: "AI_KEY_CONFIGURATION_UNAVAILABLE",
      },
      503,
    );
  }
  const name = (error as { name?: string })?.name;
  logAutonomiaEvent("error", "autonomia_key_management_failed", { errorCode: code || name || "unknown" });
  return c.json(
    {
      error: "Autonomia key management is temporarily unavailable.",
      code: "AI_KEY_MANAGEMENT_UNAVAILABLE",
    },
    503,
  );
}

function sendUsageError(c: AutonomiaContext, error: unknown) {
  if (error instanceof TypeError) {
    return c.json({ error: (error as Error).message, code: "INVALID_AI_USAGE_QUERY" }, 400);
  }
  const code = (error as { code?: string })?.code;
  const name = (error as { name?: string })?.name;
  logAutonomiaEvent("error", "autonomia_usage_query_failed", { errorCode: code || name || "unknown" });
  return c.json(
    {
      error: "Autonomia usage data is temporarily unavailable.",
      code: "AI_USAGE_UNAVAILABLE",
    },
    503,
  );
}

aiDeveloperRoutes.use("*", authenticateToken);
aiDeveloperRoutes.use("*", async (c: AutonomiaContext, next: AutonomiaNext) => {
  c.header("Cache-Control", "no-store");
  c.header("Pragma", "no-cache");
  if (isAutonomiaServiceRestricted(c.get("user"))) {
    return c.json(
      {
        error: "Access denied: Autonomia is restricted for this account.",
        code: "SERVICE_RESTRICTED",
      },
      403,
    );
  }
  await next();
});

// 與公開掛載點(/api/ai/v1/chat/completions)相同,主控台的 chat 端點也必須
// 檢查 scope。session 憑證目前一律授予完整 scope,但若未來出現受限憑證,
// 此處不會靜默放行(防禦縱深)。
aiDeveloperRoutes.post("/chat/completions", async (c: AutonomiaContext) => {
  const aiKey = await ensureAutonomiaSessionCredential(c.env, c.get("user")!);
  if (!aiKey?.scopes?.includes("chat:completions")) {
    return sendOpenAiError(
      c,
      new AutonomiaError("The API key does not grant this operation.", {
        status: 403,
        type: "permission_error",
        code: "insufficient_scope",
      }),
      c.get("aiRequestId"),
    );
  }
  return handleAutonomiaChatCompletions(c, aiKey);
});

aiDeveloperRoutes.use("*", keyManagementLimiter);

aiDeveloperRoutes.get("/keys", async (c: AutonomiaContext) => {
  try {
    const keys = await listAutonomiaApiKeys(c.env, c.get("user")!.id);
    return c.json({ keys });
  } catch (error) {
    return sendKeyError(c, error);
  }
});

aiDeveloperRoutes.post("/keys", async (c: AutonomiaContext) => {
  try {
    const created = await createAutonomiaApiKey(c.env, c.get("user")!.id, await readJsonObject(c));
    const { secret, ...key } = created;
    return c.json({ key, api_key: secret }, 201);
  } catch (error) {
    return sendKeyError(c, error);
  }
});

aiDeveloperRoutes.post("/keys/:id/rotate", async (c: AutonomiaContext) => {
  const keyId = parseAutonomiaKeyId(c.req.param("id"));
  if (!keyId) {
    return c.json({ error: "Invalid Autonomia key ID.", code: "INVALID_AI_KEY_ID" }, 400);
  }
  try {
    const rotated = await rotateAutonomiaApiKey(c.env, c.get("user")!.id, keyId);
    if (!rotated) {
      return c.json({ error: "Autonomia key not found.", code: "AI_KEY_NOT_FOUND" }, 404);
    }
    const { secret, ...key } = rotated;
    return c.json({ key, api_key: secret });
  } catch (error) {
    return sendKeyError(c, error);
  }
});

aiDeveloperRoutes.delete("/keys/:id", async (c: AutonomiaContext) => {
  const keyId = parseAutonomiaKeyId(c.req.param("id"));
  if (!keyId) {
    return c.json({ error: "Invalid Autonomia key ID.", code: "INVALID_AI_KEY_ID" }, 400);
  }
  try {
    await revokeAutonomiaApiKey(c.env, c.get("user")!.id, keyId);
    return c.body(null, 204);
  } catch (error) {
    return sendKeyError(c, error);
  }
});

aiDeveloperRoutes.get("/usage/summary", async (c: AutonomiaContext) => {
  try {
    const usage = await getAutonomiaUsageSummary(c.env, c.get("user")!.id);
    if (!usage) return c.json({ error: "Account not found.", code: "USER_NOT_FOUND" }, 404);
    return c.json({ usage });
  } catch (error) {
    return sendUsageError(c, error);
  }
});

aiDeveloperRoutes.get("/logs", async (c: AutonomiaContext) => {
  try {
    return c.json(
      await listAutonomiaUsageLogs(c.env, c.get("user")!.id, {
        cursor: c.req.query("cursor"),
        limit: c.req.query("limit"),
        model: c.req.query("model"),
        status: c.req.query("status"),
        from: c.req.query("from"),
        to: c.req.query("to"),
        keyId: c.req.query("key_id"),
      }),
    );
  } catch (error) {
    return sendUsageError(c, error);
  }
});

aiDeveloperRoutes.get("/requests/:requestId", async (c: AutonomiaContext) => {
  try {
    const detail = await getAutonomiaUsageDetail(c.env, c.get("user")!.id, c.req.param("requestId"));
    if (!detail) {
      return c.json({ error: "Autonomia request not found.", code: "AI_REQUEST_NOT_FOUND" }, 404);
    }
    return c.json(detail);
  } catch (error) {
    return sendUsageError(c, error);
  }
});
