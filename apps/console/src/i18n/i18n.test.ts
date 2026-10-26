import { describe, expect, it } from "vitest";
import catalog from "../../public/data/autonomia/models.v1.json";
import {
  DEFAULT_LANGUAGE,
  type Dictionary,
  LANGUAGES,
  modelDescription,
  normalizeLanguageTag,
  setCurrentLanguage,
  translate,
} from "./core";
import { de } from "./de";
import { en } from "./en";
import { fr } from "./fr";
import { ja } from "./ja";
import { zhCN } from "./zh-CN";
import { zhTW } from "./zh-TW";

// 收集字典所有葉節路的點路徑,用於語系完整性比對。
function leafPaths(node: unknown, prefix = ""): string[] {
  if (typeof node === "string") return [prefix];
  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
    leafPaths(value, prefix ? `${prefix}.${key}` : key),
  );
}

const LOCALES: Array<[string, Dictionary]> = [
  ["zh-TW", zhTW],
  ["zh-CN", zhCN],
  ["ja", ja],
  ["de", de],
  ["fr", fr],
];

describe("locale dictionaries", () => {
  const reference = leafPaths(en).sort();

  for (const [name, dictionary] of LOCALES) {
    it(`${name} covers every key of the English dictionary`, () => {
      expect(leafPaths(dictionary).sort()).toEqual(reference);
    });
  }

  it("registers English first as the default language", () => {
    expect(DEFAULT_LANGUAGE).toBe("en");
    expect(LANGUAGES[0]?.code).toBe("en");
    expect(LANGUAGES).toHaveLength(6);
  });
});

describe("model descriptions", () => {
  const catalogIds = catalog.models.map((model) => model.id);

  it("covers every catalog model in every language", () => {
    for (const [name, dictionary] of [["en", en] as const, ...LOCALES]) {
      const described = Object.keys(dictionary.modelDescriptions);
      for (const id of catalogIds) {
        expect(described, `${name} is missing a description for ${id}`).toContain(id);
      }
      expect(described).toHaveLength(catalogIds.length);
    }
  });

  it("returns the localized description and falls back to empty for unknown models", () => {
    setCurrentLanguage("en");
    expect(modelDescription("autonomia/gpt-6-astra")).toContain("OpenAI");
    setCurrentLanguage("de");
    expect(modelDescription("autonomia/gpt-6-astra")).toContain("OpenAIs");
    expect(modelDescription("autonomia/does-not-exist")).toBe("");
    setCurrentLanguage(DEFAULT_LANGUAGE);
  });
});

describe("translate", () => {
  it("translates for the current language and falls back to English values", () => {
    setCurrentLanguage("en");
    expect(translate("common.copy")).toBe("Copy");

    setCurrentLanguage("de");
    expect(translate("common.copy")).toBe("Kopieren");

    setCurrentLanguage("zh-TW");
    expect(translate("common.copy")).toBe("複製");
  });

  it("interpolates {var} placeholders with numbers and strings", () => {
    setCurrentLanguage("en");
    expect(translate("nav.balance", { amount: "$1.50" })).toBe("Balance $1.50");
    expect(translate("keys.replayHours", { hours: 24 })).toBe("24 h");
    expect(translate("keys.errorReplayTtl", { max: 168 })).toContain("168");
  });

  it("returns the key itself when no translation exists", () => {
    setCurrentLanguage("en");
    expect(translate("no.such.key" as never)).toBe("no.such.key");
  });
});

describe("normalizeLanguageTag", () => {
  it("maps browser tags to supported languages", () => {
    expect(normalizeLanguageTag("en-US")).toBe("en");
    expect(normalizeLanguageTag("en")).toBe("en");
    expect(normalizeLanguageTag("zh-TW")).toBe("zh-TW");
    expect(normalizeLanguageTag("zh-Hant-TW")).toBe("zh-TW");
    expect(normalizeLanguageTag("zh-HK")).toBe("zh-TW");
    expect(normalizeLanguageTag("zh")).toBe("zh-CN");
    expect(normalizeLanguageTag("zh-CN")).toBe("zh-CN");
    expect(normalizeLanguageTag("zh-SG")).toBe("zh-CN");
    expect(normalizeLanguageTag("ja-JP")).toBe("ja");
    expect(normalizeLanguageTag("de-AT")).toBe("de");
    expect(normalizeLanguageTag("fr-CA")).toBe("fr");
  });

  it("returns null for unsupported languages so detection can keep looking", () => {
    expect(normalizeLanguageTag("ko-KR")).toBeNull();
    expect(normalizeLanguageTag("pt-BR")).toBeNull();
    expect(normalizeLanguageTag("")).toBeNull();
  });
});
