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
import { buildCodeExamples } from "../lib/autonomia/utils/buildCodeExamples";
import { formatModelLimit, formatUsd } from "../lib/autonomia/utils/formatAutonomia";

// 首頁(/home):公開的產品落地頁,不依附任何 layout,自帶頂欄與頁尾。
// 模型與供應商資料來自 public/data/autonomia 目錄(動態載入、fail-soft),
// 目錄不可用時頁面仍完整呈現,僅數據退為「—」。

type BrandAsset = { display_asset_url: string | null; name: string; fallback_label: string };

function FeatureIcon({ name }: { name: "api" | "route" | "billing" | "shield" }) {
  const paths: Record<string, React.ReactNode> = {
    api: (
      <>
        <path d="M7 8H5a3 3 0 0 0-3 3v2a3 3 0 0 0 3 3h2" />
        <path d="M17 8h2a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3h-2" />
        <path d="M8 12h8" />
      </>
    ),
    route: (
      <>
        <circle cx="5" cy="12" r="2.2" />
        <circle cx="19" cy="6" r="2.2" />
        <circle cx="19" cy="18" r="2.2" />
        <path d="M7.2 12H10m0 0c2.6 0 3.8-2.6 6.6-5M10 12c2.6 0 3.8 2.6 6.6 5" />
      </>
    ),
    billing: <path d="M12 3v18M17 5.5H9.8a3 3 0 0 0 0 6h4.4a3 3 0 0 1 0 6H7" />,
    shield: (
      <>
        <path d="M12 3l8 4v5c0 4.4-3.2 8.2-8 9-4.8-.8-8-4.6-8-9V7l8-4Z" />
        <path d="M9 12l2 2 4-4" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

const HOME_MODEL_COUNT = 6;

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
  const code = buildCodeExamples(
    getAutonomiaPublicApiRoot(),
    models?.[0]?.id ?? "autonomia/gpt-6-astra",
  ).curl;
  const consoleHref = user ? "/overview" : "/login";
  const dash = "—";

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
          <span className="home-badge">{t("home.badge")}</span>
          <h1>
            {t("home.heroTitleLead")}
            <em className="home-hero-em">{t("home.heroTitleEm")}</em>
          </h1>
          <p>{t("home.heroLead")}</p>
          <div className="home-cta">
            <Link className="btn btn-primary" to={consoleHref}>
              {user ? t("home.ctaConsole") : t("home.ctaStart")}
            </Link>
            <Link className="btn" to="/docs">
              {t("home.ctaDocs")}
            </Link>
          </div>
        </section>

        <div className="home-metrics">
          <div className="home-metric">
            <strong>{models?.length ?? dash}</strong>
            <span>{t("home.metricModels")}</span>
          </div>
          <div className="home-metric">
            <strong>{providers.length > 0 ? providers.length : dash}</strong>
            <span>{t("home.metricProviders")}</span>
          </div>
          <div className="home-metric">
            <strong>100%</strong>
            <span>{t("home.metricCompat")}</span>
          </div>
          <div className="home-metric">
            <strong>MIT</strong>
            <span>{t("home.metricLicense")}</span>
          </div>
        </div>

        <section className="home-features" aria-label={t("home.featuresLabel")}>
          {(
            [
              { icon: "api", title: "home.feature1Title", body: "home.feature1Body" },
              { icon: "route", title: "home.feature2Title", body: "home.feature2Body" },
              { icon: "billing", title: "home.feature3Title", body: "home.feature3Body" },
              { icon: "shield", title: "home.feature4Title", body: "home.feature4Body" },
            ] as const
          ).map((feature) => (
            <article className="home-feature" key={feature.title}>
              <FeatureIcon name={feature.icon} />
              <h3>{t(feature.title)}</h3>
              <p>{t(feature.body)}</p>
            </article>
          ))}
        </section>

        <section className="home-section" aria-label={t("home.modelsTitle")}>
          <div className="home-section-head">
            <div>
              <h2>{t("home.modelsTitle")}</h2>
              <p>{t("home.modelsDesc")}</p>
            </div>
            <Link className="home-section-link" to="/models">
              {t("home.modelsLink")}
            </Link>
          </div>
          {featured.length > 0 && (
            <div className="home-model-grid">
              {featured.map((model) => {
                const brand = brandAssets.get(model.owner_brand_asset_id);
                return (
                  <article className="home-model-card" key={model.id}>
                    <div className="home-model-head">
                      <BrandMark
                        assetUrl={brand?.display_asset_url}
                        fallback={model.owner}
                        alt={brand?.name || model.owner}
                      />
                      <div className="home-model-title">
                        <h3>{model.display_name}</h3>
                        <span>{model.owner}</span>
                      </div>
                    </div>
                    <dl className="home-model-stats">
                      <div>
                        <dt>{t("home.modelContext")}</dt>
                        <dd>{formatModelLimit(model.context_window_tokens)}</dd>
                      </div>
                      <div>
                        <dt>{t("models.billingInput")}</dt>
                        <dd>{formatUsd(model.billing.input_usd_per_million_tokens)}</dd>
                      </div>
                      <div>
                        <dt>{t("models.billingOutput")}</dt>
                        <dd>{formatUsd(model.billing.output_usd_per_million_tokens)}</dd>
                      </div>
                    </dl>
                  </article>
                );
              })}
            </div>
          )}
          {providers.length > 0 && (
            <ul className="home-providers" aria-label={t("home.providersLabel")}>
              {providers.map((provider) => {
                const brand = brandAssets.get(provider.assetId);
                return (
                  <li className="home-provider" key={provider.owner}>
                    {brand?.display_asset_url ? (
                      <img src={brand.display_asset_url} alt="" loading="lazy" />
                    ) : (
                      <span aria-hidden="true">{(brand?.fallback_label || provider.owner).slice(0, 1)}</span>
                    )}
                    <span>{brand?.name || provider.owner}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="home-quickstart" id="quickstart">
          <h2>{t("home.quickstartTitle")}</h2>
          <p>{t("home.quickstartDesc")}</p>
          <div className="home-code">
            <div className="home-code-head">
              <span>{code.label}</span>
              <CopyButton value={code.code} label={t("common.copy")} compact />
            </div>
            <pre>
              <code>{code.code}</code>
            </pre>
          </div>
        </section>

        <section className="home-section" aria-label={t("home.stepsLabel")}>
          <div className="home-section-head">
            <div>
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
          <h2>{t("home.finalTitle")}</h2>
          <p>{t("home.finalBody")}</p>
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
