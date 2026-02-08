'use client';

/**
 * Composant de paiement Stripe Elements
 * Remplace PaymentForm.tsx (simulation) par vrai paiement Stripe
 * 
 * PHASE 2 : Production ready
 */

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';

// Charger Stripe avec clé publique
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface StripePaymentFormProps {
  devisId: string;
  montantTTC: number;
  numeroDevis: string;
  clientSecret: string;  // Reçu depuis backend /create-escrow
  onSuccess: () => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

/**
 * Formulaire de paiement interne (utilise Stripe hooks)
 */
function CheckoutForm({ 
  devisId, 
  montantTTC,
  numeroDevis,
  onSuccess, 
  onError,
  onCancel
}: Omit<StripePaymentFormProps, 'clientSecret'>) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js pas encore chargé
      return;
    }

    setProcessing(true);
    setMessage(null);

    try {
      // Confirmer le paiement avec Stripe
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/client/devis/${devisId}?payment=success`,
        },
        redirect: 'if_required', // Pas de redirection si authentification pas nécessaire
      });

      if (error) {
        // Erreur paiement (carte refusée, fonds insuffisants, etc.)
        console.error('❌ Erreur Stripe:', error);
        setMessage(error.message || 'Erreur de paiement');
        onError(error.message || 'Erreur de paiement');
      } else if (paymentIntent) {
        // Vérifier statut PaymentIntent
        if (paymentIntent.status === 'requires_capture') {
          // ✅ Paiement autorisé, argent bloqué en escrow
          console.log('✅ Paiement autorisé (escrow):', paymentIntent.id);
          onSuccess();
        } else if (paymentIntent.status === 'succeeded') {
          // Paiement capturé immédiatement (ne devrait pas arriver avec capture_method: manual)
          console.log('✅ Paiement réussi:', paymentIntent.id);
          onSuccess();
        } else {
          // Autres statuts (processing, requires_payment_method, etc.)
          console.log('⏳ Paiement en cours:', paymentIntent.status);
          setMessage(`Paiement en cours : ${paymentIntent.status}`);
        }
      }
    } catch (err: any) {
      console.error('❌ Exception paiement:', err);
      setMessage(err.message);
      onError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Élément de paiement Stripe (carte, Apple Pay, Google Pay, etc.) */}
      <div className="p-4 bg-white rounded-lg border border-gray-300">
        <PaymentElement />
      </div>

      {/* Message d'erreur */}
      {message && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {message}
        </div>
      )}

      {/* Résumé paiement */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-600">Devis n°</span>
          <span className="font-medium">{numeroDevis}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Montant à payer</span>
          <span className="text-xl font-bold text-[#FF6B00]">{montantTTC.toFixed(2)}€</span>
        </div>
      </div>

      {/* Note sécurité */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
        🔒 <strong>Paiement sécurisé</strong> : L'argent sera bloqué en séquestre et versé à l'artisan uniquement après validation des travaux.
      </div>

      {/* Boutons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={processing}
          className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={!stripe || processing}
          className="flex-1 px-4 py-3 bg-[#FF6B00] text-white rounded-lg hover:bg-[#E56100] disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
        >
          {processing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Traitement...
            </span>
          ) : (
            `Payer ${montantTTC.toFixed(2)}€`
          )}
        </button>
      </div>
    </form>
  );
}

/**
 * Composant principal avec Elements provider
 */
export function StripePaymentForm(props: StripePaymentFormProps) {
  const options = {
    clientSecret: props.clientSecret,
    appearance: {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: '#FF6B00',
        colorBackground: '#ffffff',
        colorText: '#2C3E50',
        colorDanger: '#DC3545',
        fontFamily: 'system-ui, sans-serif',
        spacingUnit: '4px',
        borderRadius: '8px',
      },
    },
  };

  return (
    <div className="max-w-lg mx-auto">
      <Elements stripe={stripePromise} options={options}>
        <CheckoutForm {...props} />
      </Elements>
    </div>
  );
}
