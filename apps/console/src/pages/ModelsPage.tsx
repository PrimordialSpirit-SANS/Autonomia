import React from "react";
import { Alert, BrandMark, CopyButton, PageHeader, StateBlock } from "../components/ui";
import { modelDescription, useI18n } from "../i18n";
import {
  loadAutonomiaBrandManifest,
  loadAutonomiaModels,
} from "../lib/autonomia/catalog/loadAutonomiaCatalog";
import type { AutonomiaModel } from "../lib/autonomia/types";
import { formatModelLimit, formatUsd } from "../lib/autonomia/utils/formatAutonomia";

// 模型目錄:資料來自 public/data/autonomia(僅介面展示)。
// 計費卡片顯示每百萬 Token 的輸入/輸出美元價。

function InputModalityBadge({ modalities }: { modalities: string[] }) {
  const { t } = useI18n();
  const supported = modalities.includes("image");
  const description = supported ? t("models.modalityVisionDesc") : t("models.modalityTextDesc");
  return (
    <span
      className={`tag${supported ? " badge-warn" : ""}`}
      title={description}
      role="img"
      aria-label={description}
      style={supported ? { color: "var(--accent-strong)", borderColor: "var(--accent-line)" } : undefined}
    >
      {supported ? "vision" : "text"}
    </span>
  );
}

export function ModelsPage() {
  const { t } = useI18n();
  const [catalog, setCatalog] = React.useState<Awaited<ReturnType<typeof loadAutonomiaModels>> | null>(null);
  const [brandAssets, setBrandAssets] = React.useState<
    Map<string, { display_asset_url: string | null; name: string; fallback_label: string }>
  >(new Map());
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    const controller = new AbortController();
    loadAutonomiaModels(controller.signal)
      .then(setCatalog)
      .catch((cause: Error) => {
        if (cause.name !== "AbortError") setError(cause.message);
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

  return (
    <>
      <PageHeader
        title={t("models.title")}
        subtitle={t("models.subtitle", {
          count: catalog?.models.length ?? "…",
          revision: catalog?.pricing_revision ?? "—",
        })}
      />
      {error && (
        <div style={{ marginBottom: 12 }}>
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      {!catalog && !error && (
        <div className="card">
          <StateBlock spinner>{t("models.loading")}</StateBlock>
        </div>
      )}
      {catalog && (
        <div className="model-grid">
          {catalog.models.map((model: AutonomiaModel) => {
            const brand = brandAssets.get(model.owner_brand_asset_id);
            return (
              <article className="card model-card" key={model.id}>
                <div className="model-card-top">
                  <span>
                    {t("models.contextLabel", { value: formatModelLimit(model.context_window_tokens) })}
                  </span>
                  {model.status !== "available" && <span className="badge badge-warn">{model.status}</span>}
                </div>
                <div className="model-identity">
                  <BrandMark
                    assetUrl={brand?.display_asset_url}
                    fallback={model.owner}
                    alt={brand?.name || model.owner}
                  />
                  <div style={{ minWidth: 0 }}>
                    <h2>{model.display_name}</h2>
                    <div className="model-route">
                      <code title={t("models.routeTitle", { id: model.id })}>{model.id}</code>
                      <CopyButton value={model.id} label={t("models.routeCopyLabel")} compact />
                    </div>
                  </div>
                </div>
                <p className="model-desc">{modelDescription(model.id) || model.description}</p>
                <div className="model-tags">
                  {model.capabilities.map((capability) => (
                    <span className="tag" key={capability}>
                      {capability}
                    </span>
                  ))}
                  <InputModalityBadge modalities={model.input_modalities} />
                </div>
                <dl className="model-billing" style={{ margin: 0 }}>
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
    </>
  );
}
