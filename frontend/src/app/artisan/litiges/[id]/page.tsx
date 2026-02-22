/**
 * Page Artisan - Détail Litige
 * Vue complète d'un litige avec timeline et actions
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStatus } from '@/hooks/useAuthStatus';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  getLitigeById,
  addLitigeComment,
  acceptLitigeResolution,
  rejectLitigeResolution,
} from '@/lib/firebase/litige-service';
import { Litige } from '@/types/litige';
import LitigeTimeline from '@/components/litiges/LitigeTimeline';
import { ArrowLeft, MessageSquare, CheckCircle, XCircle, AlertTriangle, FileText } from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';

export default function ArtisanLitigeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuthStatus();
  const { t } = useLanguage();
  const [litige, setLitige] = useState<Litige | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentaire, setCommentaire] = useState('');
  const [motifRefus, setMotifRefus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showRefusForm, setShowRefusForm] = useState(false);

  const litigeId = params.id as string;

  useEffect(() => {
    if (authLoading) return;
    if (!user || role !== 'artisan') {
      router.push('/login');
      return;
    }

    loadLitige();
  }, [user, role, authLoading, litigeId]);

  async function loadLitige() {
    try {
      setLoading(true);
      const data = await getLitigeById(litigeId);
      
      if (!data) {
        alert(t('alerts.dispute.notFound'));
        router.push('/artisan/litiges');
        return;
      }

      // Vérifier que l'utilisateur est bien l'artisan
      if (data.artisanId !== user?.uid) {
        alert(t('alerts.dispute.accessDenied'));
        router.push('/artisan/litiges');
        return;
      }

      setLitige(data);
    } catch (error) {
      console.error('Erreur chargement litige:', error);
      alert(t('alerts.dispute.loadError'));
    } finally {
      setLoading(false);
    }
  }

  async function handleAddComment() {
    if (!user || !commentaire.trim()) return;

    try {
      setSubmitting(true);
      await addLitigeComment(litigeId, user.uid, 'artisan', commentaire);
      setCommentaire('');
      await loadLitige(); // Recharger pour voir le nouveau commentaire
    } catch (error) {
      console.error('Erreur ajout commentaire:', error);
      alert(t('alerts.dispute.commentError'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAcceptResolution() {
    if (!user) return;
    
    const confirm = window.confirm(
      'Êtes-vous sûr d\'accepter cette proposition de résolution ? Cette action est irréversible.'
    );
    if (!confirm) return;

    try {
      setSubmitting(true);
      await acceptLitigeResolution(litigeId, user.uid, 'artisan');
      await loadLitige();
      alert(t('alerts.dispute.acceptSuccess'));
    } catch (error) {
      console.error('Erreur acceptation:', error);
      alert(t('alerts.dispute.acceptError'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRejectResolution() {
    if (!user || !motifRefus.trim()) {
      alert(t('alerts.refusal.refusalReasonRequired'));
      return;
    }

    try {
      setSubmitting(true);
      await rejectLitigeResolution(litigeId, user.uid, 'artisan', motifRefus);
      setMotifRefus('');
      setShowRefusForm(false);
      await loadLitige();
      alert(t('alerts.dispute.proposalRejected'));
    } catch (error) {
      console.error('Erreur refus:', error);
      alert(t('alerts.dispute.refusalError'));
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!litige) {
    return null;
  }

  const canRespond = litige.statut === 'ouvert' || litige.statut === 'en_mediation';
  const hasProposition = litige.statut === 'proposition_resolution';
  const isResolved = litige.statut === 'resolu_accord' || litige.statut === 'resolu_admin';

  // Vérifier si l'artisan a déjà accepté la proposition
  const artisanAlreadyAccepted = litige.historique.some(
    (action) =>
      action.type === 'acceptation_resolution' && action.acteurRole === 'artisan'
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Navigation */}
      <Link
        href="/artisan/litiges"
        className="inline-flex items-center gap-2 text-[#FF6B00] hover:underline mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour à mes litiges
      </Link>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-[#2C3E50] mb-2">{litige.motif}</h1>
            <p className="text-gray-600">{litige.description}</p>
            {litige.declarantRole === 'client' && (
              <p className="text-sm text-orange-600 mt-2">
                ⚠️ Litige déclaré par le client
              </p>
            )}
            {litige.declarantRole === 'artisan' && (
              <p className="text-sm text-blue-600 mt-2">
                📢 Vous avez déclaré ce litige
              </p>
            )}
          </div>
          <div className="text-right">
            {litige.statut === 'ouvert' && (
              <span className="inline-block px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full font-medium">
                Ouvert
              </span>
            )}
            {litige.statut === 'en_mediation' && (
              <span className="inline-block px-4 py-2 bg-blue-100 text-blue-800 rounded-full font-medium">
                En médiation
              </span>
            )}
            {litige.statut === 'proposition_resolution' && (
              <span className="inline-block px-4 py-2 bg-purple-100 text-purple-800 rounded-full font-medium">
                Proposition
              </span>
            )}
            {isResolved && (
              <span className="inline-block px-4 py-2 bg-green-100 text-green-800 rounded-full font-medium">
                Résolu
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Type</p>
            <p className="font-medium text-[#2C3E50]">{litige.type}</p>
          </div>
          <div>
            <p className="text-gray-500">Priorité</p>
            <p className="font-medium text-[#2C3E50]">
              {litige.priorite ? (
                <span className={`px-2 py-1 rounded text-xs ${
                  litige.priorite === 'urgente' ? 'bg-red-100 text-red-800' :
                  litige.priorite === 'haute' ? 'bg-orange-100 text-orange-800' :
                  litige.priorite === 'moyenne' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {litige.priorite}
                </span>
              ) : (
                'Non définie'
              )}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Ouvert le</p>
            <p className="font-medium text-[#2C3E50]">
              {litige.dateOuverture ? formatDate(litige.dateOuverture.toDate()) : '-'}
            </p>
          </div>
          {litige.montantConteste && litige.montantConteste > 0 && (
            <div>
              <p className="text-gray-500">Montant contesté</p>
              <p className="font-medium text-[#2C3E50]">{litige.montantConteste}€</p>
            </div>
          )}
        </div>
      </div>

      {/* Alert médiation */}
      {litige.adminAssigne && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">Médiation en cours</h3>
              <p className="text-sm text-blue-700">
                Un médiateur a été assigné à ce litige. Il vous contactera prochainement pour trouver une solution amiable.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Proposition de résolution */}
      {hasProposition && !artisanAlreadyAccepted && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-purple-900 mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Proposition de résolution
          </h3>
          <p className="text-purple-700 mb-4">
            Un médiateur a proposé une solution. Veuillez examiner la proposition dans l'historique ci-dessous.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleAcceptResolution}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle className="w-5 h-5" />
              Accepter la proposition
            </button>
            <button
              onClick={() => setShowRefusForm(!showRefusForm)}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-3 border-2 border-red-600 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              <XCircle className="w-5 h-5" />
              Refuser
            </button>
          </div>

          {showRefusForm && (
            <div className="mt-4 p-4 bg-white rounded border border-red-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motif du refus *
              </label>
              <textarea
                value={motifRefus}
                onChange={(e) => setMotifRefus(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                placeholder="Expliquez pourquoi vous refusez cette proposition..."
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleRejectResolution}
                  disabled={submitting || !motifRefus.trim()}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  Confirmer le refus
                </button>
                <button
                  onClick={() => {
                    setShowRefusForm(false);
                    setMotifRefus('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <LitigeTimeline historique={litige.historique} currentUserId={user?.uid || ''} />
      </div>

      {/* Ajouter un commentaire */}
      {canRespond && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-[#2C3E50] mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Ajouter un commentaire
          </h3>
          <textarea
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            rows={4}
            placeholder="Expliquez votre situation, apportez des précisions..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent mb-4"
          />
          <button
            onClick={handleAddComment}
            disabled={submitting || !commentaire.trim()}
            className="px-6 py-3 bg-[#FF6B00] text-white rounded-lg hover:bg-[#E56100] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Envoi...' : 'Envoyer le commentaire'}
          </button>
        </div>
      )}

      {/* Message si résolu */}
      {isResolved && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-green-900 mb-1">Litige résolu</h3>
              <p className="text-sm text-green-700">
                {litige.resolution || 'Ce litige a été résolu avec succès.'}
              </p>
              {litige.dateResolution && (
                <p className="text-xs text-green-600 mt-2">
                  Résolu le {formatDate(litige.dateResolution.toDate())}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
