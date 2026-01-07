'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getDemandesByClient, deleteDemande } from '@/lib/firebase/demande-service';
import { getArtisansByIds } from '@/lib/firebase/artisan-service';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui';
import type { Demande, Artisan } from '@/types/firestore';

export default function MesDemandesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [artisansMap, setArtisansMap] = useState<Map<string, Artisan>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showAnnulees, setShowAnnulees] = useState(false);
  const [filtreStatut, setFiltreStatut] = useState<'toutes' | 'publiee' | 'annulee' | 'brouillon'>('toutes');
  const [filtreDateTravaux, setFiltreDateTravaux] = useState<string>('');

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
    } catch (error) {
      console.error('Erreur chargement demandes:', error);
    } finally {
      setLoading(false);
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
      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${badges[statut]}`}>
        {labels[statut]}
      </span>
    );
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
      {/* Navigation */}
      <nav className="bg-white shadow-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button onClick={() => router.push('/dashboard')} className="hover:opacity-80">
              <Logo size="md" />
            </button>
            
            <Button
              onClick={() => router.push('/recherche')}
              className="bg-[#FF6B00] hover:bg-[#E56100] text-white"
            >
              + Nouvelle recherche
            </Button>
          </div>
        </div>
      </nav>

      {/* Contenu */}
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* En-tête */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h1 className="text-3xl font-bold text-[#2C3E50] mb-2">
            Mes demandes de devis
          </h1>
          <p className="text-gray-700">
            Suivez l'état de vos demandes et gérez vos projets
          </p>
        </div>

        {/* Filtres */}
        <div className="mb-6 bg-white p-6 rounded-lg shadow-sm space-y-4">
          <h3 className="font-semibold text-[#2C3E50] mb-3">Filtrer les demandes</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          {(filtreStatut !== 'toutes' || filtreDateTravaux) && (
            <button
              onClick={() => {
                setFiltreStatut('toutes');
                setFiltreDateTravaux('');
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
                  <div 
                    className="flex-1 cursor-pointer"
                    onClick={() => router.push(`/client/demandes/${demande.id}`)}
                  >
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
                      
                      {getStatutBadge(demande.statut)}
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
                        className="px-4 py-2.5 bg-[#FF6B00] text-white hover:bg-[#E56100] rounded-lg font-medium transition-all duration-200 flex items-center gap-2 shadow-sm hover:shadow-md"
                        title="Compléter et publier ce brouillon"
                      >
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          className="h-5 w-5" 
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
                    
                    {/* Bouton Supprimer pour brouillon et annulée */}
                    {(demande.statut === 'brouillon' || demande.statut === 'annulee') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDemande(demande.id, demande.titre);
                        }}
                        className="px-4 py-2.5 border-2 border-[#DC3545] text-[#DC3545] hover:bg-[#DC3545] hover:text-white rounded-lg font-medium transition-all duration-200 flex items-center gap-2 shadow-sm hover:shadow-md"
                        title="Supprimer cette demande"
                      >
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          className="h-5 w-5" 
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
                          className="mt-2 px-3 py-1.5 bg-[#FF6B00] text-white text-xs rounded-lg hover:bg-[#E56100] font-medium transition flex items-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Relancer cette recherche
                        </button>
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
                        {demande.statut === 'brouillon' ? (
                          <p className="text-xs text-[#6C757D] mt-1 font-medium">📋 Brouillon non publié</p>
                        ) : (
                          <p className="text-xs text-green-600 mt-1 font-medium">✅ En attente de réponse</p>
                        )}
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
                    <p className="font-semibold text-[#2C3E50]">
                      {demande.localisation.ville}
                    </p>
                  </div>
                  <div>
                    <span className="text-[#6C757D]">Devis reçus :</span>
                    <p className="font-semibold text-[#2C3E50]">{demande.devisRecus || 0}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
