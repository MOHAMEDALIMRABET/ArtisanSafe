'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getPropositionExpressById, getDemandeExpressById } from '@/lib/firebase/demande-express-service';
import { getArtisanByUserId } from '@/lib/firebase/user-service';
import { useAuth } from '@/hooks/useAuth';
import type { PropositionExpress, DemandeExpress, Artisan } from '@/types/firestore';
import { Button } from '@/components/ui/Button';

export default function PaiementExpressPage() {
  const router = useRouter();
  const params = useParams();
  const propositionId = params.id as string;
  const { user: firebaseUser } = useAuth();

  const [proposition, setProposition] = useState<PropositionExpress | null>(null);
  const [demande, setDemande] = useState<DemandeExpress | null>(null);
  const [artisan, setArtisan] = useState<Artisan | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!firebaseUser) {
      router.push('/connexion');
      return;
    }
    loadData();
  }, [firebaseUser, propositionId]);

  async function loadData() {
    if (!firebaseUser) return;

    try {
      const propositionData = await getPropositionExpressById(propositionId);
      if (!propositionData) {
        alert('Proposition introuvable');
        router.push('/client/dashboard');
        return;
      }

      if (propositionData.clientId !== firebaseUser.uid) {
        alert('Accès non autorisé');
        router.push('/client/dashboard');
        return;
      }

      setProposition(propositionData);

      const demandeData = await getDemandeExpressById(propositionData.demandeId);
      setDemande(demandeData);

      const artisanData = await getArtisanByUserId(propositionData.artisanId);
      setArtisan(artisanData);
    } catch (error) {
      console.error('Erreur chargement:', error);
      alert('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }

  async function handlePaiement() {
    if (!proposition) return;

    setProcessing(true);
    try {
      // TODO: Appeler backend pour créer PaymentIntent Stripe
      // const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stripe-express/create-payment-intent`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ propositionId: proposition.id })
      // });
      // const { clientSecret } = await response.json();
      
      // TODO: Rediriger vers Stripe Checkout ou Elements
      // window.location.href = checkoutUrl;

      // TEMPORAIRE: Afficher message
      alert('🚧 Intégration Stripe en cours de développement.\n\n' +
            'Cette fonctionnalité sera disponible dans la prochaine version.\n\n' +
            'Le paiement sécurisé par carte bancaire sera géré via Stripe avec séquestre (escrow).');
      
      // Simuler succès pour tests
      if (confirm('🧪 MODE TEST: Voulez-vous simuler un paiement réussi ?')) {
        // TODO: Appeler markDemandePaid() via webhook Stripe
        router.push(`/client/demandes-express/${proposition.demandeId}`);
      }
    } catch (error) {
      console.error('Erreur paiement:', error);
      alert('Erreur lors du paiement');
    } finally {
      setProcessing(false);
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

  if (!proposition || !demande) {
    return null;
  }

  const commission = Math.round(proposition.montantPropose * 0.1 * 100) / 100;
  const montantArtisan = proposition.montantPropose - commission;

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
            <Link href={`/client/demandes-express/${demande.id}`} className="text-[#2C3E50] hover:text-[#FF6B00]">
              Ma demande
            </Link>
            <span className="text-[#6C757D]">&gt;</span>
            <span className="text-[#2C3E50] font-semibold">Paiement</span>
          </nav>

          <h1 className="text-2xl md:text-3xl font-bold text-[#2C3E50]">
            💳 Paiement sécurisé
          </h1>
        </div>
      </div>

      {/* Contenu */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Récapitulatif */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-[#2C3E50] mb-6">
              📋 Récapitulatif
            </h2>

            <div className="space-y-4">
              <div className="flex justify-between items-start pb-4 border-b border-[#E9ECEF]">
                <div>
                  <p className="text-sm text-[#6C757D]">Prestation</p>
                  <p className="font-semibold text-[#2C3E50]">
                    {demande.categorie.charAt(0).toUpperCase() + demande.categorie.slice(1)}
                    {demande.sousCategorie && ` • ${demande.sousCategorie}`}
                  </p>
                </div>
              </div>

              {artisan && (
                <div className="flex justify-between items-start pb-4 border-b border-[#E9ECEF]">
                  <div>
                    <p className="text-sm text-[#6C757D]">Artisan</p>
                    <p className="font-semibold text-[#2C3E50]">{artisan.businessName}</p>
                    <p className="text-sm text-[#6C757D]">
                      {artisan.location.ville} ({artisan.location.codePostal})
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-start pb-4 border-b border-[#E9ECEF]">
                <div className="flex-1">
                  <p className="text-sm text-[#6C757D] mb-1">Détails de la prestation</p>
                  <p className="text-[#2C3E50]">{proposition.description}</p>
                </div>
              </div>

              {proposition.delaiIntervention && (
                <div className="flex justify-between items-center pb-4 border-b border-[#E9ECEF]">
                  <p className="text-sm text-[#6C757D]">Délai d'intervention</p>
                  <p className="font-semibold text-[#2C3E50]">{proposition.delaiIntervention}</p>
                </div>
              )}

              <div className="flex justify-between items-center pb-4 border-b border-[#E9ECEF]">
                <p className="text-sm text-[#6C757D]">Montant de la prestation</p>
                <p className="text-2xl font-bold text-[#2C3E50]">{proposition.montantPropose}€</p>
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-[#2C3E50] mb-2">
                  <strong>🔒 Paiement sécurisé avec séquestre</strong>
                </p>
                <ul className="text-sm text-[#6C757D] space-y-1">
                  <li>✅ Votre argent est bloqué sur un compte séquestre</li>
                  <li>✅ L'artisan ne le reçoit qu'après la fin de l'intervention</li>
                  <li>✅ Vous pouvez demander un remboursement en cas de litige</li>
                  <li>✅ Commission plateforme : {commission}€ (10%)</li>
                  <li>✅ Montant reçu par l'artisan : {montantArtisan.toFixed(2)}€</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Paiement */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-[#2C3E50] mb-6">
              💳 Mode de paiement
            </h2>

            {/* TODO: Intégrer Stripe Elements ici */}
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6 mb-6">
              <p className="text-yellow-800 font-semibold mb-2">
                🚧 Intégration Stripe en cours
              </p>
              <p className="text-sm text-yellow-700">
                Le paiement par carte bancaire sera bientôt disponible via Stripe.
                Les données bancaires seront chiffrées et sécurisées selon la norme PCI-DSS.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <Button
                variant="secondary"
                onClick={() => router.push(`/client/demandes-express/${demande.id}`)}
                disabled={processing}
              >
                ← Retour
              </Button>
              <Button
                onClick={handlePaiement}
                disabled={processing}
                className="w-full"
              >
                {processing ? '⏳ Traitement...' : `💳 Payer ${proposition.montantPropose}€`}
              </Button>
            </div>

            <p className="text-xs text-center text-[#6C757D] mt-4">
              En cliquant sur "Payer", vous acceptez nos{' '}
              <Link href="/conditions-generales" className="text-[#FF6B00] hover:underline">
                conditions générales
              </Link>{' '}
              et autorisez le débit de votre carte.
            </p>
          </div>

          {/* Garanties */}
          <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
            <h3 className="font-bold text-[#2C3E50] mb-3">
              ✅ Vos garanties
            </h3>
            <ul className="space-y-2 text-sm text-[#6C757D]">
              <li>🔐 Paiement 100% sécurisé par Stripe</li>
              <li>💰 Argent bloqué jusqu'à la fin des travaux</li>
              <li>🛡️ Protection acheteur incluse</li>
              <li>📞 Service client disponible 7j/7</li>
              <li>⚖️ Médiation en cas de litige</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
