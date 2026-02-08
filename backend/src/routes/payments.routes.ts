/**
 * Routes API pour gestion des paiements avec escrow (séquestre) Stripe
 * 
 * Architecture inspirée de BlaBlaCar/Malt :
 * 1. create-escrow: Créer PaymentIntent avec capture_method: manual (argent bloqué)
 * 2. release-escrow: Capturer le paiement et transférer à l'artisan (après validation)
 * 3. refund-escrow: Annuler et rembourser le client (en cas de problème)
 */

import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const router = Router();
const db = getFirestore();

// Initialiser Stripe avec clé secrète
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia',
});

const COMMISSION_RATE = 0.08; // 8% de commission plateforme

/**
 * POST /api/v1/payments/create-escrow
 * 
 * Crée un paiement avec escrow (séquestre) via Stripe
 * Argent BLOQUÉ, pas encore capturé
 * 
 * Body:
 *   - devisId: ID du devis signé
 *   - clientId: UID du client
 *   - artisanId: UID de l'artisan
 *   - montantTTC: Montant TTC en euros
 *   - metadata: Données supplémentaires (numéro devis, description, etc.)
 * 
 * Returns:
 *   - clientSecret: Pour confirmer paiement côté frontend (Stripe Elements)
 *   - paymentIntentId: ID du PaymentIntent créé
 */
router.post('/create-escrow', async (req: Request, res: Response) => {
  try {
    const { devisId, clientId, artisanId, montantTTC, metadata } = req.body;

    // Validation
    if (!devisId || !clientId || !artisanId || !montantTTC) {
      return res.status(400).json({
        error: 'Paramètres manquants',
        details: 'devisId, clientId, artisanId et montantTTC sont requis'
      });
    }

    if (montantTTC <= 0) {
      return res.status(400).json({
        error: 'Montant invalide',
        details: 'Le montant doit être supérieur à 0'
      });
    }

    // Vérifier que le devis existe et est en attente de paiement
    const devisRef = db.collection('devis').doc(devisId);
    const devisDoc = await devisRef.get();
    
    if (!devisDoc.exists) {
      return res.status(404).json({ error: 'Devis non trouvé' });
    }

    const devis = devisDoc.data();
    if (devis?.statut !== 'en_attente_paiement') {
      return res.status(400).json({
        error: 'Statut devis invalide',
        details: `Le devis doit être en statut 'en_attente_paiement' (actuellement: ${devis?.statut})`
      });
    }

    // Créer PaymentIntent avec capture_method: manual
    // L'argent sera BLOQUÉ mais PAS CAPTURÉ tant qu'on n'appelle pas capture()
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(montantTTC * 100), // Stripe utilise centimes
      currency: 'eur',
      capture_method: 'manual', // ← CLEF: Escrow activé
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        devisId,
        clientId,
        artisanId,
        numeroDevis: metadata?.numeroDevis || '',
        description: metadata?.description || '',
      },
      description: `ArtisanDispo - ${metadata?.numeroDevis || devisId} - ${metadata?.description || 'Devis'}`,
    });

    console.log(`✅ PaymentIntent créé (escrow): ${paymentIntent.id} - ${montantTTC}€`);

    res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      montant: montantTTC,
      statut: 'bloque', // Argent bloqué en escrow
      message: 'Paiement escrow créé avec succès. Argent bloqué en attente de validation travaux.'
    });

  } catch (error: any) {
    console.error('❌ Erreur création escrow:', error);
    res.status(500).json({
      error: 'Erreur lors de la création du paiement escrow',
      details: error.message
    });
  }
});

/**
 * POST /api/v1/payments/release-escrow
 * 
 * Libère l'argent bloqué en escrow et le transfère à l'artisan
 * Appelé après validation des travaux par le client OU auto-validation (48h)
 * 
 * Body:
 *   - contratId: ID du contrat
 *   - validePar: 'client' | 'auto' | 'admin'
 *   - commentaire: Commentaire validation (optionnel)
 * 
 * Returns:
 *   - chargeId: ID du Charge Stripe (paiement capturé)
 *   - montantArtisan: Montant net versé à l'artisan (après commission)
 *   - commission: Commission plateforme prélevée
 */
