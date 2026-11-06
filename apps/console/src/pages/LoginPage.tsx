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

type AuthMode = "login" | "register";

export function LoginPage({ onAuthenticated }: { onAuthenticated: (user: AutonomiaConsoleUser) => void }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [mode, setMode] = React.useState<AuthMode>("login");
  const [email, setEmail] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
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
        // 202 防枚舉回應不揭露信箱是否已註冊，統一引導登入。
        setNotice(t("login.acceptedNotice"));
        setMode("login");
        setShowPassword(false);
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
    <div className="login-page">
      <header className="login-topbar">
        <Link className="login-brand" to="/home">
          <AutonomiaIcon size={28} />
          <strong>Autonomia</strong>
        </Link>
        <div className="login-topbar-actions">
          <Link className="login-back" to="/home">
            {t("login.backHome")}
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="login-layout">
        <section className="login-intro" aria-labelledby="login-workspace-title">
          <p className="login-eyebrow">{t("login.title")}</p>
          <h2 id="login-workspace-title">
            <span>{t("login.workspaceLead")}</span>
            <span>{t("login.workspaceEm")}</span>
          </h2>
          <p className="login-description">{t("login.workspaceDescription")}</p>
          <div className="login-emblem" aria-hidden="true">
            <AutonomiaIcon size={180} />
          </div>
        </section>

        <section className="login-panel" aria-labelledby="login-title">
          <div className="login-panel-heading">
            <h1 id="login-title">{mode === "login" ? t("login.submitLogin") : t("login.submitRegister")}</h1>
            <p>{mode === "login" ? t("login.subtitleLogin") : t("login.subtitleRegister")}</p>
          </div>
          <form className="login-form" onSubmit={submit} aria-labelledby="login-title" aria-busy={busy}>
            <fieldset className="login-fields" disabled={busy}>
              <label className="login-field">
                <span>{t("login.email")}</span>
                <input
                  className="login-input"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="you@example.com"
                  required
                />
              </label>
              {mode === "register" && (
                <label className="login-field">
                  <span>{t("login.username")}</span>
                  <input
                    className="login-input"
                    name="username"
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
              <div className="login-field">
                <label htmlFor="login-password">{t("login.password")}</label>
                <div className="login-password">
                  <input
                    className="login-input"
                    id="login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    aria-describedby={mode === "register" ? "login-password-hint" : undefined}
                    minLength={mode === "register" ? 8 : undefined}
                    required
                  />
                  <button
                    className="login-password-toggle"
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
                    aria-controls="login-password"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                      <circle cx="12" cy="12" r="3" />
                      {showPassword && <path d="m3 3 18 18" />}
                    </svg>
                  </button>
                </div>
                {mode === "register" && <small id="login-password-hint">{t("login.passwordHint")}</small>}
              </div>
              {notice && (
                <div className="login-message" role="status">
                  {notice}
                </div>
              )}
              {error && (
                <div className="login-message login-message-error" role="alert">
                  <span aria-hidden="true">!</span>
                  <p>{error}</p>
                </div>
              )}
              <button className="login-submit" type="submit" disabled={busy}>
                <span>
                  {busy
                    ? t("login.submitting")
                    : mode === "login"
                      ? t("login.submitLogin")
                      : t("login.submitRegister")}
                </span>
                {busy ? <span className="spinner" aria-hidden="true" /> : <span aria-hidden="true">↗</span>}
              </button>
            </fieldset>
          </form>
          <p className="login-switch">
            <span>{mode === "login" ? t("login.noAccount") : t("login.haveAccount")}</span>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setShowPassword(false);
                setError("");
                setNotice("");
              }}
            >
              {mode === "login" ? t("login.registerCta") : t("login.loginCta")}
            </button>
          </p>
        </section>

        <nav className="login-explore" aria-label={t("nav.publicNav")}>
          <p>{t("login.exploreLabel")}</p>
          <div>
            <Link to="/models">
              {t("nav.models")} <span aria-hidden="true">↗</span>
            </Link>
            <Link to="/docs">
              {t("nav.quickstart")} <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </nav>
      </main>
      <footer className="login-footer">Autonomia © {new Date().getFullYear()}</footer>
    </div>
  );
}
