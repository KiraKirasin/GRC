import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en';
import uk from './uk';

const savedLang = localStorage.getItem('grc-lang') || 'uk';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    uk: { translation: uk },
  },
  lng: savedLang,
  fallbackLng: 'uk',
  interpolation: { escapeValue: false },
});

export default i18n;
