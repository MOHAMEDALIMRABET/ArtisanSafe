/**
 * Routes Webhooks Stripe
 * 
 * Reçoit et traite les événements Stripe pour sécuriser les paiements
 * CRITIQUE : Valide signature webhook pour éviter fraude
 * 
 * Événements gérés :
 * - payment_intent.amount_capturable_updated : Paiement autorisé (escrow bloqué)
 * - payment_intent.payment_failed : Paiement échoué
 * - charge.captured : Paiement capturé (escrow libéré)
 * - transfer.created : Transfert artisan effectué
 */

import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const router = Router();
const db = getFirestore();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia',
});

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

/**
 * POST /api/v1/webhooks/stripe
 * 
 * Endpoint webhook Stripe - Synchronisation paiements
 * 
 * IMPORTANT : Ce endpoint doit recevoir le raw body (pas de JSON parsing)
 * Configuration dans server.ts : express.raw({ type: 'application/json' })
 */
router.post('/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;

  if (!sig) {
    console.error('❌ Webhook: Signature manquante');
    return res.status(400).send('Signature manquante');
  }

  let event: Stripe.Event;

  try {
    // ✅ Vérifier signature webhook (SÉCURITÉ CRITIQUE)
    event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
  } catch (err: any) {
    console.error('❌ Webhook signature invalide:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`📨 Webhook reçu: ${event.type} - ${event.id}`);

  // Traiter événements selon type
  try {
    switch (event.type) {
      case 'payment_intent.amount_capturable_updated':
        // Paiement autorisé (escrow bloqué)
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentAuthorized(paymentIntent);
        break;

      case 'payment_intent.payment_failed':
        // Paiement échoué
        const failedIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailed(failedIntent);
        break;

      case 'charge.captured':
        // Paiement capturé (escrow libéré)
        const charge = event.data.object as Stripe.Charge;
        await handlePaymentCaptured(charge);
        break;

      case 'transfer.created':
        // Transfert artisan effectué
        const transfer = event.data.object as Stripe.Transfer;
        await handleTransferCreated(transfer);
        break;

      case 'payment_intent.canceled':
        // PaymentIntent annulé
        const canceledIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentCanceled(canceledIntent);
        break;

      default:
        console.log(`ℹ️ Événement non géré: ${event.type}`);
    }

    res.status(200).json({ received: true });

  } catch (error: any) {
    console.error(`❌ Erreur traitement webhook ${event.type}:`, error);
    res.status(500).json({ error: 'Erreur traitement webhook' });
  }
});

/**
 * Paiement autorisé (escrow bloqué)
 * 
 * Appelé quand le client paie avec succès
 * L'argent est BLOQUÉ (pas encore capturé)
 */
async function handlePaymentAuthorized(paymentIntent: Stripe.PaymentIntent) {
  const devisId = paymentIntent.metadata.devisId;
  const clientId = paymentIntent.metadata.clientId;
  const artisanId = paymentIntent.metadata.artisanId;

  if (!devisId) {
    console.error('❌ Webhook: devisId manquant dans metadata');
    return;
  }

  console.log(`✅ Paiement autorisé (webhook): ${paymentIntent.id} - Devis: ${devisId}`);

  try {
    // Mettre à jour devis (SÉCURISÉ côté serveur)
    await db.collection('devis').doc(devisId).update({
      statut: 'paye',
      datePaiement: Timestamp.now(),
      'paiement.statut': 'bloque',
      'paiement.stripe.paymentIntentId': paymentIntent.id,
      'paiement.montant': paymentIntent.amount / 100,
      'paiement.dateBlocage': Timestamp.now()
    });

    // Créer notification artisan
    await db.collection('notifications').add({
      recipientId: artisanId,
      type: 'devis_paye',
      title: '💰 Devis payé',
      message: `Le client a payé le devis. L'argent est bloqué en sécurité.`,
      relatedId: devisId,
      isRead: false,
      createdAt: Timestamp.now()
    });

    console.log(`✅ Devis ${devisId} mis à jour: statut=paye`);

  } catch (error) {
    console.error('❌ Erreur mise à jour devis:', error);
  }
}

/**
 * Paiement échoué
 * 
 * Appelé quand le paiement échoue (carte refusée, fonds insuffisants, etc.)
 */
async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const devisId = paymentIntent.metadata.devisId;
  const clientId = paymentIntent.metadata.clientId;

  if (!devisId) return;

  console.log(`❌ Paiement échoué (webhook): ${paymentIntent.id} - Devis: ${devisId}`);

  try {
    // Mettre à jour devis
    await db.collection('devis').doc(devisId).update({
      'paiement.statut': 'echec',
      'paiement.erreur': paymentIntent.last_payment_error?.message || 'Paiement échoué',
      'paiement.dateEchec': Timestamp.now()
    });

    // Créer notification client
    await db.collection('notifications').add({
      recipientId: clientId,
      type: 'paiement_echec',
      title: '❌ Paiement échoué',
      message: `Le paiement a échoué. Veuillez réessayer avec une autre carte.`,
      relatedId: devisId,
      isRead: false,
      createdAt: Timestamp.now()
    });

    console.log(`✅ Devis ${devisId} mis à jour: paiement échoué`);

  } catch (error) {
    console.error('❌ Erreur notification échec paiement:', error);
  }
}

