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
}

export function AddressAutocomplete({
  label,
  value,
  onChange,
  onAddressSelect,
  placeholder = "Tapez votre adresse (ex: 15 rue de la République Paris)",
  required = false,
  helper
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
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
    if (value.length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(value)}&limit=5`
        );
        const data = await response.json();
        setSuggestions(data.features || []);
        setShowSuggestions(true);
      } catch (error) {
        console.error('Erreur API Adresse:', error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300); // Attendre 300ms

    return () => clearTimeout(timer);
  }, [value]);

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

    // Notifier le parent avec les données structurées
    if (onAddressSelect) {
      onAddressSelect(addressData);
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
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
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

      {/* Liste de suggestions */}
      {showSuggestions && suggestions.length > 0 && (
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

      {/* Aucun résultat */}
      {showSuggestions && !loading && value.length >= 3 && suggestions.length === 0 && (
        <div className="absolute z-50 w-full bg-white border border-gray-300 rounded-lg mt-1 shadow-lg p-4 text-center text-sm text-[#6C757D]">
          Aucune adresse trouvée. Vérifiez votre saisie.
        </div>
      )}
    </div>
  );
}
