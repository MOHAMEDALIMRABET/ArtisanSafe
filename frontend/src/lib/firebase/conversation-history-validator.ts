/**
 * Validation multi-couches pour détecter les numéros fragmentés
 * et autres tentatives de contournement via l'historique de conversation
 * 
 * @module conversation-history-validator
 * @author ArtisanDispo Team
 * @date 2026-01-31
 */

import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  Timestamp 
} from 'firebase/firestore';
import { db } from './config';
import { validateMessage } from '../antiBypassValidator';

/**
 * Interface pour un message dans l'historique
 */
interface MessageHistorique {
  text: string;
  authorId: string;
  createdAt: Timestamp;
}

/**
 * Résultat de validation
 */
export interface ValidationResult {
  isValid: boolean;
  message?: string;
  reason?: 'current_message' | 'fragmented_phone' | 'suspicious_sequence' | 'rate_limit';
}

/**
 * Configuration du validateur
 */
interface ValidatorConfig {
  historyLimit: number;          // Nombre de messages à analyser (défaut: 10)
  maxConsecutiveDigits: number;  // Nombre max de messages de chiffres consécutifs (défaut: 3)
  shortMessageThreshold: number; // Longueur max pour considérer un message "court" (défaut: 5)
  shortMessageLimit: number;     // Nombre max de messages courts en 30s (défaut: 3)
  timeWindowSeconds: number;     // Fenêtre de temps pour rate limiting (défaut: 30)
}

const DEFAULT_CONFIG: ValidatorConfig = {
  historyLimit: 10,
  maxConsecutiveDigits: 3,
  shortMessageThreshold: 5,
  shortMessageLimit: 3,
  timeWindowSeconds: 30,
};

/**
 * Récupère les messages récents d'un utilisateur dans une conversation
 */
async function getRecentMessages(
  conversationId: string,
  userId: string,
  limitCount: number,
  allMessages: boolean = false // ✅ NOUVEAU : Récupérer TOUS les messages
): Promise<MessageHistorique[]> {
  try {
    // ✅ Messages stockés dans collection RACINE, pas sous-collection
    const messagesRef = collection(db, 'messages');
    
    // ✅ ÉVITER INDEX COMPOSITE : 1 seul where(), filtre conversationId + senderId côté client
    const q = query(
      messagesRef,
      where('conversationId', '==', conversationId)
      // Filtrer senderId côté client pour éviter index composite
    );

    const snapshot = await getDocs(q);
    
    // Filtrer par senderId + trier côté client
    let messages = snapshot.docs
      .map(doc => ({
        text: doc.data().content,
        authorId: doc.data().senderId,
        createdAt: doc.data().createdAt
      } as MessageHistorique))
      .filter(msg => msg.authorId === userId) // ✅ Filtre JavaScript
      .sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA; // Décroissant (plus récent en premier)
      });

    // Limiter seulement si pas "allMessages"
    if (!allMessages) {
      messages = messages.slice(0, limitCount);
    }

    return messages;
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'historique:', error);
    // En cas d'erreur, retourner tableau vide (validation basique seulement)
    return [];
  }
}

/**
 * Liste des mots-nombres français (pour détection)
 */
const FRENCH_NUMBER_WORDS = [
  'zéro', 'zero', 'un', 'une', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'vingt', 'trente', 'quarante',
  'cinquante', 'soixante', 'septante', 'quatre-vingt', 'nonante', 'cent'
];

/**
 * Détecte si un message contient des mots-nombres français
 */
function containsNumberWords(text: string): boolean {
  const lowerText = text.toLowerCase().trim();
  return FRENCH_NUMBER_WORDS.some(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(lowerText);
  });
}

/**
 * Convertir chiffres écrits en lettres en chiffres
 */
