// ─── App locale ─────────────────────────────────────────────────────────────────
// The single language model for both Google STT and expo-speech TTS. We support a
// fixed set of six; the device locale seeds the default and the user can override
// it in Settings. Anything outside the six falls back to English (and the picker
// is always available so voice never breaks). BCP-47 region codes are REQUIRED —
// Google STT and expo-speech both need e.g. "ca-ES", not bare "ca".

import * as Localization from 'expo-localization';

export type AppLocale = 'en' | 'es' | 'ca' | 'fr' | 'de' | 'it';

export const SUPPORTED_LOCALES: AppLocale[] = ['en', 'es', 'ca', 'fr', 'de', 'it'];

export const LOCALE_LABELS: Record<AppLocale, string> = {
  en: 'English',
  es: 'Español',
  ca: 'Català',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
};

const BCP47: Record<AppLocale, string> = {
  en: 'en-US',
  es: 'es-ES',
  ca: 'ca-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
};

export function isSupportedLocale(code: string): code is AppLocale {
  return (SUPPORTED_LOCALES as string[]).includes(code);
}

export function localeToBcp47(locale: AppLocale): string {
  return BCP47[locale] ?? 'en-US';
}

// Best-effort device default: first device language that is one of the six, else
// English. Never throws (background/edge contexts).
export function deviceDefaultLocale(): AppLocale {
  try {
    for (const l of Localization.getLocales()) {
      const code = (l.languageCode ?? '').slice(0, 2).toLowerCase();
      if (isSupportedLocale(code)) return code;
    }
  } catch {
    // fall through to default
  }
  return 'en';
}

// Google STT config: the selected locale as primary, up to 3 others as
// alternatives so a rider speaking another supported language is still understood.
export function sttLanguageConfig(locale: AppLocale): {
  languageCode: string;
  alternativeLanguageCodes: string[];
} {
  return {
    languageCode: localeToBcp47(locale),
    alternativeLanguageCodes: SUPPORTED_LOCALES.filter((l) => l !== locale)
      .map(localeToBcp47)
      .slice(0, 3),
  };
}
