/**
 * Service de vérification des profils artisans
 * ArtisanDispo - Système de vérification
 */

import { doc, updateDoc, Timestamp, getDoc, arrayUnion } from 'firebase/firestore';
import { db } from './config';
import type { Artisan, VerificationStatus } from '@/types/firestore';

// ============================================
// 1. VÉRIFICATION SIRET (API INSEE/SIRENE)
// ============================================

interface SiretValidationResult {
  valid: boolean;
  companyName?: string;
  legalForm?: string;
  active?: boolean;
  error?: string;
}

/**
 * Vérifie la validité d'un SIRET via l'API Recherche Entreprises
 * API Gratuite du gouvernement français
 */
export async function verifySiret(siret: string): Promise<SiretValidationResult> {
  try {
    // Nettoyer le SIRET (enlever espaces)
    const cleanSiret = siret.replace(/\s/g, '');
    
    // Vérification du format (14 chiffres)
    if (!/^\d{14}$/.test(cleanSiret)) {
      return { valid: false, error: 'Format SIRET invalide (14 chiffres requis)' };
    }
    
    // Appel à l'API Recherche Entreprises (gratuite)
    const response = await fetch(
      `https://recherche-entreprises.api.gouv.fr/search?q=${cleanSiret}`,
      {
        headers: {
          'Accept': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      return { valid: false, error: 'Erreur lors de la vérification SIRET' };
    }
    
    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      return { valid: false, error: 'SIRET non trouvé dans la base SIRENE' };
    }
    
    const company = data.results[0];
    
    // Vérifier si l'entreprise est active
    const isActive = company.etat_administratif === 'A'; // A = Actif
    
    if (!isActive) {
      return { 
        valid: false, 
        error: 'Cette entreprise est fermée ou radiée' 
      };
    }
    
    return {
      valid: true,
      companyName: company.nom_complet || company.nom_raison_sociale,
      legalForm: company.nature_juridique,
      active: true
    };
    
  } catch (error) {
    console.error('Erreur vérification SIRET:', error);
    return { 
      valid: false, 
      error: 'Erreur technique lors de la vérification' 
    };
  }
}

/**
 * Met à jour le statut de vérification SIRET dans Firestore
 */
export async function updateSiretVerification(
  userId: string, 
  verified: boolean,
  companyData?: { companyName: string; legalForm: string }
): Promise<void> {
  const artisanRef = doc(db, 'artisans', userId);
  
  const updateData: any = {
    siretVerified: verified,
    siretVerificationDate: Timestamp.now()
  };
  
  // Si vérification réussie, mettre à jour les données entreprise
  if (verified && companyData) {
    updateData.raisonSociale = companyData.companyName;
  }
  
  await updateDoc(artisanRef, updateData);
}

// ============================================
// 2. VÉRIFICATION EMAIL
// ============================================

/**
 * Envoie un email de vérification (Firebase Auth le fait automatiquement)
 * Cette fonction met à jour le statut dans Firestore
 */
export async function markEmailAsVerified(userId: string): Promise<void> {
  const artisanRef = doc(db, 'artisans', userId);
  
  await updateDoc(artisanRef, {
    'contactVerification.email.verified': true,
    'contactVerification.email.verifiedDate': Timestamp.now()
  });
}

// ============================================
// 3. VÉRIFICATION TÉLÉPHONE (SMS)
// ============================================

/**
 * Génère un code de vérification à 6 chiffres
 */
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Envoie un SMS avec un code de vérification via le backend
 */
export async function sendPhoneVerificationCode(
  userId: string,
  phoneNumber: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const code = generateVerificationCode();
    const artisanRef = doc(db, 'artisans', userId);
    
    // Sauvegarder le code dans Firestore (expire dans 10 minutes)
    const expiryDate = new Date();
    expiryDate.setMinutes(expiryDate.getMinutes() + 10);
    
    await updateDoc(artisanRef, {
      'contactVerification.telephone.verificationCode': code,
      'contactVerification.telephone.codeExpiry': Timestamp.fromDate(expiryDate)
    });
    
    // Appel au backend pour envoyer le SMS via SMS Gateway API
    const backendURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
    const response = await fetch(`${backendURL}/sms/send-verification-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumber,
        code
      })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log('✅ SMS envoyé avec succès');
      return { success: true };
    } else {
      console.error('❌ Erreur envoi SMS:', data);
      return { 
        success: false, 
        error: data.error?.message || 'Erreur lors de l\'envoi du SMS' 
      };
    }
    
  } catch (error) {
    console.error('❌ Erreur envoi SMS:', error);
    return { success: false, error: 'Erreur lors de l\'envoi du SMS' };
  }
}

/**
 * Vérifie le code SMS saisi par l'utilisateur
 */
export async function verifyPhoneCode(
  userId: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const artisanRef = doc(db, 'artisans', userId);
    const artisanDoc = await getDoc(artisanRef);
    
    if (!artisanDoc.exists()) {
      return { success: false, error: 'Artisan non trouvé' };
    }
    
    const artisan = artisanDoc.data() as Artisan;
    const storedCode = artisan.contactVerification?.telephone?.verificationCode;
    const codeExpiry = artisan.contactVerification?.telephone?.codeExpiry;
    
    // Vérifier si le code existe
    if (!storedCode) {
      return { success: false, error: 'Aucun code de vérification en attente' };
    }
    
    // Vérifier l'expiration
    if (codeExpiry && codeExpiry.toDate() < new Date()) {
      return { success: false, error: 'Code expiré. Demandez un nouveau code.' };
    }
    
    // Vérifier le code
    if (storedCode !== code) {
      return { success: false, error: 'Code incorrect' };
    }
    
    // Code valide - marquer comme vérifié
    await updateDoc(artisanRef, {
      'contactVerification.telephone.verified': true,
      'contactVerification.telephone.verifiedDate': Timestamp.now(),
      'contactVerification.telephone.verificationCode': null,
      'contactVerification.telephone.codeExpiry': null
    });
    
    return { success: true };
    
  } catch (error) {
    console.error('Erreur vérification code:', error);
    return { success: false, error: 'Erreur lors de la vérification' };
  }
}

// ============================================
// 4. UPLOAD ET PARSING DOCUMENTS
// ============================================

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './config';
import { parseKbisDocument, compareSiret, compareRepresentantLegal, type KbisParseResult } from './document-parser';

/**
 * Upload un fichier vers Firebase Storage
 */
async function uploadToStorage(
  userId: string,
  file: File,
  documentType: 'kbis' | 'idCard'
): Promise<string> {
  try {
    const timestamp = Date.now();
    const fileName = `${documentType}_${timestamp}_${file.name}`;
    const storageRef = ref(storage, `artisans/${userId}/documents/${fileName}`);
    
    console.log('📤 Upload vers Firebase Storage...', fileName);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    console.log('✅ Upload réussi:', downloadURL);
    
    return downloadURL;
  } catch (error) {
    console.error('❌ Erreur upload Firebase Storage:', error);
    throw new Error(`Erreur Firebase Storage: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
  }
}

/**
 * Upload et parse le Kbis, puis compare le SIRET et le représentant légal
 */
export async function uploadAndVerifyKbis(
  userId: string,
  file: File,
  profileSiret: string,
  profileRepresentant?: string
): Promise<{
  success: boolean;
  url?: string;
  parseResult?: KbisParseResult;
  warnings?: string[];
  error?: string;
}> {
  try {
    const warnings: string[] = [];
    
    // 1. Parser le document pour extraire les données
    console.log('📄 Parsing du Kbis en cours...');
    const parseResult = await parseKbisDocument(file);
    
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error
      };
    }
    
    // 2. Comparer le SIRET extrait avec celui du profil
    console.log('🔍 Comparaison SIRET...');
    const siretComparison = compareSiret(parseResult.siret!, profileSiret);
    
    if (!siretComparison.match) {
      return {
        success: false,
        parseResult,
        error: siretComparison.error
      };
    }
    
    // 3. Comparer le représentant légal si disponible
    let representantMatched = false;
    let representantConfidence: 'high' | 'medium' | 'low' | undefined;
    
    if (profileRepresentant && parseResult.representantLegal) {
      console.log('👤 Comparaison du représentant légal...');
      const representantComparison = compareRepresentantLegal(
        parseResult.representantLegal,
        profileRepresentant
      );
      
      representantMatched = representantComparison.match;
      representantConfidence = representantComparison.confidence;
      
      if (!representantComparison.match) {
        warnings.push(representantComparison.error || 'Le représentant légal ne correspond pas');
        console.warn('⚠️ Représentant légal ne correspond pas - vérification manuelle requise');
      } else if (representantComparison.confidence === 'low') {
        warnings.push(representantComparison.error || 'Vérification manuelle du représentant légal recommandée');
      }
    } else if (profileRepresentant && !parseResult.representantLegal) {
      warnings.push('Impossible d\'extraire le représentant légal du KBIS - vérification manuelle requise');
    }
    
    // 4. Upload le fichier vers Firebase Storage
    console.log('☁️ Upload vers Firebase Storage...');
    const url = await uploadToStorage(userId, file, 'kbis');
    
    // 5. Déterminer si le document est auto-vérifié
    const autoVerified = siretComparison.match && (!profileRepresentant || representantMatched);
    
    // 6. Sauvegarder dans Firestore
    const artisanRef = doc(db, 'artisans', userId);
    await updateDoc(artisanRef, {
      'verificationDocuments.kbis': {
        url,
        uploadDate: Timestamp.now(),
        verified: autoVerified,
        siretMatched: siretComparison.match,
        representantMatched,
        representantConfidence,
        requiresManualReview: warnings.length > 0,
        extractedData: {
          siret: parseResult.siret,
          siren: parseResult.siren,
          companyName: parseResult.companyName,
          legalForm: parseResult.legalForm,
          representantLegal: parseResult.representantLegal,
          emissionDate: parseResult.emissionDate,
          qrCodeData: parseResult.qrCodeData,
          qrCodeValid: parseResult.qrCodeValid,
          hasInpiLogo: parseResult.hasInpiLogo,
          hasOfficialHeader: parseResult.hasOfficialHeader,
          hasSeal: parseResult.hasSeal,
          hasSignature: parseResult.hasSignature,
          sealQuality: parseResult.sealQuality,
          signatureQuality: parseResult.signatureQuality,
          documentQuality: parseResult.documentQuality,
          qualityScore: parseResult.qualityScore
        }
      }
    });
    
    if (autoVerified) {
      console.log('✅ KBIS vérifié automatiquement avec succès');
    } else {
      console.log('⚠️ KBIS uploadé mais nécessite une vérification manuelle');
    }
    
    return {
      success: true,
      url,
      parseResult,
      warnings: warnings.length > 0 ? warnings : undefined
    };
    
  } catch (error) {
    console.error('Erreur upload Kbis:', error);
    return {
      success: false,
      error: 'Erreur technique lors du traitement du document'
    };
  }
}

