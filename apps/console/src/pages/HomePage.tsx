import React from "react";
import { Link } from "react-router-dom";
import { AutonomiaIcon } from "../components/AutonomiaIcon";
import { StarfieldCanvas } from "../components/StarfieldCanvas";
import { useSession } from "../components/session";
import { BrandMark, CopyButton } from "../components/ui";
import { getAutonomiaPublicApiRoot } from "../lib/autonomia/api/autonomiaDeveloperApi";
import {
  loadAutonomiaBrandManifest,
  loadAutonomiaModels,
} from "../lib/autonomia/catalog/loadAutonomiaCatalog";
import type { AutonomiaModel } from "../lib/autonomia/types";
import { buildCodeExamples } from "../lib/autonomia/utils/buildCodeExamples";
import { formatModelLimit, formatUsd } from "../lib/autonomia/utils/formatAutonomia";

// 首頁(/home):3D 星空背景上的產品落地頁。
// 內容順序參考同類 AI 閘道官網:識別 → 價值主張 → 數據 → 功能 → 模型目錄 →
// 供應商 → 快速開始 → 接入步驟 → 最終 CTA。模型數量與品牌圖示取自
// public/data 與 public/brand 的靜態目錄,載入失敗時整段優雅略過。

type BrandInfo = {
  display_asset_url: string | null;
  name: string;
  fallback_label: string;
};

const PROVIDERS = [
  { id: "openai", name: "OpenAI", asset: "/brand/autonomia/providers/openai.svg" },
  { id: "anthropic", name: "Anthropic", asset: "/brand/autonomia/providers/anthropic.svg" },
  { id: "google", name: "Google Gemini", asset: "/brand/autonomia/providers/google.svg" },
  { id: "xai", name: "xAI", asset: "/brand/autonomia/providers/xai.svg" },
  { id: "deepseek", name: "DeepSeek", asset: "/brand/autonomia/providers/deepseek.svg" },
  { id: "moonshot", name: "Moonshot AI", asset: "/brand/autonomia/providers/moonshot.png" },
  { id: "qwen", name: "Qwen", asset: "/brand/autonomia/providers/qwen.svg" },
  { id: "z-ai", name: "Z.ai", asset: "/brand/autonomia/providers/z-ai.svg" },
];

const STEPS = [
  {
    title: "取得金鑰",
    body: "在控制台建立一把 sk-autonomia 金鑰，順手設好可用模型與消費上限。",
  },
  {
    title: "換上網址",
    body: "把 OpenAI SDK 的 baseURL 指向你的閘道，其餘程式照常運作。",
  },
  {
    title: "看清每一筆",
    body: "用量、延遲與花費即時可見；需要時，請求會自動改走其他上游。",
  },
];

function ApiIcon() {
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
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="m7 9 2.5 3L7 15M12.5 15H17" />
    </svg>
  );
}

function PoolIcon() {
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
      <circle cx="6" cy="6" r="2.2" />
      <circle cx="18" cy="6" r="2.2" />
      <circle cx="12" cy="18" r="2.2" />
      <path d="M8.2 6h7.6M7.4 8.1l3.4 7.8M16.6 8.1l-3.4 7.8" />
    </svg>
  );
}

function CoinIcon() {
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
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v10M14.6 9.2c-.5-.7-1.5-1.2-2.6-1.2-1.6 0-2.8.9-2.8 2.1 0 1.2 1 1.8 2.8 2.3 1.9.5 2.8 1.1 2.8 2.3 0 1.2-1.2 2.1-2.8 2.1-1.1 0-2.1-.5-2.6-1.2" />
    </svg>
  );
}

