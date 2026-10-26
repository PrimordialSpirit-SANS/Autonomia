import { afterEach, describe, expect, it, vi } from "vitest";
import { setCurrentLanguage } from "../../../i18n/core";
import {
  loadAutonomiaBrandManifest,
  loadAutonomiaModels,
  loadAutonomiaProviderOfferings,
} from "./loadAutonomiaCatalog";

// 載入失敗訊息由 i18n 產生;固定 zh-TW 讓既有斷言確定。
setCurrentLanguage("zh-TW");

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadAutonomiaModels", () => {
  it("returns a valid catalog", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(200, {
        schema_version: 1,
        pricing_revision: "rev-1",
        updated_at: "2026-01-01",
        models: [{ id: "autonomia-mini" }],
      }),
    );
    const catalog = await loadAutonomiaModels();
    expect(catalog.pricing_revision).toBe("rev-1");
    expect(catalog.models).toHaveLength(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/data/autonomia/models.v1.json",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("rejects unsupported schema versions", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(200, { schema_version: 2 }));
    await expect(loadAutonomiaModels()).rejects.toThrow("格式版本不受支援");
  });

  it("rejects catalogs with missing required fields", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(200, { schema_version: 1, models: [{ name: "no-id" }] }),
    );
    await expect(loadAutonomiaModels()).rejects.toThrow("缺少必要欄位");
  });

  it("surfaces HTTP failures with the status code", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(404, {}));
    await expect(loadAutonomiaModels()).rejects.toThrow("HTTP 404");
  });
});

describe("loadAutonomiaProviderOfferings", () => {
  it("requires autonomia_point currency and per million tokens billing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(200, {
        schema_version: 1,
        pricing_revision: "rev-1",
        currency: "usd",
        billing_unit: "per_million_tokens",
        offerings: [],
      }),
    );
    await expect(loadAutonomiaProviderOfferings()).rejects.toThrow("缺少必要欄位");
  });

  it("returns valid offerings", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(200, {
        schema_version: 1,
        pricing_revision: "rev-1",
        currency: "autonomia_point",
        billing_unit: "per_million_tokens",
        offerings: [{ id: "offering-1" }],
      }),
    );
    const offerings = await loadAutonomiaProviderOfferings();
    expect(offerings.offerings).toHaveLength(1);
  });
});

describe("loadAutonomiaBrandManifest", () => {
  it("validates asset identifiers", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(200, { schema_version: 1, assets: [{ src: "no-id.png" }] }),
    );
    await expect(loadAutonomiaBrandManifest()).rejects.toThrow("缺少必要欄位");
  });

  it("returns a valid manifest", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(200, { schema_version: 1, assets: [{ id: "logo" }] }),
    );
    const manifest = await loadAutonomiaBrandManifest();
    expect(manifest.assets).toHaveLength(1);
  });
});
