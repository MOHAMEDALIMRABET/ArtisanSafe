/**
 * Routes API Stripe Connect
 * 
 * Endpoints :
 * - POST /api/stripe/onboard - Créer compte Stripe + ajouter IBAN
 * - POST /api/stripe/upload-document - Upload document vérification
 * - GET /api/stripe/account-status/:accountId - Statut du compte
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import {
  createStripeConnectAccount,
  uploadVerificationDocument,
  getStripeAccountStatus,
  validateIBAN,
  validateBIC,
  StripeOnboardingData,
} from '../services/stripe-connect.service';
import {
  verifyWebhookSignature,
  handleStripeWebhook,
} from '../services/stripe-webhook-handler.service';

const router = Router();

// Configuration multer pour upload fichiers
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max
  },
  fileFilter: (req, file, cb) => {
    // Accepter seulement images et PDF
    const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format de fichier non supporté. Utilisez JPG, PNG ou PDF.'));
    }
  },
});

/**
 * POST /api/stripe/onboard
 * Créer un compte Stripe Connect + ajouter IBAN
 * 
 * Body:
 * {
 *   artisanId: string,
 *   email: string,
 *   firstName: string,
 *   lastName: string,
 *   dateOfBirth: string, // YYYY-MM-DD
 *   address: { line1, city, postalCode, country },
 *   iban: string,
 *   bic?: string,
 *   accountHolderName: string,
 *   businessProfile?: { name, siret }
 * }
 */
router.post('/onboard', async (req: Request, res: Response) => {
  try {
    const data: StripeOnboardingData = req.body;

    // Validations
    if (!data.artisanId || !data.email || !data.firstName || !data.lastName) {
      return res.status(400).json({
        success: false,
        error: 'Champs obligatoires manquants',
      });
    }

    // ⚠️ VÉRIFICATION CRITIQUE : Empêcher création de compte en double
    const admin = await import('firebase-admin');
    const db = admin.default.firestore();
    
    const walletDoc = await db.collection('wallets').doc(data.artisanId).get();
    
    if (walletDoc.exists) {
      const walletData = walletDoc.data();
      const existingAccountId = walletData?.stripeAccountId;
      const existingStatus = walletData?.stripeOnboardingStatus;
      
      // Bloquer si compte déjà configuré (sauf si rejeté)
      if (existingAccountId && existingStatus !== 'rejected') {
        console.warn(`⚠️ Tentative de création de compte en double pour artisan ${data.artisanId}`);
        console.warn(`   Compte existant: ${existingAccountId} (statut: ${existingStatus})`);
        
        return res.status(409).json({
          success: false,
          error: 'Compte bancaire déjà configuré',
          details: `Votre compte Stripe est déjà configuré (statut: ${existingStatus}). Pour modifier vos informations bancaires, contactez le support.`,
          existingAccountId,
          existingStatus,
        });
      }
      
      // Si compte rejeté, permettre reconfiguration
      if (existingStatus === 'rejected') {
        console.log(`✅ Reconfiguration autorisée (ancien compte rejeté: ${existingAccountId})`);
      }
    }

    if (!data.iban || !data.accountHolderName) {
      return res.status(400).json({
        success: false,
        error: 'IBAN et nom du titulaire requis',
      });
    }

    // Valider format IBAN
    if (!validateIBAN(data.iban)) {
      return res.status(400).json({
        success: false,
        error: 'Format IBAN invalide. Attendu: FR76 XXXX XXXX XXXX XXXX XXXX XXX',
      });
    }

    // Valider BIC si fourni
    if (data.bic && !validateBIC(data.bic)) {
      return res.status(400).json({
        success: false,
        error: 'Format BIC invalide',
      });
    }

    // Créer le compte Stripe
    const result = await createStripeConnectAccount(data);

    res.status(201).json({
      success: true,
      message: 'Compte Stripe créé avec succès',
      data: {
        stripeAccountId: result.stripeAccountId,
        accountStatus: result.accountStatus,
        ibanLast4: result.ibanLast4,
      },
    });
  } catch (error: any) {
    console.error('❌ Erreur onboarding Stripe:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la création du compte Stripe',
    });
  }
});

/**
 * POST /api/stripe/upload-document
 * Upload un document de vérification
 * 
 * Form-data:
 * - stripeAccountId: string
 * - documentType: 'identity_document' | 'additional_verification'
 * - file: File
 */
router.post('/upload-document', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { stripeAccountId, documentType } = req.body;

    if (!stripeAccountId || !documentType) {
      return res.status(400).json({
        success: false,
        error: 'stripeAccountId et documentType requis',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Fichier manquant',
      });
    }

    // Valider documentType
    if (!['identity_document', 'additional_verification'].includes(documentType)) {
      return res.status(400).json({
        success: false,
        error: 'Type de document invalide',
      });
    }

    // Upload vers Stripe
    await uploadVerificationDocument(
      stripeAccountId,
      documentType,
      req.file.buffer,
      req.file.originalname
    );

    res.json({
      success: true,
      message: 'Document uploadé avec succès',
    });
  } catch (error: any) {
    console.error('❌ Erreur upload document:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de l\'upload du document',
    });
  }
});

/**
 * GET /api/stripe/account-status/:accountId
 * Récupérer le statut d'un compte Stripe
 * 
 * Params:
 * - accountId: Stripe account ID
 */
router.get('/account-status/:accountId', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;

    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: 'accountId requis',
      });
    }

    const status = await getStripeAccountStatus(accountId);

    res.json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    console.error('❌ Erreur récupération statut:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la récupération du statut',
    });
  }
});

/**
 * POST /api/stripe/webhook
 * Endpoint pour recevoir les webhooks Stripe
 * 
 * ⚠️ IMPORTANT : Ce endpoint doit recevoir le body RAW (pas de JSON parsing)
 * Configuration dans server.ts : app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }))
 * 
 * Headers:
 * - stripe-signature: Signature Stripe pour vérification
 * 
 * Events gérés:
 * - account.updated : Mise à jour statut compte
 * - account.application.deauthorized : Compte déconnecté
 * - capability.updated : Capacités de paiement mises à jour
 */
router.post('/webhook', async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'] as string;

  if (!signature) {
    console.error('❌ Webhook: Signature manquante');
    return res.status(400).json({
      success: false,
      error: 'Missing stripe-signature header',
    });
  }

  const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('❌ STRIPE_CONNECT_WEBHOOK_SECRET non configuré');
    return res.status(500).json({
      success: false,
      error: 'Webhook secret not configured',
    });
  }

  try {
    // Vérifier la signature et construire l'événement
    const event = verifyWebhookSignature(
      req.body, // Body RAW (Buffer)
      signature,
      webhookSecret
    );

    console.log(`✅ Webhook vérifié: ${event.type}`);

    // Traiter l'événement de manière asynchrone
    // On répond 200 immédiatement, puis on traite
    res.json({ received: true });

    // Traiter l'événement (ne bloque pas la réponse)
    handleStripeWebhook(event).catch((error) => {
      console.error('❌ Erreur traitement webhook (async):', error);
    });

  } catch (error: any) {
    console.error('❌ Erreur webhook:', error.message);
    return res.status(400).json({
      success: false,
      error: `Webhook Error: ${error.message}`,
    });
  }
});

export default router;
