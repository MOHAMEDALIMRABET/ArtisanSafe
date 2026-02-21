'use client';

/**
 * Page Détail Ticket Support - Artisan
 * Permet à l'artisan de voir son ticket et répondre
 */

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  getSupportTicketById,
  addTicketResponse,
  markTicketResponsesAsRead,
  getCategorieLabel,
  getStatutColor,
  type SupportTicket,
} from '@/lib/firebase/support-ticket-service';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export default function TicketDetailPage() {
  const router = useRouter();
  const params = useParams();
  const ticketId = params.id as string;
  const { user, loading: authLoading } = useAuth();

  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [reponseMessage, setReponseMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Charger ticket
  useEffect(() => {
    if (!user || !ticketId) return;

    const loadTicket = async () => {
      try {
        const ticketData = await getSupportTicketById(ticketId);

        if (!ticketData) {
          alert('❌ Ticket introuvable');
          router.push('/artisan/contact-support');
          return;
        }

        // Vérifier que c'est bien le ticket de l'artisan
        if (ticketData.userId !== user.uid) {
          alert('❌ Accès non autorisé');
          router.push('/artisan/contact-support');
          return;
        }

        setTicket(ticketData);

        // Marquer réponses admin comme lues
        if (ticketData.nonLuParUser) {
          await markTicketResponsesAsRead(ticketId);
        }
      } catch (error) {
        console.error('Erreur chargement ticket:', error);
        alert('❌ Erreur lors du chargement');
      } finally {
        setLoading(false);
      }
    };

    loadTicket();
  }, [user, ticketId, router]);

  // Envoyer réponse
  const handleSendReponse = async () => {
    if (!ticket || !reponseMessage.trim() || !user) return;

    setSubmitting(true);

    try {
      // Récupérer nom artisan
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userName = userDoc.exists()
        ? `${userDoc.data().prenom || ''} ${userDoc.data().nom || ''}`.trim() || user.email || 'Artisan'
        : user.email || 'Artisan';

      await addTicketResponse(ticket.id, {
        auteurId: user.uid,
        auteurNom: userName,
        auteurRole: 'artisan',
        message: reponseMessage,
      });

      alert('✅ Réponse envoyée ! Le support sera notifié.');

      setReponseMessage('');

      // Recharger ticket
      const updatedTicket = await getSupportTicketById(ticketId);
      if (updatedTicket) {
        setTicket(updatedTicket);
      }
    } catch (error) {
      console.error('Erreur envoi réponse:', error);
      alert('❌ Erreur lors de l\'envoi. Veuillez réessayer.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B00] mx-auto mb-4"></div>
          <p className="text-[#6C757D]">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    router.push('/connexion');
    return null;
  }

  if (!ticket) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/artisan/contact-support')}
            className="text-[#6C757D] hover:text-[#2C3E50] mb-4 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Retour à mes tickets
          </button>

          <div className="flex items-start justify-between">
            <div>
              <span className="text-sm font-mono text-[#6C757D]">{ticket.numero}</span>
              <h1 className="text-3xl font-bold text-[#2C3E50] mt-1">
                {ticket.sujet}
              </h1>
            </div>
            <span className={`px-3 py-1 rounded text-sm font-semibold ${getStatutColor(ticket.statut)}`}>
              {ticket.statut}
            </span>
          </div>

          <div className="flex flex-wrap gap-4 mt-4 text-sm text-[#6C757D]">
            <div>
              <strong>Catégorie:</strong> {getCategorieLabel(ticket.categorie)}
            </div>
            <div>
              <strong>Créé:</strong> {ticket.createdAt.toDate().toLocaleString('fr-FR')}
            </div>
            {ticket.updatedAt && ticket.updatedAt.toMillis() !== ticket.createdAt.toMillis() && (
              <div>
                <strong>Dernière activité:</strong> {ticket.updatedAt.toDate().toLocaleString('fr-FR')}
              </div>
            )}
          </div>
        </div>

        {/* Conversation */}
        <div className="bg-white rounded-lg shadow">
          {/* Message initial */}
          <div className="p-6 border-b bg-gray-50">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold flex-shrink-0">
                {ticket.userNom.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <strong className="text-[#2C3E50]">{ticket.userNom}</strong>
                    <span className="text-xs text-[#6C757D]">
                      {ticket.createdAt.toDate().toLocaleString('fr-FR')}
                    </span>
                  </div>
                  <p className="text-[#2C3E50] whitespace-pre-wrap">{ticket.message}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Réponses */}
          {ticket.reponses.length > 0 && (
            <div className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
              {ticket.reponses.map((reponse, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-3 ${
                    reponse.auteurRole === 'admin' ? '' : 'flex-row-reverse'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${
                      reponse.auteurRole === 'admin'
                        ? 'bg-[#FF6B00] text-white'
                        : 'bg-blue-500 text-white'
                    }`}
                  >
                    {reponse.auteurNom.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div
                      className={`rounded-lg p-4 shadow-sm ${
                        reponse.auteurRole === 'admin' ? 'bg-orange-50' : 'bg-blue-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <strong className="text-[#2C3E50]">
                          {reponse.auteurRole === 'admin' ? '🛡️ Support ArtisanDispo' : reponse.auteurNom}
                        </strong>
                        <span className="text-xs text-[#6C757D]">
                          {reponse.dateReponse.toDate().toLocaleString('fr-FR')}
                        </span>
                      </div>
                      <p className="text-[#2C3E50] whitespace-pre-wrap">{reponse.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Formulaire réponse (seulement si pas fermé) */}
          {ticket.statut !== 'ferme' ? (
            <div className="p-6 border-t bg-gray-50">
              <label className="block text-sm font-medium text-[#2C3E50] mb-2">
                Votre réponse
              </label>
              <textarea
                value={reponseMessage}
                onChange={(e) => setReponseMessage(e.target.value)}
                placeholder="Écrivez votre message au support..."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent resize-none"
                maxLength={2000}
              />
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-[#6C757D]">
                  {reponseMessage.length}/2000 caractères
                </p>
                <button
                  onClick={handleSendReponse}
                  disabled={!reponseMessage.trim() || submitting}
                  className="bg-[#FF6B00] text-white px-6 py-2 rounded-lg font-semibold hover:bg-[#E56100] disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                >
                  {submitting ? 'Envoi...' : '📨 Envoyer'}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 border-t bg-gray-100 text-center">
              <p className="text-[#6C757D]">
                🔒 Ce ticket est fermé. Créez un nouveau ticket si vous avez besoin d'aide.
              </p>
              <button
                onClick={() => router.push('/artisan/contact-support')}
                className="mt-3 text-[#FF6B00] hover:underline font-semibold"
              >
                Créer un nouveau ticket
              </button>
            </div>
          )}
        </div>

        {/* Info statut */}
        {ticket.statut === 'resolu' && (
          <div className="mt-4 bg-green-50 border-l-4 border-green-500 p-4 rounded">
            <p className="text-green-800 text-sm">
              ✅ <strong>Ticket résolu</strong> - Si votre problème persiste, vous pouvez répondre ci-dessus ou créer un nouveau ticket.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