function wordsToDigits(text: string): string {
  const numberWords: Record<string, string> = {
    'zéro': '0', 'zero': '0',
    'un': '1', 'une': '1',
    'deux': '2',
    'trois': '3',
    'quatre': '4',
    'cinq': '5',
    'six': '6',
    'sept': '7',
    'huit': '8',
    'neuf': '9',
    // Dizaines
    'dix': '10',
    'onze': '11',
    'douze': '12',
    'treize': '13',
    'quatorze': '14',
    'quinze': '15',
    'seize': '16',
    'vingt': '20',
    'trente': '30',
    'quarante': '40',
    'cinquante': '50',
    'soixante': '60',
    'septante': '70',
    'quatre-vingt': '80',
    'quatre-vingts': '80',
    'nonante': '90',
    'cent': '100',
  };

  let result = text.toLowerCase();
  
  // Remplacer chaque mot-nombre par son chiffre
  Object.entries(numberWords).forEach(([word, digit]) => {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    result = result.replace(regex, digit);
  });

  return result;
}

/**
 * COUCHE 2 : Détecte un numéro de téléphone reconstitué dans l'historique
 * 
 * Exemple simple:
 * Message 1: "06"
 * Message 2: "67"
 * Message 3: "88 92 10"
 * → Concaténé: "0667889210" ❌ BLOQUÉ
 * 
 * Exemple avancé (contournement):
 * Message 1: "25----nu"
 * Message 2: "deux zéro"
 * Message 3: "six neuf"
 * → Extrait: "25" + "20" + "69" = "252069" ❌ BLOQUÉ
 */
function detectReconstitutedPhone(messages: string[], newMessage: string): boolean {
  // Concaténer tous les messages (historique + nouveau)
  const combinedText = [...messages, newMessage].join(' ');

  // ✅ ÉTAPE 1 : Convertir mots en chiffres
  const textWithDigits = wordsToDigits(combinedText);

  // ✅ ÉTAPE 2 : Extraire UNIQUEMENT les chiffres (enlever espaces, lettres, ponctuation)
  const digitsOnly = textWithDigits.replace(/\D/g, '');

  console.log('🔍 Validation anti-bypass:', {
    combinedText: combinedText.substring(0, 100),
    afterWordConversion: textWithDigits.substring(0, 100),
    digitsExtracted: digitsOnly,
    length: digitsOnly.length
  });

  // ✅ ÉTAPE 3 : Détecter patterns de numéros français
  const phonePatterns = [
    /0[67]\d{8}/,      // 06XXXXXXXX ou 07XXXXXXXX
    /\+33[67]\d{8}/,   // +336XXXXXXXX ou +337XXXXXXXX
    /33[67]\d{8}/,     // 336XXXXXXXX ou 337XXXXXXXX
  ];

  const hasPhone = phonePatterns.some(pattern => pattern.test(digitsOnly));

  if (hasPhone) {
    console.warn('❌ NUMÉRO FRAGMENTÉ DÉTECTÉ:', digitsOnly);
  }

  return hasPhone;
}

/**
 * COUCHE 3 : Détecte une séquence suspecte de messages contenant uniquement des chiffres
 * 
 * Exemple:
 * Message 1: "06"
 * Message 2: "67"
 * Message 3: "88"
 * → 3 messages consécutifs de chiffres ❌ BLOQUÉ
 */
function detectFragmentedSequence(
  messages: string[], 
  maxConsecutive: number
): boolean {
  let consecutiveDigitMessages = 0;

  for (const msg of messages) {
    const trimmed = msg.trim();
    
    // Message contient UNIQUEMENT des chiffres (et peut-être espaces)
    if (/^\s*\d+\s*$/.test(trimmed)) {
      consecutiveDigitMessages++;

      // Si nombre max de messages consécutifs atteint → SUSPECT
      if (consecutiveDigitMessages >= maxConsecutive) {
        return true;
      }
    } else {
      // Réinitialiser le compteur si message non-numérique
      consecutiveDigitMessages = 0;
    }
  }

  return false;
}

/**
 * COUCHE 4 : Détecte un spam de messages courts envoyés rapidement
 * 
 * Exemple:
 * 10:00:00 → "06"
 * 10:00:05 → "67"
 * 10:00:10 → "88"
 * 10:00:15 → "92"
 * → 4 messages courts en 30s ❌ BLOQUÉ
 */
