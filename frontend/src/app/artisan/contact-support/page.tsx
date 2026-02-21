'use client';

/**
 * Page Contact Support - Artisan
 * Permet aux artisans de créer des tickets de support
 */

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  createSupportTicket,
  getUserSupportTickets,
  getCategorieLabel,
  getStatutColor,
  type SupportTicket,
  type SupportTicketCategorie,
} from '@/lib/firebase/support-ticket-service';

export default function ContactSupportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  // Formulaire
  const [categorie, setCategorie] = useState<SupportTicketCategorie>('autre');
  const [sujet, setSujet] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Historique tickets
  const [mesTickets, setMesTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);

  // Pré-remplir catégorie si passée en URL
  useEffect(() => {
    const categorieParam = searchParams.get('sujet') as SupportTicketCategorie;
    const categories: SupportTicketCategorie[] = [
      'modification_iban',
      'compte_restreint',
      'verification_documents',
      'probleme_technique',
      'question_generale',
      'autre',
    ];

    if (categorieParam && categories.includes(categorieParam)) {
      setCategorie(categorieParam);

      // Pré-remplir sujet selon catégorie
      const sujets: Record<string, string> = {
        modification_iban: 'Modification de mon IBAN',
        compte_restreint: 'Mon compte Stripe est restreint',
        verification_documents: 'Question sur la vérification de mes documents',
      };

      setSujet(sujets[categorieParam] || '');
    }
  }, [searchParams]);

  // Charger tickets existants
  useEffect(() => {
    if (!user) return;

    const loadTickets = async () => {
      try {
        const tickets = await getUserSupportTickets(user.uid);
        setMesTickets(tickets);
      } catch (error) {
        console.error('Erreur chargement tickets:', error);
      } finally {
        setLoadingTickets(false);
      }
    };

    loadTickets();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      alert('❌ Vous devez être connecté');
      return;
    }

    if (!sujet.trim() || !message.trim()) {
      alert('❌ Veuillez remplir tous les champs');
      return;
    }

    setSubmitting(true);

    try {
      // Récupérer nom utilisateur
      const userDoc = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${user.uid}`);
      const userData = await userDoc.json();
      const userNom = `${userData.prenom || ''} ${userData.nom || ''}`.trim() || user.email || 'Artisan';

      await createSupportTicket({
        userId: user.uid,
        userEmail: user.email || '',
        userNom,
        userRole: 'artisan',
        categorie,
        sujet,
        message,
        priorite: categorie === 'compte_restreint' ? 'haute' : 'normale',
      });

      // Success
      setShowSuccess(true);
      setSujet('');
      setMessage('');

      // Recharger tickets
      const tickets = await getUserSupportTickets(user.uid);
      setMesTickets(tickets);

      // Auto-dismiss après 5 secondes
      setTimeout(() => setShowSuccess(false), 5000);
    } catch (error) {
      console.error('Erreur création ticket:', error);
      alert('❌ Erreur lors de l\'envoi. Veuillez réessayer ou contacter support@artisandispo.fr');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-[#6C757D] hover:text-[#2C3E50] mb-4 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Retour
          </button>

          <h1 className="text-3xl font-bold text-[#2C3E50] mb-2">
            💬 Contacter le Support
          </h1>
          <p className="text-[#6C757D]">
            Notre équipe vous répondra sous <strong>24-48 heures</strong>
          </p>
        </div>

        {/* Message succès */}
        {showSuccess && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-green-800 font-semibold mb-1">✅ Ticket créé avec succès</h3>
                <p className="text-green-700 text-sm">
                  Votre demande a été enregistrée. Vous recevrez une notification par email dès qu'un administrateur vous répondra.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {/* Formulaire (2/3) */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-[#2C3E50] mb-4">
                📝 Nouvelle demande
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Catégorie */}
                <div>
                  <label className="block text-sm font-medium text-[#2C3E50] mb-2">
                    Catégorie <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={categorie}
                    onChange={(e) => setCategorie(e.target.value as SupportTicketCategorie)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                    required
                  >
                    <option value="modification_iban">💳 Modification IBAN</option>
                    <option value="compte_restreint">⚠️ Compte Restreint</option>
                    <option value="verification_documents">📄 Vérification Documents</option>
                    <option value="probleme_technique">🔧 Problème Technique</option>
                    <option value="question_generale">❓ Question Générale</option>
                    <option value="autre">📌 Autre</option>
                  </select>
                </div>

                {/* Sujet */}
                <div>
                  <label className="block text-sm font-medium text-[#2C3E50] mb-2">
                    Sujet <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={sujet}
                    onChange={(e) => setSujet(e.target.value)}
                    placeholder="Ex: Modification de mon IBAN après changement de banque"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                    maxLength={150}
                    required
                  />
                  <p className="text-xs text-[#6C757D] mt-1">{sujet.length}/150 caractères</p>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-medium text-[#2C3E50] mb-2">
                    Message détaillé <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Décrivez votre demande en détail..."
                    rows={8}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent resize-none"
                    maxLength={2000}
                    required
                  />
                  <p className="text-xs text-[#6C757D] mt-1">{message.length}/2000 caractères</p>
                </div>

                {/* Info importante */}
                {categorie === 'modification_iban' && (
                  <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                    <p className="text-blue-800 text-sm">
                      💡 <strong>Pour modifier votre IBAN :</strong> Veuillez préciser votre ancien et nouveau IBAN dans le message.
                      Un justificatif bancaire (RIB) pourra vous être demandé.
                    </p>
                  </div>
                )}

                {/* Boutons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={submitting || !sujet.trim() || !message.trim()}
                    className="flex-1 bg-[#FF6B00] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#E56100] disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Envoi en cours...
                      </span>
                    ) : (
                      '📨 Envoyer la demande'
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="px-6 py-3 border-2 border-gray-300 text-[#6C757D] rounded-lg font-semibold hover:bg-gray-50 transition"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Mes tickets (1/3) */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-[#2C3E50] mb-4">
                📋 Mes demandes
              </h2>

              {loadingTickets ? (
                <p className="text-[#6C757D] text-sm text-center py-4">Chargement...</p>
              ) : mesTickets.length === 0 ? (
                <p className="text-[#6C757D] text-sm text-center py-4">
                  Aucune demande en cours
                </p>
              ) : (
                <div className="space-y-3">
                  {mesTickets.slice(0, 5).map((ticket) => (
                    <div
                      key={ticket.id}
                      className="border border-gray-200 rounded-lg p-3 hover:border-[#FF6B00] transition cursor-pointer"
                      onClick={() => router.push(`/artisan/contact-support/${ticket.id}`)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-xs font-mono text-[#6C757D]">{ticket.numero}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${getStatutColor(ticket.statut)}`}>
                          {ticket.statut}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-[#2C3E50] mb-1 line-clamp-1">
                        {ticket.sujet}
                      </p>
                      <p className="text-xs text-[#6C757D]">
                        {getCategorieLabel(ticket.categorie)}
                      </p>
                      {ticket.nonLuParUser && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-[#FF6B00] font-semibold">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                          </svg>
                          Nouvelle réponse
                        </div>
                      )}
                    </div>
                  ))}

                  {mesTickets.length > 5 && (
                    <button
                      onClick={() => router.push('/artisan/mes-tickets')}
                      className="w-full text-[#FF6B00] hover:underline text-sm font-medium py-2"
                    >
                      Voir tous mes tickets ({mesTickets.length})
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Info utile */}
            <div className="bg-blue-50 rounded-lg p-4 mt-4">
              <h3 className="font-semibold text-[#2C3E50] mb-2 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Info utile
              </h3>
              <ul className="text-sm text-[#6C757D] space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 flex-shrink-0">✓</span>
                  <span>Réponse sous 24-48h (jours ouvrés)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 flex-shrink-0">✓</span>
                  <span>Notification email à chaque réponse</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 flex-shrink-0">✓</span>
                  <span>Suivi complet de votre demande</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
