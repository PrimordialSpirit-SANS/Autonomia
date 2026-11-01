import React from "react";
import { useI18n } from "../i18n";

// F-08 修復:整個控制台原本沒有任何 React Error Boundary —— 任何未預期的
// 渲染期例外都會讓 React 卸載整棵樹(白屏、只剩 console 一條錯誤)。對一個
// 管理金鑰與金額的控制台而言,白屏等於服務不可用。此邊界以「就地顯示
// 可恢復 UI」取代白屏:
// - variant="page":包住整個 App(main.tsx),連外框都崩潰時仍可恢復;
// - variant="route":包住 ConsoleLayout 的 Outlet,路由內的崩潰不吞掉
//   側邊欄等外框,錯誤訊息與重載按鈕就地呈現。
// 錯誤物件只進瀏覽器 console,不送往任何外部服務(與本專案零遙測一致)。

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** page = 包整個 App;route = 只包路由內容(保留外框) */
  variant?: "page" | "route";
}

interface ErrorBoundaryState {
  error: Error | null;
}

function ErrorFallback({
  error,
  variant,
  onReset,
}: {
  error: Error | null;
  variant: "page" | "route";
  onReset: () => void;
}) {
  const { t } = useI18n();
  return (
    <div
      className="card card-pad"
      role="alert"
      style={{ margin: variant === "route" ? 0 : 16, textAlign: "left" }}
    >
      <h2 style={{ fontSize: "1rem", margin: "0 0 8px" }}>{t("errors.unexpectedError")}</h2>
      <p
        style={{
          color: "var(--text-dim)",
          fontSize: "0.85rem",
          margin: "0 0 12px",
          wordBreak: "break-word",
        }}
      >
        {t("errors.unexpectedErrorBody")}
        {error?.message ? ` (${error.message.slice(0, 200)})` : ""}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-primary" type="button" onClick={() => window.location.reload()}>
          {t("errors.reloadPage")}
        </button>
        {variant === "route" && (
          <button className="btn" type="button" onClick={onReset}>
            {t("common.retry")}
          </button>
        )}
      </div>
    </div>
  );
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // 開發者面:錯誤與 componentStack 只進瀏覽器 console,不外送。
    console.error("Autonomia console render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorFallback
          error={this.state.error}
          variant={this.props.variant ?? "page"}
          onReset={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}