router.post('/release-escrow', async (req: Request, res: Response) => {
  try {
    const { contratId, validePar, commentaire } = req.body;

    // Validation
    if (!contratId || !validePar) {
      return res.status(400).json({
        error: 'Paramètres manquants',
        details: 'contratId et validePar sont requis'
      });
    }

    if (!['client', 'auto', 'admin'].includes(validePar)) {
      return res.status(400).json({
        error: 'validePar invalide',
        details: 'validePar doit être client, auto ou admin'
      });
    }

    // Récupérer le contrat
    const contratRef = db.collection('contrats').doc(contratId);
    const contratDoc = await contratRef.get();

    if (!contratDoc.exists) {
      return res.status(404).json({ error: 'Contrat non trouvé' });
    }

    const contrat = contratDoc.data();

    // Vérifier statut
    if (!['travaux_termines', 'en_cours'].includes(contrat?.statut || '')) {
      return res.status(400).json({
        error: 'Statut contrat invalide',
        details: `Le contrat doit être en statut 'travaux_termines' ou 'en_cours' (actuellement: ${contrat?.statut})`
      });
    }

    // Vérifier que paiement est bloqué
    if (contrat?.paiement?.statut !== 'bloque') {
      return res.status(400).json({
        error: 'Paiement non bloqué',
        details: `Le paiement doit être bloqué (actuellement: ${contrat?.paiement?.statut})`
      });
    }

    const paymentIntentId = contrat?.paiement?.stripe?.paymentIntentId;
    if (!paymentIntentId) {
      return res.status(400).json({
        error: 'PaymentIntent manquant',
        details: 'Aucun PaymentIntent trouvé dans le contrat'
      });
    }

    // Capturer le paiement (libérer l'argent)
    console.log(`💰 Capture PaymentIntent: ${paymentIntentId}`);
    const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);

    const montantTotal = contrat?.paiement?.montantTotal || 0;
    const commission = Math.round(montantTotal * COMMISSION_RATE * 100) / 100;
    const montantArtisan = Math.round((montantTotal - commission) * 100) / 100;

    // ✅ PHASE 2 : Transférer montantArtisan via Stripe Connect
    // Récupérer Stripe Account ID de l'artisan
    const artisanDoc = await db.collection('artisans').doc(contrat.artisanId).get();
    const artisanStripeAccountId = artisanDoc.data()?.stripeAccountId;

    if (!artisanStripeAccountId) {
      return res.status(400).json({
        error: 'Artisan n\'a pas configuré son compte de paiement',
        details: 'L\'artisan doit compléter l\'onboarding Stripe Connect avant de recevoir des paiements'
      });
    }

    // Transférer montantArtisan via Stripe Connect
    const transfer = await stripe.transfers.create({
      amount: Math.round(montantArtisan * 100),
      currency: 'eur',
      destination: artisanStripeAccountId,
      metadata: {
        contratId,
        devisId: contrat.devisId,
        artisanId: contrat.artisanId
      },
      description: `Paiement travaux - Contrat ${contratId}`,
    });

    console.log(`✅ Transfert effectué: ${transfer.id} - ${montantArtisan}€ → ${artisanStripeAccountId}`);

    // Mettre à jour le contrat dans Firestore
    await contratRef.update({
      statut: validePar === 'auto' ? 'termine_auto_valide' : 'termine_valide',
      dateValidation: Timestamp.now(),
      dateLiberationPaiement: Timestamp.now(),
      'paiement.statut': 'libere',
      'paiement.dateLiberation': Timestamp.now(),
      'paiement.stripe.chargeId': paymentIntent.charges.data[0]?.id || null,
      'paiement.stripe.transferId': transfer.id,
      'paiement.dateVirement': Timestamp.now(),
      validationTravaux: {
        date: Timestamp.now(),
        validePar,
        commentaire: commentaire || '',
        delaiValidation: 0, // TODO: calculer depuis dateFinTravaux
      },
      // Ajouter au historique
      historiqueStatuts: [
        ...(contrat?.historiqueStatuts || []),
        {
          statut: validePar === 'auto' ? 'termine_auto_valide' : 'termine_valide',
          date: Timestamp.now(),
          auteur: validePar === 'client' ? contrat?.clientId : 'system'
        }
      ]
    });

    // Mettre à jour le devis
    const devisId = contrat?.devisId;
    if (devisId) {
      await db.collection('devis').doc(devisId).update({
        'paiement.statut': 'libere',
        'paiement.stripe.chargeId': paymentIntent.charges.data[0]?.id || null,
        'paiement.stripe.captureDate': Timestamp.now(),
      });
    }

    console.log(`✅ Escrow libéré: ${montantTotal}€ - Commission: ${commission}€ - Artisan: ${montantArtisan}€`);

    // TODO Phase 2: Transférer montantArtisan via Stripe Connect
    // const transfer = await stripe.transfers.create({
    //   amount: Math.round(montantArtisan * 100),
    //   currency: 'eur',
    //   destination: artisanStripeAccountId,
    //   metadata: { contratId, devisId }
    // });

    res.status(200).json({
      success: true,
      chargeId: paymentIntent.charges.data[0]?.id,
      montantTotal,
      commission,
      montantArtisan,
      statut: 'libere',
      message: `Paiement libéré avec succès. L'artisan recevra ${montantArtisan}€ (commission plateforme: ${commission}€)`
    });

  } catch (error: any) {
    console.error('❌ Erreur libération escrow:', error);
    res.status(500).json({
      error: 'Erreur lors de la libération du paiement',
      details: error.message
    });
  }
});