function detectRapidShortMessages(
  messages: MessageHistorique[],
  config: ValidatorConfig
): boolean {
  const now = Date.now();
  const timeWindow = config.timeWindowSeconds * 1000; // Convertir en ms

  // Filtrer messages dans la fenêtre de temps
  const recentMessages = messages.filter(msg => {
    const msgTime = msg.createdAt.toMillis();
    return (now - msgTime) < timeWindow;
  });

  // Compter messages courts
  const shortMessages = recentMessages.filter(msg => 
    msg.text.trim().length <= config.shortMessageThreshold
  );

  // Si trop de messages courts → BLOQUER
  return shortMessages.length > config.shortMessageLimit;
}

/**
 * VALIDATION MULTI-COUCHES PRINCIPALE
 * 
 * Vérifie un nouveau message en analysant:
 * 1. Le contenu du message actuel (patterns existants)
 * 2. Numéros reconstitués dans l'historique
 * 3. Séquences suspectes de messages chiffrés
 * 4. Rate limiting (spam de messages courts)
 * 
 * @param newMessage - Nouveau message à valider
 * @param conversationId - ID de la conversation
 * @param userId - ID de l'utilisateur émetteur
 * @param config - Configuration optionnelle du validateur
 * @returns Résultat de validation avec détails
 */
