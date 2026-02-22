'use client';

/**
 * Page de consultation des devis reçus par le client
 * Affiche tous les devis groupés par demande
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
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
  const { t } = useLanguage();
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
      `⚠️ ${t('quotes.cancelQuoteWarningTitle')}\n\n` +
      `${t('quotes.quoteNumber')} : ${numeroDevis}\n` +
      `${t('quotes.craftsman')} : ${nomArtisan}\n` +
      `${t('quotes.amount')} : ${montantTTC.toFixed(2)}€ ${t('quotes.ttc')}\n\n` +
      t('quotes.cancelQuoteWarningMessage')
    );

    if (!confirmAnnulation) return;

    try {
      await annulerDevisParClient(devisId, user.uid, 'Client désisté avant paiement');
      alert(
        `✅ ${t('quotes.cancelQuoteSuccessTitle')}\n\n` +
        t('quotes.cancelQuoteSuccessMessage').replace('{{artisanName}}', nomArtisan)
      );
      await loadDevis(); // Recharger la liste
    } catch (error: any) {
      console.error('Erreur annulation devis:', error);
      alert(`❌ ${t('quotes.cancelQuoteError')} : ${error.message || t('common.unknownError')}`);
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
      genere: `📝 ${t('quotes.draft')}`,
      envoye: `🆕 ${t('quotes.new')}`,
      en_revision: `🔄 ${t('quotes.inRevision')}`,
      accepte: `✅ ${t('quotes.accepted')}`,
      en_attente_paiement: `💳 ${t('quotes.waitingPayment')}`,
      paye: `💰 ${t('quotes.paid')}`,
      en_cours: `🚧 ${t('quotes.inProgress')}`,
      travaux_termines: `✅ ${t('quotes.worksCompleted')}`,
      termine_valide: `✔️ ${t('quotes.validated')}`,
      termine_auto_valide: `✔️ ${t('quotes.autoValidated')}`,
      litige: `⚠️ ${t('quotes.dispute')}`,
      refuse: `❌ ${t('quotes.refused')}`,
      expire: `⏰ ${t('quotes.expired')}`,
      remplace: `🔄 ${t('quotes.replaced')}`,
      annule: `🚫 ${t('quotes.cancelled')}`,
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
          <p className="mt-4 text-[#6C757D]">{t('quotes.loading')}</p>
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
            {t('quotes.backToDashboard')}
          </button>
          <h1 className="text-3xl font-bold">{t('quotes.myReceivedQuotes')}</h1>
          <p className="text-gray-300 mt-2">{t('quotes.consultManage')}</p>
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
              📋 {t('quotes.all')} ({totalDevis})
            </button>
            <button
              onClick={() => setFilter('en_attente')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'en_attente'
                  ? 'bg-[#FF6B00] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🆕 {t('quotes.newPlural')} ({devisEnAttente.length})
            </button>
            <button
              onClick={() => setFilter('acceptes')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'acceptes'
                  ? 'bg-[#FF6B00] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ✅ {t('quotes.acceptedPending')} ({devisAcceptes.length})
            </button>
            <button
              onClick={() => setFilter('payes')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'payes'
                  ? 'bg-[#FF6B00] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              💰 {t('quotes.paidPlural')} ({devisPayes.length})
            </button>
            <button
              onClick={() => setFilter('refuses')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'refuses'
                  ? 'bg-[#FF6B00] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ❌ {t('quotes.refusedExpired')} ({devisRefuses.length})
            </button>
          </div>
        </div>

        {/* Liste des devis */}
        {filteredDevis.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-600 mb-4">{t('quotes.noQuotesYet')}</p>
            <Link href="/client/demandes">
              <button className="bg-[#FF6B00] text-white px-6 py-2 rounded-lg hover:bg-[#E56100]">
                {t('quotes.viewMyRequests')}
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
                          📋 {t('quotes.request')} : {demande.titre || demande.categorie}
                        </p>
                      )}
                      <p className="text-sm text-gray-600">
                        👷 {t('quotes.craftsman')} : {d.artisan.prenom} {d.artisan.nom}
                        {d.artisan.raisonSociale && ` - ${d.artisan.raisonSociale}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-[#FF6B00]">
                        {d.totaux.totalTTC.toFixed(2)} €
                      </div>
                      <div className="text-xs text-gray-500">{t('quotes.ttc')}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                    <div>
                      <span className="text-gray-500">{t('quotes.quoteNumber')} :</span>
                      <p className="font-semibold">{d.numeroDevis}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">{t('quotes.date')} :</span>
                      <p className="font-semibold">
                        {d.dateCreation?.toDate().toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">{t('quotes.validUntil')} :</span>
                      <p className="font-semibold">
                        {d.dateValidite?.toDate().toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">{t('quotes.deadline')} :</span>
                      <p className="font-semibold">{d.delaiRealisation || t('quotes.notSpecified')}</p>
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
                          📄 {t('quotes.viewDetails')}
                        </div>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/client/devis/${d.id}?action=accepter&returnFilter=${filter}`);
                          }}
                          className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-center font-medium cursor-pointer"
                        >
                          ✅ {t('quotes.accept')}
                        </div>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/client/devis/${d.id}?action=refuser&returnFilter=${filter}`);
                          }}
                          className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition text-center font-medium cursor-pointer"
                        >
                          ❌ {t('quotes.refuse')}
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
                          💳 {t('quotes.proceedPayment')}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const nomArtisan = d.artisan.raisonSociale || `${d.artisan.prenom} ${d.artisan.nom}`;
                            handleAnnulerDevis(d.id, d.numeroDevis, d.totaux.totalTTC, nomArtisan);
                          }}
                          className="flex-1 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition font-medium"
                        >
                          🚫 {t('quotes.cancel')}
                        </button>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/client/devis/${d.id}?returnFilter=${filter}`);
                          }}
                          className="flex-1 bg-[#2C3E50] text-white px-4 py-2 rounded-lg hover:bg-[#1A3A5C] transition text-center font-medium cursor-pointer"
                        >
                          📄 {t('quotes.viewDetails')}
                        </div>
                      </>
                    )}

                    {/* Devis payé (en attente démarrage) ou en cours : Signaler + Voir le détail */}
                    {(d.statut === 'paye' || d.statut === 'en_cours') && (
                      <>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/client/devis/${d.id}?action=contester&returnFilter=${filter}`);
                          }}
                          className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition text-center font-medium cursor-pointer"
                        >
                          ⚠️ Signaler un problème
                        </div>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/client/devis/${d.id}?returnFilter=${filter}`);
                          }}
                          className="flex-1 bg-[#2C3E50] text-white px-4 py-2 rounded-lg hover:bg-[#1A3A5C] transition text-center font-medium cursor-pointer"
                        >
                          📄 {t('quotes.viewDetails')}
                        </div>
                      </>
                    )}

                    {/* Travaux terminés : Valider + Contester + Voir le détail */}
                    {d.statut === 'travaux_termines' && (
                      <>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/client/devis/${d.id}?action=valider&returnFilter=${filter}`);
                          }}
                          className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-center font-medium cursor-pointer"
                        >
                          ✅ Valider les travaux
                        </div>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/client/devis/${d.id}?action=contester&returnFilter=${filter}`);
                          }}
                          className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition text-center font-medium cursor-pointer"
                        >
                          ⚠️ Contester
                        </div>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/client/devis/${d.id}?returnFilter=${filter}`);
                          }}
                          className="px-4 py-2 border-2 border-[#2C3E50] text-[#2C3E50] rounded-lg hover:bg-[#2C3E50] hover:text-white transition text-center font-medium cursor-pointer"
                        >
                          📄 {t('quotes.viewDetails')}
                        </div>
                      </>
                    )}

                    {/* Travaux validés : bouton avis + Voir le détail */}
                    {['termine_valide', 'termine_auto_valide'].includes(d.statut) && (
                      <>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/client/avis/nouveau/${d.id}`);
                          }}
                          className="flex-1 bg-[#FF6B00] text-white px-4 py-2 rounded-lg hover:bg-[#E56100] transition text-center font-medium cursor-pointer"
                        >
                          ⭐ Donner mon avis
                        </div>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/client/devis/${d.id}?returnFilter=${filter}`);
                          }}
                          className="flex-1 bg-[#2C3E50] text-white px-4 py-2 rounded-lg hover:bg-[#1A3A5C] transition text-center font-medium cursor-pointer"
                        >
                          📄 {t('quotes.viewDetails')}
                        </div>
                      </>
                    )}

                    {/* Autres statuts payés (litige) : Voir le détail uniquement */}
                    {isDevisPaye(d.statut) && !['paye', 'en_cours', 'travaux_termines', 'termine_valide', 'termine_auto_valide'].includes(d.statut) && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const targetUrl = `/client/devis/${d.id}?returnFilter=${filter}`;
                          router.push(targetUrl);
                        }}
                        className="flex-1 bg-[#2C3E50] text-white px-4 py-2 rounded-lg hover:bg-[#1A3A5C] transition text-center font-medium cursor-pointer"
                      >
                        📄 {t('quotes.viewDetails')}
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
