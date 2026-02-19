'use client';

/**
 * Page de messagerie avec système anti-bypass intégré
 * Permet la communication sécurisée entre artisans et clients
 */

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  Timestamp,
  or,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { validateMessage } from '@/lib/antiBypassValidator';

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: Timestamp;
  read: boolean;
}

interface Conversation {
  id: string;
  participants: string[];
  participantNames: Record<string, string>;
  lastMessage: string;
  lastMessageDate: Timestamp;
  unreadCount?: number;
  devisId?: string; // Lien vers le devis associé (si conversation créée depuis un devis)
  demandeId?: string; // Lien vers la demande associée
}

interface UserInfo {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
}

// Composant pour afficher une conversation dans la liste
function ConversationItem({ 
  conversation, 
  otherUserId, 
  defaultName, 
  isSelected, 
  onClick 
}: { 
  conversation: Conversation; 
  otherUserId: string; 
  defaultName: string; 
  isSelected: boolean; 
  onClick: () => void;
}) {
  const [fullName, setFullName] = useState(defaultName);

  useEffect(() => {
    if (!otherUserId) return;

    const loadFullName = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', otherUserId));
        if (userDoc.exists()) {
          const data = userDoc.data();
          const prenom = data.prenom || '';
          const nom = data.nom || '';
          const name = `${prenom} ${nom}`.trim() || data.email || 'Utilisateur';
          setFullName(name);
        }
      } catch (error) {
        console.error('Erreur chargement nom:', error);
      }
    };

    loadFullName();
  }, [otherUserId]);

  return (
    <button
      onClick={onClick}
      className={`w-full p-4 border-b hover:bg-gray-50 transition text-left ${
        isSelected ? 'bg-blue-50 border-l-4 border-[#FF6B00]' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-[#2C3E50]">{fullName}</span>
        {conversation.unreadCount && conversation.unreadCount > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {conversation.unreadCount}
          </span>
        )}
      </div>
      <p className="text-sm text-gray-600 truncate">{conversation.lastMessage || 'Aucun message'}</p>
      <p className="text-xs text-gray-400 mt-1">
        {conversation.lastMessageDate?.toDate().toLocaleDateString('fr-FR')}
      </p>
    </button>
  );
}

export default function MessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetUserId = searchParams?.get('userId');
  const devisIdParam = searchParams?.get('devisId'); // Paramètre optionnel depuis les pages devis
  const demandeIdParam = searchParams?.get('demandeId'); // Paramètre optionnel depuis les pages demandes
  const { user, loading: authLoading } = useAuth();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [otherUserInfo, setOtherUserInfo] = useState<UserInfo | null>(null);
  const [messageContent, setMessageContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [validationWarning, setValidationWarning] = useState<string | null>(null);
  
  // États pour gérer le statut du devis associé
  const [devisStatus, setDevisStatus] = useState<string | null>(null);
  const [devisInfo, setDevisInfo] = useState<{ numeroDevis?: string; montantTTC?: number; typeRefus?: 'definitif' | 'revision' } | null>(null);
  const [isConversationInactive, setIsConversationInactive] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Charger les conversations de l'utilisateur
  useEffect(() => {
    if (authLoading || !user) return;

    const q = query(
      collection(db, 'conversations'),
      or(
        where('participants', 'array-contains', user.uid)
      )
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const convs: Conversation[] = [];
      
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        convs.push({
          id: docSnap.id,
          participants: data.participants || [],
          participantNames: data.participantNames || {},
          lastMessage: data.lastMessage || '',
          lastMessageDate: data.lastMessageDate || Timestamp.now(),
          unreadCount: data.unreadCount?.[user.uid] || 0,
        });
      }

      // Trier par date de dernier message
      convs.sort((a, b) => {
        const dateA = a.lastMessageDate?.toMillis() || 0;
        const dateB = b.lastMessageDate?.toMillis() || 0;
        return dateB - dateA;
      });

      setConversations(convs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, authLoading]);

  // Si userId fourni dans l'URL, créer/ouvrir conversation
  useEffect(() => {
    if (!user || !targetUserId || loading) return;

    // Chercher conversation existante
    const existingConv = conversations.find(c => 
      c.participants.includes(targetUserId)
    );

    if (existingConv) {
      setSelectedConversation(existingConv.id);
    } else {
      // Créer nouvelle conversation si elle n'existe pas encore
      if (!loading) {
        createConversation(targetUserId);
      }
    }
  }, [targetUserId, user, conversations, loading]);

  // Charger les messages de la conversation sélectionnée
  useEffect(() => {
    if (!selectedConversation) {
      setMessages([]);
      return;
    }

    // Requête simple sans orderBy pour éviter l'index composite
    const q = query(
      collection(db, 'messages'),
      where('conversationId', '==', selectedConversation)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Message));

      console.log(`📨 Messages chargés pour conversation ${selectedConversation}:`, msgs.length);
      msgs.forEach(msg => {
        console.log(`  - Message ${msg.id}:`, {
          senderId: msg.senderId,
          content: msg.content.substring(0, 30),
          createdAt: msg.createdAt?.toDate?.()
        });
      });

      // Tri côté client par date de création
      msgs.sort((a, b) => {
        const dateA = a.createdAt?.toMillis() || 0;
        const dateB = b.createdAt?.toMillis() || 0;
        return dateA - dateB; // Ordre croissant (ancien → récent)
      });

      setMessages(msgs);
      
      // Marquer comme lu
      markAsRead(selectedConversation);
    });

    return () => unsubscribe();
  }, [selectedConversation]);

  // Charger les infos de l'autre utilisateur
  useEffect(() => {
    if (!selectedConversation || !user) return;

    const conv = conversations.find(c => c.id === selectedConversation);
    if (!conv) return;

    const otherUserId = conv.participants.find(p => p !== user.uid);
    if (!otherUserId) return;

    loadUserInfo(otherUserId);
  }, [selectedConversation, user, conversations]);

  // Charger le devis associé pour vérifier son statut
  useEffect(() => {
    if (!selectedConversation || !conversations.length) return;

    const loadDevisStatus = async () => {
      const conv = conversations.find(c => c.id === selectedConversation);
      if (!conv || !conv.devisId) {
        // Pas de devis associé → conversation normale, toujours active
        setDevisStatus(null);
        setDevisInfo(null);
        setIsConversationInactive(false);
        return;
      }

      try {
        // Charger le devis
        const devisDoc = await getDoc(doc(db, 'devis', conv.devisId));
        
        if (!devisDoc.exists()) {
          console.warn('Devis introuvable:', conv.devisId);
          setDevisStatus(null);
          setDevisInfo(null);
          setIsConversationInactive(false);
          return;
        }

        const devisData = devisDoc.data();
        const statut = devisData.statut;
        const typeRefus = devisData.typeRefus;
        
        setDevisStatus(statut);
        setDevisInfo({
          numeroDevis: devisData.numeroDevis,
          montantTTC: devisData.totaux?.montantTTC || devisData.montantTTC,
          typeRefus: typeRefus,
        });

        // Vérifier si le devis est dans un état terminal (conversation inactive)
        // ⚠️ IMPORTANT : Refus définitif = conversation close, Refus révision = conversation active
        let isInactive = false;
        
        if (statut === 'refuse') {
          // Refus définitif → conversation close
          // Refus révision → conversation reste active (artisan peut proposer variante)
          isInactive = typeRefus === 'definitif';
        } else if (statut === 'annule' || statut === 'expire') {
          // Annulation ou expiration → toujours inactive
          isInactive = true;
        } else if (statut === 'termine_valide' || statut === 'termine_auto_valide') {
          // Travaux terminés ET validés par les deux parties → conversation close
          // Plus besoin de communication, prestation complète et acceptée
          isInactive = true;
        }
        
        setIsConversationInactive(isInactive);

        if (isInactive) {
          console.log(`🚫 Conversation ${selectedConversation} inactive (devis ${statut}${statut === 'refuse' ? `, typeRefus: ${typeRefus}` : ''})`);
        } else if (statut === 'refuse' && typeRefus === 'revision') {
          console.log(`✅ Conversation ${selectedConversation} active (refus révision - artisan peut proposer variante)`);
        }
      } catch (error) {
        console.error('Erreur chargement statut devis:', error);
        setDevisStatus(null);
        setDevisInfo(null);
        setIsConversationInactive(false);
      }
    };

    loadDevisStatus();
  }, [selectedConversation, conversations]);

  // Auto-scroll vers le bas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Redirection si non connecté
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/connexion');
    }
  }, [user, authLoading, router]);

  // Créer une nouvelle conversation
  const createConversation = async (otherUserId: string) => {
    if (!user) return;

    try {
      // Charger infos des deux utilisateurs
      const [currentUserDoc, otherUserDoc] = await Promise.all([
        getDoc(doc(db, 'users', user.uid)),
        getDoc(doc(db, 'users', otherUserId)),
      ]);

      const currentUserData = currentUserDoc.data();
      const otherUserData = otherUserDoc.data();

      const currentUserName = `${currentUserData?.prenom || ''} ${currentUserData?.nom || ''}`.trim() || currentUserData?.email || 'Utilisateur';
      const otherUserName = `${otherUserData?.prenom || ''} ${otherUserData?.nom || ''}`.trim() || otherUserData?.email || 'Utilisateur';

      // Préparer les données de la conversation
      const conversationData: any = {
        participants: [user.uid, otherUserId],
        participantNames: {
          [user.uid]: currentUserName,
          [otherUserId]: otherUserName,
        },
        lastMessage: '',
        lastMessageDate: serverTimestamp(),
        createdAt: serverTimestamp(),
      };

      // Ajouter devisId et demandeId si présents (provenant des paramètres URL)
      if (devisIdParam) {
        conversationData.devisId = devisIdParam;
        console.log('📎 Conversation liée au devis:', devisIdParam);
      }
      if (demandeIdParam) {
        conversationData.demandeId = demandeIdParam;
        console.log('📎 Conversation liée à la demande:', demandeIdParam);
      }

      const conversationRef = await addDoc(collection(db, 'conversations'), conversationData);

      setSelectedConversation(conversationRef.id);
    } catch (error) {
      console.error('Erreur création conversation:', error);
    }
  };

  // Charger les infos d'un utilisateur
  const loadUserInfo = async (userId: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        const prenom = data.prenom || '';
        const nom = data.nom || '';
        const fullName = `${prenom} ${nom}`.trim() || data.email || 'Utilisateur';
        
        setOtherUserInfo({
          uid: userId,
          displayName: fullName,
          email: data.email,
          photoURL: data.photoURL,
        });
      }
    } catch (error) {
      console.error('Erreur chargement utilisateur:', error);
    }
  };

  // Marquer les messages comme lus
  const markAsRead = async (conversationId: string) => {
    if (!user) return;

    try {
      const convRef = doc(db, 'conversations', conversationId);
      await updateDoc(convRef, {
        [`unreadCount.${user.uid}`]: 0,
      });
    } catch (error) {
      console.error('Erreur marquer comme lu:', error);
    }
  };

  // Valider le message en temps réel
  const handleMessageChange = (value: string) => {
    setMessageContent(value);
    
    // Validation instantanée (affichage warning en temps réel)
    // La validation complète multi-couches se fera à l'envoi
    // 🎉 DEVIS PAYÉ : Bypass validation (permet échange téléphone/email/adresse)
    // Statuts post-paiement où l'échange de coordonnées est autorisé
    const statutsPostPaiement = ['paye', 'en_cours', 'travaux_termines', 'termine_valide', 'termine_auto_valide', 'litige'];
    const isPaid = devisStatus ? statutsPostPaiement.includes(devisStatus) : false;
    const validation = validateMessage(value, isPaid);
    if (!validation.isValid) {
      setValidationWarning(validation.message || '');
    } else {
      setValidationWarning(null);
    }
  };

  // Envoyer un message avec validation multi-couches
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !selectedConversation || !messageContent.trim()) return;

    // ========================================
    // VÉRIFICATION : Conversation inactive ?
    // ========================================
    if (isConversationInactive) {
      alert('❌ Impossible d\'envoyer un message.\n\nCette conversation est close car le devis a été annulé, refusé ou a expiré.');
      return;
    }

    setSending(true);

    try {
      // ========================================
      // VALIDATION MULTI-COUCHES
      // ========================================
      // 🎉 DEVIS PAYÉ : Bypass validation (permet échange téléphone/email/adresse)
      // Statuts post-paiement où l'échange de coordonnées est autorisé
      const statutsPostPaiement = ['paye', 'en_cours', 'travaux_termines', 'termine_valide', 'termine_auto_valide', 'litige'];
      const isPaid = devisStatus ? statutsPostPaiement.includes(devisStatus) : false;
      const validation = validateMessage(messageContent.trim(), isPaid);

      if (!validation.isValid) {
        alert(validation.message);
        setSending(false);
        return;
      }

      const conv = conversations.find(c => c.id === selectedConversation);
      if (!conv) return;

      const receiverId = conv.participants.find(p => p !== user.uid);
      if (!receiverId) return;

      // Créer le message
      await addDoc(collection(db, 'messages'), {
        conversationId: selectedConversation,
        senderId: user.uid,
        receiverId,
        content: messageContent.trim(),
        createdAt: serverTimestamp(),
        read: false,
      });

      // Mettre à jour la conversation
      await updateDoc(doc(db, 'conversations', selectedConversation), {
        lastMessage: messageContent.trim().substring(0, 100),
        lastMessageDate: serverTimestamp(),
        [`unreadCount.${receiverId}`]: (conv.unreadCount || 0) + 1,
      });

      setMessageContent('');
      setValidationWarning(null);
    } catch (error) {
      console.error('Erreur envoi message:', error);
      alert('Erreur lors de l\'envoi du message');
    } finally {
      setSending(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B00] mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Redirection gérée par useEffect
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] pt-20">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-[#2C3E50] mb-6">💬 Messagerie</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
          {/* Liste des conversations */}
          <div className="lg:col-span-1 bg-white rounded-lg shadow-md overflow-hidden">
            <div className="bg-[#2C3E50] text-white p-4">
              <h2 className="font-semibold">Conversations</h2>
            </div>
            
            <div className="overflow-y-auto h-full">
              {loading ? (
                <div className="p-4 text-center text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF6B00] mx-auto mb-2"></div>
                  Chargement...
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <svg className="w-16 h-16 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p>Aucune conversation</p>
                </div>
              ) : (
                conversations.map((conv) => {
                  const otherUserId = conv.participants.find(p => p !== user.uid);
                  // Essayer d'abord participantNames, sinon chercher dans les données utilisateur
                  let otherUserName = otherUserId ? conv.participantNames[otherUserId] : 'Utilisateur';
                  
                  return (
                    <ConversationItem
                      key={conv.id}
                      conversation={conv}
                      otherUserId={otherUserId || ''}
                      defaultName={otherUserName}
                      isSelected={selectedConversation === conv.id}
                      onClick={() => setSelectedConversation(conv.id)}
                    />
                  );
                })
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-md flex flex-col overflow-hidden">
            {selectedConversation && otherUserInfo ? (
              <>
                {/* Header */}
                <div className="bg-[#2C3E50] text-white p-4 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">{otherUserInfo.displayName}</h2>
                  </div>
                  <button
                    onClick={() => setSelectedConversation(null)}
                    className="lg:hidden text-white hover:text-gray-300"
                  >
                    ✕
                  </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {/* Bandeau conversation inactive */}
                  {isConversationInactive && (
                    <div className="mb-4 p-4 bg-gray-100 border-l-4 border-gray-500 rounded">
                      <div className="flex items-start">
                        <span className="text-2xl mr-3">🚫</span>
                        <div>
                          <h3 className="font-semibold text-gray-700 mb-1">
                            Conversation close
                          </h3>
                          <p className="text-sm text-gray-600">
                            {devisStatus === 'annule' && 'Le devis a été annulé. Vous ne pouvez plus envoyer de messages.'}
                            {devisStatus === 'refuse' && 'Le client a refusé définitivement de travailler avec cet artisan. Vous ne pouvez plus envoyer de messages.'}
                            {devisStatus === 'expire' && 'Le devis a expiré. Vous ne pouvez plus envoyer de messages.'}
                            {(devisStatus === 'termine_valide' || devisStatus === 'termine_auto_valide') && 'Les travaux ont été terminés et validés par les deux parties. Cette conversation est maintenant close. Vous pouvez consulter l\'historique mais ne pouvez plus envoyer de messages.'}
                          </p>
                          {devisInfo?.numeroDevis && (
                            <p className="text-xs text-gray-500 mt-1">
                              Devis #{devisInfo.numeroDevis}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {messages.map((msg) => {
                    const isOwn = msg.senderId === user.uid;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${
                          isConversationInactive ? 'opacity-50' : ''
                        }`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg px-4 py-2 ${
                            isOwn
                              ? 'bg-[#FF6B00] text-white'
                              : 'bg-gray-200 text-[#2C3E50]'
                          }`}
                        >
                          <p className="break-words">{msg.content}</p>
                          <p className={`text-xs mt-1 ${isOwn ? 'text-orange-100' : 'text-gray-500'}`}>
                            {msg.createdAt?.toDate().toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Avertissement anti-bypass */}
                {validationWarning && (
                  <div className="px-4 py-2 bg-red-50 border-t-2 border-red-500">
                    <p className="text-sm text-red-700 whitespace-pre-line">{validationWarning}</p>
                  </div>
                )}

                {/* Formulaire */}
                <form 
                  onSubmit={handleSendMessage} 
                  className={`p-4 border-t ${
                    isConversationInactive ? 'bg-gray-200' : 'bg-gray-50'
                  }`}
                >
                  {isConversationInactive && (
                    <div className="mb-2 text-center">
                      <p className="text-sm text-gray-500 italic">
                        ❌ Conversation close - Envoi de messages désactivé
                      </p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={messageContent}
                      onChange={(e) => handleMessageChange(e.target.value)}
                      placeholder={
                        isConversationInactive 
                          ? "Conversation close" 
                          : "Écrivez votre message..."
                      }
                      className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent ${
                        isConversationInactive 
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-300' 
                          : 'bg-white border-gray-300'
                      }`}
                      disabled={sending || isConversationInactive}
                    />
                    <button
                      type="submit"
                      disabled={sending || !messageContent.trim() || !!validationWarning || isConversationInactive}
                      className="bg-[#FF6B00] text-white px-6 py-2 rounded-lg font-semibold hover:bg-[#E56100] transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sending ? '⏳' : '📤'} Envoyer
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <svg className="w-20 h-20 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-lg font-medium">Sélectionnez une conversation</p>
                  <p className="text-sm text-gray-400 mt-2">ou créez-en une nouvelle</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
