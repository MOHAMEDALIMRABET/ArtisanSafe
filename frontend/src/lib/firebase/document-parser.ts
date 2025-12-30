/**
 * Service de parsing de documents (Kbis)
 * Extraction et vérification des informations SIRET
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
  error?: string;
}

/**
 * Parse un document Kbis (PDF ou image) pour extraire le SIRET
 * Utilise Tesseract.js pour l'OCR sur les images/PDFs
 */
export async function parseKbisDocument(file: File): Promise<KbisParseResult> {
  try {
    // Vérifier le type de fichier
    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      return {
        success: false,
        error: 'Format de fichier non supporté. Utilisez PDF, JPG ou PNG.'
      };
    }

    // Vérifier la taille (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return {
        success: false,
        error: 'Fichier trop volumineux. Taille maximum : 10MB.'
      };
    }

    let text = '';

    // Si c'est un PDF, le convertir en image d'abord
    if (file.type === 'application/pdf') {
      text = await extractTextFromPDF(file);
    } else {
      // Pour les images, utiliser directement Tesseract
      text = await extractTextFromImage(file);
    }

    // Parser le texte extrait
    return parseKbisText(text);

  } catch (error) {
    console.error('Erreur parsing Kbis:', error);
    return {
      success: false,
      error: 'Erreur lors du traitement du document'
    };
  }
}

/**
 * Extrait le texte d'une image avec Tesseract.js (OCR)
 */
