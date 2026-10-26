import React from "react";
import { Alert, Dialog, PageHeader, StateBlock } from "../components/ui";
import { useI18n } from "../i18n";
import {
  createAutonomiaKey,
  listAutonomiaKeys,
  revokeAutonomiaKey,
  rotateAutonomiaKey,
} from "../lib/autonomia/api/autonomiaDeveloperApi";
import type { AutonomiaApiKey } from "../lib/autonomia/types";
import { formatAutonomiaTimestamp, formatUsd } from "../lib/autonomia/utils/formatAutonomia";

const MIN_KEY_TTL_MS = 60 * 60 * 1000;
const MAX_REPLAY_TTL_HOURS = 168; // 7 天,與後端上限一致

function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

function defaultKeyExpiryValue(): string {
  return toDateTimeLocalValue(new Date(Date.now() + 30 * 24 * 60 * 60_000));
}

export function KeysPage() {
  const { t } = useI18n();
  const [keys, setKeys] = React.useState<AutonomiaApiKey[]>([]);
  const loadAbortRef = React.useRef<AbortController | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [name, setName] = React.useState("Production");
  const [expiryMode, setExpiryMode] = React.useState<"never" | "custom">("never");
  const [expiryValue, setExpiryValue] = React.useState(defaultKeyExpiryValue);
  const [pointLimitMode, setPointLimitMode] = React.useState<"unlimited" | "limited">("unlimited");
  const [pointLimitValue, setPointLimitValue] = React.useState("50.00");
  const [replayMode, setReplayMode] = React.useState<"off" | "on">("off");
  const [replayHours, setReplayHours] = React.useState("24");
  const [secret, setSecret] = React.useState("");
  const [busy, setBusy] = React.useState("");
  const [pendingRevoke, setPendingRevoke] = React.useState<AutonomiaApiKey | null>(null);

  const formatReplayTtl = (seconds: number | undefined) => {
    const ttl = Number(seconds || 0);
    if (ttl <= 0) return t("keys.replayOffShort");
    const hours = ttl / 3600;
    return t("keys.replayHours", { hours: Number.isInteger(hours) ? hours : hours.toFixed(1) });
  };

  const reload = React.useCallback(async () => {
    // FN-9 fix:載入更多/快速操作時舊回應後到會覆寫新結果;以 AbortController
    // 取消舊請求,abort 是預期行為,不進錯誤。
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    setLoading(true);
    setError("");
    try {
      const loaded = await listAutonomiaKeys(controller.signal);
      if (controller.signal.aborted) return;
      setKeys(loaded);
    } catch (cause) {
      if ((cause as Error)?.name === "AbortError") return;
      setError((cause as Error).message);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;

    let expiresAt: string | null = null;
    if (expiryMode === "custom") {
      const parsedExpiry = new Date(expiryValue);
      if (Number.isNaN(parsedExpiry.getTime()) || parsedExpiry.getTime() < Date.now() + MIN_KEY_TTL_MS) {
        setError(t("keys.errorExpiry"));
        return;
      }
      expiresAt = parsedExpiry.toISOString();
    }

    let spendLimitUsd: string | null = null;
    if (pointLimitMode === "limited") {
      const amount = Number(pointLimitValue);
      if (!Number.isFinite(amount) || amount < 0 || pointLimitValue.trim() === "") {
        setError(t("keys.errorLimit"));
        return;
      }
      spendLimitUsd = amount.toFixed(2);
    }

    let replayTtlSeconds = 0;
    if (replayMode === "on") {
      const hours = Number(replayHours);
      if (!Number.isFinite(hours) || hours <= 0 || hours > MAX_REPLAY_TTL_HOURS) {
        setError(t("keys.errorReplayTtl", { max: MAX_REPLAY_TTL_HOURS }));
        return;
      }
      replayTtlSeconds = Math.round(hours * 3600);
    }

    setBusy("create");
    setError("");
    try {
      const result = await createAutonomiaKey({
        name: name.trim(),
        expires_at: expiresAt,
        spend_limit_usd: spendLimitUsd,
        idempotency_replay_ttl_seconds: replayTtlSeconds,
      });
      setSecret(result.api_key);
      await reload();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy("");
    }
  };

  const rotate = async (key: AutonomiaApiKey) => {
    setBusy(key.id);
    setError("");
    try {
      const result = await rotateAutonomiaKey(key.id);
      setSecret(result.api_key);
      await reload();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy("");
    }
  };

  const revoke = async () => {
    if (!pendingRevoke) return;
    setBusy(pendingRevoke.id);
    try {
      await revokeAutonomiaKey(pendingRevoke.id);
      setPendingRevoke(null);
      await reload();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      <PageHeader title={t("keys.title")} subtitle={t("keys.subtitle")} />
      <form className="card card-pad" onSubmit={create} style={{ marginBottom: 12 }}>
        <h2>{t("keys.createTitle")}</h2>
        <p style={{ margin: "0 0 16px", color: "var(--text-dim)", fontSize: "0.8rem" }}>
          {t("keys.createIntro")}
        </p>
        <div
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}
        >
          <label className="field">
            <span>{t("keys.nameLabel")}</span>
            <input
              className="input"
              value={name}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              placeholder="Production"
            />
            <small>{t("keys.nameHint")}</small>
          </label>
          <div className="field">
            <span>{t("keys.expiryLabel")}</span>
            <fieldset className="choice" aria-label={t("keys.expiryChoiceAria")}>
              <button
                type="button"
                className={expiryMode === "never" ? "active" : ""}
                onClick={() => setExpiryMode("never")}
              >
                {t("keys.neverExpires")}
              </button>
              <button
                type="button"
                className={expiryMode === "custom" ? "active" : ""}
                onClick={() => setExpiryMode("custom")}
              >
                {t("keys.expiryCustom")}
              </button>
            </fieldset>
            {expiryMode === "custom" ? (
              <>
                <input
                  className="input"
                  aria-label={t("keys.expiryInputAria")}
                  type="datetime-local"
                  min={toDateTimeLocalValue(new Date(Date.now() + MIN_KEY_TTL_MS + 60_000))}
                  value={expiryValue}
                  onChange={(event) => setExpiryValue(event.target.value)}
                  required
                />
                <small>{t("keys.expiryMinHint")}</small>
              </>
            ) : (
              <small>{t("keys.expiryDefaultHint")}</small>
            )}
          </div>
          <div className="field">
            <span>{t("keys.limitLabel")}</span>
            <fieldset className="choice" aria-label={t("keys.limitChoiceAria")}>
              <button
                type="button"
                className={pointLimitMode === "unlimited" ? "active" : ""}
                onClick={() => setPointLimitMode("unlimited")}
              >
                {t("keys.limitUnlimited")}
              </button>
              <button
                type="button"
                className={pointLimitMode === "limited" ? "active" : ""}
                onClick={() => setPointLimitMode("limited")}
              >
                {t("keys.limitSet")}
              </button>
            </fieldset>
            {pointLimitMode === "limited" ? (
              <>
                <input
                  className="input"
                  aria-label={t("keys.limitChoiceAria")}
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="50.00"
                  value={pointLimitValue}
                  onChange={(event) => setPointLimitValue(event.target.value)}
                  required
                />
                <small>{t("keys.limitHint")}</small>
              </>
            ) : (
              <small>{t("keys.limitDefaultHint")}</small>
            )}
          </div>
          <div className="field">
            <span>{t("keys.replayLabel")}</span>
            <fieldset className="choice" aria-label={t("keys.replayChoiceAria")}>
              <button
                type="button"
                className={replayMode === "off" ? "active" : ""}
                onClick={() => setReplayMode("off")}
              >
                {t("keys.replayOff")}
              </button>
              <button
                type="button"
                className={replayMode === "on" ? "active" : ""}
                onClick={() => setReplayMode("on")}
              >
                {t("keys.replayOn")}
              </button>
            </fieldset>
            {replayMode === "on" ? (
              <>
                <input
                  className="input"
                  aria-label={t("keys.replayInputAria")}
                  type="number"
                  min={1}
                  max={MAX_REPLAY_TTL_HOURS}
                  step={1}
                  value={replayHours}
                  onChange={(event) => setReplayHours(event.target.value)}
                  required
                />
                <small>{t("keys.replayOnHint")}</small>
              </>
            ) : (
              <small>{t("keys.replayOffHint")}</small>
            )}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            marginTop: 16,
            flexWrap: "wrap",
          }}
        >
          <small style={{ color: "var(--text-faint)", fontSize: "0.74rem" }}>{t("keys.footerHint")}</small>
          <button className="btn btn-primary" type="submit" disabled={busy === "create"}>
            {busy === "create" ? t("keys.creating") : t("keys.createButton")}
          </button>
        </div>
      </form>

      {error && (
        <div style={{ marginBottom: 12 }}>
          <Alert
            tone="error"
            action={
              <button className="btn btn-sm" type="button" onClick={() => void reload()} disabled={loading}>
                {t("common.retry")}
              </button>
            }
          >
            {error}
          </Alert>
        </div>
      )}

      <section className="card" aria-label={t("keys.listAria")}>
        {loading ? (
          <StateBlock spinner>{t("keys.loading")}</StateBlock>
        ) : !error && keys.length === 0 ? (
          <StateBlock>{t("keys.empty")}</StateBlock>
        ) : (
          keys.map((key) => {
            const quotaPercent =
              key.spend_limit_usd != null && Number(key.spend_limit_usd) > 0
                ? Math.min(
                    100,
                    Math.round((Number(key.spend_used_usd || 0) / Number(key.spend_limit_usd)) * 100),
                  )
                : null;
            return (
              <article className="key-row" key={key.id}>
                <div className="key-identity">
                  <strong>{key.name}</strong>
                  <code>
                    {key.key_prefix}••••••••{key.key_suffix}
                  </code>
                  {quotaPercent !== null && (
                    <div className="quota-bar" title={`${quotaPercent}%`}>
                      <i style={{ width: `${quotaPercent}%` }} />
                    </div>
                  )}
                </div>
                <div className="key-meta">
                  <span>{t("keys.metaCreated", { time: formatAutonomiaTimestamp(key.created_at) })}</span>
                  <span>{t("keys.metaLastUsed", { time: formatAutonomiaTimestamp(key.last_used_at) })}</span>
                  <span>
                    {key.expires_at
                      ? t("keys.metaExpires", { time: formatAutonomiaTimestamp(key.expires_at) })
                      : t("keys.neverExpires")}
                  </span>
                  <span>
                    {t("keys.metaSpend", {
                      used: formatUsd(key.spend_used_usd),
                      limit:
                        key.spend_limit_usd == null ? t("common.unlimited") : formatUsd(key.spend_limit_usd),
                    })}
                  </span>
                  <span>
                    {t("keys.metaReplay", { value: formatReplayTtl(key.idempotency_replay_ttl_seconds) })}
                  </span>
                </div>
                <div className="key-actions">
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => void rotate(key)}
                    disabled={busy === key.id}
                  >
                    {t("keys.rotate")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => setPendingRevoke(key)}
                    disabled={busy === key.id}
                  >
                    {t("keys.revoke")}
                  </button>
                </div>
              </article>
            );
          })
        )}
      </section>

      {secret && (
        <Dialog
          title={t("keys.secretTitle")}
          actions={
            <>
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(secret);
                  } catch {
                    /* 剪貼簿不可用時仍可手動選取 */
                  }
                }}
              >
                {t("keys.copyKey")}
              </button>
              <button type="button" className="btn" onClick={() => setSecret("")}>
                {t("keys.savedIt")}
              </button>
            </>
          }
        >
          <p>{t("keys.secretBody")}</p>
          <code className="secret-box">{secret}</code>
        </Dialog>
      )}

      {pendingRevoke && (
        <Dialog
          title={t("keys.revokeTitle", { name: pendingRevoke.name })}
          actions={
            <>
              <button type="button" className="btn btn-danger" onClick={() => void revoke()}>
                {t("keys.revokeConfirm")}
              </button>
              <button type="button" className="btn" onClick={() => setPendingRevoke(null)}>
                {t("common.cancel")}
              </button>
            </>
          }
        >
          <p>{t("keys.revokeBody")}</p>
        </Dialog>
      )}
    </>
  );
}
