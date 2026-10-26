import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { AutonomiaIcon } from "../components/AutonomiaIcon";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useI18n } from "../i18n";
import {
  AutonomiaAuthError,
  loginAutonomiaAccount,
  registerAutonomiaAccount,
} from "../lib/autonomia/api/autonomiaAuthApi";
import type { AutonomiaConsoleUser } from "../lib/autonomia/types";

// 登入/註冊二合一頁。成功後寫入 session context 並導向控制台。

type AuthMode = "login" | "register";

export function LoginPage({ onAuthenticated }: { onAuthenticated: (user: AutonomiaConsoleUser) => void }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [mode, setMode] = React.useState<AuthMode>("login");
  const [email, setEmail] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const user =
        mode === "login"
          ? await loginAutonomiaAccount(email, password)
          : await registerAutonomiaAccount(email, username, password);
      if (!user) {
        // 防枚舉回應(gateway 回 202 受理但不發 session):無法區分信箱是否
        // 已被註冊,引導使用者改走登入。
        setNotice(t("login.acceptedNotice"));
        setMode("login");
        return;
      }
      onAuthenticated(user);
      navigate("/overview", { replace: true });
    } catch (cause) {
      setError(cause instanceof AutonomiaAuthError ? cause.message : t("errors.authRequestFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <section className="card auth-card">
        <div className="auth-brand">
          <AutonomiaIcon size={40} />
          <h1>{t("login.title")}</h1>
          <p>{mode === "login" ? t("login.subtitleLogin") : t("login.subtitleRegister")}</p>
        </div>
        <form className="auth-form" onSubmit={submit}>
          <label className="field">
            <span>{t("login.email")}</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              required
            />
          </label>
          {mode === "register" && (
            <label className="field">
              <span>{t("login.username")}</span>
              <input
                className="input"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                minLength={2}
                maxLength={40}
                autoComplete="username"
                placeholder={t("login.usernamePlaceholder")}
                required
              />
            </label>
          )}
          <label className="field">
            <span>{t("login.password")}</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder={mode === "login" ? "" : t("login.passwordPlaceholder")}
              minLength={mode === "register" ? 8 : undefined}
              required
            />
          </label>
          {notice && (
            <div className="alert alert-info">
              <span>{notice}</span>
            </div>
          )}
          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          )}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy
              ? t("login.submitting")
              : mode === "login"
                ? t("login.submitLogin")
                : t("login.submitRegister")}
          </button>
        </form>
        <p className="auth-switch">
          {mode === "login" ? t("login.noAccount") : t("login.haveAccount")}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
              setNotice("");
            }}
          >
            {mode === "login" ? t("login.registerCta") : t("login.loginCta")}
          </button>
        </p>
        <p className="auth-switch">
          <Link to="/home">{t("login.backHome")}</Link>
        </p>
        <div className="auth-switch auth-lang">
          <LanguageSwitcher />
        </div>
      </section>
    </div>
  );
}
