'use client';

/**
 * Page de consultation des devis reçus par le client
 * Affiche tous les devis groupés par demande
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Devis } from '@/types/devis';
import type { Demande } from '@/types/firestore';
import Link from 'next/link';
import { annulerDevisParClient } from '@/lib/firebase/devis-service';

// Helper: Devis considérés comme "acceptés" (en attente de paiement)
const isDevisAccepte = (statut: string) => 
  ['accepte', 'en_attente_paiement'].includes(statut);

// Helper: Devis considérés comme "payés" (contrats signés)
const isDevisPaye = (statut: string) => 
  ['paye', 'en_cours', 'travaux_termines', 'termine_valide', 'termine_auto_valide', 'litige'].includes(statut);

export default function ClientDevisPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [devis, setDevis] = useState<Devis[]>([]);
  const [demandes, setDemandes] = useState<Map<string, Demande>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'tous' | 'en_attente' | 'acceptes' | 'payes' | 'refuses'>('en_attente');

  // Restaurer le filtre depuis l'URL au retour
  useEffect(() => {
    const returnFilter = searchParams.get('returnFilter');
    if (returnFilter && ['tous', 'en_attente', 'acceptes', 'payes', 'refuses'].includes(returnFilter)) {
      setFilter(returnFilter as typeof filter);
    }
  }, [searchParams]);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      router.push('/connexion');
      return;
    }
    
    loadDevis();
  }, [user, authLoading, router]);

  const loadDevis = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Charger tous les devis du client (SAUF les brouillons)
      const q = query(
        collection(db, 'devis'),
        where('clientId', '==', user.uid)
      );

      const querySnapshot = await getDocs(q);
      const allDevis = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Devis));

      // Filtrer pour exclure les brouillons ET les devis remplacés/en révision (le client ne doit voir que les devis actifs)
      const devisData = allDevis.filter(d => 
        d.statut !== 'genere' && 
        d.statut !== 'remplace' && 
        d.statut !== 'en_revision'
      );

      // Trier par date de création décroissante
      devisData.sort((a, b) => {
        const dateA = a.dateCreation?.toMillis() || 0;
        const dateB = b.dateCreation?.toMillis() || 0;
        return dateB - dateA;
      });

      setDevis(devisData);

      // Charger les demandes associées
      const demandesMap = new Map<string, Demande>();
      for (const d of devisData) {
        if (d.demandeId && !demandesMap.has(d.demandeId)) {
          const demandeDoc = await getDoc(doc(db, 'demandes', d.demandeId));
          if (demandeDoc.exists()) {
            demandesMap.set(d.demandeId, {
              id: demandeDoc.id,
              ...demandeDoc.data(),
            } as Demande);
          }
        }
      }
      setDemandes(demandesMap);
    } catch (error) {
      console.error('Erreur chargement devis:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnnulerDevis = async (devisId: string, numeroDevis: string, montantTTC: number, nomArtisan: string) => {
    if (!user) return;

    // Message d'avertissement CLAIR et professionnel
    const confirmAnnulation = window.confirm(
      `⚠️ ATTENTION : Annulation d'un devis déjà accepté\n\n` +
      `Devis : ${numeroDevis}\n` +
      `Artisan : ${nomArtisan}\n` +
      `Montant : ${montantTTC.toFixed(2)}€ TTC\n\n` +
      `En annulant ce devis, votre demande sera CLOSE définitivement.\n\n` +
      `CONSÉQUENCES :\n` +
      `• L'artisan a déjà planifié votre chantier dans son agenda\n` +
      `• Vous ne pourrez plus recevoir de devis pour cette demande\n` +
      `• Les autres devis reçus resteront annulés\n` +
      `• Pour relancer ce projet : créer une NOUVELLE demande\n\n` +
      `Cette action est IRRÉVERSIBLE.\n\n` +
      `Êtes-vous CERTAIN de vouloir annuler ce devis ?`
    );

    if (!confirmAnnulation) return;

    try {
      await annulerDevisParClient(devisId, user.uid, 'Client désisté avant paiement');
      alert(
        '✅ Devis annulé avec succès\n\n' +
        `Votre demande a été close définitivement.\n` +
        `L'artisan ${nomArtisan} a été notifié de votre désistement.\n\n` +
        `Pour relancer ce projet, créez une nouvelle demande depuis votre tableau de bord.`
      );
      await loadDevis(); // Recharger la liste
    } catch (error: any) {
      console.error('Erreur annulation devis:', error);
      alert(`❌ Erreur lors de l'annulation : ${error.message || 'Erreur inconnue'}`);
    }
  };

  const getStatutBadge = (statut: string) => {
    const styles: { [key: string]: string } = {
      genere: 'bg-gray-100 text-gray-800',
      envoye: 'bg-purple-100 text-purple-700',
      en_revision: 'bg-purple-100 text-purple-800',
      accepte: 'bg-green-100 text-green-800',
      en_attente_paiement: 'bg-yellow-100 text-yellow-800',
      paye: 'bg-green-600 text-white',
      en_cours: 'bg-amber-600 text-white',
      travaux_termines: 'bg-orange-100 text-orange-800',
      termine_valide: 'bg-green-700 text-white',
      termine_auto_valide: 'bg-green-600 text-white',
      litige: 'bg-red-600 text-white',
      refuse: 'bg-red-100 text-red-800',
      expire: 'bg-orange-100 text-orange-800',
      remplace: 'bg-gray-200 text-gray-600',
      annule: 'bg-gray-300 text-gray-700',
    };

    const labels: { [key: string]: string } = {
      genere: '📝 Brouillon',
      envoye: '🆕 Nouveau',
      en_revision: '🔄 En révision',
      accepte: '✅ Accepté',
      en_attente_paiement: '💳 Attente paiement',
      paye: '💰 Payé',
      en_cours: '🚧 Travaux en cours',
      travaux_termines: '✅ Travaux terminés',
      termine_valide: '✔️ Validé',
      termine_auto_valide: '✔️ Auto-validé',
      litige: '⚠️ Litige',
      refuse: '❌ Refusé',
      expire: '⏰ Expiré',
      remplace: '🔄 Remplacé',
      annule: '🚫 Annulé',
    };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${styles[statut] || 'bg-gray-100 text-gray-800'}`}>
        {labels[statut] || statut}
      </span>
    );
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B00] mx-auto"></div>
          <p className="mt-4 text-[#6C757D]">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const filteredDevis = devis.filter(d => {
    if (filter === 'tous') return true;
    if (filter === 'en_attente') return d.statut === 'envoye';
    if (filter === 'acceptes') return isDevisAccepte(d.statut);
    if (filter === 'payes') return isDevisPaye(d.statut);
    if (filter === 'refuses') return ['refuse', 'expire', 'annule'].includes(d.statut);
    return true;
  });

  const devisEnAttente = devis.filter(d => d.statut === 'envoye');
  const devisAcceptes = devis.filter(d => isDevisAccepte(d.statut));
  const devisPayes = devis.filter(d => isDevisPaye(d.statut));
  const devisRefuses = devis.filter(d => ['refuse', 'expire', 'annule'].includes(d.statut));
  const totalDevis = devis.length; // Total tous devis visibles (hors brouillons)

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      {/* Header */}
      <div className="bg-[#2C3E50] text-white py-8">
        <div className="container mx-auto px-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-white hover:text-[#FF6B00] mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Retour au tableau de bord
          </button>
          <h1 className="text-3xl font-bold">Mes Devis Reçus</h1>
          <p className="text-gray-300 mt-2">Consultez et gérez vos devis</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Filtres */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('tous')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'tous'
                  ? 'bg-[#FF6B00] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📋 Tous ({totalDevis})
            </button>
            <button
              onClick={() => setFilter('en_attente')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'en_attente'
                  ? 'bg-[#FF6B00] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🆕 Nouveaux ({devisEnAttente.length})
            </button>
            <button
              onClick={() => setFilter('acceptes')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'acceptes'
                  ? 'bg-[#FF6B00] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ✅ Acceptés / En attente ({devisAcceptes.length})
            </button>
            <button
              onClick={() => setFilter('payes')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'payes'
                  ? 'bg-[#FF6B00] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              💰 Payés ({devisPayes.length})
            </button>
            <button
              onClick={() => setFilter('refuses')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'refuses'
                  ? 'bg-[#FF6B00] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ❌ Refusés/Expirés ({devisRefuses.length})
            </button>
          </div>
        </div>

        {/* Liste des devis */}
        {filteredDevis.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-600 mb-4">Aucun devis pour le moment</p>
            <Link href="/client/demandes">
              <button className="bg-[#FF6B00] text-white px-6 py-2 rounded-lg hover:bg-[#E56100]">
                Voir mes demandes
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredDevis.map((d) => {
              const demande = d.demandeId ? demandes.get(d.demandeId) : undefined;
              return (
                <div key={d.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-[#2C3E50]">
                          {d.titre}
                        </h3>
                        {getStatutBadge(d.statut)}
                      </div>
                      {demande && (
                        <p className="text-sm text-gray-600 mb-2">
                          📋 Demande : {demande.titre || demande.categorie}
                        </p>
                      )}
                      <p className="text-sm text-gray-600">
                        👷 Artisan : {d.artisan.prenom} {d.artisan.nom}
                        {d.artisan.raisonSociale && ` - ${d.artisan.raisonSociale}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-[#FF6B00]">
                        {d.totaux.totalTTC.toFixed(2)} €
                      </div>
                      <div className="text-xs text-gray-500">TTC</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                    <div>
                      <span className="text-gray-500">N° Devis :</span>
                      <p className="font-semibold">{d.numeroDevis}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Date :</span>
                      <p className="font-semibold">
                        {d.dateCreation?.toDate().toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Valide jusqu'au :</span>
                      <p className="font-semibold">
                        {d.dateValidite?.toDate().toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Délai :</span>
                      <p className="font-semibold">{d.delaiRealisation || 'Non précisé'}</p>
                    </div>
                  </div>

                  {/* Boutons d'action */}
                  <div className="flex gap-3 pt-4 border-t">
                    {/* Devis envoyé : Voir détail + Accepter + Refuser */}
                    {d.statut === 'envoye' && (
                      <>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            const targetUrl = `/client/devis/${d.id}?returnFilter=${filter}`;
                            console.log('🔗 Navigation vers:', targetUrl);
                            router.push(targetUrl);
                          }}
                          className="flex-1 bg-[#2C3E50] text-white px-4 py-2 rounded-lg hover:bg-[#1A3A5C] transition text-center font-medium cursor-pointer"
                        >
                          📄 Voir le détail
                        </div>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/client/devis/${d.id}?action=accepter&returnFilter=${filter}`);
                          }}
                          className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-center font-medium cursor-pointer"
                        >
                          ✅ Accepter
                        </div>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/client/devis/${d.id}?action=refuser&returnFilter=${filter}`);
                          }}
                          className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition text-center font-medium cursor-pointer"
                        >
                          ❌ Refuser
                        </div>
                      </>
                    )}

                    {/* Devis accepté/en attente paiement : Procéder au paiement + Annuler + Voir le détail */}
                    {(d.statut === 'accepte' || d.statut === 'en_attente_paiement') && (
                      <>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/client/devis/${d.id}?action=payer&returnFilter=${filter}`);
                          }}
                          className="flex-1 bg-[#FF6B00] text-white px-4 py-2 rounded-lg hover:bg-[#E56100] transition font-medium"
                        >
                          💳 Procéder au paiement
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const nomArtisan = d.artisan.raisonSociale || `${d.artisan.prenom} ${d.artisan.nom}`;
                            handleAnnulerDevis(d.id, d.numeroDevis, d.totaux.totalTTC, nomArtisan);
                          }}
                          className="flex-1 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition font-medium"
                        >
                          🚫 Annuler
                        </button>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/client/devis/${d.id}?returnFilter=${filter}`);
                          }}
                          className="flex-1 bg-[#2C3E50] text-white px-4 py-2 rounded-lg hover:bg-[#1A3A5C] transition text-center font-medium cursor-pointer"
                        >
                          📄 Voir le détail
                        </div>
                      </>
                    )}

                    {/* Devis payé / en cours / terminés : Badge statut + Voir le détail uniquement */}
                    {(isDevisPaye(d.statut)) && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const targetUrl = `/client/devis/${d.id}?returnFilter=${filter}`;
                          console.log('🔗 Navigation vers:', targetUrl);
                          router.push(targetUrl);
                        }}
                        className="flex-1 bg-[#2C3E50] text-white px-4 py-2 rounded-lg hover:bg-[#1A3A5C] transition text-center font-medium cursor-pointer"
                      >
                        📄 Voir le détail
                      </div>
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
