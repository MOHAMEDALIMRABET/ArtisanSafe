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

export default router;
