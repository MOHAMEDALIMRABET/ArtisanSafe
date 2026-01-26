'use client';

/**
 * Dashboard Admin - Gestion des Litiges et Historique des Conversations
 * Page: /admin/litiges
 * 
 * Permet aux administrateurs de :
 * - Consulter toutes les conversations entre clients et artisans
 * - Filtrer par statut de litige
 * - Rechercher par nom, email, ou ID
 * - Voir l'historique complet des messages
 * - Marquer/démarquer comme litige
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/config';
import { 
  collection, 
  query, 
  getDocs, 
  doc, 
  updateDoc,
  orderBy,
  where,
  Timestamp 
} from 'firebase/firestore';

interface Conversation {
  id: string;
  participants: string[];
  participantNames: { [key: string]: string };
  lastMessage: string;
  lastMessageDate: Timestamp;
  litige?: boolean;
  litigeDate?: Timestamp;
  litigeDescription?: string;
  litigeMarkedBy?: string;
  unreadCount?: { [key: string]: number };
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: Timestamp;
  read: boolean;
}

interface UserInfo {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  role: 'client' | 'artisan' | 'admin';
}

export default function AdminLitigesPage() {
  const router = useRouter();
  const { user, userProfile, authLoading } = useAuth();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [participantsInfo, setParticipantsInfo] = useState<{ [key: string]: UserInfo }>({});
  
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLitige, setFilterLitige] = useState<'all' | 'litige' | 'normal'>('all');
  
  const [showLitigeModal, setShowLitigeModal] = useState(false);
  const [litigeDescription, setLitigeDescription] = useState('');
  const [markingLitige, setMarkingLitige] = useState(false);

  // Vérification admin
  useEffect(() => {
    if (!authLoading && (!user || userProfile?.role !== 'admin')) {
      router.push('/');
    }
  }, [user, userProfile, authLoading, router]);

  // Charger toutes les conversations
  useEffect(() => {
    if (!user || userProfile?.role !== 'admin') return;

    async function loadAllConversations() {
      try {
        setLoading(true);
        const q = query(collection(db, 'conversations'));
        const querySnapshot = await getDocs(q);
        
        const convs: Conversation[] = [];
        const userIds = new Set<string>();

        querySnapshot.forEach((doc) => {
          const data = doc.data() as Omit<Conversation, 'id'>;
          convs.push({ id: doc.id, ...data });
          data.participants.forEach(uid => userIds.add(uid));
        });

        // Trier par date décroissante
        convs.sort((a, b) => {
          const dateA = a.lastMessageDate?.toMillis() || 0;
          const dateB = b.lastMessageDate?.toMillis() || 0;
          return dateB - dateA;
        });

        setConversations(convs);
        setFilteredConversations(convs);

        // Charger les infos des utilisateurs
        await loadUsersInfo(Array.from(userIds));
      } catch (error) {
        console.error('Erreur chargement conversations:', error);
      } finally {
        setLoading(false);
      }
    }

    loadAllConversations();
  }, [user, userProfile]);

  // Charger les infos des utilisateurs
  async function loadUsersInfo(userIds: string[]) {
    try {
      const usersInfo: { [key: string]: UserInfo } = {};
      
      for (const uid of userIds) {
        const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', uid)));
        if (!userDoc.empty) {
          const userData = userDoc.docs[0].data();
          usersInfo[uid] = {
            id: uid,
            email: userData.email || '',
            nom: userData.nom || '',
            prenom: userData.prenom || '',
            role: userData.role || 'client',
          };
        }
      }

      setParticipantsInfo(usersInfo);
    } catch (error) {
      console.error('Erreur chargement users:', error);
    }
  }

  // Charger les messages d'une conversation
  async function loadMessages(conversationId: string) {
    try {
      setLoadingMessages(true);
      const q = query(
        collection(db, 'messages'),
        where('conversationId', '==', conversationId)
      );
      
      const querySnapshot = await getDocs(q);
      const msgs: Message[] = [];

      querySnapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() } as Message);
      });

      // Trier par date croissante (ordre chronologique)
      msgs.sort((a, b) => {
        const dateA = a.createdAt?.toMillis() || 0;
        const dateB = b.createdAt?.toMillis() || 0;
        return dateA - dateB;
      });

      setMessages(msgs);
    } catch (error) {
      console.error('Erreur chargement messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  }

  // Sélectionner une conversation
  function handleSelectConversation(conversationId: string) {
    setSelectedConversation(conversationId);
    loadMessages(conversationId);
  }

  // Filtrer les conversations
  useEffect(() => {
    let filtered = conversations;

    // Filtre par recherche
    if (searchTerm) {
      filtered = filtered.filter(conv => {
        const names = Object.values(conv.participantNames || {}).join(' ').toLowerCase();
        const participants = conv.participants.map(uid => {
          const user = participantsInfo[uid];
          return user ? `${user.prenom} ${user.nom} ${user.email}`.toLowerCase() : '';
        }).join(' ');
        
        return names.includes(searchTerm.toLowerCase()) || 
               participants.includes(searchTerm.toLowerCase()) ||
               conv.id.includes(searchTerm);
      });
    }

    // Filtre par statut litige
    if (filterLitige === 'litige') {
      filtered = filtered.filter(conv => conv.litige === true);
    } else if (filterLitige === 'normal') {
      filtered = filtered.filter(conv => !conv.litige);
    }

    setFilteredConversations(filtered);
  }, [searchTerm, filterLitige, conversations, participantsInfo]);

  // Marquer comme litige
  async function handleMarkLitige() {
    if (!selectedConversation || !litigeDescription.trim()) {
      alert('Veuillez décrire le motif du litige');
      return;
    }

    try {
      setMarkingLitige(true);
      await updateDoc(doc(db, 'conversations', selectedConversation), {
        litige: true,
        litigeDate: Timestamp.now(),
        litigeDescription: litigeDescription.trim(),
        litigeMarkedBy: user?.uid,
      });

      // Mettre à jour l'état local
      setConversations(prev => prev.map(conv => 
        conv.id === selectedConversation 
          ? { 
              ...conv, 
              litige: true, 
              litigeDate: Timestamp.now(),
              litigeDescription: litigeDescription.trim(),
              litigeMarkedBy: user?.uid,
            }
          : conv
      ));

      setShowLitigeModal(false);
      setLitigeDescription('');
      alert('✅ Conversation marquée comme litige');
    } catch (error) {
      console.error('Erreur marquage litige:', error);
      alert('Erreur lors du marquage');
    } finally {
      setMarkingLitige(false);
    }
  }

  // Retirer le marquage litige
  async function handleUnmarkLitige() {
    if (!selectedConversation) return;
    
    if (!confirm('Voulez-vous retirer le marquage de litige ?')) return;

    try {
      await updateDoc(doc(db, 'conversations', selectedConversation), {
        litige: false,
        litigeDate: null,
        litigeDescription: null,
        litigeMarkedBy: null,
      });

      setConversations(prev => prev.map(conv => 
        conv.id === selectedConversation 
          ? { ...conv, litige: false }
          : conv
      ));

      alert('✅ Marquage litige retiré');
    } catch (error) {
      console.error('Erreur retrait litige:', error);
      alert('Erreur lors du retrait');
    }
  }

  // Exporter la conversation en PDF (fonctionnalité future)
  function handleExportConversation() {
    alert('Fonctionnalité d\'export PDF à venir');
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B00] mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement des conversations...</p>
        </div>
      </div>
    );
  }

  if (!user || userProfile?.role !== 'admin') {
    return null;
  }

  const selectedConv = conversations.find(c => c.id === selectedConversation);

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-[#2C3E50] mb-2">
            🛡️ Gestion des Litiges et Historique
          </h1>
          <p className="text-gray-600">
            Consultation de toutes les conversations entre clients et artisans pour résolution de litiges
          </p>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Recherche */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🔍 Rechercher une conversation
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Nom, email, ou ID de conversation..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
              />
            </div>

            {/* Filtre litige */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🚨 Statut
              </label>
              <select
                value={filterLitige}
                onChange={(e) => setFilterLitige(e.target.value as 'all' | 'litige' | 'normal')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
              >
                <option value="all">Toutes ({conversations.length})</option>
                <option value="litige">Litiges uniquement ({conversations.filter(c => c.litige).length})</option>
                <option value="normal">Normales ({conversations.filter(c => !c.litige).length})</option>
              </select>
            </div>
          </div>
        </div>

        {/* Interface split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Liste des conversations */}
          <div className="lg:col-span-1 bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-4 bg-[#2C3E50] text-white font-semibold">
              💬 Conversations ({filteredConversations.length})
            </div>
            <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
              {filteredConversations.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  Aucune conversation trouvée
                </div>
              ) : (
                filteredConversations.map(conv => {
                  const participant1 = participantsInfo[conv.participants[0]];
                  const participant2 = participantsInfo[conv.participants[1]];
                  
                  return (
                    <div
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv.id)}
                      className={`p-4 cursor-pointer hover:bg-gray-50 transition ${
                        selectedConversation === conv.id ? 'bg-blue-50 border-l-4 border-[#FF6B00]' : ''
                      }`}
                    >
                      {conv.litige && (
                        <span className="inline-block bg-red-500 text-white text-xs px-2 py-1 rounded mb-2">
                          🚨 LITIGE
                        </span>
                      )}
                      <p className="font-semibold text-gray-900">
                        {participant1 ? `${participant1.prenom} ${participant1.nom}` : 'Utilisateur inconnu'}
                        <span className="text-gray-500 text-xs ml-2">
                          ({participant1?.role || 'N/A'})
                        </span>
                      </p>
                      <p className="font-semibold text-gray-900">
                        {participant2 ? `${participant2.prenom} ${participant2.nom}` : 'Utilisateur inconnu'}
                        <span className="text-gray-500 text-xs ml-2">
                          ({participant2?.role || 'N/A'})
                        </span>
                      </p>
                      <p className="text-sm text-gray-600 mt-1 truncate">
                        {conv.lastMessage || 'Pas de message'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {conv.lastMessageDate?.toDate().toLocaleString('fr-FR') || 'Date inconnue'}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Historique des messages */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-md overflow-hidden">
            {!selectedConversation ? (
              <div className="p-8 text-center text-gray-500">
                <p className="text-lg">👈 Sélectionnez une conversation pour voir l'historique complet</p>
              </div>
            ) : (
              <>
                {/* Header conversation */}
                <div className="p-4 bg-[#2C3E50] text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold text-lg">
                        📜 Historique Complet
                      </h2>
                      {selectedConv && (
                        <p className="text-sm text-gray-300 mt-1">
                          ID: {selectedConv.id}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {selectedConv?.litige ? (
                        <button
                          onClick={handleUnmarkLitige}
                          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm"
                        >
                          ✅ Retirer litige
                        </button>
                      ) : (
                        <button
                          onClick={() => setShowLitigeModal(true)}
                          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm"
                        >
                          🚨 Marquer comme litige
                        </button>
                      )}
                      <button
                        onClick={handleExportConversation}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm"
                      >
                        📥 Exporter PDF
                      </button>
                    </div>
                  </div>

                  {/* Info litige */}
                  {selectedConv?.litige && (
                    <div className="mt-4 bg-red-600 p-3 rounded">
                      <p className="font-semibold">🚨 LITIGE DÉCLARÉ</p>
                      <p className="text-sm mt-1">
                        {selectedConv.litigeDescription || 'Pas de description'}
                      </p>
                      <p className="text-xs text-gray-200 mt-1">
                        Le {selectedConv.litigeDate?.toDate().toLocaleString('fr-FR')}
                      </p>
                    </div>
                  )}
                </div>

                {/* Messages */}
                <div className="p-4 max-h-[500px] overflow-y-auto bg-gray-50">
                  {loadingMessages ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF6B00] mx-auto"></div>
                    </div>
                  ) : messages.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">
                      Aucun message dans cette conversation
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((msg) => {
                        const sender = participantsInfo[msg.senderId];
                        const isArtisan = sender?.role === 'artisan';
                        
                        return (
                          <div
                            key={msg.id}
                            className={`flex ${isArtisan ? 'justify-start' : 'justify-end'}`}
                          >
                            <div className={`max-w-[70%] ${isArtisan ? 'bg-white border border-gray-300' : 'bg-[#FF6B00] text-white'} rounded-lg p-3 shadow`}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-sm">
                                  {sender ? `${sender.prenom} ${sender.nom}` : 'Utilisateur inconnu'}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  isArtisan ? 'bg-blue-100 text-blue-800' : 'bg-orange-200 text-orange-900'
                                }`}>
                                  {sender?.role || 'N/A'}
                                </span>
                              </div>
                              <p className={`text-sm ${isArtisan ? 'text-gray-800' : 'text-white'}`}>
                                {msg.content}
                              </p>
                              <p className={`text-xs mt-1 ${isArtisan ? 'text-gray-400' : 'text-orange-100'}`}>
                                {msg.createdAt?.toDate().toLocaleString('fr-FR')}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal marquage litige */}
      {showLitigeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-[#2C3E50] mb-4">
              🚨 Marquer comme litige
            </h3>
            <p className="text-gray-600 mb-4">
              Décrivez le motif du litige pour archivage et suivi :
            </p>
            <textarea
              value={litigeDescription}
              onChange={(e) => setLitigeDescription(e.target.value)}
              placeholder="Ex: Non-paiement, malfaçons, abandon de chantier..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent mb-4"
              rows={4}
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowLitigeModal(false);
                  setLitigeDescription('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleMarkLitige}
                disabled={markingLitige || !litigeDescription.trim()}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {markingLitige ? '⏳' : '🚨'} Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
