'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getUserById } from '@/lib/firebase/user-service';
import { getArtisanById } from '@/lib/firebase/artisan-service';
import { getDemandesForArtisan, getDemandesPubliquesForArtisan, removeArtisanFromDemande } from '@/lib/firebase/demande-service';
import { getDevisByDemande } from '@/lib/firebase/devis-service';
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
  const [demandesPubliques, setDemandesPubliques] = useState<Demande[]>([]);
  const [sectionActive, setSectionActive] = useState<'mes_demandes' | 'demandes_publiques'>('mes_demandes');
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'toutes' | 'contrats' | 'devis_envoyes' | 'refusees' | 'terminees'>('toutes');
  const [filtreType, setFiltreType] = useState<'toutes' | 'directe' | 'publique'>('toutes');
  const [refusingDemandeId, setRefusingDemandeId] = useState<string | null>(null);
  const [photoMetadata, setPhotoMetadata] = useState<Map<string, string>>(new Map());
  const [demandesRefusStatut, setDemandesRefusStatut] = useState<Map<string, { definitif: boolean; revision: boolean }>>(new Map());
  const [demandesTermineesIds, setDemandesTermineesIds] = useState<Set<string>>(new Set());
  const [demandesAvecDevisPayeIds, setDemandesAvecDevisPayeIds] = useState<Set<string>>(new Set());
  const [devisMap, setDevisMap] = useState<Map<string, Devis[]>>(new Map());
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
      
      // Charger les demandes publiques qui matchent le profil de l'artisan
      const artisanData = await getArtisanById(authUser.uid);
      if (artisanData) {
        const demandesPubliquesData = await getDemandesPubliquesForArtisan({
          metiers: artisanData.metiers,
          location: artisanData.location
        });
        console.log('📢 Demandes publiques récupérées:', demandesPubliquesData.length);
        setDemandesPubliques(demandesPubliquesData);
      }
      
      // Charger les devis pour chaque demande
      const devisMapTemp = new Map<string, Devis[]>();
      const refusStatutMap = new Map<string, { definitif: boolean; revision: boolean }>();
      const demandesTermineesSet = new Set<string>();
      const demandesAvecDevisPayeSet = new Set<string>();
      
      for (const demande of demandesData) {
        try {
          const devisForDemande = await getDevisByDemande(demande.id);
          devisMapTemp.set(demande.id, devisForDemande);
        } catch (error) {
          console.error(`Erreur chargement devis pour demande ${demande.id}:`, error);
        }
        try {
          // Vérifier les devis refusés
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
          
          // Vérifier si la demande a un devis payé
          const devisPayeQuery = query(
            collection(db, 'devis'),
            where('demandeId', '==', demande.id),
            where('artisanId', '==', authUser.uid)
          );
          const devisPayeSnapshot = await getDocs(devisPayeQuery);
          
          devisPayeSnapshot.docs.forEach(doc => {
            const devis = doc.data() as Devis;
            // Statuts indiquant que le devis a été payé
            const statutsPaye = ['paye', 'en_cours', 'travaux_termines', 'termine_valide', 'termine_auto_valide', 'litige'];
            if (statutsPaye.includes(devis.statut)) {
              demandesAvecDevisPayeSet.add(demande.id);
            }
          });
          
          if (hasDefinitif || hasRevision) {
            refusStatutMap.set(demande.id, { definitif: hasDefinitif, revision: hasRevision });
          }
          
          // Vérifier si la demande a un devis terminé (travaux finis)
          if (demande.statut === 'attribuee' && demande.devisAccepteId) {
            const devisAccepteQuery = query(
              collection(db, 'devis'),
              where('demandeId', '==', demande.id),
              where('artisanId', '==', authUser.uid)
            );
            const devisAccepteSnapshot = await getDocs(devisAccepteQuery);
            
            devisAccepteSnapshot.docs.forEach(doc => {
              const devis = doc.data() as Devis;
              // Devis terminé = validé par client ou auto-validé
              if (devis.statut === 'termine_valide' || devis.statut === 'termine_auto_valide') {
                demandesTermineesSet.add(demande.id);
              }
            });
          }
        } catch (error) {
          console.error(`Erreur vérification statuts pour demande ${demande.id}:`, error);
        }
      }
      setDevisMap(devisMapTemp);
      setDemandesRefusStatut(refusStatutMap);
      setDemandesTermineesIds(demandesTermineesSet);
      setDemandesAvecDevisPayeIds(demandesAvecDevisPayeSet);
      
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

  // Fonctions pour organiser les demandes par sections
  
  /**
   * CONTRATS EN COURS
   * - Demandes avec devis payé (travaux en cours)
   * - Exclut les demandes terminées
   */
  function getDemandesContrats(demandes: Demande[]) {
    return demandes.filter(d => 
      demandesAvecDevisPayeIds.has(d.id) && !demandesTermineesIds.has(d.id)
    );
  }

  /**
   * DEVIS ENVOYÉS
   * - Demandes pour lesquelles l'artisan a envoyé des devis
   * - Pas encore payés (donc pas des contrats)
   * - Exclut refusées et terminées
   */
  function getDemandesDevisEnvoyes(demandes: Demande[]) {
    return demandes.filter(d => 
      d.devisRecus && d.devisRecus > 0 && 
      !demandesAvecDevisPayeIds.has(d.id) && 
      d.statut !== 'annulee' && 
      !demandesTermineesIds.has(d.id)
    );
  }

  /**
   * DEMANDES REFUSÉES
   * - Demandes que l'artisan a explicitement refusées
   */
  function getDemandesRefusees(demandes: Demande[]) {
    return demandes.filter(d => d.statut === 'annulee');
  }

  /**
   * DEMANDES TERMINÉES
   * - Travaux terminés et validés par le client
   */
  function getDemandesTerminees(demandes: Demande[]) {
    return demandes.filter(d => demandesTermineesIds.has(d.id));
  }

  // Utiliser la bonne liste selon la section active
  const demandesSource = sectionActive === 'mes_demandes' ? demandes : demandesPubliques;
  
  // Filtrer les demandes selon l'onglet sélectionné
  let demandesFiltrees = demandesSource;
  
  // Si un demandeId est spécifié dans l'URL, afficher uniquement cette demande
  if (highlightedDemandeId) {
    demandesFiltrees = demandesSource.filter(d => d.id === highlightedDemandeId);
  } else if (sectionActive === 'mes_demandes') {
    // Filtrage par onglet uniquement pour "Mes demandes"
    if (filter === 'contrats') {
      demandesFiltrees = getDemandesContrats(demandesSource);
    } else if (filter === 'devis_envoyes') {
      demandesFiltrees = getDemandesDevisEnvoyes(demandesSource);
    } else if (filter === 'refusees') {
      demandesFiltrees = getDemandesRefusees(demandesSource);
    } else if (filter === 'terminees') {
      demandesFiltrees = getDemandesTerminees(demandesSource);
    }
    // Sinon 'toutes' : afficher toutes les demandes (pas de filtre)
  }
  // Pour "Demandes publiques" : toujours afficher toutes

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
                    {demandesFiltrees.length} demande{demandesFiltrees.length > 1 ? 's' : ''} 
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

        {/* Sections principales - Mes demandes / Demandes publiées */}
        {!highlightedDemandeId && (
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setSectionActive('mes_demandes')}
              className={`flex-1 py-4 px-6 rounded-lg font-bold text-lg transition-all ${
                sectionActive === 'mes_demandes'
                  ? 'bg-[#FF6B00] text-white shadow-lg ring-4 ring-[#FF6B00] ring-opacity-30'
                  : 'bg-white text-gray-700 hover:bg-gray-50 shadow-md'
              }`}
            >
              <div className="flex items-center justify-center gap-3">
                <span className="text-2xl">📋</span>
                <div className="text-left">
                  <div>Mes demandes</div>
                  <div className={`text-sm font-normal ${
                    sectionActive === 'mes_demandes' ? 'text-white opacity-90' : 'text-gray-500'
                  }`}>{demandes.filter(d => d.statut !== 'expiree').length} demande{demandes.filter(d => d.statut !== 'expiree').length > 1 ? 's' : ''}</div>
                </div>
              </div>
            </button>
            
            <button
              onClick={() => setSectionActive('demandes_publiques')}
              className={`flex-1 py-4 px-6 rounded-lg font-bold text-lg transition-all ${
                sectionActive === 'demandes_publiques'
                  ? 'bg-purple-600 text-white shadow-lg ring-4 ring-purple-600 ring-opacity-30'
                  : 'bg-white text-gray-700 hover:bg-gray-50 shadow-md'
              }`}
            >
              <div className="flex items-center justify-center gap-3">
                <span className="text-2xl">📢</span>
                <div className="text-left">
                  <div>Demandes publiées</div>
                  <div className={`text-sm font-normal ${
                    sectionActive === 'demandes_publiques' ? 'text-white opacity-90' : 'text-gray-500'
                  }`}>{demandesPubliques.length} nouvelle{demandesPubliques.length > 1 ? 's' : ''} opportunité{demandesPubliques.length > 1 ? 's' : ''}</div>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Onglets de filtrage - Style client/demandes - Affichés seulement dans "Mes demandes" */}
        {!highlightedDemandeId && sectionActive === 'mes_demandes' && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <button
              onClick={() => setFilter('toutes')}
              className={`rounded-lg shadow-md p-4 text-left transition-all hover:shadow-lg ${
                filter === 'toutes' ? 'bg-[#FF6B00] text-white ring-4 ring-[#FF6B00] ring-opacity-50' : 'bg-white'
              }`}
            >
              <div className={`text-2xl font-bold ${
                filter === 'toutes' ? 'text-white' : 'text-[#FF6B00]'
              }`}>{demandes.filter(d => d.statut !== 'expiree').length}</div>
              <div className={`text-sm ${
                filter === 'toutes' ? 'text-white' : 'text-gray-600'
              }`}>Toutes</div>
            </button>
            
            <button
              onClick={() => setFilter('contrats')}
              className={`rounded-lg shadow-md p-4 text-left transition-all hover:shadow-lg ${
                filter === 'contrats' ? 'bg-green-600 text-white ring-4 ring-green-600 ring-opacity-50' : 'bg-white'
              }`}
            >
              <div className={`text-2xl font-bold ${
                filter === 'contrats' ? 'text-white' : 'text-green-600'
              }`}>{getDemandesContrats(demandes).length}</div>
              <div className={`text-sm ${
                filter === 'contrats' ? 'text-white' : 'text-gray-600'
              }`}>✅ Contrats</div>
            </button>
            
            <button
              onClick={() => setFilter('devis_envoyes')}
              className={`rounded-lg shadow-md p-4 text-left transition-all hover:shadow-lg ${
                filter === 'devis_envoyes' ? 'bg-blue-600 text-white ring-4 ring-blue-600 ring-opacity-50' : 'bg-white'
              }`}
            >
              <div className={`text-2xl font-bold ${
                filter === 'devis_envoyes' ? 'text-white' : 'text-blue-600'
              }`}>{getDemandesDevisEnvoyes(demandes).length}</div>
              <div className={`text-sm ${
                filter === 'devis_envoyes' ? 'text-white' : 'text-gray-600'
              }`}>📬 Devis envoyés</div>
            </button>
            
            <button
              onClick={() => setFilter('refusees')}
              className={`rounded-lg shadow-md p-4 text-left transition-all hover:shadow-lg ${
                filter === 'refusees' ? 'bg-red-600 text-white ring-4 ring-red-600 ring-opacity-50' : 'bg-white'
              }`}
            >
              <div className={`text-2xl font-bold ${
                filter === 'refusees' ? 'text-white' : 'text-red-600'
              }`}>{getDemandesRefusees(demandes).length}</div>
              <div className={`text-sm ${
                filter === 'refusees' ? 'text-white' : 'text-gray-600'
              }`}>❌ Refusées</div>
            </button>
            
            <button
              onClick={() => setFilter('terminees')}
              className={`rounded-lg shadow-md p-4 text-left transition-all hover:shadow-lg ${
                filter === 'terminees' ? 'bg-gray-700 text-white ring-4 ring-gray-700 ring-opacity-50' : 'bg-white'
              }`}
            >
              <div className={`text-2xl font-bold ${
                filter === 'terminees' ? 'text-white' : 'text-gray-700'
              }`}>{getDemandesTerminees(demandes).length}</div>
              <div className={`text-sm ${
                filter === 'terminees' ? 'text-white' : 'text-gray-600'
              }`}>🏁 Terminées</div>
            </button>
          </div>
        )}
        
        {/* Liste des demandes */}
        {demandesFiltrees.length === 0 ? (
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
            {demandesFiltrees.map((demande) => {
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
                    
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="text-xl font-bold text-gray-800">
                        {demande.categorie}
                      </h3>
                      
                      {/* Badge Type de demande - MASQUÉ */}
                      {/* {(() => {
                        const demandeType = demande.type || 'directe';
                        if (demandeType === 'publique') {
                          return (
                            <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                              📢 Demande publique
                            </span>
                          );
                        } else {
                          return (
                            <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                              🎯 Demande directe
                            </span>
                          );
                        }
                      })()} */}
                      
                      {/* Badge devis envoyés - Masqué si devis payé */}
                      {demande.devisRecus && demande.devisRecus > 0 && !demandesAvecDevisPayeIds.has(demande.id) && (
                        <button
                          onClick={() => router.push(`/artisan/devis?demandeId=${demande.id}`)}
                          className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold border-2 border-blue-300 hover:bg-blue-200 hover:border-blue-400 transition-all cursor-pointer"
                          title="Cliquez pour voir les devis de cette demande"
                        >
                          ✅ {demande.devisRecus} devis envoyé{demande.devisRecus > 1 ? 's' : ''}
                        </button>
                      )}
                      
                      {/* Badge Quota atteint - Demande fermée à 10 devis */}
                      {demande.statut === 'quota_atteint' && (
                        <span className="bg-orange-100 text-orange-800 px-3 py-1.5 rounded-full text-sm font-bold border-2 border-orange-300 flex items-center gap-1.5">
                          🔒 Quota atteint (10 devis max)
                        </span>
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
                              className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200 hover:border-[#FF6B00] transition-all shadow-sm"
                              style={{ backgroundColor: '#ffffff' }}
                            >
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={displayName}
                                className="block w-full h-full"
                              >
                                <img
                                  src={url}
                                  alt={displayName}
                                  className="w-full h-full object-contain"
                                  onLoad={(e) => {
                                    console.log('✅ Photo chargée:', displayName, url);
                                  }}
                                  onError={(e) => {
                                    console.error('❌ Erreur chargement photo:', displayName, url);
                                    // Afficher un placeholder si l'image ne charge pas
                                    const img = e.currentTarget;
                                    img.style.display = 'none';
                                    const container = img.parentElement?.parentElement;
                                    if (container && !container.querySelector('.photo-error')) {
                                      const errorDiv = document.createElement('div');
                                      errorDiv.className = 'photo-error absolute inset-0 flex flex-col items-center justify-center bg-gray-100';
                                      errorDiv.innerHTML = `
                                        <svg class="w-10 h-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                        </svg>
                                        <span class="text-xs text-gray-500 text-center px-2">${displayName}</span>
                                      `;
                                      container.appendChild(errorDiv);
                                    }
                                  }}
                                />
                              </a>
                              {/* Tooltip au hover avec le nom du fichier */}
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                                <p className="text-white text-xs truncate">{displayName}</p>
                              </div>
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
                    const hasDevisPaye = demandesAvecDevisPayeIds.has(demande.id);
                    
                    // Si devis payé : afficher message + bouton devis payé
                    if (hasDevisPaye) {
                      const devisForDemande = devisMap.get(demande.id) || [];
                      const statutsPaye = ['paye', 'en_cours', 'travaux_termines', 'termine_valide', 'termine_auto_valide', 'litige'];
                      const devisPaye = devisForDemande.find(d => statutsPaye.includes(d.statut));
                      
                      return (
                        <div className="flex-1 space-y-3">
                          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                              <svg className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div className="flex-1">
                                <p className="font-bold text-green-700 mb-1">✅ Devis accepté et payé - Contrat en cours</p>
                                <p className="text-sm text-green-600">
                                  Cette demande vous a été attribuée. Le client a signé et payé votre devis.
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <button
                              onClick={() => {
                                if (devisPaye?.id) {
                                  router.push(`/artisan/devis/${devisPaye.id}`);
                                } else {
                                  router.push(`/artisan/contrats?demandeId=${demande.id}`);
                                }
                              }}
                              className="flex-1 bg-[#FF6B00] text-white px-4 py-3 rounded-lg font-semibold hover:bg-[#E56100] transition"
                            >
                              📋 Voir devis payé
                            </button>
                            <button
                              onClick={() => router.push(`/messages?userId=${demande.clientId}`)}
                              className="px-6 py-3 border-2 border-[#2C3E50] text-[#2C3E50] rounded-lg font-semibold hover:bg-[#2C3E50] hover:text-white transition"
                            >
                              💬 Contacter client
                            </button>
                          </div>
                        </div>
                      );
                    }
                    
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
                            onClick={async () => {
                              // Tracker consultation pour demandes publiques
                              if (demande.type === 'publique' && authUser) {
                                const { markDemandeAsViewed } = await import('@/lib/firebase/demande-service');
                                markDemandeAsViewed(demande.id, authUser.uid).catch(error => {
                                  console.error('⚠️ Erreur tracking consultation:', error);
                                });
                              }
                              router.push(`/artisan/devis/nouveau?demandeId=${demande.id}`);
                            }}
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
                        {/* Masquer le bouton si demande déjà attribuée ou quota atteint */}
                        {demande.statut !== 'attribuee' && demande.statut !== 'quota_atteint' && (
                          <button
                            onClick={async () => {
                              // Tracker consultation pour demandes publiques
                              if (demande.type === 'publique' && authUser) {
                                const { markDemandeAsViewed } = await import('@/lib/firebase/demande-service');
                                markDemandeAsViewed(demande.id, authUser.uid).catch(error => {
                                  console.error('⚠️ Erreur tracking consultation:', error);
                                });
                              }
                              router.push(`/artisan/devis/nouveau?demandeId=${demande.id}`);
                            }}
                            className="flex-1 bg-[#FF6B00] text-white px-4 py-3 rounded-lg font-semibold hover:bg-[#E56100] transition"
                          >
                            📝 Envoyer un devis
                          </button>
                        )}
                        {demande.statut === 'attribuee' && (
                          <div className="flex-1 bg-gray-100 text-gray-600 px-4 py-3 rounded-lg font-semibold border-2 border-gray-300 text-center">
                            ✅ Demande déjà attribuée
                          </div>
                        )}
                        {demande.statut === 'quota_atteint' && (
                          <div className="flex-1 bg-orange-50 text-orange-700 px-4 py-3 rounded-lg font-semibold border-2 border-orange-300 text-center">
                            🔒 Quota atteint - Demande fermée
                          </div>
                        )}
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