/**
 * Upload une pièce d'identité (pas de parsing, juste upload)
 */
export async function uploadIdCard(
  userId: string,
  file: File
): Promise<{
  success: boolean;
  url?: string;
  error?: string;
}> {
  try {
    // Vérifier le type de fichier
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      return {
        success: false,
        error: 'Format non supporté. Utilisez JPG, PNG ou PDF.'
      };
    }
    
    // Vérifier la taille (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return {
        success: false,
        error: 'Fichier trop volumineux (max 5MB)'
      };
    }
    
    // Upload vers Firebase Storage
    const url = await uploadToStorage(userId, file, 'idCard');
    
    // Récupérer l'état actuel pour l'historique
    const artisanRef = doc(db, 'artisans', userId);
    const artisanSnap = await getDoc(artisanRef);
    const currentDoc = artisanSnap.data()?.verificationDocuments?.idCard;
    
    // Sauvegarder dans Firestore (admin devra vérifier)
    await updateDoc(artisanRef, {
      'verificationDocuments.idCard': {
        url,
        uploadDate: Timestamp.now(),
        verified: false, // Nécessite validation admin
        rejected: false, // Réinitialiser le statut de rejet
        rejectionReason: null,
        rejectedAt: null,
        rejectedBy: null
      },
      // Ajouter dans l'historique pour traçabilité
      'verificationDocuments.idCard.uploadHistory': arrayUnion({
        uploadedAt: Timestamp.now(),
        fileSize: file.size,
        fileName: file.name,
        previouslyRejected: currentDoc?.rejected || false,
        rejectionReason: currentDoc?.rejectionReason || null
      })
    });
    
    return {
      success: true,
      url
    };
    
  } catch (error) {
    console.error('Erreur upload pièce d\'identité:', error);
    return {
      success: false,
      error: 'Erreur lors de l\'upload'
    };
  }
}

