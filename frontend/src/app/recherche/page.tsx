'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Logo } from '@/components/ui';
import { Input } from '@/components/ui/Input';
import { METIERS_AVEC_ICONES } from '@/lib/constants/metiers';
import { authService } from '@/lib/auth-service';
import { getUserById } from '@/lib/firebase/user-service';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Categorie, User } from '@/types/firestore';

type Urgence = 'faible' | 'normale' | 'urgent';

interface SearchCriteria {
  categorie: Categorie | '';
  localisation: {
    adresse: string;
    ville: string;
    codePostal: string;
  };
  datesSouhaitees: {
    dates: string[];
    flexible: boolean;
    flexibiliteDays?: number;
  };
  urgence: Urgence;
  rayonMax: number;
}

interface VilleSuggestion {
  nom: string;
  codePostal: string;
  departement: string;
}

export default function RecherchePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const { t } = useLanguage();
  const [dashboardUrl, setDashboardUrl] = useState('/');
  const [villeSuggestions, setVilleSuggestions] = useState<VilleSuggestion[]>([]);
  const fromDashboard = searchParams.get('from') === 'dashboard';
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [criteria, setCriteria] = useState<SearchCriteria>({
    categorie: '',
    localisation: {
      adresse: '',
      ville: '',
      codePostal: '',
    },
    datesSouhaitees: {
      dates: [''],
      flexible: false,
    },
    urgence: 'normale',
    rayonMax: 20,
  });

  useEffect(() => {
    loadUserData();
    
    // Pré-remplir le formulaire avec les paramètres URL
    const categorieParam = searchParams.get('categorie');
    const villeParam = searchParams.get('ville');
    const codePostalParam = searchParams.get('codePostal');
    const urgenceParam = searchParams.get('urgence');
    const datesParam = searchParams.get('dates');
    const flexibleParam = searchParams.get('flexible');
    const flexibilityDaysParam = searchParams.get('flexibiliteDays');
    const rayonMaxParam = searchParams.get('rayonMax');
    
    if (categorieParam || villeParam || codePostalParam) {
      const newCriteria: SearchCriteria = {
        categorie: (categorieParam as Categorie) || '',
        localisation: {
          adresse: '',
          ville: villeParam || '',
          codePostal: codePostalParam || '',
        },
        datesSouhaitees: {
          dates: datesParam ? JSON.parse(datesParam) : [''],
          flexible: flexibleParam === 'true',
          flexibiliteDays: flexibilityDaysParam ? parseInt(flexibilityDaysParam) : undefined,
        },
        urgence: (urgenceParam as Urgence) || 'normale',
        rayonMax: rayonMaxParam ? parseInt(rayonMaxParam) : 20,
      };
      
      setCriteria(newCriteria);
    }
  }, [searchParams]);

  async function loadUserData() {
    try {
      const currentUser = authService.getCurrentUser();
      if (currentUser) {
        const userData = await getUserById(currentUser.uid);
        if (userData) {
          setUser(userData);
          // Définir l'URL du dashboard selon le rôle
          setDashboardUrl(userData.role === 'artisan' ? '/artisan/dashboard' : '/dashboard');
        }
      }
    } catch (error) {
      console.error('Erreur chargement utilisateur:', error);
    }
  }

  // Recherche de villes avec autocomplétion
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
      const suggestions: VilleSuggestion[] = data.flatMap((commune: any) => 
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

  function selectVille(suggestion: VilleSuggestion) {
    setCriteria({
      ...criteria,
      localisation: {
        ...criteria.localisation,
        ville: suggestion.nom,
        codePostal: suggestion.codePostal
      }
    });
    setShowSuggestions(false);
    setVilleSuggestions([]);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('🔍 Soumission du formulaire de recherche');
    console.log('Critères:', criteria);
    
    // Validation basique
    if (!criteria.categorie) {
      console.error('❌ Catégorie manquante');
      alert(t('alerts.validation.selectCategory'));
      return;
    }
    if (!criteria.localisation.ville || !criteria.localisation.codePostal) {
      console.error('❌ Localisation manquante');
      alert(t('alerts.validation.enterLocation'));
      return;
    }
    if (criteria.datesSouhaitees.dates[0] === '') {
      console.error('❌ Date manquante');
      alert(t('alerts.validation.selectDate'));
      return;
    }

    console.log('✅ Validation passée');

    // Obtenir les coordonnées GPS de la ville (pour meilleure précision)
    let coordonneesGPS = null;
    try {
      const response = await fetch(
        `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(criteria.localisation.ville)}&codePostal=${criteria.localisation.codePostal}&fields=centre&limit=1`
      );
      const data = await response.json();
      if (data.length > 0 && data[0].centre) {
        coordonneesGPS = {
          latitude: data[0].centre.coordinates[1],
          longitude: data[0].centre.coordinates[0]
        };
      }
    } catch (error) {
      console.warn('Impossible de géocoder la ville:', error);
    }

    // Encoder les critères et rediriger vers la page résultats
    const searchParams = new URLSearchParams({
      categorie: criteria.categorie,
      ville: criteria.localisation.ville,
      codePostal: criteria.localisation.codePostal,
      dates: JSON.stringify(criteria.datesSouhaitees.dates),
      flexible: criteria.datesSouhaitees.flexible.toString(),
      flexibiliteDays: criteria.datesSouhaitees.flexibiliteDays?.toString() || '0',
      urgence: criteria.urgence,
      rayonMax: criteria.rayonMax.toString(),
    });

    // Ajouter coordonnées GPS si disponibles
    if (coordonneesGPS) {
      searchParams.append('lat', coordonneesGPS.latitude.toString());
      searchParams.append('lon', coordonneesGPS.longitude.toString());
    }

    console.log('🚀 Redirection vers:', `/resultats?${searchParams.toString()}`);
    router.push(`/resultats?${searchParams.toString()}`);
  };

  const addDateField = () => {
    setCriteria({
      ...criteria,
      datesSouhaitees: {
        ...criteria.datesSouhaitees,
        dates: [...criteria.datesSouhaitees.dates, ''],
      },
    });
  };

  const updateDate = (index: number, value: string) => {
    const newDates = [...criteria.datesSouhaitees.dates];
    newDates[index] = value;
    setCriteria({
      ...criteria,
      datesSouhaitees: {
        ...criteria.datesSouhaitees,
        dates: newDates,
      },
    });
  };

  const removeDate = (index: number) => {
    if (criteria.datesSouhaitees.dates.length > 1) {
      const newDates = criteria.datesSouhaitees.dates.filter((_, i) => i !== index);
      setCriteria({
        ...criteria,
        datesSouhaitees: {
          ...criteria.datesSouhaitees,
          dates: newDates,
        },
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      {/* Titre de la page */}
      {fromDashboard ? (
        // Header bleu avec retour (style pages client)
        <div className="bg-[#2C3E50] text-white py-8">
          <div className="container mx-auto px-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 text-white hover:text-[#FF6B00] mb-4"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Retour au tableau de bord
            </button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Trouvez votre artisan</h1>
                <p className="text-gray-300 mt-2">Décrivez votre projet, nous trouvons les artisans disponibles</p>
              </div>
              <button
                type="button"
                onClick={() => setShowHowItWorks(!showHowItWorks)}
                className="flex items-center gap-2 px-4 py-2 border-2 border-white text-white rounded-lg hover:bg-white hover:bg-opacity-10 transition-colors"
                title="Afficher/masquer comment ça marche"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span>💡 Comment ça marche ?</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        // Header blanc classique (depuis page d'accueil ou autre)
        <div className="bg-white shadow-sm">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-[#2C3E50]">Trouvez votre artisan</h1>
                <p className="text-[#6C757D] text-sm mt-2">Décrivez votre projet, nous trouvons les artisans disponibles</p>
              </div>
              <button
                type="button"
                onClick={() => setShowHowItWorks(!showHowItWorks)}
                className="flex items-center gap-2 px-4 py-2 bg-[#FF6B00] text-white rounded-lg hover:bg-[#E56100] transition-colors shadow-md"
                title="Afficher/masquer comment ça marche"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span className="hidden sm:inline">💡 Comment ça marche ?</span>
                <span className="sm:hidden">💡</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formulaire de recherche */}
      <main className="container mx-auto px-4 py-8">
        {/* 💡 Encart "Comment ça marche ?" (affichage conditionnel) */}
        {showHowItWorks && (
          <div className="mb-6 animate-fadeIn">
            <div className="bg-white border-l-4 border-[#FF6B00] rounded-lg shadow-md relative">
              <button
                onClick={() => setShowHowItWorks(false)}
                className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-orange-100 transition-colors"
                title="Fermer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="p-6 pr-12">
                <h3 className="font-bold text-[#2C3E50] mb-4 flex items-center gap-2 text-xl">
                  <svg className="w-6 h-6 text-[#FF6B00]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  💡 Comment fonctionne ArtisanSafe ?
                </h3>
                <div className="space-y-4">
                  {/* Étape 1 */}
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-[#FF6B00] text-white rounded-full flex items-center justify-center font-bold">
                      1
                    </div>
                    <div>
                      <h4 className="font-semibold text-[#2C3E50] mb-1">🔍 Recherchez des artisans qualifiés</h4>
                      <p className="text-sm text-gray-700">
                        Remplissez le formulaire ci-dessous : type de travaux, localisation et dates souhaitées. 
                        Nous trouvons automatiquement les artisans disponibles et vérifiés dans votre secteur.
                      </p>
                    </div>
                  </div>

                  {/* Étape 2 */}
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-[#FF6B00] text-white rounded-full flex items-center justify-center font-bold">
                      2
                    </div>
                    <div>
                      <h4 className="font-semibold text-[#2C3E50] mb-1">📋 Comparez et contactez</h4>
                      <p className="text-sm text-gray-700">
                        Consultez les profils des artisans (expérience, avis clients, certifications). 
                        Créez une demande de devis personnalisée pour décrire votre projet en détail.
                      </p>
                    </div>
                  </div>

                  {/* Étape 3 */}
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-[#FF6B00] text-white rounded-full flex items-center justify-center font-bold">
                      3
                    </div>
                    <div>
                      <h4 className="font-semibold text-[#2C3E50] mb-1">✅ Recevez des devis détaillés</h4>
                      <p className="text-sm text-gray-700">
                        Les artisans intéressés vous envoient des devis chiffrés avec détails des prestations, 
                        montants HT/TTC et délais de réalisation. Comparez-les en toute transparence.
                      </p>
                    </div>
                  </div>

                  {/* Étape 4 */}
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-[#FF6B00] text-white rounded-full flex items-center justify-center font-bold">
                      4
                    </div>
                    <div>
                      <h4 className="font-semibold text-[#2C3E50] mb-1">🔒 Sécurité et paiement protégé</h4>
                      <p className="text-sm text-gray-700">
                        Une fois votre devis accepté, le paiement est sécurisé avec séquestre (escrow). 
                        Les fonds sont libérés à l&apos;artisan uniquement après validation des travaux.
                      </p>
                    </div>
                  </div>

                  {/* Étape 5 */}
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-[#28A745] text-white rounded-full flex items-center justify-center font-bold">
                      ✓
                    </div>
                    <div>
                      <h4 className="font-semibold text-[#2C3E50] mb-1">⭐ Évaluez votre expérience</h4>
                      <p className="text-sm text-gray-700">
                        Après les travaux, laissez un avis pour aider la communauté. 
                        Votre retour garantit la qualité de notre réseau d&apos;artisans.
                      </p>
                    </div>
                  </div>

                  {/* Garanties */}
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <p className="text-sm text-[#2C3E50] font-semibold mb-2">🛡️ Nos garanties :</p>
                    <ul className="text-sm text-gray-700 space-y-1 ml-4">
                      <li className="flex items-center gap-2">
                        <span className="text-[#28A745]">✓</span>
                        Artisans vérifiés (KBIS, assurances décennale et RC Pro)
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-[#28A745]">✓</span>
                        Paiement sécurisé avec séquestre (protection acheteur)
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-[#28A745]">✓</span>
                        Service client disponible pour médiation en cas de litige
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-[#28A745]">✓</span>
                        Aucun partage de coordonnées avant validation du devis
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-8 max-w-3xl mx-auto">
          
          {/* Étape 1: Catégorie */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-[#2C3E50] mb-4">
              1. Quel type de travaux ?
            </h2>
            <div className="relative">
              <label className="block text-sm font-medium text-[#2C3E50] mb-2">
                Sélectionnez le type de travaux
              </label>
              <select
                value={criteria.categorie}
                onChange={(e) => setCriteria({ ...criteria, categorie: e.target.value as any })}
                required
                className="w-full px-4 py-3 border-2 border-[#E9ECEF] rounded-lg text-[#2C3E50] bg-white focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00] focus:ring-opacity-20 transition-all appearance-none cursor-pointer"
              >
                <option value="">-- Choisissez un métier --</option>
                {METIERS_AVEC_ICONES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.icon} {cat.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 pt-7 text-[#6C757D]">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </div>
            </div>
          </section>

          {/* Étape 2: Localisation */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-[#2C3E50] mb-4">
              2. Où se situe le chantier ?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Champ Ville avec autocomplétion */}
              <div className="relative">
                <label className="block text-sm font-medium text-[#2C3E50] mb-2">
                  Ville *
                </label>
                <input
                  type="text"
                  value={criteria.localisation.ville}
                  onChange={(e) => {
                    setCriteria({
                      ...criteria,
                      localisation: { ...criteria.localisation, ville: e.target.value },
                    });
                    searchVilles(e.target.value);
                  }}
                  onFocus={() => {
                    if (villeSuggestions.length > 0) setShowSuggestions(true);
                  }}
                  placeholder="Paris, Lyon, Marseille..."
                  required
                  className="w-full px-4 py-3 border-2 border-[#E9ECEF] rounded-lg text-[#2C3E50] bg-white focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00] focus:ring-opacity-20 transition-all"
                />
                
                {/* Liste des suggestions */}
                {showSuggestions && villeSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border-2 border-[#FF6B00] rounded-lg shadow-lg max-h-60 overflow-y-auto">
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

              <Input
                label="Code postal"
                value={criteria.localisation.codePostal}
                onChange={(e) =>
                  setCriteria({
                    ...criteria,
                    localisation: { ...criteria.localisation, codePostal: e.target.value },
                  })
                }
                placeholder="75001"
                pattern="[0-9]{5}"
                required
              />
            </div>
            <Input
              label="Adresse complète (optionnel)"
              value={criteria.localisation.adresse}
              onChange={(e) =>
                setCriteria({
                  ...criteria,
                  localisation: { ...criteria.localisation, adresse: e.target.value },
                })
              }
              placeholder="123 Rue de la République"
              className="mt-4"
            />
            
            {/* Rayon de recherche */}
            <div className="mt-6 bg-gradient-to-br from-white to-[#FAFBFC] border border-[#E9ECEF] rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-[#2C3E50] flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#FF6B00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Rayon de recherche
                </label>
                <span className="text-base font-bold text-[#FF6B00] bg-[#FFF3E0] px-3 py-1.5 rounded-lg">
                  {criteria.rayonMax} km
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                step="5"
                value={criteria.rayonMax}
                onChange={(e) =>
                  setCriteria({
                    ...criteria,
                    rayonMax: parseInt(e.target.value),
                  })
                }
                className="w-full h-2 bg-[#E9ECEF] rounded-lg appearance-none cursor-pointer accent-[#FF6B00] slider"
                style={{
                  background: `linear-gradient(to right, #FF6B00 0%, #FF6B00 ${((criteria.rayonMax - 5) / 95) * 100}%, #E9ECEF ${((criteria.rayonMax - 5) / 95) * 100}%, #E9ECEF 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-[#6C757D] mt-2">
                <span>5 km</span>
                <span className="text-[#95A5A6]">Distance maximale autour de votre adresse</span>
                <span>100 km</span>
              </div>
            </div>
          </section>

          {/* Étape 3: Dates - FEATURE CLÉS */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-[#2C3E50] mb-4">
              3. Quand souhaitez-vous réaliser les travaux ?
            </h2>
            
            {/* Calendrier et flexibilité côte à côte */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Calendrier */}
              <div>
                <label className="block text-sm font-medium text-[#2C3E50] mb-2">
                  Date de début souhaitée *
                </label>
                <input
                  type="date"
                  value={criteria.datesSouhaitees.dates[0]}
                  onChange={(e) => updateDate(0, e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  required
                  className="w-full px-4 py-3 border-2 border-[#E9ECEF] rounded-lg text-[#2C3E50] bg-white focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00] focus:ring-opacity-20 transition-all"
                />
              </div>

              {/* Toggle flexibilité */}
              <div className="border border-[#E9ECEF] bg-gradient-to-br from-white to-[#FAFBFC] rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
                <label className="flex items-start cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={criteria.datesSouhaitees.flexible}
                    onChange={(e) =>
                      setCriteria({
                        ...criteria,
                        datesSouhaitees: {
                          ...criteria.datesSouhaitees,
                          flexible: e.target.checked,
                          flexibiliteDays: e.target.checked ? 3 : undefined,
                        },
                      })
                    }
                    className="w-4 h-4 text-[#FF6B00] rounded border-[#E9ECEF] focus:ring-2 focus:ring-[#FF6B00] focus:ring-opacity-20 mt-0.5 flex-shrink-0 cursor-pointer"
                  />
                  <div className="ml-3">
                    <span className="text-[#2C3E50] font-semibold text-base block group-hover:text-[#FF6B00] transition-colors">
                      Mes dates sont flexibles
                    </span>
                    <span className="text-xs text-[#6C757D] mt-1 block leading-relaxed">
                      Augmente vos chances de trouver un artisan disponible
                    </span>
                  </div>
                </label>

                {criteria.datesSouhaitees.flexible && (
                  <div className="mt-4 pt-4 border-t border-[#E9ECEF]">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm text-[#2C3E50] font-medium">
                        Flexibilité
                      </label>
                      <span className="text-sm font-semibold text-[#FF6B00] bg-[#FFF3E0] px-2 py-1 rounded">
                        ± {criteria.datesSouhaitees.flexibiliteDays} jour{(criteria.datesSouhaitees.flexibiliteDays || 0) > 1 ? 's' : ''}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="14"
                      value={criteria.datesSouhaitees.flexibiliteDays || 3}
                      onChange={(e) =>
                        setCriteria({
                          ...criteria,
                          datesSouhaitees: {
                            ...criteria.datesSouhaitees,
                            flexibiliteDays: parseInt(e.target.value),
                          },
                        })
                      }
                      className="w-full h-2 bg-[#E9ECEF] rounded-lg appearance-none cursor-pointer accent-[#FF6B00] slider"
                      style={{
                        background: `linear-gradient(to right, #FF6B00 0%, #FF6B00 ${((criteria.datesSouhaitees.flexibiliteDays || 3) - 1) / 13 * 100}%, #E9ECEF ${((criteria.datesSouhaitees.flexibiliteDays || 3) - 1) / 13 * 100}%, #E9ECEF 100%)`
                      }}
                    />
                    <div className="flex justify-between text-xs text-[#6C757D] mt-2">
                      <span>1 jour</span>
                      <span>14 jours</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Étape 4: Urgence */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-[#2C3E50] mb-4">
              4. Quel est le degré d'urgence ?
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { value: 'faible' as Urgence, label: 'Faible', desc: 'Pas pressé', color: 'bg-[#28A745]' },
                { value: 'normale' as Urgence, label: 'Normal', desc: 'Dans les semaines', color: 'bg-[#17A2B8]' },
                { value: 'urgent' as Urgence, label: 'Urgent', desc: 'Le plus tôt possible', color: 'bg-[#FFC107]' },
              ].map((urg) => (
                <button
                  key={urg.value}
                  type="button"
                  onClick={() => setCriteria({ ...criteria, urgence: urg.value })}
                  className={`
                    p-4 rounded-lg border-2 transition-all
                    ${criteria.urgence === urg.value
                      ? `border-transparent ${urg.color} text-white`
                      : 'border-[#E9ECEF] hover:border-[#FF6B00] text-[#2C3E50]'
                    }
                  `}
                >
                  <div className="font-semibold">{urg.label}</div>
                  <div className="text-sm opacity-80">{urg.desc}</div>
                </button>
              ))}
            </div>
          </section>

          {/* Bouton de soumission */}
          <Button
            type="submit"
            className="w-full bg-[#FF6B00] hover:bg-[#E56100] text-white text-lg py-4 rounded-lg font-bold shadow-lg"
          >
            🔍 Trouver des artisans disponibles
          </Button>

          <p className="text-center text-sm text-[#6C757D] mt-4">
            Gratuit et sans engagement • Réponse en quelques heures
          </p>
        </form>
      </main>
    </div>
  );
}
