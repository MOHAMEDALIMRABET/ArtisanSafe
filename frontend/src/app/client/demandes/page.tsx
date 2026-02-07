'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getDemandesByClient, deleteDemande } from '@/lib/firebase/demande-service';
import { getArtisansByIds } from '@/lib/firebase/artisan-service';
import { getDevisByDemande } from '@/lib/firebase/devis-service';
import { createNotification } from '@/lib/firebase/notification-service';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { Demande, Artisan, Devis } from '@/types/firestore';

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
      const clientNom = user ? `${user.prenom} ${user.nom}` : 'Un client';
      
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

  function getStatutBadge(statut: Demande['statut']) {
    const badges = {
      brouillon: 'bg-gray-200 text-gray-800',
      publiee: 'bg-blue-100 text-blue-800',
      matchee: 'bg-green-100 text-green-800',
      en_cours: 'bg-yellow-100 text-yellow-800',
      terminee: 'bg-green-200 text-green-900',
      annulee: 'bg-red-100 text-red-800',
    };

    const labels = {
      brouillon: '📝 Brouillon',
      publiee: '📢 Publiée',
      matchee: '🤝 Artisan trouvé',
      en_cours: '⏳ En cours',
      terminee: '✅ Terminée',
      annulee: '❌ Refusée',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badges[statut]}`}>
        {labels[statut]}
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      {/* Titre de la page */}
      <div className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[#2C3E50]">
                Mes demandes de devis
              </h1>
              <p className="text-sm text-[#6C757D] mt-1">
                Suivez l'état de vos demandes et gérez vos projets
              </p>
            </div>
            
            <Button
              onClick={() => router.push('/recherche')}
              className="bg-[#FF6B00] hover:bg-[#E56100] text-white"
            >
              + Nouvelle demande
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
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Onglets de filtrage */}
        <div className="grid grid-cols-2 md:grid-cols-7 gap-3 mb-6">
          <button
            onClick={() => setFiltreSection('toutes')}
            className={`rounded-lg shadow-md p-4 text-left transition-all hover:shadow-lg ${
              filtreSection === 'toutes' ? 'bg-[#FF6B00] text-white ring-4 ring-[#FF6B00] ring-opacity-50' : 'bg-white'
            }`}
          >
            <div className={`text-2xl font-bold ${
              filtreSection === 'toutes' ? 'text-white' : 'text-[#FF6B00]'
            }`}>{demandes.length}</div>
            <div className={`text-sm ${
              filtreSection === 'toutes' ? 'text-white' : 'text-gray-600'
            }`}>Toutes</div>
          </button>
          
          <button
            onClick={() => setFiltreSection('contrats')}
            className={`rounded-lg shadow-md p-4 text-left transition-all hover:shadow-lg ${
              filtreSection === 'contrats' ? 'bg-green-600 text-white ring-4 ring-green-600 ring-opacity-50' : 'bg-white'
            }`}
          >
            <div className={`text-2xl font-bold ${
              filtreSection === 'contrats' ? 'text-white' : 'text-green-600'
            }`}>{getDemandesContratsEnCours(demandes).length}</div>
            <div className={`text-sm ${
              filtreSection === 'contrats' ? 'text-white' : 'text-gray-600'
            }`}>✅ Contrats</div>
          </button>
          
          <button
            onClick={() => setFiltreSection('devis_recus')}
            className={`rounded-lg shadow-md p-4 text-left transition-all hover:shadow-lg ${
              filtreSection === 'devis_recus' ? 'bg-blue-600 text-white ring-4 ring-blue-600 ring-opacity-50' : 'bg-white'
            }`}
          >
            <div className={`text-2xl font-bold ${
              filtreSection === 'devis_recus' ? 'text-white' : 'text-blue-600'
            }`}>{getDemandesAvecDevis(demandes).length}</div>
            <div className={`text-sm ${
              filtreSection === 'devis_recus' ? 'text-white' : 'text-gray-600'
            }`}>📬 Devis reçus</div>
          </button>
          
          <button
            onClick={() => setFiltreSection('en_attente')}
            className={`rounded-lg shadow-md p-4 text-left transition-all hover:shadow-lg ${
              filtreSection === 'en_attente' ? 'bg-[#FFC107] text-white ring-4 ring-[#FFC107] ring-opacity-50' : 'bg-white'
            }`}
          >
            <div className={`text-2xl font-bold ${
              filtreSection === 'en_attente' ? 'text-white' : 'text-[#FFC107]'
            }`}>{getDemandesEnAttente(demandes).length}</div>
            <div className={`text-sm ${
              filtreSection === 'en_attente' ? 'text-white' : 'text-gray-600'
            }`}>📤 En attente</div>
          </button>
          
          <button
            onClick={() => setFiltreSection('publiees')}
            className={`rounded-lg shadow-md p-4 text-left transition-all hover:shadow-lg ${
              filtreSection === 'publiees' ? 'bg-purple-600 text-white ring-4 ring-purple-600 ring-opacity-50' : 'bg-white'
            }`}
          >
            <div className={`text-2xl font-bold ${
              filtreSection === 'publiees' ? 'text-white' : 'text-purple-600'
            }`}>{getDemandesPubliees(demandes).length}</div>
            <div className={`text-sm ${
              filtreSection === 'publiees' ? 'text-white' : 'text-gray-600'
            }`}>📢 Publiées</div>
          </button>
          
          <button
            onClick={() => setFiltreSection('refusees')}
            className={`rounded-lg shadow-md p-4 text-left transition-all hover:shadow-lg ${
              filtreSection === 'refusees' ? 'bg-red-600 text-white ring-4 ring-red-600 ring-opacity-50' : 'bg-white'
            }`}
          >
            <div className={`text-2xl font-bold ${
              filtreSection === 'refusees' ? 'text-white' : 'text-red-600'
            }`}>{getDemandesRefusees(demandes).length}</div>
            <div className={`text-sm ${
              filtreSection === 'refusees' ? 'text-white' : 'text-gray-600'
            }`}>❌ Refusées</div>
          </button>
          
          <button
            onClick={() => setFiltreSection('terminees')}
            className={`rounded-lg shadow-md p-4 text-left transition-all hover:shadow-lg ${
              filtreSection === 'terminees' ? 'bg-gray-700 text-white ring-4 ring-gray-700 ring-opacity-50' : 'bg-white'
            }`}
          >
            <div className={`text-2xl font-bold ${
              filtreSection === 'terminees' ? 'text-white' : 'text-gray-700'
            }`}>{getDemandesTerminees(demandes).length}</div>
            <div className={`text-sm ${
              filtreSection === 'terminees' ? 'text-white' : 'text-gray-600'
            }`}>🏁 Terminées</div>
          </button>
        </div>

        {demandes.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="text-6xl mb-4">📋</div>
            <h2 className="text-2xl font-bold text-[#2C3E50] mb-2">
              Aucune demande pour le moment
            </h2>
            <p className="text-[#6C757D] mb-6">
              Commencez par rechercher un artisan et demander un devis
            </p>
            <Button
              onClick={() => router.push('/recherche')}
              className="bg-[#FF6B00] hover:bg-[#E56100] text-white"
            >
              Rechercher un artisan
            </Button>
          </Card>
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

              const renderDemande = (demande: Demande) => (
              <Card
                key={demande.id}
                className="p-6 hover:border-[#FF6B00] transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-3 flex-wrap">
                      <h3 className="text-xl font-bold text-[#2C3E50]">
                        {demande.titre}
                      </h3>
                      
                      {/* Dates */}
                      <div className="flex items-center gap-3 text-xs text-[#6C757D]">
                        <div className="flex items-center gap-1">
                          <span>📅</span>
                          <span className="font-medium">Créée le</span>
                          <span>{demande.dateCreation?.toDate().toLocaleDateString('fr-FR')}</span>
                        </div>
                        {demande.datesSouhaitees?.dates?.[0] && (
                          <div className="flex items-center gap-1">
                            <span>🗓️</span>
                            <span className="font-medium">Début souhaité le</span>
                            <span>{demande.datesSouhaitees.dates[0].toDate().toLocaleDateString('fr-FR')}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* {getTypeBadge(demande.type)} */}
                      {getStatutBadge(demande.statut)}
                      
                      {/* Badge devis refusé après le badge Publié */}
                      {(() => {
                        const devisForDemande = devisMap.get(demande.id) || [];
                        const devisRefuse = devisForDemande.find(d => d.statut === 'refuse');
                        
                        if (devisRefuse) {
                          return (
                            <p className="text-xs text-red-600 font-semibold bg-red-50 px-2 py-1 rounded">
                              ❌ Devis refusé le {devisRefuse.dateRefus?.toDate().toLocaleDateString('fr-FR')}
                            </p>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <p className="text-[#6C757D] text-sm mb-2">
                      {demande.description.substring(0, 150)}
                      {demande.description.length > 150 && '...'}
                    </p>
                  </div>
                  
                  {/* Boutons d'action pour brouillon et annulée */}
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
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm mb-4">
                  <div>
                    <span className="text-[#6C757D]">Artisan :</span>
                    {demande.statut === 'annulee' && demande.artisanRefuseNom ? (
                      <div className="mt-1">
                        <p className="font-semibold text-[#2C3E50] flex items-center gap-1">
                          <span className="text-gray-400">👷</span>
                          <span className="truncate" title={demande.artisanRefuseNom}>
                            {demande.artisanRefuseNom}
                          </span>
                        </p>
                        <p className="text-xs text-[#DC3545] mt-1 font-medium">❌ A refusé cette demande</p>
                        {demande.dateRefus && (
                          <p className="text-xs text-[#6C757D] mt-0.5">
                            Le {demande.dateRefus.toDate().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                    ) : demande.artisansMatches && demande.artisansMatches.length > 0 ? (
                      <div className="mt-1">
                        {demande.artisansMatches.slice(0, 1).map(artisanId => {
                          const artisan = artisansMap.get(artisanId);
                          return (
                            <p key={artisanId} className="font-semibold text-[#2C3E50] flex items-center gap-1">
                              <span className="text-[#FF6B00]">👷</span>
                              <span className="truncate" title={artisan?.raisonSociale}>
                                {artisan?.raisonSociale || `${artisanId.substring(0, 8)}...`}
                              </span>
                            </p>
                          );
                        })}
                        {(() => {
                          // Analyser le statut des devis pour cette demande
                          const devisForDemande = devisMap.get(demande.id) || [];
                          const devisAccepte = devisForDemande.find(d => d.statut === 'accepte');
                          const devisRefuse = devisForDemande.find(d => d.statut === 'refuse');
                          const devisEnAttente = devisForDemande.find(d => d.statut === 'envoye');

                          if (demande.statut === 'genere') {
                            return <p className="text-xs text-[#6C757D] mt-1 font-medium">📋 Brouillon non publié</p>;
                          } else if (devisAccepte) {
                            return (
                              <p className="text-xs text-green-600 mt-2 font-semibold bg-green-50 px-2 py-1 rounded">
                                🎉 Devis accepté le {devisAccepte.dateAcceptation?.toDate().toLocaleDateString('fr-FR')}
                              </p>
                            );
                          } else if (devisRefuse) {
                            return null;
                          } else if (devisEnAttente) {
                            return (
                              <p className="text-xs text-blue-600 mt-2 font-semibold bg-blue-50 px-2 py-1 rounded">
                                📩 {devisForDemande.length} devis reçu(s) en attente de votre réponse
                              </p>
                            );
                          } else if (demande.devisRecus && demande.devisRecus > 0) {
                            return <p className="text-xs text-blue-600 mt-1 font-medium">📩 Devis reçu(s) à consulter</p>;
                          } else {
                            return <p className="text-xs text-green-600 mt-1 font-medium">⏳ En attente de réponse de l'artisan</p>;
                          }
                        })()}
                      </div>
                    ) : (
                      <p className="font-semibold text-[#6C757D] mt-1">Non assigné</p>
                    )}
                  </div>
                  <div>
                    <span className="text-[#6C757D]">Catégorie :</span>
                    <p className="font-semibold text-[#2C3E50]">{demande.categorie}</p>
                  </div>
                  <div>
                    <span className="text-[#6C757D]">Localisation :</span>
                    <p className="font-semibold text-[#2C3E50]">{demande.localisation.ville}</p>
                  </div>
                  <div>
                    <span className="text-[#6C757D]">Devis reçus :</span>
                    <span className="font-semibold text-[#2C3E50] ml-2">{demande.devisRecus || 0}</span>
                    
                    {/* Badge Quota atteint */}
                    {demande.statut === 'quota_atteint' && (
                      <div className="mt-2 inline-block">
                        <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-bold border-2 border-orange-300">
                          🔒 Quota atteint (10/10)
                        </span>
                        <p className="text-xs text-orange-600 mt-1 font-medium">
                          ✅ Demande fermée automatiquement
                        </p>
                      </div>
                    )}
                    
                    {(demande.devisRecus && demande.devisRecus > 0) ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/client/devis?demandeId=${demande.id}`);
                        }}
                        className="mt-1 text-xs text-[#FF6B00] hover:underline font-medium flex items-center gap-1"
                      >
                        📄 Voir les devis
                      </button>
                    ) : null}
                  </div>
                </div>

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
                            <p className="text-sm text-green-600 mb-3">
                              Cette demande vous a été attribuée. Vous avez signé et payé le devis de l'artisan.
                            </p>
                            
                            {/* Affichage du devis payé */}
                            {devisPaye && (
                              <div className="bg-white border border-green-200 rounded-lg p-4 mt-3">
                                <div className="flex items-start justify-between mb-3">
                                  <div>
                                    <p className="text-sm font-semibold text-gray-700">Devis N° {devisPaye.numeroDevis}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Date: {devisPaye.dateCreation?.toDate().toLocaleDateString('fr-FR')}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-xl font-bold text-green-600">
                                      {devisPaye.totaux?.totalTTC?.toFixed(2) || '0.00'} €
                                    </div>
                                    <div className="text-xs text-gray-500">TTC</div>
                                  </div>
                                </div>
                                
                                {devisPaye.prestations && devisPaye.prestations.length > 0 && (
                                  <div className="border-t border-gray-200 pt-3">
                                    <p className="text-xs font-semibold text-gray-600 mb-2">Prestations :</p>
                                    <div className="space-y-2">
                                      {devisPaye.prestations.slice(0, 3).map((p, idx) => (
                                        <div key={idx} className="flex justify-between items-start text-xs">
                                          <span className="text-gray-700 flex-1">{p.designation}</span>
                                          <span className="text-gray-600 ml-2">
                                            {p.quantite} × {p.prixUnitaireHT?.toFixed(2) || '0.00'} €
                                          </span>
                                        </div>
                                      ))}
                                      {devisPaye.prestations.length > 3 && (
                                        <p className="text-xs text-gray-500 italic">
                                          +{devisPaye.prestations.length - 3} autre(s) prestation(s)
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )}
                                
                                {devisPaye.delaiRealisation && (
                                  <div className="mt-3 pt-3 border-t border-gray-200">
                                    <p className="text-xs text-gray-600">
                                      <span className="font-semibold">Délai :</span> {devisPaye.delaiRealisation}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
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
                              urgence: demande.urgence || 'normale',
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
              </Card>
              );

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
