import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import pt from './locales/pt.json';
import zh from './locales/zh.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import ar from './locales/ar.json';
import ca from './locales/ca.json';
import gl from './locales/gl.json';
import eu from './locales/eu.json';
import ru from './locales/ru.json';
import it from './locales/it.json';
import nl from './locales/nl.json';
import sv from './locales/sv.json';
import pl from './locales/pl.json';
import tr from './locales/tr.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      fr: { translation: fr },
      de: { translation: de },
      pt: { translation: pt },
      zh: { translation: zh },
      ja: { translation: ja },
      ko: { translation: ko },
      ar: { translation: ar },
      ca: { translation: ca },
      gl: { translation: gl },
      eu: { translation: eu },
      ru: { translation: ru },
      it: { translation: it },
      nl: { translation: nl },
      sv: { translation: sv },
      pl: { translation: pl },
      tr: { translation: tr }
    },
    fallbackLng: 'en',
    supportedLngs: [
      'en', 'es', 'fr', 'de', 'pt', 'zh', 'ja', 'ko', 'ar', 'ca', 'gl', 'eu',
      'ru', 'it', 'nl', 'sv', 'pl', 'tr'
    ],
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    }
  });

i18n.on('languageChanged', (lng) => {
  document.documentElement.dir = (lng === 'ar') ? 'rtl' : 'ltr';
  document.documentElement.lang = lng;
});

export default i18n;
