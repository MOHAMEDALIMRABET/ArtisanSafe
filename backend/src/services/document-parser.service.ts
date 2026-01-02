/**
 * Service de parsing de documents (KBIS) côté backend
 * Version LÉGÈRE sans Tesseract.js ni OpenCV.js pour éviter problèmes de compilation
 * Utilise des patterns regex et métadonnées de fichier
 */

/**
 * Résultat du parsing du Kbis
 */
export interface KbisParseResult {
  success: boolean;
  siret?: string;
  siren?: string;
  companyName?: string;
  legalForm?: string;
  representantLegal?: string;
  registrationDate?: string;
  emissionDate?: string;
  qrCodeData?: string;
  qrCodeValid?: boolean;
  hasInpiLogo?: boolean;
  hasSeal?: boolean;
  hasSignature?: boolean;
  hasOfficialHeader?: boolean;
  sealQuality?: 'good' | 'medium' | 'poor';
  signatureQuality?: 'good' | 'medium' | 'poor';
  documentQuality?: 'authentic' | 'suspicious' | 'altered';
  qualityScore?: number;
  error?: string;
  warnings?: string[];
  metadata?: {
    fileSize: number;
    fileType: string;
    fileName: string;
  };
}

/**
 * Parse un document Kbis pour extraire les informations basiques
 * Version LÉGÈRE sans bibliothèques lourdes
 */
export async function parseKbisDocument(file: File): Promise<KbisParseResult> {
  try {
    const warnings: string[] = [];

    // Vérifier le type de fichier
    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      return {
        success: false,
        error: 'Format de fichier non supporté. Utilisez PDF, JPG ou PNG.',
      };
    }

    // Vérifier la taille (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return {
        success: false,
        error: 'Fichier trop volumineux. Maximum 10 MB.',
      };
    }

    // Vérifier la taille minimale (fichier trop petit = suspect)
    const minSize = 10 * 1024; // 10KB
    if (file.size < minSize) {
      warnings.push('Fichier très petit, pourrait être incomplet');
    }

    console.log(`📄 Parsing KBIS: ${file.name} (${file.size} bytes)`);

    // Analyse du nom de fichier pour extraire potentiellement le SIRET
    const siretFromFilename = extractSiretFromFilename(file.name);
    
    // Score de qualité basé sur les métadonnées
    let qualityScore = 50;

    // Bonus si le nom de fichier contient un SIRET valide
    if (siretFromFilename) {
      qualityScore += 15;
    }

    // Bonus si le fichier est un PDF (plus difficile à falsifier)
    if (file.type === 'application/pdf') {
      qualityScore += 10;
    }

    // Bonus si la taille est raisonnable (200KB - 5MB)
    if (file.size >= 200 * 1024 && file.size <= 5 * 1024 * 1024) {
      qualityScore += 10;
    }

    // Malus si le fichier est trop gros (peut être une image non compressée)
    if (file.size > 8 * 1024 * 1024) {
      qualityScore -= 10;
      warnings.push('Fichier volumineux, vérifier la résolution');
    }

    // Détection basique de QR code INPI dans le nom du fichier
    const hasQrCodeKeyword = /kbis.*qr|qr.*kbis|inpi.*certif/i.test(file.name);
    if (hasQrCodeKeyword) {
      qualityScore += 5;
    }

    const result: KbisParseResult = {
      success: true,
      siret: siretFromFilename,
      siren: siretFromFilename ? siretFromFilename.substring(0, 9) : undefined,
      documentQuality: qualityScore >= 70 ? 'authentic' : qualityScore >= 50 ? 'suspicious' : 'altered',
      qualityScore: Math.min(100, Math.max(0, qualityScore)),
      warnings: warnings.length > 0 ? warnings : undefined,
      metadata: {
        fileSize: file.size,
        fileType: file.type,
        fileName: file.name,
      },
      // Pour l'instant, on ne peut pas détecter ces éléments sans OCR
      hasInpiLogo: undefined,
      hasSeal: undefined,
      hasSignature: undefined,
      hasOfficialHeader: undefined,
    };

    if (result.warnings && result.warnings.length > 0) {
      console.warn(`⚠️ Avertissements parsing: ${result.warnings.join(', ')}`);
    }

    return result;
  } catch (error: any) {
    console.error('Erreur parseKbisDocument:', error);
    return {
      success: false,
      error: error?.message || 'Erreur lors du parsing',
    };
  }
}

/**
 * Extrait le SIRET du nom de fichier si présent
 * Patterns courants: "kbis_12345678901234.pdf", "12345678901234_kbis.jpg"
 */
function extractSiretFromFilename(filename: string): string | undefined {
  // Recherche d'un nombre à 14 chiffres dans le nom de fichier
  const siretMatch = filename.match(/\b(\d{14})\b/);
  if (siretMatch) {
    return siretMatch[1];
  }

  // Recherche d'un SIRET formaté (XXX XXX XXX XXXXX)
  const siretFormattedMatch = filename.match(/(\d{3})\s?(\d{3})\s?(\d{3})\s?(\d{5})/);
  if (siretFormattedMatch) {
    return siretFormattedMatch[1] + siretFormattedMatch[2] + siretFormattedMatch[3] + siretFormattedMatch[4];
  }

  return undefined;
}