/**
 * POST /api/v1/payments/refund-escrow
 * 
 * Annule le paiement bloqué et rembourse le client
 * Utilisé en cas de litige résolu en faveur du client ou annulation
 * 
 * Body:
 *   - contratId: ID du contrat
 *   - motif: Raison du remboursement
 *   - montantRembourse: Montant à rembourser (optionnel, par défaut = total)
 * 
 * Returns:
 *   - refundId: ID du Refund Stripe
 *   - montantRembourse: Montant remboursé au client
 */
router.post('/refund-escrow', async (req: Request, res: Response) => {
  try {
    const { contratId, motif, montantRembourse } = req.body;

    // Validation
    if (!contratId || !motif) {
      return res.status(400).json({
        error: 'Paramètres manquants',
        details: 'contratId et motif sont requis'
      });
    }

    // Récupérer le contrat
    const contratRef = db.collection('contrats').doc(contratId);
    const contratDoc = await contratRef.get();

    if (!contratDoc.exists) {
      return res.status(404).json({ error: 'Contrat non trouvé' });
    }

    const contrat = contratDoc.data();
    const paymentIntentId = contrat?.paiement?.stripe?.paymentIntentId;

    if (!paymentIntentId) {
      return res.status(400).json({
        error: 'PaymentIntent manquant',
        details: 'Aucun PaymentIntent trouvé dans le contrat'
      });
    }

    // Vérifier statut paiement
    if (!['bloque', 'libere'].includes(contrat?.paiement?.statut || '')) {
      return res.status(400).json({
        error: 'Paiement non remboursable',
        details: `Le paiement doit être bloqué ou libéré (actuellement: ${contrat?.paiement?.statut})`
      });
    }

    const montantTotal = contrat?.paiement?.montantTotal || 0;
    const montantARemb = montantRembourse || montantTotal;

    // Annuler le PaymentIntent (si bloqué) OU créer un Refund (si capturé)
    let refund;
    if (contrat?.paiement?.statut === 'bloque') {
      // Annuler PaymentIntent (pas encore capturé)
      console.log(`🔙 Annulation PaymentIntent: ${paymentIntentId}`);
      await stripe.paymentIntents.cancel(paymentIntentId);
      refund = { id: 'cancelled', amount: Math.round(montantARemb * 100) };
    } else {
      // Créer Refund (déjà capturé)
      console.log(`🔙 Remboursement PaymentIntent: ${paymentIntentId}`);
      refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: Math.round(montantARemb * 100),
        reason: 'requested_by_customer',
        metadata: {
          contratId,
          motif
        }
      });
    }

    // Mettre à jour le contrat
    await contratRef.update({
      statut: 'annule_rembourse',
      'paiement.statut': 'rembourse',
      'paiement.dateRemboursement': Timestamp.now(),
      'paiement.stripe.refundId': refund.id,
      // Ajouter au historique
      historiqueStatuts: [
        ...(contrat?.historiqueStatuts || []),
        {
          statut: 'annule_rembourse',
          date: Timestamp.now(),
          auteur: 'admin' // TODO: récupérer UID admin si applicable
        }
      ]
    });

    // Mettre à jour le devis
    const devisId = contrat?.devisId;
    if (devisId) {
      await db.collection('devis').doc(devisId).update({
        statut: 'annule',
        'paiement.statut': 'rembourse',
      });
    }

    console.log(`✅ Remboursement effectué: ${montantARemb}€`);

    res.status(200).json({
      success: true,
      refundId: refund.id,
      montantRembourse: montantARemb,
      statut: 'rembourse',
      message: `Remboursement effectué avec succès. ${montantARemb}€ remboursés au client.`
    });

  } catch (error: any) {
    console.error('❌ Erreur remboursement:', error);
    res.status(500).json({
      error: 'Erreur lors du remboursement',
      details: error.message
    });
  }
});