/**
 * Paiement capturé (escrow libéré)
 * 
 * Appelé quand le paiement est capturé (après validation travaux)
 * L'argent est maintenant CAPTURE (transaction finalisée)
 */
async function handlePaymentCaptured(charge: Stripe.Charge) {
  const paymentIntentId = charge.payment_intent as string;

  console.log(`💰 Paiement capturé (webhook): ${charge.id} - PaymentIntent: ${paymentIntentId}`);

  try {
    // Rechercher contrat par paymentIntentId
    const contratsSnapshot = await db.collection('contrats')
      .where('paiement.stripe.paymentIntentId', '==', paymentIntentId)
      .limit(1)
      .get();

    if (contratsSnapshot.empty) {
      console.log(`ℹ️ Aucun contrat trouvé pour PaymentIntent: ${paymentIntentId}`);
      return;
    }

    const contratDoc = contratsSnapshot.docs[0];
    const contratId = contratDoc.id;

    // Confirmer capture dans Firestore
    await db.collection('contrats').doc(contratId).update({
      'paiement.stripe.chargeId': charge.id,
      'paiement.stripe.captureDate': Timestamp.now(),
      'paiement.statut': 'libere',
      'paiement.dateLiberation': Timestamp.now()
    });

    console.log(`✅ Contrat ${contratId} mis à jour: paiement capturé`);

  } catch (error) {
    console.error('❌ Erreur mise à jour capture:', error);
  }
}

/**
 * Transfert artisan créé
 * 
 * Appelé quand l'argent est transféré au compte Stripe Connect de l'artisan
 */
async function handleTransferCreated(transfer: Stripe.Transfer) {
  const contratId = transfer.metadata.contratId;
  const artisanId = transfer.metadata.artisanId;

  if (!contratId) {
    console.log('ℹ️ Transfer sans contratId dans metadata');
    return;
  }

  console.log(`💸 Transfert artisan créé (webhook): ${transfer.id} - Contrat: ${contratId}`);

  try {
    // Mettre à jour contrat
    await db.collection('contrats').doc(contratId).update({
      'paiement.stripe.transferId': transfer.id,
      'paiement.dateVirement': Timestamp.now(),
      'paiement.montantTransfere': transfer.amount / 100
    });

    // Créer notification artisan
    await db.collection('notifications').add({
      recipientId: artisanId,
      type: 'paiement_recu',
      title: '💸 Paiement reçu',
      message: `Votre paiement de ${(transfer.amount / 100).toFixed(2)}€ a été transféré. Il apparaîtra sous 1-2 jours ouvrés sur votre compte bancaire.`,
      relatedId: contratId,
      isRead: false,
      createdAt: Timestamp.now()
    });

    console.log(`✅ Transfert ${transfer.id} enregistré pour contrat ${contratId}`);

  } catch (error) {
    console.error('❌ Erreur mise à jour transfert:', error);
  }
}

/**
 * PaymentIntent annulé
 * 
 * Appelé quand le paiement est annulé (timeout 24h ou annulation manuelle)
 */
async function handlePaymentCanceled(paymentIntent: Stripe.PaymentIntent) {
  const devisId = paymentIntent.metadata.devisId;

  if (!devisId) return;

  console.log(`🔙 Paiement annulé (webhook): ${paymentIntent.id} - Devis: ${devisId}`);

  try {
    // Mettre à jour devis
    await db.collection('devis').doc(devisId).update({
      statut: 'annule',
      'paiement.statut': 'annule',
      'paiement.dateAnnulation': Timestamp.now()
    });

    console.log(`✅ Devis ${devisId} mis à jour: paiement annulé`);

  } catch (error) {
    console.error('❌ Erreur mise à jour annulation:', error);
  }
}

export default router;
