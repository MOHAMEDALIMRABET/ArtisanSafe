/**
 * Service de gestion des webhooks Stripe
 * 
 * Gère les événements Stripe Connect :
 * - account.updated : Mise à jour du statut du compte
 * - account.application.deauthorized : Compte déconnecté
 * - capability.updated : Mise à jour des capacités de paiement
 * 
 * Documentation : https://stripe.com/docs/connect/webhooks
 */

import Stripe from 'stripe';
import admin from 'firebase-admin';

// ⚠️ Initialisation conditionnelle de Stripe (Phase 2)
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-01-28.clover',
    })
  : null;

const db = admin.firestore();

/**
 * Statuts possibles du wallet artisan
 */
export type StripeOnboardingStatus =
  | 'not_started'
  | 'pending'
  | 'documents_required'
  | 'under_review'
  | 'active'
  | 'rejected'
  | 'restricted';

/**
 * Mapper le statut Stripe vers notre système
 */
function mapStripeStatusToWalletStatus(account: Stripe.Account): StripeOnboardingStatus {
  // Compte complètement vérifié et actif
  if (account.charges_enabled && account.payouts_enabled) {
    return 'active';
  }

  // Documents requis
  if (account.requirements?.currently_due && account.requirements.currently_due.length > 0) {
    return 'documents_required';
  }

  // En attente de vérification (sous examen)
  if (account.requirements?.pending_verification && account.requirements.pending_verification.length > 0) {
    return 'under_review';
  }

  // Compte restreint (problème détecté)
  if (account.requirements?.disabled_reason) {
    const disabledReason = account.requirements.disabled_reason;
    
    if (disabledReason === 'rejected.fraud' || 
        disabledReason === 'rejected.terms_of_service' ||
        disabledReason === 'rejected.listed' ||
        disabledReason === 'rejected.other') {
      return 'rejected';
    }
    
    return 'restricted';
  }

  // Par défaut, en attente
  return 'pending';
}

/**
 * Gérer l'événement account.updated
 * Mise à jour du statut du compte dans Firestore
 */
