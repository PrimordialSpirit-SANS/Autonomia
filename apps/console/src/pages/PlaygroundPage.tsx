import React from "react";
import { Alert, formatDuration, PageHeader } from "../components/ui";
import { intlLocaleFor, type TranslationKey, useI18n } from "../i18n";
import {
  type AutonomiaStreamDeltaEvent,
  streamAutonomiaChat,
} from "../lib/autonomia/api/autonomiaChatStream";
import { loadAutonomiaModels } from "../lib/autonomia/catalog/loadAutonomiaCatalog";
import type { AutonomiaChatUsage, AutonomiaModel } from "../lib/autonomia/types";

// 串流測試(Playground):雙欄佈局,左側請求參數、右側即時輸出。
// 輸出以 rAF 節流更新,避免每個 delta 都觸發 re-render。

type RunStatus = "idle" | "connecting" | "streaming" | "complete" | "stopped" | "error";

// 狀態 → badge 樣式;顯示文字由 i18n 提供(見 playground.status*)。
const STATUS_CLASSNAMES: Record<RunStatus, string> = {
  idle: "badge",
  connecting: "badge badge-warn",
  streaming: "badge badge-info",
  complete: "badge badge-ok",
  stopped: "badge",
  error: "badge badge-err",
};

const STATUS_LABEL_KEYS: Record<RunStatus, TranslationKey> = {
  idle: "playground.statusIdle",
  connecting: "playground.statusConnecting",
  streaming: "playground.statusStreaming",
  complete: "playground.statusComplete",
  stopped: "playground.statusStopped",
  error: "playground.statusError",
};

// 預設提示詞隨語系切換(標籤 + 提示內容皆由字典提供)。
const PRESETS: Array<{ labelKey: TranslationKey; promptKey: TranslationKey }> = [
  { labelKey: "playground.presetIntroLabel", promptKey: "playground.presetIntroPrompt" },
  { labelKey: "playground.presetPoemLabel", promptKey: "playground.presetPoemPrompt" },
  { labelKey: "playground.presetCodeLabel", promptKey: "playground.presetCodePrompt" },
];

function countCharacters(value: string): number {
  return Array.from(value).length;
}

function isAbortError(cause: unknown): boolean {
  return (
    (cause instanceof DOMException && cause.name === "AbortError") ||
    (typeof cause === "object" &&
      cause !== null &&
      "name" in cause &&
      (cause as { name: string }).name === "AbortError")
  );
}

