import { apiFetch } from "../../../services/api";
import type { AutonomiaConsoleUser } from "../types";

// 內建帳號系統的會話客戶端。gateway 的 /api/auth/* 回應是第一方訊息,
// 錯誤文字可直接顯示(與公開推理面的「不信任上游訊息」原則不同)。

interface AuthError {
  code: string;
  message: string;
}

async function readAuthError(response: Response): Promise<AuthError> {
  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  return {
    code: String(payload?.error?.code || "request_failed"),
    message: String(payload?.error || "") || "操作失敗,請稍後再試。",
  };
}

export class AutonomiaAuthError extends Error {
  readonly code: string;

  constructor(error: AuthError) {
    super(error.message);
    this.name = "AutonomiaAuthError";
    this.code = error.code;
  }
}

export async function fetchAutonomiaSession(signal?: AbortSignal): Promise<AutonomiaConsoleUser | null> {
  let response: Response;
  try {
    response = await apiFetch("/auth/me", { signal });
  } catch (cause) {
    if (cause instanceof Error && cause.name === "AbortError") throw cause;
    throw new AutonomiaAuthError({
      code: "connection_error",
      message: "無法連線至伺服器,請確認 gateway 狀態。",
    });
  }
  if (response.status === 401) return null;
  if (!response.ok) throw new AutonomiaAuthError(await readAuthError(response));
  const payload = await response.json();
  return (payload?.user as AutonomiaConsoleUser) ?? null;
}

export async function loginAutonomiaAccount(email: string, password: string): Promise<AutonomiaConsoleUser> {
  const response = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new AutonomiaAuthError(await readAuthError(response));
  const payload = await response.json();
  return payload.user as AutonomiaConsoleUser;
}

export async function registerAutonomiaAccount(
  email: string,
  username: string,
  password: string,
): Promise<AutonomiaConsoleUser | null> {
  const response = await apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, username, password }),
  });
  if (!response.ok) throw new AutonomiaAuthError(await readAuthError(response));
  const payload = await response.json();
  // 防帳號枚舉部署下,重複信箱回 202 {ok, message} 而非使用者物件;
  // 回 null 由 UI 引導改走登入(回應不揭露信箱是否已被註冊)。
  return (payload?.user as AutonomiaConsoleUser | undefined) ?? null;
}

export async function logoutAutonomiaAccount(): Promise<void> {
  await apiFetch("/auth/logout", { method: "POST" });
}
