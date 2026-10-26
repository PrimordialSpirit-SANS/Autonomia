import React from "react";
import {
  currentLanguage,
  htmlLangFor,
  type Lang,
  setCurrentLanguage,
  type TranslationKey,
  translate,
} from "./core";

// React 端的 i18n context:切換語言時觸發取用元件 re-render,
// 並同步 <html lang>、文件標題與 meta description(利於 SEO 與無障礙)。

export {
  type Dictionary,
  intlLocaleFor,
  LANGUAGES,
  type Lang,
  modelDescription,
  type TranslationKey,
  translate,
} from "./core";

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = React.createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<Lang>(() => currentLanguage());

  React.useEffect(() => {
    document.documentElement.lang = htmlLangFor(lang);
    document.title = translate("meta.title");
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", translate("meta.description"));
  }, [lang]);

  const value = React.useMemo<I18nValue>(
    () => ({
      lang,
      setLang: (next: Lang) => {
        setCurrentLanguage(next);
        setLangState(next);
      },
      t: translate,
    }),
    [lang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = React.useContext(I18nContext);
  if (!value) throw new Error("useI18n 必須在 <I18nProvider> 內使用。");
  return value;
}
