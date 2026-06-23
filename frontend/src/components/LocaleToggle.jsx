import { useI18n, LOCALES } from "../i18n";

export default function LocaleToggle() {
  const { locale, setLocale } = useI18n();
  return (
    <div className="locale-toggle" role="group" aria-label="Language">
      {LOCALES.map((l) => (
        <button
          key={l.code}
          className={l.code === locale ? "active" : ""}
          aria-pressed={l.code === locale}
          onClick={() => setLocale(l.code)}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
