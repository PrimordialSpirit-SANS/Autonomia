import { type TranslationKey, t } from "../../../i18n/core";
import type {
  AutonomiaBrandManifest,
  AutonomiaModelsCatalog,
  AutonomiaProviderOfferingsCatalog,
} from "../types";

const CATALOG_ROOT = "/data/autonomia";
const BRAND_MANIFEST_PATH = "/brand/autonomia/providers/manifest.v1.json";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertBaseCatalog(
  value: unknown,
  labelKey: TranslationKey,
): asserts value is Record<string, unknown> {
  if (!isRecord(value) || value.schema_version !== 1) {
    throw new Error(t("errors.catalogUnsupportedFormat", { name: t(labelKey) }));
  }
}

async function fetchStaticJson(path: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(path, {
    signal,
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(t("errors.catalogLoadFailed", { path, status: response.status }));
  }
  return response.json() as Promise<unknown>;
}

export async function loadAutonomiaModels(signal?: AbortSignal): Promise<AutonomiaModelsCatalog> {
  const value = await fetchStaticJson(`${CATALOG_ROOT}/models.v1.json`, signal);
  assertBaseCatalog(value, "catalog.modelsName");
  if (
    typeof value.pricing_revision !== "string" ||
    typeof value.updated_at !== "string" ||
    !Array.isArray(value.models) ||
    value.models.some((model) => !isRecord(model) || typeof model.id !== "string")
  ) {
    throw new Error(t("errors.catalogModelsMissing"));
  }
  return value as unknown as AutonomiaModelsCatalog;
}

export async function loadAutonomiaProviderOfferings(
  signal?: AbortSignal,
): Promise<AutonomiaProviderOfferingsCatalog> {
  const value = await fetchStaticJson(`${CATALOG_ROOT}/provider-offerings.v1.json`, signal);
  assertBaseCatalog(value, "catalog.offeringsName");
  if (
    typeof value.pricing_revision !== "string" ||
    value.currency !== "autonomia_point" ||
    value.billing_unit !== "per_million_tokens" ||
    !Array.isArray(value.offerings) ||
    value.offerings.some((offering) => !isRecord(offering) || typeof offering.id !== "string")
  ) {
    throw new Error(t("errors.catalogOfferingsMissing"));
  }
  return value as unknown as AutonomiaProviderOfferingsCatalog;
}

export async function loadAutonomiaBrandManifest(signal?: AbortSignal): Promise<AutonomiaBrandManifest> {
  const value = await fetchStaticJson(BRAND_MANIFEST_PATH, signal);
  assertBaseCatalog(value, "catalog.brandName");
  if (
    !Array.isArray(value.assets) ||
    value.assets.some((asset) => !isRecord(asset) || typeof asset.id !== "string")
  ) {
    throw new Error(t("errors.catalogBrandMissing"));
  }
  return value as unknown as AutonomiaBrandManifest;
}
