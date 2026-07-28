import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const toggle = () => {
    const next = i18n.language === 'uk' ? 'en' : 'uk';
    i18n.changeLanguage(next);
    localStorage.setItem('grc-lang', next);
  };

  return (
    <button
      onClick={toggle}
      className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-neutral-20 text-neutral-340 hover:bg-neutral-30 transition-colors"
    >
      {i18n.language === 'uk' ? 'EN' : 'UA'}
    </button>
  );
}
