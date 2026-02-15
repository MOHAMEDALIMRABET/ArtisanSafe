'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getDemandesByClient, deleteDemande } from '@/lib/firebase/demande-service';
import { getArtisansByIds } from '@/lib/firebase/artisan-service';
import { getDevisByDemande } from '@/lib/firebase/devis-service';
import { createNotification } from '@/lib/firebase/notification-service';
import { getFileMetadata } from '@/lib/firebase/storage-service';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { Demande, Artisan } from '@/types/firestore';
import type { Devis } from '@/types/devis';

export default function MesDemandesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [artisansMap, setArtisansMap] = useState<Map<string, Artisan>>(new Map());
  const [devisMap, setDevisMap] = useState<Map<string, Devis[]>>(new Map());
  const [demandesAvecDevisPayeIds, setDemandesAvecDevisPayeIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showAnnulees, setShowAnnulees] = useState(false);
  const [filtreStatut, setFiltreStatut] = useState<'toutes' | 'publiee' | 'annulee' | 'genere'>('toutes');
  const [filtreDateTravaux, setFiltreDateTravaux] = useState<string>('');
  const [filtreType, setFiltreType] = useState<'toutes' | 'directe' | 'publique'>('toutes');
  const [filtreSection, setFiltreSection] = useState<'toutes' | 'contrats' | 'devis_recus' | 'en_attente' | 'publiees' | 'refusees' | 'terminees'>('toutes');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [expandedDemandeIds, setExpandedDemandeIds] = useState<Set<string>>(new Set());
  const [photoMetadata, setPhotoMetadata] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    // Attendre que l'auth soit chargée
    if (authLoading) {
      console.log('⏳ Auth en cours de chargement...');
      return;
    }

    if (!user) {
      console.log('❌ Utilisateur non connecté, redirection vers /connexion');
      router.push('/connexion');
      return;
    }

    console.log('✅ Utilisateur connecté:', user.uid);
    
    // Afficher le message de succès si présent dans l'URL
    const success = searchParams.get('success');
    const demandeId = searchParams.get('demandeId');
    if (success === 'demande_publiee' && demandeId) {
      setSuccessMessage('✅ Votre demande a été publiée ! Les artisans qualifiés de votre région peuvent maintenant la consulter et vous envoyer des devis.');
      setFiltreSection('publiees'); // Basculer automatiquement sur l'onglet "Demandes publiées"
      
      // Masquer le message après 8 secondes
      setTimeout(() => {
        setSuccessMessage(null);
        // Nettoyer l'URL
        router.replace('/client/demandes');
      }, 8000);
    }
    
    loadDemandes();
  }, [user, authLoading, router, searchParams]);

  async function loadDemandes() {
    if (!user) return;

    try {
      const userDemandes = await getDemandesByClient(user.uid);
      setDemandes(userDemandes);

      // Charger les métadonnées des photos (nom original)
      const metadata = new Map<string, string>();
      for (const demande of userDemandes) {
        const photos = demande.photosUrls || demande.photos || [];
        for (const url of photos) {
          if (url && url.startsWith('http')) {
            try {
              const meta = await getFileMetadata(url);
              if (meta?.originalName) {
                metadata.set(url, meta.originalName);
              }
            } catch (error) {
              console.error('Erreur récupération métadonnées photo:', error);
            }
          }
        }
      }
      setPhotoMetadata(metadata);

      // Récupérer tous les artisans matchés
      const allArtisanIds = new Set<string>();
      userDemandes.forEach(demande => {
        demande.artisansMatches?.forEach(id => allArtisanIds.add(id));
      });

      if (allArtisanIds.size > 0) {
        console.log('🔍 IDs artisans à récupérer:', Array.from(allArtisanIds));
        const artisans = await getArtisansByIds(Array.from(allArtisanIds));
        console.log('👷 Artisans récupérés:', artisans.map(a => ({ userId: a.userId, raisonSociale: a.raisonSociale })));
        const map = new Map(artisans.map(a => [a.userId, a]));
        setArtisansMap(map);
      }

      // Charger les devis pour chaque demande et détecter les devis payés
      const devisMapTemp = new Map<string, Devis[]>();
      const demandesAvecDevisPayeSet = new Set<string>();
      
      for (const demande of userDemandes) {
        try {
          const devisForDemande = await getDevisByDemande(demande.id);
          devisMapTemp.set(demande.id, devisForDemande);
          
          // Vérifier si un devis est payé
          const statutsPaye = ['paye', 'en_cours', 'travaux_termines', 'termine_valide', 'termine_auto_valide', 'litige'];
          const hasDevisPaye = devisForDemande.some(devis => statutsPaye.includes(devis.statut));
          
          if (hasDevisPaye) {
            demandesAvecDevisPayeSet.add(demande.id);
          }
        } catch (error) {
          console.error(`Erreur chargement devis pour demande ${demande.id}:`, error);
        }
      }
      setDevisMap(devisMapTemp);
      setDemandesAvecDevisPayeIds(demandesAvecDevisPayeSet);
    } catch (error) {
      console.error('Erreur chargement demandes:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDemanderRevision(demandeId: string, artisanId: string, artisanNom: string) {
    const message = prompt(
      'Pourquoi souhaitez-vous une révision du devis ?\n\nExemples: "Prix trop élevé", "Délai trop long", "Besoin de modifications"'
    );

    if (!message) return;

    try {
      const clientNom = user?.displayName || user?.email || 'Un client';
      
      await createNotification(artisanId, {
        type: 'nouvelle_demande',
        titre: '🔄 Demande de révision de devis',
        message: `${clientNom} souhaite une révision du devis. Motif : ${message}`,
        lien: `/artisan/devis/nouveau?demandeId=${demandeId}`,
      });

      alert(`✅ Demande envoyée à ${artisanNom}.\n\nL'artisan sera notifié et pourra vous envoyer un devis révisé.`);
    } catch (error) {
      console.error('Erreur envoi demande révision:', error);
      alert('❌ Erreur lors de l\'envoi. Veuillez réessayer.');
    }
  }

  async function handleDeleteDemande(demandeId: string, titre: string) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer la demande "${titre}" ?\n\nCette action est irréversible.`)) {
      return;
    }

    try {
      await deleteDemande(demandeId);
      // Recharger la liste après suppression
      setDemandes(demandes.filter(d => d.id !== demandeId));
      alert('✅ Demande supprimée avec succès');
    } catch (error) {
      console.error('Erreur suppression demande:', error);
      alert('❌ Erreur lors de la suppression. Veuillez réessayer.');
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

  function getStatutBadge(demande: Demande) {
    // Logique intelligente selon le type de demande
    const hasArtisan = demande.artisansMatches && demande.artisansMatches.length > 0;
    const demandeType = demande.type || 'directe';
    const statut = demande.statut;
    const devisForDemande = devisMap.get(demande.id) || [];
    
    // 🔥 PRIORITÉ 1 : CONTRAT EN COURS (devis payé/signé)
    // → Badge "Contrat" ou badge spécifique selon statut du devis
    if (demandesAvecDevisPayeIds.has(demande.id)) {
      const devisPaye = devisForDemande.find(d => 
        ['paye', 'en_cours', 'travaux_termines', 'termine_valide', 'termine_auto_valide', 'litige'].includes(d.statut)
      );
      
      if (devisPaye) {
        // Badges spécifiques selon l'état du contrat
        if (devisPaye.statut === 'paye') {
          return (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border-2 border-green-400">
              ✅ Devis signé
            </span>
          );
        }
        if (devisPaye.statut === 'en_cours') {
          return (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border-2 border-blue-400">
              🚧 Travaux en cours
            </span>
          );
        }
        if (['travaux_termines', 'termine_valide', 'termine_auto_valide'].includes(devisPaye.statut)) {
          return (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-200 text-green-900 border-2 border-green-500">
              ✅ Travaux terminés
            </span>
          );
        }
        if (devisPaye.statut === 'litige') {
          return (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border-2 border-red-400">
              ⚠️ Litige
            </span>
          );
        }
        
        // Fallback : badge générique "Contrat"
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border-2 border-green-400">
            ✅ Contrat en cours
          </span>
        );
      }
    }
    
    // 🎯 PRIORITÉ 2 : DEVIS ACCEPTÉ (en attente de paiement)
    // → Badge "En attente de paiement"
    const devisAccepte = devisForDemande.find(d => d.statut === 'accepte');
    if (devisAccepte) {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border-2 border-yellow-400">
          💳 En attente de paiement
        </span>
      );
    }
    
    // ✅ DEMANDE DIRECTE (envoyée à un artisan spécifique)
    // → Badge "Envoyé à artisan" dès la création (artisan déjà assigné)
    if (demandeType === 'directe' && hasArtisan && (statut === 'publiee' || statut === 'matchee' || statut === 'genere')) {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border-2 border-orange-300">
          🎯 Envoyé à artisan
        </span>
      );
    }
    
    // ✅ DEMANDE PUBLIQUE publiée (pas encore de devis accepté)
    // → Badge "Publiée"
    if (demandeType === 'publique' && statut === 'publiee') {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
          📢 Publiée
        </span>
      );
    }
    
    // Badges statuts standards
    const badges = {
      brouillon: 'bg-gray-200 text-gray-800',
      publiee: 'bg-blue-100 text-blue-800',
      matchee: 'bg-green-100 text-green-800',
      attribuee: 'bg-green-100 text-green-800',
      en_cours: 'bg-yellow-100 text-yellow-800',
      terminee: 'bg-green-200 text-green-900',
      annulee: 'bg-red-100 text-red-800',
      quota_atteint: 'bg-orange-100 text-orange-800',
    };

    const labels = {
      brouillon: '📝 Brouillon',
      publiee: '📢 Publiée',
      matchee: '🤝 Artisan trouvé',
      attribuee: '✅ Attribuée',
      en_cours: '⏳ En cours',
      terminee: '✅ Terminée',
      annulee: '❌ Refusée',
      quota_atteint: '🔒 Quota atteint',
    };
    
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badges[statut as keyof typeof badges] || 'bg-gray-200 text-gray-800'}`}>
        {labels[statut as keyof typeof labels] || statut}
      </span>
    );
  }

  function getTypeBadge(type?: 'directe' | 'publique') {
    const demandeType = type || 'directe'; // Par défaut 'directe' pour compatibilité
    
    if (demandeType === 'publique') {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 flex items-center gap-1">
          📢 Demande publique
        </span>
      );
    } else {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 flex items-center gap-1">
          🎯 Demande directe
        </span>
      );
    }
  }

  // Fonctions pour organiser les demandes par sections
  
  /**
   * DEMANDES PUBLIÉES
   * - Définition : Demandes créées par le client et publiées PUBLIQUEMENT
   * - Caractéristiques :
   *   • Pas d'artisan spécifique assigné (artisansMatches vide ou absent)
   *   • Visibles par TOUS les artisans (dans leur espace "Demandes publiées")
   *   • Les artisans voient ces demandes SI elles matchent leurs critères (métier, localisation)
   *   • Pas encore de devis reçus
   * - Workflow : Client publie → Artisans découvrent → Artisan s'assigne → Devient "En attente"
   */
  function getDemandesPubliees(demandes: Demande[]) {
    return demandes.filter(d => {
      const hasArtisan = d.artisansMatches && d.artisansMatches.length > 0;
      const hasDevis = devisMap.get(d.id) && (devisMap.get(d.id)?.length || 0) > 0;
      const hasDevisPaye = demandesAvecDevisPayeIds.has(d.id);
      
      // Demande publiquée = AUCUN artisan assigné, AUCUN devis, statut normal
      return !hasArtisan && !hasDevis && !hasDevisPaye && 
             d.statut !== 'annulee' && d.statut !== 'terminee' && d.statut !== 'attribuee';
    });
  }

  /**
   * DEMANDES EN ATTENTE
   * - Définition : Demandes envoyées à un artisan SPÉCIFIQUE (demande directe)
   * - Caractéristiques :
   *   • Artisan spécifique assigné (artisansMatches contient 1 artisan)
   *   • Artisan n'a pas encore répondu (pas de devis)
   *   • Client attend la réponse de cet artisan
   * - Workflow : Client choisit artisan → Envoie demande directe → Attend devis
   */

  function getDemandesEnAttente(demandes: Demande[]) {
    return demandes.filter(d => {
      const hasArtisan = d.artisansMatches && d.artisansMatches.length > 0;
      const hasDevis = devisMap.get(d.id) && (devisMap.get(d.id)?.length || 0) > 0;
      const hasDevisPaye = demandesAvecDevisPayeIds.has(d.id);
      
      // En attente = artisan assigné + AUCUN devis encore + AUCUN contrat
      return hasArtisan && !hasDevis && !hasDevisPaye && 
             d.statut !== 'annulee' && d.statut !== 'terminee';
    });
  }

  /**
   * DEMANDES AVEC DEVIS REÇUS
   * - Définition : Demandes ayant reçu au moins 1 proposition de devis
   * - Caractéristiques :
   *   • Au moins 1 devis reçu (devisMap contient des devis)
   *   • Devis pas encore accepté/payé
   *   • Client doit décider : accepter ou refuser
   * - Workflow : Artisan envoie devis → Client reçoit → Client accepte → Devient "Contrat"
   */

  function getDemandesAvecDevis(demandes: Demande[]) {
    return demandes.filter(d => {
      const devis = devisMap.get(d.id) || [];
      const hasDevis = devis.length > 0;
      const hasDevisPaye = demandesAvecDevisPayeIds.has(d.id);
      
      // Devis reçus = devis présents + AUCUN payé + statut normal
      return hasDevis && !hasDevisPaye && 
             d.statut !== 'annulee' && d.statut !== 'terminee' && d.statut !== 'attribuee';
    });
  }

  /**
   * DEMANDES ATTRIBUÉES
   * - Définition : Demandes avec devis accepté MAIS pas encore payé
   * - Caractéristiques :
   *   • Client a accepté un devis (statut 'attribuee')
   *   • Artisan officiellement assigné au projet
   *   • En attente du paiement
   * - Workflow : Client accepte devis → Attribuée → Client paie → Devient "Contrat"
   */

  function getDemandesAttribuees(demandes: Demande[]) {
    return demandes.filter(d => d.statut === 'attribuee');
  }

  /**
   * CONTRATS EN COURS
   * - Définition : Demandes avec devis payés (phase travaux)
   * - Caractéristiques :
   *   • Devis accepté ET payé (détecté via statutsPaye)
   *   • Travaux en cours ou terminés
   *   • Contrat actif entre client et artisan
   * - Workflow : Client paie → Travaux commencent → Travaux terminés → Devient "Terminée"
   */
  function getDemandesContratsEnCours(demandes: Demande[]) {
    return demandes.filter(d => 
      demandesAvecDevisPayeIds.has(d.id) && d.statut !== 'terminee'
    );
  }

  /**
   * DEMANDES REFUSÉES
   * - Définition : Demandes refusées par l'artisan contacté
   * - Caractéristiques :
   *   • Statut 'annulee'
   *   • Artisan a refusé la demande
   *   • Client peut relancer une nouvelle recherche
   */

  function getDemandesRefusees(demandes: Demande[]) {
    return demandes.filter(d => d.statut === 'annulee');
  }

  /**
   * DEMANDES TERMINÉES
   * - Définition : Demandes avec travaux terminés et validés
   * - Caractéristiques :
   *   • Statut 'terminee'
   *   • Travaux complétés et acceptés par le client
   *   • Projet clos
   */
  function getDemandesTerminees(demandes: Demande[]) {
    return demandes.filter(d => d.statut === 'terminee');
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#FF6B00] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Titre de la page - Version moderne */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-extrabold text-[#2C3E50] tracking-tight">
                Mes demandes
              </h1>
              <p className="text-base text-[#6C757D] mt-2 font-medium">
                Suivez vos projets en temps réel
              </p>
            </div>
            
            <Button
              onClick={() => router.push('/recherche')}
              className="bg-[#FF6B00] hover:bg-[#E56100] text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nouvelle demande
            </Button>
          </div>
        </div>
      </div>

      {/* Message de succès */}
      {successMessage && (
        <div className="container mx-auto px-4 pt-6 max-w-6xl">
          <div className="bg-gradient-to-r from-green-50 to-green-100 border-l-4 border-green-500 p-5 rounded-lg shadow-lg flex items-start gap-4 animate-fade-in">
            <div className="flex-shrink-0 bg-green-500 rounded-full p-2">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-green-800 font-semibold text-base leading-relaxed">
                {successMessage}
              </p>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="flex-shrink-0 text-green-600 hover:text-green-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Contenu */}
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Onglets de filtrage - Design moderne */}
        <div className="grid grid-cols-2 md:grid-cols-7 gap-4 mb-8">
          <button
            onClick={() => setFiltreSection('toutes')}
            className={`group rounded-xl p-5 text-center transition-all duration-300 transform hover:-translate-y-1 ${
              filtreSection === 'toutes' 
                ? 'bg-gradient-to-br from-[#FF6B00] to-[#E56100] text-white shadow-xl scale-105' 
                : 'bg-white hover:bg-gray-50 shadow-md hover:shadow-lg border border-gray-100'
            }`}
          >
            <div className={`text-3xl font-black mb-1 ${
              filtreSection === 'toutes' ? 'text-white' : 'text-[#FF6B00]'
            }`}>{demandes.length}</div>
            <div className={`text-xs font-semibold uppercase tracking-wide ${
              filtreSection === 'toutes' ? 'text-white' : 'text-gray-600'
            }`}>Toutes</div>
          </button>
          
          <button
            onClick={() => setFiltreSection('contrats')}
            className={`group rounded-xl p-5 text-center transition-all duration-300 transform hover:-translate-y-1 ${
              filtreSection === 'contrats' 
                ? 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-xl scale-105' 
                : 'bg-white hover:bg-gray-50 shadow-md hover:shadow-lg border border-gray-100'
            }`}
          >
            <div className={`text-3xl font-black mb-1 ${
              filtreSection === 'contrats' ? 'text-white' : 'text-green-600'
            }`}>{getDemandesContratsEnCours(demandes).length}</div>
            <div className={`text-xs font-semibold uppercase tracking-wide ${
              filtreSection === 'contrats' ? 'text-white' : 'text-gray-600'
            }`}>✅ Contrats</div>
          </button>
          
          <button
            onClick={() => setFiltreSection('devis_recus')}
            className={`group rounded-xl p-5 text-center transition-all duration-300 transform hover:-translate-y-1 ${
              filtreSection === 'devis_recus' 
                ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-xl scale-105' 
                : 'bg-white hover:bg-gray-50 shadow-md hover:shadow-lg border border-gray-100'
            }`}
          >
            <div className={`text-3xl font-black mb-1 ${
              filtreSection === 'devis_recus' ? 'text-white' : 'text-blue-600'
            }`}>{getDemandesAvecDevis(demandes).length}</div>
            <div className={`text-xs font-semibold uppercase tracking-wide ${
              filtreSection === 'devis_recus' ? 'text-white' : 'text-gray-600'
            }`}>📬 Devis</div>
          </button>
          
          <button
            onClick={() => setFiltreSection('en_attente')}
            className={`group rounded-xl p-5 text-center transition-all duration-300 transform hover:-translate-y-1 ${
              filtreSection === 'en_attente' 
                ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-xl scale-105' 
                : 'bg-white hover:bg-gray-50 shadow-md hover:shadow-lg border border-gray-100'
            }`}
          >
            <div className={`text-3xl font-black mb-1 ${
              filtreSection === 'en_attente' ? 'text-white' : 'text-amber-500'
            }`}>{getDemandesEnAttente(demandes).length}</div>
            <div className={`text-xs font-semibold uppercase tracking-wide ${
              filtreSection === 'en_attente' ? 'text-white' : 'text-gray-600'
            }`}>📤 Attente</div>
          </button>
          
          <button
            onClick={() => setFiltreSection('publiees')}
            className={`group rounded-xl p-5 text-center transition-all duration-300 transform hover:-translate-y-1 ${
              filtreSection === 'publiees' 
                ? 'bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-xl scale-105' 
                : 'bg-white hover:bg-gray-50 shadow-md hover:shadow-lg border border-gray-100'
            }`}
          >
            <div className={`text-3xl font-black mb-1 ${
              filtreSection === 'publiees' ? 'text-white' : 'text-purple-600'
            }`}>{getDemandesPubliees(demandes).length}</div>
            <div className={`text-xs font-semibold uppercase tracking-wide ${
              filtreSection === 'publiees' ? 'text-white' : 'text-gray-600'
            }`}>📢 Publiées</div>
          </button>
          
          <button
            onClick={() => setFiltreSection('refusees')}
            className={`group rounded-xl p-5 text-center transition-all duration-300 transform hover:-translate-y-1 ${
              filtreSection === 'refusees' 
                ? 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-xl scale-105' 
                : 'bg-white hover:bg-gray-50 shadow-md hover:shadow-lg border border-gray-100'
            }`}
          >
            <div className={`text-3xl font-black mb-1 ${
              filtreSection === 'refusees' ? 'text-white' : 'text-red-600'
            }`}>{getDemandesRefusees(demandes).length}</div>
            <div className={`text-xs font-semibold uppercase tracking-wide ${
              filtreSection === 'refusees' ? 'text-white' : 'text-gray-600'
            }`}>❌ Refusées</div>
          </button>
          
          <button
            onClick={() => setFiltreSection('terminees')}
            className={`group rounded-xl p-5 text-center transition-all duration-300 transform hover:-translate-y-1 ${
              filtreSection === 'terminees' 
                ? 'bg-gradient-to-br from-gray-600 to-gray-700 text-white shadow-xl scale-105' 
                : 'bg-white hover:bg-gray-50 shadow-md hover:shadow-lg border border-gray-100'
            }`}
          >
            <div className={`text-3xl font-black mb-1 ${
              filtreSection === 'terminees' ? 'text-white' : 'text-gray-700'
            }`}>{getDemandesTerminees(demandes).length}</div>
            <div className={`text-xs font-semibold uppercase tracking-wide ${
              filtreSection === 'terminees' ? 'text-white' : 'text-gray-600'
            }`}>🏁 Terminées</div>
          </button>
        </div>

        {demandes.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-16 text-center border border-gray-100">
            <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-[#2C3E50] mb-3">
              Aucune demande pour le moment
            </h2>
            <p className="text-gray-500 mb-8 text-lg max-w-md mx-auto">
              Commencez par rechercher un artisan pour recevoir des devis personnalisés
            </p>
            <Button
              onClick={() => router.push('/recherche')}
              className="bg-gradient-to-r from-[#FF6B00] to-[#E56100] hover:from-[#E56100] hover:to-[#D55000] text-white px-8 py-4 rounded-xl font-semibold shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-0.5"
            >
              Rechercher un artisan
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {(() => {
              // Filtrer les demandes selon l'onglet sélectionné
              let demandesFiltrees = demandes;
              
              if (filtreSection === 'contrats') {
                demandesFiltrees = getDemandesContratsEnCours(demandes);
              } else if (filtreSection === 'devis_recus') {
                demandesFiltrees = getDemandesAvecDevis(demandes);
              } else if (filtreSection === 'en_attente') {
                demandesFiltrees = getDemandesEnAttente(demandes);
              } else if (filtreSection === 'publiees') {
                demandesFiltrees = getDemandesPubliees(demandes);
              } else if (filtreSection === 'refusees') {
                demandesFiltrees = getDemandesRefusees(demandes);
              } else if (filtreSection === 'terminees') {
                demandesFiltrees = getDemandesTerminees(demandes);
              }

              const renderDemande = (demande: Demande) => {
                const isExpanded = expandedDemandeIds.has(demande.id);
                
                return (
                  <div
                    key={demande.id}
                    onClick={() => toggleExpandDemande(demande.id)}
                    className={`bg-white rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 cursor-pointer relative border-2 overflow-hidden group ${
                      isExpanded ? 'border-[#FF6B00] ring-4 ring-[#FF6B00] ring-opacity-20' : 'border-transparent hover:border-gray-200'
                    }`}
                  >
                    {/* Barre latérale colorée selon statut */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                      demande.statut === 'terminee' ? 'bg-gradient-to-b from-green-400 to-green-600' :
                      demande.statut === 'annulee' ? 'bg-gradient-to-b from-red-400 to-red-600' :
                      demande.statut === 'publiee' ? 'bg-gradient-to-b from-purple-400 to-purple-600' :
                      'bg-gradient-to-b from-blue-400 to-blue-600'
                    }`} />
                    
                    <div className="p-6 pl-8">
                  {/* Bouton expandre/rétracter en haut à droite */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpandDemande(demande.id);
                    }}
                    className="absolute top-5 right-5 p-2.5 rounded-xl hover:bg-gray-100 transition-all duration-200 group"
                    title={isExpanded ? "Masquer les détails" : "Voir le détail"}
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

                  <div className="flex items-start justify-between mb-5 pb-5 border-b border-gray-100 pr-14">
                    <div className="flex-1">
                      {/* Nom de l'entreprise (artisan) avec badge style identique demandeur */}
                    {(() => {
                      if (demande.statut === 'annulee' && demande.artisanRefuseNom) {
                        const initiales = demande.artisanRefuseNom
                          .split(' ')
                          .slice(0, 2)
                          .map(word => word[0]?.toUpperCase() || '')
                          .join('');
                        return (
                          <div className="mb-5 bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Artisan</span>
                              <div className="w-10 h-10 bg-gradient-to-br from-[#2C3E50] to-[#1A3A5C] text-white rounded-full flex items-center justify-center font-bold text-sm shadow-md">
                                {initiales || 'A'}
                              </div>
                              <p className="font-bold text-[#2C3E50] text-lg">
                                {demande.artisanRefuseNom}
                              </p>
                            </div>
                          </div>
                        );
                      } else if (demande.artisansMatches && demande.artisansMatches.length > 0) {
                        const artisanId = demande.artisansMatches[0];
                        const artisan = artisansMap.get(artisanId);
                        const raisonSociale = artisan?.raisonSociale || 'Non assigné';
                        const initiales = raisonSociale
                          .split(' ')
                          .slice(0, 2)
                          .map(word => word[0]?.toUpperCase() || '')
                          .join('');
                        return (
                          <div className="mb-5 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-bold text-blue-600 uppercase tracking-wide">Artisan</span>
                              <div className="w-10 h-10 bg-gradient-to-br from-[#2C3E50] to-[#1A3A5C] text-white rounded-full flex items-center justify-center font-bold text-sm shadow-md">
                                {initiales || 'A'}
                              </div>
                              <p className="font-bold text-[#2C3E50] text-lg">
                                {raisonSociale}
                              </p>
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <div className="mb-5 bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Artisan</span>
                              <div className="w-10 h-10 bg-gradient-to-br from-gray-400 to-gray-500 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-md">
                                ?
                              </div>
                              <p className="font-semibold text-gray-500 text-lg">
                                Artisan non assigné
                              </p>
                            </div>
                          </div>
                        );
                      }
                    })()}
                    
                    {/* Titre principal + Dates + Badge statut */}
                    <h2 className="text-2xl font-extrabold text-[#2C3E50] mb-3 tracking-tight">
                      {demande.titre}
                    </h2>
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg">
                        <span className="text-blue-600">🏷️</span>
                        <span className="font-semibold text-blue-900">{demande.categorie}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="font-medium">Créée le {demande.dateCreation?.toDate().toLocaleDateString('fr-FR')}</span>
                      </div>
                      {demande.datesSouhaitees?.dates && demande.datesSouhaitees.dates.length > 0 && (
                        <div className="flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-lg">
                          <span className="text-amber-600">📅</span>
                          <span className="font-semibold text-amber-900">Début: {new Date(demande.datesSouhaitees.dates[0].toMillis()).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })}</span>
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
                              <span className="font-semibold">Délai :</span>
                              <span>{devisPaye.delaiRealisation} jour(s)</span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                  
                  {/* Badge statut principal */}
                  <div className="flex flex-col items-end gap-2">
                    {getStatutBadge(demande)}
                  </div>
                </div>

                {/* Description (toujours visible, tronquée si collapsed) */}
                <div className="mb-4">
                  <p className="text-sm font-bold text-gray-700 mb-2">Description :</p>
                  <p className={`text-gray-700 leading-relaxed ${!isExpanded ? 'line-clamp-2' : ''}`}>
                    {demande.description}
                  </p>
                </div>
                  
                {/* Boutons d'action pour brouillon et annulée */}
                {!isExpanded && (
                  <div className="flex gap-3 ml-4">
                    {/* Bouton Compléter pour brouillon uniquement */}
                    {demande.statut === 'genere' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/demande/nouvelle?brouillonId=${demande.id}`);
                        }}
                        className="px-3 py-2 bg-[#FF6B00] text-white hover:bg-[#E56100] rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1.5 shadow-sm hover:shadow-md"
                        title="Compléter et publier ce brouillon"
                      >
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          className="h-4 w-4" 
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor"
                        >
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" 
                          />
                        </svg>
                        Compléter ce brouillon
                      </button>
                    )}
                    
                    {/* Bouton Relancer pour demande annulée */}
                    {demande.statut === 'annulee' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const searchCriteria = {
                            categorie: demande.categorie,
                            ville: demande.localisation?.ville || '',
                            codePostal: demande.localisation?.codePostal || '',
                            dates: demande.datesSouhaitees?.dates?.map(d => d.toDate().toISOString().split('T')[0]) || [],
                            flexible: demande.datesSouhaitees?.flexible || false,
                            flexibiliteDays: demande.datesSouhaitees?.flexibiliteDays || 0,
                            urgence: demande.urgence || false,
                          };
                          sessionStorage.setItem('searchCriteria', JSON.stringify(searchCriteria));
                          router.push('/recherche');
                        }}
                        className="px-3 py-2 bg-[#FF6B00] text-white hover:bg-[#E56100] rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1.5 shadow-sm hover:shadow-md"
                        title="Relancer une recherche avec les mêmes critères"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Relancer cette recherche
                      </button>
                    )}
                    
                    {/* Bouton Supprimer pour brouillon et annulée */}
                    {(demande.statut === 'genere' || demande.statut === 'annulee') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDemande(demande.id, demande.titre);
                        }}
                        className="px-3 py-2 border-2 border-[#DC3545] text-[#DC3545] hover:bg-[#DC3545] hover:text-white rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1.5 shadow-sm hover:shadow-md"
                        title="Supprimer cette demande"
                      >
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          className="h-4 w-4" 
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor"
                        >
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
                          />
                        </svg>
                        Supprimer
                      </button>
                    )}
                  </div>
                )}

                {/* Informations détaillées - visibles uniquement si étendu */}
                {isExpanded && (
                  <div className="mt-6 pt-6 border-t border-gray-200 space-y-4">
                    <h4 className="font-bold text-[#2C3E50] text-lg mb-4">📋 Détails complets de la demande</h4>
                    
                    {/* Photos du projet */}
                    {(() => {
                      const photosList = demande.photosUrls || demande.photos || [];
                      const validPhotos = photosList.filter((url: string) => url && url.startsWith('http'));
                      
                      if (validPhotos.length === 0) return null;
                      
                      return (
                        <div className="mb-4">
                          <p className="text-sm font-semibold text-gray-700 mb-2">
                            📸 Photos du projet ({validPhotos.length})
                          </p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {validPhotos.map((photoUrl: string, idx: number) => {
                              const displayName = photoMetadata.get(photoUrl) || `Photo ${idx + 1}`;
                              return (
                                <div
                                  key={idx}
                                  className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200 hover:border-[#FF6B00] transition-all shadow-sm"
                                  style={{ backgroundColor: '#ffffff' }}
                                >
                                  <a
                                    href={photoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={displayName}
                                    className="block w-full h-full"
                                  >
                                    <img
                                      src={photoUrl}
                                      alt={displayName}
                                      className="w-full h-full object-contain"
                                    />
                                  </a>
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
                    
                    {/* Localisation détaillée */}
                    {demande.localisation && (
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <p className="text-sm font-semibold text-blue-900 mb-2">📍 Localisation</p>
                          <div className="space-y-1 text-sm text-blue-800">
                            <p><strong>Ville :</strong> {demande.localisation.ville}</p>
                            <p><strong>Code postal :</strong> {demande.localisation.codePostal}</p>
                            {demande.localisation.adresse && (
                              <p><strong>Adresse :</strong> {demande.localisation.adresse}</p>
                            )}
                          </div>
                        </div>
                        
                        {/* Dates souhaitées */}
                        {demande.datesSouhaitees && (
                          <div className="bg-green-50 p-4 rounded-lg">
                            <p className="text-sm font-semibold text-green-900 mb-2">📅 Dates souhaitées</p>
                            <div className="space-y-1 text-sm text-green-800">
                              {demande.datesSouhaitees.dates && demande.datesSouhaitees.dates.length > 0 ? (
                                <>
                                  {demande.datesSouhaitees.dates.map((date, idx) => (
                                    <p key={idx}>
                                      <strong>Date {idx + 1} :</strong> {date.toDate().toLocaleDateString('fr-FR', { 
                                        weekday: 'long', 
                                        year: 'numeric', 
                                        month: 'long', 
                                        day: 'numeric' 
                                      })}
                                    </p>
                                  ))}
                                  {demande.datesSouhaitees.flexible && (
                                    <p className="text-xs mt-2 text-green-700">
                                      ✅ Dates flexibles jusqu'à {demande.datesSouhaitees.flexibiliteDays || 7} jours
                                    </p>
                                  )}
                                </>
                              ) : (
                                <p>Aucune date spécifiée</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Urgence */}
                    {demande.urgence && (
                      <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded">
                        <p className="text-red-800 font-semibold flex items-center gap-2">
                          🚨 Demande urgente
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Message vert pour les demandes avec devis payé (contrats) */}
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
                            <p className="font-bold text-green-700 mb-1">✅ Devis accepté et payé - Contrat en cours</p>
                            <p className="text-sm text-green-600">
                              Vous avez signé et payé le devis de l'artisan.
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-3 mt-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (devisPaye?.id) {
                              router.push(`/client/devis/${devisPaye.id}`);
                            } else {
                              router.push(`/client/contrats?demandeId=${demande.id}`);
                            }
                          }}
                          className="flex-1 bg-[#FF6B00] text-white hover:bg-[#E56100] rounded-lg px-4 py-2.5 font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
                        >
                          📋 Voir devis payé
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const artisanId = demande.artisansMatches?.[0];
                            if (artisanId) {
                              router.push(`/messages?userId=${artisanId}`);
                            }
                          }}
                          className="px-4 py-2.5 border-2 border-[#2C3E50] text-[#2C3E50] hover:bg-[#2C3E50] hover:text-white rounded-lg font-medium transition-all duration-200 flex items-center gap-2"
                        >
                          💬 Contacter client
                        </button>
                      </div>
                    </div>
                  </div>
                  );
                })()}

                {/* Bouton Chercher un autre artisan en bas au centre si devis refusé */}
                {(() => {
                  const devisForDemande = devisMap.get(demande.id) || [];
                  const devisRefuse = devisForDemande.find(d => d.statut === 'refuse');
                  
                  if (devisRefuse) {
                    return (
                      <div className="flex justify-center pt-4 border-t border-gray-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Construire l'URL avec toutes les informations de la demande
                            const params = new URLSearchParams({
                              categorie: demande.categorie,
                              ville: demande.localisation.ville,
                              codePostal: demande.localisation.codePostal,
                              description: demande.description || '',
                              urgence: String(demande.urgence || 'normale'),
                            });
                            
                            // Ajouter les dates si elles existent
                            if (demande.datesSouhaitees?.dates && demande.datesSouhaitees.dates.length > 0) {
                              const dates = demande.datesSouhaitees.dates.map(d => 
                                d.toDate().toISOString().split('T')[0]
                              );
                              params.append('dates', JSON.stringify(dates));
                              params.append('flexible', String(demande.datesSouhaitees.flexible || false));
                              if (demande.datesSouhaitees.flexibiliteDays) {
                                params.append('flexibiliteDays', String(demande.datesSouhaitees.flexibiliteDays));
                              }
                            }
                            
                            router.push(`/recherche?${params.toString()}`);
                          }}
                          className="text-sm bg-[#FF6B00] text-white px-4 py-2 rounded-lg hover:bg-[#E56100] transition font-medium flex items-center gap-2"
                        >
                          🔍 Chercher un autre artisan
                        </button>
                      </div>
                    );
                  }
                  return null;
                })()}
                </div>
              </div>
            );
          };

          return (
            <>
              {/* Titre de la section active */}
              {filtreSection !== 'toutes' && demandesFiltrees.length > 0 && (
                <div className="mb-4">
                  <h2 className="text-2xl font-bold text-[#2C3E50]">
                    {filtreSection === 'contrats' && '✅ Contrats en cours'}
                    {filtreSection === 'devis_recus' && '📬 Devis reçus'}
                    {filtreSection === 'en_attente' && '📤 En attente de réponse'}
                    {filtreSection === 'publiees' && '📢 Publiées'}
                    {filtreSection === 'refusees' && '❌ Refusées'}
                    {filtreSection === 'terminees' && '🏁 Terminées'}
                  </h2>
                  <p className="text-sm text-[#6C757D] mt-1">
                    {filtreSection === 'contrats' && 'Demandes avec devis accepté et payé - Travaux en cours ou terminés'}
                    {filtreSection === 'devis_recus' && 'Demandes pour lesquelles vous avez reçu des propositions de devis'}
                    {filtreSection === 'en_attente' && 'Demandes envoyées à un artisan spécifique en attente de sa réponse'}
                    {filtreSection === 'publiees' && 'Demandes publiées publiquement, pas encore envoyées à un artisan spécifique'}
                    {filtreSection === 'refusees' && 'Demandes refusées par l\'artisan contacté'}
                    {filtreSection === 'terminees' && 'Demandes avec travaux terminés et validés'}
                  </p>
                </div>
              )}

              {/* Liste des demandes filtrées */}
              {demandesFiltrees.length > 0 ? (
                <div className="space-y-4">
                  {demandesFiltrees.map(renderDemande)}
                </div>
              ) : (
                <Card className="p-12 text-center">
                  <div className="text-6xl mb-4">🔍</div>
                  <h2 className="text-2xl font-bold text-[#2C3E50] mb-2">
                    Aucune demande dans cette catégorie
                  </h2>
                  <p className="text-[#6C757D] mb-6">
                    {filtreSection === 'toutes' ? 'Vous n\'avez pas encore créé de demande' : 'Essayez une autre catégorie'}
                  </p>
                  {filtreSection !== 'toutes' && (
                    <button
                      onClick={() => setFiltreSection('toutes')}
                      className="text-[#FF6B00] hover:underline font-medium"
                    >
                      ← Voir toutes les demandes
                    </button>
                  )}
                </Card>
              )}
            </>
          );
            })()}
          </div>
        )}
      </main>
    </div>
  );
}
