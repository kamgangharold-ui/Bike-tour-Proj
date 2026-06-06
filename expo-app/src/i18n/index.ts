// ─── i18n (react-i18next) ─────────────────────────────────────────────────────────
// App-wide UI localization for the six supported languages. The SAME `appLocale`
// (settings store) drives this, STT, TTS and the AI reply language — there is ONE
// language control in Settings. Components use useTranslation()/t() and re-render
// instantly on language change (no reload).
//
// Init order is handled by the root layout: persisted appLocale → device locale →
// EN fallback (appLocale itself already defaults to deviceDefaultLocale()).
//
// Scope: this localizes the app's OWN text. Static Firestore content (landmark
// descriptions, quizzes, FAQs) is seeded in English — translating that is a separate
// effort. BikAI chat already replies in the user's language.

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { type AppLocale, deviceDefaultLocale } from '../utils/locale';
import en from './locales/en.json';
import es from './locales/es.json';
import ca from './locales/ca.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import it from './locales/it.json';

export const resources = {
  en: { translation: en },
  es: { translation: es },
  ca: { translation: ca },
  fr: { translation: fr },
  de: { translation: de },
  it: { translation: it },
} as const;

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: deviceDefaultLocale(),
    fallbackLng: 'en',
    interpolation: { escapeValue: false }, // React already escapes
    returnNull: false,
  });
}

// Switch the UI language. Call alongside setAppLocale so UI + voice stay in sync.
export function setI18nLanguage(locale: AppLocale): void {
  if (i18n.language !== locale) void i18n.changeLanguage(locale);
}

export default i18n;
