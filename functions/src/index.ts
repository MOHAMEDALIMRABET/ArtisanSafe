import * as admin from 'firebase-admin';

// Initialiser Firebase Admin SDK
admin.initializeApp();

// Exporter toutes les Cloud Functions

// ========================================
// SCHEDULED JOBS (Tâches planifiées)
// ========================================

/**
 * Annulation automatique des devis non payés après 24h
 * Exécution: Toutes les heures
 * 
 * Workflow:
 * 1. Client signe devis → statut: 'en_attente_paiement', dateLimitePaiement: now + 24h
 * 2. Cette function vérifie chaque heure si dateLimitePaiement < now
 * 3. Si oui → statut: 'annule', notification artisan (type refus)
 * 
 * Requirement user:
 * "si après 24h le client n'a pas encore payer le devis sera annulé 
 *  comme ci le client a refusé la variantes"
 */
export { 
  annulerDevisNonPayes,
  annulerDevisNonPayesManual  // Version HTTP pour tests manuels
} from './scheduledJobs/annulerDevisNonPayes';

/**
 * Suppression automatique des devis refusés après 24h
 * Exécution: Tous les jours à 3h du matin
 * 
 * Workflow:
 * 1. Client refuse devis → statut: 'refuse', typeRefus: 'artisan'|'variante'|'automatique'
 * 2. Cette function s'exécute tous les jours à 3h
 * 3. Supprime définitivement les devis refusés depuis > 24h (SAUF révisions)
 * 
 * Types de refus supprimés:
 * - 'artisan' : Client a bloqué cet artisan définitivement
 * - 'variante' : Client a refusé cette option
 * - 'automatique' : Devis auto-refusé car demande déjà attribuée
 * - 'definitif' : Refus définitif
 * 
 * Type de refus CONSERVÉ:
 * - 'revision' : Client demande modification → artisan peut répondre
 */
export {
  cleanupRefusedDevis,
  cleanupRefusedDevisManual  // Version HTTP pour tests manuels
} from './cleanupRefusedDevis';

/**
 * Expiration automatique des demandes passées
 * Exécution: Tous les jours à 1h du matin
 * 
 * Workflow:
 * 1. Client crée demande avec date souhaitée + flexibilité (ex: 29/01 ±3 jours)
 * 2. System calcule dateExpiration = dateDebut + flexibilité (ex: 01/02 23:59:59)
 * 3. Cette fonction vérifie quotidiennement si dateExpiration < now
 * 4. Si oui → statut: 'expiree', notification client
 * 
 * Requirement user:
 * "Comment ça se passe si la date avec la flexibilité a été dépassé !"
 */
export { 
  expirerDemandesPassees,           // Expiration quotidienne à 1h
  alerterDemandesProchesExpiration  // Alerte 24h avant expiration à 9h
} from './scheduledJobs/expirerDemandesPassees';

/**
 * Rappel automatique devis non répondus
 * Exécution: Tous les jours à 9h
 * 
 * Workflow:
 * 1. Artisan envoie devis avec dateDebutPrevue (ex: 15/02/2026)
 * 2. Cette fonction vérifie quotidiennement les devis statut='envoye'
 * 3. Actions selon délai avant dateDebutPrevue:
 *    - -7 jours : Rappel 1 (🔔 Info) → Client doit répondre
 *    - -3 jours : Rappel 2 (⚠️ Urgent) → Dernière chance
 *    - 0 jour (dépassé) : Expiration auto (❌) → statut='expire'
 * 4. Notifications client + artisan (si expiration)
 * 
 * Requirement user:
 * "Je veux que le client reçoit une notification pour l'alerter qu'il n'a pas 
 *  répondu au devis, la date de début des travaux fixée par l'artisan va être 
 *  dépassée dans 7 jours. Le client a la possibilité soit d'annuler le devis 
 *  ou bien proposer une autre date si la date de début ne le convient plus."
 */
export { 
  rappellerDevisNonRepondus
} from './scheduledJobs/rappellerDevisNonRepondus';


// ========================================
// FIRESTORE TRIGGERS
// ========================================

/**
 * Notification automatique artisans pour demandes publiques
 * 
 * DÉCLENCHEUR: Lorsque verificationStatus d'un artisan passe à 'approved'
 * 
 * Workflow:
 * 1. Artisan inscrit → Admin approuve → verificationStatus = 'approved'
 * 2. Cette fonction récupère toutes demandes publiques actives
 * 3. Vérifie correspondance métier + localisation
 * 4. Notifie artisan si match trouvé
 * 5. Ajoute artisanId à demande.artisansNotifiesIds (évite notifications multiples)
 * 
 * Feature: Système 2 types de demandes (directe vs publique)
 * - Directe: Client choisit artisan AVANT demande
 * - Publique: Client publie critères, artisans matchés automatiquement
 */
export { onArtisanVerified } from './triggers/artisanTriggers';

/**
 * Gestion automatique compteur devis + quota limite
 * 
 * TRIGGERS:
 * - onDevisCreated: Incrémente devisRecus, ferme demande à 10 devis
 * - onDevisDeleted: Décrémente devisRecus, rouvre demande si quota libéré
 * 
 * HTTP FUNCTION:
 * - syncDevisCounter: Resynchronise compteur manuellement (admin)
 * 
 * Phase 2: Système limite 10 devis par demande publique
 * - Phase 1 (UI): Warnings 8 devis, blocage 10 devis ✅
 * - Phase 2 (Cloud Function): Incrémentation atomique + fermeture auto ✅
 * - Phase 3 (Firestore Rules): Validation sécurité ⏳
 */
export { 
  onDevisCreated,      // Incrément + fermeture quota
  onDevisDeleted,      // Décrément si suppression
  syncDevisCounter     // Resync manuel (HTTP)
} from './triggers/devisTriggers';


// ========================================
// HTTP FUNCTIONS (API endpoints)
// ========================================

// Exemple: API Stripe webhook
// export { stripeWebhook } from './api/stripeWebhook';