/**
 * Upload un Kbis (sans parsing complexe, juste stockage)
 */
export async function uploadKbisDocument(
  userId: string,
  file: File
): Promise<{
  success: boolean;
  url?: string;
  error?: string;
}> {
  try {
    // Vérifier le type de fichier
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      return {
        success: false,
        error: 'Format non supporté. Utilisez JPG, PNG ou PDF.'
      };
    }
    
    // Vérifier la taille (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return {
        success: false,
        error: 'Fichier trop volumineux (max 5MB)'
      };
    }
    
    // Upload vers Firebase Storage
    const url = await uploadToStorage(userId, file, 'kbis');
    
    // Récupérer l'état actuel pour l'historique
    const artisanRef = doc(db, 'artisans', userId);
    const artisanSnap = await getDoc(artisanRef);
    const currentDoc = artisanSnap.data()?.verificationDocuments?.kbis;
    
    // Sauvegarder dans Firestore (admin devra vérifier)
    await updateDoc(artisanRef, {
      'verificationDocuments.kbis.url': url,
      'verificationDocuments.kbis.uploadDate': Timestamp.now(),
      'verificationDocuments.kbis.verified': false, // Nécessite validation admin
      'verificationDocuments.kbis.rejected': false, // Réinitialiser le statut de rejet
      'verificationDocuments.kbis.rejectionReason': null,
      'verificationDocuments.kbis.rejectedAt': null,
      'verificationDocuments.kbis.rejectedBy': null,
      // Ajouter dans l'historique pour traçabilité
      'verificationDocuments.kbis.uploadHistory': arrayUnion({
        uploadedAt: Timestamp.now(),
        fileSize: file.size,
        fileName: file.name,
        previouslyRejected: currentDoc?.rejected || false,
        rejectionReason: currentDoc?.rejectionReason || null
      })
    });
    
    return {
      success: true,
      url
    };
    
  } catch (error) {
    console.error('Erreur upload Kbis:', error);
    return {
      success: false,
      error: 'Erreur lors de l\'upload'
    };
  }
}

