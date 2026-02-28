'use client';

import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function LanguageSelector() {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fermer le dropdown au clic extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleLanguageChange = (lang: 'fr' | 'en') => {
    setLanguage(lang);
    setIsOpen(false);
  };

  // Drapeau France SVG - rond, même taille que l'avatar connexion
  const FranceFlag = () => (
    <svg viewBox="0 0 900 600" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: '100%' }}>
      <rect fill="#ED2939" width="900" height="600"/>
      <rect fill="#fff" width="600" height="600"/>
      <rect fill="#002395" width="300" height="600"/>
    </svg>
  );

  // Drapeau Royaume-Uni SVG - rond, même taille que l'avatar connexion
  const UKFlag = () => (
    <svg viewBox="0 0 60 30" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: '100%' }}>
      <clipPath id="s">
        <path d="M0,0 v30 h60 v-30 z"/>
      </clipPath>
      <clipPath id="t">
        <path d="M30,15 h30 v15 z v-15 h-30 z h-30 v15 z v-15 h30 z"/>
      </clipPath>
      <g clipPath="url(#s)">
        <path d="M0,0 v30 h60 v-30 z" fill="#012169"/>
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6"/>
        <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#t)" stroke="#C8102E" strokeWidth="4"/>
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10"/>
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6"/>
      </g>
    </svg>
  );

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bouton sélecteur de langue — cercle identique au bouton connexion */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-full overflow-hidden border border-transparent hover:border-[#FF6B00] shadow-md transition-all duration-200 flex items-center justify-center p-0"
        aria-label="Changer la langue"
        title={language === 'fr' ? 'Français' : 'English'}
      >
        <div className="w-full h-full">
          {language === 'fr' ? <FranceFlag /> : <UKFlag />}
        </div>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
          {/* Option Français */}
          <button
            onClick={() => handleLanguageChange('fr')}
            className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${
              language === 'fr' ? 'bg-orange-50 border-l-4 border-[#FF6B00]' : ''
            }`}
          >
            <div className="w-6 h-6 rounded overflow-hidden flex-shrink-0 shadow-sm"><FranceFlag /></div>
            <span className="font-medium text-gray-800">Français</span>
            {language === 'fr' && (
              <svg className="w-5 h-5 text-[#FF6B00] ml-auto" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          {/* Option English */}
          <button
            onClick={() => handleLanguageChange('en')}
            className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${
              language === 'en' ? 'bg-orange-50 border-l-4 border-[#FF6B00]' : ''
            }`}
          >
            <div className="w-6 h-6 rounded overflow-hidden flex-shrink-0 shadow-sm"><UKFlag /></div>
            <span className="font-medium text-gray-800">English</span>
            {language === 'en' && (
              <svg className="w-5 h-5 text-[#FF6B00] ml-auto" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          {/* Note en bas */}
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              {language === 'fr' ? 'Choisissez votre langue' : 'Select your language'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
