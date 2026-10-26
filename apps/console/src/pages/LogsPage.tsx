import React from "react";
import { Alert, PageHeader, StateBlock } from "../components/ui";
import { type TranslationKey, useI18n } from "../i18n";
import { getAutonomiaRequestDetail, listAutonomiaLogs } from "../lib/autonomia/api/autonomiaDeveloperApi";
import type { AutonomiaRequestDetail, AutonomiaUsageLog } from "../lib/autonomia/types";
import {
  formatAutonomiaTimestamp,
  formatLatency,
  formatTokens,
  formatUsd,
} from "../lib/autonomia/utils/formatAutonomia";

// 狀態 → badge 樣式;顯示文字由 i18n 提供(見 logs.status*)。
const STATUS_CLASSNAMES: Record<string, string> = {
  succeeded: "badge badge-ok",
  partially_succeeded: "badge badge-warn",
  rejected: "badge badge-err",
  refunded: "badge badge-info",
  dispatched: "badge",
  needs_reconciliation: "badge badge-warn",
  // 冪等重放命中:不執行、不計費,僅重放已落地的回應。
  replayed: "badge badge-info",
};

const STATUS_LABEL_KEYS: Record<string, TranslationKey> = {
  succeeded: "logs.statusSucceeded",
  partially_succeeded: "logs.statusPartiallySucceeded",
  rejected: "logs.statusRejected",
  refunded: "logs.statusRefunded",
  dispatched: "logs.statusDispatched",
  needs_reconciliation: "logs.statusNeedsReconciliation",
  replayed: "logs.statusReplayed",
};

const STATUS_FILTERS: Array<{ value: string; labelKey: TranslationKey }> = [
  { value: "succeeded", labelKey: "logs.statusSucceeded" },
  { value: "refunded", labelKey: "logs.statusRefunded" },
  { value: "rejected", labelKey: "logs.statusRejected" },
  { value: "needs_reconciliation", labelKey: "logs.statusNeedsReconciliation" },
  { value: "replayed", labelKey: "logs.statusReplayed" },
];

function statusLabelKey(status: string): TranslationKey | null {
  return STATUS_LABEL_KEYS[status] ?? null;
}

