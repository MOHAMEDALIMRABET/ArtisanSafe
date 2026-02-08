'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { matchArtisans } from '@/lib/firebase/matching-service';
import type { MatchingResult, MatchingCriteria, User } from '@/types/firestore';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Logo } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { getUserById } from '@/lib/firebase/user-service';

function ResultatsContent() {

  const searchParams = useSearchParams();
  const router = useRouter();
  const { user: firebaseUser } = useAuth(); // User Firebase Auth (uid, email)
  const [userData, setUserData] = useState<User | null>(null); // Données complètes Firestore
  const [results, setResults] = useState<MatchingResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardUrl, setDashboardUrl] = useState('/');
  const [villeInput, setVilleInput] = useState<string>(searchParams.get('ville') || '');
  const [codePostalInput, setCodePostalInput] = useState<string>(searchParams.get('codePostal') || '');
  const [categorieInput, setCategorieInput] = useState<string>(searchParams.get('categorie') || 'plomberie');
  const [dateInput, setDateInput] = useState<string>(() => {
    const datesParam = searchParams.get('dates');
    if (datesParam) {
      try {
        return JSON.parse(datesParam)[0];
      } catch {
        return new Date().toISOString().slice(0, 10);
      }
    }
    return new Date().toISOString().slice(0, 10);
  });
  const [flexibiliteInput, setFlexibiliteInput] = useState<string>(searchParams.get('flexibiliteDays') || '0');
  const [rayonMaxInput, setRayonMaxInput] = useState<string>(searchParams.get('rayonMax') || '20');
  const [villeSuggestions, setVilleSuggestions] = useState<Array<{nom: string, codePostal: string, departement: string}>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // États pour le modal de publication de demande
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishDescription, setPublishDescription] = useState('');
  const [publishPhotos, setPublishPhotos] = useState<File[]>([]);
  const [publishBudget, setPublishBudget] = useState<string>('');
  const [isPublishing, setIsPublishing] = useState(false);

  // Charger les données Firestore de l'utilisateur
  useEffect(() => {
    async function loadUserData() {
      if (firebaseUser) {
        try {
          const data = await getUserById(firebaseUser.uid);
          if (data) {
            setUserData(data);
            setDashboardUrl(data.role === 'artisan' ? '/artisan/dashboard' : '/dashboard');
          }
        } catch (error) {
          console.error('Erreur chargement données utilisateur:', error);
        }
      } else {
        setUserData(null);
      }
    }
    loadUserData();
  }, [firebaseUser]);

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
    setVilleInput(suggestion.nom);
    setCodePostalInput(suggestion.codePostal);
    setShowSuggestions(false);
    setVilleSuggestions([]);
  }

  async function searchByCodePostal(codePostal: string) {
    if (codePostal.length < 5) {
      return;
    }

    try {
      const response = await fetch(
        `https://geo.api.gouv.fr/communes?codePostal=${codePostal}&fields=nom,codesPostaux,codeDepartement&limit=1`
      );
      
      if (!response.ok) return;
      
      const data = await response.json();
      if (data.length > 0) {
        setVilleInput(data[0].nom);
        console.log('🏙️ Ville trouvée pour CP', codePostal, ':', data[0].nom);
      }
    } catch (error) {
      console.error('Erreur recherche par code postal:', error);
    }
  }

  useEffect(() => {
    async function performMatching() {
      try {
        // Récupérer les critères depuis l'URL
        const categorie = searchParams.get('categorie');
        const ville = searchParams.get('ville');
        const codePostal = searchParams.get('codePostal') ?? '';
        const datesStr = searchParams.get('dates');
        const flexible = searchParams.get('flexible') === 'true';
        const flexibiliteDays = parseInt(searchParams.get('flexibiliteDays') || '0');
        const urgence = searchParams.get('urgence') as 'faible' | 'normale' | 'urgent';
        const lat = searchParams.get('lat');
        const lon = searchParams.get('lon');
        const rayonMaxParam = searchParams.get('rayonMax');
        const rayonMax = rayonMaxParam ? parseInt(rayonMaxParam) : undefined;

        if (!categorie || !ville || !datesStr) {
          setError('Critères de recherche manquants');
          setLoading(false);
          return;
        }

        const dates = JSON.parse(datesStr) as string[];

        // Construire coordonnées GPS si disponibles
        let coordonneesGPS = undefined;
        if (lat && lon) {
          coordonneesGPS = {
            latitude: parseFloat(lat),
            longitude: parseFloat(lon)
          };
        }

        const criteria: MatchingCriteria = {
          categorie: categorie as any,
          ville,
          codePostal,
          coordonneesGPS,
          dates,
          flexible,
          flexibiliteDays: flexible ? flexibiliteDays : undefined,
          urgence,
          rayonMax,
        };

        // Sauvegarder les critères pour la création de demande
        sessionStorage.setItem('searchCriteria', JSON.stringify(criteria));

        // Lancer le matching
        const matchedArtisans = await matchArtisans(criteria);
        console.log('📋 Artisans matchés reçus:', matchedArtisans);
        console.log('📊 Nombre d\'artisans:', matchedArtisans.length);
        setResults(matchedArtisans);
        setLoading(false);
      } catch (err) {
        console.error('Erreur matching:', err);
        setError('Impossible de trouver des artisans. Veuillez réessayer.');
        setLoading(false);
      }
    }

    performMatching();
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#FF6B00] border-t-transparent mx-auto mb-4"></div>
          <p className="text-[#2C3E50] text-lg font-semibold">
            Recherche des meilleurs artisans disponibles...
          </p>
          <p className="text-[#6C757D] text-sm mt-2">
            Analyse des disponibilités et calcul des scores
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-[#2C3E50] mb-2">Erreur</h2>
          <p className="text-[#6C757D] mb-6">{error}</p>
          <Button
            onClick={() => router.push('/recherche')}
            className="bg-[#FF6B00] hover:bg-[#E56100] text-white"
          >
            Nouvelle recherche
          </Button>
        </Card>
      </div>
    );
  }

  // Valeurs par défaut pour le formulaire
  const defaultCategorie = 'plomberie';
  const defaultVille = 'Paris';
  const defaultDate = new Date().toISOString().slice(0, 10);

  const categorie = searchParams.get('categorie') || defaultCategorie;
  const ville = searchParams.get('ville') || defaultVille;
  
  // Extraire la date depuis le paramètre 'dates' (format JSON array)
  let date = defaultDate;
  try {
    const datesParam = searchParams.get('dates');
    if (datesParam) {
      const datesArray = JSON.parse(datesParam);
      if (datesArray && datesArray.length > 0) {
        date = datesArray[0];
      }
    }
  } catch (e) {
    console.error('Erreur parsing dates:', e);
  }
  
  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Titre de la page */}
      <div className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center mb-3">
            <h1 className="text-3xl font-bold text-[#2C3E50]">Trouvez votre artisan</h1>
            <p className="text-[#6C757D] text-sm mt-2">Décrivez votre projet, nous trouvons les artisans disponibles</p>
          </div>
          
          {/* Message de bienvenue */}
          {userData && (
            <div className="bg-[#1A3A5C] rounded-lg px-4 py-3">
              <p className="text-white">
                👋 Bienvenue <span className="font-semibold text-[#FF6B00]">{userData.prenom} {userData.nom}</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bannière de recherche rapide */}
      <div className="bg-white border-b border-[#E9ECEF] py-4 sticky top-0 z-40 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-24 gap-2">
              {/* Type de travaux */}
              <div className="relative min-w-0 md:col-span-4">
                <label className="block text-xs font-medium text-[#6C757D] mb-1 ml-3">Type de travaux</label>
                <div className="flex items-center bg-[#F8F9FA] rounded-xl px-3 h-11 hover:bg-[#E9ECEF] transition-colors cursor-pointer">
                  <svg className="w-5 h-5 text-[#FF6B00] mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <select
                    className="bg-transparent border-none outline-none w-full text-[#2C3E50] font-medium cursor-pointer"
                    value={categorieInput}
                    onChange={e => setCategorieInput(e.target.value)}
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

              {/* Localisation */}
              <div className="relative md:col-span-6">
                <label className="block text-xs font-medium text-[#6C757D] mb-1 ml-3">Localisation</label>
                <div className="flex items-center bg-[#F8F9FA] rounded-xl px-3 h-11 hover:bg-[#E9ECEF] transition-colors">
                  <svg className="w-5 h-5 text-[#FF6B00] mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Paris, Lyon..."
                    className="bg-transparent border-none outline-none w-full text-[#2C3E50] font-medium placeholder-[#95A5A6]"
                    value={villeInput}
                    onChange={(e) => {
                      setVilleInput(e.target.value);
                      searchVilles(e.target.value);
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
                <label className="block text-xs font-medium text-[#6C757D] mb-1 ml-3 whitespace-nowrap">Rayon</label>
                <div className="flex items-center bg-[#F8F9FA] rounded-xl px-3 h-11 hover:bg-[#E9ECEF] transition-colors">
                  <svg className="w-5 h-5 text-[#FF6B00] mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c1.657 0 3-1.343 3-3S13.657 2 12 2 9 3.343 9 5s1.343 3 3 3zm0 0v14m6-6H6" />
                  </svg>
                  <select
                    className="bg-transparent border-none outline-none w-full text-[#2C3E50] font-medium cursor-pointer"
                    value={rayonMaxInput}
                    onChange={(e) => setRayonMaxInput(e.target.value)}
                  >
                    <option value="5">5 km</option>
                    <option value="10">10 km</option>
                    <option value="15">15 km</option>
                    <option value="20">20 km</option>
                    <option value="25">25 km</option>
                    <option value="30">30 km</option>
                    <option value="35">35 km</option>
                    <option value="40">40 km</option>
                    <option value="45">45 km</option>
                    <option value="50">50 km</option>
                    <option value="55">55 km</option>
                    <option value="60">60 km</option>
                    <option value="65">65 km</option>
                    <option value="70">70 km</option>
                    <option value="75">75 km</option>
                    <option value="80">80 km</option>
                    <option value="85">85 km</option>
                    <option value="90">90 km</option>
                    <option value="95">95 km</option>
                    <option value="100">100 km</option>
                  </select>
                </div>
              </div>

              {/* Date souhaitée */}
              <div className="relative min-w-0 md:col-span-4">
                <label className="block text-xs font-medium text-[#6C757D] mb-1 ml-3">Date souhaitée</label>
                <div className="flex items-center bg-[#F8F9FA] rounded-xl px-3 h-11 hover:bg-[#E9ECEF] transition-colors">
                  <svg className="w-5 h-5 text-[#FF6B00] mr-3 cursor-pointer" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    onClick={(e) => {
                      const input = e.currentTarget.parentElement?.querySelector('input[type="date"]') as HTMLInputElement;
                      input?.showPicker?.();
                    }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <input
                    type="date"
                    className="bg-transparent border-none outline-none w-full text-[#2C3E50] font-medium cursor-pointer"
                    value={dateInput}
                    onChange={e => setDateInput(e.target.value)}
                    onClick={(e) => {
                      (e.target as HTMLInputElement).showPicker?.();
                    }}
                  />
                </div>
              </div>

              {/* Flexibilité */}
              <div className="relative min-w-0 md:col-span-3">
                <label className="block text-xs font-medium text-[#6C757D] mb-1 ml-3">Flexibilité</label>
                <div className="flex items-center bg-[#F8F9FA] rounded-xl px-3 h-11 hover:bg-[#E9ECEF] transition-colors">
                  <select
                    className="bg-transparent border-none outline-none w-full text-[#2C3E50] font-medium cursor-pointer"
                    value={flexibiliteInput}
                    onChange={e => setFlexibiliteInput(e.target.value)}
                  >
                    <option value="0">±0J</option>
                    <option value="1">±1J</option>
                    <option value="2">±2J</option>
                    <option value="3">±3J</option>
                    <option value="4">±4J</option>
                    <option value="5">±5J</option>
                    <option value="6">±6J</option>
                    <option value="7">±7J</option>
                    <option value="8">±8J</option>
                    <option value="9">±9J</option>
                    <option value="10">±10J</option>
                    <option value="11">±11J</option>
                    <option value="12">±12J</option>
                    <option value="13">±13J</option>
                    <option value="14">±14J</option>
                  </select>
                </div>
              </div>

              {/* Bouton Rechercher */}
              <div className="relative min-w-0 md:col-span-3">
                <label className="block text-xs font-medium text-[#6C757D] mb-1 ml-3">&nbsp;</label>
                <button
                  className="w-full h-11 bg-[#FF6B00] hover:bg-[#E56100] text-white font-bold rounded-xl px-6 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center"
                  onClick={async (e) => {
                    e.preventDefault();
                    console.log('🔍 CLIC BOUTON RECHERCHER');
                    console.log('📍 Critères:', { categorie: categorieInput, ville: villeInput, codePostal: codePostalInput, date: dateInput, flexibilite: flexibiliteInput, rayonMax: rayonMaxInput });

                    if (!villeInput.trim()) {
                      alert('Veuillez saisir une ville');
                      return;
                    }

                    // Obtenir coordonnées GPS de la nouvelle ville
                    let coordonneesGPS = null;
                    let codePostal = codePostalInput;

                    try {
                      // Si on a déjà un code postal, l'utiliser pour géocoder précisément
                      let apiUrl = `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(villeInput)}&fields=centre,codesPostaux&limit=1`;
                      if (codePostal) {
                        apiUrl += `&codePostal=${codePostal}`;
                      }

                      console.log('🌍 Géocodage ville:', villeInput, 'avec codePostal:', codePostal || 'non défini');

                      const response = await fetch(apiUrl);
                      const data = await response.json();

                      console.log('📍 Réponse API géocodage:', data);

                      if (data.length > 0) {
                        if (data[0].centre) {
                          coordonneesGPS = {
                            latitude: data[0].centre.coordinates[1],
                            longitude: data[0].centre.coordinates[0]
                          };
                          console.log('✅ Coordonnées GPS:', coordonneesGPS);
                        }
                        // Ne changer le code postal que s'il n'existe pas déjà
                        if (!codePostal && data[0].codesPostaux && data[0].codesPostaux.length > 0) {
                          codePostal = data[0].codesPostaux[0];
                          setCodePostalInput(codePostal);
                          console.log('📮 Code postal attribué:', codePostal);
                        }
                      }
                    } catch (error) {
                      console.error('❌ Impossible de géocoder la ville:', error);
                    }

                    // Construire les nouveaux paramètres avec les valeurs des inputs locaux
                    const newParams = new URLSearchParams({
                      categorie: categorieInput,
                      ville: villeInput.trim(),
                      codePostal: codePostal || '',
                      dates: JSON.stringify([dateInput]),
                      flexible: flexibiliteInput !== '0' ? 'true' : 'false',
                      flexibiliteDays: flexibiliteInput,
                      rayonMax: rayonMaxInput,
                      urgence: searchParams.get('urgence') || 'normale',
                    });

                    if (coordonneesGPS) {
                      newParams.append('lat', coordonneesGPS.latitude.toString());
                      newParams.append('lon', coordonneesGPS.longitude.toString());
                    }

                    console.log('🔄 Redirection avec params:', newParams.toString());
                    router.push(`/resultats?${newParams.toString()}`);
                  }}
                >
                  Rechercher
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Résultats */}
      <main className="container mx-auto px-4 py-8">
        {results.length === 0 ? (
          <div className="space-y-6">
            {/* Carte "Aucun artisan disponible" */}
            <Card className="p-12 text-center">
              <div className="text-6xl mb-4">🔍</div>
              <h2 className="text-2xl font-bold text-[#2C3E50] mb-2">
                Aucun artisan disponible
              </h2>
              <p className="text-[#6C757D] mb-6">
                Aucun artisan n'est disponible pour vos dates souhaitées.
              </p>
            </Card>

            {/* Carte "Publier quand même" */}
            <Card className="p-8 bg-gradient-to-br from-[#FFF3E0] to-[#FFE0B2] border-2 border-[#FF6B00]">
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0 bg-[#FF6B00] rounded-full p-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-[#2C3E50] mb-3">
                    💡 Publiez votre demande
                  </h3>
                  <p className="text-[#6C757D] mb-4 text-base leading-relaxed">
                    Aucun artisan n'est libre à vos dates ? <strong className="text-[#FF6B00]">Publiez quand même votre demande</strong> !
                    Les artisans pourront la consulter même s'ils sont occupés : ils pourront ajuster leur planning, vous proposer une date alternative ou s'organiser pour répondre à votre besoin.
                  </p>
                  <div className="bg-white rounded-lg p-4 mb-5 border border-[#FF6B00]">
                    <div className="flex items-start gap-3 mb-2">
                      <svg className="w-5 h-5 text-[#28A745] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <p className="text-[#2C3E50] text-sm">
                        <strong>Visible par tous les artisans qualifiés</strong> de votre région
                      </p>
                    </div>
                    <div className="flex items-start gap-3 mb-2">
                      <svg className="w-5 h-5 text-[#28A745] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <p className="text-[#2C3E50] text-sm">
                        <strong>Les artisans pourront vous proposer d'autres dates</strong> ou ajuster leur planning
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-[#28A745] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <p className="text-[#2C3E50] text-sm">
                        <strong>Recevez plusieurs devis</strong> pour comparer les offres
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    {userData ? (
                      <Button
                        onClick={() => {
                          // Ouvrir le modal au lieu de publier directement
                          const categorie = searchParams.get('categorie');
                          const ville = searchParams.get('ville');
                          const defaultDescription = `Recherche ${categorie} à ${ville}`;
                          setPublishDescription(defaultDescription);
                          setShowPublishModal(true);
                        }}
                        className="bg-[#FF6B00] hover:bg-[#E56100] text-white font-bold px-8 py-4 text-lg shadow-lg hover:shadow-xl transition-all duration-200"
                      >
                        📢 Publier ma demande
                      </Button>
                    ) : (
                      <Button
                        onClick={() => router.push('/connexion')}
                        className="bg-[#FF6B00] hover:bg-[#E56100] text-white font-bold px-8 py-4 text-lg shadow-lg hover:shadow-xl transition-all duration-200"
                      >
                        🔑 Se connecter pour publier
                      </Button>
                    )}
                    <Button
                      onClick={() => router.push('/recherche')}
                      className="border-2 border-[#2C3E50] text-[#2C3E50] hover:bg-[#2C3E50] hover:text-white font-semibold px-8 py-4 text-lg transition-all duration-200"
                    >
                      🔍 Modifier ma recherche
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Bandeau pour visiteurs non connectés - MASQUÉ */}
            {/* {!user && (
              <div className="bg-gradient-to-r from-[#2C3E50] to-[#34495E] border-2 border-[#FF6B00] p-6 rounded-lg shadow-lg">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 bg-[#FF6B00] rounded-full p-3">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-2">
                      🔍 Recherche publique - Créez un compte pour contacter les artisans
                    </h3>
                    <p className="text-gray-200 mb-4">
                      Vous consultez les résultats en mode visiteur. Pour demander un devis et contacter directement les artisans, créez votre compte gratuitement.
                    </p>
                    <div className="flex gap-3">
                      <Button
                        onClick={() => router.push('/inscription?type=client')}
                        className="bg-[#FF6B00] hover:bg-[#E56100] text-white font-bold"
                      >
                        📝 Créer un compte gratuit
                      </Button>
                      <Button
                        onClick={() => router.push('/connexion')}
                        className="border-2 border-white bg-transparent text-white hover:bg-white hover:text-[#2C3E50] font-semibold"
                      >
                        🔑 Se connecter
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )} */}

            {/* Bandeau info */}
            <div className="bg-[#FFF3E0] border-l-4 border-[#FF6B00] p-4 rounded">
              <p className="text-[#2C3E50]">
                <strong>💡 Astuce :</strong> Les artisans sont classés par pertinence (disponibilité, proximité, réputation).
                Contactez plusieurs artisans pour comparer les devis.
              </p>
            </div>

            {/* Liste des artisans */}
            {results.map((result, index) => (
              <Card key={result.artisan.userId} onClick={() => router.push(`/artisan/${result.artisan.userId}`)} className="p-6 hover:border-[#FF6B00] transition-all cursor-pointer">
                <div className="flex gap-6">
                    {/* Photo profil */}
                    <div className="flex-shrink-0">
                      <div className="w-24 h-24 bg-[#E9ECEF] rounded-full flex items-center justify-center text-4xl">
                        {result.artisan.photoProfil ? (
                          <img
                            src={result.artisan.photoProfil}
                            alt={result.artisan.raisonSociale}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          '👷'
                        )}
                      </div>
                      {index === 0 && (
                        <div className="bg-[#FFC107] text-white text-xs font-bold px-2 py-1 rounded text-center mt-2">
                          TOP MATCH
                        </div>
                      )}
                    </div>

                    {/* Informations */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-xl font-bold text-[#2C3E50]">
                            {result.artisan.raisonSociale || result.artisan.nom}
                          </h3>
                          {/* Badge vérifié à côté du nom */}
                          {result.artisan.verified && (
                            <div className="bg-[#28A745] text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                              ✓ Vérifié
                            </div>
                          )}
                          {/* Badge Garantie Décennale si validée */}
                          {result.artisan.verificationDocuments?.decennale?.verified && (
                            <img 
                              src="/badge-decennale.svg" 
                              alt="Garantie Décennale"
                              className="w-20 h-20 cursor-help flex-shrink-0"
                              title="Garantie Décennale 10 ans validée"
                            />
                          )}
                        </div>
                        
                        {/* Bouton Demander un devis à côté du badge */}
                        <div>
                          {userData ? (
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/demande/nouvelle?artisan=${result.artisan.userId}`);
                              }}
                              className="bg-[#FF6B00] hover:bg-[#E56100] text-white"
                            >
                              Demander un devis
                            </Button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push('/connexion');
                              }}
                              className="bg-[#FF6B00] hover:bg-[#E56100] text-white font-bold rounded-xl px-6 py-3 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <span>Demander un devis</span>
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[#6C757D] mb-1">
                        <span>{result.artisan.metiers?.join(' • ')}</span>
                      </div>

                      {/* Notation */}
                      {result.artisan.nombreAvis > 0 && (
                        <div className="flex items-center gap-2 mb-3">
                          <div className="flex items-center">
                            {[...Array(5)].map((_, i) => (
                              <span
                                key={i}
                                className={i < Math.round(result.artisan.notation) ? 'text-[#FFC107]' : 'text-[#E9ECEF]'}
                              >
                                ★
                              </span>
                            ))}
                          </div>
                          <span className="text-[#2C3E50] font-semibold">
                            {result.artisan.notation.toFixed(1)}
                          </span>
                          <span className="text-[#6C757D] text-sm">
                            ({result.artisan.nombreAvis} avis)
                          </span>
                        </div>
                      )}

                      {/* Description */}
                      {result.artisan.presentation && (
                        <p className="text-[#6C757D] mb-3 line-clamp-2">
                          {result.artisan.presentation}
                        </p>
                      )}

                      {/* Scores de matching */}
                      <div className="flex flex-wrap gap-3 mb-4">
                        <div className="bg-[#E8F5E9] text-[#28A745] px-3 py-1 rounded text-sm font-semibold">
                          📍 Proximité {result.details.distanceScore}/50
                        </div>
                        <div className="bg-[#E3F2FD] text-[#17A2B8] px-3 py-1 rounded text-sm font-semibold">
                          📅 Disponibilité {result.details.disponibiliteScore}/50
                        </div>
                        {result.details.notationScore > 0 && (
                          <div className="bg-[#FFF3E0] text-[#FF6B00] px-3 py-1 rounded text-sm font-semibold">
                            ⭐ Réputation {result.details.notationScore}/50
                          </div>
                        )}
                        {result.details.urgenceMatch > 10 && (
                          <div className="bg-[#FFEBEE] text-[#DC3545] px-3 py-1 rounded text-sm font-semibold">
                            ⚡ Dispo immédiate
                          </div>
                        )}
                      </div>

                      {/* Score total */}
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#2C3E50] text-sm">Score de compatibilité :</span>
                        <div className="flex items-center gap-0.5">
                          {(() => {
                            const stars = Math.round((result.score / 270) * 5 * 2) / 2; // Arrondi au 0.5
                            const fullStars = Math.floor(stars);
                            const hasHalfStar = stars % 1 !== 0;
                            const emptyStars = 5 - Math.ceil(stars);
                            return (
                              <>
                              {[...Array(fullStars)].map((_, i) => (
                                <span key={`full-${i}`} className="text-[#FFC107] text-xl">★</span>
                              ))}
                              {hasHalfStar && (
                                <span className="relative inline-block text-xl">
                                  <span className="text-gray-300">★</span>
                                  <span className="absolute top-0 left-0 text-[#FFC107] overflow-hidden w-1/2">★</span>
                                </span>
                              )}
                              {[...Array(emptyStars)].map((_, i) => (
                                <span key={`empty-${i}`} className="text-gray-300 text-xl">★</span>
                              ))}
                              <span className="text-[#6C757D] text-sm ml-1">({stars.toFixed(1)}/5)</span>
                            </>
                          );
                        })()}
                      </div>
                      </div>
                    </div>
                  </div>
                </Card>
            ))}

            {/* Section "Pas trouvé l'artisan idéal ?" - MASQUÉE */}
            {/* <div className="mt-12 bg-gradient-to-r from-[#2C3E50] to-[#1A3A5C] rounded-2xl shadow-2xl p-8 text-center">
              <h2 className="text-3xl font-bold text-white mb-3">
                Vous n'avez pas trouvé l'artisan idéal ?
              </h2>
              <p className="text-[#95A5A6] text-lg mb-6">
                Modifiez vos critères ou activez la flexibilité des dates pour plus de résultats
              </p>
              <Button
                onClick={() => router.push('/recherche')}
                className="bg-[#FF6B00] hover:bg-[#E56100] text-white font-bold px-8 py-3 rounded-lg text-lg shadow-lg hover:shadow-xl transition-all"
              >
                Nouvelle recherche
              </Button>
            </div> */}
          </div>
        )}
      </main>

      {/* Modal de publication de demande */}
      {showPublishModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-[#2C3E50]">📢 Publier ma demande</h2>
              <button
                onClick={() => {
                  setShowPublishModal(false);
                  setPublishDescription('');
                  setPublishPhotos([]);
                  setPublishBudget('');
                }}
                className="text-[#6C757D] hover:text-[#2C3E50] text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Description */}
              <div>
                <label className="block text-[#2C3E50] font-semibold mb-2">
                  Description de votre besoin *
                </label>
                <textarea
                  value={publishDescription}
                  onChange={(e) => setPublishDescription(e.target.value)}
                  placeholder="Décrivez précisément les travaux à réaliser..."
                  required
                  rows={6}
                  maxLength={2000}
                  className="w-full px-4 py-3 border border-[#E9ECEF] rounded-lg focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00] focus:ring-opacity-20 outline-none resize-none"
                />
                <p className="text-sm text-[#6C757D] mt-1">
                  {publishDescription.length}/2000 caractères
                </p>
              </div>

              {/* Photos */}
              <div>
                <label className="block text-[#2C3E50] font-semibold mb-2">
                  Photos du chantier (optionnel)
                </label>
                <div className="border-2 border-dashed border-[#E9ECEF] rounded-lg p-6 text-center hover:border-[#FF6B00] transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      
                      // Validation: max 5 photos, taille < 5MB chacune
                      if (publishPhotos.length + files.length > 5) {
                        alert('Maximum 5 photos autorisées');
                        return;
                      }

                      for (const file of files) {
                        if (file.size > 5 * 1024 * 1024) {
                          alert(`La photo ${file.name} dépasse 5MB`);
                          return;
                        }
                        if (!file.type.startsWith('image/')) {
                          alert(`Le fichier ${file.name} n'est pas une image`);
                          return;
                        }
                      }

                      setPublishPhotos([...publishPhotos, ...files]);
                    }}
                    className="hidden"
                    id="modal-photo-upload"
                  />
                  <label htmlFor="modal-photo-upload" className="cursor-pointer">
                    <div className="text-5xl mb-3">📷</div>
                    <p className="text-[#2C3E50] font-semibold mb-1">
                      Cliquez pour ajouter des photos
                    </p>
                    <p className="text-sm text-[#6C757D]">
                      Maximum 5 photos • 5MB par photo • JPG, PNG
                    </p>
                  </label>
                </div>

                {/* Prévisualisation photos */}
                {publishPhotos.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
                    {publishPhotos.map((photo, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={URL.createObjectURL(photo)}
                          alt={`Photo ${index + 1}`}
                          className="w-full h-24 object-cover rounded-lg border border-[#E9ECEF]"
                        />
                        <button
                          type="button"
                          onClick={() => setPublishPhotos(publishPhotos.filter((_, i) => i !== index))}
                          className="absolute top-1 right-1 bg-[#DC3545] text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Budget */}
              <div>
                <label className="block text-[#2C3E50] font-semibold mb-2">
                  Budget estimé (optionnel)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={publishBudget}
                    onChange={(e) => setPublishBudget(e.target.value)}
                    placeholder="1000"
                    min="0"
                    className="flex-1 px-4 py-3 border border-[#E9ECEF] rounded-lg focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00] focus:ring-opacity-20 outline-none"
                  />
                  <span className="text-[#6C757D] font-semibold">€</span>
                </div>
                <p className="text-sm text-[#6C757D] mt-2">
                  Indiquer un budget aide les artisans à adapter leurs devis
                </p>
              </div>

              {/* Boutons */}
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowPublishModal(false);
                    setPublishDescription('');
                    setPublishPhotos([]);
                    setPublishBudget('');
                  }}
                  className="flex-1 px-6 py-3 border-2 border-[#6C757D] text-[#6C757D] hover:bg-[#6C757D] hover:text-white rounded-lg font-semibold transition-colors"
                  disabled={isPublishing}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      if (!publishDescription.trim()) {
                        alert('⚠️ Veuillez décrire votre besoin');
                        return;
                      }

                      setIsPublishing(true);

                      // Récupérer les critères depuis l'URL
                      const categorie = searchParams.get('categorie');
                      const ville = searchParams.get('ville');
                      const codePostal = searchParams.get('codePostal') ?? '';
                      const datesStr = searchParams.get('dates');
                      const flexible = searchParams.get('flexible') === 'true';
                      const flexibiliteDays = parseInt(searchParams.get('flexibiliteDays') || '0');
                      const urgence = searchParams.get('urgence') as 'faible' | 'normale' | 'urgent';
                      const rayonMaxParam = searchParams.get('rayonMax');
                      const rayonMax = rayonMaxParam ? parseInt(rayonMaxParam) : 10;

                      if (!categorie || !ville || !datesStr) {
                        alert('Critères de recherche manquants');
                        setIsPublishing(false);
                        return;
                      }

                      const dates = JSON.parse(datesStr) as string[];

                      // Importer les services nécessaires
                      const { Timestamp } = await import('firebase/firestore');
                      const { createDemande, notifyQualifiedArtisans } = await import('@/lib/firebase/demande-service');
                      const { uploadMultiplePhotos } = await import('@/lib/firebase/storage-service');

                      // Convertir les dates string en Timestamp Firestore
                      const datesTimestamps = dates.map(dateStr => {
                        const date = new Date(dateStr);
                        return Timestamp.fromDate(date);
                      });

                      // Upload des photos si présentes
                      let photosUrls: string[] = [];
                      if (publishPhotos.length > 0) {
                        photosUrls = await uploadMultiplePhotos(publishPhotos, 'demandes', firebaseUser!.uid);
                      }

                      // Créer la demande publique
                      const demande = await createDemande({
                        clientId: firebaseUser!.uid,
                        type: 'publique',
                        statut: 'publiee',
                        categorie: categorie as any,
                        description: publishDescription.trim(),
                        localisation: {
                          ville,
                          codePostal,
                          adresse: ville,
                        },
                        datesSouhaitees: {
                          dates: datesTimestamps,
                          flexible,
                          ...(flexible && flexibiliteDays > 0 && { flexibiliteDays }),
                        },
                        urgence: urgence || 'normale',
                        critereRecherche: {
                          metier: categorie,
                          ville,
                          rayon: rayonMax,
                        },
                        artisansMatches: [],
                        devisRecus: 0,
                        ...(photosUrls.length > 0 && { photosUrls }),
                        ...(publishBudget && { budget: parseInt(publishBudget) }),
                      });

                      // Notifier les artisans qualifiés (en arrière-plan)
                      notifyQualifiedArtisans(demande.id).catch(error => {
                        console.error('⚠️ Erreur notification artisans:', error);
                      });

                      // Fermer le modal et rediriger
                      setShowPublishModal(false);
                      router.push(`/client/demandes?success=demande_publiee&demandeId=${demande.id}`);
                    } catch (error) {
                      console.error('❌ Erreur création demande publique:', error);
                      alert('Impossible de publier la demande. Veuillez réessayer.');
                      setIsPublishing(false);
                    }
                  }}
                  className="flex-1 px-6 py-3 bg-[#FF6B00] hover:bg-[#E56100] text-white rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isPublishing}
                >
                  {isPublishing ? '⏳ Publication...' : '📢 Publier ma demande'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResultatsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#FF6B00] border-t-transparent"></div>
      </div>
    }>
      <ResultatsContent />
    </Suspense>
  );
}
