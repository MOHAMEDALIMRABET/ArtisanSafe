import express from 'express';
import Stripe from 'stripe';
import {
  getPropositionExpressById,
  getDemandeExpressById,
  markDemandePaid,
} from '../services/demande-express.service';
import {
  createPaiementExpress,
  getPaiementByDemandeId,
  updatePaiementStatut,
  markPaiementLibere,
  markPaiementRembourse,
} from '../services/paiement-express.service';

const router = express.Router();

// Initialiser Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-01-28.clover',
});

// ====================================
// 1. Créer PaymentIntent (escrow)
// ====================================
router.post('/create-payment-intent', async (req, res) => {
  try {
    const { propositionId } = req.body;

    if (!propositionId) {
      return res.status(400).json({ error: 'propositionId requis' });
    }

    // Récupérer proposition
    const proposition = await getPropositionExpressById(propositionId);
    if (!proposition) {
      return res.status(404).json({ error: 'Proposition introuvable' });
    }

    // Vérifier statut
    if (proposition.statut !== 'acceptee') {
      return res.status(400).json({ 
        error: 'La proposition doit être acceptée avant le paiement' 
      });
    }

    // Vérifier si paiement déjà créé
    const existingPaiement = await getPaiementByDemandeId(proposition.demandeId);
    if (existingPaiement) {
      return res.status(400).json({ 
        error: 'Un paiement existe déjà pour cette demande',
        existingPaymentIntentId: existingPaiement.stripePaymentIntentId,
      });
    }

    // Récupérer demande
    const demande = await getDemandeExpressById(proposition.demandeId);
    if (!demande) {
      return res.status(404).json({ error: 'Demande introuvable' });
    }

    // Créer PaymentIntent avec CAPTURE MANUELLE (escrow)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(proposition.montantPropose * 100), // Centimes
      currency: 'eur',
      capture_method: 'manual', // ← CRITIQUE pour escrow
      metadata: {
        propositionId: proposition.id,
        demandeId: proposition.demandeId,
        clientId: proposition.clientId,
        artisanId: proposition.artisanId,
        categorie: demande.categorie,
      },
      description: `Travaux Express - ${demande.categorie} - ${demande.ville}`,
      statement_descriptor: 'ARTISANSAFE',
    });

    console.log(`✅ PaymentIntent créé: ${paymentIntent.id}`);
    console.log(`   - Montant: ${proposition.montantPropose}€`);
    console.log(`   - Mode: ESCROW (capture manuelle)`);

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      montant: proposition.montantPropose,
    });
  } catch (error: any) {
    console.error('❌ Erreur création PaymentIntent:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la création du paiement',
      details: error.message,
    });
  }
});

