'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  getDemandeExpressById,
  getPropositionsByDemande,
  acceptPropositionExpress,
  refusePropositionExpress,
  cancelDemandeExpress
} from '@/lib/firebase/demande-express-service';
import { getUserById } from '@/lib/firebase/user-service';
import { getArtisanByUserId } from '@/lib/firebase/artisan-service';
import { useAuth } from '@/hooks/useAuth';
import type { DemandeExpress, PropositionExpress, User, Artisan } from '@/types/firestore';
import { Button } from '@/components/ui/Button';

export default function DemandeExpressDetailClientPage() {
  const router = useRouter();
  const params = useParams();
  const demandeId = params.id as string;
  const { user: firebaseUser } = useAuth();

  const [userData, setUserData] = useState<User | null>(null);
  const [demande, setDemande] = useState<DemandeExpress | null>(null);
  const [proposition, setProposition] = useState<PropositionExpress | null>(null);
  const [artisanData, setArtisanData] = useState<Artisan | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modale refus
  const [showRefusModal, setShowRefusModal] = useState(false);
  const [motifRefus, setMotifRefus] = useState('');

  useEffect(() => {
    if (!firebaseUser) {
      router.push('/connexion');
      return;
    }
    loadData();
  }, [firebaseUser, demandeId]);

  async function loadData() {
    if (!firebaseUser) return;

    try {
      const user = await getUserById(firebaseUser.uid);
      setUserData(user);

      if (user?.role !== 'client') {
        alert('Accès réservé aux clients');
        router.push('/');
        return;
      }

      const demandeData = await getDemandeExpressById(demandeId);
      if (!demandeData) {
        alert('Demande introuvable');
        router.push('/client/dashboard');
        return;
      }

      if (demandeData.clientId !== firebaseUser.uid) {
        alert('Vous n\'êtes pas autorisé à voir cette demande');
        router.push('/client/dashboard');
        return;
      }

      setDemande(demandeData);

      // Propositions
      const propositions = await getPropositionsByDemande(demandeId);
      if (propositions.length > 0) {
        setProposition(propositions[0]); // Une seule proposition possible

        // Récupérer info artisan
        const artisan = await getArtisanByUserId(propositions[0].artisanId);
        setArtisanData(artisan);
      }
    } catch (error) {
      console.error('Erreur chargement demande:', error);
      alert('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }

  async function handleAccepter() {
    if (!proposition || !confirm('Confirmer l\'acceptation de cette proposition ?')) return;

    setSubmitting(true);
    try {
      await acceptPropositionExpress(proposition.id);
      alert('✅ Proposition acceptée ! Vous allez être redirigé vers le paiement...');
      // TODO: Rediriger vers page paiement Stripe
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
      alert('Veuillez indiquer un motif de refus');
      return;
    }

    setSubmitting(true);
    try {
      await refusePropositionExpress(proposition.id, motifRefus.trim());
      alert('Proposition refusée. L\'artisan a été notifié.');
      setShowRefusModal(false);
      await loadData();
    } catch (error: any) {
      console.error('Erreur refus:', error);
      alert(error.message || 'Erreur lors du refus');
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
      router.push('/client/dashboard');
    } catch (error: any) {
      console.error('Erreur annulation:', error);
      alert(error.message || 'Erreur lors de l\'annulation');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B00] mx-auto mb-4"></div>
          <p className="text-[#6C757D]">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!demande) {
    return null;
  }

  const peutAnnuler = ['en_attente_proposition', 'proposition_recue'].includes(demande.statut);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F8F9FA] to-white">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-[#E9ECEF]">
        <div className="container mx-auto px-4 py-6">
          <nav className="flex items-center gap-2 text-sm mb-4">
            <Link href="/client/dashboard" className="text-[#2C3E50] hover:text-[#FF6B00]">
              Dashboard
            </Link>
            <span className="text-[#6C757D]">&gt;</span>
            <span className="text-[#2C3E50] font-semibold">Ma demande express</span>
          </nav>

          <h1 className="text-2xl md:text-3xl font-bold text-[#2C3E50]">
            🚀 Ma demande express
          </h1>
        </div>
      </div>

      {/* Contenu */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Détails demande */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-[#2C3E50] mb-4">
              {demande.categorie.charAt(0).toUpperCase() + demande.categorie.slice(1)}
              {demande.sousCategorie && ` • ${demande.sousCategorie}`}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#2C3E50] mb-1">
                  Description
                </label>
                <p className="text-[#6C757D] whitespace-pre-wrap">{demande.description}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#2C3E50] mb-1">
                    📍 Localisation
                  </label>
                  <p className="text-[#6C757D]">{demande.ville} ({demande.codePostal})</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#2C3E50] mb-1">
                    📅 Date souhaitée
                  </label>
                  <p className="text-[#6C757D]">
                    {new Date(demande.date).toLocaleDateString('fr-FR')}
                  </p>
                </div>

                {demande.budgetPropose && (
                  <div>
                    <label className="block text-sm font-semibold text-[#2C3E50] mb-1">
                      💰 Votre budget
                    </label>
                    <p className="text-2xl font-bold text-[#FF6B00]">{demande.budgetPropose}€</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-[#2C3E50] mb-1">
                    📊 Statut
                  </label>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                    demande.statut === 'en_attente_proposition' ? 'bg-yellow-100 text-yellow-800' :
                    demande.statut === 'proposition_recue' ? 'bg-blue-100 text-blue-800' :
                    demande.statut === 'acceptee' ? 'bg-green-100 text-green-800' :
                    demande.statut === 'payee' ? 'bg-green-100 text-green-800' :
                    demande.statut === 'en_cours' ? 'bg-purple-100 text-purple-800' :
                    demande.statut === 'terminee' ? 'bg-gray-100 text-gray-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {demande.statut === 'en_attente_proposition' && '⏳ En attente de proposition'}
                    {demande.statut === 'proposition_recue' && '💬 Proposition reçue'}
                    {demande.statut === 'acceptee' && '✅ Acceptée'}
                    {demande.statut === 'payee' && '💳 Payée'}
                    {demande.statut === 'en_cours' && '🔧 En cours'}
                    {demande.statut === 'terminee' && '🎉 Terminée'}
                    {demande.statut === 'annulee' && '❌ Annulée'}
                    {demande.statut === 'expiree' && '⏰ Expirée'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Message attente */}
          {demande.statut === 'en_attente_proposition' && (
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6">
              <h3 className="text-lg font-bold text-[#2C3E50] mb-2">
                ⏳ En attente d'une proposition
              </h3>
              <p className="text-[#6C757D]">
                Votre demande est en ligne. Un artisan va bientôt vous faire une proposition.
              </p>
            </div>
          )}

          {/* Proposition reçue */}
          {proposition && demande.statut === 'proposition_recue' && (
            <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-[#FF6B00]">
              <h3 className="text-xl font-bold text-[#2C3E50] mb-4">
                💬 Proposition reçue
              </h3>

              {artisanData && (
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-[#2C3E50] mb-1">
                    👤 Artisan
                  </label>
                  <p className="text-[#6C757D]">{artisanData.raisonSociale}</p>
                </div>
              )}

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-[#2C3E50] mb-1">
                    💰 Montant proposé
                  </label>
                  <p className="text-3xl font-bold text-[#FF6B00]">{proposition.montantPropose}€</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#2C3E50] mb-1">
                    📝 Ce qui est inclus
                  </label>
                  <p className="text-[#6C757D] whitespace-pre-wrap">{proposition.description}</p>
                </div>

                {proposition.delaiIntervention && (
                  <div>
                    <label className="block text-sm font-semibold text-[#2C3E50] mb-1">
                      ⏱️ Délai d'intervention
                    </label>
                    <p className="text-[#6C757D]">{proposition.delaiIntervention}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  variant="secondary"
                  onClick={() => setShowRefusModal(true)}
                  disabled={submitting}
                  className="flex-1"
                >
                  Refuser
                </Button>
                <Button
                  onClick={handleAccepter}
                  disabled={submitting}
                  className="flex-1"
                >
                  {submitting ? '⏳ Traitement...' : '✅ Accepter et payer'}
                </Button>
              </div>
            </div>
          )}

          {/* Statut acceptée (en attente paiement) */}
          {demande.statut === 'acceptee' && (
            <div className="bg-green-50 border-2 border-green-300 rounded-xl p-6">
              <h3 className="text-lg font-bold text-[#2C3E50] mb-2">
                ✅ Proposition acceptée
              </h3>
              <p className="text-[#6C757D] mb-4">
                Vous avez accepté cette proposition. Procédez au paiement pour que l'artisan puisse intervenir.
              </p>
              <Button onClick={() => router.push(`/client/paiement-express/${proposition?.id}`)}>
                💳 Procéder au paiement
              </Button>
            </div>
          )}

          {/* Statut payée */}
          {demande.statut === 'payee' && (
            <div className="bg-green-50 border-2 border-green-300 rounded-xl p-6">
              <h3 className="text-lg font-bold text-[#2C3E50] mb-2">
                💳 Paiement reçu
              </h3>
              <p className="text-[#6C757D]">
                Votre paiement de <strong>{proposition?.montantPropose}€</strong> a été reçu et sécurisé. L'artisan va bientôt intervenir.
              </p>
            </div>
          )}

          {/* Statut en cours */}
          {demande.statut === 'en_cours' && (
            <div className="bg-purple-50 border-2 border-purple-300 rounded-xl p-6">
              <h3 className="text-lg font-bold text-[#2C3E50] mb-2">
                🔧 Intervention en cours
              </h3>
              <p className="text-[#6C757D]">
                L'artisan a commencé l'intervention. Vous serez notifié à la fin des travaux.
              </p>
            </div>
          )}

          {/* Statut terminée */}
          {demande.statut === 'terminee' && (
            <div className="bg-gray-50 border-2 border-gray-300 rounded-xl p-6">
              <h3 className="text-lg font-bold text-[#2C3E50] mb-4">
                🎉 Intervention terminée
              </h3>
              <p className="text-[#6C757D] mb-4">
                L'intervention est terminée. Le paiement a été libéré à l'artisan.
              </p>
              <Button onClick={() => router.push(`/client/avis/nouveau?artisanId=${artisanData?.userId}`)}>
                ⭐ Laisser un avis
              </Button>
            </div>
          )}

          {/* Bouton annuler */}
          {peutAnnuler && (
            <div className="flex justify-center">
              <Button
                variant="secondary"
                onClick={handleAnnuler}
                disabled={submitting}
              >
                ❌ Annuler cette demande
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Modale refus */}
      {showRefusModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-[#2C3E50] mb-4">
              Refuser la proposition
            </h3>
            <p className="text-[#6C757D] mb-4">
              Veuillez indiquer la raison du refus (l'artisan sera notifié) :
            </p>
            <textarea
              value={motifRefus}
              onChange={(e) => setMotifRefus(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border-2 border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#FF6B00] mb-4"
              placeholder="Ex: Le tarif est trop élevé..."
            />
            <div className="flex gap-4">
              <Button
                variant="secondary"
                onClick={() => setShowRefusModal(false)}
                disabled={submitting}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                onClick={handleRefuser}
                disabled={submitting || !motifRefus.trim()}
                className="flex-1"
              >
                {submitting ? '⏳ Envoi...' : 'Confirmer le refus'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
