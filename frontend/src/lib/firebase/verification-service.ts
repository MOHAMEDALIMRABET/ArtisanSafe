/**
 * Service de vérification des profils artisans
 * ArtisanDispo - Système de vérification
 */

import { doc, updateDoc, Timestamp, getDoc, arrayUnion, collection } from 'firebase/firestore';
import { db } from './config';
import type { Artisan, VerificationStatus } from '@/types/firestore';
import { artisanDoitDecennale } from '../decennale-helper';

// ============================================
// 1. VÉRIFICATION SIRET (API INSEE/SIRENE)
// ============================================

interface SiretValidationResult {
  valid: boolean;
  companyName?: string;
  legalForm?: string;
  active?: boolean;
  error?: string;
  adresse?: string;
}

/**
 * Vérifie la validité d'un SIRET (format uniquement)
 * ✅ VALIDATION MANUELLE PAR ADMIN
 * - Vérification format 14 chiffres uniquement
 * - Raison sociale acceptée telle quelle (admin vérifie via KBIS)
 * - Pas d'appel API SIRENE (validation manuelle par admin)
 */
export async function verifySiret(
  siret: string, 
  raisonSociale: string
): Promise<SiretValidationResult> {
  try {
    // Nettoyer le SIRET (enlever espaces)
    const cleanSiret = siret.replace(/\s/g, '');
    
    // Vérification du format (14 chiffres)
    if (!/^\d{14}$/.test(cleanSiret)) {
      return { valid: false, error: 'Vérifiez que votre SIRET est correct et que votre entreprise est active.' };
    }
    
    // Vérification de la raison sociale
    if (!raisonSociale || raisonSociale.trim().length < 2) {
      return { valid: false, error: 'Raison sociale manquante ou invalide' };
    }
    
    // ✅ Format valide - Accepter pour vérification manuelle admin
    console.log('✅ [Frontend] SIRET format valide:', cleanSiret);
    console.log('📝 [Frontend] Raison sociale:', raisonSociale.trim());
    console.log('ℹ️ [Frontend] Vérification manuelle par admin lors validation documents KBIS');
    
    return {
      valid: true,
      companyName: raisonSociale.trim(),
      legalForm: 'À vérifier par admin',
      adresse: '',
      active: true
    };

    /* ========================================
     * 🔒 APPEL API BACKEND DÉSACTIVÉ
     * ========================================
     * Code commenté - Réactiver si besoin futur
     * 
    // Appel au backend pour vérification complète (SIRET + Raison sociale)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
    console.log('🔍 [Frontend] Appel API vérification SIRET:', {
      url: `${apiUrl}/sirene/verify`,
      siret: cleanSiret,
      raisonSociale: raisonSociale.trim()
    });
    
    const response = await fetch(
      `${apiUrl}/sirene/verify`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          siret: cleanSiret,
          raisonSociale: raisonSociale.trim()
        })
      }
    );
    
    const data = await response.json();
    console.log('📦 [Frontend] Réponse API reçue:', {
      status: response.status,
      ok: response.ok,
      data: data
    });
    
    if (!response.ok || !data.success) {
      console.error('❌ [Frontend] Échec vérification:', data.error);
      return { 
        valid: false, 
        error: data.error || 'Erreur lors de la vérification SIRET' 
      };
    }
    
    // Succès : SIRET valide + entreprise active + raison sociale conforme
    console.log('✅ [Frontend] Vérification réussie:', {
      companyName: data.data?.raisonSociale,
      adresse: data.data?.adresse,
      activite: data.data?.activite
    });
    
    return {
      valid: true,
      companyName: data.data?.raisonSociale || raisonSociale,
      legalForm: data.data?.activite || '',
      adresse: data.data?.adresse || '',
      active: true
    };
    */
    
  } catch (error) {
    console.error('Erreur vérification SIRET:', error);
    return { 
      valid: false, 
      error: 'Erreur technique lors de la vérification. Vérifiez votre connexion.' 
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
  documentType: 'kbis' | 'idCard' | 'rcPro' | 'decennale'
): Promise<string> {
  try {
    const timestamp = Date.now();
    // Nettoyer le nom de fichier : supprimer espaces et caractères spéciaux
    const cleanFileName = file.name
      .replace(/\s+/g, '_')  // Remplacer espaces par underscore
      .replace(/[^a-zA-Z0-9._-]/g, '')  // Supprimer caractères spéciaux
      .toLowerCase();
    const fileName = `${documentType}_${timestamp}_${cleanFileName}`;
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
 * Upload une attestation RC Pro (Responsabilité Civile Professionnelle)
 */
export async function uploadRcPro(
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
    const url = await uploadToStorage(userId, file, 'rcPro');
    
    // Récupérer l'état actuel pour l'historique
    const artisanRef = doc(db, 'artisans', userId);
    const artisanSnap = await getDoc(artisanRef);
    const currentDoc = artisanSnap.data()?.verificationDocuments?.rcPro;
    
    // Sauvegarder dans Firestore (admin devra vérifier)
    await updateDoc(artisanRef, {
      'verificationDocuments.rcPro': {
        url,
        uploadDate: Timestamp.now(),
        verified: false, // Nécessite validation admin
        rejected: false, // Réinitialiser le statut de rejet
        rejectionReason: null,
        rejectedAt: null,
        rejectedBy: null
      },
      // Ajouter dans l'historique pour traçabilité
      'verificationDocuments.rcPro.uploadHistory': arrayUnion({
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
    console.error('Erreur upload RC Pro:', error);
    return {
      success: false,
      error: 'Erreur lors de l\'upload'
    };
  }
}

/**
 * Upload une attestation d'assurance décennale
 */
export async function uploadDecennale(
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
    const url = await uploadToStorage(userId, file, 'decennale');
    
    // Récupérer l'état actuel pour l'historique
    const artisanRef = doc(db, 'artisans', userId);
    const artisanSnap = await getDoc(artisanRef);
    const currentDoc = artisanSnap.data()?.verificationDocuments?.decennale;
    
    // Sauvegarder dans Firestore (admin devra vérifier)
    await updateDoc(artisanRef, {
      'verificationDocuments.decennale': {
        url,
        uploadDate: Timestamp.now(),
        verified: false, // Nécessite validation admin
        rejected: false, // Réinitialiser le statut de rejet
        rejectionReason: null,
        rejectedAt: null,
        rejectedBy: null
      },
      // Ajouter dans l'historique pour traçabilité
      'verificationDocuments.decennale.uploadHistory': arrayUnion({
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
    console.error('Erreur upload attestation décennale:', error);
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
  documentType: 'kbis' | 'idCard' | 'rcPro' | 'decennale',
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
  
  // Vérifier les critères requis pour la vérification complète
  const siretOk = artisan.siretVerified === true;
  const phoneOk = artisan.contactVerification?.telephone?.verified === true;
  const kbisOk = artisan.verificationDocuments?.kbis?.verified === true;
  const idCardOk = artisan.verificationDocuments?.idCard?.verified === true;
  const rcProOk = artisan.verificationDocuments?.rcPro?.verified === true;
  
  // Décennale obligatoire uniquement si le métier le nécessite
  const decennaleRequired = artisan.metiers && artisan.metiers.length > 0 && artisanDoitDecennale(artisan.metiers);
  const decennaleOk = !decennaleRequired || artisan.verificationDocuments?.decennale?.verified === true;

  // Tous les critères remplis = approved (profil vérifié)
  if (siretOk && phoneOk && kbisOk && idCardOk && rcProOk && decennaleOk) {
    return 'approved';
  }

  // Au moins un document uploadé = pending (en attente validation admin)
  if (
    artisan.verificationDocuments?.kbis ||
    artisan.verificationDocuments?.idCard ||
    artisan.verificationDocuments?.rcPro ||
    artisan.verificationDocuments?.decennale
  ) {
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
  
  // Si approuvé, marquer comme vérifié et actif
  if (status === 'approved') {
    updateData.verified = true;
    updateData.verificationDate = Timestamp.now();
    updateData.statut = 'actif';
  }
  
  await updateDoc(artisanRef, updateData);
}

/**
 * Valide un document (KBIS ou Pièce d'identité)
 * @param userId - ID de l'utilisateur artisan
 * @param documentType - Type de document ('kbis', 'idCard', 'rcPro' ou 'decennale')
 * @param adminId - ID de l'admin qui valide
 */
export async function validateDocument(
  userId: string,
  documentType: 'kbis' | 'idCard' | 'rcPro' | 'decennale',
  adminId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const artisanRef = doc(db, 'artisans', userId);
    const fieldPath = `verificationDocuments.${documentType}`;
    
    // Mettre à jour le document spécifique
    await updateDoc(artisanRef, {
      [`${fieldPath}.verified`]: true,
      [`${fieldPath}.rejected`]: false,
      [`${fieldPath}.validatedBy`]: adminId,
      [`${fieldPath}.validatedAt`]: Timestamp.now(),
      [`${fieldPath}.rejectionReason`]: null
    });

    // ✅ VÉRIFIER SI TOUS LES DOCUMENTS SONT VALIDÉS
    const artisanSnap = await getDoc(artisanRef);
    if (artisanSnap.exists()) {
      const data = artisanSnap.data();
      const kbisVerified = data.verificationDocuments?.kbis?.verified || false;
      const idVerified = data.verificationDocuments?.idCard?.verified || false;
      const rcProVerified = data.verificationDocuments?.rcPro?.verified || false;
      
      // Vérifier si décennale requise
      const decennaleRequired = data.metiers && data.metiers.length > 0 && artisanDoitDecennale(data.metiers);
      const decennaleVerified = !decennaleRequired || data.verificationDocuments?.decennale?.verified || false;
      
      // Si tous les documents sont validés (y compris décennale si requise) → activer l'artisan
      if (kbisVerified && idVerified && rcProVerified && decennaleVerified) {
        await updateDoc(artisanRef, {
          verified: true,  // ← CHAMP PRINCIPAL pour les recherches
          verificationStatus: 'approved',
          verificationDate: Timestamp.now(),
          statut: 'actif',  // ← Artisan actif et visible
        });
        // ✅ METTRE À JOUR LE STATUT DANS LA COLLECTION USERS
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          statut: 'verifie'
        });
        console.log(`✅ Artisan ${userId} complètement vérifié et activé !`);
      } else {
        console.log(`⏳ Artisan ${userId} partiellement vérifié (${documentType} validé)`);
      }
    }

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
 * @param documentType - Type de document ('kbis', 'idCard', 'rcPro' ou 'decennale')
 * @param adminId - ID de l'admin qui rejette
 * @param reason - Raison du rejet
 */
export async function rejectDocument(
  userId: string,
  documentType: 'kbis' | 'idCard' | 'rcPro' | 'decennale',
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
      [`${fieldPath}.rejectionReason`]: reason,
      
      // ❌ Si un document est rejeté → désactiver l'artisan
      verified: false,
      verificationStatus: 'rejected',
    });

    console.log(`❌ Document ${documentType} rejeté pour l'artisan ${userId} - Artisan désactivé`);

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