export function PlaygroundPage() {
  const { t } = useI18n();
  const [models, setModels] = React.useState<AutonomiaModel[]>([]);
  const [catalogError, setCatalogError] = React.useState("");
  const [authMode, setAuthMode] = React.useState<"account" | "api-key">("account");
  const [apiKey, setApiKey] = React.useState("");
  const [modelId, setModelId] = React.useState("");
  const [modelMenuOpen, setModelMenuOpen] = React.useState(false);
  const [activeModelIndex, setActiveModelIndex] = React.useState(0);
  // 初始值取自掛載當下語系的第一個預設;之後切換語言不覆寫已編輯內容。
  const [prompt, setPrompt] = React.useState(() => t(PRESETS[0].promptKey));
  const [maxTokens, setMaxTokens] = React.useState(1024);
  const [status, setStatus] = React.useState<RunStatus>("idle");
  const [output, setOutput] = React.useState("");
  const [reasoningCharacters, setReasoningCharacters] = React.useState(0);
  const [usage, setUsage] = React.useState<AutonomiaChatUsage | null>(null);
  const [firstDeltaMs, setFirstDeltaMs] = React.useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const [error, setError] = React.useState("");

  const abortRef = React.useRef<AbortController | null>(null);
  const frameRef = React.useRef<number | null>(null);
  const startedAtRef = React.useRef(0);
  const firstDeltaRef = React.useRef<number | null>(null);
  const contentRef = React.useRef("");
  const reasoningRef = React.useRef("");
  const modelPickerRef = React.useRef<HTMLDivElement | null>(null);

  const running = status === "connecting" || status === "streaming";
  const normalizedModelId = modelId.trim();
  const selectedModel = models.find((model) => model.id === normalizedModelId);
  const maxOutputTokens = selectedModel?.max_output_tokens || 8192;
  const filteredModels = React.useMemo(() => {
    const query = normalizedModelId.toLocaleLowerCase();
    if (!query) return models;
    return models.filter((model) =>
      `${model.id} ${model.display_name} ${model.owner}`.toLocaleLowerCase().includes(query),
    );
  }, [models, normalizedModelId]);

  React.useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!modelPickerRef.current?.contains(event.target as Node)) setModelMenuOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    loadAutonomiaModels(controller.signal)
      .then((catalog) => {
        const streamable = catalog.models.filter(
          (model) => model.status === "available" && model.capabilities.includes("streaming"),
        );
        setModels(streamable);
        if (streamable.length > 0) {
          setModelId((current) => {
            if (current && streamable.some((model) => model.id === current)) return current;
            const defaultModel = streamable[0];
            setMaxTokens(Math.min(1024, defaultModel.max_output_tokens));
            return defaultModel.id;
          });
        }
      })
      .catch((cause: Error) => {
        if (cause.name !== "AbortError") setCatalogError(cause.message);
      });
    return () => controller.abort();
  }, []);

  React.useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => {
      setElapsedMs(performance.now() - startedAtRef.current);
    }, 100);
    return () => window.clearInterval(timer);
  }, [running]);

  React.useEffect(
    () => () => {
      abortRef.current?.abort();
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  const resetResult = React.useCallback(() => {
    contentRef.current = "";
    reasoningRef.current = "";
    firstDeltaRef.current = null;
    setOutput("");
    setReasoningCharacters(0);
    setUsage(null);
    setFirstDeltaMs(null);
    setElapsedMs(0);
    setError("");
  }, []);

  const scheduleOutput = React.useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      setOutput(contentRef.current);
      setReasoningCharacters(countCharacters(reasoningRef.current));
    });
  }, []);

  const flushOutput = React.useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    setOutput(contentRef.current);
    setReasoningCharacters(countCharacters(reasoningRef.current));
  }, []);

  const onDelta = React.useCallback(
    (event: AutonomiaStreamDeltaEvent) => {
      contentRef.current += event.content;
      reasoningRef.current += event.reasoning;
      if (firstDeltaRef.current === null) {
        firstDeltaRef.current = event.elapsedMs;
        setFirstDeltaMs(event.elapsedMs);
      }
      setStatus("streaming");
      scheduleOutput();
    },
    [scheduleOutput],
  );

  const changeModel = (nextModelId: string) => {
    setModelId(nextModelId);
    const nextModel = models.find((model) => model.id === nextModelId);
    if (nextModel) setMaxTokens((current) => Math.min(current, nextModel.max_output_tokens));
  };

  const chooseModel = (model: AutonomiaModel) => {
    changeModel(model.id);
    setModelMenuOpen(false);
    setActiveModelIndex(0);
  };

  const start = async (event: React.FormEvent) => {
    event.preventDefault();
    if (running) return;

    if (authMode === "api-key" && !apiKey.trim()) {
      setError(t("playground.errorApiKey"));
      return;
    }
    if (!normalizedModelId) {
      setError(t("playground.errorModel"));
      return;
    }
    if (!prompt.trim()) {
      setError(t("playground.errorMessage"));
      return;
    }

    resetResult();
    setStatus("connecting");
    startedAtRef.current = performance.now();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await streamAutonomiaChat({
        authMode,
        apiKey: authMode === "api-key" ? apiKey.trim() : undefined,
        model: normalizedModelId,
        messages: [{ role: "user", content: prompt.trim() }],
        maxCompletionTokens: Math.min(maxTokens, maxOutputTokens),
        signal: controller.signal,
        onDelta,
        onUsage: setUsage,
      });
      flushOutput();
      setUsage(result.usage);
      setFirstDeltaMs(result.metrics.firstDeltaLatencyMs);
      setElapsedMs(result.metrics.totalLatencyMs);
      setStatus("complete");
    } catch (cause) {
      flushOutput();
      setElapsedMs(performance.now() - startedAtRef.current);
      if (isAbortError(cause)) {
        setStatus("stopped");
      } else {
        setStatus("error");
        setError(cause instanceof Error ? cause.message : t("playground.streamFailed"));
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();
  const clearResult = () => {
    if (running) return;
    resetResult();
    setStatus("idle");
  };

  const placeholder = running
    ? reasoningCharacters > 0
      ? t("playground.placeholderReasoning")
      : t("playground.placeholderWaiting")
    : status === "stopped"
      ? t("playground.placeholderStopped")
      : t("playground.placeholderIdle");

  return (
    <>
      <PageHeader title={t("playground.title")} subtitle={t("playground.subtitle")} />
      {catalogError && (
        <div className="pg-alert">
          <Alert tone="error">{catalogError}</Alert>
        </div>
      )}
      <div className="playground">
        <form className="card pg-panel" onSubmit={start}>
          <header className="pg-head">
            <h2>{t("playground.settingsTitle")}</h2>
            <span className={STATUS_CLASSNAMES[status]} role="status" aria-live="polite">
              {t(STATUS_LABEL_KEYS[status])}
            </span>
          </header>
          <div className="pg-body form-grid">
            <div className="field">
              <span>{t("playground.authLabel")}</span>
              <fieldset className="choice" aria-label={t("playground.authChoiceAria")}>
                <button
                  type="button"
                  className={authMode === "account" ? "active" : ""}
                  onClick={() => setAuthMode("account")}
                  disabled={running}
                >
                  {t("playground.authAccount")}
                </button>
                <button
                  type="button"
                  className={authMode === "api-key" ? "active" : ""}
                  onClick={() => setAuthMode("api-key")}
                  disabled={running}
                >
                  {t("playground.authApiKey")}
                </button>
              </fieldset>
              <small>
                {authMode === "account" ? t("playground.authAccountHint") : t("playground.authApiKeyHint")}
              </small>
            </div>

            {authMode === "api-key" && (
              <label className="field">
                <span>{t("playground.authApiKey")}</span>
                <input
                  className="input input-mono"
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="sk-autonomia-live_…"
                  disabled={running}
                />
              </label>
            )}

            <div className="form-row">
              <div className="field model-picker" ref={modelPickerRef}>
                <span>{t("playground.modelLabel")}</span>
                <input
                  className="input input-mono"
                  type="search"
                  value={modelId}
                  onChange={(event) => {
                    changeModel(event.target.value);
                    setModelMenuOpen(true);
                    setActiveModelIndex(0);
                  }}
                  onFocus={() => setModelMenuOpen(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setModelMenuOpen(false);
                    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                      event.preventDefault();
                      setModelMenuOpen(true);
                      const direction = event.key === "ArrowDown" ? 1 : -1;
                      setActiveModelIndex((current) =>
                        Math.max(0, Math.min(filteredModels.length - 1, current + direction)),
                      );
                    }
                    if (event.key === "Enter" && modelMenuOpen && filteredModels[activeModelIndex]) {
                      event.preventDefault();
                      chooseModel(filteredModels[activeModelIndex]);
                    }
                  }}
                  placeholder={t("playground.modelPlaceholder")}
                  autoComplete="off"
                  spellCheck={false}
                  role="combobox"
                  aria-expanded={modelMenuOpen}
                  aria-controls="autonomia-model-options"
                  disabled={running}
                />
                {modelMenuOpen && (
                  <div className="model-picker-menu" id="autonomia-model-options" role="listbox">
                    {filteredModels.length ? (
                      filteredModels.map((model, index) => (
                        <button
                          type="button"
                          key={model.id}
                          role="option"
                          aria-selected={model.id === normalizedModelId}
                          className={`model-option${index === activeModelIndex ? " active" : ""}`}
                          onMouseEnter={() => setActiveModelIndex(index)}
                          onClick={() => chooseModel(model)}
                        >
                          <strong>{model.id}</strong>
                          <span>{model.display_name}</span>
                        </button>
                      ))
                    ) : (
                      <div className="model-empty">{t("playground.modelEmpty")}</div>
                    )}
                  </div>
                )}
              </div>
              <label className="field">
                <span>{t("playground.maxTokensLabel")}</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={maxOutputTokens}
                  value={maxTokens}
                  onChange={(event) =>
                    setMaxTokens(Math.min(maxOutputTokens, Math.max(1, Number(event.target.value) || 1)))
                  }
                  disabled={running}
                />
              </label>
            </div>

            <div className="field">
              <span>{t("playground.messageLabel")}</span>
              <div className="prompt-presets">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.labelKey}
                    type="button"
                    className="chip"
                    onClick={() => setPrompt(t(preset.promptKey))}
                    disabled={running}
                  >
                    {t(preset.labelKey)}
                  </button>
                ))}
              </div>
              <textarea
                className="textarea"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={t("playground.messagePlaceholder")}
                rows={7}
                disabled={running}
              />
              <span className="char-count" aria-hidden="true">
                {t("playground.charCount", {
                  count: countCharacters(prompt).toLocaleString(intlLocaleFor()),
                })}
              </span>
            </div>

            <div className="pg-actions">
              <button className="btn btn-primary" type="submit" disabled={running}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="m10 8.5 5 3.5-5 3.5Z" />
                </svg>
                {running ? t("playground.running") : t("playground.run")}
              </button>
              <button className="btn" type="button" onClick={stop} disabled={!running}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="7" y="7" width="10" height="10" rx="1.5" />
                </svg>
                {t("playground.stop")}
              </button>
            </div>
          </div>
        </form>

        <article className="card pg-panel">
          <header className="pg-head">
            <h2>{t("playground.responseTitle")}</h2>
            <div className="pane-actions">
              <button
                type="button"
                className="btn btn-sm"
                onClick={async () => {
                  if (!output) return;
                  try {
                    await navigator.clipboard.writeText(output);
                  } catch {
                    /* 忽略 */
                  }
                }}
                disabled={!output}
              >
                {t("common.copy")}
              </button>
              <button type="button" className="btn btn-sm" onClick={clearResult} disabled={running}>
                {t("playground.clear")}
              </button>
            </div>
          </header>

          {output ? (
            <pre className="output-pane" aria-live="polite" aria-busy={running}>
              {output}
              {running && <span className="stream-caret" aria-hidden="true" />}
            </pre>
          ) : (
            <div className="pg-empty">
              <div className="pg-empty-inner">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="m10 8.5 5 3.5-5 3.5Z" />
                </svg>
                <span>{placeholder}</span>
              </div>
            </div>
          )}

          {reasoningCharacters > 0 && (
            <div className="reasoning-note">
              {t("playground.reasoningChars", {
                chars: reasoningCharacters.toLocaleString(intlLocaleFor()),
              })}
              {usage?.completion_tokens_details
                ? t("playground.reasoningTokens", {
                    tokens: usage.completion_tokens_details.reasoning_tokens.toLocaleString(intlLocaleFor()),
                  })
                : t("playground.reasoningCharsNote")}
            </div>
          )}

          {error && (
            <div className="output-error" role="alert">
              {error}
            </div>
          )}

          <dl className="pg-metrics">
            <div className="pg-metric">
              <span>{t("playground.metricChars")}</span>
              <strong>{countCharacters(output).toLocaleString(intlLocaleFor())}</strong>
            </div>
            <div className="pg-metric">
              <span>{t("playground.metricTokens")}</span>
              <strong>{usage ? usage.completion_tokens.toLocaleString(intlLocaleFor()) : "—"}</strong>
            </div>
            <div className="pg-metric">
              <span>{t("playground.metricFirstDelta")}</span>
              <strong>{formatDuration(firstDeltaMs)}</strong>
            </div>
            <div className="pg-metric">
              <span>{t("playground.metricElapsed")}</span>
              <strong>{formatDuration(elapsedMs)}</strong>
            </div>
          </dl>
        </article>
      </div>
    </>
  );
}
