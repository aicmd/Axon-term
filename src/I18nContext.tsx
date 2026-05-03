import React, { createContext, useContext, useState, useCallback } from 'react';
import { dict, Language, TranslationKey } from './i18n';

interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem('axon-lang');
    return (saved as Language) || 'en';
  });

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('axon-lang', newLang);
  }, []);

  const t = useCallback((key: TranslationKey) => {
    const currentDict = dict[lang] as Record<TranslationKey, string>;
    const fallbackDict = dict['en'] as Record<TranslationKey, string>;
    return currentDict[key] || fallbackDict[key] || key;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used within I18nProvider');
  return context;
};
