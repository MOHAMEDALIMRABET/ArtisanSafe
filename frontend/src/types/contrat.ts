import { Timestamp } from 'firebase/firestore';

/**
 * Statuts possibles d'un contrat avec système d'escrow (séquestre)
 * 
 * Workflow :
 * 1. en_attente_debut → Devis signé + payé, travaux pas encore commencés
 * 2. en_cours → Artisan a commencé les travaux
 * 3. travaux_termines → Artisan déclare travaux finis, attente validation client
 * 4. termine_valide → Client valide, argent libéré à l'artisan
 * 5. termine_auto_valide → Auto-validé après 48h sans action client
 * 6. litige → Problème signalé, médiation admin nécessaire
 * 7. annule_rembourse → Annulation avec remboursement client
 */
export type ContratStatut = 
  | 'en_attente_debut'      // Paiement bloqué, travaux pas commencés
  | 'en_cours'              // Travaux en cours, paiement toujours bloqué
  | 'travaux_termines'      // Artisan a fini, attente validation client (48h max)
  | 'termine_valide'        // Client a validé, argent libéré à artisan
  | 'termine_auto_valide'   // Auto-validé après 48h, argent libéré
  | 'litige'                // Problème signalé, paiement gelé, médiation admin
  | 'annule_rembourse';     // Annulé, client remboursé

/**
 * Type de validation des travaux par le client
 */
export interface ValidationTravaux {
  date: Timestamp;
  validePar: 'client' | 'auto' | 'admin';  // Qui a validé
  commentaire?: string;                     // Feedback client
  note?: number;                            // Note 1-5 (optionnel)
  delaiValidation?: number;                 // Temps pris pour valider (en heures)
}

/**
 * Informations sur un litige
 */
export interface Litige {
  dateOuverture: Timestamp;
  motif: string;                            // Description du problème
  preuves?: string[];                       // URLs photos/documents
  statutLitige: 'ouvert' | 'en_cours_mediation' | 'resolu' | 'rembourse';
  decision?: {
    date: Timestamp;
    decidePar: string;                      // UID admin
    montantRembourse?: number;              // Montant remboursé au client
    montantArtisan?: number;                // Montant versé à l'artisan
    commentaire?: string;                   // Justification décision
  };
}

/**
 * Document Firestore représentant un contrat avec escrow
 * Collection: contrats/{contratId}
 * 
 * Créé automatiquement lors du paiement d'un devis signé
 * Gère le cycle de vie : paiement → travaux → validation → libération
 */
export interface Contrat {
  id?: string;                              // ID Firestore
  
  // Références
  devisId: string;                          // ID du devis accepté
  clientId: string;                         // UID client
  artisanId: string;                        // UID artisan
  
  // Statut et dates
  statut: ContratStatut;
  dateCreation: Timestamp;                  // Date création contrat (= date paiement)
  dateDebut?: Timestamp;                    // Date début travaux (artisan déclare)
  dateFinTravaux?: Timestamp;               // Date fin déclarée par artisan
  dateValidation?: Timestamp;               // Date validation client
  dateLiberationPaiement?: Timestamp;       // Date libération argent à artisan
  
  // Paiement escrow (séquestre)
  paiement: {
    montantTotal: number;                   // Montant TTC du devis
    commission: number;                     // Commission plateforme (8%)
    montantArtisan: number;                 // Montant net artisan (92%)
    stripe: {
      paymentIntentId: string;              // Stripe PaymentIntent ID (capture_method: manual)
      chargeId?: string;                    // Stripe Charge ID (après capture)
      transferId?: string;                  // Stripe Transfer ID (vers artisan)
    };
    statut: 'bloque' | 'libere' | 'rembourse';
    dateBlocage: Timestamp;                 // Date blocage argent (= dateCreation)
    dateLiberation?: Timestamp;             // Date libération argent
    dateRemboursement?: Timestamp;          // Date remboursement (si annulation)
  };
  
  // Validation travaux
  validationTravaux?: ValidationTravaux;
  
  // Litige éventuel
  litige?: Litige;
  
  // Métadonnées
  delaiValidationRestant?: number;          // Heures restantes pour validation auto (si travaux_termines)
  historiqueStatuts?: Array<{              // Historique changements statut
    statut: ContratStatut;
    date: Timestamp;
    auteur: string;                         // UID qui a changé le statut
  }>;
}

/**
 * Données pour créer un nouveau contrat après paiement
 */
export interface CreateContratData {
  devisId: string;
  clientId: string;
  artisanId: string;
  montantTotal: number;
  paymentIntentId: string;
}

/**
 * Données pour déclarer la fin des travaux (artisan)
 */
export interface DeclareFinTravauxData {
  contratId: string;
  artisanId: string;
  commentaire?: string;
}

/**
 * Données pour valider les travaux (client)
 */
export interface ValiderTravauxData {
  contratId: string;
  clientId: string;
  commentaire?: string;
  note?: number;  // 1-5 étoiles
}

/**
 * Données pour signaler un litige (client)
 */
export interface SignalerLitigeData {
  contratId: string;
  clientId: string;
  motif: string;
  preuves?: File[];  // Photos/documents
}
