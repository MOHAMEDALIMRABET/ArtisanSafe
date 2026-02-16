'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import type { Categorie } from '@/types/firestore';

export default function Home() {
  const router = useRouter();
  const [blinkingFields, setBlinkingFields] = useState<{ville: boolean, date: boolean}>({ ville: false, date: false });
  const [villeSuggestions, setVilleSuggestions] = useState<Array<{nom: string, codePostal: string, departement: string}>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCodePostal, setSelectedCodePostal] = useState('');
  const [currentCardIndex, setCurrentCardIndex] = useState(0); // État pour le carrousel
  
  // État du formulaire de recherche
  const [searchForm, setSearchForm] = useState({
    metier: 'plomberie' as Categorie,
    ville: '',
    date: new Date().toISOString().slice(0, 10),
    flexible: false,
    flexibiliteDays: '0',
    rayonMax: '10'
  });

  async function searchVilles(query: string) {
    if (query.length < 2) {
      setVilleSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const response = await fetch(
        `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(query)}&fields=nom,codesPostaux,codeDepartement&boost=population&limit=10`
      );

      if (!response.ok) return;

      const data = await response.json();
      const suggestions = data.flatMap((commune: any) =>
        commune.codesPostaux.map((cp: string) => ({
          nom: commune.nom,
          codePostal: cp,
          departement: commune.codeDepartement
        }))
      );

      setVilleSuggestions(suggestions);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Erreur recherche villes:', error);
    }
  }

  function selectVille(suggestion: {nom: string, codePostal: string, departement: string}) {
    setSearchForm((prev) => ({ ...prev, ville: suggestion.nom }));
    setSelectedCodePostal(suggestion.codePostal);
    setShowSuggestions(false);
    setVilleSuggestions([]);
  }

  async function handleSearch() {
    // Vérifier quels champs sont vides
    const emptyFields = {
      ville: !searchForm.ville.trim(),
      date: !searchForm.date
    };

    // Si des champs sont vides, les faire clignoter
    if (emptyFields.ville || emptyFields.date) {
      setBlinkingFields(emptyFields);
      
      // Arrêter le clignotement après 600ms
      setTimeout(() => {
        setBlinkingFields({ ville: false, date: false });
      }, 600);
      
      return;
    }

    // Tous les champs sont remplis, continuer avec la recherche
    let codePostal = selectedCodePostal;
    if (!codePostal) {
      try {
        const response = await fetch(
          `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(searchForm.ville.trim())}&fields=codesPostaux&limit=1`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.length > 0 && data[0].codesPostaux && data[0].codesPostaux.length > 0) {
            codePostal = data[0].codesPostaux[0];
            console.log(`📮 Code postal trouvé pour ${searchForm.ville}: ${codePostal}`);
          }
        }
      } catch (error) {
        console.error('Erreur récupération code postal:', error);
      }
    }

    // Construire l'URL avec les paramètres de recherche
    const params = new URLSearchParams({
      categorie: searchForm.metier,
      ville: searchForm.ville.trim(),
      codePostal: codePostal,
      dates: JSON.stringify([searchForm.date]),
      flexible: searchForm.flexible.toString(),
      flexibiliteDays: searchForm.flexibiliteDays,
      rayonMax: searchForm.rayonMax,
      urgence: 'normale'
    });

    // Rediriger vers la page de résultats
    router.push(`/resultats?${params.toString()}`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2C3E50] via-[#3D5A73] to-[#2C3E50]">
      {/* Hero Section avec Bannière de Recherche */}
      <div id="recherche-section" className="container mx-auto px-4 py-16">
        {/* Bannière principale avec image de fond */}
        <div className="relative rounded-3xl overflow-hidden shadow-2xl mb-16 h-[500px]">
          {/* Image de fond */}
          <div className="absolute inset-0">
            <Image 
              src="/images/artisan-banner.png" 
              alt="Artisans au travail - BTP" 
              fill
              className="object-cover"
              priority
            />
            {/* Overlay gradient pour lisibilité */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#2C3E50]/90 via-[#2C3E50]/70 to-[#FF6B00]/80"></div>
          </div>

          <div className="relative z-10 py-12 px-6 md:px-12 h-full flex flex-col justify-center">
            {/* Slogan accrocheur */}
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 text-center drop-shadow-lg">
              Le moyen fiable d'engager un artisan
            </h1>
            <p className="text-center text-white text-lg mb-8 drop-shadow-md">
              Publiez votre projet gratuitement et recevez des devis d'artisans vérifiés
            </p>

            {/* Formulaire de recherche */}
            <div className="max-w-screen-xl mx-auto bg-white rounded-2xl shadow-2xl p-4">
              <div className="grid md:grid-cols-24 gap-2">
                {/* Type de travaux */}
                <div className="relative md:col-span-4">
                  <label className="block text-xs font-medium text-[#6C757D] mb-1 ml-3">
                    Type de travaux
                  </label>
                  <div className="flex items-center bg-[#F8F9FA] rounded-xl px-3 h-11 hover:bg-[#E9ECEF] transition-colors cursor-pointer">
                    <svg className="w-5 h-5 text-[#FF6B00] mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <select 
                      className="bg-transparent border-none outline-none w-full text-[#2C3E50] font-medium cursor-pointer"
                      value={searchForm.metier}
                      onChange={(e) => setSearchForm({...searchForm, metier: e.target.value as Categorie})}
                    >
                      <option value="plomberie">Plomberie</option>
                      <option value="electricite">Électricité</option>
                      <option value="peinture">Peinture</option>
                      <option value="menuiserie">Menuiserie</option>
                      <option value="maconnerie">Maçonnerie</option>
                      <option value="placo">Placo</option>
                      <option value="carrelage">Carrelage</option>
                      <option value="chauffage">Chauffage</option>
                      <option value="climatisation">Climatisation</option>
                      <option value="toiture">Toiture</option>
                      <option value="isolation">Isolation</option>
                      <option value="serrurerie">Serrurerie</option>
                      <option value="renovation">Rénovation</option>
                      <option value="autre">Autre</option>
                    </select>
                  </div>
                </div>

                {/* Ville */}
              <div className="relative md:col-span-6">
                  <label className="block text-xs font-medium text-[#6C757D] mb-1 ml-3">Localisation</label>
                  <div className={`flex items-center rounded-xl px-3 h-11 transition-colors ${
                    blinkingFields.ville 
                      ? 'animate-blink-once' 
                      : 'bg-[#F8F9FA] hover:bg-[#E9ECEF]'
                  }`}>
                    <style jsx>{`
                      @keyframes blink-once {
                        0%, 100% { background-color: #F8F9FA; }
                        50% { background-color: #D1D5DB; }
                      }
                      .animate-blink-once {
                        animation: blink-once 0.6s ease-in-out 1;
                        background-color: #F8F9FA;
                      }
                    `}</style>
                    <svg className="w-5 h-5 text-[#FF6B00] mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <input 
                      type="text" 
                      placeholder="Paris, Lyon..." 
                      className="bg-transparent border-none outline-none w-full text-[#2C3E50] font-medium placeholder-[#95A5A6]"
                      value={searchForm.ville}
                      onChange={(e) => {
                        const nextValue = e.target.value;
                        setSearchForm({...searchForm, ville: nextValue});
                        setSelectedCodePostal('');
                        searchVilles(nextValue);
                      }}
                      onFocus={() => {
                        if (villeSuggestions.length > 0) setShowSuggestions(true);
                      }}
                    />
                  </div>

                  {/* Liste des suggestions */}
                  {showSuggestions && villeSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border-2 border-[#FF6B00] rounded-lg shadow-lg max-h-60 overflow-y-auto top-full">
                      {villeSuggestions.map((suggestion, index) => (
                        <button
                          key={`${suggestion.nom}-${suggestion.codePostal}-${index}`}
                          type="button"
                          onClick={() => selectVille(suggestion)}
                          className="w-full text-left px-4 py-3 hover:bg-[#FFF3E0] transition-colors border-b border-[#E9ECEF] last:border-b-0"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-[#2C3E50]">{suggestion.nom}</span>
                            <span className="text-sm text-[#6C757D]">{suggestion.codePostal}</span>
                          </div>
                          <span className="text-xs text-[#95A5A6]">Dépt. {suggestion.departement}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Rayon de recherche */}
                <div className="relative md:col-span-3">
                  <label className="block text-xs font-medium text-[#6C757D] mb-1 ml-3">
                    Rayon
                  </label>
                  <div className="flex items-center bg-[#F8F9FA] rounded-xl px-3 h-11 hover:bg-[#E9ECEF] transition-colors cursor-pointer">
                    <svg className="w-5 h-5 text-[#FF6B00] mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c1.657 0 3-1.343 3-3S13.657 2 12 2 9 3.343 9 5s1.343 3 3 3zm0 0v14m6-6H6" />
                    </svg>
                    <select 
                      className="bg-transparent border-none outline-none w-full text-[#2C3E50] font-medium cursor-pointer"
                      value={searchForm.rayonMax}
                      onChange={(e) => setSearchForm({...searchForm, rayonMax: e.target.value})}
                    >
                      <option value="10">10 km</option>
                      <option value="20">20 km</option>
                      <option value="30">30 km</option>
                      <option value="50">50 km</option>
                      <option value="80">80 km</option>
                      <option value="100">100 km</option>
                    </select>
                  </div>
                </div>

                {/* Date souhaitée */}
                <div className="relative md:col-span-4">
                  <label className="block text-xs font-medium text-[#6C757D] mb-1 ml-3">
                    Date souhaitée
                  </label>
                  <div className={`flex items-center rounded-xl px-3 h-11 transition-colors ${
                    blinkingFields.date 
                      ? 'animate-blink-once' 
                      : 'bg-[#F8F9FA] hover:bg-[#E9ECEF]'
                  }`}>
                    <svg className="w-5 h-5 text-[#FF6B00] mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <input 
                      type="date" 
                      placeholder="Dès que possible" 
                      className="bg-transparent border-none outline-none w-full text-[#2C3E50] font-medium placeholder-[#95A5A6]"
                      value={searchForm.date}
                      onChange={(e) => setSearchForm({...searchForm, date: e.target.value})}
                    />
                  </div>
                </div>

                {/* Flexibilité */}
                <div className="relative md:col-span-3">
                  <label className="block text-xs font-medium text-[#6C757D] mb-1 ml-3">
                    Flexibilité
                  </label>
                  <div className="flex items-center bg-[#F8F9FA] rounded-xl px-3 h-11 hover:bg-[#E9ECEF] transition-colors cursor-pointer">
                    <svg className="w-5 h-5 text-[#FF6B00] mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    <select 
                      className="bg-transparent border-none outline-none w-full text-[#2C3E50] font-medium cursor-pointer"
                      value={searchForm.flexibiliteDays}
                      onChange={(e) => {
                        setSearchForm({...searchForm, flexible: e.target.value !== '0', flexibiliteDays: e.target.value});
                      }}
                    >
                      <option value="0">±0 jour</option>
                      <option value="1">± 1 jour</option>
                      <option value="3">± 3 jours</option>
                      <option value="7">± 1 semaine</option>
                      <option value="14">± 2 semaines</option>
                    </select>
                  </div>
                </div>

                {/* Bouton Rechercher */}
                <div className="relative min-w-0 md:col-span-3">
                  <label className="block text-xs font-medium text-[#6C757D] mb-1 ml-3">&nbsp;</label>
                  <button 
                    onClick={handleSearch}
                    className="w-full h-11 bg-[#FF6B00] hover:bg-[#E56100] text-white font-bold rounded-xl px-6 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center"
                  >
                    Rechercher
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section Petits Travaux - Compacte avec Texte Complet */}
        <div className="relative rounded-3xl overflow-hidden shadow-2xl">
          {/* Background animé avec gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#FFF9E6] via-[#FFE4B5] to-[#FFF9E6] opacity-40"></div>
          
          <div className="relative z-10 py-12 px-6 md:px-12">
            <div className="text-center">
              
              {/* Badge NOUVEAU */}
              <div className="flex justify-center mb-4">
                <span className="inline-flex items-center gap-2 bg-gradient-to-r from-[#FF6B00] to-[#E56100] text-white px-6 py-2 rounded-full font-bold text-sm shadow-lg animate-pulse">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                  </svg>
                  NOUVEAU : Petits travaux express
                </span>
              </div>

              {/* Titre */}
              <h2 className="text-3xl md:text-4xl font-bold text-[#2C3E50] mb-8">
                Besoin d'une intervention rapide ?
              </h2>

              {/* CTA avec animations complètes */}
              <div className="flex justify-center">
                <Link href="/petits-travaux">
                  <button className="group relative bg-gradient-to-r from-[#FF6B00] to-[#E56100] hover:from-[#E56100] hover:to-[#D55000] text-white px-10 py-5 rounded-2xl font-bold text-xl shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-110 animate-pulse-slow">
                    <span className="relative z-10 flex items-center gap-3">
                      <svg className="w-7 h-7 animate-spin-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Trouver un artisan dispo maintenant
                      <svg className="w-6 h-6 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </span>
                    
                    {/* Effet de brillance qui passe */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                  </button>
                </Link>
              </div>

            </div>
          </div>
        </div>

        {/* Nouvelle section : Vos garanties ArtisanDispo */}
        <div className="mt-24 mb-8">
          <div className="text-center mb-12">
            <h2 className="text-5xl md:text-6xl font-extrabold text-[#2C3E50] mb-6 leading-tight">
              Pourquoi choisir ArtisanDispo ?
            </h2>
            <p className="text-2xl md:text-3xl font-semibold text-[#28A745] max-w-4xl mx-auto leading-relaxed">
              Vos projets méritent des artisans fiables, disponibles et de confiance. Avec ArtisanDispo, tout commence sereinement
            </p>
          </div>

          {/* Carrousel de cartes avec navigation */}
          <div className="relative max-w-7xl mx-auto px-4">
            {/* Bouton flèche gauche */}
            <button
              onClick={() => setCurrentCardIndex(Math.max(0, currentCardIndex - 1))}
              disabled={currentCardIndex === 0}
              className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white shadow-xl rounded-full p-3 hover:bg-[#FF6B00] hover:text-white transition-all duration-300 ${
                currentCardIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'opacity-100 hover:scale-110'
              }`}
              aria-label="Carte précédente"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Conteneur de défilement */}
            <div className="overflow-hidden">
              <div 
                className="flex transition-transform duration-500 ease-in-out gap-6"
                style={{ 
                  transform: `translateX(-${currentCardIndex * (100 / 5)}%)` 
                }}
              >
                {/* Carte 1 : Paiement sécurisé */}
                <Link href="/confiance/paiement-securise" className="group flex-shrink-0 w-[calc(20%-1.2rem)]">
                  <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 cursor-pointer h-full border-2 border-transparent hover:border-[#FF6B00] transform hover:-translate-y-2">
                    <div className="w-16 h-16 bg-[#E8F5E9] rounded-full flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform">
                      <span className="text-4xl">🔒</span>
                    </div>
                    <h3 className="text-lg font-bold text-[#2C3E50] mb-3 text-center">
                      Paiement 100% sécurisé
                    </h3>
                    <ul className="text-sm text-[#6C757D] space-y-2 mb-4">
                      <li className="flex items-start gap-2">
                        <span className="text-[#28A745] mt-0.5">✓</span>
                        <span>Paiement bloqué jusqu'à validation</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#28A745] mt-0.5">✓</span>
                        <span>Déblocage automatique après 7 jours</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#28A745] mt-0.5">✓</span>
                        <span>Aucun risque d'arnaque</span>
                      </li>
                    </ul>
                    <div className="text-center">
                      <span className="text-[#FF6B00] font-semibold text-sm group-hover:underline">
                        En savoir plus →
                      </span>
                    </div>
                  </div>
                </Link>

                {/* Carte 2 : Vérification artisans */}
                <Link href="/confiance/verification-artisans" className="group flex-shrink-0 w-[calc(20%-1.2rem)]">
                  <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 cursor-pointer h-full border-2 border-transparent hover:border-[#FF6B00] transform hover:-translate-y-2">
                    <div className="w-16 h-16 bg-[#E3F2FD] rounded-full flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform">
                      <span className="text-4xl">✓</span>
                    </div>
                    <h3 className="text-lg font-bold text-[#2C3E50] mb-3 text-center">
                      Artisans rigoureusement vérifiés
                    </h3>
                    <ul className="text-sm text-[#6C757D] space-y-2 mb-4">
                      <li className="flex items-start gap-2">
                        <span className="text-[#28A745] mt-0.5">✓</span>
                        <span>KBIS/SIREN obligatoire</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#28A745] mt-0.5">✓</span>
                        <span>Identité contrôlée</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#28A745] mt-0.5">✓</span>
                        <span>Assurances vérifiées</span>
                      </li>
                    </ul>
                    <div className="text-center">
                      <span className="text-[#FF6B00] font-semibold text-sm group-hover:underline">
                        En savoir plus →
                      </span>
                    </div>
                  </div>
                </Link>

                {/* Carte 3 : Planning flexible */}
                <Link href="/confiance/planning-flexibilite" className="group flex-shrink-0 w-[calc(20%-1.2rem)]">
                  <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 cursor-pointer h-full border-2 border-transparent hover:border-[#FF6B00] transform hover:-translate-y-2">
                    <div className="w-16 h-16 bg-[#FFF3E0] rounded-full flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform">
                      <span className="text-4xl">📅</span>
                    </div>
                    <h3 className="text-lg font-bold text-[#2C3E50] mb-3 text-center">
                      Planning flexible & transparent
                    </h3>
                    <ul className="text-sm text-[#6C757D] space-y-2 mb-4">
                      <li className="flex items-start gap-2">
                        <span className="text-[#28A745] mt-0.5">✓</span>
                        <span>Disponibilités temps réel</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#28A745] mt-0.5">✓</span>
                        <span>Flexibilité ±7 jours</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#28A745] mt-0.5">✓</span>
                        <span>Confirmation instantanée</span>
                      </li>
                    </ul>
                    <div className="text-center">
                      <span className="text-[#FF6B00] font-semibold text-sm group-hover:underline">
                        En savoir plus →
                      </span>
                    </div>
                  </div>
                </Link>

                {/* Carte 4 : Avis certifiés */}
                <Link href="/confiance/avis-certifies" className="group flex-shrink-0 w-[calc(20%-1.2rem)]">
                  <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 cursor-pointer h-full border-2 border-transparent hover:border-[#FF6B00] transform hover:-translate-y-2">
                    <div className="w-16 h-16 bg-[#FFFBF0] rounded-full flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform">
                      <span className="text-4xl">⭐</span>
                    </div>
                    <h3 className="text-lg font-bold text-[#2C3E50] mb-3 text-center">
                      Avis 100% certifiés
                    </h3>
                    <ul className="text-sm text-[#6C757D] space-y-2 mb-4">
                      <li className="flex items-start gap-2">
                        <span className="text-[#28A745] mt-0.5">✓</span>
                        <span>Uniquement après paiement</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#28A745] mt-0.5">✓</span>
                        <span>Notation multi-critères</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#28A745] mt-0.5">✓</span>
                        <span>Score dynamique</span>
                      </li>
                    </ul>
                    <div className="text-center">
                      <span className="text-[#FF6B00] font-semibold text-sm group-hover:underline">
                        En savoir plus →
                      </span>
                    </div>
                  </div>
                </Link>

                {/* Carte 5 : Devis gratuits */}
                <Link href="/confiance/devis-gratuits" className="group flex-shrink-0 w-[calc(20%-1.2rem)]">
                  <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 cursor-pointer h-full border-2 border-transparent hover:border-[#FF6B00] transform hover:-translate-y-2">
                    <div className="w-16 h-16 bg-[#E8F5E9] rounded-full flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform">
                      <span className="text-4xl">💰</span>
                    </div>
                    <h3 className="text-lg font-bold text-[#2C3E50] mb-3 text-center">
                      Devis 100% gratuits
                    </h3>
                    <ul className="text-sm text-[#6C757D] space-y-2 mb-4">
                      <li className="flex items-start gap-2">
                        <span className="text-[#28A745] mt-0.5">✓</span>
                        <span>Recevez plusieurs devis sans engagement</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#28A745] mt-0.5">✓</span>
                        <span>Comparez les prix facilement</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#28A745] mt-0.5">✓</span>
                        <span>Zéro frais cachés</span>
                      </li>
                    </ul>
                    <div className="text-center">
                      <span className="text-[#FF6B00] font-semibold text-sm group-hover:underline">
                        En savoir plus →
                      </span>
                    </div>
                  </div>
                </Link>

                {/* Carte 6 : Petits travaux */}
                <Link href="/petits-travaux" className="group flex-shrink-0 w-[calc(20%-1.2rem)]">
                  <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 cursor-pointer h-full border-2 border-transparent hover:border-[#FF6B00] transform hover:-translate-y-2">
                    <div className="w-16 h-16 bg-[#FFF9E6] rounded-full flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform">
                      <span className="text-4xl">🔧</span>
                    </div>
                    <h3 className="text-lg font-bold text-[#2C3E50] mb-3 text-center">
                      Petits travaux rapides
                    </h3>
                    <ul className="text-sm text-[#6C757D] space-y-2 mb-4">
                      <li className="flex items-start gap-2">
                        <span className="text-[#28A745] mt-0.5">✓</span>
                        <span>Intervention sous 2h possible</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#28A745] mt-0.5">✓</span>
                        <span>Sans devis si &lt; 150€</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#28A745] mt-0.5">✓</span>
                        <span>Tarif horaire transparent</span>
                      </li>
                    </ul>
                    <div className="text-center">
                      <span className="text-[#FF6B00] font-semibold text-sm group-hover:underline">
                        En savoir plus →
                      </span>
                    </div>
                  </div>
                </Link>

                {/* Carte 7 : Protection & médiation */}
                <Link href="/confiance/protection-mediation" className="group flex-shrink-0 w-[calc(20%-1.2rem)]">
                  <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 cursor-pointer h-full border-2 border-transparent hover:border-[#FF6B00] transform hover:-translate-y-2">
                    <div className="w-16 h-16 bg-[#FFEBEE] rounded-full flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform">
                      <span className="text-4xl">🛡️</span>
                    </div>
                    <h3 className="text-lg font-bold text-[#2C3E50] mb-3 text-center">
                      Protection & médiation
                    </h3>
                    <ul className="text-sm text-[#6C757D] space-y-2 mb-4">
                      <li className="flex items-start gap-2">
                        <span className="text-[#28A745] mt-0.5">✓</span>
                        <span>Centre de litiges dédié</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#28A745] mt-0.5">✓</span>
                        <span>Historique preuves complet</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#28A745] mt-0.5">✓</span>
                        <span>Médiation gratuite</span>
                      </li>
                    </ul>
                    <div className="text-center">
                      <span className="text-[#FF6B00] font-semibold text-sm group-hover:underline">
                        En savoir plus →
                      </span>
                    </div>
                  </div>
                </Link>
              </div>
            </div>

            {/* Bouton flèche droite */}
            <button
              onClick={() => setCurrentCardIndex(Math.min(2, currentCardIndex + 1))}
              disabled={currentCardIndex === 2}
              className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white shadow-xl rounded-full p-3 hover:bg-[#FF6B00] hover:text-white transition-all duration-300 ${
                currentCardIndex === 2 ? 'opacity-30 cursor-not-allowed' : 'opacity-100 hover:scale-110'
              }`}
              aria-label="Carte suivante"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Indicateurs de position */}
            <div className="flex justify-center gap-2 mt-8">
              <button
                onClick={() => setCurrentCardIndex(0)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  currentCardIndex === 0 ? 'w-8 bg-[#FF6B00]' : 'w-2 bg-gray-300 hover:bg-gray-400'
                }`}
                aria-label="Voir cartes 1-5"
              />
              <button
                onClick={() => setCurrentCardIndex(1)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  currentCardIndex === 1 ? 'w-8 bg-[#FF6B00]' : 'w-2 bg-gray-300 hover:bg-gray-400'
                }`}
                aria-label="Voir cartes 2-6"
              />
              <button
                onClick={() => setCurrentCardIndex(2)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  currentCardIndex === 2 ? 'w-8 bg-[#FF6B00]' : 'w-2 bg-gray-300 hover:bg-gray-400'
                }`}
                aria-label="Voir cartes 3-7"
              />
            </div>
          </div>
        </div>

        {/* CTA Double - Artisans et Particuliers */}
        <div className="mt-20 grid md:grid-cols-2 gap-6">
          {/* CTA Particuliers */}
          <div className="bg-gradient-to-r from-[#2C3E50] to-[#3D5A73] rounded-2xl p-8 md:p-12 text-white">
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Vous êtes particulier ?
              </h2>
              <p className="text-lg mb-6 text-[#E9ECEF]">
                Trouvez le bon artisan pour vos travaux. Comparez les devis et choisissez en toute confiance.
              </p>
              <Link href="/inscription?role=client">
                <button className="bg-white text-[#2C3E50] hover:bg-[#E9ECEF] hover:text-[#1A3A5C] px-6 py-3 text-lg font-medium rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl">
                  Créer mon profil particulier
                </button>
              </Link>
            </div>
          </div>

          {/* CTA Artisans */}
          <div className="bg-gradient-to-r from-[#FF6B00] to-[#E56100] rounded-2xl p-8 md:p-12 text-white">
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Vous êtes artisan ?
              </h2>
              <p className="text-lg mb-6 text-orange-100">
                Rejoignez notre plateforme et développez votre activité. 
                Inscription gratuite, commission uniquement sur les prestations réalisées.
              </p>
              <Link href="/inscription?role=artisan">
                <button className="bg-white text-[#FF6B00] hover:bg-[#E9ECEF] hover:text-[#E56100] px-6 py-3 text-lg font-medium rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl">
                  Créer mon profil artisan
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
