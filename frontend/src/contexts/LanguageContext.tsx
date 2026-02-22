'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { formatDate as formatDateUtil, formatDateTime as formatDateTimeUtil, formatTime as formatTimeUtil } from '@/lib/i18n-utils';

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
  const [translations, setTranslations] = useState<Record<string, string>>({});

  // Charger la langue sauvegardée au montage
  useEffect(() => {
    const savedLanguage = localStorage.getItem('language') as Language;
    if (savedLanguage && (savedLanguage === 'fr' || savedLanguage === 'en')) {
      setLanguageState(savedLanguage);
    }
  }, []);

  // Charger les traductions quand la langue change
  useEffect(() => {
    loadTranslations(language);
  }, [language]);

  const loadTranslations = async (lang: Language) => {
    try {
      const module = await import(`@/locales/${lang}.json`);
      setTranslations(module.default);
    } catch (error) {
      console.error(`Erreur chargement traductions ${lang}:`, error);
      // Fallback vers français si erreur
      if (lang !== 'fr') {
        const fallback = await import('@/locales/fr.json');
        setTranslations(fallback.default);
      }
    }
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
    // Changer la langue du HTML
    document.documentElement.lang = lang;
  };

  // Fonction de traduction avec fallback
  const t = (key: string): string => {
    const keys = key.split('.');
    let value: any = translations;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        console.warn(`Traduction manquante pour: ${key}`);
        return key; // Retourner la clé si traduction non trouvée
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
