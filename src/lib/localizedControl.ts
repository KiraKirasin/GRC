/** Pick localized control title/description from bilingual DB fields. */
export type AppLang = 'uk' | 'en' | 'ru';

export function normalizeAppLang(lang: string | undefined): AppLang {
  const l = (lang || 'uk').toLowerCase().split('-')[0];
  if (l === 'en' || l === 'ru' || l === 'uk') return l;
  return 'uk';
}

export function localeForLang(lang: string | undefined): string {
  switch (normalizeAppLang(lang)) {
    case 'en':
      return 'en-GB';
    case 'ru':
      return 'ru-RU';
    default:
      return 'uk-UA';
  }
}

/**
 * Supports:
 * - "English title | Українська назва | Русское название"
 * - "English title | Українська назва" (RU falls back to UK)
 * - "EN: ...\n\nUK: ...\n\nRU: ..."
 * - plain single-language text
 */
export function localizedControlText(raw: string | null | undefined, lang: string | undefined): string {
  const text = String(raw || '').trim();
  if (!text) return '';

  const appLang = normalizeAppLang(lang);

  if (/^EN:\s*/m.test(text) || /^UK:\s*/m.test(text) || /^RU:\s*/m.test(text)) {
    const en = text.match(/EN:\s*([\s\S]*?)(?=\n\n(?:UK|RU):|$)/i)?.[1]?.trim();
    const uk = text.match(/UK:\s*([\s\S]*?)(?=\n\n(?:EN|RU):|$)/i)?.[1]?.trim();
    const ru = text.match(/RU:\s*([\s\S]*?)(?=\n\n(?:EN|UK):|$)/i)?.[1]?.trim();
    if (appLang === 'en') return en || uk || ru || text;
    if (appLang === 'ru') return ru || uk || en || text;
    return uk || ru || en || text;
  }

  if (text.includes(' | ')) {
    const parts = text.split(/\s*\|\s*/).map((p) => p.trim()).filter(Boolean);
    const [en, uk, ru] = parts;
    if (appLang === 'en') return en || uk || ru || text;
    if (appLang === 'ru') return ru || uk || en || text;
    return uk || ru || en || text;
  }

  return text;
}
