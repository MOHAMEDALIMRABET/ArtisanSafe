/**
 * Système anti-bypass pour la messagerie
 * Inspiré de BlaBlaCar, Airbnb, Fiverr
 * Empêche le partage de coordonnées personnelles avant paiement
 */

export interface ValidationResult {
  isValid: boolean;
  blockedPatterns: string[];
  message?: string;
}

/**
 * Patterns de détection de coordonnées personnelles
 * Couvre toutes les variations de contournement possibles
 */
const BLOCKED_PATTERNS = {
  // === TÉLÉPHONES ===
  telephone: [
    // Formats standards français
    /\b0[1-9][\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}\b/gi,
    /\b\+33[\s.\-]?[1-9][\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}\b/gi,
    /\b00[\s.\-]?33[\s.\-]?[1-9][\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}\b/gi,
    
    // 🚨 NOUVEAU : Numéros sans espaces (10 chiffres consécutifs ou plus)
    /\b\d{10,}\b/g,
    
    // 🚨 CRITIQUE : Numéros collés aux lettres (ex: "NUMEROtelephione066882710")
    /[a-z]\d{9,}/gi,  // Lettre suivie de 9+ chiffres (numéros partiels)
    /\d{9,}[a-z]/gi,  // 9+ chiffres suivis de lettre
    
    // 🚨 CRITIQUE : Numéros français partiels (9+ chiffres commençant par 0)
    /\b0\d{8,}\b/g,
    
    // 🚨 NOUVEAU : Numéros internationaux (commence par +)
    /\+\d{8,}/g,
    
    // Contournement par mots
    /\bz[eéè]ro[\s\-]?[sixdouze]+/gi,
    /\bun[\s\-]?deux[\s\-]?trois/gi,
    /\bmon[\s\-]?num[eéè]ro/gi,
    /\bappell?e[\s\-]?moi/gi,
    /\btel[\s:.\-]?\s*\d/gi,
    /\bt[eéè]l[eéè]phone/gi,
    /\bportable/gi,
    /\bmobile/gi,
    
    // Chiffres séparés ou espacés (0 6 1 2 3 4 5 6 7 8)
    /\b0[\s.\-]{1,3}[6-7](?:[\s.\-]{1,3}\d){8}\b/gi,
    
    // Substitution lettres/chiffres (o=0, i=1, etc.)
    /\b[o0][67][\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}\b/gi,
  ],

  // === EMAILS ===
  email: [
    // Formats standards
    /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/gi,
    
    // Contournement par mots
    /\barobase/gi,
    /\b[a-z0-9]+[\s\-]?@[\s\-]?[a-z0-9]+/gi,
    /\bgmail[\s.\-]?com/gi,
    /\byahoo[\s.\-]?fr/gi,
    /\bhotmail/gi,
    /\boutlook/gi,
    /\bmon[\s\-]?e[\s\-]?mail/gi,
    /\bcontact[\s@\-]?moi/gi,
    
    // Séparation par espaces (g m a i l . c o m)
    /\b[a-z](?:[\s.\-][a-z]){3,}[\s.\-]?@/gi,
    /\b[a-z]+(?:[\s.\-][a-z]){2,}[\s.\-]?point[\s.\-]?com/gi,
  ],

  // === ADRESSES POSTALES ===
  adresse: [
    // Codes postaux français (5 chiffres consécutifs ou espacés)
    /\b\d{5}\b/g,
    /\b\d{2}[\s.\-]?\d{3}\b/g, // 75 001, 75.001
    /\b\d[\s.\-]?\d[\s.\-]?\d[\s.\-]?\d[\s.\-]?\d\b/g, // 7 5 0 0 1
    /\bcode[\s\-]?postal/gi,
    /\bcp[\s:.\-]?\s*\d/gi,
    
    // 🚨 NOUVEAU : Numéro + nom de rue (avec ou sans type de voie)
    /\b\d{1,4}[\s,]+(bis|ter|quater)?\s*(rue|avenue|boulevard|av|bd|impasse|place|chemin|allée|route|voie|passage|square|cour|villa)\b/gi,
    /\b\d{1,4}[\s,]+[a-zéèêàâôù]{4,}[\s,]+[a-zéèêàâôù]{4,}/gi, // 32 jean jaures
    
    // Noms de voies
    /\b(rue|avenue|boulevard|impasse|place|chemin|allée|route)[\s\-]+[a-z]{3,}/gi,
    
    // 🚨 NOUVEAU : Villes françaises courantes
    /\bparis\b/gi,
    /\blyon\b/gi,
    /\bmarseille\b/gi,
    /\btoulouse\b/gi,
    /\bnice\b/gi,
    /\bnantes\b/gi,
    /\bstrasbourg\b/gi,
    /\bmontpellier\b/gi,
    /\bbordeaux\b/gi,
    /\blille\b/gi,
    /\brennes\b/gi,
    /\breims\b/gi,
    
    // Villes et arrondissements
    /\bparis[\s\-]?\d{1,2}[eèém]?/gi,
    /\b75\d{3}\b/g,
    /\barrondissement/gi,
    
    // Termes généraux adresse
    /\badresse[\s:.\-]/gi,
    /\bdomicile/gi,
    /\bchez[\s\-]?moi/gi,
    /\bhabite[\s\-]?(au|à)/gi,
    /\bviens[\s\-]?(au|à|chez)/gi,
  ],

  // === RÉSEAUX SOCIAUX ===
  social: [
    /\bfacebook/gi,
    /\binstagram/gi,
    /\bwhatsapp/gi,
    /\btelegram/gi,
    /\bsnapchat/gi,
    /\blinkedin/gi,
    /\btiktok/gi,
    /\b@[a-z0-9_]{3,}/gi, // @username
  ],

  // === AUTRES CONTOURNEMENTS ===
  autres: [
    // URLs
    /https?:\/\/[^\s]+/gi,
    /www\.[^\s]+/gi,
    
    // "Contacte-moi en dehors"
    /\ben[\s\-]?dehors/gi,
    /\bhors[\s\-]?plateforme/gi,
    /\bdirect(ement)?/gi,
    /\bsans[\s\-]?passer[\s\-]?par/gi,
  ],
};

