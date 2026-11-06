import React from "react";
import { Link } from "react-router-dom";
import { AutonomiaIcon } from "../components/AutonomiaIcon";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useSession } from "../components/session";
import { BrandMark, CopyButton } from "../components/ui";
import { useI18n } from "../i18n";
import { getAutonomiaPublicApiRoot } from "../lib/autonomia/api/autonomiaDeveloperApi";
import {
  loadAutonomiaBrandManifest,
  loadAutonomiaModels,
} from "../lib/autonomia/catalog/loadAutonomiaCatalog";
import { formatModelLimit, formatUsd } from "../lib/autonomia/utils/formatAutonomia";

type BrandAsset = { display_asset_url: string | null; name: string; fallback_label: string };

const HOME_ENDPOINTS = [
  { path: "/chat/completions", descKey: "home.endpointChatDesc" },
  { path: "/embeddings", descKey: "home.endpointEmbeddingsDesc" },
  { path: "/responses", descKey: "home.endpointResponsesDesc" },
] as const;

export function HomePage() {
  const { t } = useI18n();
  const { user } = useSession();
  const [catalog, setCatalog] = React.useState<Awaited<ReturnType<typeof loadAutonomiaModels>> | null>(null);
  const [catalogFailed, setCatalogFailed] = React.useState(false);
  const [brandAssets, setBrandAssets] = React.useState<Map<string, BrandAsset>>(new Map());
  const [selectedModelId, setSelectedModelId] = React.useState("");
  const [codeFormat, setCodeFormat] = React.useState<"curl" | "python">("curl");

  React.useEffect(() => {
    const controller = new AbortController();
    loadAutonomiaModels(controller.signal)
      .then(setCatalog)
      .catch(() => {
        if (!controller.signal.aborted) setCatalogFailed(true);
      });
    loadAutonomiaBrandManifest(controller.signal)
      .then((manifest) => {
        setBrandAssets(new Map(manifest.assets.map((asset) => [asset.id, asset])));
      })
      .catch(() => {
        // 品牌圖示載入失敗時保留文字識別。
      });
    return () => controller.abort();
  }, []);

  const providers = React.useMemo(() => {
    const seen = new Map<string, { owner: string; assetId: string }>();
    for (const model of catalog?.models ?? []) {
      if (!seen.has(model.owner)) {
        seen.set(model.owner, { owner: model.owner, assetId: model.owner_brand_asset_id });
      }
    }
    return [...seen.values()];
  }, [catalog]);

  const chatModels = React.useMemo(
    () =>
      (catalog?.models ?? []).filter(
        (model) => model.status === "available" && model.capabilities.includes("chat"),
      ),
    [catalog],
  );
  const featured = providers
    .map((provider) => catalog?.models.find((model) => model.owner === provider.owner))
    .filter((model) => model !== undefined)
    .slice(0, 6);
  const selectedModel = chatModels.find((model) => model.id === selectedModelId) ?? chatModels[0];
  const apiRoot = getAutonomiaPublicApiRoot();
  const consoleHref = user ? "/overview" : "/login";
  const unavailableMessage = catalogFailed
    ? t("home.catalogUnavailable")
    : catalog
      ? t("home.modelUnavailable")
      : t("home.catalogLoading");
  const requestBody = JSON.stringify(
    { model: selectedModel?.id, messages: [{ role: "user", content: "Hello" }] },
    null,
    2,
  );
  const curlCode = [
    `curl ${JSON.stringify(`${apiRoot}/chat/completions`)} \\`,
    '  -H "Authorization: Bearer $AUTONOMIA_API_KEY" \\',
    '  -H "Content-Type: application/json" \\',
    `  -d '${requestBody.replace(/'/g, "'\\''")}'`,
  ].join("\n");
  const pythonCode = [
    "import os",
    "from openai import OpenAI",
    "",
    "client = OpenAI(",
    `    base_url=${JSON.stringify(apiRoot)},`,
    '    api_key=os.environ["AUTONOMIA_API_KEY"],',
    ")",
    "",
    "response = client.chat.completions.create(",
    `    model=${JSON.stringify(selectedModel?.id ?? "")},`,
    '    messages=[{"role": "user", "content": "Hello"}],',
    ")",
    "print(response.choices[0].message.content)",
  ].join("\n");
  const code = codeFormat === "curl" ? curlCode : pythonCode;

  return (
    <div className="home landing">
      <a className="landing-skip" href="#main-content">
        {t("home.skipToContent")}
      </a>
      <header className="home-topbar">
        <Link className="home-brand" to="/home">
          <AutonomiaIcon size={28} />
          <strong>Autonomia</strong>
        </Link>
        <nav className="home-topnav" aria-label={t("nav.publicNav")}>
          <Link to="/models">{t("nav.models")}</Link>
          <Link to="/docs">{t("nav.quickstart")}</Link>
        </nav>
        <div className="landing-header-language">
          <LanguageSwitcher />
        </div>
        <Link className="landing-button primary landing-header-login" to={consoleHref}>
          {user ? t("home.ctaConsole") : t("nav.login")}
          <span aria-hidden="true">↗</span>
        </Link>
      </header>

      <main className="landing-main" id="main-content" tabIndex={-1}>
        <section className="landing-hero landing-container" aria-labelledby="home-title">
          <p className="landing-eyebrow">{t("home.badge")}</p>
          <div className="landing-hero-grid">
            <h1 id="home-title">
              <span>{t("home.heroTitleLead")}</span>
              <span className="landing-title-muted">{t("home.heroTitleEm")}</span>
            </h1>
            <div className="landing-intro">
              <p>{t("home.heroLead")}</p>
              <div className="landing-actions">
                <Link className="landing-button primary" to={consoleHref}>
                  {user ? t("home.ctaConsole") : t("home.ctaStart")}
                  <span aria-hidden="true">↗</span>
                </Link>
                <a className="landing-text-link" href="#integration">
                  {t("nav.quickstart")} <span aria-hidden="true">↓</span>
                </a>
              </div>
            </div>
          </div>
          <div className="landing-hero-meta">
            <span>OpenAI SDK compatible</span>
            <span>MIT / {t("home.metricLicense")}</span>
          </div>
        </section>

        <figure className="landing-flow landing-container">
          <div className="landing-flow-grid">
            <div className="landing-flow-app">
              <span className="landing-label">{t("home.appLabel")}</span>
              <code>OpenAI SDK</code>
              <span className="landing-flow-path">baseURL → /api/ai/v1</span>
            </div>
            <div className="landing-flow-gateway">
              <span className="landing-label">{t("home.gatewayLabel")}</span>
              <div className="landing-gateway-name">
                <AutonomiaIcon size={36} />
                <strong>Autonomia</strong>
              </div>
              <div className="landing-flow-services">
                <span>{t("home.keysLabel")}</span>
                <span>{t("home.routingLabel")}</span>
                <span>{t("home.billingLabel")}</span>
              </div>
            </div>
            <div className="landing-flow-providers">
              <span className="landing-label">{t("home.upstreamLabel")}</span>
              <div className="landing-provider-list">
                {providers.slice(0, 4).map((provider) => {
                  const brand = brandAssets.get(provider.assetId);
                  return (
                    <span key={provider.owner}>
                      <BrandMark
                        assetUrl={brand?.display_asset_url}
                        fallback={provider.owner}
                        alt={provider.owner}
                      />
                      {provider.owner}
                    </span>
                  );
                })}
                {providers.length === 0 && <span>—</span>}
              </div>
            </div>
          </div>
          <figcaption>{t("home.flowNote")}</figcaption>
        </figure>

        <section className="landing-catalog landing-container" aria-labelledby="catalog-title">
          <div className="landing-section-intro">
            <p className="landing-eyebrow">{t("home.catalogLabel")}</p>
            <h2 id="catalog-title">{t("home.modelsTitle")}</h2>
            <p>{t("home.modelsDesc")}</p>
            <div className="landing-catalog-count">
              <strong>{catalog?.models.length ?? "—"}</strong>
              <span>
                {t("home.metricModels")} / {providers.length || "—"} {t("home.metricProviders")}
              </span>
            </div>
            <Link className="landing-text-link" to="/models">
              {t("home.modelsLink")} <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <div className="landing-catalog-data" aria-busy={!catalog && !catalogFailed}>
            <p className="landing-table-note" id="pricing-unit">
              {t("home.pricingUnit")}
            </p>
            {featured.length > 0 ? (
              <div className="landing-table-wrap">
                <table
                  className="landing-table"
                  aria-labelledby="catalog-title"
                  aria-describedby="pricing-unit"
                >
                  <thead>
                    <tr>
                      <th scope="col">{t("home.tableModel")}</th>
                      <th scope="col" className="landing-context num">
                        {t("home.modelContext")}
                      </th>
                      <th scope="col" className="num">
                        {t("home.tableInput")}
                      </th>
                      <th scope="col" className="num">
                        {t("home.tableOutput")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {featured.map((model) => (
                      <tr key={model.id}>
                        <td>
                          <div className="landing-model-name">
                            <BrandMark
                              assetUrl={brandAssets.get(model.owner_brand_asset_id)?.display_asset_url}
                              fallback={model.owner}
                              alt={model.owner}
                            />
                            <div>
                              <strong>{model.display_name}</strong>
                              <small>{model.owner}</small>
                              <small className="landing-mobile-context">
                                {t("home.modelContext")} {formatModelLimit(model.context_window_tokens)}
                              </small>
                            </div>
                          </div>
                        </td>
                        <td className="landing-context num">
                          {formatModelLimit(model.context_window_tokens)}
                        </td>
                        <td className="num">{formatUsd(model.billing.input_usd_per_million_tokens)}</td>
                        <td className="num">{formatUsd(model.billing.output_usd_per_million_tokens)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="landing-empty" role="status">
                {unavailableMessage}
              </p>
            )}
            <div className="landing-catalog-footer">
              <span>{t("home.catalogNote")}</span>
              {catalog && (
                <span>
                  {t("home.catalogDate")} {catalog.updated_at}
                </span>
              )}
            </div>
          </div>
        </section>

        <section className="landing-integration" id="integration" aria-labelledby="integration-title">
          <div className="landing-container landing-integration-grid">
            <div className="landing-section-intro">
              <p className="landing-eyebrow">{t("home.stepsLabel")}</p>
              <h2 id="integration-title">{t("home.stepsTitle")}</h2>
              <p>{t("home.quickstartDesc")}</p>
              <ol className="landing-setup-steps">
                <li>
                  <Link to={consoleHref}>
                    {t("home.step1Title")} <span aria-hidden="true">↗</span>
                  </Link>
                  <p>{t("home.step1Body")}</p>
                </li>
                <li>
                  <strong>{t("home.step2Title")}</strong>
                  <p>{t("home.step2Body")}</p>
                </li>
              </ol>
            </div>
            <div className="landing-code-workspace">
              <div className="landing-code-controls">
                <label className="landing-model-picker">
                  <span>{t("home.selectModel")}</span>
                  <select
                    value={selectedModel?.id ?? ""}
                    onChange={(event) => setSelectedModelId(event.target.value)}
                    disabled={!selectedModel}
                  >
                    {!selectedModel && <option value="">{unavailableMessage}</option>}
                    {chatModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.display_name}
                      </option>
                    ))}
                  </select>
                </label>
                <fieldset className="landing-code-formats" aria-label={t("home.codeFormat")}>
                  <button
                    type="button"
                    aria-pressed={codeFormat === "curl"}
                    onClick={() => setCodeFormat("curl")}
                  >
                    cURL
                  </button>
                  <button
                    type="button"
                    aria-pressed={codeFormat === "python"}
                    onClick={() => setCodeFormat("python")}
                  >
                    Python
                  </button>
                </fieldset>
              </div>
              <div className="landing-code-heading">
                <span>POST /chat/completions</span>
                {selectedModel && <CopyButton value={code} compact />}
              </div>
              {selectedModel ? (
                <section aria-label={`${t("home.codeFormat")}: ${codeFormat}`}>
                  <pre
                    className="landing-code"
                    // biome-ignore lint/a11y/noNoninteractiveTabindex: 長程式碼需要鍵盤水平捲動。
                    tabIndex={0}
                  >
                    <code>
                      {code.split("\n").map((line, index) => (
                        <span
                          className={`landing-code-line${line.includes(apiRoot) ? " landing-code-highlight" : ""}`}
                          // biome-ignore lint/suspicious/noArrayIndexKey: 範例行無元件狀態且永不重排。
                          key={`${codeFormat}-${index}`}
                        >
                          <span className="landing-line-number" aria-hidden="true">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          {line || " "}
                        </span>
                      ))}
                    </code>
                  </pre>
                </section>
              ) : (
                <p className="landing-empty" role="status">
                  {unavailableMessage}
                </p>
              )}
              {selectedModel && (
                <div className="landing-model-pricing" aria-live="polite" aria-atomic="true">
                  <span>
                    {t("home.tableInput")} {formatUsd(selectedModel.billing.input_usd_per_million_tokens)}
                  </span>
                  <span>
                    {t("home.tableOutput")} {formatUsd(selectedModel.billing.output_usd_per_million_tokens)}
                  </span>
                  <span>{t("home.pricingUnit")}</span>
                </div>
              )}
              <p className="landing-code-note">{t("home.codeNote")}</p>
              <Link className="landing-text-link" to="/docs">
                {t("home.ctaDocs")} <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="landing-reference landing-container" aria-labelledby="reference-title">
          <div className="landing-section-intro">
            <p className="landing-eyebrow">{t("home.surfaceLabel")}</p>
            <h2 id="reference-title">{t("home.surfaceTitle")}</h2>
            <p>{t("home.surfaceDesc")}</p>
          </div>
          <div>
            <div className="landing-endpoints">
              {HOME_ENDPOINTS.map((endpoint) => (
                <details key={endpoint.path}>
                  <summary>
                    <code>
                      <span>POST</span> {endpoint.path}
                    </code>
                    <span className="landing-disclosure" aria-hidden="true">
                      +
                    </span>
                  </summary>
                  <p>{t(endpoint.descKey)}</p>
                </details>
              ))}
            </div>
            <div className="landing-ownership">
              <span>{t("home.dataPolicy")}</span>
            </div>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <span>
          <AutonomiaIcon size={18} /> Autonomia © 2026
        </span>
        <nav aria-label={t("nav.footerNav")}>
          <Link to="/models">{t("nav.models")}</Link>
          <Link to="/docs">{t("nav.quickstart")}</Link>
          <Link to={consoleHref}>{user ? t("home.ctaConsole") : t("nav.login")}</Link>
        </nav>
      </footer>
    </div>
  );
}
