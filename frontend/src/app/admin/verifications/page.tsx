'use client';

/**
 * Dashboard Admin - Vérification des artisans
 * Page: /admin/verifications
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase/config';
import {
  getPendingVerifications,
  getArtisansWithPendingDocuments,
  approveArtisan,
  rejectArtisan,
  getVerificationStats,
  isAdmin,
} from '@/lib/firebase/admin-service';
import { AdminVerificationRequest } from '@/types/firestore';

type FilterType = 'all' | 'documents' | 'incomplete';

// Helper: Vérifier âge du KBIS (moins de 3 mois recommandé)
function isKbisRecent(uploadDate: Date): { isRecent: boolean; ageInDays: number } {
  const now = new Date();
  const diffMs = now.getTime() - uploadDate.getTime();
  const ageInDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const isRecent = ageInDays <= 90; // 3 mois = 90 jours
  return { isRecent, ageInDays };
}

export default function AdminVerificationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<AdminVerificationRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<AdminVerificationRequest[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('documents');
  
  // Modal de détails
  const [selectedArtisan, setSelectedArtisan] = useState<AdminVerificationRequest | null>(null);
  const [showModal, setShowModal] = useState(false);
  
  // Actions
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  
  // Stats
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    incomplete: 0,
  });

  // Vérification admin au chargement
  useEffect(() => {
    const checkAdmin = async () => {
      const user = auth.currentUser;
      
      if (!user) {
        router.push('/admin/login');
        return;
      }

      const adminStatus = await isAdmin(user.uid);
      
      if (!adminStatus) {
        alert('Accès refusé. Vous devez être administrateur.');
        router.push('/');
        return;
      }

      await loadData();
    };

    checkAdmin();
  }, [router]);

  // Chargement des données
  const loadData = async () => {
    setLoading(true);
    try {
      const [allRequests, statsData] = await Promise.all([
        getPendingVerifications(),
        getVerificationStats(),
      ]);

      setRequests(allRequests);
      setStats(statsData);
      applyFilter(selectedFilter, allRequests);
    } catch (error) {
      console.error('Erreur chargement données:', error);
      alert('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  // Filtrage
  const applyFilter = (filter: FilterType, data: AdminVerificationRequest[]) => {
    setSelectedFilter(filter);

    switch (filter) {
      case 'documents':
        // Artisans avec documents uploadés
        setFilteredRequests(
          data.filter(
            (r) =>
              r.verificationDocuments?.kbis?.url ||
              r.verificationDocuments?.idCard?.url
          )
        );
        break;
      case 'incomplete':
        // Artisans sans documents
        setFilteredRequests(
          data.filter(
            (r) =>
              !r.verificationDocuments?.kbis?.url &&
              !r.verificationDocuments?.idCard?.url
          )
        );
        break;
      case 'all':
      default:
        setFilteredRequests(data);
        break;
    }
  };

  // Ouvrir modal de détails
  const openDetailsModal = (artisan: AdminVerificationRequest) => {
    setSelectedArtisan(artisan);
    setShowModal(true);
  };

  // Fermer modal
  const closeModal = () => {
    setShowModal(false);
    setSelectedArtisan(null);
  };

  // Approuver artisan
  const handleApprove = async (
    artisan: AdminVerificationRequest,
    documentType: 'kbis' | 'idCard' | 'both'
  ) => {
    const user = auth.currentUser;
    if (!user) return;

    const confirm = window.confirm(
      `Approuver ${documentType === 'both' ? 'tous les documents' : documentType} de ${artisan.nomComplet} ?`
    );

    if (!confirm) return;

    setActionLoading(true);
    try {
      const result = await approveArtisan(
        artisan.artisanId,
        user.uid,
        user.email!,
        documentType
      );

      if (result.success) {
        alert('✅ Artisan approuvé avec succès!');
        closeModal();
        await loadData();
      } else {
        alert(`❌ Erreur: ${result.error}`);
      }
    } catch (error) {
      console.error('Erreur approbation:', error);
      alert('Erreur lors de l\'approbation');
    } finally {
      setActionLoading(false);
    }
  };

  // Ouvrir modal de rejet
  const openRejectModal = (artisan: AdminVerificationRequest) => {
    setSelectedArtisan(artisan);
    setRejectReason('');
    setShowRejectModal(true);
  };

  // Rejeter artisan
  const handleReject = async () => {
    if (!selectedArtisan || !rejectReason.trim()) {
      alert('Veuillez saisir une raison pour le rejet');
      return;
    }

    const user = auth.currentUser;
    if (!user) return;

    setActionLoading(true);
    try {
      const result = await rejectArtisan(
        selectedArtisan.artisanId,
        user.uid,
        user.email!,
        rejectReason,
        'both'
      );

      if (result.success) {
        alert('✅ Documents rejetés. L\'artisan sera notifié.');
        setShowRejectModal(false);
        closeModal();
        await loadData();
      } else {
        alert(`❌ Erreur: ${result.error}`);
      }
    } catch (error) {
      console.error('Erreur rejet:', error);
      alert('Erreur lors du rejet');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B00] mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#2C3E50] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Dashboard Admin</h1>
              <p className="text-gray-300 mt-1">Vérification des artisans</p>
            </div>
            <button
              onClick={() => router.push('/admin/dashboard')}
              className="bg-white text-[#2C3E50] px-4 py-2 rounded-lg hover:bg-gray-100"
            >
              ← Retour au tableau de bord
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Total</p>
            <p className="text-3xl font-bold text-[#2C3E50]">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">En attente</p>
            <p className="text-3xl font-bold text-[#FFC107]">{stats.pending}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Approuvés</p>
            <p className="text-3xl font-bold text-green-600">{stats.approved}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Rejetés</p>
            <p className="text-3xl font-bold text-red-600">{stats.rejected}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Incomplets</p>
            <p className="text-3xl font-bold text-gray-500">{stats.incomplete}</p>
          </div>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex gap-4">
            <button
              onClick={() => applyFilter('documents', requests)}
              className={`px-4 py-2 rounded-lg font-medium ${
                selectedFilter === 'documents'
                  ? 'bg-[#FF6B00] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📄 Avec documents ({requests.filter(r => r.verificationDocuments?.kbis?.url || r.verificationDocuments?.idCard?.url).length})
            </button>
            <button
              onClick={() => applyFilter('incomplete', requests)}
              className={`px-4 py-2 rounded-lg font-medium ${
                selectedFilter === 'incomplete'
                  ? 'bg-[#FF6B00] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ⏳ Incomplets ({requests.filter(r => !r.verificationDocuments?.kbis?.url && !r.verificationDocuments?.idCard?.url).length})
            </button>
            <button
              onClick={() => applyFilter('all', requests)}
              className={`px-4 py-2 rounded-lg font-medium ${
                selectedFilter === 'all'
                  ? 'bg-[#FF6B00] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tous ({requests.length})
            </button>
          </div>
        </div>

        {/* Liste des artisans */}
        {filteredRequests.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 text-lg">Aucun artisan à vérifier</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRequests.map((artisan) => (
              <div
                key={artisan.artisanId}
                className="bg-white rounded-lg shadow hover:shadow-lg transition p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Nom et entreprise */}
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-xl font-bold text-[#2C3E50]">
                        {artisan.nomComplet}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          artisan.verificationStatus === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : artisan.verificationStatus === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : artisan.verificationStatus === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {artisan.verificationStatus === 'pending' && '⏳ En attente'}
                        {artisan.verificationStatus === 'approved' && '✅ Approuvé'}
                        {artisan.verificationStatus === 'rejected' && '❌ Rejeté'}
                        {artisan.verificationStatus === 'incomplete' && '📝 Incomplet'}
                      </span>
                    </div>

                    {/* Entreprise */}
                    <p className="text-gray-700 font-medium mb-2">
                      {artisan.entreprise.nom} - {artisan.entreprise.formeJuridique}
                    </p>

                    {/* Infos contact */}
                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-4">
                      <div>
                        <span className="font-medium">Email:</span> {artisan.email}
                      </div>
                      <div>
                        <span className="font-medium">Tél:</span> {artisan.telephone}
                      </div>
                      <div>
                        <span className="font-medium">SIRET:</span> {artisan.entreprise.siret}
                      </div>
                      <div>
                        <span className="font-medium">Inscription:</span>{' '}
                        {artisan.dateInscription.toDate().toLocaleDateString('fr-FR')}
                      </div>
                    </div>

                    {/* Progression */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          Complétion
                        </span>
                        <span className="text-sm font-bold text-[#FF6B00]">
                          {artisan.completionPercentage}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-[#FF6B00] h-2 rounded-full transition-all"
                          style={{ width: `${artisan.completionPercentage}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Checklist rapide */}
                    <div className="flex flex-wrap gap-3 text-sm">
                      <span
                        className={`px-2 py-1 rounded ${
                          artisan.siretVerified
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {artisan.siretVerified ? '✅' : '⏳'} SIRET
                      </span>
                      <span
                        className={`px-2 py-1 rounded ${
                          artisan.contactVerification?.email?.verified
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {artisan.contactVerification?.email?.verified ? '✅' : '⏳'} Email
                      </span>
                      <span
                        className={`px-2 py-1 rounded ${
                          artisan.contactVerification?.telephone?.verified
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {artisan.contactVerification?.telephone?.verified ? '✅' : '⏳'}{' '}
                        Tél
                      </span>
                      <span
                        className={`px-2 py-1 rounded ${
                          artisan.verificationDocuments?.kbis?.verified
                            ? 'bg-green-100 text-green-700'
                            : artisan.verificationDocuments?.kbis?.url
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {artisan.verificationDocuments?.kbis?.verified
                          ? '✅'
                          : artisan.verificationDocuments?.kbis?.url
                          ? '📄'
                          : '⏳'}{' '}
                        Kbis
                      </span>
                      <span
                        className={`px-2 py-1 rounded ${
                          artisan.verificationDocuments?.idCard?.verified
                            ? 'bg-green-100 text-green-700'
                            : artisan.verificationDocuments?.idCard?.url
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {artisan.verificationDocuments?.idCard?.verified
                          ? '✅'
                          : artisan.verificationDocuments?.idCard?.url
                          ? '📄'
                          : '⏳'}{' '}
                        Pièce ID
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="ml-6">
                    <button
                      onClick={() => openDetailsModal(artisan)}
                      className="bg-[#FF6B00] text-white px-6 py-2 rounded-lg hover:bg-[#E56100] font-medium"
                    >
                      Voir détails →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de détails */}
      {showModal && selectedArtisan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header modal */}
            <div className="bg-[#2C3E50] text-white p-6 sticky top-0">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">{selectedArtisan.nomComplet}</h2>
                <button
                  onClick={closeModal}
                  className="text-white hover:text-gray-300 text-3xl"
                >
                  ×
                </button>
              </div>
              <p className="text-gray-300 mt-1">{selectedArtisan.entreprise.nom}</p>
            </div>

            <div className="p-6">
              {/* Documents */}
              <div className="space-y-6">
                {/* Kbis */}
                {selectedArtisan.verificationDocuments?.kbis?.url && (
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-bold text-lg mb-3 text-[#2C3E50]">
                      📄 Extrait Kbis
                    </h3>

                    {/* Points de contrôle KBIS */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <h4 className="font-semibold text-blue-900 mb-3">🔍 Points de contrôle obligatoires</h4>
                      <div className="space-y-2 text-sm">
                        {/* 1. Vérification âge du document */}
                        {(() => {
                          const uploadDate = selectedArtisan.verificationDocuments.kbis.uploadDate.toDate();
                          const { isRecent, ageInDays } = isKbisRecent(uploadDate);
                          return (
                            <div className={`flex items-start gap-2 p-2 rounded ${isRecent ? 'bg-green-100' : 'bg-red-100'}`}>
                              <span className="text-lg">{isRecent ? '✅' : '⚠️'}</span>
                              <div>
                                <p className={isRecent ? 'text-green-800 font-medium' : 'text-red-800 font-medium'}>
                                  Date d'émission : {isRecent ? 'Valide' : 'Trop ancien'}
                                </p>
                                <p className={isRecent ? 'text-green-700' : 'text-red-700'}>
                                  Uploadé il y a {ageInDays} jours {!isRecent && '(requis: moins de 90 jours)'}
                                </p>
                              </div>
                            </div>
                          );
                        })()}

                        {/* 2. Vérification SIRET */}
                        <div className={`flex items-start gap-2 p-2 rounded ${
                          selectedArtisan.verificationDocuments.kbis.siretMatched
                            ? 'bg-green-100'
                            : 'bg-yellow-100'
                        }`}>
                          <span className="text-lg">
                            {selectedArtisan.verificationDocuments.kbis.siretMatched ? '✅' : '⚠️'}
                          </span>
                          <div>
                            <p className={`font-medium ${
                              selectedArtisan.verificationDocuments.kbis.siretMatched
                                ? 'text-green-800'
                                : 'text-yellow-800'
                            }`}>
                              Correspondance SIRET : {selectedArtisan.verificationDocuments.kbis.siretMatched ? 'Vérifié automatiquement' : 'À vérifier manuellement'}
                            </p>
                            <p className="text-gray-700">
                              SIRET déclaré : <strong>{selectedArtisan.entreprise.siret}</strong>
                            </p>
                            {selectedArtisan.verificationDocuments.kbis.extractedData?.siret && (
                              <p className="text-gray-700">
                                SIRET extrait du KBIS : <strong>{selectedArtisan.verificationDocuments.kbis.extractedData.siret}</strong>
                              </p>
                            )}
                          </div>
                        </div>

                        {/* 3. Vérification raison sociale */}
                        <div className="flex items-start gap-2 p-2 rounded bg-blue-100">
                          <span className="text-lg">📋</span>
                          <div>
                            <p className="text-blue-800 font-medium">Raison sociale à vérifier</p>
                            <p className="text-gray-700">
                              Déclarée : <strong>{selectedArtisan.entreprise.nom}</strong>
                            </p>
                            {selectedArtisan.verificationDocuments.kbis.extractedData?.companyName && (
                              <p className="text-gray-700">
                                Sur KBIS : <strong>{selectedArtisan.verificationDocuments.kbis.extractedData.companyName}</strong>
                              </p>
                            )}
                          </div>
                        </div>

                        {/* 4. Vérification QR Code (si détecté) */}
                        {selectedArtisan.verificationDocuments.kbis.extractedData?.qrCodeData && (
                          <div className={`flex items-start gap-2 p-2 rounded ${
                            selectedArtisan.verificationDocuments.kbis.extractedData.qrCodeValid
                              ? 'bg-green-100'
                              : 'bg-red-100'
                          }`}>
                            <span className="text-lg">
                              {selectedArtisan.verificationDocuments.kbis.extractedData.qrCodeValid ? '✅' : '❌'}
                            </span>
                            <div>
                              <p className={`font-medium ${
                                selectedArtisan.verificationDocuments.kbis.extractedData.qrCodeValid
                                  ? 'text-green-800'
                                  : 'text-red-800'
                              }`}>
                                QR Code : {selectedArtisan.verificationDocuments.kbis.extractedData.qrCodeValid ? 'Authentique INPI' : 'Non valide'}
                              </p>
                              <p className="text-gray-700 text-xs mt-1 break-all">
                                Données: {selectedArtisan.verificationDocuments.kbis.extractedData.qrCodeData}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* 5. Date d'émission (si extraite) */}
                        {selectedArtisan.verificationDocuments.kbis.extractedData?.emissionDate && (
                          <div className="flex items-start gap-2 p-2 rounded bg-blue-100">
                            <span className="text-lg">📅</span>
                            <div>
                              <p className="text-blue-800 font-medium">Date d'émission extraite</p>
                              <p className="text-gray-700">
                                Date : <strong>{selectedArtisan.verificationDocuments.kbis.extractedData.emissionDate}</strong>
                              </p>
                              <p className="text-gray-600 text-sm mt-1">
                                ⚠️ Vérifier que la date est lisible et cohérente (moins de 3 mois recommandé)
                              </p>
                            </div>
                          </div>
                        )}

                        {/* 6. Vérification éléments visuels */}
                        <div className="flex items-start gap-2 p-2 rounded bg-blue-100">
                          <span className="text-lg">🔐</span>
                          <div>
                            <p className="text-blue-800 font-medium">Éléments visuels détectés automatiquement (OpenCV)</p>
                            <ul className="text-gray-700 space-y-1 mt-1">
                              {/* Logo INPI */}
                              <li className="flex items-center gap-2">
                                <span className={selectedArtisan.verificationDocuments.kbis.extractedData?.hasInpiLogo ? "text-green-600" : "text-orange-600"}>
                                  {selectedArtisan.verificationDocuments.kbis.extractedData?.hasInpiLogo ? "✅" : "⚠️"}
                                </span>
                                <p>Logo INPI : {selectedArtisan.verificationDocuments.kbis.extractedData?.hasInpiLogo ? "Détecté (Haut du document)" : "Non détecté"}</p>
                              </li>

                              {/* En-tête officiel */}
                              <li className="flex items-center gap-2">
                                <span className={selectedArtisan.verificationDocuments.kbis.extractedData?.hasOfficialHeader ? "text-green-600" : "text-orange-600"}>
                                  {selectedArtisan.verificationDocuments.kbis.extractedData?.hasOfficialHeader ? "✅" : "⚠️"}
                                </span>
                                <p>En-tête officiel : {selectedArtisan.verificationDocuments.kbis.extractedData?.hasOfficialHeader ? "Détecté 'Greffe du Tribunal de Commerce'" : "Non détecté"}</p>
                              </li>

                              {/* Cachet */}
                              <li className="flex items-center gap-2">
                                <span className={selectedArtisan.verificationDocuments.kbis.extractedData?.hasSeal ? "text-green-600" : "text-orange-600"}>
                                  {selectedArtisan.verificationDocuments.kbis.extractedData?.hasSeal ? "✅" : "⚠️"}
                                </span>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p>Cachet officiel : {selectedArtisan.verificationDocuments.kbis.extractedData?.hasSeal ? "Détecté (Multi-formes)" : "Non détecté"}</p>
                                    {selectedArtisan.verificationDocuments.kbis.extractedData?.sealQuality && (
                                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                        selectedArtisan.verificationDocuments.kbis.extractedData.sealQuality === 'good' 
                                          ? 'bg-green-200 text-green-800'
                                          : selectedArtisan.verificationDocuments.kbis.extractedData.sealQuality === 'medium'
                                          ? 'bg-yellow-200 text-yellow-800'
                                          : 'bg-red-200 text-red-800'
                                      }`}>
                                        Qualité: {selectedArtisan.verificationDocuments.kbis.extractedData.sealQuality === 'good' ? 'Bonne' : selectedArtisan.verificationDocuments.kbis.extractedData.sealQuality === 'medium' ? 'Moyenne' : 'Faible'}
                                      </span>
                                    )}
                                  </div>
                                  {selectedArtisan.verificationDocuments.kbis.extractedData?.hasSeal && (
                                    <p className="text-xs text-green-700">Détection : Cercles, ovales ou rectangles avec texte/motif interne</p>
                                  )}
                                </div>
                              </li>

                              {/* Signature */}
                              <li className="flex items-center gap-2">
                                <span className={selectedArtisan.verificationDocuments.kbis.extractedData?.hasSignature ? "text-green-600" : "text-orange-600"}>
                                  {selectedArtisan.verificationDocuments.kbis.extractedData?.hasSignature ? "✅" : "⚠️"}
                                </span>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p>Signature manuscrite : {selectedArtisan.verificationDocuments.kbis.extractedData?.hasSignature ? "Détectée (Analyse contours)" : "Non détectée"}</p>
                                    {selectedArtisan.verificationDocuments.kbis.extractedData?.signatureQuality && (
                                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                        selectedArtisan.verificationDocuments.kbis.extractedData.signatureQuality === 'good' 
                                          ? 'bg-green-200 text-green-800'
                                          : selectedArtisan.verificationDocuments.kbis.extractedData.signatureQuality === 'medium'
                                          ? 'bg-yellow-200 text-yellow-800'
                                          : 'bg-red-200 text-red-800'
                                      }`}>
                                        Qualité: {selectedArtisan.verificationDocuments.kbis.extractedData.signatureQuality === 'good' ? 'Bonne' : selectedArtisan.verificationDocuments.kbis.extractedData.signatureQuality === 'medium' ? 'Moyenne' : 'Faible'}
                                      </span>
                                    )}
                                  </div>
                                  {selectedArtisan.verificationDocuments.kbis.extractedData?.hasSignature && (
                                    <p className="text-xs text-green-700">Traits manuscrits horizontaux avec densité appropriée</p>
                                  )}
                                </div>
                              </li>
                            </ul>

                            {/* Score d'authenticité global */}
                            {selectedArtisan.verificationDocuments.kbis.extractedData?.qualityScore !== undefined && (
                              <div className={`mt-3 p-3 rounded ${
                                selectedArtisan.verificationDocuments.kbis.extractedData.documentQuality === 'authentic'
                                  ? 'bg-green-50 border border-green-200'
                                  : selectedArtisan.verificationDocuments.kbis.extractedData.documentQuality === 'suspicious'
                                  ? 'bg-orange-50 border border-orange-200'
                                  : 'bg-red-50 border border-red-200'
                              }`}>
                                <p className={`font-bold ${
                                  selectedArtisan.verificationDocuments.kbis.extractedData.documentQuality === 'authentic'
                                    ? 'text-green-800'
                                    : selectedArtisan.verificationDocuments.kbis.extractedData.documentQuality === 'suspicious'
                                    ? 'text-orange-800'
                                    : 'text-red-800'
                                }`}>
                                  {selectedArtisan.verificationDocuments.kbis.extractedData.documentQuality === 'authentic' && '✅ Document authentique'}
                                  {selectedArtisan.verificationDocuments.kbis.extractedData.documentQuality === 'suspicious' && '⚠️ Document suspect - Vérification approfondie requise'}
                                  {selectedArtisan.verificationDocuments.kbis.extractedData.documentQuality === 'altered' && '❌ Document possiblement falsifié'}
                                </p>
                                <div className="mt-2">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium">Score d'authenticité</span>
                                    <span className="text-sm font-bold">{selectedArtisan.verificationDocuments.kbis.extractedData.qualityScore}/100</span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full transition-all ${
                                        selectedArtisan.verificationDocuments.kbis.extractedData.qualityScore >= 70
                                          ? 'bg-green-500'
                                          : selectedArtisan.verificationDocuments.kbis.extractedData.qualityScore >= 40
                                          ? 'bg-orange-500'
                                          : 'bg-red-500'
                                      }`}
                                      style={{ width: `${selectedArtisan.verificationDocuments.kbis.extractedData.qualityScore}%` }}
                                    ></div>
                                  </div>
                                </div>
                                {selectedArtisan.verificationDocuments.kbis.extractedData.documentQuality !== 'authentic' && (
                                  <p className="text-xs mt-2">
                                    <strong>Anomalies détectées :</strong> Incohérences de bruit, contours anormaux ou non-uniformité du document
                                  </p>
                                )}
                              </div>
                            )}

                            <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                              <p className="text-xs text-yellow-800">
                                <strong>⚠️ Fiabilité :</strong> ~90% cachet (toutes formes), ~80% signature<br/>
                                <strong>✋ Vérification visuelle obligatoire</strong> pour confirmer authenticité
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* 7. Checklist vérification manuelle */}
                        <div className="flex items-start gap-2 p-2 rounded bg-blue-100">
                          <span className="text-lg">👁️</span>
                          <div>
                            <p className="text-blue-800 font-medium">Vérification manuelle à effectuer</p>
                            <ul className="text-gray-700 list-disc list-inside space-y-1 mt-1">
                              <li>Logo INPI présent et authentique</li>
                              {!selectedArtisan.verificationDocuments.kbis.extractedData?.qrCodeData && (
                                <li>QR Code (KBIS récents depuis 2019)</li>
                              )}
                              <li>En-tête officiel "Greffe du Tribunal de Commerce"</li>
                              <li>Cachet circulaire net et lisible</li>
                              <li>Signature du greffier présente</li>
                              <li>Qualité générale du document (pas de retouches)</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Données extraites par OCR */}
                    {selectedArtisan.verificationDocuments.kbis.siretMatched && (
                      <div className="bg-green-50 border border-green-200 rounded p-3 mb-4">
                        <p className="text-green-800 font-medium mb-2">
                          ✅ SIRET vérifié automatiquement par OCR
                        </p>
                        {selectedArtisan.verificationDocuments.kbis.extractedData && (
                          <div className="text-sm text-green-700 space-y-1">
                            <p>
                              <strong>SIRET extrait:</strong>{' '}
                              {selectedArtisan.verificationDocuments.kbis.extractedData.siret}
                            </p>
                            <p>
                              <strong>Entreprise:</strong>{' '}
                              {selectedArtisan.verificationDocuments.kbis.extractedData.companyName}
                            </p>
                            <p>
                              <strong>Forme juridique:</strong>{' '}
                              {selectedArtisan.verificationDocuments.kbis.extractedData.legalForm}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mb-4">
                      <a
                        href={selectedArtisan.verificationDocuments.kbis.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#FF6B00] hover:underline"
                      >
                        Voir le document →
                      </a>
                      <p className="text-sm text-gray-600 mt-1">
                        Uploadé le{' '}
                        {selectedArtisan.verificationDocuments.kbis.uploadDate
                          .toDate()
                          .toLocaleDateString('fr-FR')}
                      </p>
                    </div>

                    {!selectedArtisan.verificationDocuments.kbis.verified && (
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleApprove(selectedArtisan, 'kbis')}
                          disabled={actionLoading}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          ✅ Approuver Kbis
                        </button>
                        <button
                          onClick={() => openRejectModal(selectedArtisan)}
                          disabled={actionLoading}
                          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                          ❌ Rejeter
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Pièce d'identité */}
                {selectedArtisan.verificationDocuments?.idCard?.url && (
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-bold text-lg mb-3 text-[#2C3E50]">
                      🪪 Pièce d'identité
                    </h3>

                    <div className="mb-4">
                      <a
                        href={selectedArtisan.verificationDocuments.idCard.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#FF6B00] hover:underline"
                      >
                        Voir le document →
                      </a>
                      <p className="text-sm text-gray-600 mt-1">
                        Uploadé le{' '}
                        {selectedArtisan.verificationDocuments.idCard.uploadDate
                          .toDate()
                          .toLocaleDateString('fr-FR')}
                      </p>
                    </div>

                    {!selectedArtisan.verificationDocuments.idCard.verified && (
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleApprove(selectedArtisan, 'idCard')}
                          disabled={actionLoading}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          ✅ Approuver Pièce ID
                        </button>
                        <button
                          onClick={() => openRejectModal(selectedArtisan)}
                          disabled={actionLoading}
                          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                          ❌ Rejeter
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Tout approuver */}
                {selectedArtisan.verificationDocuments?.kbis?.url &&
                  selectedArtisan.verificationDocuments?.idCard?.url &&
                  (!selectedArtisan.verificationDocuments.kbis.verified ||
                    !selectedArtisan.verificationDocuments.idCard.verified) && (
                    <div className="border-t border-gray-200 pt-6">
                      <button
                        onClick={() => handleApprove(selectedArtisan, 'both')}
                        disabled={actionLoading}
                        className="w-full bg-[#FF6B00] text-white px-6 py-3 rounded-lg hover:bg-[#E56100] font-bold text-lg disabled:opacity-50"
                      >
                        ✅ Tout approuver (Kbis + Pièce ID)
                      </button>
                    </div>
                  )}

                {/* Étapes manquantes */}
                {selectedArtisan.missingSteps.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-bold text-yellow-800 mb-2">
                      ⚠️ Étapes manquantes
                    </h4>
                    <ul className="text-sm text-yellow-700 space-y-1">
                      {selectedArtisan.missingSteps.map((step, idx) => (
                        <li key={idx}>• {step}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de rejet */}
      {showRejectModal && selectedArtisan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full p-6">
            <h3 className="text-xl font-bold text-[#2C3E50] mb-4">
              Rejeter la vérification
            </h3>

            <p className="text-gray-600 mb-4">
              Artisan: <strong>{selectedArtisan.nomComplet}</strong>
            </p>

            <label className="block mb-2 font-medium text-gray-700">
              Raison du rejet (obligatoire):
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 mb-4 min-h-[120px]"
              placeholder="Ex: Document illisible, SIRET non conforme, pièce d'identité expirée..."
            />

            <div className="flex gap-3">
              <button
                onClick={handleReject}
                disabled={actionLoading || !rejectReason.trim()}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium"
              >
                {actionLoading ? 'Rejet en cours...' : 'Confirmer le rejet'}
              </button>
              <button
                onClick={() => setShowRejectModal(false)}
                disabled={actionLoading}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 font-medium"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
