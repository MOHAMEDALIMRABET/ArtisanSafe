'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Logo } from '@/components/ui';
import { Input } from '@/components/ui/Input';
import { METIERS_AVEC_ICONES } from '@/lib/constants/metiers';
import { authService } from '@/lib/auth-service';
import { getUserById } from '@/lib/firebase/user-service';
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
  description: string;
}

interface VilleSuggestion {
  nom: string;
  codePostal: string;
  departement: string;
}

export default function RecherchePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [dashboardUrl, setDashboardUrl] = useState('/');
  const [villeSuggestions, setVilleSuggestions] = useState<VilleSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
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
    description: '',
  });

  useEffect(() => {
    loadUserData();
  }, []);

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
      alert('Veuillez sélectionner une catégorie');
      return;
    }
    if (!criteria.localisation.ville || !criteria.localisation.codePostal) {
      console.error('❌ Localisation manquante');
      alert('Veuillez renseigner votre localisation');
      return;
    }
    if (criteria.datesSouhaitees.dates[0] === '') {
      console.error('❌ Date manquante');
      alert('Veuillez sélectionner au moins une date');
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
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Titre de la page */}
      <div className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-[#2C3E50]">Trouvez votre artisan</h1>
            <p className="text-[#6C757D] text-sm mt-2">Décrivez votre projet, nous trouvons les artisans disponibles</p>
          </div>
        </div>
      </div>

      {/* Formulaire de recherche */}
      <main className="container mx-auto px-4 py-8">
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
                  Date souhaitée *
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

          {/* Étape 5: Description (optionnel) */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-[#2C3E50] mb-4">
              5. Décrivez brièvement vos travaux (optionnel)
            </h2>
            <textarea
              value={criteria.description}
              onChange={(e) => setCriteria({ ...criteria, description: e.target.value })}
              placeholder="Ex: Rénovation salle de bain complète, environ 10m², remplacement baignoire par douche italienne..."
              rows={4}
              className="w-full px-4 py-3 border border-[#E9ECEF] rounded-lg focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00] focus:ring-opacity-20 outline-none resize-none"
            />
            <p className="text-sm text-[#6C757D] mt-2">
              Cette description aidera les artisans à mieux comprendre votre projet
            </p>
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