async function extractTextFromImage(file: File): Promise<string> {
  // Import dynamique de Tesseract
  const Tesseract = (await import('tesseract.js')).default;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const imageData = e.target?.result as string;
        
        // Utiliser Tesseract pour l'OCR
        const { data: { text } } = await Tesseract.recognize(
          imageData,
          'fra', // Langue française
          {
            logger: (m) => {
              if (m.status === 'recognizing text') {
                console.log(`Progression OCR: ${Math.round(m.progress * 100)}%`);
              }
            }
          }
        );
        
        resolve(text);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Extrait le texte d'un PDF
 */
async function extractTextFromPDF(file: File): Promise<string> {
  // Import dynamique de pdf.js
  const pdfjsLib = await import('pdfjs-dist');
  
  // Configurer le worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const typedarray = new Uint8Array(e.target?.result as ArrayBuffer);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        
        let fullText = '';
        
        // Extraire le texte de chaque page
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
          fullText += pageText + '\n';
        }
        
        resolve(fullText);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parse le texte extrait pour trouver SIRET et autres informations
 */
function parseKbisText(text: string): KbisParseResult {
  // Nettoyer le texte
  const cleanText = text
    .replace(/\s+/g, ' ')
    .toUpperCase();

  // Patterns de recherche
  const siretPattern = /SIRET[:\s]*(\d{3}\s?\d{3}\s?\d{3}\s?\d{5})/i;
  const sirenPattern = /SIREN[:\s]*(\d{3}\s?\d{3}\s?\d{3})/i;
  const companyNamePattern = /DENOMINATION[:\s]*([A-ZÀ-ÿ\s&'-]+)/i;
  const legalFormPattern = /(SARL|SAS|SASU|EURL|SA|SCI|EIRL|EI|MICRO-ENTREPRISE)/i;
  const representantPattern = /(?:GERANT|PRESIDENT|DIRIGEANT|REPRESENTANT\s+LEGAL)[:\s]*([A-ZÀ-ÿ\s'-]+)/i;

  // Extraire SIRET
  const siretMatch = cleanText.match(siretPattern);
  const siret = siretMatch ? siretMatch[1].replace(/\s/g, '') : undefined;

  // Extraire SIREN
  const sirenMatch = cleanText.match(sirenPattern);
  const siren = sirenMatch ? sirenMatch[1].replace(/\s/g, '') : undefined;

  // Extraire nom de l'entreprise
  const companyNameMatch = cleanText.match(companyNamePattern);
  const companyName = companyNameMatch 
    ? companyNameMatch[1].trim() 
    : undefined;

  // Extraire forme juridique
  const legalFormMatch = cleanText.match(legalFormPattern);
  const legalForm = legalFormMatch ? legalFormMatch[1] : undefined;

  // Extraire représentant légal
  const representantMatch = cleanText.match(representantPattern);
  const representantLegal = representantMatch 
    ? representantMatch[1].trim() 
    : undefined;

  // Vérifier qu'on a au moins le SIRET
  if (!siret) {
    return {
      success: false,
      error: 'SIRET non trouvé dans le document. Assurez-vous que le document est lisible.'
    };
  }

  // Valider le format SIRET (14 chiffres)
  if (!/^\d{14}$/.test(siret)) {
    return {
      success: false,
      error: 'SIRET trouvé mais format invalide'
    };
  }

  return {
    success: true,
    siret,
    siren,
    companyName,
    legalForm,
    representantLegal
  };
}

/**
 * Compare le SIRET du Kbis avec celui du profil
 */
export function compareSiret(kbisSiret: string, profileSiret: string): {
  match: boolean;
  error?: string;
} {
  // Nettoyer les deux SIRET (enlever espaces)
  const cleanKbis = kbisSiret.replace(/\s/g, '');
  const cleanProfile = profileSiret.replace(/\s/g, '');

  // Comparer
  if (cleanKbis === cleanProfile) {
    return { match: true };
  }

  return {
    match: false,
    error: `Le SIRET du Kbis (${cleanKbis}) ne correspond pas au SIRET de votre profil (${cleanProfile})`
  };
}

/**
 * Vérifie que le Kbis a moins de 3 mois
 */
export function isKbisRecent(extractionDate?: string): {
  isRecent: boolean;
  error?: string;
} {
  if (!extractionDate) {
    // Si on ne peut pas extraire la date, on accepte (vérification manuelle admin)
    return { isRecent: true };
  }

  try {
    const kbisDate = new Date(extractionDate);
    const now = new Date();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    if (kbisDate < threeMonthsAgo) {
      return {
        isRecent: false,
        error: 'Le Kbis doit avoir moins de 3 mois'
      };
    }

    return { isRecent: true };
  } catch (error) {
    return { isRecent: true }; // Accepter si erreur de parsing date
  }
}

/**
 * Normalise un nom pour la comparaison
 * - Supprime les accents
 * - Convertit en majuscules
 * - Supprime les caractères spéciaux
 * - Supprime les espaces multiples
 */
function normalizeName(name: string): string {
  return name
    .normalize('NFD') // Décompose les caractères accentués
    .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
    .toUpperCase()
    .replace(/[^A-Z\s]/g, '') // Garde uniquement lettres et espaces
    .replace(/\s+/g, ' ') // Espaces multiples → un seul
    .trim();
}

/**
 * Compare le représentant légal du KBIS avec celui du profil
 * Gère les variations : "Pierre DUPONT" = "DUPONT Pierre" = "P. DUPONT"
 */
export function compareRepresentantLegal(
  kbisRepresentant: string, 
  profileRepresentant: string
): {
  match: boolean;
  confidence: 'high' | 'medium' | 'low';
  error?: string;
} {
  // Normaliser les deux noms
  const cleanKbis = normalizeName(kbisRepresentant);
  const cleanProfile = normalizeName(profileRepresentant);

  // Comparaison exacte
  if (cleanKbis === cleanProfile) {
    return { match: true, confidence: 'high' };
  }

  // Extraire les mots (nom et prénom séparés)
  const kbisWords = cleanKbis.split(' ').filter(w => w.length > 0);
  const profileWords = cleanProfile.split(' ').filter(w => w.length > 0);

  // Vérifier si tous les mots du profil sont dans le KBIS (ou vice-versa)
  const allProfileWordsInKbis = profileWords.every(word => 
    kbisWords.some(kw => kw.includes(word) || word.includes(kw))
  );

  const allKbisWordsInProfile = kbisWords.every(word => 
    profileWords.some(pw => pw.includes(word) || word.includes(pw))
  );

  if (allProfileWordsInKbis || allKbisWordsInProfile) {
    return { match: true, confidence: 'medium' };
  }

  // Vérifier si au moins le nom de famille correspond
  const longestKbisWord = kbisWords.reduce((a, b) => a.length > b.length ? a : b, '');
  const longestProfileWord = profileWords.reduce((a, b) => a.length > b.length ? a : b, '');

  if (longestKbisWord === longestProfileWord && longestKbisWord.length > 2) {
    return { 
      match: true, 
      confidence: 'low',
      error: 'Le nom de famille correspond mais vérification manuelle recommandée'
    };
  }

  return {
    match: false,
    error: `Le représentant légal du KBIS (${kbisRepresentant}) ne correspond pas au profil (${profileRepresentant})`
  };
}