/**
 * POST /api/v1/payments/create-connect-account
 * 
 * Crée un compte Stripe Connect pour un artisan
 * Génère un lien d'onboarding Stripe Express
 * 
 * Body:
 *   - artisanId: UID de l'artisan
 *   - email: Email de l'artisan
 *   - returnUrl: URL de retour après onboarding
 *   - refreshUrl: URL si onboarding expire
 * 
 * Returns:
 *   - accountId: ID du compte Stripe Connect créé
 *   - onboardingUrl: URL vers interface onboarding Stripe
 */
router.post('/create-connect-account', async (req: Request, res: Response) => {
  try {
    const { artisanId, email, returnUrl, refreshUrl } = req.body;

    // Validation
    if (!artisanId || !email || !returnUrl || !refreshUrl) {
      return res.status(400).json({
        error: 'Paramètres manquants',
        details: 'artisanId, email, returnUrl et refreshUrl sont requis'
      });
    }

    // Vérifier si artisan existe
    const artisanDoc = await db.collection('artisans').doc(artisanId).get();
    if (!artisanDoc.exists) {
      return res.status(404).json({ error: 'Artisan non trouvé' });
    }

    // Vérifier si compte Stripe Connect existe déjà
    const existingAccountId = artisanDoc.data()?.stripeAccountId;
    if (existingAccountId) {
      // Compte existant, créer nouveau lien onboarding
      console.log(`♻️ Compte Stripe Connect existant: ${existingAccountId}`);
      
      const accountLink = await stripe.accountLinks.create({
        account: existingAccountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
      });

      return res.status(200).json({
        success: true,
        accountId: existingAccountId,
        onboardingUrl: accountLink.url,
        existing: true,
        message: 'Compte existant, nouveau lien d\'onboarding généré'
      });
    }

    // Créer nouveau compte Stripe Connect (Express)
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'FR',
      email: email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: 'individual', // ou 'company' si artisan société
      metadata: {
        artisanId: artisanId,
        platform: 'ArtisanDispo',
      },
    });

    // Créer lien onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    console.log(`✅ Compte Stripe Connect créé: ${account.id} pour artisan ${artisanId}`);

    res.status(200).json({
      success: true,
      accountId: account.id,
      onboardingUrl: accountLink.url,
      existing: false,
      message: 'Compte Stripe Connect créé avec succès'
    });

  } catch (error: any) {
    console.error('❌ Erreur création Stripe Connect:', error);
    res.status(500).json({
      error: 'Erreur création compte Stripe Connect',
      details: error.message
    });
  }
});

export default router;
