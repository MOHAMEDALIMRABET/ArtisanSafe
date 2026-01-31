'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getUserById } from '@/lib/firebase/user-service';
import { getDemandesForArtisan, removeArtisanFromDemande } from '@/lib/firebase/demande-service';
import { createNotification } from '@/lib/firebase/notification-service';
import { getFileMetadata } from '@/lib/firebase/storage-service';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { User, Demande } from '@/types/firestore';
import type { Devis } from '@/types/devis';

export default function ArtisanDemandesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightedDemandeId = searchParams?.get('demandeId');
  const { user: authUser, loading: authLoading } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'toutes' | 'nouvelles' | 'devis_envoyes' | 'refusees'>('toutes');
  const [refusingDemandeId, setRefusingDemandeId] = useState<string | null>(null);
  const [photoMetadata, setPhotoMetadata] = useState<Map<string, string>>(new Map());
  const [demandesRefusStatut, setDemandesRefusStatut] = useState<Map<string, { definitif: boolean; revision: boolean }>>(new Map());
  const [clientsInfo, setClientsInfo] = useState<Map<string, { nom: string; prenom: string }>>(new Map());
  const demandeRefs = useRef<{[key: string]: HTMLDivElement | null}>({});

  useEffect(() => {
    if (authLoading) return; // Attendre que l'auth soit chargée
    
    if (!authUser) {
      router.push('/connexion');
      return;
    }

    loadData();
  }, [authUser, authLoading, router]);

  // Scroller vers la demande mise en évidence
  useEffect(() => {
    if (highlightedDemandeId && !isLoading && demandeRefs.current[highlightedDemandeId]) {
      setTimeout(() => {
        demandeRefs.current[highlightedDemandeId]?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }, 300);
    }
  }, [highlightedDemandeId, isLoading]);

  async function loadData() {
    if (!authUser) return;

    try {
      const userData = await getUserById(authUser.uid);
      if (!userData || userData.role !== 'artisan') {
        router.push('/dashboard');
        return;
      }

      setUser(userData);

      // Charger les demandes pour cet artisan
      const demandesData = await getDemandesForArtisan(authUser.uid);
      console.log('📋 Demandes récupérées:', demandesData.map(d => ({
        id: d.id,
        titre: d.titre,
        photosUrls: d.photosUrls,
        photos: d.photos,
      })));
      setDemandes(demandesData);
      
      // Vérifier le statut de refus des devis pour chaque demande
      const refusStatutMap = new Map<string, { definitif: boolean; revision: boolean }>();
      for (const demande of demandesData) {
        try {
          const devisQuery = query(
            collection(db, 'devis'),
            where('demandeId', '==', demande.id),
            where('artisanId', '==', authUser.uid),
            where('statut', '==', 'refuse')
          );
          const devisSnapshot = await getDocs(devisQuery);
          
          let hasDefinitif = false;
          let hasRevision = false;
          
          devisSnapshot.docs.forEach(doc => {
            const devis = doc.data() as Devis;
            if (devis.typeRefus === 'definitif') hasDefinitif = true;
            if (devis.typeRefus === 'revision') hasRevision = true;
          });
          
          if (hasDefinitif || hasRevision) {
            refusStatutMap.set(demande.id, { definitif: hasDefinitif, revision: hasRevision });
          }
        } catch (error) {
          console.error(`Erreur vérification refus pour demande ${demande.id}:`, error);
        }
      }
      setDemandesRefusStatut(refusStatutMap);
      
      // Charger les métadonnées des photos (noms originaux)
      const metadata = new Map<string, string>();
      for (const demande of demandesData) {
        const photos = demande.photosUrls || demande.photos || [];
        for (const url of photos) {
          if (url && url.startsWith('http')) {
            const meta = await getFileMetadata(url);
            if (meta?.originalName) {
              metadata.set(url, meta.originalName);
            }
          }
        }
      }
      setPhotoMetadata(metadata);
      
      // Charger les informations des clients
      const clientsMap = new Map<string, { nom: string; prenom: string }>();
      const uniqueClientIds = [...new Set(demandesData.map(d => d.clientId))];
      for (const clientId of uniqueClientIds) {
        try {
          const clientData = await getUserById(clientId);
          if (clientData) {
            clientsMap.set(clientId, { 
              nom: clientData.nom || '',
              prenom: clientData.prenom || ''
            });
          }
        } catch (error) {
          console.error(`Erreur chargement client ${clientId}:`, error);
        }
      }
      setClientsInfo(clientsMap);
      
      setIsLoading(false);
    } catch (error) {
      console.error('Erreur chargement demandes:', error);
      setIsLoading(false);
    }
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

      // Mettre à jour l'état local (marquer comme annulée)
      setDemandes(prev => prev.map(d => 
        d.id === demandeId 
          ? { ...d, statut: 'annulee' as const, artisanRefuseId: user.uid, artisanRefuseNom: artisanRefusant?.raisonSociale || 'Artisan inconnu' }
          : d
      ));

      alert('✅ Demande refusée avec succès. Elle apparaîtra dans l\'onglet "Refusées".');
    } catch (error) {
      console.error('❌ Erreur refus demande:', error);
      alert('❌ Erreur lors du refus de la demande. Veuillez réessayer.');
    } finally {
      setRefusingDemandeId(null);
    }
  }

  const filteredDemandes = demandes.filter(demande => {
    // Si un demandeId est spécifié dans l'URL, afficher uniquement cette demande
    if (highlightedDemandeId) {
      return demande.id === highlightedDemandeId;
    }
    
    // Sinon, afficher toutes les demandes
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
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* En-tête */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[#2C3E50] mb-2">
                📬 Demandes Clients
              </h1>
              <p className="text-gray-600">
                {highlightedDemandeId ? (
                  'Détail de la demande'
                ) : (
                  <>
                    {filteredDemandes.length} demande{filteredDemandes.length > 1 ? 's' : ''} 
                    {filter !== 'toutes' && ` (${filter})`}
                  </>
                )}
              </p>
            </div>
            {highlightedDemandeId && (
              <button
                onClick={() => router.push('/artisan/demandes')}
                className="flex items-center gap-2 bg-[#FF6B00] text-white px-4 py-2 rounded-lg hover:bg-[#E56100]"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Retour à toutes les demandes
              </button>
            )}
          </div>
        </div>

        {/* En-tête simplifié - Masqué si on affiche une demande spécifique */}
        {!highlightedDemandeId && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-[#2C3E50]">
              📋 Mes demandes reçues ({demandes.length})
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Liste des demandes de travaux qui vous ont été envoyées
            </p>
          </div>
        )}

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
            {filteredDemandes.map((demande) => {
              return (
              <div 
                key={demande.id} 
                ref={(el) => { demandeRefs.current[demande.id] = el; }}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    {/* Informations du client */}
                    {(() => {
                      const client = clientsInfo.get(demande.clientId);
                      if (client) {
                        return (
                          <div className="mb-3 flex items-center gap-2 bg-[#F8F9FA] p-3 rounded-lg">
                            <div className="w-10 h-10 bg-[#2C3E50] text-white rounded-full flex items-center justify-center font-bold text-lg">
                              {client.prenom?.[0]?.toUpperCase() || 'C'}{client.nom?.[0]?.toUpperCase() || ''}
                            </div>
                            <div>
                              <p className="text-sm text-[#6C757D] font-medium">Demandeur</p>
                              <p className="font-semibold text-[#2C3E50]">
                                {client.prenom} {client.nom}
                              </p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-800">
                        {demande.categorie}
                      </h3>
                      {demande.devisRecus && demande.devisRecus > 0 && (
                        <button
                          onClick={() => router.push(`/artisan/devis?demandeId=${demande.id}`)}
                          className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold border-2 border-blue-300 hover:bg-blue-200 hover:border-blue-400 transition-all cursor-pointer"
                          title="Cliquez pour voir les devis de cette demande"
                        >
                          ✅ {demande.devisRecus} devis envoyé{demande.devisRecus > 1 ? 's' : ''}
                        </button>
                      )}
                      {(!demande.devisRecus || demande.devisRecus === 0) && demande.statut === 'publiee' && (
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
                          🆕 Nouvelle demande
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
                  const validPhotos = photosList.filter((url: string) => url && url.startsWith('http'));
                  
                  if (validPhotos.length === 0) return null;
                  
                  return (
                    <div className="mb-4">
                      <p className="text-sm font-semibold text-gray-700 mb-2">
                        📸 Photos du projet ({validPhotos.length})
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {validPhotos.map((url: string, idx: number) => {
                          // Récupérer le nom original depuis les métadonnées ou utiliser le nom technique
                          const originalName = photoMetadata.get(url);
                          const displayName = originalName || `Photo ${idx + 1}`;
                          
                          return (
                            <div
                              key={idx} 
                              className="relative cursor-pointer bg-white rounded-lg h-32 overflow-hidden border-2 border-gray-300 hover:border-[#FF6B00] transition shadow-sm"
                              onClick={() => window.open(url, '_blank')}
                              title={displayName}
                            >
                              <img 
                                src={url} 
                                alt={`Photo ${idx + 1}`}
                                className="w-full h-full object-cover"
                                style={{ backgroundColor: '#f3f4f6' }}
                                onError={(e) => {
                                  const img = e.target as HTMLImageElement;
                                  img.style.display = 'none';
                                  const parent = img.parentElement;
                                  if (parent) {
                                    parent.innerHTML = `
                                      <div class="flex flex-col items-center justify-center h-full bg-gradient-to-br from-orange-50 to-orange-100 p-4">
                                        <svg class="w-12 h-12 text-orange-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <p class="text-xs text-orange-600 font-semibold text-center">Photo ${idx + 1}</p>
                                        <p class="text-xs text-orange-500 mt-1">Cliquer pour ouvrir</p>
                                      </div>
                                    `;
                                    parent.onclick = () => window.open(url, '_blank');
                                  }
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Actions */}
                <div className="flex gap-3 mt-4 pt-4 border-t border-gray-200">
                  {demande.statut === 'publiee' && (() => {
                    const refusStatut = demandesRefusStatut.get(demande.id);
                    
                    // Si refus définitif : bloquer complètement
                    if (refusStatut?.definitif) {
                      return (
                        <div className="flex-1 space-y-3">
                          <div className="bg-gray-100 border-2 border-gray-300 p-4 rounded-lg">
                            <div className="flex items-start gap-3">
                              <svg className="w-6 h-6 text-gray-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                              <div className="flex-1">
                                <p className="font-bold text-gray-700 mb-1">⛔ Demande fermée - Refus définitif</p>
                                <p className="text-sm text-gray-600">
                                  Le client a refusé définitivement votre devis. Vous ne pouvez plus envoyer de proposition pour cette demande.
                                </p>
                              </div>
                            </div>
                          </div>
                          {demande.devisRecus && demande.devisRecus > 0 && (
                            <button
                              onClick={() => router.push(`/artisan/devis?demandeId=${demande.id}`)}
                              className="w-full bg-blue-50 text-blue-700 px-4 py-3 rounded-lg font-semibold border-2 border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition"
                            >
                              📋 Voir l'historique des devis ({demande.devisRecus})
                            </button>
                          )}
                        </div>
                      );
                    }
                    
                    // Si refus avec révision : permettre de créer une variante
                    if (refusStatut?.revision) {
                      return (
                        <>
                          <button
                            onClick={() => router.push(`/artisan/devis/nouveau?demandeId=${demande.id}`)}
                            className="flex-1 bg-orange-500 text-white px-4 py-3 rounded-lg font-semibold hover:bg-orange-600 transition"
                          >
                            🔄 Créer un devis révisé
                          </button>
                          <button
                            onClick={() => router.push(`/messages?userId=${demande.clientId}`)}
                            className="px-6 py-3 border-2 border-[#2C3E50] text-[#2C3E50] rounded-lg font-semibold hover:bg-[#2C3E50] hover:text-white transition"
                          >
                            💬 Contacter client
                          </button>
                          <div className="w-4"></div>
                          <button
                            onClick={() => handleRefuserDemande(demande.id)}
                            disabled={refusingDemandeId === demande.id}
                            className="px-6 py-3 border-2 border-red-300 text-red-700 rounded-lg font-semibold hover:bg-red-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {refusingDemandeId === demande.id ? '⏳ Refus...' : '❌ Refuser'}
                          </button>
                        </>
                      );
                    }
                    
                    // Sinon : affichage normal
                    return (
                      <>
                        <button
                          onClick={() => router.push(`/artisan/devis/nouveau?demandeId=${demande.id}`)}
                          className="flex-1 bg-[#FF6B00] text-white px-4 py-3 rounded-lg font-semibold hover:bg-[#E56100] transition"
                        >
                          📝 Envoyer un devis
                        </button>
                        <button
                          onClick={() => router.push(`/messages?userId=${demande.clientId}`)}
                          className="px-6 py-3 border-2 border-[#2C3E50] text-[#2C3E50] rounded-lg font-semibold hover:bg-[#2C3E50] hover:text-white transition"
                        >
                          💬 Contacter client
                        </button>
                        <div className="w-4"></div>
                        <button
                          onClick={() => handleRefuserDemande(demande.id)}
                          disabled={refusingDemandeId === demande.id}
                          className="px-6 py-3 border-2 border-red-300 text-red-700 rounded-lg font-semibold hover:bg-red-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {refusingDemandeId === demande.id ? '⏳ Refus...' : '❌ Refuser'}
                        </button>
                      </>
                    );
                  })()}
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
            );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