function ShieldIcon() {
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
      <path d="M12 3 5 6v6c0 4 3 7.2 7 9 4-1.8 7-5 7-9V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

const FEATURES = [
  {
    icon: <ApiIcon />,
    title: "一種語言，聽懂所有星",
    body: "既有的 OpenAI SDK 與工具不必改寫，換上你的網址就能繼續用；串流、工具呼叫、向量與 responses 介面一併相容。",
  },
  {
    icon: <PoolIcon />,
    title: "一顆暗了，另一顆還亮著",
    body: "同一個模型掛在多條上游之後：按權重分流、遇錯自動改道。單一供應商中斷，也只是少了一顆星。",
  },
  {
    icon: <CoinIcon />,
    title: "每一束光，都找得到源頭",
    body: "以微美元整數結帳，先預留、後結算、多退少補；每一筆用量都能重算，帳目對得起來。",
  },
  {
    icon: <ShieldIcon />,
    title: "自己的夜空，自己畫",
    body: "一個 SQLite 檔案就能起步，也能搬上 PostgreSQL 或 Cloudflare Workers；提示詞與回應預設不落地，金鑰只存雜湊。",
  },
];

export function HomePage() {
  const { user } = useSession();
  const [models, setModels] = React.useState<AutonomiaModel[]>([]);
  const [brands, setBrands] = React.useState<Map<string, BrandInfo>>(new Map());

  React.useEffect(() => {
    const controller = new AbortController();
    loadAutonomiaModels(controller.signal)
      .then((catalog) => setModels(catalog.models))
      .catch(() => {
        // 目錄載入失敗時首頁仍可完整瀏覽,只是不顯示模型區。
      });
    loadAutonomiaBrandManifest(controller.signal)
      .then((manifest) => {
        setBrands(new Map(manifest.assets.map((asset) => [asset.id, asset])));
      })
      .catch(() => {
        // 品牌 manifest 是裝飾性的;失敗時退回字母徽章。
      });
    return () => controller.abort();
  }, []);

  const consoleHref = user ? "/overview" : "/login";
  const quickstartModel = models[0]?.id ?? "autonomia/gpt-5.2";
  const quickstart = React.useMemo(
    () => buildCodeExamples(getAutonomiaPublicApiRoot(), quickstartModel).curl.code,
    [quickstartModel],
  );

  return (
    <div className="home">
      <StarfieldCanvas />

      <header className="home-topbar">
        <Link className="home-brand" to="/home">
          <AutonomiaIcon size={26} />
          <strong>Autonomia</strong>
        </Link>
        <nav className="home-topnav">
          <Link to="/models">模型</Link>
          <Link to="/docs">文件</Link>
          <Link className="btn btn-sm" to={consoleHref}>
            {user ? "控制台" : "登入"}
          </Link>
        </nav>
      </header>

      <main className="home-main">
        <section className="home-hero">
          <span className="home-badge">自託管・OpenAI 相容 AI 閘道</span>
          <h1>
            散落的星，連成<span className="home-hero-em">你的星座</span>
          </h1>
          <p>
            {
              "每一家模型，都是夜空中獨自閃爍的星。Autonomia 用一個 OpenAI 相容端點把它們連起來：選路、計費、金鑰，全都留在你自己的星系裡。"
            }
          </p>
          <div className="home-cta">
            <Link className="btn btn-primary" to={consoleHref}>
              {user ? "進入控制台" : "開始使用"}
            </Link>
            <Link className="btn" to="/docs">
              閱讀文件
            </Link>
          </div>
        </section>

        <div className="home-metrics">
          <div className="home-metric">
            <strong>{models.length > 0 ? models.length : "—"}</strong>
            <span>款模型</span>
          </div>
          <div className="home-metric">
            <strong>{PROVIDERS.length}</strong>
            <span>家供應商</span>
          </div>
          <div className="home-metric">
            <strong>100%</strong>
            <span>OpenAI 相容</span>
          </div>
          <div className="home-metric">
            <strong>MIT</strong>
            <span>開源授權</span>
          </div>
        </div>

        <section className="home-features" aria-label="核心功能">
          {FEATURES.map((feature) => (
            <article className="home-feature" key={feature.title}>
              {feature.icon}
              <h2>{feature.title}</h2>
              <p>{feature.body}</p>
            </article>
          ))}
        </section>

        {models.length > 0 && (
          <section className="home-section">
            <header className="home-section-head">
              <div>
                <h2>模型星圖</h2>
                <p>一個閘道，連起各家前沿模型。價格公開，按實際用量計費。</p>
              </div>
              <Link className="home-section-link" to="/models">
                展開完整星圖 →
              </Link>
            </header>
            <div className="home-model-grid">
              {models.slice(0, 6).map((model) => {
                const brand = brands.get(model.owner_brand_asset_id);
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
                        <dt>上下文</dt>
                        <dd>{formatModelLimit(model.context_window_tokens)}</dd>
                      </div>
                      <div>
                        <dt>輸入 / 1M</dt>
                        <dd>{formatUsd(model.billing.input_usd_per_million_tokens)}</dd>
                      </div>
                      <div>
                        <dt>輸出 / 1M</dt>
                        <dd>{formatUsd(model.billing.output_usd_per_million_tokens)}</dd>
                      </div>
                    </dl>
                  </article>
                );
              })}
            </div>
            <ul className="home-providers" aria-label="支援的模型供應商">
              {PROVIDERS.map((provider) => (
                <li className="home-provider" key={provider.id}>
                  <img src={provider.asset} alt="" loading="lazy" />
                  <span>{provider.name}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="home-quickstart" id="quickstart">
          <h2>五分鐘，點亮第一顆星</h2>
          <p>把 baseURL 換成閘道網址，其餘一行都不用動。</p>
          <div className="home-code">
            <div className="home-code-head">
              <span>curl · chat/completions</span>
              <CopyButton value={quickstart} label="複製指令" />
            </div>
            <pre>
              <code>{quickstart}</code>
            </pre>
          </div>
        </section>

        <section className="home-section" aria-label="接入步驟">
          <header className="home-section-head">
            <div>
              <h2>從一顆星，到一張星圖</h2>
              <p>不用重寫應用，也不用搬資料。</p>
            </div>
          </header>
          <ol className="home-steps">
            {STEPS.map((step, index) => (
              <li className="home-step" key={step.title}>
                <span className="home-step-index">{String(index + 1).padStart(2, "0")}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="home-final">
          <h2>整片星空，留在自己家</h2>
          <p>
            {
              "從一個 SQLite 檔案開始，慢慢長成你自己的星座。自託管、可觀測、分毫清楚——星圖與資料，都不必交給別人。"
            }
          </p>
          <div className="home-cta">
            <Link className="btn btn-primary" to={consoleHref}>
              {user ? "進入控制台" : "開始使用"}
            </Link>
            <Link className="btn" to="/models">
              瀏覽模型
            </Link>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <span>
          <AutonomiaIcon size={16} />© 2026 Autonomia · MIT License
        </span>
        <nav>
          <Link to="/models">模型目錄</Link>
          <Link to="/docs">文件</Link>
          <Link to="/login">登入</Link>
        </nav>
      </footer>
    </div>
  );
}
