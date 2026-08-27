import { useTranslation } from 'react-i18next';

const LANGS = [
  { code: 'uk', label: 'UA' },
  { code: 'en', label: 'EN' },
  { code: 'ru', label: 'RU' },
] as const;

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = (i18n.language || 'uk').split('-')[0];

  const setLang = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem('grc-lang', code);
  };

  return (
    <div className="inline-flex rounded-lg bg-neutral-20 p-0.5 gap-0.5" role="group" aria-label="Language">
      {LANGS.map(({ code, label }) => {
        const active = current === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
              active
                ? 'bg-white text-brand-600 shadow-sm'
                : 'text-neutral-340 hover:text-gray-900'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
