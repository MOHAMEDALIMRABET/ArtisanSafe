/**
 * Service Stripe Connect - Gestion comptes artisans
 * 
 * Fonctionnalités :
 * - Création de comptes Stripe Connect (type Express)
 * - Ajout de comptes bancaires (IBAN)
 * - Upload de documents de vérification (KYC)
 * - Récupération du statut du compte
 * 
 * ⚠️ SÉCURITÉ CRITIQUE :
 * - IBAN/BIC ne sont JAMAIS stockés dans notre base de données
 * - Transmission directe à Stripe via API
 * - Stockage uniquement de stripeAccountId + métadonnées
 */

import Stripe from 'stripe';
import { getFirestore } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia',
});

const db = getFirestore();

/**
 * Interface pour les données d'onboarding
 */
export interface StripeOnboardingData {
  // ID artisan
  artisanId: string;
  email: string;
  
  // Informations personnelles
  firstName: string;
  lastName: string;
  dateOfBirth: string; // Format: YYYY-MM-DD
  
  // Adresse
  address: {
    line1: string;
    line2?: string;
    city: string;
    postalCode: string;
    country: string; // 'FR'
  };
  
  // IBAN (⚠️ ne sera PAS stocké dans notre BDD)
  iban: string;
  bic?: string;
  accountHolderName: string;
  
  // Informations entreprise (optionnel si auto-entrepreneur)
  businessProfile?: {
    name: string;
    siret: string;
  };
}

/**
 * Créer un compte Stripe Connect + ajouter IBAN
 * 
 * @param data - Données d'onboarding complètes
 * @returns stripeAccountId et statut
 */
export async function createStripeConnectAccount(
  data: StripeOnboardingData
): Promise<{
  stripeAccountId: string;
  accountStatus: string;
  ibanLast4?: string;
}> {
  try {
    // Étape 1 : Créer le compte Stripe Connect (type Express)
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'FR',
      email: data.email,
      
      // Capabilities (activer transferts)
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      
      // Informations personnelles (KYC)
      individual: {
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        dob: {
          day: parseInt(data.dateOfBirth.split('-')[2]),
          month: parseInt(data.dateOfBirth.split('-')[1]),
          year: parseInt(data.dateOfBirth.split('-')[0]),
        },
        address: {
          line1: data.address.line1,
          line2: data.address.line2 || undefined,
          city: data.address.city,
          postal_code: data.address.postalCode,
          country: data.address.country,
        },
      },
      
      // Informations entreprise (si fourni)
      business_type: data.businessProfile ? 'company' : 'individual',
      business_profile: data.businessProfile
        ? {
            name: data.businessProfile.name,
            url: 'https://artisandispo.fr',
          }
        : undefined,
      
      // Métadonnées (pour retrouver l'artisan)
      metadata: {
        artisanId: data.artisanId,
        siret: data.businessProfile?.siret || '',
        platform: 'ArtisanDispo',
      },
    });

    console.log('✅ Compte Stripe Connect créé:', account.id);

    // Étape 2 : Ajouter le compte bancaire (IBAN)
    const externalAccount = await stripe.accounts.createExternalAccount(account.id, {
      external_account: {
        object: 'bank_account',
        country: 'FR',
        currency: 'eur',
        account_holder_name: data.accountHolderName,
        account_holder_type: data.businessProfile ? 'company' : 'individual',
        account_number: data.iban, // ⚠️ IBAN transmis à Stripe uniquement
      } as Stripe.BankAccountCreateParams,
    });

    console.log('✅ IBAN ajouté au compte Stripe:', account.id);

    // Extraire les 4 derniers chiffres de l'IBAN pour affichage
    const ibanLast4 = data.iban.slice(-4);

    // Étape 3 : Mettre à jour Firestore (wallet)
    await db.collection('wallets').doc(data.artisanId).update({
      stripeAccountId: account.id,
      stripeOnboardingStatus: 'pending',
      ibanLast4: ibanLast4,
      stripeAccountCreatedAt: new Date(),
      updatedAt: new Date(),
    });

    // Étape 4 : Mettre à jour Firestore (artisan)
    await db.collection('artisans').doc(data.artisanId).update({
      stripeAccountId: account.id,
      stripeOnboardingStatus: 'pending',
      updatedAt: new Date(),
    });

    console.log('✅ Wallet et artisan mis à jour dans Firestore');

    return {
      stripeAccountId: account.id,
      accountStatus: 'pending',
      ibanLast4,
    };
  } catch (error: any) {
    console.error('❌ Erreur création compte Stripe:', error);
    
    // Gérer erreurs spécifiques Stripe
    if (error.type === 'StripeInvalidRequestError') {
      throw new Error(`IBAN invalide: ${error.message}`);
    }
    
    throw new Error(`Erreur Stripe: ${error.message}`);
  }
}

