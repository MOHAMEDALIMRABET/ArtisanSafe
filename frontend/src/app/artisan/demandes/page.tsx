'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authService } from '@/lib/auth-service';
import { getUserById } from '@/lib/firebase/user-service';
import { getDemandesForArtisan, removeArtisanFromDemande } from '@/lib/firebase/demande-service';
import { createNotification } from '@/lib/firebase/notification-service';
import { Logo } from '@/components/ui';
import type { User, Demande } from '@/types/firestore';

export default function ArtisanDemandesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'toutes' | 'nouvelles' | 'acceptees' | 'refusees'>('nouvelles');
  const [refusingDemandeId, setRefusingDemandeId] = useState<string | null>(null);

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

      // Charger les demandes pour cet artisan
      const demandesData = await getDemandesForArtisan(currentUser.uid);
      setDemandes(demandesData);
      setIsLoading(false);
    } catch (error) {
      console.error('Erreur chargement demandes:', error);
      setIsLoading(false);
    }
  }

  async function handleSignOut() {
    await authService.signOut();
    router.push('/');
  }

  async function handleRefuserDemande(demandeId: string) {
    if (!user) return;

    const confirmer = confirm(
      '❌ Êtes-vous sûr de vouloir refuser cette demande ?\n\n' +
      'Cette action est définitive. La demande disparaîtra de votre liste et le client sera notifié que vous n\'êtes pas disponible.'
    );

    if (!confirmer) return;

    setRefusingDemandeId(demandeId);

    try {
      // Récupérer la demande pour avoir le clientId
      const demande = demandes.find(d => d.id === demandeId);
      if (!demande) {
        throw new Error('Demande non trouvée');
      }

      // Récupérer les infos de l'artisan qui refuse
      const { getArtisanByUserId: getArtisan } = await import('@/lib/firebase/artisan-service');
      const artisanRefusant = await getArtisan(user.uid);

      // Retirer l'artisan de la liste des matches
      await removeArtisanFromDemande(demandeId, user.uid);

      // Toujours passer la demande en "annulée" quand l'artisan refuse
      // (car il n'y a qu'un seul artisan par demande)
      const { updateDemande } = await import('@/lib/firebase/demande-service');
      const { Timestamp } = await import('firebase/firestore');
      
      await updateDemande(demandeId, {
        statut: 'annulee',
        artisanRefuseId: user.uid,
        artisanRefuseNom: artisanRefusant?.raisonSociale || 'Artisan inconnu',
        dateRefus: Timestamp.now(),
      });
      console.log('✅ Demande passée en statut "annulée" avec infos artisan refusant:', {
        artisanId: user.uid,
        artisanNom: artisanRefusant?.raisonSociale,
      });

      // Notifier le client du refus
      await createNotification(demande.clientId, {
        type: 'demande_refusee',
        titre: 'Votre demande a été refusée',
        message: `L'artisan a décliné votre demande "${demande.categorie}" à ${demande.localisation?.ville || 'votre localisation'}. Vous pouvez relancer une recherche avec les mêmes critères.`,
        lien: `/client/demandes`,
      });

      console.log('✅ Notification envoyée au client');

      // Mettre à jour l'état local (retirer la demande de la liste)
      setDemandes(prev => prev.filter(d => d.id !== demandeId));

      alert('✅ Demande refusée avec succès. Elle a été retirée de votre liste.');
    } catch (error) {
      console.error('❌ Erreur refus demande:', error);
      alert('❌ Erreur lors du refus de la demande. Veuillez réessayer.');
    } finally {
      setRefusingDemandeId(null);
    }
  }

  const filteredDemandes = demandes.filter(demande => {
    if (filter === 'toutes') return true;
    if (filter === 'nouvelles') return demande.statut === 'publiee';
    if (filter === 'acceptees') return demande.statut === 'acceptee';
    if (filter === 'refusees') return demande.statut === 'refusee';
    return true;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B00] mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des demandes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      {/* Navigation */}
      <nav className="bg-white shadow-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Logo size="md" href="/artisan/dashboard" />
              <nav className="hidden md:flex items-center gap-4">
                <Link href="/artisan/dashboard" className="text-gray-600 hover:text-[#FF6B00] font-medium">
                  Dashboard
                </Link>
                <span className="text-[#FF6B00] font-bold">Demandes</span>
              </nav>
            </div>
            
            <button
              onClick={handleSignOut}
              className="text-gray-600 hover:text-gray-800 font-medium"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* En-tête */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[#2C3E50] mb-2">
                📬 Demandes Clients
              </h1>
              <p className="text-gray-600">
                {filteredDemandes.length} demande{filteredDemandes.length > 1 ? 's' : ''} 
                {filter !== 'toutes' && ` (${filter})`}
              </p>
            </div>
          </div>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('toutes')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'toutes'
                  ? 'bg-[#FF6B00] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Toutes ({demandes.length})
            </button>
            <button
              onClick={() => setFilter('nouvelles')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'nouvelles'
                  ? 'bg-[#FF6B00] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🆕 Nouvelles ({demandes.filter(d => d.statut === 'publiee').length})
            </button>
            <button
              onClick={() => setFilter('acceptees')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'acceptees'
                  ? 'bg-[#FF6B00] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ✅ Acceptées ({demandes.filter(d => d.statut === 'acceptee').length})
            </button>
            <button
              onClick={() => setFilter('refusees')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'refusees'
                  ? 'bg-[#FF6B00] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ❌ Refusées ({demandes.filter(d => d.statut === 'refusee').length})
            </button>
          </div>
        </div>

        {/* Liste des demandes */}
        {filteredDemandes.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <svg className="w-24 h-24 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 className="text-xl font-bold text-gray-700 mb-2">
              Aucune demande {filter !== 'toutes' && filter}
            </h3>
            <p className="text-gray-600">
              Les demandes des clients apparaîtront ici.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredDemandes.map((demande) => (
              <div key={demande.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-800">
                        {demande.categorie}
                      </h3>
                      {demande.statut === 'publiee' && (
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
                          🆕 Nouvelle
                        </span>
                      )}
                      {demande.urgence && (
                        <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-semibold">
                          🚨 Urgent
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 mb-1">
                      📍 {demande.localisation?.ville || 'Non spécifié'} ({demande.localisation?.codePostal || 'N/A'})
                    </p>
                    {demande.datesSouhaitees?.dates && demande.datesSouhaitees.dates.length > 0 && (
                      <div className="mb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-gray-600">
                            📅 Date souhaitée : {new Date(demande.datesSouhaitees.dates[0].toMillis()).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg inline-flex">
                          <span className="text-blue-600 font-semibold text-sm">🔄 Flexibilité :</span>
                          <span className="text-blue-700 font-bold text-sm">
                            {demande.datesSouhaitees.flexible && demande.datesSouhaitees.flexibiliteDays ? (
                              `±${demande.datesSouhaitees.flexibiliteDays} jour${demande.datesSouhaitees.flexibiliteDays > 1 ? 's' : ''}`
                            ) : (
                              'Aucune (date fixe)'
                            )}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="mt-3">
                      <p className="text-sm font-semibold text-gray-700 mb-1">📝 Description du projet :</p>
                      <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">
                        {demande.description}
                      </p>
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="text-sm text-gray-500 text-right">
                      {demande.dateCreation?.toDate().toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                </div>

                {/* Photos */}
                {(() => {
                  const photosList = demande.photosUrls || demande.photos || [];
                  // Filtrer uniquement les URLs valides (commence par http)
                  const validPhotos = photosList.filter((url: string) => url && url.startsWith('http'));
                  
                  if (validPhotos.length === 0) return null;
                  
                  return (
                    <div className="mb-4">
                      <p className="text-sm font-semibold text-gray-700 mb-2">
                        📸 Photos du projet ({validPhotos.length})
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {validPhotos.map((url: string, idx: number) => (
                          <div key={idx} className="relative group">
                            <img 
                              src={url} 
                              alt={`Photo ${idx + 1}`}
                              className="w-full h-32 object-cover rounded-lg border-2 border-gray-200 hover:border-[#FF6B00] transition cursor-pointer shadow-sm"
                              onClick={() => window.open(url, '_blank')}
                              onError={(e) => {
                                // Masquer l'image si elle ne charge pas
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition rounded-lg flex items-center justify-center">
                              <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                              </svg>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Actions */}
                <div className="flex gap-3 mt-4 pt-4 border-t border-gray-200">
                  {demande.statut === 'publiee' && (
                    <>
                      <button
                        onClick={() => router.push(`/demande/${demande.id}`)}
                        className="flex-1 bg-[#FF6B00] text-white px-4 py-3 rounded-lg font-semibold hover:bg-[#E56100] transition"
                      >
                        📝 Envoyer un devis
                      </button>
                      <button
                        onClick={() => handleRefuserDemande(demande.id)}
                        disabled={refusingDemandeId === demande.id}
                        className="px-6 py-3 border-2 border-red-300 text-red-700 rounded-lg font-semibold hover:bg-red-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {refusingDemandeId === demande.id ? '⏳ Refus...' : '❌ Refuser'}
                      </button>
                    </>
                  )}
                  {demande.statut !== 'publiee' && (
                    <button
                      onClick={() => router.push(`/demande/${demande.id}`)}
                      className="flex-1 bg-gray-200 text-gray-700 px-4 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
                    >
                      👁️ Voir les détails
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
