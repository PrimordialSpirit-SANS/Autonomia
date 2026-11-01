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

// 首頁(/home):公開的產品落地頁,不依附任何 layout,自帶頂欄與頁尾。
// 模型與供應商資料來自 public/data/autonomia 目錄(動態載入、fail-soft),
// 目錄不可用時頁面仍完整呈現,僅數據退為「—」。
//
// 版面走「工程規格表」路線:左對齊敘事 + hero 右側的真實終端機示範、
// 體驗事實以髮絲線列出、模型以定價表格呈現、端點與特色皆為清單而非卡片牆。

type BrandAsset = { display_asset_url: string | null; name: string; fallback_label: string };

const HOME_MODEL_COUNT = 6;

const HOME_ENDPOINTS = [
  { path: "/api/ai/v1/chat/completions", descKey: "home.endpointChatDesc" },
  { path: "/api/ai/v1/embeddings", descKey: "home.endpointEmbeddingsDesc" },
  { path: "/api/ai/v1/responses", descKey: "home.endpointResponsesDesc" },
] as const;

export function HomePage() {
  const { t } = useI18n();
  const { user } = useSession();
  const [models, setModels] = React.useState<
    Awaited<ReturnType<typeof loadAutonomiaModels>>["models"] | null
  >(null);
  const [brandAssets, setBrandAssets] = React.useState<Map<string, BrandAsset>>(new Map());

  React.useEffect(() => {
    const controller = new AbortController();
    loadAutonomiaModels(controller.signal)
      .then((catalog) => setModels(catalog.models))
      .catch(() => {
        // 落地頁不做錯誤阻斷:目錄載入失敗時退為靜態內容。
      });
    loadAutonomiaBrandManifest(controller.signal)
      .then((manifest) => {
        setBrandAssets(new Map(manifest.assets.map((asset) => [asset.id, asset])));
      })
      .catch(() => {
        // 品牌 manifest 是裝飾性的;載入失敗時退回字母徽章即可。
      });
    return () => controller.abort();
  }, []);

  const providers = React.useMemo(() => {
    const seen = new Map<string, { owner: string; assetId: string }>();
    for (const model of models ?? []) {
      if (!seen.has(model.owner))
        seen.set(model.owner, { owner: model.owner, assetId: model.owner_brand_asset_id });
    }
    return [...seen.values()];
  }, [models]);

  const featured = (models ?? []).slice(0, HOME_MODEL_COUNT);
  const apiRoot = getAutonomiaPublicApiRoot();
  const modelId = models?.[0]?.id ?? "autonomia/gpt-6-astra";
  const consoleHref = user ? "/overview" : "/login";
  const dash = "—";

  // 終端機示範:命令可整段複製;行結構用於上色(註解/命令/串流回應)。
  const terminalLines: Array<{ id: string; kind: "comment" | "cmd" | "out"; text: string }> = [
    { id: "comment-1", kind: "comment", text: "# 1 — create a key in the console" },
    { id: "export", kind: "cmd", text: '$ export AUTONOMIA_API_KEY="sk-autonomia-live-…"' },
    { id: "blank-1", kind: "comment", text: "" },
    { id: "comment-2", kind: "comment", text: "# 2 — point the OpenAI SDK at the gateway" },
    { id: "curl", kind: "cmd", text: `$ curl ${apiRoot}/chat/completions \\` },
    { id: "curl-auth", kind: "cmd", text: '    -H "Authorization: Bearer $AUTONOMIA_API_KEY" \\' },
    { id: "curl-body", kind: "cmd", text: `    -d '{"model":"${modelId}","stream":true,` },
    { id: "curl-body-2", kind: "cmd", text: '         "messages":[{"role":"user","content":"hello"}]}' },
    { id: "blank-2", kind: "comment", text: "" },
    { id: "comment-3", kind: "comment", text: "# 3 — same SDK, same request shapes" },
    { id: "response", kind: "out", text: 'data: {"choices":[{"delta":{"content":"Hello"}}]}' },
  ];
  const terminalCode = terminalLines.map((line) => line.text).join("\n");

  return (
    <div className="home">
      <header className="home-topbar">
        <Link className="home-brand" to="/home">
          <AutonomiaIcon size={22} />
          <strong>Autonomia</strong>
        </Link>
        <nav className="home-topnav" aria-label={t("nav.publicNav")}>
          <Link to="/models">{t("nav.models")}</Link>
          <Link to="/docs">{t("nav.quickstart")}</Link>
          <LanguageSwitcher />
          <Link className="btn btn-primary btn-sm" to={consoleHref}>
            {user ? t("home.ctaConsole") : t("nav.loginOrRegister")}
          </Link>
        </nav>
      </header>

      <main className="home-main">
        <section className="home-hero">
          <div className="home-hero-copy">
            <p className="home-kicker">{t("home.badge")}</p>
            <h1>
              {t("home.heroTitleLead")}
              <em className="home-hero-em">{t("home.heroTitleEm")}</em>
            </h1>
            <p className="home-hero-lead">{t("home.heroLead")}</p>
            <div className="home-cta">
              <Link className="btn btn-primary" to={consoleHref}>
                {user ? t("home.ctaConsole") : t("home.ctaStart")}
              </Link>
              <Link className="btn" to="/docs">
                {t("home.ctaDocs")}
              </Link>
            </div>
          </div>
          <figure className="home-terminal">
            <div className="home-terminal-bar">
              <span className="home-terminal-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className="home-terminal-title">~ — sh</span>
              <CopyButton value={terminalCode} compact label={t("common.copy")} />
            </div>
            <pre>
              <code>
                {terminalLines.map((line) => (
                  <span className={`home-terminal-${line.kind}`} key={line.id}>
                    {line.text || "\u00A0"}
                  </span>
                ))}
              </code>
            </pre>
            <figcaption>{t("home.quickstartDesc")}</figcaption>
          </figure>
        </section>

        <ul className="home-facts" aria-label={t("home.factsLabel")}>
          <li className="home-fact">
            <strong>{models?.length ?? dash}</strong>
            <span className="home-fact-label">{t("home.metricModels")}</span>
          </li>
          <li className="home-fact">
            <strong>{providers.length > 0 ? providers.length : dash}</strong>
            <span className="home-fact-label">{t("home.metricProviders")}</span>
          </li>
          <li className="home-fact">
            <strong>100%</strong>
            <span className="home-fact-label">{t("home.metricCompat")}</span>
          </li>
          <li className="home-fact">
            <strong>MIT</strong>
            <span className="home-fact-label">{t("home.metricLicense")}</span>
          </li>
        </ul>

        <section className="home-section" aria-label={t("home.modelsTitle")}>
          <div className="home-section-head">
            <div>
              <p className="home-section-kicker">{t("home.catalogLabel")}</p>
              <h2>{t("home.modelsTitle")}</h2>
              <p>{t("home.modelsDesc")}</p>
            </div>
            <Link className="home-section-link" to="/models">
              {t("home.modelsLink")}
            </Link>
          </div>
          {featured.length > 0 && (
            <div className="home-table-wrap">
              <table className="home-table">
                <thead>
                  <tr>
                    <th className="home-table-head-cell">{t("home.tableModel")}</th>
                    <th className="home-table-head-cell">{t("home.tableProvider")}</th>
                    <th className="home-table-head-cell">{t("models.contextLabel")}</th>
                    <th className="home-table-head-cell num">{t("models.billingInput")}</th>
                    <th className="home-table-head-cell num">{t("models.billingOutput")}</th>
                  </tr>
                </thead>
                <tbody>
                  {featured.map((model) => {
                    const brand = brandAssets.get(model.owner_brand_asset_id);
                    return (
                      <tr className="home-table-row" key={model.id}>
                        <td className="home-table-cell">
                          <div className="home-table-model">
                            <strong>{model.display_name}</strong>
                            <span className="home-table-model-id">{model.id}</span>
                          </div>
                        </td>
                        <td className="home-table-cell">
                          <span className="home-table-provider">
                            <BrandMark
                              assetUrl={brand?.display_asset_url}
                              fallback={model.owner}
                              alt={brand?.name || model.owner}
                            />
                            {model.owner}
                          </span>
                        </td>
                        <td className="home-table-cell num">
                          {formatModelLimit(model.context_window_tokens)}
                        </td>
                        <td className="home-table-cell num">
                          {formatUsd(model.billing.input_usd_per_million_tokens)}
                        </td>
                        <td className="home-table-cell num">
                          {formatUsd(model.billing.output_usd_per_million_tokens)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {providers.length > 0 && (
            <p className="home-providers">
              <span className="home-providers-label">{t("home.providersLabel")}</span>
              {providers.map((provider) => {
                const brand = brandAssets.get(provider.assetId);
                return (
                  <span className="home-provider" key={provider.owner}>
                    {brand?.display_asset_url ? (
                      <img src={brand.display_asset_url} alt="" loading="lazy" />
                    ) : (
                      <span aria-hidden="true">{(brand?.fallback_label || provider.owner).slice(0, 1)}</span>
                    )}
                    <span>{brand?.name || provider.owner}</span>
                  </span>
                );
              })}
            </p>
          )}
        </section>

        <section className="home-section" aria-label={t("home.surfaceTitle")}>
          <div className="home-section-head">
            <div>
              <p className="home-section-kicker">{t("home.surfaceLabel")}</p>
              <h2>{t("home.surfaceTitle")}</h2>
              <p>{t("home.surfaceDesc")}</p>
            </div>
          </div>
          <div className="home-endpoints">
            {HOME_ENDPOINTS.map((endpoint) => (
              <div className="home-endpoint" key={endpoint.path}>
                <code>
                  <span className="home-endpoint-method">POST</span> {endpoint.path}
                </code>
                <p>{t(endpoint.descKey)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="home-section" aria-label={t("home.featuresLabel")}>
          <div className="home-section-head">
            <div>
              <p className="home-section-kicker">{t("home.featuresLabel")}</p>
              <h2>{t("home.whyTitle")}</h2>
            </div>
          </div>
          <div className="home-feature-list">
            {(
              [
                { title: "home.feature1Title", body: "home.feature1Body" },
                { title: "home.feature2Title", body: "home.feature2Body" },
                { title: "home.feature3Title", body: "home.feature3Body" },
                { title: "home.feature4Title", body: "home.feature4Body" },
              ] as const
            ).map((feature) => (
              <article className="home-feature" key={feature.title}>
                <h3>{t(feature.title)}</h3>
                <p>{t(feature.body)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="home-section" aria-label={t("home.stepsLabel")}>
          <div className="home-section-head">
            <div>
              <p className="home-section-kicker">{t("home.stepsLabel")}</p>
              <h2>{t("home.stepsTitle")}</h2>
              <p>{t("home.stepsDesc")}</p>
            </div>
          </div>
          <ol className="home-steps">
            <li className="home-step">
              <span className="home-step-index">01</span>
              <h3>{t("home.step1Title")}</h3>
              <p>{t("home.step1Body")}</p>
            </li>
            <li className="home-step">
              <span className="home-step-index">02</span>
              <h3>{t("home.step2Title")}</h3>
              <p>{t("home.step2Body")}</p>
            </li>
            <li className="home-step">
              <span className="home-step-index">03</span>
              <h3>{t("home.step3Title")}</h3>
              <p>{t("home.step3Body")}</p>
            </li>
          </ol>
        </section>

        <section className="home-final">
          <div className="home-final-copy">
            <h2>{t("home.finalTitle")}</h2>
            <p>{t("home.finalBody")}</p>
          </div>
          <div className="home-cta">
            <Link className="btn btn-primary" to={consoleHref}>
              {user ? t("home.ctaConsole") : t("home.ctaStart")}
            </Link>
            <Link className="btn" to="/models">
              {t("home.ctaModels")}
            </Link>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <span>
          <AutonomiaIcon size={14} /> Autonomia · © 2026 · MIT License
        </span>
        <nav aria-label={t("nav.footerNav")}>
          <Link to="/models">{t("nav.models")}</Link>
          <Link to="/docs">{t("nav.quickstart")}</Link>
          <Link to="/login">{t("nav.login")}</Link>
        </nav>
      </footer>
    </div>
  );
}
