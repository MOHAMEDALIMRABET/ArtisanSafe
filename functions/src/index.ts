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


// ========================================
// FIRESTORE TRIGGERS (À ajouter si besoin)
// ========================================

// Exemple: Envoyer email quand devis payé
// export { onDevisPaye } from './triggers/devisTriggers';


// ========================================
// HTTP FUNCTIONS (API endpoints)
// ========================================

// Exemple: API Stripe webhook
// export { stripeWebhook } from './api/stripeWebhook';
