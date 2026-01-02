'use client';

/**
 * Dashboard Admin - Gestion et Vérification des Artisans
 * Page: /admin/verifications
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/lib/auth-service';
import { getAllArtisansForAdmin } from '@/lib/firebase/artisan-service';
import type { Artisan } from '@/types/firestore';

type FilterType = 'all' | 'pending' | 'verified' | 'rejected';

export default function AdminVerificationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [artisans, setArtisans] = useState<Artisan[]>([]);
  const [filteredArtisans, setFilteredArtisans] = useState<Artisan[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal de détail
  const [selectedArtisan, setSelectedArtisan] = useState<Artisan | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    checkAdminAndLoad();
  }, []);

  const checkAdminAndLoad = async () => {
    try {
      const user = authService.getCurrentUser();
      if (!user) {
        router.push('/admin/login');
        return;
      }

      // TODO: Vérifier que c'est un admin
      await loadArtisans();
    } catch (error) {
      console.error('Erreur:', error);
      setLoading(false);
    }
  };

  const loadArtisans = async () => {
    try {
      const data = await getAllArtisansForAdmin();
      setArtisans(data);
      applyFilters(selectedFilter, searchTerm, data);
    } catch (error) {
      console.error('Erreur chargement artisans:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (filter: FilterType, search: string, data: Artisan[]) => {
    let filtered = data;

    // Filtre par statut
    if (filter === 'pending') {
      filtered = filtered.filter(a => {
        const kbisPending = !!a.verificationDocuments?.kbis?.url && !a.verificationDocuments?.kbis?.verified;
        const idPending = !!a.verificationDocuments?.idCard?.url && !a.verificationDocuments?.idCard?.verified;
        return kbisPending || idPending;
      });
    } else if (filter === 'verified') {
      filtered = filtered.filter(a => 
        a.verificationDocuments?.kbis?.verified && a.verificationDocuments?.idCard?.verified
      );
    } else if (filter === 'rejected') {
      filtered = filtered.filter(a => 
        a.verificationDocuments?.kbis?.rejected || a.verificationDocuments?.idCard?.rejected
      );
    }

    // Recherche
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(a => 
        a.nom?.toLowerCase().includes(searchLower) ||
        a.prenom?.toLowerCase().includes(searchLower) ||
        a.siret?.includes(search) ||
        a.raisonSociale?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredArtisans(filtered);
  };

  const handleFilterChange = (filter: FilterType) => {
    setSelectedFilter(filter);
    applyFilters(filter, searchTerm, artisans);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    applyFilters(selectedFilter, value, artisans);
  };

  const getDocumentStatus = (doc: any): 'missing' | 'pending' | 'verified' | 'rejected' => {
    if (!doc?.url) return 'missing';
    if (doc.rejected) return 'rejected';
    if (doc.verified) return 'verified';
    return 'pending';
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      missing: <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full">📄 Manquant</span>,
      pending: <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">⏳ En attente</span>,
      verified: <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">✅ Vérifié</span>,
      rejected: <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">❌ Rejeté</span>,
    };
    return badges[status as keyof typeof badges] || badges.missing;
  };

  const pendingCount = artisans.filter(a => {
    const kbisPending = !!a.verificationDocuments?.kbis?.url && !a.verificationDocuments?.kbis?.verified;
    const idPending = !!a.verificationDocuments?.idCard?.url && !a.verificationDocuments?.idCard?.verified;
    return kbisPending || idPending;
  }).length;

  const verifiedCount = artisans.filter(a => 
    a.verificationDocuments?.kbis?.verified && a.verificationDocuments?.idCard?.verified
  ).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B00] mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Gestion des Artisans</h1>
          <p className="text-gray-600 mt-2">Vérification et validation des documents</p>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-wrap gap-3 mb-4">
            <button
              onClick={() => handleFilterChange('all')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                selectedFilter === 'all'
                  ? 'bg-[#FF6B00] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tous ({artisans.length})
            </button>
            <button
              onClick={() => handleFilterChange('pending')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                selectedFilter === 'pending'
                  ? 'bg-[#FF6B00] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ⏳ En attente ({pendingCount})
            </button>
            <button
              onClick={() => handleFilterChange('verified')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                selectedFilter === 'verified'
                  ? 'bg-[#FF6B00] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ✅ Vérifiés ({verifiedCount})
            </button>
            <button
              onClick={() => handleFilterChange('rejected')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                selectedFilter === 'rejected'
                  ? 'bg-[#FF6B00] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ❌ Rejetés
            </button>
          </div>

          {/* Recherche */}
          <input
            type="text"
            placeholder="Rechercher par nom, SIRET, entreprise..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
          />
        </div>

        {/* Tableau */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Artisan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Entreprise
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SIRET
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  KBIS
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pièce ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredArtisans.map((artisan) => {
                const kbisStatus = getDocumentStatus(artisan.verificationDocuments?.kbis);
                const idStatus = getDocumentStatus(artisan.verificationDocuments?.idCard);

                return (
                  <tr key={artisan.userId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="font-medium text-gray-900">
                          {artisan.nom} {artisan.prenom}
                        </div>
                        <div className="text-sm text-gray-500">{artisan.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{artisan.raisonSociale || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{artisan.siret}</div>
                      {artisan.siretVerified && (
                        <span className="text-xs text-green-600">✓ SIRENE</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(kbisStatus)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(idStatus)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => {
                          setSelectedArtisan(artisan);
                          setShowModal(true);
                        }}
                        className="text-[#FF6B00] hover:text-[#E56100]"
                      >
                        Voir détails
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredArtisans.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">Aucun artisan trouvé</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de détail - À implémenter dans la prochaine tâche */}
      {showModal && selectedArtisan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">
                {selectedArtisan.nom} {selectedArtisan.prenom}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <p className="text-gray-600">Détails complets à venir...</p>
            <button
              onClick={() => setShowModal(false)}
              className="mt-4 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
