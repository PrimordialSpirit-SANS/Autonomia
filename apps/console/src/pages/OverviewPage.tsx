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

  React.useEffect(() => {
    const controller = new AbortController();
    getAutonomiaUsageSummary(controller.signal)
      .then(setUsage)
      .catch((cause) => {
        if (cause.name !== "AbortError") setError(cause.message);
      });
    return () => controller.abort();
  }, []);

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
          <Link className="btn btn-sm" to="/">
            {t("common.retry")}
          </Link>
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
