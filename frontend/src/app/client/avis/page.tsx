'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/lib/auth-service';
import { getUserById } from '@/lib/firebase/user-service';
import { 
  getAvisByClientId, 
  getContratsTerminesSansAvis,
  createAvis 
} from '@/lib/firebase/avis-service';
import { getArtisanById } from '@/lib/firebase/artisan-service';
import type { User, Avis } from '@/types/firestore';
import Link from 'next/link';

export default function AvisClientPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [avis, setAvis] = useState<Avis[]>([]);
  const [avisFiltres, setAvisFiltres] = useState<Avis[]>([]);
  const [contratsANotifier, setContratsANotifier] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'mes-avis' | 'donner-avis'>('mes-avis');
  
  // Filtres et tri pour "Mes avis"
  const [filtreNote, setFiltreNote] = useState<number | null>(null);
  const [tri, setTri] = useState<'recent' | 'ancien' | 'note-haute' | 'note-basse'>('recent');
  const [recherche, setRecherche] = useState('');
  
  // Formulaire nouvel avis
  const [contratSelectionne, setContratSelectionne] = useState<any | null>(null);
  const [note, setNote] = useState(0);
  const [noteHover, setNoteHover] = useState(0);
  const [commentaire, setCommentaire] = useState('');
  const [pointsForts, setPointsForts] = useState<string[]>([]);
  const [pointsAmelioration, setPointsAmelioration] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const pointsFortsOptions = [
    'Ponctuel',
    'Soigneux',
    'Rapide',
    'Professionnel',
    'À l\'écoute',
    'Prix correct',
    'Bon conseil',
    'Travail de qualité'
  ];

  const pointsAmeliorationOptions = [
    'Délais trop longs',
    'Communication insuffisante',
    'Propreté du chantier',
    'Prix élevé',
    'Manque de ponctualité'
  ];

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

      // Charger les contrats terminés sans avis
      const contratsData = await getContratsTerminesSansAvis(currentUser.uid);
      
      // Enrichir avec les données artisan
      const contratsEnrichis = await Promise.all(
        contratsData.map(async (contrat) => {
          const artisan = await getArtisanById(contrat.artisanId);
          return {
            ...contrat,
            artisan,
          };
        })
      );

      setContratsANotifier(contratsEnrichis);
      setIsLoading(false);
    } catch (error) {
      console.error('Erreur chargement données:', error);
      setIsLoading(false);
    }
  }

  async function handleSubmitAvis() {
    if (!user || !contratSelectionne) return;

    if (note === 0) {
      alert('⚠️ Veuillez sélectionner une note');
      return;
    }

    if (commentaire.trim().length < 10) {
      alert('⚠️ Le commentaire doit contenir au moins 10 caractères');
      return;
    }

    setSubmitting(true);
    try {
      await createAvis({
        contratId: contratSelectionne.id,
        artisanId: contratSelectionne.artisanId,
        clientId: user.uid,
        note,
        commentaire,
        points_forts: pointsForts,
        points_amelioration: pointsAmelioration,
      });

      alert('✅ Votre avis a été publié avec succès ! Merci pour votre retour.');
      
      // Réinitialiser le formulaire
      setContratSelectionne(null);
      setNote(0);
      setCommentaire('');
      setPointsForts([]);
      setPointsAmelioration([]);
      setActiveTab('mes-avis');
      
      // Recharger les données
      await loadData();
    } catch (error: any) {
      alert(`❌ Erreur : ${error.message}`);
    } finally {
      setSubmitting(false);
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

  function renderStars(noteValue: number, interactive: boolean = false) {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`w-8 h-8 ${
              star <= (interactive ? (noteHover || note) : noteValue)
                ? 'text-yellow-400 fill-current'
                : 'text-gray-300'
            } ${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`}
            viewBox="0 0 24 24"
            onClick={() => interactive && setNote(star)}
            onMouseEnter={() => interactive && setNoteHover(star)}
            onMouseLeave={() => interactive && setNoteHover(0)}
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        ))}
      </div>
    );
  }

  function togglePointFort(point: string) {
    setPointsForts(prev =>
      prev.includes(point) ? prev.filter(p => p !== point) : [...prev, point]
    );
  }

  function togglePointAmelioration(point: string) {
    setPointsAmelioration(prev =>
      prev.includes(point) ? prev.filter(p => p !== point) : [...prev, point]
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
            href="/dashboard"
            className="inline-flex items-center gap-2 text-[#FF6B00] hover:underline mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Retour au tableau de bord
          </Link>

          <h1 className="text-3xl font-bold text-[#2C3E50]">Avis Artisans</h1>
          <p className="text-gray-600 mt-2">
            Consultez vos avis et notez les artisans avec qui vous avez travaillé.
          </p>
        </div>

        {/* Onglets */}
        <div className="flex gap-4 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('mes-avis')}
            className={`px-4 py-3 font-medium border-b-2 transition ${
              activeTab === 'mes-avis'
                ? 'border-[#FF6B00] text-[#FF6B00]'
                : 'border-transparent text-gray-600 hover:text-[#FF6B00]'
            }`}
          >
            Mes avis ({avis.length})
          </button>
          <button
            onClick={() => setActiveTab('donner-avis')}
            className={`px-4 py-3 font-medium border-b-2 transition ${
              activeTab === 'donner-avis'
                ? 'border-[#FF6B00] text-[#FF6B00]'
                : 'border-transparent text-gray-600 hover:text-[#FF6B00]'
            }`}
          >
            Donner un avis ({contratsANotifier.length})
          </button>
        </div>

        {/* Contenu onglet Mes avis */}
        {activeTab === 'mes-avis' && (
          <>
            {/* Statistiques avec répartition */}
            {avis.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Note moyenne */}
                  <div>
                    <h2 className="text-lg font-semibold text-[#2C3E50] mb-4">Vos notes données</h2>
                    <div className="flex items-center gap-6">
                      <div className="text-6xl font-bold text-[#FF6B00]">
                        {calculerStats().moyenne.toFixed(1)}
                      </div>
                      <div>
                        {renderStars(Math.round(calculerStats().moyenne))}
                        <p className="text-sm text-gray-600 mt-1">
                          Note moyenne sur {calculerStats().total} avis
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
            )}

            {/* Filtres et recherche */}
            {avis.length > 0 && (
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
            )}

            {/* Liste des avis */}
            <div className="space-y-6">
              {avisFiltres.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-12 text-center">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">
                    {avis.length === 0 ? 'Aucun avis pour le moment' : 'Aucun résultat'}
                  </h3>
                  <p className="text-gray-500">
                    {avis.length === 0
                      ? 'Vous n\'avez pas encore laissé d\'avis. Consultez l\'onglet "Donner un avis" pour noter vos artisans.'
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
          </>
        )}

        {/* Contenu onglet Donner un avis */}
        {activeTab === 'donner-avis' && (
          <div>
            {!contratSelectionne ? (
              // Liste des contrats à noter
              <div className="space-y-4">
                {contratsANotifier.length === 0 ? (
                  <div className="bg-white rounded-lg shadow-md p-12 text-center">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">
                      Tous vos avis sont à jour !
                    </h3>
                    <p className="text-gray-500">
                      Vous avez laissé un avis pour toutes vos interventions terminées.
                    </p>
                  </div>
                ) : (
                  contratsANotifier.map((contrat) => (
                    <div
                      key={contrat.id}
                      className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-[#2C3E50] mb-2">
                            {contrat.artisan?.businessName || 'Artisan'}
                          </h3>
                          <p className="text-gray-600 mb-1">
                            Intervention terminée le {formatDate(contrat.dateFin)}
                          </p>
                          <p className="text-sm text-gray-500">
                            Contrat #{contrat.id.slice(0, 8)}
                          </p>
                        </div>
                        <button
                          onClick={() => setContratSelectionne(contrat)}
                          className="bg-[#FF6B00] text-white px-6 py-2 rounded-lg hover:bg-[#E56100] font-medium"
                        >
                          Laisser un avis
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              // Formulaire d'avis
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="mb-6">
                  <button
                    onClick={() => setContratSelectionne(null)}
                    className="text-[#FF6B00] hover:underline flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Retour
                  </button>
                  <h2 className="text-2xl font-bold text-[#2C3E50] mt-4">
                    Notez {contratSelectionne.artisan?.businessName}
                  </h2>
                </div>

                {/* Note */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Note globale <span className="text-red-500">*</span>
                  </label>
                  {renderStars(note, true)}
                  {note > 0 && (
                    <p className="text-sm text-gray-600 mt-2">
                      {note === 5 && '⭐ Excellent !'}
                      {note === 4 && '👍 Très bien'}
                      {note === 3 && '👌 Bien'}
                      {note === 2 && '😐 Moyen'}
                      {note === 1 && '👎 Mauvais'}
                    </p>
                  )}
                </div>

                {/* Points forts */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Points forts (optionnel)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {pointsFortsOptions.map((point) => (
                      <button
                        key={point}
                        onClick={() => togglePointFort(point)}
                        className={`px-4 py-2 rounded-full border-2 transition ${
                          pointsForts.includes(point)
                            ? 'bg-green-100 border-green-500 text-green-700'
                            : 'bg-white border-gray-300 text-gray-700 hover:border-green-500'
                        }`}
                      >
                        {point}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Points d'amélioration */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Points d'amélioration (optionnel)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {pointsAmeliorationOptions.map((point) => (
                      <button
                        key={point}
                        onClick={() => togglePointAmelioration(point)}
                        className={`px-4 py-2 rounded-full border-2 transition ${
                          pointsAmelioration.includes(point)
                            ? 'bg-orange-100 border-orange-500 text-orange-700'
                            : 'bg-white border-gray-300 text-gray-700 hover:border-orange-500'
                        }`}
                      >
                        {point}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Commentaire */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Votre commentaire <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={commentaire}
                    onChange={(e) => setCommentaire(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                    rows={6}
                    placeholder="Décrivez votre expérience avec cet artisan (minimum 10 caractères)..."
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    {commentaire.length} caractères (minimum 10)
                  </p>
                </div>

                {/* Boutons */}
                <div className="flex gap-4">
                  <button
                    onClick={handleSubmitAvis}
                    disabled={submitting || note === 0 || commentaire.trim().length < 10}
                    className="flex-1 bg-[#FF6B00] text-white px-6 py-3 rounded-lg hover:bg-[#E56100] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Publication...' : 'Publier mon avis'}
                  </button>
                  <button
                    onClick={() => setContratSelectionne(null)}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
