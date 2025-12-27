'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Logo } from '@/components/ui';
import { Input } from '@/components/ui/Input';

type Categorie = 'plomberie' | 'electricite' | 'menuiserie' | 'maconnerie' | 'peinture' | 'autre';
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

const categories: { value: Categorie; label: string; icon: string }[] = [
  { value: 'plomberie', label: 'Plomberie', icon: '🔧' },
  { value: 'electricite', label: 'Électricité', icon: '⚡' },
  { value: 'menuiserie', label: 'Menuiserie', icon: '🪵' },
  { value: 'maconnerie', label: 'Maçonnerie', icon: '🧱' },
  { value: 'peinture', label: 'Peinture', icon: '🎨' },
  { value: 'autre', label: 'Autre', icon: '🛠️' },
];

export default function RecherchePage() {
  const router = useRouter();
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation basique
    if (!criteria.categorie) {
      alert('Veuillez sélectionner une catégorie');
      return;
    }
    if (!criteria.localisation.ville || !criteria.localisation.codePostal) {
      alert('Veuillez renseigner votre localisation');
      return;
    }
    if (criteria.datesSouhaitees.dates[0] === '') {
      alert('Veuillez sélectionner au moins une date');
      return;
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
      {/* Header */}
      <header className="bg-[#2C3E50] text-white py-6 shadow-lg">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Trouvez votre artisan</h1>
            <p className="text-[#95A5A6] mt-2">Décrivez votre projet, nous trouvons les artisans disponibles</p>
          </div>
          <Logo size="md" href="/" />
        </div>
      </header>

      {/* Formulaire de recherche */}
      <main className="container mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-8 max-w-3xl mx-auto">
          
          {/* Étape 1: Catégorie */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-[#2C3E50] mb-4">
              1. Quel type de travaux ?
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCriteria({ ...criteria, categorie: cat.value })}
                  className={`
                    p-4 rounded-lg border-2 transition-all
                    ${criteria.categorie === cat.value
                      ? 'border-[#FF6B00] bg-[#FF6B00] text-white'
                      : 'border-[#E9ECEF] hover:border-[#FF6B00] text-[#2C3E50]'
                    }
                  `}
                >
                  <div className="text-3xl mb-2">{cat.icon}</div>
                  <div className="font-semibold">{cat.label}</div>
                </button>
              ))}
            </div>
          </section>

          {/* Étape 2: Localisation */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-[#2C3E50] mb-4">
              2. Où se situe le chantier ?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Ville"
                value={criteria.localisation.ville}
                onChange={(e) =>
                  setCriteria({
                    ...criteria,
                    localisation: { ...criteria.localisation, ville: e.target.value },
                  })
                }
                placeholder="Paris, Lyon, Marseille..."
                required
              />
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
            
            {/* Toggle flexibilité */}
            <div className="mb-4 p-4 bg-[#FFF3E0] border-l-4 border-[#FF6B00] rounded">
              <label className="flex items-center cursor-pointer">
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
                  className="w-5 h-5 text-[#FF6B00] rounded focus:ring-[#FF6B00]"
                />
                <span className="ml-3 text-[#2C3E50] font-semibold">
                  Mes dates sont flexibles
                </span>
                <span className="ml-2 text-sm text-[#6C757D]">
                  (Augmente vos chances de trouver un artisan disponible !)
                </span>
              </label>

              {criteria.datesSouhaitees.flexible && (
                <div className="mt-3">
                  <label className="block text-sm text-[#2C3E50] mb-2">
                    Flexibilité : ± {criteria.datesSouhaitees.flexibiliteDays} jours
                  </label>
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
                    className="w-full accent-[#FF6B00]"
                  />
                  <div className="flex justify-between text-xs text-[#6C757D] mt-1">
                    <span>1 jour</span>
                    <span>14 jours</span>
                  </div>
                </div>
              )}
            </div>

            {/* Sélection de dates */}
            <div className="space-y-3">
              {criteria.datesSouhaitees.dates.map((date, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    type="date"
                    label={index === 0 ? 'Date souhaitée' : `Alternative ${index}`}
                    value={date}
                    onChange={(e) => updateDate(index, e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    required={index === 0}
                    className="flex-1"
                  />
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() => removeDate(index)}
                      className="mt-6 px-3 text-[#DC3545] hover:bg-[#DC3545] hover:text-white rounded border border-[#DC3545] transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              
              {criteria.datesSouhaitees.dates.length < 3 && (
                <button
                  type="button"
                  onClick={addDateField}
                  className="text-[#FF6B00] hover:underline text-sm"
                >
                  + Ajouter une date alternative
                </button>
              )}
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
