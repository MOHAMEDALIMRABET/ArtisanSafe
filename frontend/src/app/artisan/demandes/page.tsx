'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { getUserById } from '@/lib/firebase/user-service';
import { getArtisanById } from '@/lib/firebase/artisan-service';
import { getDemandesForArtisan, getDemandesPubliquesForArtisan, removeArtisanFromDemande } from '@/lib/firebase/demande-service';
import { getDevisByDemande, declarerDebutTravaux, declarerFinTravaux } from '@/lib/firebase/devis-service';
import { createNotification } from '@/lib/firebase/notification-service';
import { getFileMetadata } from '@/lib/firebase/storage-service';
import { isDemandeExpired } from '@/lib/dateExpirationUtils';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { User, Demande } from '@/types/firestore';
import type { Devis } from '@/types/devis';

export default function ArtisanDemandesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightedDemandeId = searchParams?.get('demandeId');
  const { user: authUser, loading: authLoading } = useAuth();
  const { t, language } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [demandesPubliques, setDemandesPubliques] = useState<Demande[]>([]);
  const [sectionActive, setSectionActive] = useState<'mes_demandes' | 'demandes_publiques'>('mes_demandes');
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'toutes' | 'nouvelles' | 'en_traitement' | 'traitees'>('toutes');
  const [filtreType, setFiltreType] = useState<'toutes' | 'directe' | 'publique'>('toutes');
  const [sousFiltreTraitees, setSousFiltreTraitees] = useState<'tout' | 'payees' | 'refusees' | 'expirees' | 'travaux_en_cours' | 'termines'>('tout');
  const [refusingDemandeId, setRefusingDemandeId] = useState<string | null>(null);
  const [photoMetadata, setPhotoMetadata] = useState<Map<string, string>>(new Map());
  const [demandesRefusStatut, setDemandesRefusStatut] = useState<Map<string, { definitif: boolean; revision: boolean }>>(new Map());
  const [demandesTermineesIds, setDemandesTermineesIds] = useState<Set<string>>(new Set());
  const [demandesAvecDevisPayeIds, setDemandesAvecDevisPayeIds] = useState<Set<string>>(new Set());
  const [devisMap, setDevisMap] = useState<Map<string, Devis[]>>(new Map());
  const [clientsInfo, setClientsInfo] = useState<Map<string, { nom: string; prenom: string }>>(new Map());
  const [expandedDemandeIds, setExpandedDemandeIds] = useState<Set<string>>(new Set());
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

  // Réinitialiser le sous-filtre quand on quitte la section "Traitées"
  useEffect(() => {
    if (filter !== 'traitees') {
      setSousFiltreTraitees('tout');
    }
  }, [filter]);

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
      if (artisanData && artisanData.zonesIntervention && artisanData.zonesIntervention.length > 0) {
        const demandesPubliquesData = await getDemandesPubliquesForArtisan({
          metiers: artisanData.metiers,
          location: { 
            city: artisanData.zonesIntervention[0].ville,
            coordinates: artisanData.zonesIntervention[0].latitude && artisanData.zonesIntervention[0].longitude
              ? { 
                  latitude: artisanData.zonesIntervention[0].latitude, 
                  longitude: artisanData.zonesIntervention[0].longitude 
                }
              : undefined
          }
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

  function toggleExpandDemande(demandeId: string) {
    setExpandedDemandeIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(demandeId)) {
        newSet.delete(demandeId);
      } else {
        newSet.add(demandeId);
      }
      return newSet;
    });
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

  async function handleCommencerTravaux(devisId: string, numeroDevis: string) {
    if (!user) return;

    const confirmation = confirm(
      `🚧 Démarrage des travaux\n\n` +
      `Devis : ${numeroDevis}\n\n` +
      `Confirmez-vous que vous avez commencé les travaux ?\n\n` +
      `Cette action changera le statut du devis en "Travaux en cours".`
    );

    if (!confirmation) return;

    try {
      await declarerDebutTravaux(devisId, user.uid);
      alert('✅ Travaux démarrés avec succès !');
      await loadData(); // Recharger les données
    } catch (error: any) {
      console.error('❌ Erreur démarrage travaux:', error);
      alert(`❌ Erreur : ${error.message || 'Impossible de démarrer les travaux'}`);
    }
  }

  async function handleFinTravaux(devisId: string, numeroDevis: string) {
    if (!user) return;

    const confirmation = confirm(
      `🏁 Fin des travaux\n\n` +
      `Devis : ${numeroDevis}\n\n` +
      `Confirmez-vous que vous avez terminé les travaux ?\n\n` +
      `Le client recevra une notification et aura 7 jours pour valider.`
    );

    if (!confirmation) return;

    try {
      await declarerFinTravaux(devisId, user.uid);
      alert('✅ Fin des travaux déclarée avec succès ! Le client a été notifié.');
      await loadData(); // Recharger les données
    } catch (error: any) {
      console.error('❌ Erreur fin travaux:', error);
      alert(`❌ Erreur : ${error.message || 'Impossible de déclarer la fin des travaux'}`);
    }
  }

  // Fonctions pour organiser les demandes par sections
  
  /**
   * CONTRATS EN COURS
   * - Demandes avec devis payé (travaux en cours)
   * - Exclut les demandes terminées
   */
  /**
   * 📬 NOUVELLES DEMANDES
   * - Demandes où l'artisan n'a PAS encore envoyé de devis
   * - Exclut refusées et terminées
   */
  function getDemandesNouvelles(demandes: Demande[]) {
    return demandes.filter(d => 
      (!d.devisRecus || d.devisRecus === 0) && 
      d.statut !== 'annulee' && 
      !demandesTermineesIds.has(d.id)
    );
  }

  /**
   * ⏳ EN TRAITEMENT
   * - Demandes pour lesquelles l'artisan a envoyé des devis
   * - Pas encore payés (donc pas des contrats)
   * - Exclut refusées et terminées
   */
  function getDemandesEnTraitement(demandes: Demande[]) {
    return demandes.filter(d => 
      d.devisRecus && d.devisRecus > 0 && 
      !demandesAvecDevisPayeIds.has(d.id) && 
      d.statut !== 'annulee' && 
      !demandesTermineesIds.has(d.id)
    );
  }

  /**
   * Helper : Toutes les demandes traitées (sans sous-filtre)
   * Utilisé pour le compteur du bouton "✅ Traitées"
   */
  function getToutesDemandesTraitees(demandes: Demande[]) {
    return demandes.filter(d =>
      demandesAvecDevisPayeIds.has(d.id) ||
      d.statut === 'annulee' ||
      demandesTermineesIds.has(d.id) ||
      d.statut === 'expiree' ||
      (d.dateExpiration && isDemandeExpired(d.dateExpiration))
    );
  }

  /**
   * ✅ TRAITÉES (avec sous-filtrage)
   * - Payées (devis signé, travaux pas encore démarrés)
   * - Travaux en cours
   * - Travaux terminés (validés)
   * - Refusées par l'artisan
   * - Expirées
   */
  function getDemandesTraitees(demandes: Demande[]) {
    const demandesTraitees = getToutesDemandesTraitees(demandes);

    if (filter === 'traitees' && sousFiltreTraitees !== 'tout') {
      return demandesTraitees.filter(d => {
        const devisForDemande = devisMap.get(d.id) || [];
        const devisPaye = devisForDemande.find(dv =>
          ['paye', 'en_cours', 'travaux_termines', 'termine_valide', 'termine_auto_valide'].includes(dv.statut)
        );
        switch (sousFiltreTraitees) {
          case 'payees':
            return devisPaye?.statut === 'paye';
          case 'travaux_en_cours':
            return devisPaye?.statut === 'en_cours';
          case 'termines':
            return devisPaye && ['travaux_termines', 'termine_valide', 'termine_auto_valide'].includes(devisPaye.statut);
          case 'refusees':
            return d.statut === 'annulee' && !devisPaye;
          case 'expirees':
            return (d.statut === 'expiree' || (d.dateExpiration && isDemandeExpired(d.dateExpiration))) && !devisPaye;
          default:
            return true;
        }
      });
    }

    return demandesTraitees;
  }

  /**
   * Fonction pour déterminer la couleur de la bordure gauche
   */
  const getBorderColor = (demande: Demande): string => {
    const devisForDemande = devisMap.get(demande.id) || [];
    const devisPaye = devisForDemande.find(d => 
      ['paye', 'en_cours', 'travaux_termines', 'termine_valide', 'termine_auto_valide'].includes(d.statut)
    );
    
    // Section "📬 Nouvelles demandes" → Orange
    if (filter === 'nouvelles') {
      return 'bg-gradient-to-b from-[#FF6B00] to-[#E56100]';
    }
    
    // Section "⏳ En traitement" → Bleu
    if (filter === 'en_traitement') {
      return 'bg-gradient-to-b from-blue-400 to-blue-600';
    }
    
    // Section "✅ Traitées" → couleur selon statut
    if (filter === 'traitees') {
      // Travaux en cours → Jaune
      if (devisPaye?.statut === 'en_cours') {
        return 'bg-gradient-to-b from-yellow-400 to-yellow-600';
      }
      // Terminés (validés) → Gris foncé
      if (devisPaye && ['travaux_termines', 'termine_valide', 'termine_auto_valide'].includes(devisPaye.statut)) {
        return 'bg-gradient-to-b from-gray-700 to-gray-900';
      }
      // Devis payé (signé) → Vert
      if (devisPaye?.statut === 'paye') {
        return 'bg-gradient-to-b from-green-400 to-green-600';
      }
      // Refusées → Rouge
      if (demande.statut === 'annulee') {
        return 'bg-gradient-to-b from-red-400 to-red-600';
      }
      // Expirées → Rouge rayé
      if (demande.statut === 'expiree' || (demande.dateExpiration && isDemandeExpired(demande.dateExpiration))) {
        return 'bg-[repeating-linear-gradient(45deg,#f87171,#f87171_10px,#dc2626_10px,#dc2626_20px)]';
      }
    }
    
    // Fallback (section "Toutes") - Orange par défaut
    return 'bg-gradient-to-b from-[#FF6B00] to-[#E56100]';
  };

  // Utiliser la bonne liste selon la section active
  const demandesSource = sectionActive === 'mes_demandes' ? demandes : demandesPubliques;
  
  // Filtrer les demandes selon l'onglet sélectionné
  let demandesFiltrees = demandesSource;
  
  // Si un demandeId est spécifié dans l'URL, afficher uniquement cette demande
  if (highlightedDemandeId) {
    demandesFiltrees = demandesSource.filter(d => d.id === highlightedDemandeId);
  } else if (sectionActive === 'mes_demandes') {
    // Filtrage par onglet uniquement pour "Mes demandes"
    if (filter === 'nouvelles') {
      demandesFiltrees = getDemandesNouvelles(demandesSource);
    } else if (filter === 'en_traitement') {
      demandesFiltrees = getDemandesEnTraitement(demandesSource);
    } else if (filter === 'traitees') {
      demandesFiltrees = getDemandesTraitees(demandesSource);
    }
    // Sinon 'toutes' : afficher toutes les demandes (pas de filtre)
  }
  // Pour "Demandes publiques" : toujours afficher toutes

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B00] mx-auto mb-4"></div>
          <p className="text-gray-600">{t('artisanRequests.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* En-tête */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[#2C3E50] mb-2">
                📬 {t('artisanRequests.pageTitle')}
              </h1>
              <p className="text-gray-600">
                {highlightedDemandeId ? (
                  t('artisanRequests.detailTitle')
                ) : (
                  <>
                    {t('artisanRequests.requestCount').replace('{count}', demandesFiltrees.length.toString()).replace('{s}', demandesFiltrees.length > 1 ? 's' : '')} 
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
                {t('artisanRequests.backToAll')}
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
                  <div>{t('artisanRequests.tabs.myRequests')}</div>
                  <div className={`text-sm font-normal ${
                    sectionActive === 'mes_demandes' ? 'text-white opacity-90' : 'text-gray-500'
                  }`}>{t('artisanRequests.tabs.myRequestsCount').replace('{count}', demandes.filter(d => d.statut !== 'expiree').length.toString()).replace('{s}', demandes.filter(d => d.statut !== 'expiree').length > 1 ? 's' : '')}</div>
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
                  <div>{t('artisanRequests.tabs.publicRequests')}</div>
                  <div className={`text-sm font-normal ${
                    sectionActive === 'demandes_publiques' ? 'text-white opacity-90' : 'text-gray-500'
                  }`}>{t('artisanRequests.tabs.publicCountFull').replace('{count}', demandesPubliques.length.toString()).replace('{s}', demandesPubliques.length > 1 ? 's' : '').replace('{ies}', demandesPubliques.length > 1 ? 'ies' : 'y')}</div>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Onglets de filtrage - Affichés seulement dans "Mes demandes" */}
        {!highlightedDemandeId && sectionActive === 'mes_demandes' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {/* Toutes */}
              <button
                onClick={() => setFilter('toutes')}
                className={`group rounded-xl p-5 text-center transition-all duration-300 transform hover:-translate-y-1 ${
                  filter === 'toutes'
                    ? 'bg-gradient-to-br from-[#FF6B00] to-[#E56100] text-white shadow-xl scale-105'
                    : 'bg-white hover:bg-gray-50 shadow-md hover:shadow-lg border border-gray-100'
                }`}
              >
                <div className={`text-3xl font-black mb-1 ${filter === 'toutes' ? 'text-white' : 'text-[#FF6B00]'}`}>
                  {demandes.length}
                </div>
                <div className={`text-xs font-semibold uppercase tracking-wide ${filter === 'toutes' ? 'text-white' : 'text-gray-600'}`}>
                  {t('artisanRequests.filters.all')}
                </div>
              </button>

              {/* Nouvelles */}
              <button
                onClick={() => setFilter('nouvelles')}
                className={`group rounded-xl p-5 text-center transition-all duration-300 transform hover:-translate-y-1 ${
                  filter === 'nouvelles'
                    ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-xl scale-105'
                    : 'bg-white hover:bg-gray-50 shadow-md hover:shadow-lg border border-gray-100'
                }`}
              >
                <div className={`text-3xl font-black mb-1 ${filter === 'nouvelles' ? 'text-white' : 'text-orange-500'}`}>
                  {getDemandesNouvelles(demandes).length}
                </div>
                <div className={`text-xs font-semibold uppercase tracking-wide ${filter === 'nouvelles' ? 'text-white' : 'text-gray-600'}`}>
                  📬 {t('artisanRequests.filters.new')}
                </div>
              </button>

              {/* En traitement */}
              <button
                onClick={() => setFilter('en_traitement')}
                className={`group rounded-xl p-5 text-center transition-all duration-300 transform hover:-translate-y-1 ${
                  filter === 'en_traitement'
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-xl scale-105'
                    : 'bg-white hover:bg-gray-50 shadow-md hover:shadow-lg border border-gray-100'
                }`}
              >
                <div className={`text-3xl font-black mb-1 ${filter === 'en_traitement' ? 'text-white' : 'text-blue-600'}`}>
                  {getDemandesEnTraitement(demandes).length}
                </div>
                <div className={`text-xs font-semibold uppercase tracking-wide ${filter === 'en_traitement' ? 'text-white' : 'text-gray-600'}`}>
                  ⏳ En traitement
                </div>
              </button>

              {/* Traitées */}
              <button
                onClick={() => setFilter('traitees')}
                className={`group rounded-xl p-5 text-center transition-all duration-300 transform hover:-translate-y-1 ${
                  filter === 'traitees'
                    ? 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-xl scale-105'
                    : 'bg-white hover:bg-gray-50 shadow-md hover:shadow-lg border border-gray-100'
                }`}
              >
                <div className={`text-3xl font-black mb-1 ${filter === 'traitees' ? 'text-white' : 'text-green-600'}`}>
                  {getToutesDemandesTraitees(demandes).length}
                </div>
                <div className={`text-xs font-semibold uppercase tracking-wide ${filter === 'traitees' ? 'text-white' : 'text-gray-600'}`}>
                  ✅ Traitées
                </div>
              </button>
            </div>

            {/* Sous-filtres pour la section "Traitées" */}
            {filter === 'traitees' && (
              <div className="flex flex-wrap gap-2 mb-6 bg-white rounded-xl shadow-sm p-3 border border-gray-100">
                {([
                  { key: 'tout', label: '🔍 Tout', count: getToutesDemandesTraitees(demandes).length },
                  { key: 'payees', label: '💰 Payées', count: getToutesDemandesTraitees(demandes).filter(d => devisMap.get(d.id)?.some(v => v.statut === 'paye')).length },
                  { key: 'travaux_en_cours', label: '🚧 Travaux en cours', count: getToutesDemandesTraitees(demandes).filter(d => devisMap.get(d.id)?.some(v => v.statut === 'en_cours')).length },
                  { key: 'termines', label: '✅ Terminés', count: getToutesDemandesTraitees(demandes).filter(d => devisMap.get(d.id)?.some(v => ['travaux_termines', 'termine_valide', 'termine_auto_valide'].includes(v.statut))).length },
                  { key: 'refusees', label: '❌ Refusées', count: getToutesDemandesTraitees(demandes).filter(d => d.statut === 'annulee' && !devisMap.get(d.id)?.some(v => ['paye', 'en_cours', 'travaux_termines', 'termine_valide', 'termine_auto_valide'].includes(v.statut))).length },
                  { key: 'expirees', label: '⏰ Expirées', count: getToutesDemandesTraitees(demandes).filter(d => (d.statut === 'expiree' || (d.dateExpiration && isDemandeExpired(d.dateExpiration))) && !devisMap.get(d.id)?.some(v => ['paye', 'en_cours', 'travaux_termines', 'termine_valide', 'termine_auto_valide'].includes(v.statut))).length },
                ] as { key: string; label: string; count: number }[]).map(({ key, label, count }) => (
                  <button
                    key={key}
                    onClick={() => setSousFiltreTraitees(key as typeof sousFiltreTraitees)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      sousFiltreTraitees === key
                        ? 'bg-green-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {label} <span className="opacity-75">({count})</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        
        {/* Liste des demandes */}
        {demandesFiltrees.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <svg className="w-24 h-24 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 className="text-xl font-bold text-gray-700 mb-2">
              {t('artisanRequests.empty.noRequests')}
            </h3>
            <p className="text-gray-600">
              {t('artisanRequests.empty.description')}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {demandesFiltrees.map((demande) => {
              const isExpanded = expandedDemandeIds.has(demande.id);
              return (
              <div 
                key={demande.id} 
                ref={(el) => { demandeRefs.current[demande.id] = el; }}
                onClick={() => toggleExpandDemande(demande.id)}
                className={`bg-white rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 cursor-pointer relative border-2 overflow-hidden group ${
                  isExpanded ? 'border-[#FF6B00] ring-1 ring-[#FF6B00] ring-opacity-30' : 'border-transparent hover:border-gray-200'
                }`}
              >
                {/* Barre latérale colorée selon section et statut */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${getBorderColor(demande)}`} />
                
                <div className="p-6 pl-8">{/* Bouton expand/collapse en haut à droite */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpandDemande(demande.id);
                  }}
                  className="absolute top-5 right-5 p-2.5 rounded-xl hover:bg-gray-100 transition-all duration-200 group"
                  title={isExpanded ? t('artisanRequests.card.hideDetails') : t('artisanRequests.card.viewDetails')}
                >
                  <svg 
                    className={`w-5 h-5 text-gray-400 group-hover:text-[#FF6B00] transition-all duration-200 ${
                      isExpanded ? 'rotate-180' : ''
                    }`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Informations demandeur (toujours visible en haut) */}
                {(() => {
                  const client = clientsInfo.get(demande.clientId);
                  if (client) {
                    return (
                      <div className="mb-4 bg-[#F5F7FA] p-4 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-3">
                          <p className="text-sm font-bold text-gray-700">{t('artisanRequests.card.requester')}</p>
                          <div className="w-8 h-8 bg-[#2C3E50] text-white rounded-full flex items-center justify-center font-bold text-sm">
                            {client.prenom?.[0]?.toUpperCase() || 'C'}{client.nom?.[0]?.toUpperCase() || ''}
                          </div>
                          <p className="font-semibold text-[#2C3E50]">
                            {client.prenom} {client.nom}
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Titre principal + Dates + Badge statut */}
                <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-200 pr-12">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-[#2C3E50] mb-2">
                      {demande.titre}
                    </h2>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <span className="text-[#FF6B00]">🏷️</span>
                        <span className="font-semibold">{t('artisanRequests.card.category')}</span>
                        <span>{demande.categorie}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-red-500">📅</span>
                        <span>{t('artisanRequests.card.createdOn')} {demande.dateCreation?.toDate().toLocaleDateString(language === 'en' ? 'en-US' : 'fr-FR')}</span>
                      </div>
                      {demande.datesSouhaitees?.dates && demande.datesSouhaitees.dates.length > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="text-red-500">📅</span>
                          <span>{t('artisanRequests.card.desiredStart')} {new Date(demande.datesSouhaitees.dates[0].toMillis()).toLocaleDateString(language === 'en' ? 'en-US' : 'fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                        </div>
                      )}
                      {(() => {
                        const devisForDemande = devisMap.get(demande.id) || [];
                        const statutsPaye = ['paye', 'en_cours', 'travaux_termines', 'termine_valide', 'termine_auto_valide', 'litige'];
                        const devisPaye = devisForDemande.find(d => statutsPaye.includes(d.statut));
                        if (devisPaye?.delaiRealisation) {
                          return (
                            <div className="flex items-center gap-1">
                              <span className="text-green-600">⏱️</span>
                              <span className="font-semibold">{t('artisanRequests.card.deadline')}</span>
                              <span>{devisPaye.delaiRealisation} {t('artisanRequests.card.days')}</span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                  
                  {/* Badge statut principal */}
                  <div className="flex flex-col items-end gap-2">
                    {demandesAvecDevisPayeIds.has(demande.id) && (
                      <span className="bg-green-100 text-green-700 px-4 py-2 rounded-lg text-sm font-bold border-2 border-green-300">
                        ✅ {t('artisanRequests.status.quoteSigned')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Description (toujours visible, retour à la ligne pour texte long) */}
                <div className="mb-4">
                  <p className="text-sm font-bold text-gray-700 mb-2">{t('artisanRequests.card.description')}</p>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
                    {demande.description}
                  </p>
                </div>

                {/* Détails complets (seulement si expanded) */}
                {isExpanded && (
                <>
                  {/* Photos jointes */}
                  {(() => {
                  const photosList = demande.photosUrls || demande.photos || [];
                  const validPhotos = photosList.filter((url: string) => url && url.startsWith('http'));
                  
                  if (validPhotos.length === 0) return null;
                  
                  return (
                    <div className="mb-4">
                      <p className="text-sm font-semibold text-gray-700 mb-2">
                        📸 {t('artisanRequests.card.projectPhotos').replace('{count}', validPhotos.length.toString())}
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {validPhotos.map((url: string, idx: number) => {
                          // Récupérer le nom original depuis les métadonnées ou utiliser le nom technique
                          const originalName = photoMetadata.get(url);
                          const displayName = originalName || `${t('artisanRequests.card.photo')} ${idx + 1}`;
                          
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

                  {/* Localisation et Dates souhaitées côte à côte */}
                  <div className="mb-6 grid md:grid-cols-2 gap-4">
                    {/* Localisation */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <p className="text-sm font-bold text-[#2C3E50] mb-3 flex items-center gap-2">
                        <span>📍</span>
                        {t('artisanRequests.card.location')}
                      </p>
                      <div className="space-y-1">
                        <p className="text-[#2C3E50]">
                          <span className="font-semibold">{t('artisanRequests.card.city')}</span> {demande.localisation?.ville || t('common.notSpecified')}
                        </p>
                        <p className="text-[#2C3E50]">
                          <span className="font-semibold">{t('artisanRequests.card.postalCode')}</span> {demande.localisation?.codePostal || 'N/A'}
                        </p>
                      </div>
                    </div>

                    {/* Dates souhaitées */}
                    {demande.datesSouhaitees?.dates && demande.datesSouhaitees.dates.length > 0 && (
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <p className="text-sm font-bold text-green-900 mb-3 flex items-center gap-2">
                          <span>📅</span>
                          {t('artisanRequests.card.desiredDate')}
                        </p>
                        <p className="text-green-800">
                          {new Date(demande.datesSouhaitees.dates[0].toMillis()).toLocaleDateString(language === 'en' ? 'en-US' : 'fr-FR', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </p>
                        {demande.datesSouhaitees.flexible && (
                          <span className="inline-block mt-2 bg-green-200 text-green-800 px-2 py-1 rounded text-xs font-semibold">
                            {t('artisanRequests.card.flexible')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                {/* Badge Demande urgente */}
                {demande.urgence && (
                  <div className="mb-6 bg-red-50 p-4 rounded-lg border-2 border-red-300">
                    <p className="text-red-700 font-bold flex items-center gap-2">
                      <span>🚨</span>
                      {t('artisanRequests.card.urgent')}
                    </p>
                  </div>
                )}
                </>
                )}

                {/* Message vert + Boutons pour devis payé (TOUJOURS VISIBLES) */}
                {demandesAvecDevisPayeIds.has(demande.id) && (() => {
                  const devisForDemande = devisMap.get(demande.id) || [];
                  const statutsPaye = ['paye', 'en_cours', 'travaux_termines', 'termine_valide', 'termine_auto_valide', 'litige'];
                  const devisPaye = devisForDemande.find(d => statutsPaye.includes(d.statut));
                  
                  return (
                    <div className="mt-4">
                      <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <svg className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="flex-1">
                            <p className="font-bold text-green-700 mb-1">✅ {t('artisanRequests.status.quoteAcceptedPaid')}</p>
                            <p className="text-sm text-green-600">
                              {t('artisanRequests.status.assignedToYou')}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-3 mt-3">
                        {/* Bouton "Commencer travaux" si statut = 'paye' */}
                        {devisPaye?.statut === 'paye' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (devisPaye?.id && devisPaye?.numeroDevis) {
                                handleCommencerTravaux(devisPaye.id, devisPaye.numeroDevis);
                              }
                            }}
                            className="flex-1 bg-green-600 text-white hover:bg-green-700 rounded-lg px-4 py-2.5 font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
                          >
                            🚧 {t('artisanRequests.actions.startWork')}
                          </button>
                        )}

                        {/* Bouton "Fin des travaux" si statut = 'en_cours' */}
                        {devisPaye?.statut === 'en_cours' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (devisPaye?.id && devisPaye?.numeroDevis) {
                                handleFinTravaux(devisPaye.id, devisPaye.numeroDevis);
                              }
                            }}
                            className="flex-1 bg-[#FF6B00] text-white hover:bg-[#E56100] rounded-lg px-4 py-2.5 font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
                          >
                            🏁 {t('artisanRequests.actions.finishWork')}
                          </button>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (devisPaye?.id) {
                              router.push(`/artisan/devis/${devisPaye.id}`);
                            } else {
                              router.push(`/artisan/contrats?demandeId=${demande.id}`);
                            }
                          }}
                          className="flex-1 bg-[#FF6B00] text-white hover:bg-[#E56100] rounded-lg px-4 py-2.5 font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
                        >
                          📋 {t('artisanRequests.actions.viewPaidQuote')}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/messages?userId=${demande.clientId}`);
                          }}
                          className="px-4 py-2.5 border-2 border-[#2C3E50] text-[#2C3E50] hover:bg-[#2C3E50] hover:text-white rounded-lg font-medium transition-all duration-200 flex items-center gap-2"
                        >
                          💬 {t('artisanRequests.actions.contactClient')}
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Boutons d'action normaux (TOUJOURS VISIBLES) */}
                {!demandesAvecDevisPayeIds.has(demande.id) && demande.statut !== 'annulee' && !demandesTermineesIds.has(demande.id) && (() => {
                  const refusStatut = demandesRefusStatut.get(demande.id);
                  
                  // Si refus définitif : bloquer complètement
                  if (refusStatut?.definitif) {
                    return (
                      <div className="mt-4 space-y-3">
                        <div className="bg-gray-100 border-2 border-gray-300 p-4 rounded-lg">
                          <div className="flex items-start gap-3">
                            <svg className="w-6 h-6 text-gray-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                            <div className="flex-1">
                              <p className="font-bold text-gray-700 mb-1">⛔ {t('artisanRequests.status.requestClosed')}</p>
                              <p className="text-sm text-gray-600">
                                {t('artisanRequests.status.refusedDefinitive')}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  
                  // Si refus avec révision : permettre de créer une variante
                  if (refusStatut?.revision) {
                    return (
                      <div className="flex gap-3 mt-4">
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (demande.type === 'publique' && authUser) {
                              const { markDemandeAsViewed } = await import('@/lib/firebase/demande-service');
                              markDemandeAsViewed(demande.id, authUser.uid).catch(error => {
                                console.error('⚠️ Erreur tracking consultation:', error);
                              });
                            }
                            router.push(`/artisan/devis/nouveau?demandeId=${demande.id}`);
                          }}
                          className="flex-1 bg-orange-500 text-white hover:bg-orange-600 rounded-lg px-4 py-2.5 font-medium transition-all duration-200 shadow-sm hover:shadow-md"
                        >
                          🔄 {t('artisanRequests.actions.createRevisedQuote')}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/messages?userId=${demande.clientId}`);
                          }}
                          className="px-4 py-2.5 border-2 border-[#2C3E50] text-[#2C3E50] hover:bg-[#2C3E50] hover:text-white rounded-lg font-medium transition-all duration-200"
                        >
                          💬 {t('artisanRequests.actions.contactClient')}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRefuserDemande(demande.id);
                          }}
                          disabled={refusingDemandeId === demande.id}
                          className="px-4 py-2.5 border-2 border-red-300 text-red-700 hover:bg-red-50 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {refusingDemandeId === demande.id ? `⏳ ${t('artisanRequests.actions.refusing')}` : `❌ ${t('artisanRequests.actions.refuse')}`}
                        </button>
                      </div>
                    );
                  }
                  
                  // Affichage normal
                  return (
                    <div className="flex gap-3 mt-4">
                      {(demande.statut as string) !== 'attribuee' && (demande.statut as string) !== 'quota_atteint' && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (demande.type === 'publique' && authUser) {
                              const { markDemandeAsViewed } = await import('@/lib/firebase/demande-service');
                              markDemandeAsViewed(demande.id, authUser.uid).catch(error => {
                                console.error('⚠️ Erreur tracking consultation:', error);
                              });
                            }
                            router.push(`/artisan/devis/nouveau?demandeId=${demande.id}`);
                          }}
                          className="flex-1 bg-[#FF6B00] text-white hover:bg-[#E56100] rounded-lg px-4 py-2.5 font-medium transition-all duration-200 shadow-sm hover:shadow-md"
                        >
                          📝 {t('artisanRequests.actions.sendQuote')}
                        </button>
                      )}
                      {(demande.statut as string) === 'attribuee' && (
                        <div className="flex-1 bg-gray-100 text-gray-600 px-4 py-2.5 rounded-lg font-medium border-2 border-gray-300 text-center">
                          ✅ {t('artisanRequests.status.alreadyAssigned')}
                        </div>
                      )}
                      {(demande.statut as string) === 'quota_atteint' && (
                        <div className="flex-1 bg-orange-50 text-orange-700 px-4 py-2.5 rounded-lg font-medium border-2 border-orange-300 text-center">
                          🔒 {t('artisanRequests.status.quotaReached')}
                        </div>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/messages?userId=${demande.clientId}`);
                        }}
                        className="px-4 py-2.5 border-2 border-[#2C3E50] text-[#2C3E50] hover:bg-[#2C3E50] hover:text-white rounded-lg font-medium transition-all duration-200"
                      >
                        💬 {t('artisanRequests.actions.contactClient')}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRefuserDemande(demande.id);
                        }}
                        disabled={refusingDemandeId === demande.id}
                        className="px-4 py-2.5 border-2 border-red-300 text-red-700 hover:bg-red-50 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {refusingDemandeId === demande.id ? `⏳ ${t('artisanRequests.actions.refusing')}` : `❌ ${t('artisanRequests.actions.refuse')}`}
                      </button>
                    </div>
                  );
                })()}
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