export function LogsPage() {
  const { t } = useI18n();
  const [logs, setLogs] = React.useState<AutonomiaUsageLog[]>([]);
  const [pagination, setPagination] = React.useState({ next_cursor: null as string | null, has_more: false });
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [detail, setDetail] = React.useState<AutonomiaRequestDetail | null>(null);
  const loadAbortRef = React.useRef<AbortController | null>(null);
  const detailAbortRef = React.useRef<AbortController | null>(null);

  const statusBadge = (value: string) => {
    const labelKey = statusLabelKey(value);
    return <span className={STATUS_CLASSNAMES[value] || "badge"}>{labelKey ? t(labelKey) : value}</span>;
  };

  const load = React.useCallback(
    async (cursor: string | null = null, append = false) => {
      // FN-9 fix:快速切換篩選時,較慢的舊回應後到會覆寫新結果(亂序競態)。
      // 每次載入以 AbortController 取消舊請求;abort 是預期行為,不進錯誤。
      loadAbortRef.current?.abort();
      const controller = new AbortController();
      loadAbortRef.current = controller;
      setLoading(true);
      setError("");
      try {
        const page = await listAutonomiaLogs(
          { cursor, limit: 25, status: status || undefined },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setLogs((current) => (append ? [...current, ...page.logs] : page.logs));
        setPagination(page.pagination);
      } catch (cause) {
        if ((cause as Error)?.name === "AbortError") return;
        setError((cause as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [status],
  );

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!detail) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDetail(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [detail]);

  const open = async (requestId: string) => {
    // FN-9 fix:詳情 drawer 同樣以 AbortController 取消舊請求,避免亂序覆寫。
    detailAbortRef.current?.abort();
    const controller = new AbortController();
    detailAbortRef.current = controller;
    try {
      const loaded = await getAutonomiaRequestDetail(requestId, controller.signal);
      if (controller.signal.aborted) return;
      setDetail(loaded);
    } catch (cause) {
      if ((cause as Error)?.name === "AbortError") return;
      setError((cause as Error).message);
    }
  };

  const detailRows: Array<[string, string]> = detail
    ? (() => {
        const statusKey = statusLabelKey(detail.status);
        return [
          [t("logs.detailStatus"), statusKey ? t(statusKey) : detail.status],
          [t("logs.detailRequestedModel"), detail.requested_model],
          [t("logs.detailActualModel"), detail.actual_model || "—"],
          [t("logs.detailProvider"), detail.provider || "—"],
          [t("logs.detailInputTokens"), formatTokens(Number(detail.input_tokens))],
          [t("logs.detailOutputTokens"), formatTokens(Number(detail.output_tokens))],
          [t("logs.detailCharge"), formatUsd(detail.charged_usd)],
          [t("logs.detailLatency"), formatLatency(detail.latency_ms)],
          [t("logs.detailErrorCode"), detail.error_code || "—"],
          ...(detail.replay_of_request_id
            ? ([[t("logs.detailReplayOf"), detail.replay_of_request_id]] as Array<[string, string]>)
            : []),
        ];
      })()
    : [];

  return (
    <>
      <PageHeader
        title={t("logs.title")}
        subtitle={t("logs.subtitle")}
        action={
          <select
            className="select"
            style={{ width: "auto" }}
            aria-label={t("logs.filterAria")}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">{t("logs.filterAll")}</option>
            {STATUS_FILTERS.map((item) => (
              <option key={item.value} value={item.value}>
                {t(item.labelKey)}
              </option>
            ))}
          </select>
        }
      />
      {error && (
        <div style={{ marginBottom: 12 }}>
          <Alert
            tone="error"
            action={
              <button className="btn btn-sm" type="button" onClick={() => void load()} disabled={loading}>
                {t("common.retry")}
              </button>
            }
          >
            {error}
          </Alert>
        </div>
      )}
      <div className="card table-wrap">
        {logs.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>{t("logs.colTime")}</th>
                <th>{t("logs.colModel")}</th>
                <th>{t("logs.colStatus")}</th>
                <th>{t("logs.colTokens")}</th>
                <th>{t("logs.colSpend")}</th>
                <th>{t("logs.colLatency")}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.request_id}
                  tabIndex={0}
                  onClick={() => void open(log.request_id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void open(log.request_id);
                  }}
                >
                  <td className="cell-time">
                    {formatAutonomiaTimestamp(log.created_at)}
                    <code>{log.request_id}</code>
                  </td>
                  <td className="cell-model">
                    <code>{log.requested_model}</code>
                    <small>{log.key_name || t("logs.defaultKeyName")}</small>
                  </td>
                  <td>{statusBadge(log.status)}</td>
                  <td>{formatTokens(Number(log.total_tokens))}</td>
                  <td>{formatUsd(log.charged_usd)}</td>
                  <td>{formatLatency(log.latency_ms)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : loading ? (
          <StateBlock spinner>{t("logs.loading")}</StateBlock>
        ) : !error ? (
          <StateBlock>{t("logs.empty")}</StateBlock>
        ) : null}
      </div>
      {pagination.has_more && (
        <div className="load-more">
          <button
            className="btn"
            type="button"
            onClick={() => void load(pagination.next_cursor, true)}
            disabled={loading}
          >
            {t("logs.loadMore")}
          </button>
        </div>
      )}

      {detail && (
        <>
          <button
            type="button"
            className="drawer-backdrop"
            onClick={() => setDetail(null)}
            aria-label={t("logs.detailCloseAria")}
            tabIndex={-1}
          />
          <aside className="drawer" role="dialog" aria-modal="true" aria-label={t("logs.detailAria")}>
            <button
              type="button"
              className="btn btn-sm drawer-close"
              onClick={() => setDetail(null)}
              aria-label={t("logs.detailClose")}
            >
              ×
            </button>
            <h2>{t("logs.detailTitle")}</h2>
            <code className="drawer-request-id">{detail.request_id}</code>
            <dl className="detail-list" style={{ margin: 0 }}>
              {detailRows.map(([term, value]) => (
                <div className="detail-row" key={term}>
                  <dt>{term}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </>
      )}
    </>
  );
}
