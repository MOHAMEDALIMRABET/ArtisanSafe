'use client';

/**
 * Dashboard Admin - Gestion et Vérification des Artisans
 * Page: /admin/verifications
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/lib/auth-service';
import { getAllArtisansForAdmin } from '@/lib/firebase/artisan-service';
import { validateDocument, rejectDocument } from '@/lib/firebase/verification-service';
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
  
  // État pour les actions
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectDocType, setRejectDocType] = useState<'kbis' | 'idCard' | null>(null);
  const [rejectReason, setRejectReason] = useState('');

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

  const handleValidateDocument = async (documentType: 'kbis' | 'idCard') => {
    if (!selectedArtisan) return;
    
    const confirmed = window.confirm(
      `Êtes-vous sûr de vouloir valider le document ${documentType === 'kbis' ? 'KBIS' : 'Pièce d\'identité'} ?`
    );
    
    if (!confirmed) return;
    
    setActionLoading(true);
    try {
      const adminId = authService.getCurrentUser()?.uid || 'admin';
      const result = await validateDocument(selectedArtisan.userId, documentType, adminId);
      
      if (result.success) {
        alert('Document validé avec succès !');
        // Recharger les données
        await loadArtisans();
        // Recharger l'artisan sélectionné
        const updatedArtisans = await getAllArtisansForAdmin();
        const updatedArtisan = updatedArtisans.find(a => a.userId === selectedArtisan.userId);
        if (updatedArtisan) {
          setSelectedArtisan(updatedArtisan);
        }
      } else {
        alert('Erreur: ' + (result.error || 'Échec de la validation'));
      }
    } catch (error) {
      console.error('Erreur validation:', error);
      alert('Une erreur est survenue lors de la validation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectDocument = (documentType: 'kbis' | 'idCard') => {
    setRejectDocType(documentType);
    setRejectReason('');
    setShowRejectDialog(true);
  };

  const confirmRejectDocument = async () => {
    if (!selectedArtisan || !rejectDocType || !rejectReason.trim()) {
      alert('Veuillez saisir une raison de rejet');
      return;
    }
    
    setActionLoading(true);
    try {
      const adminId = authService.getCurrentUser()?.uid || 'admin';
      const result = await rejectDocument(selectedArtisan.userId, rejectDocType, adminId, rejectReason);
      
      if (result.success) {
        alert('Document rejeté avec succès !');
        setShowRejectDialog(false);
        setRejectReason('');
        setRejectDocType(null);
        // Recharger les données
        await loadArtisans();
        // Recharger l'artisan sélectionné
        const updatedArtisans = await getAllArtisansForAdmin();
        const updatedArtisan = updatedArtisans.find(a => a.userId === selectedArtisan.userId);
        if (updatedArtisan) {
          setSelectedArtisan(updatedArtisan);
        }
      } else {
        alert('Erreur: ' + (result.error || 'Échec du rejet'));
      }
    } catch (error) {
      console.error('Erreur rejet:', error);
      alert('Une erreur est survenue lors du rejet');
    } finally {
      setActionLoading(false);
    }
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

      {/* Modal de détail complet */}
      {showModal && selectedArtisan && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto"
          onClick={() => setShowModal(false)}
        >
          <div 
            className="bg-white rounded-lg w-full max-w-6xl my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header du modal */}
            <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center bg-[#2C3E50] text-white rounded-t-lg">
              <div>
                <h2 className="text-2xl font-bold">
                  {selectedArtisan.nom} {selectedArtisan.prenom}
                </h2>
                <p className="text-gray-300 text-sm mt-1">{selectedArtisan.email}</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-white hover:text-gray-300 text-3xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6 max-h-[80vh] overflow-y-auto">
              {/* Grid à 2 colonnes */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Colonne 1: Informations Artisan & Entreprise */}
                <div className="space-y-6">
                  
                  {/* Informations Artisan */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      👤 Informations Artisan
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-500 uppercase">Nom complet</label>
                        <p className="text-gray-900 font-medium">{selectedArtisan.nom} {selectedArtisan.prenom}</p>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 uppercase">Email</label>
                        <p className="text-gray-900">{selectedArtisan.email}</p>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 uppercase">Téléphone</label>
                        <p className="text-gray-900">{selectedArtisan.telephone || '-'}</p>
                        {selectedArtisan.telephoneVerified && (
                          <span className="text-xs text-green-600 ml-2">✓ Vérifié</span>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 uppercase">Adresse</label>
                        <p className="text-gray-900">{selectedArtisan.adresse || '-'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Informations Entreprise */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      🏢 Informations Entreprise
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-500 uppercase">SIRET</label>
                        <p className="text-gray-900 font-mono">{selectedArtisan.siret}</p>
                        {selectedArtisan.siretVerified && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full inline-block mt-1">
                            ✓ Vérifié SIRENE
                          </span>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 uppercase">Raison sociale</label>
                        <p className="text-gray-900">{selectedArtisan.raisonSociale || '-'}</p>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 uppercase">Forme juridique</label>
                        <p className="text-gray-900">{selectedArtisan.formeJuridique || '-'}</p>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 uppercase">Métiers</label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {selectedArtisan.metiers?.map((metier, idx) => (
                            <span 
                              key={idx}
                              className="bg-[#FF6B00] text-white px-3 py-1 rounded-full text-sm"
                            >
                              {metier}
                            </span>
                          )) || <span className="text-gray-500">Aucun métier</span>}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 uppercase">Inscription</label>
                        <p className="text-gray-900 text-sm">
                          {selectedArtisan.dateInscription 
                            ? new Date(selectedArtisan.dateInscription.toDate()).toLocaleDateString('fr-FR')
                            : '-'
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Colonne 2: Documents */}
                <div className="space-y-6">
                  
                  {/* Document KBIS */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-100 px-4 py-3 flex justify-between items-center">
                      <h3 className="font-semibold text-gray-900 flex items-center">
                        📄 KBIS
                      </h3>
                      {getStatusBadge(getDocumentStatus(selectedArtisan.verificationDocuments?.kbis))}
                    </div>
                    
                    <div className="p-4">
                      {selectedArtisan.verificationDocuments?.kbis?.url ? (
                        <>
                          {/* Aperçu du document */}
                          <div className="mb-4 bg-gray-50 rounded-lg overflow-hidden">
                            {selectedArtisan.verificationDocuments.kbis.url.toLowerCase().endsWith('.pdf') ? (
                              <iframe
                                src={selectedArtisan.verificationDocuments.kbis.url}
                                className="w-full h-64 border-0"
                                title="KBIS PDF"
                              />
                            ) : (
                              <img
                                src={selectedArtisan.verificationDocuments.kbis.url}
                                alt="KBIS"
                                className="w-full h-64 object-contain"
                              />
                            )}
                          </div>

                          {/* Informations du document */}
                          <div className="space-y-2 mb-4 text-sm">
                            <div>
                              <label className="text-xs text-gray-500 uppercase">Date d'upload</label>
                              <p className="text-gray-900">
                                {selectedArtisan.verificationDocuments.kbis.uploadDate
                                  ? new Date(selectedArtisan.verificationDocuments.kbis.uploadDate.toDate()).toLocaleDateString('fr-FR', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })
                                  : '-'
                                }
                              </p>
                            </div>
                            
                            {selectedArtisan.verificationDocuments.kbis.parsedData && (
                              <div>
                                <label className="text-xs text-gray-500 uppercase">Données extraites</label>
                                <div className="bg-white border border-gray-200 rounded p-2 mt-1">
                                  <p className="text-xs text-gray-700">
                                    SIRET: {selectedArtisan.verificationDocuments.kbis.parsedData.siret || '-'}
                                  </p>
                                  <p className="text-xs text-gray-700">
                                    Raison sociale: {selectedArtisan.verificationDocuments.kbis.parsedData.raisonSociale || '-'}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Boutons d'action */}
                          {!selectedArtisan.verificationDocuments.kbis.verified && !selectedArtisan.verificationDocuments.kbis.rejected && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleValidateDocument('kbis')}
                                disabled={actionLoading}
                                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {actionLoading ? '⏳ Validation...' : '✓ Valider'}
                              </button>
                              <button
                                onClick={() => handleRejectDocument('kbis')}
                                disabled={actionLoading}
                                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                ✕ Rejeter
                              </button>
                            </div>
                          )}

                          {/* Message si validé */}
                          {selectedArtisan.verificationDocuments.kbis.verified && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                              <p className="text-green-800 font-medium">✓ Document validé</p>
                              <p className="text-green-600 text-xs mt-1">
                                Le {selectedArtisan.verificationDocuments.kbis.validatedAt
                                  ? new Date(selectedArtisan.verificationDocuments.kbis.validatedAt.toDate()).toLocaleDateString('fr-FR')
                                  : '-'
                                }
                              </p>
                            </div>
                          )}

                          {/* Message si rejeté */}
                          {selectedArtisan.verificationDocuments.kbis.rejected && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                              <p className="text-red-800 font-medium">✕ Document rejeté</p>
                              <p className="text-red-600 text-xs mt-1">
                                Raison: {selectedArtisan.verificationDocuments.kbis.rejectionReason || 'Non spécifiée'}
                              </p>
                            </div>
                          )}

                          {/* Lien d'ouverture */}
                          <a
                            href={selectedArtisan.verificationDocuments.kbis.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-center text-[#FF6B00] hover:underline text-sm mt-2"
                          >
                            Ouvrir dans un nouvel onglet →
                          </a>
                        </>
                      ) : (
                        <p className="text-gray-500 text-center py-8">Document non uploadé</p>
                      )}
                    </div>
                  </div>

                  {/* Document Pièce d'identité */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-100 px-4 py-3 flex justify-between items-center">
                      <h3 className="font-semibold text-gray-900 flex items-center">
                        🪪 Pièce d'identité
                      </h3>
                      {getStatusBadge(getDocumentStatus(selectedArtisan.verificationDocuments?.idCard))}
                    </div>
                    
                    <div className="p-4">
                      {selectedArtisan.verificationDocuments?.idCard?.url ? (
                        <>
                          {/* Aperçu du document */}
                          <div className="mb-4 bg-gray-50 rounded-lg overflow-hidden">
                            {selectedArtisan.verificationDocuments.idCard.url.toLowerCase().endsWith('.pdf') ? (
                              <iframe
                                src={selectedArtisan.verificationDocuments.idCard.url}
                                className="w-full h-64 border-0"
                                title="Pièce d'identité PDF"
                              />
                            ) : (
                              <img
                                src={selectedArtisan.verificationDocuments.idCard.url}
                                alt="Pièce d'identité"
                                className="w-full h-64 object-contain"
                              />
                            )}
                          </div>

                          {/* Informations du document */}
                          <div className="space-y-2 mb-4 text-sm">
                            <div>
                              <label className="text-xs text-gray-500 uppercase">Date d'upload</label>
                              <p className="text-gray-900">
                                {selectedArtisan.verificationDocuments.idCard.uploadDate
                                  ? new Date(selectedArtisan.verificationDocuments.idCard.uploadDate.toDate()).toLocaleDateString('fr-FR', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })
                                  : '-'
                                }
                              </p>
                            </div>
                            
                            {selectedArtisan.verificationDocuments.idCard.parsedData && (
                              <div>
                                <label className="text-xs text-gray-500 uppercase">Données extraites</label>
                                <div className="bg-white border border-gray-200 rounded p-2 mt-1">
                                  <p className="text-xs text-gray-700">
                                    Nom: {selectedArtisan.verificationDocuments.idCard.parsedData.nom || '-'}
                                  </p>
                                  <p className="text-xs text-gray-700">
                                    Prénom: {selectedArtisan.verificationDocuments.idCard.parsedData.prenom || '-'}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Boutons d'action */}
                          {!selectedArtisan.verificationDocuments.idCard.verified && !selectedArtisan.verificationDocuments.idCard.rejected && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleValidateDocument('idCard')}
                                disabled={actionLoading}
                                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {actionLoading ? '⏳ Validation...' : '✓ Valider'}
                              </button>
                              <button
                                onClick={() => handleRejectDocument('idCard')}
                                disabled={actionLoading}
                                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                ✕ Rejeter
                              </button>
                            </div>
                          )}

                          {/* Message si validé */}
                          {selectedArtisan.verificationDocuments.idCard.verified && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                              <p className="text-green-800 font-medium">✓ Document validé</p>
                              <p className="text-green-600 text-xs mt-1">
                                Le {selectedArtisan.verificationDocuments.idCard.validatedAt
                                  ? new Date(selectedArtisan.verificationDocuments.idCard.validatedAt.toDate()).toLocaleDateString('fr-FR')
                                  : '-'
                                }
                              </p>
                            </div>
                          )}

                          {/* Message si rejeté */}
                          {selectedArtisan.verificationDocuments.idCard.rejected && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                              <p className="text-red-800 font-medium">✕ Document rejeté</p>
                              <p className="text-red-600 text-xs mt-1">
                                Raison: {selectedArtisan.verificationDocuments.idCard.rejectionReason || 'Non spécifiée'}
                              </p>
                            </div>
                          )}

                          {/* Lien d'ouverture */}
                          <a
                            href={selectedArtisan.verificationDocuments.idCard.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-center text-[#FF6B00] hover:underline text-sm mt-2"
                          >
                            Ouvrir dans un nouvel onglet →
                          </a>
                        </>
                      ) : (
                        <p className="text-gray-500 text-center py-8">Document non uploadé</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer du modal */}
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-lg">
              <button
                onClick={() => setShowModal(false)}
                className="w-full bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition font-medium"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialogue de rejet */}
      {showRejectDialog && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]"
          onClick={() => setShowRejectDialog(false)}
        >
          <div 
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Rejeter le document {rejectDocType === 'kbis' ? 'KBIS' : 'Pièce d\'identité'}
            </h3>
            
            <p className="text-gray-600 text-sm mb-4">
              Veuillez indiquer la raison du rejet. Cette information sera communiquée à l'artisan.
            </p>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ex: Document illisible, informations manquantes, document expiré..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent resize-none"
              rows={4}
            />

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowRejectDialog(false);
                  setRejectReason('');
                }}
                disabled={actionLoading}
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition font-medium disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={confirmRejectDocument}
                disabled={actionLoading || !rejectReason.trim()}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? '⏳ Rejet...' : '✕ Confirmer le rejet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
