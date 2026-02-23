/**
 * Types TypeScript pour les devis
 * Structure inspirée du modèle Qonto
 */

import { Timestamp } from 'firebase/firestore';

// ============================================
// TYPES DE BASE
// ============================================

export type DevisStatut = 
  | 'genere'                // Devis généré par l'artisan
  | 'envoye'                // Devis envoyé au client
  | 'en_revision'           // Client demande des modifications (statut dédié, jamais supprimé)
  | 'en_attente_paiement'   // Client a signé, paiement en attente (24h max)
  | 'paye'                  // Devis signé ET payé avec escrow (paiement bloqué) = CONTRAT JURIDIQUE
  | 'en_cours'              // Travaux en cours (artisan a débuté)
  | 'travaux_termines'      // Artisan a déclaré les travaux terminés
  | 'termine_valide'        // Client a validé les travaux (escrow libéré)
  | 'termine_auto_valide'   // Validation automatique après 7 jours (escrow libéré)
  | 'litige'                // Client a signalé un problème (escrow bloqué)
  | 'refuse'                // Client a refusé le devis (supprimé après 24h)
  | 'expire'                // Date de validité dépassée
  | 'remplace'              // Devis remplacé par une révision
  | 'annule';               // Devis annulé (ex: paiement non effectué dans les 24h)

export type TVARate = 0 | 5.5 | 10 | 20; // Taux de TVA français

// ============================================
// LIGNE DE PRESTATION
// ============================================

export interface LigneDevis {
  id: string;                    // ID unique de la ligne
  description: string;           // Description de la prestation
  quantite: number;              // Quantité
  unite: string;                 // Unité (h, m², unité, forfait)
  prixUnitaireHT: number;       // Prix unitaire HT en euros
  tauxTVA: TVARate;             // Taux de TVA applicable
  totalHT: number;              // Total HT (auto-calculé)
  totalTVA: number;             // Total TVA (auto-calculé)
  totalTTC: number;             // Total TTC (auto-calculé)
}

// ============================================
// DEVIS COMPLET
// ============================================

export interface Devis {
  id: string;
  
  // Références
  numeroDevis: string;           // Format: DV-2026-00001
  demandeId?: string;            // ID de la demande associée (optionnel)
  clientId: string;              // ID du client
  artisanId: string;             // ID de l'artisan
  
  // Statut et dates
  statut: DevisStatut;
  dateCreation: Timestamp;
  dateEnvoi?: Timestamp;         // Date d'envoi au client
  dateValidite: Timestamp;       // Date limite de validité
  dateAcceptation?: Timestamp;   // Date d'acceptation par le client
  dateRefus?: Timestamp;         // Date de refus par le client
  motifRefus?: string;           // Motif de refus saisi par le client
  typeRefus?: 'definitif' | 'revision';  // Type de refus
  
  // Champs dédiés aux révisions (nouveau)
  motifRevision?: string;        // Motif de la demande de révision
  dateRevision?: Timestamp;      // Date de la demande de révision
  nombreRevisions?: number;      // Compteur de révisions (cycle DV-001 → DV-001-A → DV-001-B)
  
  // Champs pour devis remplacés
  devisRevisionId?: string;      // ID du nouveau devis qui remplace celui-ci
  dateRemplacement?: Timestamp;  // Date à laquelle ce devis a été remplacé
  
  // 🆕 Champ pour variantes payées (nouveau système)
  remplacePar?: {
    devisId: string;             // ID du devis variante qui a été payé
    numeroDevis: string;         // Numéro du devis variante (ex: DV-2026-00004-A)
    date: Timestamp;             // Date à laquelle la variante a été payée
  };
  
  dateModification: Timestamp;
  dateDerniereNotification?: Timestamp; // Date de la dernière notification importante (acceptation, refus, etc.)
  vuParArtisan?: boolean;        // L'artisan a-t-il consulté ce devis après action client (système lu/non lu)
  dateVueParArtisan?: Timestamp; // Date de consultation par l'artisan
  
