'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  getDemandeExpressById,
  getPropositionsByDemande,
  acceptPropositionExpress,
  refusePropositionExpress,
  sendContrePropositionExpress,
  cancelDemandeExpress
} from '@/lib/firebase/demande-express-service';
import { getUserById } from '@/lib/firebase/user-service';
import { getArtisanByUserId } from '@/lib/firebase/artisan-service';
import { useAuth } from '@/hooks/useAuth';
import type { DemandeExpress, PropositionExpress, User, Artisan } from '@/types/firestore';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function DemandeExpressDetailClientPage() {
  const router = useRouter();
  const params = useParams();
  const demandeId = params.id as string;
  const { user: firebaseUser, loading: authLoading } = useAuth();
  const { t } = useLanguage();

  const [userData, setUserData] = useState<User | null>(null);
  const [demande, setDemande] = useState<DemandeExpress | null>(null);
  const [proposition, setProposition] = useState<PropositionExpress | null>(null);
  const [artisanData, setArtisanData] = useState<Artisan | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Modales
  const [showRefusModal, setShowRefusModal] = useState(false);
  const [motifRefus, setMotifRefus] = useState('');

  const [showContreModal, setShowContreModal] = useState(false);
  const [contreMonant, setContreMontant] = useState('');
  const [contreMessage, setContreMessage] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!firebaseUser) {
      router.push('/connexion');
      return;
    }
    loadData();
  }, [firebaseUser, authLoading, demandeId]);

  async function loadData() {
    if (!firebaseUser) return;
    setLoadError(null);

    try {
      // 1. Récupérer le profil utilisateur
      const user = await getUserById(firebaseUser.uid);
      setUserData(user);

      if (user?.role !== 'client') {
        router.push('/');
        return;
      }

      // 2. Récupérer la demande
      const demandeData = await getDemandeExpressById(demandeId);
      if (!demandeData) {
        setLoadError('Demande introuvable');
        setLoading(false);
        return;
      }

      if (demandeData.clientId !== firebaseUser.uid) {
        setLoadError("Vous n'êtes pas autorisé à accéder à cette demande");
        setLoading(false);
        return;
      }

      setDemande(demandeData);

      // 3. Récupérer les propositions (indépendant de l'artisan)
      try {
        const propositions = await getPropositionsByDemande(demandeId);
        const activeProposition = propositions.find(
          p => p.statut === 'en_attente_acceptation'
        ) || propositions[0] || null;
        setProposition(activeProposition);

        // 4. Récupérer l'info artisan (non-bloquant)
        if (activeProposition?.artisanId) {
          try {
            const artisan = await getArtisanByUserId(activeProposition.artisanId);
            setArtisanData(artisan);
          } catch {
            // L'info artisan n'est pas critique, on continue sans
            console.warn('Impossible de charger le profil artisan');
          }
        }
      } catch (err) {
        console.warn('Erreur chargement propositions:', err);
        // Ne pas bloquer l'affichage de la demande si les propositions échouent
      }
    } catch (error) {
      console.error('Erreur chargement demande:', error);
      setLoadError('Erreur lors du chargement des données. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAccepter() {
    if (!proposition || !confirm('Confirmer l\'acceptation de cette proposition ?')) return;

    setSubmitting(true);
    try {
      await acceptPropositionExpress(proposition.id);
      alert('✅ Proposition acceptée ! Procédez au paiement pour confirmer l\'intervention.');
      router.push(`/client/paiement-express/${proposition.id}`);
    } catch (error: any) {
      console.error('Erreur acceptation:', error);
      alert(error.message || 'Erreur lors de l\'acceptation');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRefuser() {
    if (!proposition || !motifRefus.trim()) {
      alert('Veuillez indiquer la raison du refus');
      return;
    }

    setSubmitting(true);
    try {
      await refusePropositionExpress(proposition.id, motifRefus.trim());
      alert('La proposition a été refusée. L\'artisan sera notifié.');
      setShowRefusModal(false);
      setMotifRefus('');
      await loadData();
    } catch (error: any) {
      console.error('Erreur refus:', error);
      alert(error.message || 'Erreur lors du refus');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleContreProposition() {
    if (!proposition) return;
    const montant = parseFloat(contreMonant);
    if (isNaN(montant) || montant <= 0) {
      alert('Veuillez entrer un montant valide');
      return;
    }
    if (montant > 150) {
      alert('Le montant maximum pour les travaux express est de 150€');
      return;
    }
    if (!contreMessage.trim()) {
      alert('Veuillez ajouter un message expliquant votre contre-proposition');
      return;
    }

    setSubmitting(true);
    try {
      await sendContrePropositionExpress(proposition.id, montant, contreMessage.trim());
      alert(`✅ Contre-proposition de ${montant}€ envoyée ! L'artisan sera notifié et pourra vous faire une nouvelle offre.`);
      setShowContreModal(false);
      setContreMontant('');
      setContreMessage('');
      await loadData();
    } catch (error: any) {
      console.error('Erreur contre-proposition:', error);
      alert(error.message || 'Erreur lors de l\'envoi de la contre-proposition');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAnnuler() {
    if (!demande || !confirm('Voulez-vous vraiment annuler cette demande ?')) return;

    setSubmitting(true);
    try {
      await cancelDemandeExpress(demandeId, firebaseUser!.uid);
      alert('Demande annulée.');
      router.push('/client/demandes-express');
    } catch (error: any) {
      console.error('Erreur annulation:', error);
      alert(error.message || 'Erreur lors de l\'annulation');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B00] mx-auto mb-4" />
          <p className="text-[#6C757D]">Chargement de votre demande…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-[#2C3E50] mb-2">Impossible de charger</h2>
          <p className="text-[#6C757D] mb-6">{loadError}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { setLoading(true); loadData(); }}
              className="px-5 py-2.5 bg-[#FF6B00] text-white rounded-lg hover:bg-[#E56100] font-medium"
            >
              Réessayer
            </button>
            <Link
              href="/client/demandes-express"
              className="px-5 py-2.5 border-2 border-[#2C3E50] text-[#2C3E50] rounded-lg hover:bg-[#2C3E50] hover:text-white font-medium"
            >
              Retour
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!demande) return null;

  const peutAnnuler = ['en_attente_proposition', 'proposition_recue'].includes(demande.statut);
  const artisanNom = artisanData
    ? ((artisanData as any).businessName || (artisanData as any).raisonSociale || 'Artisan')
    : null;

  const statutBadge: Record<string, { bg: string; color: string; label: string }> = {
    en_attente_proposition: { bg: 'bg-yellow-100', color: 'text-yellow-800', label: '⏳ En attente' },
    proposition_recue:      { bg: 'bg-blue-100',   color: 'text-blue-800',   label: '💬 Proposition reçue' },
    acceptee:               { bg: 'bg-green-100',  color: 'text-green-800',  label: '✅ Acceptée' },
    payee:                  { bg: 'bg-green-100',  color: 'text-green-800',  label: '💳 Payée' },
    en_cours:               { bg: 'bg-purple-100', color: 'text-purple-800', label: '🔧 En cours' },
    terminee:               { bg: 'bg-gray-100',   color: 'text-gray-700',   label: '🎉 Terminée' },
    annulee:                { bg: 'bg-red-100',    color: 'text-red-700',    label: '❌ Annulée' },
    expiree:                { bg: 'bg-gray-100',   color: 'text-gray-600',   label: '⏰ Expirée' },
  };
  const badge = statutBadge[demande.statut] ?? { bg: 'bg-gray-100', color: 'text-gray-700', label: demande.statut };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F8F9FA] to-white">

      {/* ── Header ─────────────────────────────────────── */}
      <div className="bg-[#2C3E50] text-white">
        <div className="container mx-auto px-4 py-5">
          <nav className="flex items-center gap-2 text-sm mb-3 text-white/70">
            <Link href="/client/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
            <span>/</span>
            <Link href="/client/demandes-express" className="hover:text-white transition-colors">Mes demandes</Link>
            <span>/</span>
            <span className="text-white font-semibold">Détails</span>
          </nav>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">🚀 Demande express</h1>
              <p className="text-white/70 text-sm mt-0.5">
                {demande.categorie.charAt(0).toUpperCase() + demande.categorie.slice(1)}
                {demande.sousCategorie && ` · ${demande.sousCategorie}`}
              </p>
            </div>
            <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${badge.bg} ${badge.color}`}>
              {badge.label}
            </span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">

          {/* ── Ma demande ──────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-md p-6">
            <h2 className="text-lg font-bold text-[#2C3E50] mb-4 flex items-center gap-2">
              📋 Ma demande
            </h2>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-[#6C757D] font-semibold uppercase tracking-wide mb-1">Description</p>
                <p className="text-[#2C3E50] whitespace-pre-wrap break-words leading-relaxed">{demande.description}</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-[#E9ECEF]">
                <div>
                  <p className="text-xs text-[#6C757D] font-semibold uppercase tracking-wide mb-1">📍 Ville</p>
                  <p className="text-[#2C3E50] font-medium text-sm">{demande.ville} ({demande.codePostal})</p>
                </div>
                {demande.adresse && (
                  <div className="col-span-2">
                    <p className="text-xs text-[#6C757D] font-semibold uppercase tracking-wide mb-1">📍 Adresse</p>
                    <p className="text-[#2C3E50] font-medium text-sm">{demande.adresse}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-[#6C757D] font-semibold uppercase tracking-wide mb-1">📅 Date</p>
                  <p className="text-[#2C3E50] font-medium text-sm">{new Date(demande.date).toLocaleDateString('fr-FR')}</p>
                </div>
                {demande.budgetPropose && (
                  <div>
                    <p className="text-xs text-[#6C757D] font-semibold uppercase tracking-wide mb-1">💰 Mon budget</p>
                    <p className="text-[#FF6B00] font-bold text-lg">{demande.budgetPropose}€</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-[#6C757D] font-semibold uppercase tracking-wide mb-1">🔥 Urgence</p>
                  <p className="text-[#2C3E50] font-medium text-sm capitalize">{demande.urgence}</p>
                </div>
                <div>
                  <p className="text-xs text-[#6C757D] font-semibold uppercase tracking-wide mb-1">📅 Déposée le</p>
                  <p className="text-[#2C3E50] font-medium text-sm">
                    {demande.createdAt ? format(demande.createdAt.toDate(), 'dd MMM yyyy', { locale: fr }) : '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── En attente de proposition ────────────────── */}
          {demande.statut === 'en_attente_proposition' && (
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="text-3xl">⏳</div>
                <div>
                  <h3 className="text-lg font-bold text-[#2C3E50] mb-1">En attente d'une proposition</h3>
                  <p className="text-[#6C757D] text-sm">
                    Votre demande est visible par les artisans qualifiés de votre zone. Un artisan va bientôt vous soumettre son offre.
                  </p>
                  {demande.expiresAt && (
                    <p className="mt-2 text-sm text-orange-600 font-medium">
                      ⏰ Expire le {format(demande.expiresAt.toDate(), 'dd MMM à HH:mm', { locale: fr })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── PROPOSITION REÇUE : section principale ───── */}
          {proposition && proposition.statut === 'en_attente_acceptation' && (
            <div className="bg-white rounded-2xl shadow-md border-2 border-[#FF6B00] overflow-hidden">
              {/* Badge artisan */}
              <div className="bg-[#FF6B00] px-6 py-3 flex items-center justify-between">
                <span className="text-white font-bold text-lg">💬 Nouvelle proposition</span>
                {artisanNom && (
                  <span className="bg-white/20 text-white text-sm px-3 py-1 rounded-full font-medium">
                    👤 {artisanNom}
                  </span>
                )}
              </div>

              <div className="p-6">
                {/* Montant — élément le plus visible */}
                <div className="flex items-center justify-between mb-6 p-4 bg-[#FFF5EB] rounded-xl">
                  <div>
                    <p className="text-xs text-[#6C757D] font-semibold uppercase tracking-wide mb-1">Montant proposé (TTC)</p>
                    <p className="text-5xl font-extrabold text-[#FF6B00]">{proposition.montantPropose}€</p>
                  </div>
                  {demande.budgetPropose && (
                    <div className="text-right">
                      <p className="text-xs text-[#6C757D] font-semibold uppercase tracking-wide mb-1">Votre budget initial</p>
                      <p className="text-2xl font-bold text-[#6C757D]">{demande.budgetPropose}€</p>
                      {proposition.montantPropose <= demande.budgetPropose ? (
                        <p className="text-green-600 text-xs font-semibold mt-1">✅ Dans votre budget</p>
                      ) : (
                        <p className="text-orange-600 text-xs font-semibold mt-1">⚠️ Au-dessus de votre budget</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Description de la prestation */}
                <div className="mb-5">
                  <p className="text-xs text-[#6C757D] font-semibold uppercase tracking-wide mb-2">📝 Ce qui est inclus dans la prestation</p>
                  <div className="bg-[#F8F9FA] rounded-xl p-4">
                    <p className="text-[#2C3E50] whitespace-pre-wrap break-words leading-relaxed">{proposition.description}</p>
                  </div>
                </div>

                {/* Délai */}
                {proposition.delaiIntervention && (
                  <div className="mb-5">
                    <p className="text-xs text-[#6C757D] font-semibold uppercase tracking-wide mb-2">⏱️ Délai d'intervention</p>
                    <div className="flex items-center gap-2">
                      <span className="bg-purple-100 text-purple-800 px-4 py-2 rounded-lg font-semibold text-sm">
                        {proposition.delaiIntervention}
                      </span>
                    </div>
                  </div>
                )}

                {/* Date proposée */}
                {proposition.dateInterventionProposee && (
                  <div className="mb-5">
                    <p className="text-xs text-[#6C757D] font-semibold uppercase tracking-wide mb-2">📅 Date d'intervention proposée</p>
                    <span className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-semibold text-sm">
                      {format(proposition.dateInterventionProposee.toDate(), 'EEEE dd MMMM yyyy à HH:mm', { locale: fr })}
                    </span>
                  </div>
                )}

                {/* Info artisan complète */}
                {artisanData && (
                  <div className="mb-5 p-4 bg-[#F8F9FA] rounded-xl">
                    <p className="text-xs text-[#6C757D] font-semibold uppercase tracking-wide mb-2">👤 À propos de l'artisan</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-[#6C757D]">Entreprise : </span>
                        <span className="font-semibold text-[#2C3E50]">
                          {(artisanData as any).businessName || (artisanData as any).raisonSociale || '—'}
                        </span>
                      </div>
                      {(artisanData as any).location?.city && (
                        <div>
                          <span className="text-[#6C757D]">Ville : </span>
                          <span className="font-semibold text-[#2C3E50]">{(artisanData as any).location.city}</span>
                        </div>
                      )}
                      {(artisanData as any).metiers?.length > 0 && (
                        <div className="col-span-2">
                          <span className="text-[#6C757D]">Spécialités : </span>
                          <span className="font-semibold text-[#2C3E50]">
                            {(artisanData as any).metiers.join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Reçue le */}
                {proposition.createdAt && (
                  <p className="text-xs text-[#6C757D] mb-5">
                    Proposition reçue le {format(proposition.createdAt.toDate(), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                  </p>
                )}

                {/* Boutons d'action */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-[#E9ECEF]">
                  <button
                    onClick={() => setShowRefusModal(true)}
                    disabled={submitting}
                    className="px-5 py-3 border-2 border-red-400 text-red-600 rounded-xl hover:bg-red-50 font-semibold text-sm transition-all disabled:opacity-50"
                  >
                    ❌ Refuser
                  </button>
                  <button
                    onClick={() => { setContreMontant(String(demande.budgetPropose || '')); setShowContreModal(true); }}
                    disabled={submitting}
                    className="px-5 py-3 border-2 border-[#FF6B00] text-[#FF6B00] rounded-xl hover:bg-[#FFF5EB] font-semibold text-sm transition-all disabled:opacity-50"
                  >
                    💬 Contre-proposer
                  </button>
                  <button
                    onClick={handleAccepter}
                    disabled={submitting}
                    className="px-5 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-semibold text-sm transition-all disabled:opacity-50 shadow-md"
                  >
                    {submitting ? '⏳ Traitement…' : '✅ Accepter et payer'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Proposition acceptée (en attente paiement) ─ */}
          {demande.statut === 'acceptee' && (
            <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="text-3xl">✅</div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-[#2C3E50] mb-1">Proposition acceptée</h3>
                  <p className="text-[#6C757D] text-sm mb-4">
                    Procédez au paiement sécurisé pour confirmer l'intervention de l'artisan.
                  </p>
                  {proposition && (
                    <p className="text-2xl font-extrabold text-[#FF6B00] mb-4">{proposition.montantPropose}€ TTC</p>
                  )}
                  <button
                    onClick={() => router.push(`/client/paiement-express/${proposition?.id}`)}
                    className="px-6 py-3 bg-[#FF6B00] text-white rounded-xl hover:bg-[#E56100] font-bold shadow-md"
                  >
                    💳 Procéder au paiement
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Payée ────────────────────────────────────── */}
          {demande.statut === 'payee' && (
            <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="text-3xl">💳</div>
                <div>
                  <h3 className="text-lg font-bold text-[#2C3E50] mb-1">Paiement confirmé</h3>
                  <p className="text-[#6C757D] text-sm">
                    Votre paiement de{' '}
                    <strong className="text-[#FF6B00]">{proposition?.montantPropose}€</strong>{' '}
                    est sécurisé en séquestre. L'artisan va intervenir sous peu.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── En cours ─────────────────────────────────── */}
          {demande.statut === 'en_cours' && (
            <div className="bg-purple-50 border-2 border-purple-300 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="text-3xl">🔧</div>
                <div>
                  <h3 className="text-lg font-bold text-[#2C3E50] mb-1">Intervention en cours</h3>
                  <p className="text-[#6C757D] text-sm">
                    L'artisan est en train d'effectuer les travaux. Vous serez notifié dès la fin.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Terminée ─────────────────────────────────── */}
          {demande.statut === 'terminee' && (
            <div className="bg-gray-50 border-2 border-gray-300 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="text-3xl">🎉</div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-[#2C3E50] mb-1">Intervention terminée</h3>
                  <p className="text-[#6C757D] text-sm mb-4">
                    Les travaux sont terminés. Le paiement a été libéré à l'artisan. Merci d'avoir utilisé ArtisanSafe !
                  </p>
                  {artisanData && (
                    <button
                      onClick={() => router.push(`/client/avis/nouveau?artisanId=${artisanData.userId}`)}
                      className="px-5 py-2.5 bg-[#FFC107] text-[#2C3E50] rounded-xl hover:bg-yellow-400 font-bold text-sm shadow"
                    >
                      ⭐ Laisser un avis
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Annulée / Expirée ────────────────────────── */}
          {(demande.statut === 'annulee' || demande.statut === 'expiree') && (
            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="text-3xl">{demande.statut === 'expiree' ? '⏰' : '❌'}</div>
                <div>
                  <h3 className="text-lg font-bold text-[#2C3E50] mb-1">
                    {demande.statut === 'expiree' ? 'Demande expirée' : 'Demande annulée'}
                  </h3>
                  <p className="text-[#6C757D] text-sm">
                    {demande.statut === 'expiree'
                      ? 'Cette demande a expiré sans recevoir de proposition.'
                      : 'Cette demande a été annulée.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Bouton annuler ───────────────────────────── */}
          {peutAnnuler && (
            <div className="flex justify-center pt-2">
              <button
                onClick={handleAnnuler}
                disabled={submitting}
                className="px-6 py-2.5 border-2 border-[#6C757D] text-[#6C757D] rounded-xl hover:border-red-500 hover:text-red-500 font-medium text-sm transition-all disabled:opacity-50"
              >
                Annuler ma demande
              </button>
            </div>
          )}

        </div>
      </div>

      {/* ── Modale : Refus ──────────────────────────────── */}
      {showRefusModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-[#2C3E50] mb-2">❌ Refuser la proposition</h3>
            <p className="text-[#6C757D] text-sm mb-4">
              Indiquez pourquoi vous refusez (l'artisan sera notifié). La demande reviendra en attente.
            </p>
            <textarea
              value={motifRefus}
              onChange={(e) => setMotifRefus(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border-2 border-[#E9ECEF] rounded-xl focus:outline-none focus:border-red-400 mb-4 text-sm"
              placeholder="Ex : Le tarif est trop élevé pour ce travail…"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowRefusModal(false); setMotifRefus(''); }}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 border-2 border-[#E9ECEF] text-[#6C757D] rounded-xl hover:border-[#2C3E50] font-medium text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleRefuser}
                disabled={submitting || !motifRefus.trim()}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 font-semibold text-sm disabled:opacity-50"
              >
                {submitting ? '⏳ Envoi…' : 'Confirmer le refus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modale : Contre-proposition ─────────────────── */}
      {showContreModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-[#2C3E50] mb-2">💬 Faire une contre-proposition</h3>
            <p className="text-[#6C757D] text-sm mb-4">
              Proposez un montant et expliquez vos attentes. L'artisan pourra faire une nouvelle offre.
            </p>
            {proposition && (
              <p className="bg-[#FFF5EB] text-[#FF6B00] text-sm font-semibold px-4 py-2 rounded-lg mb-4">
                Proposition actuelle : {proposition.montantPropose}€
              </p>
            )}
            <div className="mb-4">
              <label className="text-sm font-semibold text-[#2C3E50] mb-1 block">
                💰 Votre budget souhaité (max 150€)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="150"
                  value={contreMonant}
                  onChange={(e) => setContreMontant(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-[#E9ECEF] rounded-xl focus:outline-none focus:border-[#FF6B00] pr-10"
                  placeholder="Ex : 80"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6C757D] font-bold">€</span>
              </div>
            </div>
            <div className="mb-4">
              <label className="text-sm font-semibold text-[#2C3E50] mb-1 block">
                📝 Message à l'artisan
              </label>
              <textarea
                value={contreMessage}
                onChange={(e) => setContreMessage(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border-2 border-[#E9ECEF] rounded-xl focus:outline-none focus:border-[#FF6B00] text-sm"
                placeholder="Ex : Je peux aller jusqu'à 80€. Le travail concerne seulement le robinet du lavabo, pas la douche."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowContreModal(false); setContreMontant(''); setContreMessage(''); }}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 border-2 border-[#E9ECEF] text-[#6C757D] rounded-xl hover:border-[#2C3E50] font-medium text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleContreProposition}
                disabled={submitting || !contreMonant || !contreMessage.trim()}
                className="flex-1 px-4 py-2.5 bg-[#FF6B00] text-white rounded-xl hover:bg-[#E56100] font-semibold text-sm disabled:opacity-50"
              >
                {submitting ? '⏳ Envoi…' : 'Envoyer ma contre-proposition'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
