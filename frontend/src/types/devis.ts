/**
 * Types TypeScript pour les devis
 * Structure inspirée du modèle Qonto
 */

import { Timestamp } from 'firebase/firestore';

// ============================================
// TYPES DE BASE
// ============================================

export type DevisStatut = 
  | 'brouillon'    // Devis en cours de création
  | 'envoye'       // Devis envoyé au client
  | 'accepte'      // Client a accepté le devis
  | 'refuse'       // Client a refusé le devis
  | 'expire'       // Date de validité dépassée
  | 'remplace'     // Devis remplacé par une révision
  | 'annule';      // Devis annulé (ex: autre variante acceptée)

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
  typeRefus?: 'revision' | 'definitif'; // Type de refus
  dateModification: Timestamp;
  dateDerniereNotification?: Timestamp; // Date de la dernière notification importante (acceptation, refus, etc.)
  vuParArtisan?: boolean;        // L'artisan a-t-il consulté ce devis après action client (système lu/non lu)
  dateVueParArtisan?: Timestamp; // Date de consultation par l'artisan
  
  // Devis alternatifs (pour proposer plusieurs options au client)
  varianteGroupe?: string;       // ID du groupe de variantes (même pour tous les devis alternatifs)
  varianteLabel?: string;        // Ex: "Économique", "Standard", "Premium"
  varianteLettreReference?: string; // Ex: "A", "B", "C" pour différencier dans le numéro
  
  // Révisions (si le devis a été remplacé par une révision)
  devisRevisionId?: string;      // ID du devis qui remplace celui-ci
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
  dateDebutPrevue?: Timestamp;   // Date de début prévue
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
