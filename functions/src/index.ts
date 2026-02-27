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
 * Expiration automatique des demandes publiques
 * Exécution: Tous les jours à 1h du matin
 * 
 * Workflow:
 * 1. Client crée demande → dateExpiration calculée intelligemment (voir dateExpirationUtils.ts)
 * 2. Cette fonction vérifie chaque jour si dateExpiration < now
 * 3. Si oui → statut: 'expiree', notification client
 * 
 * Règles d'expiration intelligentes:
 * - SI date début travaux < 30 jours : expiration = dateDebut - 3 jours
 * - SI date début travaux >= 30 jours : expiration = création + 30 jours (cap)
 * - SI pas de date début : expiration = création + 30 jours (par défaut)
 * 
 * Requirement user:
 * "Comment ça se passe si la date avec la flexibilité a été dépassé !"
 */
export { 
  expirerDemandesPassees,      // Expiration quotidienne à 1h (NEW - logique améliorée)
  expireManualDemandes         // Version HTTP pour tests manuels (NEW)
} from './triggers/expirationTriggers';

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

/**
 * Nettoyage automatique demandes obsolètes
 * Exécution: Tous les dimanches à 2h du matin
 * 
 * Workflow:
 * 1. Récupère demandes avec statut 'expiree' + dateExpiration > 30 jours
 * 2. Récupère demandes avec statut 'annulee' + dateModification > 30 jours
 * 3. Supprime définitivement ces demandes (hard delete Firestore)
 * 4. Log statistiques détaillées pour monitoring
 * 
 * Règles de suppression:
 * - Demandes expirées depuis > 30 jours → Suppression définitive
 * - Demandes annulées depuis > 30 jours → Suppression définitive
 * - Protection contrats actifs (en_cours, attribuee, terminee) → Conservation
 * 
 * Benefits:
 * - ⚡ Performance: Requêtes plus rapides (moins de documents)
 * - 🧹 UX: Interface client plus claire (moins de "bruit")
 * - 📜 RGPD: Suppression automatique données obsolètes
 * - 💾 Coûts: Réduction stockage Firestore
 * 
 * Requirement user:
 * "est ce que les demandes refusées ou bien Expirées disparaissent au bout 
 *  d'un certain temps selon la logique actuelle ?"
 * 
 * Réponse: Option 2 implémentée - Nettoyage automatique hebdomadaire
 */
export { 
  cleanupOldDemandes,
  cleanupOldDemandesManual  // Version HTTP pour tests manuels
} from './scheduledJobs/cleanupOldDemandes';

/**
 * Exécution automatique des suppressions de comptes programmées
 * Exécution: Tous les jours à 3h du matin
 * 
 * Workflow:
 * 1. Admin programme suppression compte → scheduled_deletions (status: 'scheduled', deletionDate: now + 15j)
 * 2. Compte suspendu immédiatement + email avertissement utilisateur
 * 3. Cette fonction s'exécute quotidiennement à 3h du matin
 * 4. Récupère suppressions programmées arrivées à échéance (deletionDate <= now)
 * 5. Pour chaque compte : suppression cascade complète sur 15 collections
 *    - ANONYMISE (rétention légale 10 ans) : avis, devis, demandes, contrats, conversations, messages
 *    - SUPPRIME (RGPD) : notifications, rappels, disponibilites, users, artisans, Firebase Auth, etc.
 * 6. Archive statistiques anonymisées dans deleted_accounts
 * 7. Envoie email confirmation à l'utilisateur
 * 8. Marque scheduled_deletion comme 'executed'
 * 
 * Conformité Légale:
 * - RGPD Article 17 : Droit à l'effacement avec délai de recours (15 jours)
 * - Code de Commerce Art. L123-22 : Rétention 10 ans documents comptables (devis, contrats)
 * - Traçabilité complète : Logs + archives statistiques pour audits
 * 
 * Collections gérées (15 au total):
 * - ANONYMISÉES : avis (auteurNom), devis (client/artisan), demandes (client), 
 *                 contrats (clientNom/artisanNom), conversations (participantNames), messages (senderName)
 * - SUPPRIMÉES : notifications, rappels, disponibilites, scheduled_deletions, 
 *                email_notifications, admin_access_logs, users, artisans, Firebase Auth
 * 
 * Requirement user:
 * "Je veux que les deux workflow existe pour le moment :
 *  1. Suppression immédiate (tests, fraude) → Bouton admin "Supprimer Immédiatement"
 *  2. Suppression programmée 15 jours (RGPD) → Bouton admin "Programmer Suppression"
 *  La suppression doit être complète avec cascade sur toutes les collections."
 * 
 * Alternative workflow 1 (immédiat) : Via bouton admin UI → deleteArtisanAccount() / deleteClientAccount()
 */
export { 
  executePendingDeletions,        // Exécution quotidienne à 3h (production)
  executePendingDeletionsManual   // Version HTTP pour tests manuels
} from './scheduledJobs/executePendingDeletions';


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
  onDevisUpdated,      // Notifications changement statut (envoye/accepte/refuse/revision)
  syncDevisCounter     // Resync manuel (HTTP)
} from './triggers/devisTriggers';


// ========================================
// HTTP FUNCTIONS (API endpoints)
// ========================================

// Exemple: API Stripe webhook
// export { stripeWebhook } from './api/stripeWebhook';
