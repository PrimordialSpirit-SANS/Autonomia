// 附 .ts 副檔名:此檔會被 packages/core 的 Node 測試直接載入,
// Node 原生 ESM 的相對匯入必須帶副檔名(Vite 兩者皆可)。
import { de } from "./de.ts";
import { en } from "./en.ts";
import { fr } from "./fr.ts";
import { ja } from "./ja.ts";
import { zhCN } from "./zh-CN.ts";
import { zhTW } from "./zh-TW.ts";

// i18n 核心(不依賴 React):React 端在 index.tsx 以 context 包裝,
// lib 層(錯誤訊息、格式化工具)直接使用 translate/currentLanguage。
// 英文為預設語言與字典型別的來源;新增語言時擴充 LANGUAGES 並補上字典檔。

export const LANGUAGES = [
  { code: "en", nativeName: "English" },
  { code: "zh-TW", nativeName: "繁體中文" },
  { code: "zh-CN", nativeName: "简体中文" },
  { code: "ja", nativeName: "日本語" },
  { code: "de", nativeName: "Deutsch" },
  { code: "fr", nativeName: "Français" },
] as const;

export type Lang = (typeof LANGUAGES)[number]["code"];

// 字典型別:以英文字典為基準,所有語系都必須提供完整鍵值(編譯期檢查)。
export type Dictionary = typeof en;

// 鍵為「區段.字串」兩層結構(如 "nav.overview");以非遞迴方式展開,
// 遞迴寫法在這個規模的字典上會觸發 TS2589(型別實作過深)。
// 若未來字典出現第三層,需在此擴充。
type SectionKeys<T> = { [K in keyof T & string]: T[K] extends string ? K : never }[keyof T & string];

type FlatKeys<T> = { [K in keyof T & string]: T[K] extends string ? K : never }[keyof T & string];

type NestedKeys<T> = {
  [K in keyof T & string]: T[K] extends string ? never : `${K}.${SectionKeys<T[K]> & string}`;
}[keyof T & string];

export type TranslationKey = FlatKeys<Dictionary> | NestedKeys<Dictionary>;

const DICTIONARIES: Record<Lang, Dictionary> = {
  en,
  "zh-TW": zhTW,
  "zh-CN": zhCN,
  ja,
  de,
  fr,
};

// Intl API(數字分組、日期格式)使用的完整 locale 標籤。
const INTL_LOCALES: Record<Lang, string> = {
  en: "en-US",
  "zh-TW": "zh-TW",
  "zh-CN": "zh-CN",
  ja: "ja-JP",
  de: "de-DE",
  fr: "fr-FR",
};

// <html lang> 使用的標籤;中文需標注繁簡書寫系統。
const HTML_LANGS: Record<Lang, string> = {
  en: "en",
  "zh-TW": "zh-Hant",
  "zh-CN": "zh-Hans",
  ja: "ja",
  de: "de",
  fr: "fr",
};

export const DEFAULT_LANGUAGE: Lang = "en";
const STORAGE_KEY = "autonomia.console.lang";

function isLang(value: unknown): value is Lang {
  return typeof value === "string" && Object.hasOwn(DICTIONARIES, value);
}

// 把瀏覽器語言標籤(zh-Hant-TW、de-AT…)對應到支援的語系;
// 僅指定 "zh" 時依 CLDR 慣例視為簡體中文。
export function normalizeLanguageTag(tag: string): Lang | null {
  const normalized = tag.toLowerCase();
  if (normalized.startsWith("zh")) {
    return /tw|hant|hk|mo/.test(normalized) ? "zh-TW" : "zh-CN";
  }
  if (normalized.startsWith("ja")) return "ja";
  if (normalized.startsWith("de")) return "de";
  if (normalized.startsWith("fr")) return "fr";
  if (normalized.startsWith("en")) return "en";
  return null;
}

// 偵測順序:localStorage 記住的使用者偏好 > 瀏覽器語言清單 > 英文(預設)。
export function detectLanguage(): Lang {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (isLang(stored)) return stored;
  } catch {
    // localStorage 不可用(隱私模式、非瀏覽器環境)時退回瀏覽器語言。
  }
  const candidates =
    typeof navigator !== "undefined"
      ? (navigator.languages ?? (navigator.language ? [navigator.language] : []))
      : [];
  for (const candidate of candidates) {
    const normalized = normalizeLanguageTag(String(candidate));
    if (normalized) return normalized;
  }
  return DEFAULT_LANGUAGE;
}

let current: Lang = detectLanguage();

export function currentLanguage(): Lang {
  return current;
}

// 切換當前語系並持久化;React 端由 I18nProvider 呼叫後觸發 re-render。
export function setCurrentLanguage(lang: Lang): void {
  current = lang;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, lang);
  } catch {
    // 持久化失敗不影響當前 session 的語言切換。
  }
}

export function intlLocaleFor(lang: Lang = current): string {
  return INTL_LOCALES[lang];
}

export function htmlLangFor(lang: Lang): string {
  return HTML_LANGS[lang];
}

function lookupPath(dictionary: Dictionary, path: string): string | undefined {
  let node: unknown = dictionary;
  for (const segment of path.split(".")) {
    if (typeof node !== "object" || node === null || !(segment in node)) return undefined;
    node = (node as Record<string, unknown>)[segment];
  }
  return typeof node === "string" ? node : undefined;
}

// 以當前語系翻譯;鍵不存在時退回英文,仍找不到則回傳鍵本身(便於發現漏網)。
// {name} 佔位符以 vars 的同名值替換。
export function translate(key: TranslationKey, vars?: Record<string, string | number>): string {
  let text = lookupPath(DICTIONARIES[current], key) ?? lookupPath(en, key) ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}

// lib 層(非 React 模組)使用的別名。
export const t = translate;

// 模型介紹:鍵為完整模型 ID(含「/」與「.」),不能走 translate 的點路徑查找,
// 直接以當前語系字典的 modelDescriptions 區段讀取;無對應條目時回空字串,
// 由呼叫端(ModelsPage)退回目錄內建的繁中介紹。
export function modelDescription(modelId: string): string {
  const section = DICTIONARIES[current].modelDescriptions as Record<string, string> | undefined;
  return section?.[modelId] ?? (en.modelDescriptions as Record<string, string>)[modelId] ?? "";
}
