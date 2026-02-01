'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/lib/auth-service';
import { getUserById } from '@/lib/firebase/user-service';
import { getAvisByClientId } from '@/lib/firebase/avis-service';
import type { User, Avis } from '@/types/firestore';
import Link from 'next/link';

export default function AvisClientPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [avis, setAvis] = useState<Avis[]>([]);
  const [avisFiltres, setAvisFiltres] = useState<Avis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filtres et tri
  const [filtreNote, setFiltreNote] = useState<number | null>(null);
  const [tri, setTri] = useState<'recent' | 'ancien' | 'note-haute' | 'note-basse'>('recent');
  const [recherche, setRecherche] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    appliquerFiltres();
  }, [avis, filtreNote, tri, recherche]);

  async function loadData() {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        router.push('/connexion');
        return;
      }

      const userData = await getUserById(currentUser.uid);
      if (!userData || userData.role !== 'client') {
        router.push('/dashboard');
        return;
      }

      setUser(userData);

      // Charger les avis déjà donnés
      const avisData = await getAvisByClientId(currentUser.uid);
      setAvis(avisData);

      setIsLoading(false);
    } catch (error) {
      console.error('Erreur chargement données:', error);
      setIsLoading(false);
    }
  }

  function appliquerFiltres() {
    let resultats = [...avis];

    // Filtre par note
    if (filtreNote !== null) {
      resultats = resultats.filter(a => a.note === filtreNote);
    }

    // Recherche textuelle
    if (recherche.trim()) {
      const rechercheLC = recherche.toLowerCase();
      resultats = resultats.filter(a =>
        a.commentaire?.toLowerCase().includes(rechercheLC) ||
        a.points_forts?.some(p => p.toLowerCase().includes(rechercheLC)) ||
        a.points_amelioration?.some(p => p.toLowerCase().includes(rechercheLC)) ||
        a.reponseArtisan?.contenu.toLowerCase().includes(rechercheLC)
      );
    }

    // Tri
    resultats.sort((a, b) => {
      switch (tri) {
        case 'recent':
          return (b.dateCreation?.toMillis() || 0) - (a.dateCreation?.toMillis() || 0);
        case 'ancien':
          return (a.dateCreation?.toMillis() || 0) - (b.dateCreation?.toMillis() || 0);
        case 'note-haute':
          return b.note - a.note;
        case 'note-basse':
          return a.note - b.note;
        default:
          return 0;
      }
    });

    setAvisFiltres(resultats);
  }

  function calculerStats() {
    if (avis.length === 0) return { moyenne: 0, total: 0 };
    const somme = avis.reduce((acc, a) => acc + a.note, 0);
    return {
      moyenne: somme / avis.length,
      total: avis.length,
    };
  }

  function calculerRepartition() {
    const repartition = [5, 4, 3, 2, 1].map(noteVal => {
      const count = avis.filter(a => a.note === noteVal).length;
      const percentage = avis.length > 0 ? (count / avis.length) * 100 : 0;
      return { note: noteVal, count, percentage };
    });
    return repartition;
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

  function renderStars(noteValue: number) {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`w-5 h-5 ${
              star <= noteValue ? 'text-yellow-400 fill-current' : 'text-gray-300'
            }`}
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
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-[#FF6B00] hover:underline"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Retour au tableau de bord
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#2C3E50] mb-2">Avis Clients</h1>
          <p className="text-gray-600">
            Consultez les retours de vos clients et répondez-y pour améliorer votre réputation
          </p>
        </div>

        {/* Statistiques avec répartition */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Note moyenne */}
              <div>
                <h2 className="text-lg font-semibold text-[#2C3E50] mb-4">Note globale</h2>
                <div className="flex items-center gap-6">
                  <div className="text-6xl font-bold text-[#FF6B00]">
                    {calculerStats().moyenne.toFixed(1)}
                  </div>
                  <div>
                    {renderStars(Math.round(calculerStats().moyenne))}
                    <p className="text-sm text-gray-600 mt-1">
                      {calculerStats().total} avis au total
                    </p>
                  </div>
                </div>
              </div>

              {/* Répartition */}
              <div>
                <h2 className="text-lg font-semibold text-[#2C3E50] mb-4">Répartition des notes</h2>
                <div className="space-y-2">
                  {calculerRepartition().map(({ note, count, percentage }) => (
                    <div key={note} className="flex items-center gap-3">
                      <span className="text-sm text-gray-600 w-8">{note}★</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                        <div
                          className="bg-[#FF6B00] h-2.5 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600 w-12 text-right">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filtres et recherche */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid md:grid-cols-3 gap-4">
              {/* Filtre par note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filtrer par note
                </label>
                <select
                  value={filtreNote || ''}
                  onChange={(e) => setFiltreNote(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
                >
                  <option value="">Toutes les notes</option>
                  <option value="5">5 étoiles</option>
                  <option value="4">4 étoiles</option>
                  <option value="3">3 étoiles</option>
                  <option value="2">2 étoiles</option>
                  <option value="1">1 étoile</option>
                </select>
              </div>

              {/* Tri */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Trier par
                </label>
                <select
                  value={tri}
                  onChange={(e) => setTri(e.target.value as any)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
                >
                  <option value="recent">Plus récents</option>
                  <option value="ancien">Plus anciens</option>
                  <option value="note-haute">Note la plus élevée</option>
                  <option value="note-basse">Note la plus basse</option>
                </select>
              </div>

              {/* Recherche */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rechercher
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={recherche}
                    onChange={(e) => setRecherche(e.target.value)}
                    placeholder="Mot-clé dans les avis..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
                  />
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Compteur résultats */}
            {(filtreNote !== null || recherche.trim()) && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  {avisFiltres.length} résultat{avisFiltres.length !== 1 ? 's' : ''} trouvé{avisFiltres.length !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Liste des avis */}
        <div className="space-y-6">
          {avisFiltres.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                {avis.length === 0 ? 'Aucun avis pour le moment' : 'Aucun résultat'}
              </h3>
              <p className="text-gray-500">
                {avis.length === 0
                  ? 'Les avis de vos clients apparaîtront ici après la fin de leurs interventions.'
                  : 'Essayez de modifier vos filtres de recherche.'}
              </p>
            </div>
          ) : (
            avisFiltres.map((avisItem) => (
              <div key={avisItem.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6">
                {/* En-tête de l'avis */}
                <div className="flex items-start gap-4 mb-4">
                  {/* Avatar Artisan */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#2C3E50] to-[#1A3A5C] flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-semibold text-lg">AR</span>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-[#2C3E50]">Artisan</span>
                      <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Professionnel
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {renderStars(avisItem.note)}
                      <span className="text-sm text-gray-500">
                        • {formatDate(avisItem.dateCreation)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Points forts */}
                {avisItem.points_forts && avisItem.points_forts.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {avisItem.points_forts.map((point, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-3 py-1.5 rounded-full text-sm font-medium border border-green-200"
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
                        className="inline-flex items-center gap-1 bg-orange-50 text-orange-700 px-3 py-1.5 rounded-full text-sm font-medium border border-orange-200"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        {point}
                      </span>
                    ))}
                  </div>
                )}

                {/* Commentaire */}
                {avisItem.commentaire && (
                  <div className="bg-gray-50 border-l-4 border-gray-300 p-4 rounded-r-lg mb-4">
                    <p className="text-gray-700 leading-relaxed">
                      "{avisItem.commentaire}"
                    </p>
                  </div>
                )}

                {/* Photos */}
                {avisItem.photos && avisItem.photos.length > 0 && (
                  <div className="flex gap-3 mb-4 overflow-x-auto pb-2">
                    {avisItem.photos.map((photo, idx) => (
                      <img
                        key={idx}
                        src={photo}
                        alt={`Photo ${idx + 1}`}
                        className="h-28 w-28 object-cover rounded-lg border-2 border-gray-200 hover:border-[#FF6B00] transition-colors cursor-pointer flex-shrink-0"
                      />
                    ))}
                  </div>
                )}

                {/* Réponse artisan */}
                {avisItem.reponseArtisan && (
                  <div className="bg-blue-50 border-l-4 border-[#FF6B00] p-4 rounded-r-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-[#FF6B00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                      <span className="font-semibold text-[#2C3E50]">Réponse de l'artisan</span>
                      <span className="text-sm text-gray-500">
                        • {formatDate(avisItem.reponseArtisan.date)}
                      </span>
                    </div>
                    <p className="text-gray-700 leading-relaxed">
                      {avisItem.reponseArtisan.contenu}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
