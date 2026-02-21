'use client';

/**
 * Page de détail d'un litige avec contexte complet
 * 
 * Affiche :
 * - Informations du litige
 * - Demande initiale du client
 * - Devis concerné par le litige
 * - Historique de tous les devis de cette demande
 * - Statistiques comparatives
 */

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { authService } from '@/lib/auth-service';
import { db } from '@/lib/firebase/config';
import { updateDoc, doc, Timestamp } from 'firebase/firestore';
import { 
  getContexteCompletLitige,
  getLitigeById,
  resolveLitige,
  addLitigeAction,
  getConversationFromDemande,
} from '@/lib/firebase/litige-service';
import type { Litige } from '@/types/litige';
import type { Demande } from '@/types/firestore';
import type { Devis } from '@/types/devis'; // Type Devis de devis.ts car c'est celui retourné par litige-service
import { 
  LITIGE_TYPE_LABELS,
  LITIGE_STATUT_LABELS,
  LITIGE_PRIORITE_LABELS,
} from '@/types/litige';
import LitigesNavigation from '@/components/admin/LitigesNavigation';

interface ContexteComplet {
  litige: Litige | null;
  demande: Demande | null;
  devisConcerne: Devis | null;
  historiqueDevis: Devis[];
  statistiques: {
    totalDevis: number;
    devisAcceptes: number;
    devisRefuses: number;
    montantMoyenDevis: number;
  };
}

