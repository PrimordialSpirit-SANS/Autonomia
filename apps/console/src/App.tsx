import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { SessionProvider, useSession } from "./components/session";
import { StateBlock } from "./components/ui";
import { ConsoleLayout, SharedLayout } from "./pages/ConsoleLayout";
import { DocsPage } from "./pages/DocsPage";
import { HomePage } from "./pages/HomePage";
import { KeysPage } from "./pages/KeysPage";
import { LoginPage } from "./pages/LoginPage";
import { LogsPage } from "./pages/LogsPage";
import { ModelsPage } from "./pages/ModelsPage";
import { OverviewPage } from "./pages/OverviewPage";
import { PlaygroundPage } from "./pages/PlaygroundPage";
import { isAutonomiaDemoActive } from "./services/demoApi";

function LoginRoute() {
  const { user, loading, setUser } = useSession();
  if (loading) {
    return (
      <div className="auth-wrap">
        <StateBlock spinner>正在確認登入狀態…</StateBlock>
      </div>
    );
  }
  if (user) return <Navigate to="/overview" replace />;
  return <LoginPage onAuthenticated={setUser} />;
}

// 舊平台深連結(/Developer/ai-api/*)轉址到新路由,確保既有書籤可用。
const LEGACY_PAGE_MAP: Record<string, string> = {
  "": "/overview",
  keys: "/keys",
  test: "/playground",
  docs: "/docs",
  models: "/models",
  providers: "/models",
  logs: "/logs",
};

function LegacyDeveloperRedirect() {
  const { pathname } = useLocation();
  const page = pathname.replace(/^\/Developer\/ai-api\/?/, "").replace(/\/+$/, "");
  return <Navigate to={LEGACY_PAGE_MAP[page] ?? "/home"} replace />;
}

function DemoModeBadge() {
  if (!isAutonomiaDemoActive()) return null;
  return (
    <div className="demo-badge" role="note">
      示範模式・未連接後端
    </div>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/home" element={<HomePage />} />
        {/* 裸根路徑一律導向產品首頁(放在 ConsoleLayout 外,不被登入牆攔截);
            控制台總覽移至 /overview,其餘路由(/keys 等)不變。 */}
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route element={<ConsoleLayout />}>
          <Route path="overview" element={<OverviewPage />} />
          <Route path="keys" element={<KeysPage />} />
          <Route path="playground" element={<PlaygroundPage />} />
          <Route path="logs" element={<LogsPage />} />
        </Route>
        {/* 模型目錄與快速開始是公開頁:未登入也能瀏覽(SharedLayout 依登入狀態切換外框)。 */}
        <Route element={<SharedLayout />}>
          <Route path="models" element={<ModelsPage />} />
          <Route path="docs" element={<DocsPage />} />
        </Route>
        <Route path="/Developer" element={<Navigate to="/overview" replace />} />
        <Route path="/Developer/ai-api/*" element={<LegacyDeveloperRedirect />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
      <DemoModeBadge />
    </SessionProvider>
  );
}