  // Signature électronique (lors de l'acceptation)
  signatureClient?: {
    url: string;                 // URL Firebase Storage de l'image de signature
    date: Timestamp;             // Date de la signature
    ip?: string;                 // IP du client (optionnel, pour traçabilité)
  };

  // Signature électronique de l'artisan (lors de la création/envoi du devis)
  signatureArtisan?: {
    url: string;                 // DataURL ou URL Firebase Storage de la signature
    date: Timestamp;             // Date de la signature
  };
  
  // Paiement avec escrow (séquestre) - après signature
  paiement?: {
    montant: number;             // Montant payé (doit = totaux.totalTTC)
    date: Timestamp;             // Date du paiement
    methode: 'carte_bancaire' | 'virement' | 'cheque' | 'especes';
    
    // Stripe escrow (séquestre)
    stripe?: {
      paymentIntentId: string;   // Stripe PaymentIntent (capture_method: manual)
      chargeId?: string;          // Stripe Charge ID (après capture)
      captureDate?: Timestamp;    // Date de capture (= libération argent)
    };
    
    statut: 'en_attente' | 'bloque' | 'libere' | 'echec' | 'rembourse';
    // - en_attente: Paiement initié mais pas confirmé
    // - bloque: Argent bloqué en escrow (travaux en cours)
    // - libere: Argent capturé et versé à l'artisan (travaux validés)
    // - echec: Paiement échoué
    // - rembourse: Annulation avec remboursement
  };
  
  // Gestion des travaux (cycle de vie après paiement)
  travaux?: {
    dateDebut?: Timestamp;           // Date de début déclarée par artisan
    dateFin?: Timestamp;             // Date de fin déclarée par artisan
    dateValidationClient?: Timestamp; // Date validation client
    dateValidationAuto?: Timestamp;   // Date validation auto (7 jours après dateFin)
    
    // Litige
    litige?: {
      declarePar: 'client' | 'artisan';
      motif: string;
      date: Timestamp;
      statut: 'ouvert' | 'en_mediation' | 'resolu_client' | 'resolu_artisan' | 'rembourse';
      resolutionDate?: Timestamp;
      commentaireResolution?: string;
    };
  };
  
  // Commission plateforme (8%)
  commission?: {
    taux: number;                // 0.08 (8%)
    montant: number;             // totaux.totalTTC * 0.08
    montantArtisan: number;      // totaux.totalTTC - commission.montant
  };
  
  // Système de rappels automatiques (devis non répondus)
  rappels?: {
    rappel7JoursEnvoye?: Timestamp;  // Rappel -7 jours avant dateDebutPrevue
    rappel3JoursEnvoye?: Timestamp;  // Rappel -3 jours (urgent)
  };
  
  // Expiration
  motifExpiration?: string;      // Raison de l'expiration si statut='expire'
  dateExpiration?: Timestamp;    // Date d'expiration automatique
  
  // Délai limite de paiement (24h après signature)
  dateLimitePaiement?: Timestamp;  // Calculé automatiquement (dateSignature + 24h)
  
  // Devis alternatifs (pour proposer plusieurs options au client)
  varianteGroupe?: string;       // ID du groupe de variantes (même pour tous les devis alternatifs)
  varianteLettreReference?: string; // Ex: "A", "B", "C" - Lettre attribuée automatiquement
  
  // Révisions (si le devis a été remplacé par une révision)
  devisOriginalId?: string;      // ID du devis original (si c'est une révision)
  
  // Informations client (snapshot pour le PDF)
  client: {
    nom: string;
    prenom: string;
    email: string;
    telephone: string;
    adresse?: {
      rue: string;
      ville: string;
      codePostal: string;
    };
  };
  
  // Informations artisan (snapshot pour le PDF)
  artisan: {
    raisonSociale: string;
    siret: string;
    nom?: string;
    prenom?: string;
    email: string;
    telephone: string;
    adresse?: {
      rue: string;
      ville: string;
      codePostal: string;
    };
  };
  