export default function LitigeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const litigeId = params.id as string;

  const [contexte, setContexte] = useState<ContexteComplet | null>(null);
  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'litige' | 'demande' | 'devis' | 'historique' | 'conversation'>('litige');
  const [resolutionNote, setResolutionNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);

  // Vérification admin
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setAuthLoading(true);
        const user = authService.getCurrentUser();
        if (!user) {
          router.push('/access-x7k9m2p4w8n3');
          return;
        }
        await loadContexte();
      } catch (error) {
        console.error('Erreur authentification:', error);
      } finally {
        setAuthLoading(false);
      }
    };
    checkAuth();
  }, [router, litigeId]);

  const loadContexte = async () => {
    try {
      setLoading(true);
      const data = await getContexteCompletLitige(litigeId);
      setContexte(data);

      // Charger aussi la conversation si une demande existe
      if (data?.demande?.id) {
        const conversationData = await getConversationFromDemande(data.demande.id);
        if (conversationData) {
          setConversation(conversationData.conversation);
          
          // ✅ Filtrer les messages supprimés
          const activeMessages = conversationData.messages.filter((msg: any) => !msg.deleted);
          setMessages(activeMessages);
        }
      }
    } catch (error) {
      console.error('Erreur chargement contexte:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (statut: 'resolu_accord' | 'resolu_admin' | 'abandonne') => {
    if (!resolutionNote.trim()) {
      alert('Veuillez saisir une note de résolution');
      return;
    }

    try {
      setSubmitting(true);
      // Appel correct avec paramètres séparés : resolveLitige(litigeId, statut, resolution)
      await resolveLitige(litigeId, statut, resolutionNote);
      alert('Litige résolu avec succès');
      await loadContexte();
      setResolutionNote('');
    } catch (error) {
      console.error('Erreur résolution:', error);
      alert('Erreur lors de la résolution du litige');
    } finally {
      setSubmitting(false);
    }
  };

  // 🗑️ Fonction de suppression admin de message
  async function handleDeleteMessage(messageId: string) {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      alert('❌ Erreur : utilisateur non connecté');
      return;
    }

    const confirmed = confirm(
      '❓ Supprimer ce message ?\n\n⚠️ Action Admin : Le message sera supprimé définitivement pour tous les participants.\n\n✅ Cette action sera tracée dans les logs.'
    );
    if (!confirmed) return;

    try {
      setDeletingMessageId(messageId);

      await updateDoc(doc(db, 'messages', messageId), {
        deleted: true,
        deletedAt: Timestamp.now(),
        deletedBy: currentUser.uid,
      });

      // Mettre à jour localement
      setMessages(prev => prev.filter((msg: any) => msg.id !== messageId));

      console.log('✅ [ADMIN] Message supprimé:', messageId, 'par:', currentUser.email);
      alert('✅ Message supprimé avec succès');
    } catch (error) {
      console.error('❌ Erreur suppression message:', error);
      alert('❌ Erreur lors de la suppression du message');
    } finally {
      setDeletingMessageId(null);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B00] mx-auto"></div>
          <p className="mt-4 text-[#6C757D]">Chargement du contexte du litige...</p>
        </div>
      </div>
    );
  }

  if (!contexte || !contexte.litige) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#DC3545] text-xl">Litige introuvable</p>
          <button
            onClick={() => router.push('/admin/litiges')}
            className="mt-4 bg-[#2C3E50] text-white px-6 py-2 rounded-lg hover:bg-[#1A3A5C]"
          >
            Retour aux litiges
          </button>
        </div>
      </div>
    );
  }

  const { litige, demande, devisConcerne, historiqueDevis, statistiques } = contexte;

  // Badge priorité
  const getPrioriteColor = (priorite?: string) => {
    switch (priorite) {
      case 'urgente': return 'bg-[#DC3545] text-white';
      case 'haute': return 'bg-[#FF6B00] text-white';
      case 'moyenne': return 'bg-[#FFC107] text-black';
      case 'basse': return 'bg-[#28A745] text-white';
      default: return 'bg-[#6C757D] text-white';
    }
  };

  // Badge statut
  const getStatutColor = (statut: string) => {
    switch (statut) {
      case 'ouvert': return 'bg-[#FF6B00] text-white';
      case 'en_mediation': return 'bg-[#FFC107] text-black';
      case 'resolu_accord':
      case 'resolu_admin': return 'bg-[#28A745] text-white';
      case 'abandonne': return 'bg-[#6C757D] text-white';
      default: return 'bg-[#2C3E50] text-white';
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <button
          onClick={() => router.push('/admin/litiges')}
          className="text-[#FF6B00] hover:underline mb-4"
        >
          ← Retour aux litiges
        </button>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-[#2C3E50] mb-2">
                Litige #{litigeId.slice(0, 8)}
              </h1>
              <p className="text-[#6C757D]">
                {LITIGE_TYPE_LABELS[litige.type]} - {litige.motif}
              </p>
            </div>
            
            <div className="flex gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPrioriteColor(litige.priorite)}`}>
                {litige.priorite ? LITIGE_PRIORITE_LABELS[litige.priorite] : 'N/A'}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatutColor(litige.statut)}`}>
                {LITIGE_STATUT_LABELS[litige.statut]}
              </span>
            </div>
          </div>

          {/* Montant contesté */}
          {litige.montantConteste && litige.montantConteste > 0 && (
            <div className="mt-4 p-4 bg-[#FFF3E0] rounded-lg">
              <p className="text-[#2C3E50] font-semibold">
                Montant contesté : {litige.montantConteste.toFixed(2)} €
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-white rounded-lg shadow-md">
          <div className="border-b border-[#E9ECEF]">
            <div className="flex">
              <button
                onClick={() => setActiveTab('litige')}
                className={`px-6 py-3 font-medium ${
                  activeTab === 'litige'
                    ? 'text-[#FF6B00] border-b-2 border-[#FF6B00]'
                    : 'text-[#6C757D] hover:text-[#2C3E50]'
                }`}
              >
                📋 Litige
              </button>
              <button
                onClick={() => setActiveTab('demande')}
                className={`px-6 py-3 font-medium ${
                  activeTab === 'demande'
                    ? 'text-[#FF6B00] border-b-2 border-[#FF6B00]'
                    : 'text-[#6C757D] hover:text-[#2C3E50]'
                }`}
              >
                📝 Demande initiale
              </button>
              <button
                onClick={() => setActiveTab('devis')}
                className={`px-6 py-3 font-medium ${
                  activeTab === 'devis'
                    ? 'text-[#FF6B00] border-b-2 border-[#FF6B00]'
                    : 'text-[#6C757D] hover:text-[#2C3E50]'
                }`}
              >
                💰 Devis en litige
              </button>
              <button
                onClick={() => setActiveTab('historique')}
                className={`px-6 py-3 font-medium ${
                  activeTab === 'historique'
                    ? 'text-[#FF6B00] border-b-2 border-[#FF6B00]'
                    : 'text-[#6C757D] hover:text-[#2C3E50]'
                }`}
              >
                📊 Historique devis ({statistiques.totalDevis})
              </button>
              <button
                onClick={() => setActiveTab('conversation')}
                className={`px-6 py-3 font-medium ${
                  activeTab === 'conversation'
                    ? 'text-[#FF6B00] border-b-2 border-[#FF6B00]'
                    : 'text-[#6C757D] hover:text-[#2C3E50]'
                }`}
              >
                💬 Conversation ({messages.length})
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* Tab Litige */}
            {activeTab === 'litige' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-[#2C3E50] mb-3">Description du litige</h3>
                  <p className="text-[#6C757D] whitespace-pre-wrap bg-[#F8F9FA] p-4 rounded-lg">
                    {litige.description}
                  </p>
                </div>

                {/* Résolution */}
                {(litige.statut === 'resolu_accord' || litige.statut === 'resolu_admin') && litige.resolution && (
                  <div>
                    <h3 className="text-lg font-semibold text-[#28A745] mb-3">✅ Résolution</h3>
                    <p className="text-[#6C757D] whitespace-pre-wrap bg-[#E8F5E9] p-4 rounded-lg">
                      {litige.resolution}
                    </p>
                  </div>
                )}

                {/* Actions admin si non résolu */}
                {litige.statut !== 'resolu_accord' && litige.statut !== 'resolu_admin' && litige.statut !== 'abandonne' && (
                  <div className="border-t border-[#E9ECEF] pt-6">
                    <h3 className="text-lg font-semibold text-[#2C3E50] mb-3">Actions administrateur</h3>
                    
                    <textarea
                      value={resolutionNote}
                      onChange={(e) => setResolutionNote(e.target.value)}
                      placeholder="Note de résolution (obligatoire)..."
                      className="w-full px-4 py-3 border border-[#E9ECEF] rounded-lg mb-4 min-h-[120px]"
                    />

                    <div className="flex gap-3">
                      <button
                        onClick={() => handleResolve('resolu_accord')}
                        disabled={submitting || !resolutionNote.trim()}
                        className="bg-[#28A745] text-white px-6 py-2 rounded-lg hover:bg-[#218838] disabled:bg-[#6C757D] disabled:cursor-not-allowed"
                      >
                        ✅ Résoudre (Accord mutuel)
                      </button>
                      
                      <button
                        onClick={() => handleResolve('resolu_admin')}
                        disabled={submitting || !resolutionNote.trim()}
                        className="bg-[#FF6B00] text-white px-6 py-2 rounded-lg hover:bg-[#E56100] disabled:bg-[#6C757D] disabled:cursor-not-allowed"
                      >
                        ⚖️ Résoudre (Décision admin)
                      </button>
                      
                      <button
                        onClick={() => handleResolve('abandonne')}
                        disabled={submitting || !resolutionNote.trim()}
                        className="bg-[#6C757D] text-white px-6 py-2 rounded-lg hover:bg-[#5A6268] disabled:cursor-not-allowed"
                      >
                        🚫 Abandonner
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab Demande */}
            {activeTab === 'demande' && demande && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-[#6C757D]">Type de travaux</label>
                    <p className="text-[#2C3E50] font-medium">{demande.critereRecherche?.metier || demande.categorie || 'Non spécifié'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-[#6C757D]">Localisation</label>
                    <p className="text-[#2C3E50] font-medium">
                      {demande.localisation?.ville}, {demande.localisation?.codePostal}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-[#6C757D]">Description initiale</label>
                  <p className="text-[#2C3E50] whitespace-pre-wrap bg-[#F8F9FA] p-4 rounded-lg mt-1">
                    {demande.description}
                  </p>
                </div>

                {demande.budgetIndicatif && (
                  <div>
                    <label className="text-sm text-[#6C757D]">Budget indicatif du client</label>
                    <p className="text-[#2C3E50] font-medium text-lg">
                      {demande.budgetIndicatif.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-sm text-[#6C757D]">Statut de la demande</label>
                  <p className="text-[#2C3E50] font-medium">{demande.statut}</p>
                </div>
              </div>
            )}

            {/* Tab Devis en litige */}
            {activeTab === 'devis' && devisConcerne && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-[#6C757D]">Montant HT</label>
                    <p className="text-[#2C3E50] font-medium text-lg">
                      {devisConcerne.totaux?.totalHT?.toFixed(2) || 0} €
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-[#6C757D]">Montant TTC</label>
                    <p className="text-[#2C3E50] font-medium text-lg">
                      {devisConcerne.totaux?.totalTTC?.toFixed(2) || 0} €
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-[#6C757D]">Statut</label>
                  <p className="text-[#2C3E50] font-medium">{devisConcerne.statut}</p>
                </div>

                {devisConcerne.description && (
                  <div>
                    <label className="text-sm text-[#6C757D] mb-2 block">Description</label>
                    <div className="bg-[#F8F9FA] rounded-lg p-4">
                      <p className="text-[#2C3E50] whitespace-pre-wrap">{devisConcerne.description}</p>
                    </div>
                  </div>
                )}

                {devisConcerne.lignes && devisConcerne.lignes.length > 0 && (
                  <div>
                    <label className="text-sm text-[#6C757D] mb-2 block">Détails des lignes de prestation</label>
                    <div className="bg-[#F8F9FA] rounded-lg p-4 space-y-2">
                      {devisConcerne.lignes.map((ligne, index) => (
                        <div key={index} className="flex justify-between border-b border-[#E9ECEF] pb-2">
                          <span className="text-[#2C3E50]">{ligne.description}</span>
                          <span className="text-[#6C757D]">
                            {ligne.quantite} {ligne.unite} × {ligne.prixUnitaireHT.toFixed(2)}€ HT = {ligne.totalTTC.toFixed(2)}€ TTC
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab Historique */}
            {activeTab === 'historique' && (
              <div className="space-y-6">
                {/* Statistiques */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-[#F8F9FA] p-4 rounded-lg">
                    <p className="text-sm text-[#6C757D]">Total devis</p>
                    <p className="text-2xl font-bold text-[#2C3E50]">{statistiques.totalDevis}</p>
                  </div>
                  <div className="bg-[#E8F5E9] p-4 rounded-lg">
                    <p className="text-sm text-[#6C757D]">Acceptés</p>
                    <p className="text-2xl font-bold text-[#28A745]">{statistiques.devisAcceptes}</p>
                  </div>
                  <div className="bg-[#FFEBEE] p-4 rounded-lg">
                    <p className="text-sm text-[#6C757D]">Refusés</p>
                    <p className="text-2xl font-bold text-[#DC3545]">{statistiques.devisRefuses}</p>
                  </div>
                  <div className="bg-[#FFF3E0] p-4 rounded-lg">
                    <p className="text-sm text-[#6C757D]">Prix moyen</p>
                    <p className="text-2xl font-bold text-[#FF6B00]">
                      {statistiques.montantMoyenDevis.toFixed(0)}€
                    </p>
                  </div>
                </div>

                {/* Liste des devis */}
                <div>
                  <h3 className="text-lg font-semibold text-[#2C3E50] mb-3">
                    Tous les devis de la demande
                  </h3>
                  <div className="space-y-3">
                    {historiqueDevis.map((devis) => {
                      const isLitige = devis.id === litige.devisId;
                      return (
                        <div
                          key={devis.id}
                          className={`p-4 rounded-lg border-2 ${
                            isLitige
                              ? 'border-[#DC3545] bg-[#FFEBEE]'
                              : 'border-[#E9ECEF] bg-white'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-[#2C3E50] font-medium">
                                Devis #{devis.id.slice(0, 8)}
                                {isLitige && (
                                  <span className="ml-2 text-xs bg-[#DC3545] text-white px-2 py-1 rounded">
                                    ⚠️ EN LITIGE
                                  </span>
                                )}
                              </p>
                              <p className="text-sm text-[#6C757D]">
                                {devis.dateCreation?.toDate().toLocaleDateString('fr-FR')}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-[#2C3E50]">
                                {devis.totaux?.totalTTC?.toFixed(2) || 0} €
                              </p>
                              <p className="text-sm text-[#6C757D]">{devis.statut}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Tab Conversation */}
            {activeTab === 'conversation' && (
              <div className="space-y-6">
                {conversation && messages.length > 0 ? (
                  <>
                    <div className="bg-[#F8F9FA] p-4 rounded-lg">
                      <p className="text-sm text-[#6C757D]">
                        <strong>Conversation entre :</strong> Client et Artisan
                      </p>
                      <p className="text-sm text-[#6C757D] mt-1">
                        <strong>Demande :</strong> {demande?.titre || demande?.description?.slice(0, 50) + '...' || 'N/A'}
                      </p>
                      <p className="text-sm text-[#6C757D] mt-1">
                        <strong>Total messages :</strong> {messages.length}
                      </p>
                    </div>

                    {/* Liste des messages */}
                    <div className="space-y-4 max-h-[600px] overflow-y-auto">
                      {messages.map((message) => {
                        const isClient = message.senderId === litige.clientId;
                        const isDeleting = deletingMessageId === message.id;
                        
                        return (
                          <div
                            key={message.id}
                            className={`flex ${isClient ? 'justify-start' : 'justify-end'} group`}
                          >
                            <div className="flex items-end gap-2">
                              {/* 🗑️ Bouton suppression admin */}
                              <button
                                onClick={() => handleDeleteMessage(message.id)}
                                disabled={isDeleting}
                                className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 hover:bg-red-700 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs shadow-lg disabled:opacity-50"
                                title="[Admin] Supprimer ce message définitivement"
                              >
                                {isDeleting ? '⏳' : '🗑️'}
                              </button>
                              
                              <div
                                className={`max-w-[70%] rounded-lg p-4 ${
                                  isClient
                                    ? 'bg-[#E3F2FD] text-[#2C3E50]'
                                    : 'bg-[#FFF3E0] text-[#2C3E50]'
                                }`}
                              >
                                <div className="flex items-center mb-2">
                                  <span className="font-semibold text-sm">
                                    {isClient ? '👤 Client' : '🔨 Artisan'}
                                  </span>
                                  <span className="ml-2 text-xs text-[#6C757D]">
                                    {message.dateEnvoi?.toDate().toLocaleString('fr-FR')}
                                  </span>
                                </div>
                              <p className="text-sm whitespace-pre-wrap">{message.contenu}</p>
                              
                              {/* Indicateur modéré (coordonnées filtrées) */}
                              {message.modere && (
                                <div className="mt-2 text-xs text-[#DC3545] bg-[#FFEBEE] p-2 rounded">
                                  ⚠️ Message modéré (coordonnées détectées)
                                </div>
                              )}

                              {/* Fichier attaché */}
                              {message.fichierUrl && (
                                <div className="mt-2 p-2 bg-white rounded border border-[#E9ECEF]">
                                  <a 
                                    href={message.fichierUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-xs text-[#FF6B00] hover:underline"
                                  >
                                    📎 {message.fichierNom || 'Fichier joint'}
                                  </a>
                                </div>
                              )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-[#6C757D] text-lg">Aucune conversation trouvée pour cette demande</p>
                    <p className="text-[#6C757D] text-sm mt-2">
                      Les messages entre le client et l'artisan apparaîtront ici
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