/**
 * Met à jour l'URL d'un document vérifié
 * Note: L'upload vers Firebase Storage se fait côté client
 */
export async function saveDocumentUrl(
  userId: string,
  documentType: 'kbis' | 'idCard',
  url: string
): Promise<void> {
  const artisanRef = doc(db, 'artisans', userId);
  
  await updateDoc(artisanRef, {
    [`verificationDocuments.${documentType}`]: {
      url,
      uploadDate: Timestamp.now(),
      verified: false // Admin devra valider
    }
  });
}

// ============================================
// 5. VÉRIFICATION GLOBALE
// ============================================

/**
 * Calcule le statut global de vérification
 */
export async function calculateVerificationStatus(userId: string): Promise<VerificationStatus> {
  const artisanRef = doc(db, 'artisans', userId);
  const artisanDoc = await getDoc(artisanRef);
  
  if (!artisanDoc.exists()) {
    return 'incomplete';
  }
  
  const artisan = artisanDoc.data() as Artisan;
  
  // Vérifier les 4 critères requis pour la vérification complète
  const siretOk = artisan.siretVerified === true;
  const phoneOk = artisan.contactVerification?.telephone?.verified === true;
  const kbisOk = artisan.verificationDocuments?.kbis?.verified === true;
  const idCardOk = artisan.verificationDocuments?.idCard?.verified === true;
  
  // Tous les 4 critères remplis = approved (profil vérifié)
  if (siretOk && phoneOk && kbisOk && idCardOk) {
    return 'approved';
  }
  
  // Au moins un document uploadé = pending (en attente validation admin)
  if (artisan.verificationDocuments?.kbis || artisan.verificationDocuments?.idCard) {
    return 'pending';
  }
  
  // Rien de fait = incomplete
  return 'incomplete';
}