/**
 * Upload un document de vérification (pièce identité, justificatif domicile)
 * 
 * @param stripeAccountId - ID du compte Stripe
 * @param documentType - Type de document ('identity_document' | 'address_proof')
 * @param fileBuffer - Buffer du fichier
 * @param filename - Nom du fichier
 */
export async function uploadVerificationDocument(
  stripeAccountId: string,
  documentType: 'identity_document' | 'additional_verification',
  fileBuffer: Buffer,
  filename: string
): Promise<void> {
  try {
    // Upload du fichier vers Stripe
    const file = await stripe.files.create({
      purpose: 'identity_document',
      file: {
        data: fileBuffer,
        name: filename,
        type: 'application/octet-stream',
      },
    });

    console.log('✅ Document uploadé vers Stripe:', file.id);

    // Associer le document au compte
    if (documentType === 'identity_document') {
      await stripe.accounts.update(stripeAccountId, {
        individual: {
          verification: {
            document: {
              front: file.id,
            },
          },
        },
      });
    } else {
      await stripe.accounts.update(stripeAccountId, {
        individual: {
          verification: {
            additional_document: {
              front: file.id,
            },
          },
        },
      });
    }

    console.log('✅ Document associé au compte Stripe');
  } catch (error: any) {
    console.error('❌ Erreur upload document:', error);
    throw new Error(`Erreur upload document: ${error.message}`);
  }
}

/**
 * Récupérer le statut d'un compte Stripe Connect
 * 
 * @param stripeAccountId - ID du compte Stripe
 * @returns Statut détaillé du compte
 */
export async function getStripeAccountStatus(stripeAccountId: string): Promise<{
  status: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirementsCurrentlyDue: string[];
  disabledReason?: string;
}> {
  try {
    const account = await stripe.accounts.retrieve(stripeAccountId);

    return {
      status: account.payouts_enabled && account.charges_enabled ? 'active' : 'pending',
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      requirementsCurrentlyDue: account.requirements?.currently_due || [],
      disabledReason: account.requirements?.disabled_reason || undefined,
    };
  } catch (error: any) {
    console.error('❌ Erreur récupération statut:', error);
    throw new Error(`Erreur récupération statut: ${error.message}`);
  }
}

/**
 * Vérifier si un IBAN est valide (format de base)
 * 
 * @param iban - IBAN à vérifier
 * @returns true si format valide
 */
export function validateIBAN(iban: string): boolean {
  // Retirer les espaces
  const cleanIban = iban.replace(/\s/g, '');
  
  // IBAN français : FR76 + 23 caractères (total 27)
  const ibanRegex = /^FR\d{2}[A-Z0-9]{23}$/;
  
  return ibanRegex.test(cleanIban);
}

/**
 * Vérifier si un BIC est valide
 * 
 * @param bic - BIC à vérifier
 * @returns true si format valide
 */
export function validateBIC(bic: string): boolean {
  // BIC : 8 ou 11 caractères alphanumériques
  const bicRegex = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
  
  return bicRegex.test(bic.toUpperCase());
}

export default {
  createStripeConnectAccount,
  uploadVerificationDocument,
  getStripeAccountStatus,
  validateIBAN,
  validateBIC,
};
