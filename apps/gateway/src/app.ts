import { Hono } from "hono";
import { createAutonomiaPublicCorsMiddleware, createCorsMiddleware } from "./middleware/cors.ts";
import { aiDeveloperRoutes } from "./routes/aiDeveloper.ts";
import { aiPublicRoutes } from "./routes/aiPublic.ts";
import { authRoutes, requireCsrfToken, requireTrustedOrigin } from "./routes/auth.ts";
import type { AutonomiaContext, AutonomiaEnv, AutonomiaNext, AutonomiaRuntimeEnv } from "./types.ts";
import { sendOpenAiError } from "./utils/aiErrors.ts";
import { dbQuery } from "./utils/db.ts";
import { logAutonomiaEvent } from "./utils/logger.ts";

// AUTONOMIA_ENABLED 是 fail-closed 開關:未明確設為 'true' 時,
// 所有 Autonomia 路由(公開推理 + 開發者管理面)一律回 404,不暴露存在。
function autonomiaEnabled(env: AutonomiaRuntimeEnv): boolean {
  return (
    String(env?.AUTONOMIA_ENABLED || "")
      .trim()
      .toLowerCase() === "true"
  );
}

function createAutonomiaGate(env: AutonomiaRuntimeEnv) {
  return async (c: AutonomiaContext, next: AutonomiaNext) => {
    if (!autonomiaEnabled(env)) {
      c.header("Cache-Control", "no-store");
      return c.json(
        {
          error: "Autonomia is not enabled on this deployment.",
          code: "route_not_found",
        },
        404,
      );
    }
    await next();
  };
}

export function createApp(env: AutonomiaRuntimeEnv = {}) {
  const app = new Hono<AutonomiaEnv>();

  app.use("*", createCorsMiddleware());

  // /healthz 是維運探針,不受 AUTONOMIA_ENABLED fail-closed 閘門管轄:
  // 負載平衡器/監控需要它即使服務尚未啟用也能分辨「活著但未就緒」。
  // DB 探測失敗(或 adapter 未安裝)回 503 degraded,成功回 200 ok。
  app.get("/healthz", async (c: AutonomiaContext) => {
    let database: "ok" | "unavailable" = "unavailable";
    try {
      await dbQuery(c.env, "SELECT 1 AS ok");
      database = "ok";
    } catch {
      // adapter 未安裝(單元測試/進入點未初始化)或資料庫無法連線。
    }
    c.header("Cache-Control", "no-store");
    return c.json(
      {
        status: database === "ok" ? "ok" : "degraded",
        database,
        time: new Date().toISOString(),
      },
      database === "ok" ? 200 : 503,
    );
  });

  // SN-7 fix:AUTONOMIA_ENABLED fail-closed 閘門原本只涵蓋 /api/ai/*,
  // 服務轉暗時註冊(含每帳號贈點)仍開放 —— 濫用面。auth 端點一律納入
  // 閘門管轄:未啟用時與 API 相同回 404,不暴露存在。
  app.use("/api/auth/*", createAutonomiaGate(env));
  app.route("/api/auth", authRoutes);

  app.use("/api/ai/*", createAutonomiaGate(env));
  app.use("/api/ai/v1/*", createAutonomiaPublicCorsMiddleware());
  // SN-15 fix (audit N2):開發者管理面原本只掛 requireCsrfToken(雙提交
  // cookie),與 /api/auth/* 的 requireTrustedOrigin 防禦縱深不一致。瀏覽器
  // 對非簡單請求會 preflight,CORS 拒絕時擋下實際請求;但若未來新增簡單
  // content-type 的 mutating 路由、或 CORS 設定錯誤,CSRF token 會是唯一
  // 防線。補上 requireTrustedOrigin,與 auth 採同一份 origin 白名單邏輯
  // (requireTrustedOrigin 對缺 Origin/Referer 的非瀏覽器呼叫放行,不影響
  // curl/SDK 客戶端)。
  app.use("/api/ai/developer/*", requireTrustedOrigin);
  app.use("/api/ai/developer/*", requireCsrfToken);

  app.route("/api/ai/v1", aiPublicRoutes);
  app.route("/api/ai/developer", aiDeveloperRoutes);

  app.notFound((c) => c.json({ error: "Not found.", code: "not_found" }, 404));

  app.onError((error, c) => {
    if (c.req.path.startsWith("/api/ai/")) {
      const requestId = c.get("aiRequestId");
      return sendOpenAiError(c, error, typeof requestId === "string" ? requestId : "");
    }
    logAutonomiaEvent("error", "gateway_request_failed", {
      method: c.req.method,
      path: c.req.path,
      errorName: (error as Error)?.name || "unknown",
      errorMessage: (error as Error)?.message || "",
    });
    return c.json({ error: "Internal server error.", code: "internal_error" }, 500);
  });

  return app;
}
