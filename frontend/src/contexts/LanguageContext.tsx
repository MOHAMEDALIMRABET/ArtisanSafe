'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { formatDate as formatDateUtil, formatDateTime as formatDateTimeUtil, formatTime as formatTimeUtil } from '@/lib/i18n-utils';
// Imports statiques — webpack HMR détecte correctement les changements
// (les imports dynamiques avec template literal sont mis en cache et ne se rechargent pas)
import frTranslations from '@/locales/fr.json';
import enTranslations from '@/locales/en.json';

const TRANSLATION_FILES: Record<'fr' | 'en', Record<string, unknown>> = {
  fr: frTranslations as Record<string, unknown>,
  en: enTranslations as Record<string, unknown>,
};

type Language = 'fr' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  formatDate: (date: Date | { toDate: () => Date } | string, options?: Intl.DateTimeFormatOptions) => string;
  formatDateTime: (date: Date | { toDate: () => Date } | string) => string;
  formatTime: (date: Date | { toDate: () => Date } | string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>('fr');
  // Initialisation directe avec fr (évite le flash de clés brutes au premier render)
  const [translations, setTranslations] = useState<Record<string, unknown>>(TRANSLATION_FILES['fr']);

  // Lire la langue sauvegardée et charger les traductions correspondantes
  useEffect(() => {
    const savedLanguage = localStorage.getItem('language') as Language;
    if (savedLanguage && (savedLanguage === 'fr' || savedLanguage === 'en')) {
      setLanguageState(savedLanguage);
      setTranslations(TRANSLATION_FILES[savedLanguage]);
      document.documentElement.lang = savedLanguage;
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    setTranslations(TRANSLATION_FILES[lang]);
    localStorage.setItem('language', lang);
    document.documentElement.lang = lang;
  };

  // Fonction de traduction avec fallback sur la clé brute
  const t = (key: string): string => {
    const keys = key.split('.');
    let value: unknown = translations;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in (value as Record<string, unknown>)) {
        value = (value as Record<string, unknown>)[k];
      } else {
        console.warn(`Traduction manquante pour: ${key}`);
        return key;
      }
    }
    
    return typeof value === 'string' ? value : key;
  };

  // Fonctions de formatage avec la langue active
  const formatDate = (date: Date | { toDate: () => Date } | string, options?: Intl.DateTimeFormatOptions) => {
    return formatDateUtil(date, language, options);
  };

  const formatDateTime = (date: Date | { toDate: () => Date } | string) => {
    return formatDateTimeUtil(date, language);
  };

  const formatTime = (date: Date | { toDate: () => Date } | string) => {
    return formatTimeUtil(date, language);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, formatDate, formatDateTime, formatTime }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
