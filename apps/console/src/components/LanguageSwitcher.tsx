import { LANGUAGES, type Lang, useI18n } from "../i18n";

// 語言切換器:以原生 select 實作,鍵盤操作與行動裝置皆可直接使用。
// 放置位置:控制台側欄、公開頁頂欄與登入頁;樣式由 .lang-switch 控制。

export function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();
  return (
    <label className="lang-switch">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.7 2.6 4 5.6 4 9s-1.3 6.4-4 9c-2.7-2.6-4-5.6-4-9s1.3-6.4 4-9Z" />
      </svg>
      <select
        className="select"
        value={lang}
        onChange={(event) => setLang(event.target.value as Lang)}
        aria-label={t("common.language")}
      >
        {LANGUAGES.map((item) => (
          <option key={item.code} value={item.code}>
            {item.nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}
