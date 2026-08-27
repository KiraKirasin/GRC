import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en';
import uk from './uk';
import ru from './ru';

const savedLang = localStorage.getItem('grc-lang') || 'uk';
const supported = new Set(['uk', 'en', 'ru']);
const lng = supported.has(savedLang) ? savedLang : 'uk';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    uk: { translation: uk },
    ru: { translation: ru },
  },
  lng,
  fallbackLng: 'uk',
  interpolation: { escapeValue: false },
});

export default i18n;
