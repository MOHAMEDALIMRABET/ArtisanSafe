'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useStripe } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/Button';

export default function PaiementSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stripe = useStripe();
  const demandeId = searchParams.get('demandeId');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!stripe) return;

    const clientSecret = new URLSearchParams(window.location.search).get(
      'payment_intent_client_secret'
    );

    if (!clientSecret) {
      setStatus('error');
      setMessage('Informations de paiement manquantes');
      return;
    }

    stripe.retrievePaymentIntent(clientSecret).then(({ paymentIntent }) => {
      if (!paymentIntent) {
        setStatus('error');
        setMessage('Paiement introuvable');
        return;
      }

      switch (paymentIntent.status) {
        case 'succeeded':
          setStatus('success');
          setMessage('Votre paiement a été traité avec succès !');
          break;
        case 'processing':
          setStatus('success');
          setMessage('Votre paiement est en cours de traitement.');
          break;
        case 'requires_payment_method':
          setStatus('error');
          setMessage('Le paiement a échoué. Veuillez réessayer.');
          break;
        default:
          setStatus('error');
          setMessage('Une erreur est survenue.');
          break;
      }
    });
  }, [stripe]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#F8F9FA] to-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#FF6B00] mx-auto mb-4"></div>
          <p className="text-lg text-[#6C757D]">Vérification du paiement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F8F9FA] to-white">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          {status === 'success' ? (
            <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-12 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg
                  className="w-12 h-12 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>

              <h1 className="text-3xl font-bold text-[#2C3E50] mb-4">
                🎉 Paiement réussi !
              </h1>

              <p className="text-lg text-[#6C757D] mb-8">
                {message}
              </p>

              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-8 text-left">
                <h2 className="font-bold text-[#2C3E50] mb-4">
                  📋 Prochaines étapes
                </h2>
                <ul className="space-y-3 text-[#6C757D]">
                  <li className="flex items-start gap-3">
                    <span className="text-[#FF6B00] font-bold">1.</span>
                    <span>Votre argent est sécurisé sur un compte séquestre</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-[#FF6B00] font-bold">2.</span>
                    <span>L'artisan a été notifié et peut maintenant intervenir</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-[#FF6B00] font-bold">3.</span>
                    <span>Vous recevrez une notification à la fin de l'intervention</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-[#FF6B00] font-bold">4.</span>
                    <span>Le paiement sera libéré à l'artisan après votre confirmation</span>
                  </li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  onClick={() => router.push('/client/dashboard')}
                  variant="secondary"
                  className="flex-1"
                >
                  📊 Mon dashboard
                </Button>
                {demandeId && (
                  <Button
                    onClick={() => router.push(`/client/demandes-express/${demandeId}`)}
                    className="flex-1"
                  >
                    📝 Voir ma demande
                  </Button>
                )}
              </div>

              <div className="mt-8 pt-8 border-t border-[#E9ECEF]">
                <p className="text-sm text-[#6C757D] mb-4">
                  <strong>💳 Détails du paiement</strong>
                </p>
                <div className="bg-[#F5F7FA] rounded-lg p-4">
                  <p className="text-xs text-[#6C757D]">
                    Vous recevrez un email de confirmation de Stripe avec tous les détails de votre transaction.
                  </p>
                </div>
              </div>

              <div className="mt-8 bg-green-50 rounded-lg p-4">
                <p className="text-sm text-[#2C3E50] mb-2">
                  <strong>✅ Garanties</strong>
                </p>
                <ul className="text-xs text-[#6C757D] space-y-1 text-left">
                  <li>🔒 Transaction 100% sécurisée par Stripe</li>
                  <li>💰 Argent bloqué jusqu'à confirmation des travaux</li>
                  <li>🛡️ Protection acheteur incluse</li>
                  <li>📞 Support disponible 7j/7</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-12 text-center">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg
                  className="w-12 h-12 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>

              <h1 className="text-3xl font-bold text-[#2C3E50] mb-4">
                ❌ Échec du paiement
              </h1>

              <p className="text-lg text-[#6C757D] mb-8">
                {message}
              </p>

              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 mb-8">
                <h2 className="font-bold text-[#2C3E50] mb-4">
                  💡 Que faire ?
                </h2>
                <ul className="space-y-2 text-[#6C757D] text-left">
                  <li>• Vérifiez les informations de votre carte bancaire</li>
                  <li>• Assurez-vous d'avoir suffisamment de fonds</li>
                  <li>• Contactez votre banque si le problème persiste</li>
                  <li>• Essayez avec une autre carte</li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  onClick={() => router.push('/client/dashboard')}
                  variant="secondary"
                  className="flex-1"
                >
                  ← Dashboard
                </Button>
                {demandeId && (
                  <Button
                    onClick={() => router.push(`/client/demandes-express/${demandeId}`)}
                    className="flex-1"
                  >
                    🔄 Réessayer
                  </Button>
                )}
              </div>

              <p className="text-xs text-center text-[#6C757D] mt-8">
                Besoin d'aide ?{' '}
                <Link href="/contact" className="text-[#FF6B00] hover:underline">
                  Contactez notre support
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
