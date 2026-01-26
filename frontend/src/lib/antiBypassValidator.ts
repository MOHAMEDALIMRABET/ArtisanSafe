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
    // Codes postaux français
    /\b\d{5}\b/g,
    /\bcode[\s\-]?postal/gi,
    /\bcp[\s:.\-]?\s*\d{5}/gi,
    
    // Noms de voies
    /\b\d+[\s,]+(rue|avenue|boulevard|av|bd|impasse|place|chemin|allée|route)\b/gi,
    /\b(rue|avenue|boulevard|impasse|place|chemin|allée|route)[\s\-]+[a-z]{3,}/gi,
    
    // Villes et arrondissements
    /\bparis[\s\-]?\d{1,2}[eèém]?/gi,
    /\b75\d{3}\b/g,
    /\barrondissement/gi,
    
    // Termes généraux
    /\badresse/gi,
    /\bdomicile/gi,
    /\bchez[\s\-]?moi/gi,
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
 * Valide un message et détecte les tentatives de bypass
 */
export function validateMessage(content: string): ValidationResult {
  const normalizedContent = content.toLowerCase().trim();
  const blockedPatterns: string[] = [];

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
    const messages = blockedPatterns.map(cat => WARNING_MESSAGES[cat]).join(', ');
    return {
      isValid: false,
      blockedPatterns,
      message: `❌ Message bloqué : ${messages}\n\n⚠️ Le partage de coordonnées personnelles est interdit avant l'acceptation du devis.\n\n✅ Utilisez la messagerie ArtisanSafe pour discuter en toute sécurité.`,
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
