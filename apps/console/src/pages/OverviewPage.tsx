import React from "react";
import { Link } from "react-router-dom";
import { Alert, PageHeader, StateBlock } from "../components/ui";
import { useI18n } from "../i18n";
import {
  getAutonomiaPublicApiRoot,
  getAutonomiaUsageSummary,
} from "../lib/autonomia/api/autonomiaDeveloperApi";
import type { AutonomiaUsageSummary } from "../lib/autonomia/types";
import { formatTokens, formatUsd } from "../lib/autonomia/utils/formatAutonomia";

export function OverviewPage() {
  const { t } = useI18n();
  const [usage, setUsage] = React.useState<AutonomiaUsageSummary | null>(null);
  const [error, setError] = React.useState("");
  const [reloading, setReloading] = React.useState(false);

  // F-13 修復:載入失敗的「重試」原本是 Link 到="/",而根路徑會重定向到
  // 公開行銷頁 /home —— 使用者按重試卻被登出到行銷頁,重試從未發生。
  // 改為可重呼叫的載入函數(比照 KeysPage 的模式),按鈕直接重觸發。
  const reload = React.useCallback(() => {
    const controller = new AbortController();
    setReloading(true);
    getAutonomiaUsageSummary(controller.signal)
      .then((loaded) => {
        setUsage(loaded);
        setError("");
      })
      .catch((cause) => {
        if (cause.name !== "AbortError") setError(cause.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setReloading(false);
      });
    return () => controller.abort();
  }, []);

  React.useEffect(() => reload(), [reload]);

  const metrics: Array<[string, string | null]> = [
    [t("overview.metricBalance"), usage ? formatUsd(usage.balance_usd) : null],
    [t("overview.metricRequests"), usage ? formatTokens(Number(usage.requests)) : null],
    [t("overview.metricTokens"), usage ? formatTokens(Number(usage.total_tokens)) : null],
    [t("overview.metricSpend"), usage ? formatUsd(usage.charged_usd) : null],
  ];

  return (
    <>
      <PageHeader
        title={t("overview.title")}
        subtitle={t("overview.subtitle")}
        action={
          <Link className="btn btn-primary" to="/keys">
            {t("overview.createKey")}
          </Link>
        }
      />
      {error && (
        <Alert tone="error">
          {error}
          <button className="btn btn-sm" type="button" onClick={reload} disabled={reloading}>
            {t("common.retry")}
          </button>
        </Alert>
      )}
      <section className="metric-grid" aria-label={t("overview.metricsAria")}>
        {metrics.map(([label, value]) => (
          <article className="card metric" key={label}>
            <span>{label}</span>
            <strong>{value ?? "—"}</strong>
          </article>
        ))}
      </section>
      {!usage && !error && <StateBlock spinner>{t("overview.loading")}</StateBlock>}
      <div className="two-col">
        <article className="card card-pad">
          <h2>{t("overview.endpointTitle")}</h2>
          <p style={{ margin: "0 0 12px", color: "var(--text-dim)", fontSize: "0.8rem" }}>
            {t("overview.endpointIntro")}
          </p>
          <label className="field">
            <span>{t("overview.baseUrlLabel")}</span>
            <input
              className="input input-mono"
              readOnly
              value={getAutonomiaPublicApiRoot()}
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>
          <div style={{ marginTop: "10px" }}>
            <div className="endpoint-row">
              <span className="endpoint-method">POST</span>
              <code>/chat/completions</code>
            </div>
            <div className="endpoint-row">
              <span className="endpoint-method get">GET</span>
              <code>/models</code>
            </div>
          </div>
          <small style={{ color: "var(--text-faint)", fontSize: "0.72rem" }}>
            Authorization: Bearer sk-autonomia-live_…
          </small>
        </article>
        <article className="card card-pad">
          <h2>{t("overview.quickTitle")}</h2>
          <div style={{ marginTop: 8 }}>
            <Link className="link-row" to="/playground">
              <span>{t("nav.playground")}</span>
              <small>{t("overview.quickPlaygroundHint")}</small>
            </Link>
            <Link className="link-row" to="/docs">
              <span>{t("nav.quickstart")}</span>
              <small>{t("overview.quickDocsHint")}</small>
            </Link>
            <Link className="link-row" to="/models">
              <span>{t("nav.models")}</span>
              <small>{t("overview.quickModelsHint")}</small>
            </Link>
            <Link className="link-row" to="/logs">
              <span>{t("nav.logs")}</span>
              <small>{t("overview.quickLogsHint")}</small>
            </Link>
          </div>
        </article>
      </div>
    </>
  );
}
