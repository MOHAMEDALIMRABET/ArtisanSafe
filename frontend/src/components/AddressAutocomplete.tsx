'use client';

import { useState, useEffect, useRef } from 'react';

interface AddressSuggestion {
  properties: {
    label: string;        // Adresse complète
    name: string;         // Nom de la rue
    postcode: string;     // Code postal
    city: string;         // Ville
    context: string;      // Contexte (département, région)
  };
  geometry: {
    coordinates: [number, number]; // [longitude, latitude]
  };
}

// Suggestion de ville (geo.api.gouv.fr)
interface CommuneSuggestion {
  nom: string;
  codesPostaux: string[];
  codeDepartement: string;
}

interface AddressData {
  adresseComplete: string;
  rue: string;
  codePostal: string;
  ville: string;
  coordinates?: [number, number];
}

interface AddressAutocompleteProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onAddressSelect?: (address: AddressData) => void;
  placeholder?: string;
  required?: boolean;
  helper?: string;
  /** Mode ville uniquement : utilise geo.api.gouv.fr/communes (recherche par nom ou code postal) */
  mode?: 'address' | 'city';
  /** Champ code postal lié (utilisé en mode city pour pré-remplir) */
  onCitySelect?: (ville: string, codePostal: string) => void;
}

export function AddressAutocomplete({
  label,
  value,
  onChange,
  onAddressSelect,
  placeholder = "Tapez votre adresse (ex: 15 rue de la République Paris)",
  required = false,
  helper,
  mode = 'address',
  onCitySelect,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [communeSuggestions, setCommuneSuggestions] = useState<CommuneSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Fermer suggestions si clic à l'extérieur
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Recherche avec debounce (attendre 300ms après dernière frappe)
  useEffect(() => {
    if (value.length < 2) {
      setSuggestions([]);
      setCommuneSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        if (mode === 'city') {
          // Mode ville : utiliser geo.api.gouv.fr (API officielle des communes française - exhaustive)
          const isPostalCode = /^\d+$/.test(value);
          let url: string;

          if (isPostalCode) {
            // Recherche par code postal
            url = `https://geo.api.gouv.fr/communes?codePostal=${encodeURIComponent(value)}&fields=nom,codesPostaux,codeDepartement&limit=8`;
          } else {
            // Recherche par nom de commune (supporte les tirets, apostrophes, accents)
            url = `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(value)}&fields=nom,codesPostaux,codeDepartement&boost=population&limit=8`;
          }

          const response = await fetch(url);
          const data: CommuneSuggestion[] = await response.json();
          setCommuneSuggestions(data || []);
          setShowSuggestions(true);
        } else {
          // Mode adresse : utiliser l'API BAN (Base Adresse Nationale)
          const response = await fetch(
            `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(value)}&limit=5`
          );
          const data = await response.json();
          setSuggestions(data.features || []);
          setShowSuggestions(true);
        }
      } catch (error) {
        console.error('Erreur API Adresse:', error);
        setSuggestions([]);
        setCommuneSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [value, mode]);

  const handleSelect = (suggestion: AddressSuggestion) => {
    const addressData: AddressData = {
      adresseComplete: suggestion.properties.label,
      rue: suggestion.properties.name,
      codePostal: suggestion.properties.postcode,
      ville: suggestion.properties.city,
      coordinates: suggestion.geometry.coordinates
    };

    onChange(suggestion.properties.label);
    setShowSuggestions(false);
    setSuggestions([]);

    if (onAddressSelect) {
      onAddressSelect(addressData);
    }
  };

  const handleCommuneSelect = (commune: CommuneSuggestion) => {
    const codePostal = commune.codesPostaux[0] || '';
    onChange(commune.nom);
    setShowSuggestions(false);
    setCommuneSuggestions([]);

    if (onCitySelect) {
      onCitySelect(commune.nom, codePostal);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => (mode === 'city' ? communeSuggestions.length > 0 : suggestions.length > 0) && setShowSuggestions(true)}
          placeholder={placeholder}
          required={required}
          className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
        />

        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6C757D]">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}
      </div>

      {helper && (
        <p className="mt-1 text-sm text-gray-500">{helper}</p>
      )}

      {/* Liste de suggestions adresses (mode address) */}
      {mode === 'address' && showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full bg-white border border-gray-300 rounded-lg mt-1 shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <li
              key={index}
              onClick={() => handleSelect(suggestion)}
              className="px-4 py-3 hover:bg-[#F8F9FA] cursor-pointer border-b border-gray-200 last:border-b-0 transition-colors"
            >
              <div className="font-medium text-[#2C3E50]">
                {suggestion.properties.label}
              </div>
              <div className="text-xs text-[#6C757D] mt-1 flex items-center gap-1">
                <span>📍</span>
                <span>{suggestion.properties.postcode} {suggestion.properties.city}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Liste de suggestions communes (mode city) */}
      {mode === 'city' && showSuggestions && communeSuggestions.length > 0 && (
        <ul className="absolute z-50 w-full bg-white border border-gray-300 rounded-lg mt-1 shadow-lg max-h-60 overflow-y-auto">
          {communeSuggestions.map((commune, index) => (
            <li
              key={index}
              onClick={() => handleCommuneSelect(commune)}
              className="px-4 py-3 hover:bg-[#F8F9FA] cursor-pointer border-b border-gray-200 last:border-b-0 transition-colors"
            >
              <div className="font-medium text-[#2C3E50]">{commune.nom}</div>
              <div className="text-xs text-[#6C757D] mt-1 flex items-center gap-1">
                <span>📍</span>
                <span>{commune.codesPostaux.join(', ')} - Dép. {commune.codeDepartement}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Aucun résultat */}
      {showSuggestions && !loading && value.length >= 2 &&
        (mode === 'address' ? suggestions.length === 0 : communeSuggestions.length === 0) && (
        <div className="absolute z-50 w-full bg-white border border-gray-300 rounded-lg mt-1 shadow-lg p-4 text-center text-sm text-[#6C757D]">
          Aucune {mode === 'city' ? 'commune' : 'adresse'} trouvée. Vérifiez votre saisie.
        </div>
      )}
    </div>
  );
}