// ====================================
// 2. Webhook Stripe (CRITIQUE)
// ====================================
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;

    if (!sig) {
      console.error('❌ Webhook: Pas de signature Stripe');
      return res.status(400).send('Signature manquante');
    }

    let event: Stripe.Event;

    try {
      // Vérifier signature Stripe
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET || ''
      );
    } catch (err: any) {
      console.error('❌ Webhook signature invalide:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`📨 Webhook reçu: ${event.type}`);

    // Gérer événements
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;

        case 'charge.refunded':
          await handleChargeRefunded(event.data.object as Stripe.Charge);
          break;

        default:
          console.log(`ℹ️  Événement non géré: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error(`❌ Erreur traitement webhook ${event.type}:`, error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Handler: Paiement réussi
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const { demandeId, propositionId, clientId, artisanId } = paymentIntent.metadata;

  console.log(`✅ Paiement réussi: ${paymentIntent.id}`);
  console.log(`   - Demande: ${demandeId}`);
  console.log(`   - Montant: ${paymentIntent.amount / 100}€`);

  // Calculer commission (10%)
  const montantTotal = paymentIntent.amount / 100;
  const commission = Math.round(montantTotal * 0.1 * 100) / 100;
  const montantArtisan = montantTotal - commission;

  // Créer document paiement_express
  await createPaiementExpress({
    demandeId,
    propositionId,
    clientId,
    artisanId,
    stripePaymentIntentId: paymentIntent.id,
    montant: montantTotal,
    commission,
    montantArtisan,
    statut: 'paye',
  });

  // Mettre à jour demande → 'payee'
  await markDemandePaid(demandeId);

  console.log(`💰 Commission plateforme: ${commission}€`);
  console.log(`💰 Montant artisan (après capture): ${montantArtisan}€`);
  
  // TODO: Envoyer notification artisan "Vous pouvez intervenir"
}

// Handler: Remboursement
async function handleChargeRefunded(charge: Stripe.Charge) {
  const paymentIntentId = charge.payment_intent as string;
  
  console.log(`💸 Remboursement détecté: ${charge.id}`);
  console.log(`   - PaymentIntent: ${paymentIntentId}`);

  // Trouver paiement correspondant
  const snapshot = await require('../config/firebase-admin').db
    .collection('paiements_express')
    .where('stripePaymentIntentId', '==', paymentIntentId)
    .limit(1)
    .get();

  if (!snapshot.empty) {
    const paiement = snapshot.docs[0];
    await markPaiementRembourse(paiement.id);
    console.log(`✅ Paiement ${paiement.id} marqué comme remboursé`);
  }
}

// ====================================
// 3. Capture paiement (libérer escrow)
// ====================================
router.post('/capture-payment', async (req, res) => {
  try {
    const { demandeId } = req.body;

    if (!demandeId) {
      return res.status(400).json({ error: 'demandeId requis' });
    }

    // Récupérer paiement
    const paiement = await getPaiementByDemandeId(demandeId);
    if (!paiement) {
      return res.status(404).json({ error: 'Paiement introuvable' });
    }

    // Vérifier statut
    if (paiement.statut !== 'paye') {
      return res.status(400).json({ 
        error: `Paiement déjà ${paiement.statut}`,
      });
    }

    // Vérifier que demande est terminée
    const demande = await getDemandeExpressById(demandeId);
    if (!demande || demande.statut !== 'terminee') {
      return res.status(400).json({ 
        error: 'La demande doit être terminée pour libérer le paiement',
        currentStatut: demande?.statut,
      });
    }

    console.log(`🔓 Capture paiement: ${paiement.stripePaymentIntentId}`);
    console.log(`   - Montant total: ${paiement.montant}€`);
    console.log(`   - Montant artisan: ${paiement.montantArtisan}€`);

    // Capturer PaymentIntent (libérer escrow)
    const capturedPaymentIntent = await stripe.paymentIntents.capture(
      paiement.stripePaymentIntentId,
      {
        amount_to_capture: Math.round(paiement.montantArtisan * 100), // 90%
      }
    );

    const chargeId = capturedPaymentIntent.latest_charge as string;

    // Mettre à jour paiement → 'libere'
    await markPaiementLibere(paiement.id, chargeId);

    console.log(`✅ Paiement capturé et libéré`);
    console.log(`   - Charge ID: ${chargeId}`);
    console.log(`   - Montant transféré artisan: ${paiement.montantArtisan}€`);
    console.log(`   - Commission retenue: ${paiement.commission}€`);

    res.json({
      success: true,
      chargeId,
      montantCapture: paiement.montantArtisan,
      commission: paiement.commission,
    });
  } catch (error: any) {
    console.error('❌ Erreur capture paiement:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la capture du paiement',
      details: error.message,
    });
  }
});

// ====================================
// 4. Remboursement (litige)
// ====================================
router.post('/refund-payment', async (req, res) => {
  try {
    const { demandeId, reason } = req.body;

    if (!demandeId) {
      return res.status(400).json({ error: 'demandeId requis' });
    }

    // Récupérer paiement
    const paiement = await getPaiementByDemandeId(demandeId);
    if (!paiement) {
      return res.status(404).json({ error: 'Paiement introuvable' });
    }

    // Vérifier qu'on peut rembourser
    if (paiement.statut === 'libere') {
      return res.status(400).json({ 
        error: 'Paiement déjà libéré à l\'artisan, remboursement impossible',
      });
    }

    if (paiement.statut === 'rembourse') {
      return res.status(400).json({ 
        error: 'Paiement déjà remboursé',
      });
    }

    console.log(`💸 Remboursement demandé: ${paiement.stripePaymentIntentId}`);
    console.log(`   - Montant: ${paiement.montant}€`);
    console.log(`   - Raison: ${reason || 'Non spécifiée'}`);

    // Créer refund Stripe
    const refund = await stripe.refunds.create({
      payment_intent: paiement.stripePaymentIntentId,
      reason: 'requested_by_customer',
      metadata: {
        demandeId,
        reason: reason || 'Litige',
      },
    });

    // Mettre à jour paiement → 'rembourse'
    await markPaiementRembourse(paiement.id);

    console.log(`✅ Remboursement effectué`);
    console.log(`   - Refund ID: ${refund.id}`);
    console.log(`   - Montant remboursé: ${paiement.montant}€`);

    res.json({
      success: true,
      refundId: refund.id,
      montantRembourse: paiement.montant,
    });
  } catch (error: any) {
    console.error('❌ Erreur remboursement:', error);
    res.status(500).json({ 
      error: 'Erreur lors du remboursement',
      details: error.message,
    });
  }
});

// ====================================
// 5. Statut paiement (pour debug)
// ====================================
router.get('/payment-status/:demandeId', async (req, res) => {
  try {
    const { demandeId } = req.params;
    
    const paiement = await getPaiementByDemandeId(demandeId);
    if (!paiement) {
      return res.status(404).json({ error: 'Paiement introuvable' });
    }

    res.json({
      paiementId: paiement.id,
      statut: paiement.statut,
      montant: paiement.montant,
      commission: paiement.commission,
      montantArtisan: paiement.montantArtisan,
      createdAt: paiement.createdAt,
      paidAt: paiement.paidAt,
      releasedAt: paiement.releasedAt,
      refundedAt: paiement.refundedAt,
    });
  } catch (error: any) {
    console.error('❌ Erreur statut paiement:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
