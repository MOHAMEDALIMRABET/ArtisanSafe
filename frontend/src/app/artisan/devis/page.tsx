'use client';

/**
 * Page de gestion des devis et factures de l'artisan
 * Affiche tous les devis avec leurs statuts et permet la gestion
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Devis } from '@/types/devis';

type TabType = 'devis' | 'factures';

export default function MesDevisPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('devis');
  const [devis, setDevis] = useState<Devis[]>([]);
  const [loading, setLoading] = useState(true);

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
      const q = query(
        collection(db, 'devis'),
        where('artisanId', '==', user.uid)
      );

      const querySnapshot = await getDocs(q);
      const devisData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Devis));

      // Trier par date de création décroissante
      devisData.sort((a, b) => {
        const dateA = a.dateCreation?.toMillis() || 0;
        const dateB = b.dateCreation?.toMillis() || 0;
        return dateB - dateA;
      });

      setDevis(devisData);
    } catch (error) {
      console.error('Erreur chargement devis:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatutBadge = (statut: string) => {
    const styles: { [key: string]: string } = {
      brouillon: 'bg-gray-100 text-gray-800',
      envoye: 'bg-blue-100 text-blue-800',
      accepte: 'bg-green-100 text-green-800',
      refuse: 'bg-red-100 text-red-800',
      expire: 'bg-orange-100 text-orange-800',
    };

    const labels: { [key: string]: string } = {
      brouillon: '📝 Brouillon',
      envoye: '📤 Envoyé',
      accepte: '✅ Accepté',
      refuse: '❌ Refusé',
      expire: '⏰ Expiré',
    };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${styles[statut] || 'bg-gray-100 text-gray-800'}`}>
        {labels[statut] || statut}
      </span>
    );
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
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

  const devisBrouillon = devis.filter(d => d.statut === 'brouillon');
  const devisEnvoyes = devis.filter(d => d.statut === 'envoye');
  const devisAcceptes = devis.filter(d => d.statut === 'accepte');
  const devisRefuses = devis.filter(d => d.statut === 'refuse');
  const devisRevisionDemandee = devis.filter(d => d.statut === 'refuse' && d.typeRefus === 'revision');

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Header */}
      <div className="bg-[#2C3E50] text-white py-8">
        <div className="container mx-auto px-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-white hover:text-[#FF6B00] mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Retour au tableau de bord
          </button>
          <h1 className="text-3xl font-bold">Mes Devis - Mes Factures</h1>
          <p className="text-gray-300 mt-2">Gérez vos devis et factures</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('devis')}
              className={`flex-1 px-6 py-4 font-semibold ${
                activeTab === 'devis'
                  ? 'text-[#FF6B00] border-b-2 border-[#FF6B00]'
                  : 'text-gray-600 hover:text-[#FF6B00]'
              }`}
            >
              📋 Devis ({devis.length})
            </button>
            <button
              onClick={() => setActiveTab('factures')}
              className={`flex-1 px-6 py-4 font-semibold ${
                activeTab === 'factures'
                  ? 'text-[#FF6B00] border-b-2 border-[#FF6B00]'
                  : 'text-gray-600 hover:text-[#FF6B00]'
              }`}
            >
              🧾 Factures (0)
            </button>
          </div>
        </div>

        {/* Statistiques rapides */}
        {activeTab === 'devis' && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="text-2xl font-bold text-gray-600">{devisBrouillon.length}</div>
              <div className="text-sm text-gray-600">Brouillons</div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="text-2xl font-bold text-blue-600">{devisEnvoyes.length}</div>
              <div className="text-sm text-gray-600">Envoyés</div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="text-2xl font-bold text-green-600">{devisAcceptes.length}</div>
              <div className="text-sm text-gray-600">Acceptés</div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4 border-2 border-orange-400">
              <div className="text-2xl font-bold text-orange-600">{devisRevisionDemandee.length}</div>
              <div className="text-sm text-orange-700 font-semibold">🔄 Révisions</div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="text-2xl font-bold text-red-600">{devisRefuses.length}</div>
              <div className="text-sm text-gray-600">Refusés</div>
            </div>
          </div>
        )}

        {/* Liste des devis */}
        {activeTab === 'devis' && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {devis.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-600 mb-4">Aucun devis pour le moment</p>
                <button
                  onClick={() => router.push('/artisan/demandes')}
                  className="bg-[#FF6B00] text-white px-6 py-2 rounded-lg hover:bg-[#E56100]"
                >
                  Voir les demandes
                </button>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Numéro
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Titre
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Montant
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {devis.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#2C3E50]">
                        {d.numeroDevis}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {d.client.prenom} {d.client.nom}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {d.titre}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {d.totaux.totalTTC.toFixed(2)} €
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {d.statut === 'refuse' && d.typeRefus === 'revision' ? (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
                            🔄 Révision demandée
                          </span>
                        ) : (
                          getStatutBadge(d.statut)
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {d.dateCreation?.toDate().toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <button
                            onClick={() => router.push(`/artisan/devis/${d.id}`)}
                            className="text-[#FF6B00] hover:text-[#E56100]"
                          >
                            Voir
                          </button>
                          {d.statut === 'refuse' && d.typeRefus === 'revision' && d.demandeId && (
                            <button
                              onClick={() => router.push(`/artisan/devis/nouveau?demandeId=${d.demandeId}`)}
                              className="px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 text-xs font-semibold"
                            >
                              📝 Créer révision
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Section Factures (à venir) */}
        {activeTab === 'factures' && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Section Factures</h3>
            <p className="text-gray-600">La gestion des factures sera disponible prochainement</p>
          </div>
        )}
      </div>
    </div>
  );
}
