'use client';

/**
 * Dashboard Admin - Gestion des Comptes
 * Page: /admin/comptes
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/lib/auth-service';
import { getAllArtisansForAdmin } from '@/lib/firebase/artisan-service';
import { 
  getAllClientsForAdmin,
  suspendArtisan,
  reactivateArtisan,
  suspendClient,
  reactivateClient,
  deleteArtisanAccount,
  deleteClientAccount,
  addAdminNoteArtisan,
  addAdminNoteClient
} from '@/lib/firebase/account-service';
import type { Artisan } from '@/types/firestore';

type FilterType = 'all' | 'active' | 'suspended';
type AccountType = 'artisans' | 'clients';

interface Client {
  userId: string;
  nom?: string;
  prenom?: string;
  email: string;
  role: string;
  suspended?: boolean;
  suspensionReason?: string;
  dateInscription?: any;
  adminNotes?: any[];
}

export default function AdminComptesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accountType, setAccountType] = useState<AccountType>('artisans');
  
  // Données
  const [artisans, setArtisans] = useState<Artisan[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  
  // Filtres
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  
  // Form states
  const [suspensionReason, setSuspensionReason] = useState('');
  const [deletionReason, setDeletionReason] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    checkAdminAndLoad();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [accountType, selectedFilter, searchTerm, artisans, clients]);

  const checkAdminAndLoad = async () => {
    try {
      const user = authService.getCurrentUser();
      if (!user) {
        router.push('/admin/login');
        return;
      }

      await loadData();
    } catch (error) {
      console.error('Erreur:', error);
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      const [artisansData, clientsData] = await Promise.all([
        getAllArtisansForAdmin(),
        getAllClientsForAdmin()
      ]);
      
      setArtisans(artisansData);
      setClients(clientsData);
    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    const data = accountType === 'artisans' ? artisans : clients;
    let filtered = [...data];

    // Filtre par statut
    if (selectedFilter === 'active') {
      filtered = filtered.filter(item => !item.suspended);
    } else if (selectedFilter === 'suspended') {
      filtered = filtered.filter(item => item.suspended);
    }

    // Recherche
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.nom?.toLowerCase().includes(searchLower) ||
        item.prenom?.toLowerCase().includes(searchLower) ||
        item.email?.toLowerCase().includes(searchLower) ||
        (accountType === 'artisans' && (item as Artisan).siret?.includes(searchTerm))
      );
    }

    setFilteredData(filtered);
  };

  const exportToCSV = () => {
    const data = accountType === 'artisans' ? filteredData : filteredData;
    const csvRows = [];
    
    // Headers
    const headers = accountType === 'artisans'
      ? ['Nom', 'Prénom', 'Email', 'SIRET', 'Statut', 'Date Inscription']
      : ['Nom', 'Prénom', 'Email', 'Statut', 'Date Inscription'];
    csvRows.push(headers.join(','));
    
    // Data rows
    data.forEach(account => {
      const row = accountType === 'artisans'
        ? [
            account.nom || '',
            account.prenom || '',
            account.email || '',
            (account as Artisan).siret || '',
            account.suspended ? 'Suspendu' : 'Actif',
            account.dateInscription ? new Date(account.dateInscription.toDate()).toLocaleDateString('fr-FR') : ''
          ]
        : [
            account.nom || '',
            account.prenom || '',
            account.email || '',
            account.suspended ? 'Suspendu' : 'Actif',
            account.dateInscription ? new Date(account.dateInscription.toDate()).toLocaleDateString('fr-FR') : ''
          ];
      csvRows.push(row.join(','));
    });
    
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${accountType}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSuspend = async () => {
    if (!selectedAccount || !suspensionReason.trim()) return;

    setActionLoading(true);
    try {
      const result = accountType === 'artisans'
        ? await suspendArtisan(selectedAccount.userId, suspensionReason, 'admin_temp', 'Admin')
        : await suspendClient(selectedAccount.userId, suspensionReason, 'admin_temp', 'Admin');

      if (result.success) {
        await loadData();
        setShowSuspendDialog(false);
        setSuspensionReason('');
        setSelectedAccount(null);
        alert('Compte suspendu avec succès');
      } else {
        alert(result.error || 'Erreur lors de la suspension');
      }
    } catch (error) {
      alert('Erreur lors de la suspension');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async (account: any) => {
    if (!confirm('Voulez-vous réactiver ce compte ?')) return;

    setActionLoading(true);
    try {
      const result = accountType === 'artisans'
        ? await reactivateArtisan(account.userId, 'admin_temp', 'Admin')
        : await reactivateClient(account.userId, 'admin_temp', 'Admin');

      if (result.success) {
        await loadData();
        alert('Compte réactivé avec succès');
      } else {
        alert(result.error || 'Erreur lors de la réactivation');
      }
    } catch (error) {
      alert('Erreur lors de la réactivation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedAccount || !deletionReason.trim()) return;
    if (!confirm('⚠️ ATTENTION : Cette action est IRRÉVERSIBLE. Confirmer la suppression définitive ?')) return;

    setActionLoading(true);
    try {
      const result = accountType === 'artisans'
        ? await deleteArtisanAccount(selectedAccount.userId, 'admin_temp', 'Admin', deletionReason)
        : await deleteClientAccount(selectedAccount.userId, 'admin_temp', 'Admin', deletionReason);

      if (result.success) {
        await loadData();
        setShowDeleteDialog(false);
        setDeletionReason('');
        setSelectedAccount(null);
        alert('Compte supprimé définitivement');
      } else {
        alert(result.error || 'Erreur lors de la suppression');
      }
    } catch (error) {
      alert('Erreur lors de la suppression');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!selectedAccount || !adminNote.trim()) return;

    setActionLoading(true);
    try {
      const result = accountType === 'artisans'
        ? await addAdminNoteArtisan(selectedAccount.userId, adminNote, 'admin_temp', 'Admin')
        : await addAdminNoteClient(selectedAccount.userId, adminNote, 'admin_temp', 'Admin');

      if (result.success) {
        await loadData();
        setShowNoteDialog(false);
        setAdminNote('');
        setSelectedAccount(null);
        alert('Note ajoutée avec succès');
      } else {
        alert(result.error || 'Erreur lors de l\'ajout de la note');
      }
    } catch (error) {
      alert('Erreur lors de l\'ajout de la note');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl text-gray-600">Chargement...</p>
      </div>
    );
  }

  const stats = {
    artisansTotal: artisans.length,
    artisansActifs: artisans.filter(a => !a.suspended).length,
    artisansSuspendus: artisans.filter(a => a.suspended).length,
    clientsTotal: clients.length,
    clientsActifs: clients.filter(c => !c.suspended).length,
    clientsSuspendus: clients.filter(c => c.suspended).length
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#2C3E50] mb-2">Gestion des Comptes</h1>
        <p className="text-gray-600">Administration des comptes artisans et clients</p>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 uppercase">Artisans</div>
          <div className="text-3xl font-bold text-[#FF6B00]">{stats.artisansTotal}</div>
          <div className="text-xs text-gray-500 mt-2">
            {stats.artisansActifs} actifs • {stats.artisansSuspendus} suspendus
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 uppercase">Clients</div>
          <div className="text-3xl font-bold text-[#2C3E50]">{stats.clientsTotal}</div>
          <div className="text-xs text-gray-500 mt-2">
            {stats.clientsActifs} actifs • {stats.clientsSuspendus} suspendus
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 uppercase">Total Utilisateurs</div>
          <div className="text-3xl font-bold text-gray-800">
            {stats.artisansTotal + stats.clientsTotal}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 uppercase">Comptes Suspendus</div>
          <div className="text-3xl font-bold text-red-600">
            {stats.artisansSuspendus + stats.clientsSuspendus}
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setAccountType('artisans')}
              className={`px-6 py-4 font-medium ${
                accountType === 'artisans'
                  ? 'border-b-2 border-[#FF6B00] text-[#FF6B00]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              🔧 Artisans ({artisans.length})
            </button>
            <button
              onClick={() => setAccountType('clients')}
              className={`px-6 py-4 font-medium ${
                accountType === 'clients'
                  ? 'border-b-2 border-[#FF6B00] text-[#FF6B00]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              👥 Clients ({clients.length})
            </button>
          </div>
        </div>

        {/* Filtres */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Recherche */}
            <div className="flex-1">
              <input
                type="text"
                placeholder={`Rechercher un ${accountType === 'artisans' ? 'artisan' : 'client'}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
              />
            </div>

            {/* Filtres statut */}
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedFilter('all')}
                className={`px-4 py-2 rounded-lg ${
                  selectedFilter === 'all'
                    ? 'bg-[#FF6B00] text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Tous
              </button>
              <button
                onClick={() => setSelectedFilter('active')}
                className={`px-4 py-2 rounded-lg ${
                  selectedFilter === 'active'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Actifs
              </button>
              <button
                onClick={() => setSelectedFilter('suspended')}
                className={`px-4 py-2 rounded-lg ${
                  selectedFilter === 'suspended'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Suspendus
              </button>
              <button
                onClick={exportToCSV}
                className="px-4 py-2 rounded-lg bg-[#2C3E50] text-white hover:bg-[#1A3A5C] flex items-center gap-2"
              >
                📥 Exporter CSV
              </button>
            </div>
          </div>
        </div>

        {/* Tableau */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Utilisateur
                </th>
                {accountType === 'artisans' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SIRET
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Inscription
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredData.map((account) => (
                <tr key={account.userId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="font-medium text-gray-900">
                        {account.nom} {account.prenom}
                      </div>
                      <div className="text-sm text-gray-500">{account.email}</div>
                    </div>
                  </td>
                  {accountType === 'artisans' && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(account as Artisan).siret || '-'}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {account.suspended ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                        Suspendu
                      </span>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Actif
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {account.dateInscription
                      ? new Date(account.dateInscription.toDate()).toLocaleDateString('fr-FR')
                      : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => {
                        setSelectedAccount(account);
                        setShowDetailsDialog(true);
                      }}
                      disabled={actionLoading}
                      className="text-[#2C3E50] hover:text-[#1A3A5C] disabled:opacity-50"
                    >
                      👁️ Détails
                    </button>
                    {account.suspended ? (
                      <button
                        onClick={() => handleReactivate(account)}
                        disabled={actionLoading}
                        className="text-green-600 hover:text-green-900 disabled:opacity-50"
                      >
                        Réactiver
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedAccount(account);
                          setShowSuspendDialog(true);
                        }}
                        disabled={actionLoading}
                        className="text-orange-600 hover:text-orange-900 disabled:opacity-50"
                      >
                        Suspendre
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSelectedAccount(account);
                        setShowNoteDialog(true);
                      }}
                      disabled={actionLoading}
                      className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                    >
                      Note
                    </button>
                    <button
                      onClick={() => {
                        setSelectedAccount(account);
                        setShowDeleteDialog(true);
                      }}
                      disabled={actionLoading}
                      className="text-red-600 hover:text-red-900 disabled:opacity-50"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredData.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">Aucun compte trouvé</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Suspension */}
      {showSuspendDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Suspendre le compte</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Raison de la suspension *
              </label>
              <textarea
                value={suspensionReason}
                onChange={(e) => setSuspensionReason(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
                placeholder="Expliquez la raison de la suspension..."
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSuspend}
                disabled={actionLoading || !suspensionReason.trim()}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? 'Suspension...' : 'Suspendre'}
              </button>
              <button
                onClick={() => {
                  setShowSuspendDialog(false);
                  setSuspensionReason('');
                  setSelectedAccount(null);
                }}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Suppression */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4 text-red-600">⚠️ Suppression Définitive</h3>
            <p className="text-sm text-gray-600 mb-4">
              Cette action est <strong>IRRÉVERSIBLE</strong>. Toutes les données seront supprimées conformément au RGPD.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Raison de la suppression *
              </label>
              <textarea
                value={deletionReason}
                onChange={(e) => setDeletionReason(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                placeholder="Expliquez la raison de la suppression..."
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={actionLoading || !deletionReason.trim()}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? 'Suppression...' : 'Supprimer Définitivement'}
              </button>
              <button
                onClick={() => {
                  setShowDeleteDialog(false);
                  setDeletionReason('');
                  setSelectedAccount(null);
                }}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
              >
                Annuler
              </button>
            
            {/* Notes existantes */}
            {selectedAccount?.adminNotes && selectedAccount.adminNotes.length > 0 && (
              <div className="mb-4 max-h-40 overflow-y-auto bg-gray-50 p-3 rounded-lg">
                <p className="text-xs font-semibold text-gray-600 mb-2">Notes existantes :</p>
                {selectedAccount.adminNotes.map((note: any, index: number) => (
                  <div key={index} className="text-xs text-gray-700 mb-2 pb-2 border-b border-gray-200 last:border-0">
                    <p className="font-medium">{note.note}</p>
                    <p className="text-gray-500 mt-1">
                      Par {note.adminName} - {new Date(note.createdAt.toDate()).toLocaleString('fr-FR')}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nouvelle note privée (visible uniquement par les admins)
              </label>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
                placeholder="Votre note..."
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddNote}
                disabled={actionLoading || !adminNote.trim()}
                className="flex-1 bg-[#FF6B00] text-white px-4 py-2 rounded-lg hover:bg-[#E56100] disabled:opacity-50"
              >
                {actionLoading ? 'Ajout...' : 'Ajouter'}
              </button>
              <button
                onClick={() => {
                  setShowNoteDialog(false);
                  setAdminNote('');
                  setSelectedAccount(null);
                }}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Détails */}
      {showDetailsDialog && selectedAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-bold text-[#2C3E50]">
                  {selectedAccount.nom} {selectedAccount.prenom}
                </h3>
                <p className="text-gray-600">{selectedAccount.email}</p>
              </div>
              {selectedAccount.suspended ? (
                <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-semibold">
                  Suspendu
                </span>
              ) : (
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                  Actif
                </span>
              )}
            </div>

            {/* Informations générales */}
            <div className="mb-6">
              <h4 className="font-semibold text-gray-700 mb-3">Informations générales</h4>
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                {accountType === 'artisans' && (
                  <>
                    <div>
                      <p className="text-xs text-gray-500">SIRET</p>
                      <p className="font-medium">{(selectedAccount as Artisan).siret || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Téléphone</p>
                      <p className="font-medium">{(selectedAccount as Artisan).telephone || '-'}</p>
                    </div>
                  </>
                )}
                <div>
                  <p className="text-xs text-gray-500">Date d'inscription</p>
                  <p className="font-medium">
                    {selectedAccount.dateInscription
                      ? new Date(selectedAccount.dateInscription.toDate()).toLocaleString('fr-FR')
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Rôle</p>
                  <p className="font-medium capitalize">{selectedAccount.role}</p>
                </div>
              </div>
            </div>

            {/* Suspension info */}
            {selectedAccount.suspended && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-semibold text-red-700 mb-2">⚠️ Compte suspendu</h4>
                <p className="text-sm text-red-600 mb-2">
                  <strong>Raison :</strong> {selectedAccount.suspensionReason}
                </p>
                {selectedAccount.accountActions && selectedAccount.accountActions.length > 0 && (
                  <p className="text-xs text-red-500">
                    Suspendu le{' '}
                    {new Date(
                      selectedAccount.accountActions.find((a: any) => a.action === 'suspended')?.timestamp.toDate()
                    ).toLocaleString('fr-FR')}
                  </p>
                )}
              </div>
            )}

            {/* Notes admin */}
            {selectedAccount.adminNotes && selectedAccount.adminNotes.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold text-gray-700 mb-3">📝 Notes administratives</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedAccount.adminNotes.map((note: any, index: number) => (
                    <div key={index} className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
                      <p className="text-sm text-gray-800">{note.note}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Par {note.adminName} - {new Date(note.createdAt.toDate()).toLocaleString('fr-FR')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Historique des actions */}
            {selectedAccount.accountActions && selectedAccount.accountActions.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold text-gray-700 mb-3">📋 Historique des actions</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedAccount.accountActions
                    .sort((a: any, b: any) => b.timestamp.toMillis() - a.timestamp.toMillis())
                    .map((action: any, index: number) => (
                      <div key={index} className="flex items-start gap-3 text-sm bg-gray-50 p-3 rounded">
                        <span className="text-lg">
                          {action.action === 'suspended'
                            ? '⏸️'
                            : action.action === 'reactivated'
                            ? '▶️'
                            : action.action === 'note_added'
                            ? '📝'
                            : '🔄'}
                        </span>
                        <div className="flex-1">
                          <p className="font-medium text-gray-800">
                            {action.action === 'suspended'
                              ? 'Compte suspendu'
                              : action.action === 'reactivated'
                              ? 'Compte réactivé'
                              : action.action === 'note_added'
                              ? 'Note ajoutée'
                              : action.action}
                          </p>
                          {action.reason && (
                            <p className="text-xs text-gray-600 mt-1">Raison : {action.reason}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            Par {action.adminName} - {new Date(action.timestamp.toDate()).toLocaleString('fr-FR')}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <button
              onClick={() => {
                setShowDetailsDialog(false);
                setSelectedAccount(null);
              }}
              className="w-full bg-[#2C3E50] text-white px-4 py-2 rounded-lg hover:bg-[#1A3A5C]"
            >
              Fermer
            </buttontton
                onClick={() => {
                  setShowNoteDialog(false);
                  setAdminNote('');
                  setSelectedAccount(null);
                }}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
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
