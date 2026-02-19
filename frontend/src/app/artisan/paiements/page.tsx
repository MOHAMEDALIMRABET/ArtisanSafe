'use client';

/**
 * Page de configuration Stripe Connect pour artisans
 * Permet l'onboarding et le suivi des paiements
 * 
 * Route : /artisan/paiements
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export default function ArtisanPaiementsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/connexion');
      return;
    }

    checkStripeAccount();
  }, [user, authLoading]);

  const checkStripeAccount = async () => {
    try {
      setLoading(true);
      setError(null);

      // Vérifier si artisan a déjà un compte Stripe
      const artisanDoc = await getDoc(doc(db, 'artisans', user!.uid));
      
      if (!artisanDoc.exists()) {
        setError('Profil artisan non trouvé');
        setLoading(false);
        return;
      }

      const data = artisanDoc.data();
      const accountId = data?.stripeAccountId;
      const completed = data?.stripeOnboardingCompleted || false;

      if (accountId) {
        setStripeAccountId(accountId);
        setOnboardingCompleted(completed);
      }

    } catch (err: any) {
      console.error('Erreur vérification compte Stripe:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    try {
      setLoading(true);
      setError(null);

      // Appeler backend pour créer compte Stripe Connect
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/payments/create-connect-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artisanId: user!.uid,
          email: user!.email,
          returnUrl: `${window.location.origin}/artisan/paiements?onboarding=complete`,
          refreshUrl: `${window.location.origin}/artisan/paiements?onboarding=refresh`
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Erreur création compte Stripe');
      }

      const { accountId, onboardingUrl } = await response.json();

      // Sauvegarder accountId dans Firestore
      await updateDoc(doc(db, 'artisans', user!.uid), {
        stripeAccountId: accountId,
        stripeOnboardingCompleted: false,
        stripeOnboardingStartDate: new Date()
      });

      console.log('✅ Compte Stripe Connect créé:', accountId);

      // Rediriger vers Stripe pour compléter onboarding
      window.location.href = onboardingUrl;

    } catch (err: any) {
      console.error('❌ Erreur création compte Stripe:', err);
      setError(err.message);
      alert('Erreur lors de la création du compte. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteOnboarding = async () => {
    try {
      setLoading(true);

      // Marquer onboarding comme complété
      await updateDoc(doc(db, 'artisans', user!.uid), {
        stripeOnboardingCompleted: true,
        stripeOnboardingDate: new Date()
      });

      setOnboardingCompleted(true);
      
    } catch (err: any) {
      console.error('Erreur finalisation onboarding:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Gérer retour depuis Stripe après onboarding
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const onboardingStatus = params.get('onboarding');

    if (onboardingStatus === 'complete' && stripeAccountId) {
      handleCompleteOnboarding();
      
      // Nettoyer URL
      const url = new URL(window.location.href);
      url.searchParams.delete('onboarding');
      window.history.replaceState({}, '', url.toString());
    }
  }, [stripeAccountId]);

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B00] mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
            <p className="font-semibold text-red-800">❌ Erreur</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
          <button
            onClick={() => router.push('/artisan/dashboard')}
            className="mt-4 text-[#FF6B00] hover:underline"
          >
            ← Retour au tableau de bord
          </button>
        </div>
      </div>
    );
  }

  // Pas encore de compte Stripe
  if (!stripeAccountId) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-[#2C3E50] mb-6">
            💰 Configuration des paiements
          </h1>

          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="bg-orange-50 border-l-4 border-[#FF6B00] p-4 mb-6">
              <p className="text-sm text-gray-700">
                <strong>Pourquoi créer un compte de paiement ?</strong>
                <br />
                Pour recevoir vos paiements, vous devez créer un compte Stripe Connect.
                Ce compte permettra de transférer automatiquement vos gains après validation des travaux par vos clients.
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="font-semibold text-gray-800">Paiements automatiques</p>
                  <p className="text-sm text-gray-600">Recevez l'argent directement sur votre compte bancaire</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl">🔒</span>
                <div>
                  <p className="font-semibold text-gray-800">Sécurisé et conforme</p>
                  <p className="text-sm text-gray-600">Stripe est certifié PCI-DSS niveau 1 (norme bancaire)</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl">💸</span>
                <div>
                  <p className="font-semibold text-gray-800">Commission transparente</p>
                  <p className="text-sm text-gray-600">Vous recevez 92% du montant payé par le client (8% commission plateforme)</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleCreateAccount}
              disabled={loading}
              className="w-full bg-[#FF6B00] text-white px-6 py-3 rounded-lg hover:bg-[#E56100] disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            >
              {loading ? 'Création en cours...' : 'Créer mon compte de paiement'}
            </button>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-[#2C3E50]">
              ℹ️ <strong>Note</strong> : Vous serez redirigé vers Stripe pour compléter votre inscription.
              Préparez vos informations bancaires (IBAN) et pièce d'identité.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Compte Stripe existant
  return (
    <div className="min-h-screen bg-[#F5F7FA] p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-[#2C3E50] mb-6">
          💰 Mes paiements
        </h1>

        {/* Statut compte */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          {onboardingCompleted ? (
            <div className="bg-green-50 border-l-4 border-green-500 p-4">
              <p className="font-semibold text-green-800 flex items-center gap-2">
                <span className="text-xl">✅</span>
                Compte Stripe configuré
              </p>
              <p className="text-sm text-gray-700 mt-2">
                Vous pouvez maintenant recevoir des paiements après validation des travaux.
              </p>
              <p className="text-xs text-gray-600 mt-3">
                ID compte : <code className="bg-gray-100 px-2 py-1 rounded">{stripeAccountId}</code>
              </p>
            </div>
          ) : (
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4">
              <p className="font-semibold text-yellow-800 flex items-center gap-2">
                <span className="text-xl">⚠️</span>
                Configuration en attente
              </p>
              <p className="text-sm text-gray-700 mt-2">
                Votre compte Stripe a été créé mais l'inscription n'est pas terminée.
              </p>
              <button
                onClick={handleCreateAccount}
                className="mt-3 bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 text-sm"
              >
                Terminer l'inscription
              </button>
            </div>
          )}
        </div>

        {/* Instructions */}
        {onboardingCompleted && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-[#2C3E50] mb-4">
              Comment recevoir mes paiements ?
            </h2>

            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                <span className="font-bold text-[#FF6B00]">1.</span>
                <div>
                  <p className="font-semibold">Client paie le devis</p>
                  <p className="text-sm text-gray-600">L'argent est bloqué en séquestre (escrow)</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                <span className="font-bold text-[#FF6B00]">2.</span>
                <div>
                  <p className="font-semibold">Vous réalisez les travaux</p>
                  <p className="text-sm text-gray-600">Déclarez la fin des travaux dans votre interface</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                <span className="font-bold text-[#FF6B00]">3.</span>
                <div>
                  <p className="font-semibold">Client valide les travaux</p>
                  <p className="text-sm text-gray-600">Ou validation automatique après 48h</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-green-50 rounded border border-green-200">
                <span className="font-bold text-green-600">✓</span>
                <div>
                  <p className="font-semibold text-green-800">Paiement libéré</p>
                  <p className="text-sm text-gray-600">Virement automatique sous 24-48h sur votre compte bancaire</p>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded">
              <p className="text-sm text-[#2C3E50]">
                💡 <strong>Bon à savoir</strong> : Vous recevez 92% du montant TTC.
                Les 8% restants correspondent à la commission de la plateforme ArtisanDispo.
              </p>
            </div>
          </div>
        )}

        {/* TODO: Afficher historique des virements */}
        {/* TODO: Bouton vers dashboard Stripe Express */}
      </div>
    </div>
  );
}
