'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { matchArtisans } from '@/lib/firebase/matching-service';
import type { MatchingResult, MatchingCriteria, User } from '@/types/firestore';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Logo } from '@/components/ui';
import { authService } from '@/lib/auth-service';
import { getUserById } from '@/lib/firebase/user-service';

function ResultatsContent() {

  const searchParams = useSearchParams();
  const router = useRouter();
  const [results, setResults] = useState<MatchingResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [dashboardUrl, setDashboardUrl] = useState('/');
  const [villeInput, setVilleInput] = useState<string>(searchParams.get('ville') || '');

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
          setDashboardUrl(userData.role === 'artisan' ? '/artisan/dashboard' : '/dashboard');
        }
      }
    } catch (error) {
      console.error('Erreur chargement utilisateur:', error);
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
  const date = searchParams.get('date') || defaultDate;
  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Header */}
      <header className="bg-[#2C3E50] text-white py-6 shadow-lg">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push(dashboardUrl)}
                className="text-white hover:text-[#FF6B00] transition-colors"
                title="Retour au dashboard"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-3xl font-bold">Trouvez votre artisan</h1>
                <p className="text-[#95A5A6] mt-2">Décrivez votre projet, nous trouvons les artisans disponibles</p>
              </div>
            </div>
            <Logo size="md" href={dashboardUrl} />
          </div>
          
          {/* Message de bienvenue */}
          {user && (
            <div className="bg-[#1A3A5C] rounded-lg px-4 py-3 mt-4">
              <p className="text-white">
                👋 Bienvenue <span className="font-semibold text-[#FF6B00]">{user.prenom} {user.nom}</span>
              </p>
            </div>
          )}
        </div>
      </header>

      {/* Bannière de recherche rapide */}
      <div className="bg-white border-b border-[#E9ECEF] py-4 sticky top-0 z-40 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-3 max-w-5xl mx-auto">
            {/* Type de travaux */}
            <div className="flex-1">
              <label className="block text-xs text-[#6C757D] mb-1">Type de travaux</label>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-[#FF6B00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <select 
                  className="flex-1 border-none outline-none bg-transparent text-[#2C3E50] font-medium cursor-pointer"
                  value={categorie}
                  onChange={e => router.push(`/resultats?${new URLSearchParams({ ...Object.fromEntries(searchParams.entries()), categorie: e.target.value }).toString()}`)}
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

            <div className="w-px h-12 bg-[#E9ECEF]"></div>

            {/* Localisation */}
            <div className="flex-1">
              <label className="block text-xs text-[#6C757D] mb-1">Localisation</label>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-[#FF6B00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <input 
                  type="text" 
                  placeholder="Paris, Lyon..." 
                  className="flex-1 border-none outline-none bg-transparent text-[#2C3E50] font-medium placeholder-[#95A5A6]"
                  value={ville}
                  readOnly
                />
              </div>
            </div>

            <div className="w-px h-12 bg-[#E9ECEF]"></div>

            {/* Date souhaitée */}
            <div className="flex-1">
              <label className="block text-xs text-[#6C757D] mb-1">Date souhaitée</label>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-[#FF6B00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <input 
                  type="date" 
                  className="flex-1 border-none outline-none bg-transparent text-[#2C3E50] font-medium"
                  value={date || new Date().toISOString().slice(0, 10)}
                  onChange={e => router.push(`/resultats?${new URLSearchParams({ ...Object.fromEntries(searchParams.entries()), date: e.target.value }).toString()}`)}
                />
              </div>
            </div>

            <div className="w-px h-12 bg-[#E9ECEF]"></div>

            {/* Flexibilité */}
            <div className="flex-shrink-0">
              <label className="block text-xs text-[#6C757D] mb-1">Flexibilité</label>
              <div className="flex items-center gap-1">
                <select 
                  className="border-none outline-none bg-transparent text-[#2C3E50] font-medium cursor-pointer pr-1"
                  value={searchParams.get('flexibiliteDays') || '0'}
                  onChange={e => router.push(`/resultats?${new URLSearchParams({ ...Object.fromEntries(searchParams.entries()), flexibiliteDays: e.target.value, flexible: e.target.value !== '0' ? 'true' : 'false' }).toString()}`)}
                >
                  <option value="0">±0J</option>
                  <option value="1">±1J</option>
                  <option value="2">±2J</option>
                  <option value="3">±3J</option>
                  <option value="5">±5J</option>
                  <option value="7">±7J</option>
                  <option value="14">±14J</option>
                </select>
              </div>
            </div>

            {/* Bouton Rechercher */}
            <button 
              onClick={() => {
                router.push(`/resultats?${new URLSearchParams(Object.fromEntries(searchParams.entries())).toString()}`);
              }}
              className="bg-[#FF6B00] hover:bg-[#E56100] text-white font-bold rounded-xl px-8 py-3 transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>Rechercher</span>
            </button>
          </div>
        </div>
      </div>

      {/* Résultats */}
      <main className="container mx-auto px-4 py-8">
        {(() => {
          console.log('🎨 Rendu de la page - Nombre de résultats:', results.length);
          console.log('🎨 Résultats:', results);
          return null;
        })()}
        {results.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="text-2xl font-bold text-[#2C3E50] mb-2">
              Aucun artisan disponible
            </h2>
            <p className="text-[#6C757D] mb-6">
              Essayez d'élargir vos critères de recherche ou d'activer la flexibilité des dates
            </p>
            <Button
              onClick={() => router.push('/recherche')}
              className="bg-[#FF6B00] hover:bg-[#E56100] text-white"
            >
              Modifier ma recherche
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
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
                        <div>
                          <h3 className="text-xl font-bold text-[#2C3E50] mb-1">
                            {result.artisan.raisonSociale || result.artisan.nom}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-[#6C757D]">
                            <span>{result.artisan.metiers?.join(' • ')}</span>
                          </div>
                        </div>
                        {/* Badge vérifié */}
                        {result.artisan.verified && (
                          <div className="bg-[#28A745] text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                            ✓ Vérifié
                          </div>
                        )}
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
                      <div className="flex items-center justify-between mb-4">
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

                      {user ? (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/demande/nouvelle?artisan=${result.artisan.userId}`);
                          }}
                          className="bg-[#FF6B00] hover:bg-[#E56100] text-white"
                        >
                          📩 Demander un devis
                        </Button>
                      ) : (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push('/connexion');
                          }}
                          className="border-2 border-[#FF6B00] bg-white text-[#FF6B00] font-bold px-4 py-2 rounded-lg transition-all duration-200 hover:bg-[#FF6B00] hover:text-white hover:shadow-lg"
                        >
                          Se connecter pour demander un devis
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
            ))}

            {/* Section "Pas trouvé l'artisan idéal ?" */}
            <div className="mt-12 bg-gradient-to-r from-[#2C3E50] to-[#1A3A5C] rounded-2xl shadow-2xl p-8 text-center">
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
            </div>
          </div>
        )}
      </main>
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
