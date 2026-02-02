'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  const { user, loading: authLoading } = useAuth();
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [artisansMap, setArtisansMap] = useState<Map<string, Artisan>>(new Map());
  const [devisMap, setDevisMap] = useState<Map<string, Devis[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showAnnulees, setShowAnnulees] = useState(false);
  const [filtreStatut, setFiltreStatut] = useState<'toutes' | 'publiee' | 'annulee' | 'brouillon'>('toutes');
  const [filtreDateTravaux, setFiltreDateTravaux] = useState<string>('');
  const [filtreType, setFiltreType] = useState<'toutes' | 'directe' | 'publique'>('toutes');

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
    loadDemandes();
  }, [user, authLoading, router]);

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

      // Charger les devis pour chaque demande
      const devisMapTemp = new Map<string, Devis[]>();
      for (const demande of userDemandes) {
        try {
          const devisForDemande = await getDevisByDemande(demande.id);
          devisMapTemp.set(demande.id, devisForDemande);
        } catch (error) {
          console.error(`Erreur chargement devis pour demande ${demande.id}:`, error);
        }
      }
      setDevisMap(devisMapTemp);
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
      publiee: '� Envoyée',
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
              onClick={() => router.push('/demande/choisir-type')}
              className="bg-[#FF6B00] hover:bg-[#E56100] text-white"
            >
              + Nouvelle demande
            </Button>
          </div>
        </div>
      </div>

      {/* Contenu */}
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Filtres */}
        <div className="mb-6 bg-white p-6 rounded-lg shadow-sm space-y-4">
          <h3 className="font-semibold text-[#2C3E50] mb-3">Filtrer les demandes</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Filtre par type */}
            <div>
              <label className="block text-sm font-medium text-[#6C757D] mb-2">
                Type de demande
              </label>
              <select
                value={filtreType}
                onChange={(e) => setFiltreType(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
              >
                <option value="toutes">Tous les types</option>
                <option value="directe">🎯 Demandes directes</option>
                <option value="publique">📢 Demandes publiques</option>
              </select>
            </div>

            {/* Filtre par statut */}
            <div>
              <label className="block text-sm font-medium text-[#6C757D] mb-2">
                Statut
              </label>
              <select
                value={filtreStatut}
                onChange={(e) => setFiltreStatut(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
              >
                <option value="toutes">Toutes les demandes</option>
                <option value="brouillon">📝 Brouillons</option>
                <option value="publiee">📢 Publiées</option>
                <option value="annulee">❌ Refusées</option>
              </select>
            </div>

            {/* Filtre date début travaux */}
            <div>
              <label className="block text-sm font-medium text-[#6C757D] mb-2">
                Date de début des travaux
              </label>
              <input
                type="date"
                value={filtreDateTravaux}
                onChange={(e) => setFiltreDateTravaux(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
              />
            </div>
          </div>

          {/* Bouton réinitialiser */}
          {(filtreStatut !== 'toutes' || filtreDateTravaux || filtreType !== 'toutes') && (
            <button
              onClick={() => {
                setFiltreStatut('toutes');
                setFiltreDateTravaux('');
                setFiltreType('toutes');
              }}
              className="text-sm text-[#FF6B00] hover:underline font-medium"
            >
              ↺ Réinitialiser les filtres
            </button>
          )}
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
            {demandes
              .filter(demande => {
                // Filtre par type
                if (filtreType !== 'toutes') {
                  const demandeType = demande.type || 'directe'; // Par défaut 'directe' pour compatibilité
                  if (demandeType !== filtreType) {
                    return false;
                  }
                }

                // Filtre par statut
                if (filtreStatut !== 'toutes' && demande.statut !== filtreStatut) {
                  return false;
                }

                // Filtre par date de début des travaux
                if (filtreDateTravaux) {
                  const dateTravaux = demande.datesSouhaitees?.dates?.[0]?.toDate();
                  const dateFiltre = new Date(filtreDateTravaux);
                  if (!dateTravaux || dateTravaux.toDateString() !== dateFiltre.toDateString()) {
                    return false;
                  }
                }
                
                // Exclure les demandes sans artisan assigné (Non assigné)
                const hasArtisan = 
                  (demande.statut === 'annulee' && demande.artisanRefuseNom) || // Refusée avec artisan
                  (demande.artisansMatches && demande.artisansMatches.length > 0); // Avec artisan assigné
                
                return hasArtisan;
              })
              .map((demande) => (
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
                      
                      {getTypeBadge(demande.type)}
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
                    {demande.statut === 'brouillon' && (
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
                    {(demande.statut === 'brouillon' || demande.statut === 'annulee') && (
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

                          if (demande.statut === 'brouillon') {
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
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