export async function handleAccountUpdated(account: Stripe.Account): Promise<void> {
  try {
    console.log(`📡 Webhook: account.updated pour ${account.id}`);

    // Trouver l'artisan avec ce stripeAccountId
    const artisansSnapshot = await db.collection('artisans')
      .where('stripeAccountId', '==', account.id)
      .limit(1)
      .get();

    if (artisansSnapshot.empty) {
      console.warn(`⚠️ Aucun artisan trouvé avec stripeAccountId: ${account.id}`);
      return;
    }

    const artisanDoc = artisansSnapshot.docs[0];
    const artisanId = artisanDoc.id;

    // Calculer le nouveau statut
    const newStatus = mapStripeStatusToWalletStatus(account);

    console.log(`📊 Nouveau statut pour ${artisanId}: ${newStatus}`);
    console.log(`   - charges_enabled: ${account.charges_enabled}`);
    console.log(`   - payouts_enabled: ${account.payouts_enabled}`);
    console.log(`   - currently_due: ${account.requirements?.currently_due?.length || 0}`);
    console.log(`   - pending_verification: ${account.requirements?.pending_verification?.length || 0}`);
    console.log(`   - disabled_reason: ${account.requirements?.disabled_reason || 'none'}`);

    // Mettre à jour le wallet
    const walletRef = db.collection('wallets').doc(artisanId);
    const walletDoc = await walletRef.get();

    if (!walletDoc.exists) {
      console.warn(`⚠️ Wallet non trouvé pour artisan ${artisanId}`);
      return;
    }

    // Préparer les données de mise à jour
    const updateData: any = {
      stripeOnboardingStatus: newStatus,
      lastStripeSync: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Ajouter des détails selon le statut
    if (newStatus === 'documents_required') {
      updateData.stripeRequirements = {
        currentlyDue: account.requirements?.currently_due || [],
        eventuallyDue: account.requirements?.eventually_due || [],
        errors: account.requirements?.errors || [],
      };
    }

    if (newStatus === 'rejected' || newStatus === 'restricted') {
      updateData.stripeDisabledReason = account.requirements?.disabled_reason || 'unknown';
    }

    if (newStatus === 'active') {
      updateData.stripeActivatedAt = admin.firestore.FieldValue.serverTimestamp();
      // Supprimer les anciennes erreurs
      updateData.stripeRequirements = admin.firestore.FieldValue.delete();
      updateData.stripeDisabledReason = admin.firestore.FieldValue.delete();
    }

    // Mettre à jour Firestore
    await walletRef.update(updateData);

    console.log(`✅ Wallet mis à jour pour ${artisanId}: ${newStatus}`);

  } catch (error) {
    console.error('❌ Erreur handleAccountUpdated:', error);
    throw error;
  }
}

/**
 * Gérer l'événement account.application.deauthorized
 * L'artisan a révoqué l'accès à son compte Stripe
 */
export async function handleAccountDeauthorized(accountId: string): Promise<void> {
  try {
    console.log(`📡 Webhook: account.application.deauthorized pour ${accountId}`);

    // Trouver l'artisan
    const artisansSnapshot = await db.collection('artisans')
      .where('stripeAccountId', '==', accountId)
      .limit(1)
      .get();

    if (artisansSnapshot.empty) {
      console.warn(`⚠️ Aucun artisan trouvé avec stripeAccountId: ${accountId}`);
      return;
    }

    const artisanId = artisansSnapshot.docs[0].id;

    // Mettre à jour le wallet
    const walletRef = db.collection('wallets').doc(artisanId);
    await walletRef.update({
      stripeOnboardingStatus: 'not_started',
      stripeAccountId: admin.firestore.FieldValue.delete(),
      stripeDisabledReason: 'deauthorized',
      lastStripeSync: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Supprimer stripeAccountId de l'artisan
    await db.collection('artisans').doc(artisanId).update({
      stripeAccountId: admin.firestore.FieldValue.delete(),
    });

    console.log(`✅ Compte Stripe déconnecté pour artisan ${artisanId}`);

  } catch (error) {
    console.error('❌ Erreur handleAccountDeauthorized:', error);
    throw error;
  }
}

/**
 * Gérer l'événement capability.updated
 * Mise à jour des capacités de paiement (card_payments, transfers)
 */
export async function handleCapabilityUpdated(capability: Stripe.Capability): Promise<void> {
  try {
    if (!stripe) {
      throw new Error('STRIPE_SECRET_KEY non configurée - Fonctionnalité Phase 2 non activée');
    }

    console.log(`📡 Webhook: capability.updated - ${capability.id}`);

    const accountId = capability.account;

    // Récupérer le compte complet pour avoir le statut global
    const account = await stripe.accounts.retrieve(accountId as string);

    // Utiliser handleAccountUpdated pour mettre à jour le statut global
    await handleAccountUpdated(account);

  } catch (error) {
    console.error('❌ Erreur handleCapabilityUpdated:', error);
    throw error;
  }
}

/**
 * Vérifier la signature du webhook Stripe
 * Sécurité : S'assurer que l'événement vient bien de Stripe
 */
export function verifyWebhookSignature(
  payload: Buffer,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  try {
    if (!stripe) {
      throw new Error('STRIPE_SECRET_KEY non configurée - Fonctionnalité Phase 2 non activée');
    }

    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error: any) {
    console.error('❌ Erreur vérification signature webhook:', error.message);
    throw new Error(`Webhook signature verification failed: ${error.message}`);
  }
}

/**
 * Router principal des webhooks
 * Dispatcher les événements vers les bons handlers
 */
export async function handleStripeWebhook(event: Stripe.Event): Promise<void> {
  console.log(`📡 Webhook Stripe reçu: ${event.type}`);

  try {
    switch (event.type) {
      case 'account.updated':
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;

      case 'account.application.deauthorized':
        // L'événement contient l'account ID dans event.account
        await handleAccountDeauthorized(event.account as string);
        break;

      case 'capability.updated':
        await handleCapabilityUpdated(event.data.object as Stripe.Capability);
        break;

      // Autres événements potentiellement utiles
      case 'person.created':
      case 'person.updated':
        console.log(`ℹ️ Événement ${event.type} reçu (non géré pour l'instant)`);
        break;

      default:
        console.log(`ℹ️ Événement ${event.type} ignoré`);
    }
  } catch (error) {
    console.error(`❌ Erreur traitement webhook ${event.type}:`, error);
    throw error;
  }
}
