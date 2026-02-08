/**
 * Middleware anti-bypass pour la messagerie backend
 * Filtre les messages contenant des coordonnées personnelles
 * Inspiré de BlaBlaCar, Airbnb, Fiverr
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Patterns de détection (synchronisés avec frontend)
 */
const BLOCKED_PATTERNS = {
  telephone: [
    /\b0[1-9][\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}\b/gi,
    /\b\+33[\s.\-]?[1-9][\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}\b/gi,
    /\b00[\s.\-]?33[\s.\-]?[1-9][\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}\b/gi,
    /\bz[eéè]ro[\s\-]?[sixdouze]+/gi,
    /\bun[\s\-]?deux[\s\-]?trois/gi,
    /\bmon[\s\-]?num[eéè]ro/gi,
    /\bappell?e[\s\-]?moi/gi,
    /\btel[\s:.\-]?\s*\d/gi,
    /\bt[eéè]l[eéè]phone/gi,
    /\bportable/gi,
    /\bmobile/gi,
    /\b0[\s.\-]{1,3}[6-7](?:[\s.\-]{1,3}\d){8}\b/gi,
    /\b[o0][67][\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}\b/gi,
  ],
  email: [
    /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/gi,
    /\barobase/gi,
    /\b[a-z0-9]+[\s\-]?@[\s\-]?[a-z0-9]+/gi,
    /\bgmail[\s.\-]?com/gi,
    /\byahoo[\s.\-]?fr/gi,
    /\bhotmail/gi,
    /\boutlook/gi,
    /\bmon[\s\-]?e[\s\-]?mail/gi,
    /\bcontact[\s@\-]?moi/gi,
    /\b[a-z](?:[\s.\-][a-z]){3,}[\s.\-]?@/gi,
    /\b[a-z]+(?:[\s.\-][a-z]){2,}[\s.\-]?point[\s.\-]?com/gi,
  ],
  adresse: [
    /\b\d{5}\b/g,
    /\bcode[\s\-]?postal/gi,
    /\bcp[\s:.\-]?\s*\d{5}/gi,
    /\b\d+[\s,]+(rue|avenue|boulevard|av|bd|impasse|place|chemin|allée|route)\b/gi,
    /\b(rue|avenue|boulevard|impasse|place|chemin|allée|route)[\s\-]+[a-z]{3,}/gi,
    /\bparis[\s\-]?\d{1,2}[eèém]?/gi,
    /\b75\d{3}\b/g,
    /\barrondissement/gi,
    /\badresse/gi,
    /\bdomicile/gi,
    /\bchez[\s\-]?moi/gi,
  ],
  social: [
    /\bfacebook/gi,
    /\binstagram/gi,
    /\bwhatsapp/gi,
    /\btelegram/gi,
    /\bsnapchat/gi,
    /\blinkedin/gi,
    /\btiktok/gi,
    /\b@[a-z0-9_]{3,}/gi,
  ],
  autres: [
    /https?:\/\/[^\s]+/gi,
    /www\.[^\s]+/gi,
    /\ben[\s\-]?dehors/gi,
    /\bhors[\s\-]?plateforme/gi,
    /\bdirect(ement)?/gi,
    /\bsans[\s\-]?passer[\s\-]?par/gi,
  ],
};

interface BlockedInfo {
  category: string;
  pattern: string;
  match: string;
}

/**
 * Détecte les coordonnées dans un message
 */
function detectBlockedContent(content: string): BlockedInfo[] {
  const normalizedContent = content.toLowerCase().trim();
  const detected: BlockedInfo[] = [];

  for (const [category, patterns] of Object.entries(BLOCKED_PATTERNS)) {
    for (const pattern of patterns) {
      const matches = normalizedContent.match(pattern);
      if (matches && matches.length > 0) {
        detected.push({
          category,
          pattern: pattern.source,
          match: matches[0],
        });
      }
    }
  }

  return detected;
}

/**
 * Masque les coordonnées détectées (pour logs sécurisés)
 */
function sanitizeForLog(content: string): string {
  let sanitized = content;

  sanitized = sanitized.replace(
    /\b0[1-9][\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}\b/gi,
    '[TEL_MASQUE]'
  );
  sanitized = sanitized.replace(
    /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/gi,
    '[EMAIL_MASQUE]'
  );
  sanitized = sanitized.replace(/\b\d{5}\b/g, '[CP_MASQUE]');

  return sanitized;
}

/**
 * Middleware Express pour filtrer les messages
 */
export const messageFilterMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { content, message, text } = req.body;
  const messageContent = content || message || text;

  if (!messageContent || typeof messageContent !== 'string') {
    next();
    return;
  }

  const blockedContent = detectBlockedContent(messageContent);

  if (blockedContent.length > 0) {
    const categories = [...new Set(blockedContent.map(b => b.category))];
    
    console.warn('🚨 MESSAGE BLOQUÉ - Tentative de bypass détectée:', {
      userId: (req as any).user?.uid || 'INCONNU',
      categories,
      sanitizedContent: sanitizeForLog(messageContent),
      timestamp: new Date().toISOString(),
      ip: req.ip,
    });

    res.status(400).json({
      error: {
        code: 'MESSAGE_BLOCKED',
        message: '❌ Message bloqué : partage de coordonnées personnelles interdit',
        categories,
        details: '⚠️ Le partage de numéros de téléphone, emails, adresses ou réseaux sociaux est interdit avant l\'acceptation du devis. Utilisez la messagerie ArtisanDispo pour communiquer en toute sécurité.',
      },
    });
    return;
  }

  // Message valide, continuer
  next();
};

/**
 * Fonction utilitaire pour valider côté backend (sans middleware)
 */
export function validateMessageContent(content: string): {
  isValid: boolean;
  blockedCategories: string[];
  sanitizedContent: string;
} {
  const blockedContent = detectBlockedContent(content);
  
  return {
    isValid: blockedContent.length === 0,
    blockedCategories: [...new Set(blockedContent.map(b => b.category))],
    sanitizedContent: sanitizeForLog(content),
  };
}

export default messageFilterMiddleware;
