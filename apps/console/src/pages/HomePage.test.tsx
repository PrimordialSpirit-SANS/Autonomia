// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSession } from "../components/session";
import { I18nProvider } from "../i18n";
import { setCurrentLanguage } from "../i18n/core";
import {
  loadAutonomiaBrandManifest,
  loadAutonomiaModels,
} from "../lib/autonomia/catalog/loadAutonomiaCatalog";
import type { AutonomiaModel, AutonomiaModelsCatalog } from "../lib/autonomia/types";
import { HomePage } from "./HomePage";

vi.mock("../components/session", () => ({ useSession: vi.fn() }));
vi.mock("../lib/autonomia/catalog/loadAutonomiaCatalog", () => ({
  loadAutonomiaModels: vi.fn(),
  loadAutonomiaBrandManifest: vi.fn(),
}));

const model: AutonomiaModel = {
  id: "autonomia/test-chat",
  display_name: "Test Chat",
  owner: "Test Provider",
  owner_brand_asset_id: "test",
  description: "",
  status: "available",
  capabilities: ["chat"],
  input_modalities: ["text"],
  output_modalities: ["text"],
  context_window_tokens: 128000,
  max_output_tokens: 8192,
  provider_ids: [],
  tags: [],
  official_docs_url: "",
  billing: {
    input_usd_per_million_tokens: "2.00",
    output_usd_per_million_tokens: "6.00",
    minimum_charge_usd: "0.0001",
  },
};
const secondModel: AutonomiaModel = {
  ...model,
  id: "autonomia/second-chat",
  display_name: "Second Chat",
  owner: "Second Provider",
  billing: { ...model.billing, input_usd_per_million_tokens: "1.00" },
};
const catalog: AutonomiaModelsCatalog = {
  schema_version: 1,
  pricing_revision: "test",
  updated_at: "2026-11-06",
  billing_disclaimer: "",
  models: [
    model,
    secondModel,
    { ...model, id: "autonomia/embedding", display_name: "Embedding", capabilities: ["embeddings"] },
    { ...model, id: "autonomia/maintenance", display_name: "Maintenance", status: "maintenance" as const },
  ],
};

function renderHome() {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <HomePage />
      </I18nProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  setCurrentLanguage("en");
  vi.mocked(useSession).mockReturnValue({ user: null, loading: false, setUser: vi.fn(), refresh: vi.fn() });
  vi.mocked(loadAutonomiaModels).mockResolvedValue(catalog);
  vi.mocked(loadAutonomiaBrandManifest).mockResolvedValue({ schema_version: 1, updated_at: "", assets: [] });
});
afterEach(cleanup);

describe("HomePage", () => {
  it("only offers available chat models for a chat request", async () => {
    renderHome();
    const select = await screen.findByRole("combobox", { name: "Example model" });
    await waitFor(() => expect(within(select).getAllByRole("option")).toHaveLength(2));
    expect(within(select).getByRole("option", { name: "Test Chat" })).toBeTruthy();
    expect(within(select).queryByRole("option", { name: "Embedding" })).toBeNull();
    expect(within(select).queryByRole("option", { name: "Maintenance" })).toBeNull();
  });

  it("keeps the model and pricing in sync across code formats", async () => {
    renderHome();
    const select = await screen.findByRole("combobox", { name: "Example model" });
    await screen.findByRole("region", { name: "Code format: curl" });
    fireEvent.change(select, { target: { value: secondModel.id } });
    expect(screen.getByRole("region", { name: "Code format: curl" }).textContent).toContain(secondModel.id);
    expect(document.querySelector(".landing-model-pricing")?.textContent).toContain("$1.00");
    fireEvent.click(screen.getByRole("button", { name: "Python" }));
    const python = screen.getByRole("region", { name: "Code format: python" });
    expect(python.textContent).toContain("from openai import OpenAI");
    expect(python.textContent).toContain(secondModel.id);
    expect(screen.getByRole("button", { name: "Python" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("copies a runnable request without line numbers or a fabricated response", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderHome();
    fireEvent.click(await screen.findByRole("button", { name: "Copy" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied.startsWith("curl ")).toBe(true);
    expect(copied).toContain("Content-Type: application/json");
    expect(copied).toContain("$AUTONOMIA_API_KEY");
    expect(copied).toContain(model.id);
    expect(copied).not.toContain("data: {");
    expect(copied).not.toContain("$ curl");
    expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy();
  });

  it("keeps navigation available when the catalog fails", async () => {
    vi.mocked(loadAutonomiaModels).mockRejectedValue(new Error("offline"));
    renderHome();
    await waitFor(() =>
      expect(screen.getAllByRole("status")[0].textContent).toContain("catalog is unavailable"),
    );
    expect((screen.getByRole("combobox", { name: "Example model" }) as HTMLSelectElement).disabled).toBe(
      true,
    );
    expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();
    expect(screen.getByRole("link", { name: "Get started" }).getAttribute("href")).toBe("/login");
    expect(screen.getByRole("link", { name: "View all models" }).getAttribute("href")).toBe("/models");
  });

  it("does not invent a model when the catalog contains no chat models", async () => {
    vi.mocked(loadAutonomiaModels).mockResolvedValue({ ...catalog, models: [] });
    renderHome();
    await waitFor(() =>
      expect(screen.getAllByRole("status")[0].textContent).toBe("No chat models available"),
    );
    expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();
  });

  it("preserves names and prices when brand assets cannot load", async () => {
    vi.mocked(loadAutonomiaBrandManifest).mockRejectedValue(new Error("offline"));
    renderHome();
    expect(await screen.findByText("Test Chat", { selector: ".landing-model-name strong" })).toBeTruthy();
    expect(screen.getAllByText("$2.00").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("img", { name: "Test Provider" }).length).toBeGreaterThan(0);
  });
});