  // Détails de la prestation
  titre: string;                 // Titre du devis
  description?: string;          // Description générale
  lignes: LigneDevis[];          // Lignes de prestation
  
  // Main d'œuvre (obligatoire)
  mainOeuvre?: {
    quantite: number;            // Quantité (ex: nombre de jours)
    prixHT: number;              // Prix HT
    tauxTVA: TVARate;            // Taux de TVA
    unite: string;               // Unité (ex: "j" pour jours)
  };
  
  // Matière première (optionnelle)
  matierePremiere?: {
    quantite: number;            // Quantité
    prixHT: number;              // Prix HT
    tauxTVA: TVARate;            // Taux de TVA
    unite: string;               // Unité (ex: "unité")
  };
  
  // Totaux (auto-calculés)
  totaux: {
    totalHT: number;             // Somme des totaux HT
    totalTVA: {                  // Détail TVA par taux
      [key in TVARate]?: number;
    };
    totalTVAGlobal: number;      // Somme totale TVA
    totalTTC: number;            // Total TTC
  };
  
  // Informations complémentaires
  delaiRealisation?: string;     // Ex: "2 semaines"
  dateDebutPrevue: Timestamp;    // Date de début prévue (OBLIGATOIRE)
  conditions?: string;           // Conditions particulières
  notes?: string;                // Notes internes (non visibles par le client)
  
  // Pièces jointes
  pieceJointes?: {
    nom: string;
    url: string;
    type: string;
  }[];
  
  // Historique
  historiqueStatuts: {
    statut: DevisStatut;
    date: Timestamp;
    commentaire?: string;
  }[];
}

// ============================================
// TYPES POUR CRÉATION/MODIFICATION
// ============================================

export type CreateDevis = Omit<Devis, 'id' | 'dateCreation' | 'dateModification' | 'historiqueStatuts'>;

export type UpdateDevis = Partial<Omit<Devis, 'id' | 'clientId' | 'artisanId' | 'dateCreation'>>;

// ============================================
// HELPERS
// ============================================

/**
 * Calcule les totaux d'une ligne de devis
 */
export function calculerLigne(ligne: Omit<LigneDevis, 'totalHT' | 'totalTVA' | 'totalTTC'>): LigneDevis {
  const totalHT = ligne.quantite * ligne.prixUnitaireHT;
  const totalTVA = totalHT * (ligne.tauxTVA / 100);
  const totalTTC = totalHT + totalTVA;
  
  return {
    ...ligne,
    totalHT: Math.round(totalHT * 100) / 100,
    totalTVA: Math.round(totalTVA * 100) / 100,
    totalTTC: Math.round(totalTTC * 100) / 100,
  };
}

/**
 * Calcule les totaux globaux d'un devis
 */
export function calculerTotaux(lignes: LigneDevis[]): Devis['totaux'] {
  const totalHT = lignes.reduce((sum, ligne) => sum + ligne.totalHT, 0);
  
  const totalTVA: { [key in TVARate]?: number } = {};
  lignes.forEach(ligne => {
    totalTVA[ligne.tauxTVA] = (totalTVA[ligne.tauxTVA] || 0) + ligne.totalTVA;
  });
  
  const totalTVAGlobal = Object.values(totalTVA).reduce((sum, val) => sum + (val || 0), 0);
  const totalTTC = totalHT + totalTVAGlobal;
  
  return {
    totalHT: Math.round(totalHT * 100) / 100,
    totalTVA,
    totalTVAGlobal: Math.round(totalTVAGlobal * 100) / 100,
    totalTTC: Math.round(totalTTC * 100) / 100,
  };
}

/**
 * Génère un numéro de devis unique
 */
export function genererNumeroDevis(annee: number, numero: number): string {
  return `DV-${annee}-${String(numero).padStart(5, '0')}`;
}
