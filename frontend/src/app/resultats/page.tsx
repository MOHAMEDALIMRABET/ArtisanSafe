'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { matchArtisans } from '@/lib/firebase/matching-service';
import type { MatchingResult, MatchingCriteria } from '@/types/firestore';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

function ResultatsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [results, setResults] = useState<MatchingResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function performMatching() {
      try {
        // Récupérer les critères depuis l'URL
        const categorie = searchParams.get('categorie');
        const ville = searchParams.get('ville');
        const codePostal = searchParams.get('codePostal');
        const datesStr = searchParams.get('dates');
        const flexible = searchParams.get('flexible') === 'true';
        const flexibiliteDays = parseInt(searchParams.get('flexibiliteDays') || '0');
        const urgence = searchParams.get('urgence') as 'faible' | 'normale' | 'urgent';
        const lat = searchParams.get('lat');
        const lon = searchParams.get('lon');

        if (!categorie || !ville || !codePostal || !datesStr) {
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

  const categorie = searchParams.get('categorie');
  const ville = searchParams.get('ville');

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Header */}
      <header className="bg-[#2C3E50] text-white py-6 shadow-lg">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">
                {results.length} artisan{results.length > 1 ? 's' : ''} trouvé{results.length > 1 ? 's' : ''}
              </h1>
              <p className="text-[#95A5A6] mt-1">
                {categorie} • {ville}
              </p>
            </div>
            <Button
              onClick={() => router.push('/recherche')}
              className="border-2 border-white text-white hover:bg-white hover:text-[#2C3E50]"
            >
              Modifier la recherche
            </Button>
          </div>
        </div>
      </header>

      {/* Résultats */}
      <main className="container mx-auto px-4 py-8">
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
              <Card
                key={result.artisan.id}
                className="p-6 hover:border-[#FF6B00] transition-all cursor-pointer"
                onClick={() => router.push(`/artisan/${result.artisan.userId}`)}
              >
                <div className="flex gap-6">
                  {/* Photo profil */}
                  <div className="flex-shrink-0">
                    <div className="w-24 h-24 bg-[#E9ECEF] rounded-full flex items-center justify-center text-4xl">
                      {result.artisan.photoProfil ? (
                        <img
                          src={result.artisan.photoProfil}
                          alt={result.artisan.nomEntreprise}
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
                          {result.artisan.nomEntreprise}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-[#6C757D]">
                          <span>{result.artisan.metiers.join(' • ')}</span>
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
                    {result.artisan.description && (
                      <p className="text-[#6C757D] mb-3 line-clamp-2">
                        {result.artisan.description}
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
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#2C3E50] text-sm">Score de compatibilité :</span>
                        <div className="flex items-center gap-1">
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
                                {hasHalfStar && <span className="text-[#FFC107] text-xl">⯨</span>}
                                {[...Array(emptyStars)].map((_, i) => (
                                  <span key={`empty-${i}`} className="text-gray-300 text-xl">★</span>
                                ))}
                                <span className="text-[#6C757D] text-sm ml-1">({stars.toFixed(1)}/5)</span>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                      
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/demande/nouvelle?artisan=${result.artisan.userId}`);
                        }}
                        className="bg-[#FF6B00] hover:bg-[#E56100] text-white"
                      >
                        📩 Demander un devis
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* CTA en bas de page */}
        {results.length > 0 && (
          <div className="mt-12 bg-[#2C3E50] text-white p-8 rounded-lg text-center">
            <h2 className="text-2xl font-bold mb-2">
              Vous n'avez pas trouvé l'artisan idéal ?
            </h2>
            <p className="text-[#95A5A6] mb-6">
              Modifiez vos critères ou activez la flexibilité des dates pour plus de résultats
            </p>
            <Button
              onClick={() => router.push('/recherche')}
              className="bg-[#FF6B00] hover:bg-[#E56100] text-white"
            >
              Nouvelle recherche
            </Button>
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
