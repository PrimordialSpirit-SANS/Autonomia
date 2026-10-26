import React from "react";
import { CopyButton, PageHeader } from "../components/ui";
import { useI18n } from "../i18n";
import {
  getAutonomiaChatCompletionsUrl,
  getAutonomiaPublicApiRoot,
} from "../lib/autonomia/api/autonomiaDeveloperApi";
import { buildCodeExamples, type CodeLanguage } from "../lib/autonomia/utils/buildCodeExamples";

export function DocsPage() {
  const { t } = useI18n();
  const [language, setLanguage] = React.useState<CodeLanguage>("curl");
  const examples = buildCodeExamples(getAutonomiaPublicApiRoot(), "YOUR_MODEL_ID");
  const current = examples[language];

  return (
    <>
      <PageHeader title={t("docs.title")} subtitle={t("docs.subtitle")} />
      <ol className="steps">
        <li className="card">
          <span>01</span>
          <strong>{t("docs.step1Title")}</strong>
          <p>{t("docs.step1Body")}</p>
        </li>
        <li className="card">
          <span>02</span>
          <strong>{t("docs.step2Title")}</strong>
          <code>AUTONOMIA_API_KEY=sk-autonomia-live_…</code>
        </li>
        <li className="card">
          <span>03</span>
          <strong>{t("docs.step3Title")}</strong>
          <code>YOUR_MODEL_ID</code>
        </li>
        <li className="card">
          <span>04</span>
          <strong>{t("docs.step4Title")}</strong>
          <p>{t("docs.step4Body")}</p>
        </li>
      </ol>

      <div>
        <div className="code-tabs" role="tablist" aria-label={t("docs.tabsAria")}>
          {(Object.keys(examples) as CodeLanguage[]).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={language === item}
              className={language === item ? "active" : ""}
              onClick={() => setLanguage(item)}
            >
              {examples[item].label}
            </button>
          ))}
          <span className="copy-slot">
            <CopyButton value={current.code} label={t("common.copy")} />
          </span>
        </div>
        <pre className="code-block">
          <code>{current.code}</code>
        </pre>
      </div>

      <div className="card callout">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H20v17H7.5A3.5 3.5 0 0 0 4 22.5Z" />
          <path d="M4 5.5v17M8 7h8M8 11h6" />
        </svg>
        <div>
          <strong style={{ fontSize: "0.84rem" }}>Endpoint</strong>
          <div>
            <code>{getAutonomiaChatCompletionsUrl()}</code>
          </div>
        </div>
      </div>

      <div className="card callout">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3l8 4v5c0 4.4-3.2 8.2-8 9-4.8-.8-8-4.6-8-9V7l8-4Z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
        <div>
          <strong style={{ fontSize: "0.84rem" }}>{t("docs.idempotencyTitle")}</strong>
          <p style={{ margin: "4px 0 0", fontSize: "0.85rem", lineHeight: 1.6 }}>
            {t("docs.idempotencyIntro")}
            <code>409 idempotent_request_replayed</code>
            {t("docs.idempotencyReplayedNote")}
            <code>409 idempotent_request_in_progress</code>
            {t("docs.idempotencyReplayOpen")}
            <code>idempotency_replay_ttl_seconds</code>
            {t("docs.idempotencyReplayBody")}
            <code>409 idempotent_replay_not_stored</code>
            {t("docs.idempotencyTail")}
          </p>
        </div>
      </div>
    </>
  );
}
