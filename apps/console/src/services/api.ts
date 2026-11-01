// 平台整合接縫:console 邏輯層(lib/autonomia)所有 API 呼叫的底層。
// 原始平台在此提供 JWT 會話、CSRF 與外部 API base;本獨立版以同源 cookie session
// 加上環境變數設定重現相同契約。

// FN-10 fix:`??` 換成 `||` —— 環境變數設為空字串時(對照 .env.example
// 「留空時使用同源的 /api」),`??` 不會放行 fallback,所有請求打到錯誤的
// /auth/* 路徑;`||` 讓空字串正確退回同源 /api。
const API_BASE = (import.meta.env.VITE_AUTONOMIA_API_BASE || "/api").replace(/\/+$/, "");

// SN-16 fix (audit N5):原本 name 直接插值進入 RegExp 建構式,若 name 含
// RegExp 中繼字元(如 .、*、+、?、(、)、[、]、{、}、^、$、|、\\)會匹配
// 到非預期的 cookie 或丟出例外。目前所有呼叫端都用硬編碼字串
// (csrf_token、XSRF-TOKEN)無中繼字元,實際安全;但這是防禦縱深缺口——
// 逸出後即使未來傳入使用者或 URL 控制的名稱也不會破壞 regex。
function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readCookie(name: string): string | null {
  const pattern = new RegExp(`(?:^|;\\s*)${escapeRegexLiteral(name)}=([^;]*)`);
  const match = document.cookie.match(pattern);
  return match ? decodeURIComponent(match[1]) : null;
}

// F-01 fix:跨主機(同站)拓撲下,host-only 的 csrf_token cookie 設在閘道主機
// 上,本頁面的 document.cookie 讀不到。向 GET /auth/csrf 以帶憑證請求
// 取得 token(瀏覽器會把同站 cookie 帶上;回應僅 FRONTEND_ORIGINS 內的
// 來源可讀)。以模組級 promise 去重;403 csrf_token_invalid 時失效重取
// (登出後重新登入會換發新 token)。
let csrfTokenPromise: Promise<string | null> | null = null;

function fetchCsrfToken(): Promise<string | null> {
  if (!csrfTokenPromise) {
    csrfTokenPromise = fetch(`${API_BASE}/auth/csrf`, { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: unknown) => {
        const token = (body as { token?: unknown } | null)?.token;
        return typeof token === "string" && token.length > 0 ? token : null;
      })
      .catch(() => null);
  }
  return csrfTokenPromise;
}

function invalidateCsrfTokenCache() {
  csrfTokenPromise = null;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const method = (init.method ?? "GET").toUpperCase();
  let usedFetchedToken = false;
  if (method !== "GET" && method !== "HEAD") {
    let csrf = readCookie("csrf_token") ?? readCookie("XSRF-TOKEN");
    if (!csrf) {
      csrf = await fetchCsrfToken();
      usedFetchedToken = csrf !== null;
    }
    if (csrf && !headers.has("X-CSRF-Token")) {
      headers.set("X-CSRF-Token", csrf);
    }
  }
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: "include" });
  // 僅對 csrf_token_invalid 重試:此 403 由中介層在路由處理前產生,動作
  // 保證未執行,重試安全;其他 403(授權、Origin 閘門)原樣回傳。
  if (response.status === 403 && usedFetchedToken) {
    let code: string | null = null;
    try {
      code = (((await response.clone().json()) as { code?: unknown })?.code as string) ?? null;
    } catch {
      code = null;
    }
    if (code === "csrf_token_invalid") {
      invalidateCsrfTokenCache();
      const fresh = await fetchCsrfToken();
      if (fresh) {
        const retryHeaders = new Headers(init.headers);
        retryHeaders.set("X-CSRF-Token", fresh);
        return fetch(`${API_BASE}${path}`, { ...init, headers: retryHeaders, credentials: "include" });
      }
    }
  }
  return response;
}

export function getExternalDeveloperApiBase(): string {
  const configured = import.meta.env.VITE_AUTONOMIA_PUBLIC_API_BASE;
  if (configured) return configured.replace(/\/+$/, "");
  return window.location.origin;
}