export async function validateMessageWithHistory(
  newMessage: string,
  conversationId: string,
  userId: string,
  config: Partial<ValidatorConfig> = {}
): Promise<ValidationResult> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // ========================================
  // COUCHE 1 : Validation message actuel
  // ========================================
  const currentValidation = validateMessage(newMessage);
  if (!currentValidation.isValid) {
    return {
      isValid: false,
      message: currentValidation.message,
      reason: 'current_message',
    };
  }

  // ========================================
  // Récupérer historique des messages
  // ========================================
  const recentHistory = await getRecentMessages(
    conversationId,
    userId,
    finalConfig.historyLimit,
    false // Seulement messages récents
  );

  const allHistory = await getRecentMessages(
    conversationId,
    userId,
    0,
    true // TOUS les messages de la conversation
  );

  // Si pas assez de messages récents, accepter
  if (recentHistory.length === 0 && allHistory.length === 0) {
    return { isValid: true };
  }

  // ✅ Déclarations communes pour toutes les couches
  const newMessageDigits = wordsToDigits(newMessage).replace(/\D/g, '');
  const hasDigitsInNewMessage = newMessageDigits.length > 0;
  const isNewMessageDigitOnly = /^\s*\d+\s*$/.test(newMessage.trim());
  const hasNumberWords = containsNumberWords(newMessage);

  // ========================================
  // COUCHE 2A : Fragmentation RÉCENTE (< 5 min)
  // Seuil BAS : 3+ chiffres consécutifs suffisent
  // ========================================
  
  const now = Date.now();
  const fiveMinutesAgo = now - (5 * 60 * 1000);
  const veryRecentMessages = recentHistory.filter(msg => {
    const msgTime = msg.createdAt?.toMillis() || 0;
    return msgTime > fiveMinutesAgo;
  });

  if (veryRecentMessages.length > 0) {
    const recentTexts = veryRecentMessages.map(m => m.text).reverse();

    if (hasDigitsInNewMessage) {
      // Seulement analyser si le nouveau message = chiffres purs (pas "7 ans", "550€", etc.)
      if (isNewMessageDigitOnly) {
        const combinedRecent = [...recentTexts, newMessage].join(' ');
        const digitsRecent = wordsToDigits(combinedRecent).replace(/\D/g, '');
        
        // ✅ SEUIL INTELLIGENT : Au moins 6 chiffres consécutifs commençant par 06/07
        if (digitsRecent.length >= 6 && /^0[67]\d{4,}/.test(digitsRecent)) {
          console.warn('⚠️ Fragmentation rapide détectée:', {
            window: '5 minutes',
            digits: digitsRecent,
            messages: veryRecentMessages.length
          });
          
          return {
            isValid: false,
            message: '⚠️ Le partage de coordonnées personnelles (téléphone, email, adresse postale) est interdit avant l\'acceptation du devis.\n\n✅ Utilisez la messagerie ArtisanDispo pour discuter en toute sécurité.',
            reason: 'fragmented_phone',
          };
        }
      }
    }
  }

  // ========================================
  // COUCHE 2B : Historique COMPLET (tout)
  // Seuil ÉLEVÉ : Seulement numéros COMPLETS valides
  // ========================================
  
  // ✅ Analyser si le message contient des CHIFFRES ou des MOTS-NOMBRES
  // Exemples bloqués: "06" "67" "88" OU "zero" "six" "neuf" "dix" "vingt"
  if (hasDigitsInNewMessage && (isNewMessageDigitOnly || hasNumberWords)) {
    // Seulement si le nouveau message contient des chiffres ET est composé uniquement de chiffres
    const allTexts = allHistory.map(m => m.text).reverse();
    
    // Vérifier avec le nouveau message inclus
    const combinedAll = [...allTexts, newMessage].join(' ');
    const digitsAll = wordsToDigits(combinedAll).replace(/\D/g, '');
    
    // ✅ SEUIL ÉLEVÉ : Numéro complet 10 chiffres commençant par 06/07
    const fullPhonePatterns = [
      /0[67]\d{8}/,      // 06XXXXXXXX ou 07XXXXXXXX (exactement 10 chiffres)
      /\+33[67]\d{8}/,   // +336XXXXXXXX ou +337XXXXXXXX
    ];
    
    const hasFullPhone = fullPhonePatterns.some(pattern => pattern.test(digitsAll));
    
    if (hasFullPhone) {
      console.warn('❌ NUMÉRO COMPLET DÉTECTÉ dans historique:', digitsAll);
      return {
        isValid: false,
        message: '⚠️ Le partage de coordonnées personnelles (téléphone, email, adresse postale) est interdit avant l\'acceptation du devis.\n\n✅ Utilisez la messagerie ArtisanDispo pour discuter en toute sécurité.',
        reason: 'fragmented_phone',
      };
    }
  }

  // ========================================
  // COUCHE 3 : Séquence suspecte
  // ========================================
  // Utiliser messages récents pour détection séquence
  const recentTexts = recentHistory.map(m => m.text).reverse();
  const fullSequence = [...recentTexts, newMessage];
  
  // Seulement bloquer si le nouveau message contribue à la séquence suspecte
  if (isNewMessageDigitOnly && detectFragmentedSequence(fullSequence, finalConfig.maxConsecutiveDigits)) {
    return {
      isValid: false,
      message: '⚠️ Le partage de coordonnées personnelles (téléphone, email, adresse postale) est interdit avant l\'acceptation du devis.\n\n✅ Utilisez la messagerie ArtisanDispo pour discuter en toute sécurité.',
      reason: 'suspicious_sequence',
    };
  }

  // ========================================
  // COUCHE 4 : Rate limiting
  // ========================================
  if (detectRapidShortMessages(recentHistory, finalConfig)) {
    return {
      isValid: false,
      message: '⚠️ Le partage de coordonnées personnelles (téléphone, email, adresse postale) est interdit avant l\'acceptation du devis.\n\n✅ Utilisez la messagerie ArtisanDispo pour discuter en toute sécurité.',
      reason: 'rate_limit',
    };
  }

  // ========================================
  // Toutes les validations passées ✅
  // ========================================
  return { isValid: true };
}

/**
 * Version simplifiée pour validation rapide (sans config)
 */
export async function validateMessageQuick(
  newMessage: string,
  conversationId: string,
  userId: string
): Promise<boolean> {
  const result = await validateMessageWithHistory(newMessage, conversationId, userId);
  return result.isValid;
}

/**
 * Fonction utilitaire pour extraire tous les chiffres d'un texte
 */
export function extractDigits(text: string): string {
  return text.replace(/\D/g, '');
}

/**
 * Fonction utilitaire pour détecter si un message contient uniquement des chiffres
 */
export function isDigitOnlyMessage(message: string): boolean {
  return /^\s*\d+\s*$/.test(message.trim());
}

/**
 * Export des fonctions de détection individuelles pour tests
 */
export const __testing__ = {
  detectReconstitutedPhone,
  detectFragmentedSequence,
  detectRapidShortMessages,
  getRecentMessages,
};
