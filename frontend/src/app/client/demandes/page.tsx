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

  useEffect(() => {
    // Attendre que l'auth soit chargée
    if (authLoading) return;

    if (!user) {
      router.push('/connexion');
      return;
    }

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
      annulee: '❌ Annulée',
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
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Header */}
      <header className="bg-[#2C3E50] text-white py-6 shadow-lg">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => router.push('/dashboard')} className="hover:opacity-80">
                <Logo size="md" />
              </button>
              <div>
                <h1 className="text-3xl font-bold">Mes demandes de devis</h1>
                <p className="text-[#95A5A6] mt-1">Suivez l'état de vos demandes</p>
              </div>
            </div>
            <Button
              onClick={() => router.push('/recherche')}
              className="bg-[#FF6B00] hover:bg-[#E56100] text-white"
            >
              + Nouvelle recherche
            </Button>
          </div>
        </div>
      </header>

      {/* Contenu */}
      <main className="container mx-auto px-4 py-8">
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
            {demandes.map((demande) => (
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
                          <span>{demande.dateCreation?.toDate().toLocaleDateString('fr-FR')}</span>
                        </div>
                        {demande.datesSouhaitees?.dates?.[0] && (
                          <div className="flex items-center gap-1">
                            <span>🗓️</span>
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
                  
                  {/* Bouton Supprimer pour brouillon */}
                  {demande.statut === 'brouillon' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDemande(demande.id, demande.titre);
                      }}
                      className="ml-4 px-4 py-2.5 border-2 border-[#DC3545] text-[#DC3545] hover:bg-[#DC3545] hover:text-white rounded-lg font-medium transition-all duration-200 flex items-center gap-2 shadow-sm hover:shadow-md"
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm mb-4">
                  <div>
                    <span className="text-[#6C757D]">Artisans matchés :</span>
                    {demande.artisansMatches && demande.artisansMatches.length > 0 ? (
                      <div className="mt-1 space-y-1">
                        {demande.artisansMatches.slice(0, 2).map(artisanId => {
                          const artisan = artisansMap.get(artisanId);
                          return (
                            <p key={artisanId} className="font-semibold text-[#2C3E50] flex items-center gap-1 text-xs">
                              <span className="text-[#FF6B00]">👷</span>
                              <span className="truncate" title={artisan?.raisonSociale}>
                                {artisan?.raisonSociale || `${artisanId.substring(0, 8)}...`}
                              </span>
                            </p>
                          );
                        })}
                        {demande.artisansMatches.length > 2 && (
                          <p className="text-xs text-[#6C757D] italic">
                            +{demande.artisansMatches.length - 2} autre{demande.artisansMatches.length - 2 > 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="font-semibold text-[#6C757D]">0</p>
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

                {demande.budget && (
                  <div className="bg-[#FFF3E0] px-4 py-2 rounded-lg inline-block mt-4">
                    <span className="text-sm text-[#6C757D]">Budget : </span>
                    <span className="font-semibold text-[#FF6B00]">
                      {demande.budget.min}€ - {demande.budget.max}€
                    </span>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
