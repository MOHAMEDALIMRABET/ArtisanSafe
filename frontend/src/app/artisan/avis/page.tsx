'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/lib/auth-service';
import { getUserById } from '@/lib/firebase/user-service';
import { getArtisanByUserId } from '@/lib/firebase/artisan-service';
import { getAvisByArtisanId, calculateAverageRating, addReponseArtisan } from '@/lib/firebase/avis-service';
import type { User, Artisan, Avis } from '@/types/firestore';
import Link from 'next/link';

export default function AvisArtisanPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [artisan, setArtisan] = useState<Artisan | null>(null);
  const [avis, setAvis] = useState<Avis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ moyenne: 0, total: 0 });
  const [reponseEnCours, setReponseEnCours] = useState<string | null>(null);
  const [reponseTexte, setReponseTexte] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        router.push('/connexion');
        return;
      }

      const userData = await getUserById(currentUser.uid);
      if (!userData || userData.role !== 'artisan') {
        router.push('/dashboard');
        return;
      }

      setUser(userData);

      const artisanData = await getArtisanByUserId(currentUser.uid);
      if (!artisanData) {
        router.push('/artisan/dashboard');
        return;
      }

      setArtisan(artisanData);

      // Charger les avis
      const avisData = await getAvisByArtisanId(artisanData.id);
      setAvis(avisData);

      // Calculer statistiques
      const statsData = await calculateAverageRating(artisanData.id);
      setStats(statsData);

      setIsLoading(false);
    } catch (error) {
      console.error('Erreur chargement données:', error);
      setIsLoading(false);
    }
  }

  async function handleRepondre(avisId: string) {
    if (!artisan) return;

    setSubmitting(true);
    try {
      await addReponseArtisan(avisId, artisan.id, reponseTexte);
      alert('✅ Votre réponse a été publiée avec succès !');
      setReponseEnCours(null);
      setReponseTexte('');
      
      // Recharger les avis
      await loadData();
    } catch (error: any) {
      alert(`❌ Erreur : ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  function formatDate(timestamp: any): string {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date);
  }

  function renderStars(note: number) {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`w-5 h-5 ${star <= note ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
            viewBox="0 0 24 24"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        ))}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B00] mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/artisan/dashboard"
            className="inline-flex items-center gap-2 text-[#FF6B00] hover:underline mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Retour au tableau de bord
          </Link>

          <h1 className="text-3xl font-bold text-[#2C3E50]">Avis Clients</h1>
          <p className="text-gray-600 mt-2">
            Consultez les retours de vos clients et répondez-y pour améliorer votre réputation.
          </p>
        </div>

        {/* Statistiques */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[#2C3E50] mb-2">
                Votre note globale
              </h2>
              <div className="flex items-center gap-4">
                <div className="text-5xl font-bold text-[#FF6B00]">
                  {stats.moyenne.toFixed(1)}
                </div>
                <div>
                  {renderStars(Math.round(stats.moyenne))}
                  <p className="text-sm text-gray-600 mt-1">
                    Basé sur {stats.total} avis
                  </p>
                </div>
              </div>
            </div>

            <div className="text-right">
              <svg className="w-24 h-24 text-yellow-400 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Liste des avis */}
        <div className="space-y-4">
          {avis.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                Aucun avis pour le moment
              </h3>
              <p className="text-gray-500">
                Les avis de vos clients apparaîtront ici après la fin de leurs interventions.
              </p>
            </div>
          ) : (
            avis.map((avisItem) => (
              <div key={avisItem.id} className="bg-white rounded-lg shadow-md p-6">
                {/* En-tête avis */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {renderStars(avisItem.note)}
                      <span className="text-sm text-gray-500">
                        {formatDate(avisItem.dateCreation)}
                      </span>
                    </div>
                    
                    {/* Points forts */}
                    {avisItem.points_forts && avisItem.points_forts.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {avisItem.points_forts.map((point, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            {point}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Points d'amélioration */}
                    {avisItem.points_amelioration && avisItem.points_amelioration.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {avisItem.points_amelioration.map((point, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            {point}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Commentaire */}
                <div className="bg-gray-50 p-4 rounded-lg mb-4">
                  <p className="text-gray-700 italic">
                    "{avisItem.commentaire}"
                  </p>
                </div>

                {/* Photos */}
                {avisItem.photos && avisItem.photos.length > 0 && (
                  <div className="flex gap-2 mb-4 overflow-x-auto">
                    {avisItem.photos.map((photo, idx) => (
                      <img
                        key={idx}
                        src={photo}
                        alt={`Photo ${idx + 1}`}
                        className="h-24 w-24 object-cover rounded-lg border-2 border-gray-200"
                      />
                    ))}
                  </div>
                )}

                {/* Réponse artisan */}
                {avisItem.reponseArtisan ? (
                  <div className="bg-blue-50 border-l-4 border-[#FF6B00] p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-[#FF6B00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                      <span className="font-semibold text-[#2C3E50]">Votre réponse</span>
                      <span className="text-sm text-gray-500">
                        • {formatDate(avisItem.reponseArtisan.date)}
                      </span>
                    </div>
                    <p className="text-gray-700">
                      {avisItem.reponseArtisan.texte}
                    </p>
                  </div>
                ) : (
                  <>
                    {reponseEnCours === avisItem.id ? (
                      <div className="border-t pt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Votre réponse (minimum 10 caractères) :
                        </label>
                        <textarea
                          value={reponseTexte}
                          onChange={(e) => setReponseTexte(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                          rows={4}
                          placeholder="Merci pour votre retour ! ..."
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleRepondre(avisItem.id)}
                            disabled={submitting || reponseTexte.trim().length < 10}
                            className="bg-[#FF6B00] text-white px-4 py-2 rounded-lg hover:bg-[#E56100] disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {submitting ? 'Publication...' : 'Publier la réponse'}
                          </button>
                          <button
                            onClick={() => {
                              setReponseEnCours(null);
                              setReponseTexte('');
                            }}
                            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setReponseEnCours(avisItem.id)}
                        className="mt-4 text-[#FF6B00] font-medium hover:underline flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                        Répondre à cet avis
                      </button>
                    )}
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
