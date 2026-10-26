import React from "react";
import { Link, Navigate, NavLink, Outlet, useNavigate } from "react-router-dom";
import { AutonomiaIcon } from "../components/AutonomiaIcon";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useSession } from "../components/session";
import { StateBlock } from "../components/ui";
import { type TranslationKey, useI18n } from "../i18n";
import { logoutAutonomiaAccount } from "../lib/autonomia/api/autonomiaAuthApi";
import type { AutonomiaConsoleUser } from "../lib/autonomia/types";
import { formatUsd } from "../lib/autonomia/utils/formatAutonomia";

// 控制台外框:側邊欄 + Outlet。未登入時導向 /login。

function NavIcon({ name }: { name: "overview" | "play" | "key" | "cube" | "list" | "book" }) {
  const paths: Record<string, React.ReactNode> = {
    overview: (
      <>
        <rect x="3" y="3" width="8" height="10" rx="1.5" />
        <rect x="13" y="3" width="8" height="6" rx="1.5" />
        <rect x="13" y="13" width="8" height="8" rx="1.5" />
        <rect x="3" y="17" width="8" height="4" rx="1.5" />
      </>
    ),
    play: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m10 8.5 5 3.5-5 3.5Z" />
      </>
    ),
    key: (
      <>
        <circle cx="8" cy="15" r="4" />
        <path d="m11 12 9-9M16 7l3 3M14 9l3 3" />
      </>
    ),
    cube: (
      <>
        <path d="m12 2 8 4.5v9L12 20l-8-4.5v-9Z" />
        <path d="M12 11 4 6.5M12 11l8-4.5M12 11v9" />
      </>
    ),
    list: (
      <>
        <path d="M8 6h13M8 12h13M8 18h13" />
        <circle cx="3.5" cy="6" r="1" />
        <circle cx="3.5" cy="12" r="1" />
        <circle cx="3.5" cy="18" r="1" />
      </>
    ),
    book: (
      <>
        <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H20v17H7.5A3.5 3.5 0 0 0 4 22.5Z" />
        <path d="M4 5.5v17M8 7h8M8 11h6" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

const NAV_GROUPS: Array<{
  labelKey: TranslationKey;
  items: Array<{
    to: string;
    labelKey: TranslationKey;
    icon: "overview" | "play" | "key" | "cube" | "list" | "book";
  }>;
}> = [
  {
    labelKey: "nav.groupUse",
    items: [
      { to: "/overview", labelKey: "nav.overview", icon: "overview" },
      { to: "/playground", labelKey: "nav.playground", icon: "play" },
    ],
  },
  {
    labelKey: "nav.groupResources",
    items: [
      { to: "/keys", labelKey: "nav.keys", icon: "key" },
      { to: "/models", labelKey: "nav.models", icon: "cube" },
      { to: "/logs", labelKey: "nav.logs", icon: "list" },
    ],
  },
  {
    labelKey: "nav.groupDocs",
    items: [{ to: "/docs", labelKey: "nav.quickstart", icon: "book" }],
  },
];

// 控制台外殼(側欄 + 主內容)。ConsoleLayout 與 SharedLayout 共用。
// user 由呼叫端在通過登入檢查後傳入,避免登出清空 context 時的 null 競態。
function ConsoleShell({ user }: { user: AutonomiaConsoleUser }) {
  const { setUser } = useSession();
  const { t } = useI18n();
  const navigate = useNavigate();

  const logout = async () => {
    try {
      await logoutAutonomiaAccount();
    } finally {
      // 先清空 context,否則 /login 會因為殘留的 session 被彈回控制台。
      setUser(null);
      navigate("/login", { replace: true });
    }
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <NavLink className="sidebar-brand" to="/overview">
          <AutonomiaIcon size={24} />
          <strong>Autonomia</strong>
          <small>CONSOLE</small>
        </NavLink>
        <nav className="sidebar-nav" aria-label={t("nav.consoleNav")}>
          {NAV_GROUPS.map((group) => (
            <React.Fragment key={group.labelKey}>
              <span className="nav-group">{t(group.labelKey)}</span>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }: { isActive: boolean }) => `nav-item${isActive ? " active" : ""}`}
                >
                  <NavIcon name={item.icon} />
                  <span>{t(item.labelKey)}</span>
                </NavLink>
              ))}
            </React.Fragment>
          ))}
        </nav>
        <div className="sidebar-lang">
          <LanguageSwitcher />
        </div>
        <div className="sidebar-user">
          <span className="sidebar-user-avatar" aria-hidden="true">
            {(user.display_name || user.username || "?").slice(0, 1).toUpperCase()}
          </span>
          <span className="sidebar-user-meta">
            <strong>{user.display_name || user.username}</strong>
            <span>{t("nav.balance", { amount: formatUsd(user.balance_usd) })}</span>
          </span>
          <button
            type="button"
            className="sidebar-logout"
            onClick={() => void logout()}
            aria-label={t("nav.logout")}
          >
            {t("nav.logout")}
          </button>
        </div>
      </aside>
      <main className="main">
        <div className="main-inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function SessionLoading() {
  const { t } = useI18n();
  return (
    <div className="auth-wrap">
      <StateBlock spinner>{t("app.checkingSession")}</StateBlock>
    </div>
  );
}

// 嚴格登入牆:總覽/金鑰/串流測試/請求紀錄需要帳號。
export function ConsoleLayout() {
  const { user, loading } = useSession();
  if (loading) return <SessionLoading />;
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <ConsoleShell user={user} />;
}

// 公開頁外框:未登入時以極簡頂欄呈現(模型/文件不需要帳號即可瀏覽)。
function PublicShell() {
  const { t } = useI18n();
  return (
    <div className="home">
      <header className="home-topbar">
        <Link className="home-brand" to="/home">
          <AutonomiaIcon size={22} />
          <strong>Autonomia</strong>
        </Link>
        <nav className="home-topnav" aria-label={t("nav.publicNav")}>
          <Link to="/home">{t("nav.home")}</Link>
          <Link to="/models">{t("nav.models")}</Link>
          <Link to="/docs">{t("nav.quickstart")}</Link>
          <LanguageSwitcher />
          <Link className="btn btn-primary btn-sm" to="/login">
            {t("nav.loginOrRegister")}
          </Link>
        </nav>
      </header>
      <main className="home-main">
        <Outlet />
      </main>
      <footer className="home-footer">
        <span>
          <AutonomiaIcon size={14} /> {t("nav.footerTagline")}
        </span>
        <nav aria-label={t("nav.footerNav")}>
          <Link to="/home">{t("nav.home")}</Link>
          <Link to="/login">{t("nav.login")}</Link>
        </nav>
      </footer>
    </div>
  );
}

// 共用外框:模型/文件是公開頁——已登入帶控制台側欄,未登入帶公開外框。
export function SharedLayout() {
  const { user, loading } = useSession();
  if (loading) return <SessionLoading />;
  return user ? <ConsoleShell user={user} /> : <PublicShell />;
}