/**
 * Met à jour le statut de vérification global
 */
export async function updateVerificationStatus(
  userId: string,
  status: VerificationStatus
): Promise<void> {
  const artisanRef = doc(db, 'artisans', userId);
  
  const updateData: any = {
    verificationStatus: status
  };
  
  // Si approuvé, marquer comme vérifié
  if (status === 'approved') {
    updateData.verified = true;
    updateData.verificationDate = Timestamp.now();
  }
  
  await updateDoc(artisanRef, updateData);
}

/**
 * Valide un document (KBIS ou Pièce d'identité)
 * @param userId - ID de l'utilisateur artisan
 * @param documentType - Type de document ('kbis' ou 'idCard')
 * @param adminId - ID de l'admin qui valide
 */
export async function validateDocument(
  userId: string,
  documentType: 'kbis' | 'idCard',
  adminId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const artisanRef = doc(db, 'artisans', userId);
    const fieldPath = `verificationDocuments.${documentType}`;
    
    await updateDoc(artisanRef, {
      [`${fieldPath}.verified`]: true,
      [`${fieldPath}.rejected`]: false,
      [`${fieldPath}.validatedBy`]: adminId,
      [`${fieldPath}.validatedAt`]: Timestamp.now(),
      [`${fieldPath}.rejectionReason`]: null
    });

    // TODO: Envoyer notification à l'artisan
    
    return { success: true };
  } catch (error) {
    console.error('Erreur validation document:', error);
    return {
      success: false,
      error: 'Erreur lors de la validation du document'
    };
  }
}

/**
 * Rejette un document avec une raison
 * @param userId - ID de l'utilisateur artisan
 * @param documentType - Type de document ('kbis' ou 'idCard')
 * @param adminId - ID de l'admin qui rejette
 * @param reason - Raison du rejet
 */
export async function rejectDocument(
  userId: string,
  documentType: 'kbis' | 'idCard',
  adminId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const artisanRef = doc(db, 'artisans', userId);
    const fieldPath = `verificationDocuments.${documentType}`;
    
    await updateDoc(artisanRef, {
      [`${fieldPath}.verified`]: false,
      [`${fieldPath}.rejected`]: true,
      [`${fieldPath}.rejectedBy`]: adminId,
      [`${fieldPath}.rejectedAt`]: Timestamp.now(),
      [`${fieldPath}.rejectionReason`]: reason
    });

    // TODO: Envoyer notification à l'artisan
    
    return { success: true };
  } catch (error) {
    console.error('Erreur rejet document:', error);
    return {
      success: false,
      error: 'Erreur lors du rejet du document'
    };
  }
}