/**
 * Messages d'avertissement par catégorie
 */
const WARNING_MESSAGES: Record<string, string> = {
  telephone: "📵 Numéros de téléphone interdits",
  email: "📧 Adresses email interdites",
  adresse: "📍 Adresses postales interdites",
  social: "🚫 Réseaux sociaux interdits",
  autres: "⚠️ Liens externes interdits",
};

/**
 * Détecte les numéros de téléphone fragmentés par des lettres
 * Ex: "0626num25tel32phone10" → "0626253210" = numéro valide
 */
function detectFragmentedPhoneNumbers(text: string): boolean {
  // Extraire toutes les séquences qui contiennent des chiffres
  // Pattern : commence par 0, puis alternance chiffres/lettres, au moins 9 chiffres au total
  const fragmentedPattern = /0[a-z0-9]{15,}/gi;
  const matches = text.match(fragmentedPattern) || [];
  
  for (const match of matches) {
    // Extraire uniquement les chiffres
    const digitsOnly = match.replace(/\D/g, '');
    
    // Vérifier si ça forme un numéro de téléphone français valide (10 chiffres commençant par 0)
    if (digitsOnly.length >= 10 && digitsOnly.startsWith('0')) {
      return true;
    }
  }
  
  return false;
}

/**
 * Valide un message et détecte les tentatives de bypass
 * @param content - Le contenu du message à valider
 * @param isPaid - Si true, bypass toutes les validations (devis payé)
 */
export function validateMessage(content: string, isPaid: boolean = false): ValidationResult {
  // 🎉 DEVIS PAYÉ : Autoriser tous les échanges de coordonnées
  if (isPaid) {
    return {
      isValid: true,
      blockedPatterns: [],
    };
  }

  const normalizedContent = content.toLowerCase().trim();
  const blockedPatterns: string[] = [];

  // 🚨 VÉRIFICATION PRIORITAIRE : Numéros fragmentés par des lettres
  if (detectFragmentedPhoneNumbers(normalizedContent)) {
    blockedPatterns.push('telephone');
  }

  // Vérifier chaque catégorie de patterns
  for (const [category, patterns] of Object.entries(BLOCKED_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(normalizedContent)) {
        blockedPatterns.push(category);
        break; // Une détection par catégorie suffit
      }
    }
  }

  if (blockedPatterns.length > 0) {
    return {
      isValid: false,
      blockedPatterns,
      message: `⚠️ Le partage de coordonnées personnelles (téléphone, email, adresse postale) est interdit avant l'acceptation du devis.\n\n✅ Utilisez la messagerie ArtisanDispo pour discuter en toute sécurité.`,
    };
  }

  return {
    isValid: true,
    blockedPatterns: [],
  };
}

/**
 * Validation en temps réel (pour affichage d'avertissement sans blocage)
 */
export function validateMessageRealtime(content: string): {
  hasWarning: boolean;
  warningMessage?: string;
} {
  const result = validateMessage(content);
  
  if (!result.isValid) {
    return {
      hasWarning: true,
      warningMessage: result.message,
    };
  }

  return { hasWarning: false };
}

/**
 * Nettoie le contenu en masquant les coordonnées détectées (pour logs)
 */
export function sanitizeContent(content: string): string {
  let sanitized = content;

  // Masquer téléphones
  sanitized = sanitized.replace(
    /\b0[1-9][\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}\b/gi,
    '[TÉLÉPHONE MASQUÉ]'
  );

  // Masquer emails
  sanitized = sanitized.replace(
    /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/gi,
    '[EMAIL MASQUÉ]'
  );

  // Masquer codes postaux
  sanitized = sanitized.replace(/\b\d{5}\b/g, '[CODE POSTAL MASQUÉ]');

  return sanitized;
}

/**
 * Exemples de messages bloqués (pour tests)
 */
export const BLOCKED_EXAMPLES = [
  "Appelle-moi au 06 12 34 56 78",
  "Mon numéro: 0612345678",
  "Contacte-moi sur gmail.com",
  "Mon email: test@gmail.com",
  "J'habite au 123 rue de la Paix, 75001 Paris",
  "On peut se voir directement ?",
  "Retrouve-moi sur Facebook",
  "Voici mon WhatsApp: 06.12.34.56.78",
  "Zéro six douze trente-quatre",
  "Mon tel: o6 12 34 56 78", // o = 0
  "0 6 1 2 3 4 5 6 7 8", // Espaces
];

/**
 * Exemples de messages valides (pour tests)
 */
export const VALID_EXAMPLES = [
  "Bonjour, je suis disponible demain matin",
  "Pouvez-vous préciser le type de travaux ?",
  "Le devis sera prêt dans 2 heures",
  "J'ai bien reçu votre demande",
  "Merci pour votre confiance",
];
