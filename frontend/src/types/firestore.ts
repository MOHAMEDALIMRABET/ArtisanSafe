/**
 * Types TypeScript pour les collections Firestore
 * Artisan Dispo - MVP
 */

import { Timestamp } from 'firebase/firestore';

// ============================================
// TYPES DE BASE
// ============================================

export type UserRole = 'client' | 'artisan' | 'admin';
export type UserStatut = 'non_verifie' | 'verifie' | 'suspendu';

export type Categorie = 
  | 'plomberie' 
  | 'electricite' 
  | 'peinture' 
  | 'menuiserie' 
  | 'maconnerie'
  | 'placo'
  | 'carrelage'
  | 'chauffage'
  | 'climatisation'
  | 'toiture'
  | 'isolation'
  | 'serrurerie'
  | 'autre';

export type Urgence = 'normal' | 'rapide' | 'urgent';

export type DemandeStatut = 
  | 'brouillon' 
  | 'publiee' 
  | 'matchee' 
  | 'en_cours' 
  | 'terminee' 
  | 'annulee';

export type DevisStatut = 
  | 'brouillon' 
  | 'envoye' 
  | 'accepte' 
  | 'refuse' 
  | 'expire';

export type ContratStatut = 
  | 'signe' 
  | 'en_cours' 
  | 'termine' 
  | 'annule' 
  | 'litige';

export type PaiementStatut = 
  | 'attente' 
  | 'paye' 
  | 'bloque_escrow' 
  | 'libere' 
  | 'rembourse';

export type LitigeStatut = 
  | 'ouvert' 
  | 'en_mediation' 
  | 'resolu' 
  | 'clos';

export type LitigeMotif = 
  | 'non_conformite' 
  | 'retard' 
  | 'abandon' 
  | 'qualite' 
  | 'paiement' 
  | 'autre';

export type NotificationType = 
  | 'nouvelle_demande' 
  | 'devis_recu' 
  | 'paiement' 
  | 'message' 
  | 'avis' 
  | 'litige';

export type MessageType = 'texte' | 'document' | 'image';

export type FormeJuridique = 
  | 'auto_entrepreneur' 
  | 'eurl' 
  | 'sarl' 
  | 'sas';

// ============================================
// 1. COLLECTION: users
// ============================================

export interface UserPreferencesNotifications {
  email: boolean;
  push: boolean;
  sms: boolean;
}

export interface UserAdresse {
  rue: string;
  ville: string;
  codePostal: string;
  latitude: number;
  longitude: number;
}

export interface User {
  uid: string;
  email: string;
  emailVerified?: boolean; // Statut de vérification email (synchronisé depuis Firebase Auth)
  role: UserRole;
  nom: string;
  prenom: string;
  representantLegal?: string; // Nom du représentant légal (obligatoire artisan, pour vérification KBIS)
  telephone: string;
  adresse?: UserAdresse;
  dateCreation: Timestamp;
  statut: UserStatut;
  preferencesNotifications: UserPreferencesNotifications;
}

// ============================================
// 2. COLLECTION: artisans
// ============================================

export interface ZoneIntervention {
  ville: string;
  rayon: number; // km
  latitude: number;
  longitude: number;
}

// Structure simple pour compatibilité (deprecated)
export interface Disponibilite {
  date: string; // YYYY-MM-DD
  disponible: boolean;
  capacite: number; // nombre de chantiers/jour
}

// Structure complète pour l'agenda (nouvelle version)
export interface DisponibiliteSlot {
  id?: string;
  jour?: 'lundi' | 'mardi' | 'mercredi' | 'jeudi' | 'vendredi' | 'samedi' | 'dimanche'; // Pour récurrence hebdomadaire
  date?: Timestamp; // Pour créneaux ponctuels
  heureDebut: string; // Format "HH:mm" ex: "09:00"
  heureFin: string; // Format "HH:mm" ex: "17:00"
  recurrence: 'hebdomadaire' | 'ponctuel';
  disponible: boolean; // true = dispo, false = occupé
  titre?: string; // Ex: "Chantier client X", "Disponible"
  couleur?: string; // Hex color pour customisation
  dateCreation?: Timestamp;
}

export interface CompteBancaire {
  stripeAccountId: string; // Stripe Connect
}

export type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'incomplete';

export interface ParseResultHistory {
  siret?: string;
  siren?: string;
  companyName?: string;
  representantLegal?: string;
  qualityScore?: number;
  warnings?: string[];
  parsedAt: Timestamp;
  fileSize?: number;
  fileName?: string;
}

export interface VerificationDocuments {
  kbis?: {
    url: string;
    uploadDate: Timestamp;
    verified: boolean;
    rejected?: boolean;
    validatedAt?: Timestamp;
    validatedBy?: string;
    rejectedAt?: Timestamp;
    rejectedBy?: string;
    rejectionReason?: string;
    uploadHistory?: Array<{
      uploadedAt: Timestamp;
      fileSize: number;
      fileName: string;
      previouslyRejected: boolean;
      rejectionReason?: string | null;
    }>;
    siretMatched?: boolean;
    siretMismatchNotified?: boolean; // Notification admin envoyée si SIRET ne correspond pas
    representantMatched?: boolean;
    representantConfidence?: 'high' | 'medium' | 'low';
    requiresManualReview?: boolean;
    parseResult?: {
      siret?: string;
      siren?: string;
      companyName?: string;
      representantLegal?: string;
      qualityScore?: number;
      warnings?: string[];
      parsedAt?: Timestamp; // Date du parsing automatique
    };
    parseHistory?: ParseResultHistory[]; // Historique de tous les parsing (multi-upload)
    parsedData?: {
      siret?: string;
      raisonSociale?: string;
    };
    extractedData?: {
      siret?: string;
      siren?: string;
      companyName?: string;
      legalForm?: string;
      representantLegal?: string;
      emissionDate?: string; // Date d'émission du KBIS
      qrCodeData?: string; // Données du QR code
      qrCodeValid?: boolean; // QR code valide INPI
      hasInpiLogo?: boolean; // Détection logo INPI
      hasOfficialHeader?: boolean; // En-tête "Greffe du Tribunal de Commerce"
      hasSeal?: boolean; // Détection cachet
      hasSignature?: boolean; // Détection signature
      sealQuality?: 'good' | 'medium' | 'poor'; // Qualité cachet
      signatureQuality?: 'good' | 'medium' | 'poor'; // Qualité signature
      documentQuality?: 'authentic' | 'suspicious' | 'altered'; // Qualité générale
      qualityScore?: number; // Score d'authenticité 0-100
    };
  };
  idCard?: {
    url: string;
    uploadDate: Timestamp;
    verified: boolean;
    rejected?: boolean;
    validatedAt?: Timestamp;
    validatedBy?: string;
    rejectedAt?: Timestamp;
    rejectedBy?: string;
    rejectionReason?: string;
    uploadHistory?: Array<{
      uploadedAt: Timestamp;
      fileSize: number;
      fileName: string;
      previouslyRejected: boolean;
      rejectionReason?: string | null;
    }>;
    parsedData?: {
      nom?: string;
      prenom?: string;
    };
  };
}

export interface ContactVerification {
  email: {
    verified: boolean;
    verifiedDate?: Timestamp;
  };
  telephone: {
    verified: boolean;
    verifiedDate?: Timestamp;
    verificationCode?: string; // Code SMS temporaire
    codeExpiry?: Timestamp;
  };
}

export interface Artisan {
  userId: string;
  nom?: string;
  prenom?: string;
  email?: string;
  telephone?: string;
  telephoneVerified?: boolean;
  adresse?: string;
  dateInscription?: Timestamp;
  emailVerified?: boolean; // Statut de vérification email (synchronisé depuis Firebase Auth)
  siret: string;
  raisonSociale: string;
  formeJuridique: FormeJuridique;
  metiers: Categorie[]; // ['plomberie', 'electricite']
  zonesIntervention: ZoneIntervention[];
  disponibilites: DisponibiliteSlot[]; // Nouvelle structure
  notation: number; // 0-5
  nombreAvis: number;
  
  // Système de vérification
  verified: boolean; // Profil complètement vérifié
  verificationStatus: VerificationStatus;
  verificationDocuments?: VerificationDocuments;
  contactVerification?: ContactVerification;
  siretVerified: boolean; // Vérification automatique SIRET
  siretVerificationDate?: Timestamp;
  verificationDate?: Timestamp; // Date de vérification complète
  rejectionReason?: string; // Raison si rejeté
  
  // Anciens champs (à supprimer progressivement)
  documentsVerifies: boolean;
  badgeVerifie: boolean;
  dateVerification?: Timestamp;
  
  compteBancaire?: CompteBancaire;
  presentation?: string; // Description/bio
  photoProfil?: string; // URL Firebase Storage
}

// ============================================
// 3. COLLECTION: demandes
// ============================================

export interface DemandeLocalisation {
  adresse: string;
  ville: string;
  codePostal: string;
  latitude: number;
  longitude: number;
}

export interface DatesSouhaitees {
  dateDebut: string; // YYYY-MM-DD
  dateFin?: string; // YYYY-MM-DD (optionnel)
  flexible: boolean;
  flexibiliteDays?: number; // +/- X jours
  urgence: Urgence;
}

export interface Demande {
  id: string;
  clientId: string;
  categorie: Categorie;
  titre: string;
  description: string;
  localisation: DemandeLocalisation;
  datesSouhaitees: DatesSouhaitees;
  budgetIndicatif?: number;
  photos: string[]; // URLs Firebase Storage
  statut: DemandeStatut;
  artisansMatches?: string[]; // IDs artisans matchés
  devisRecus?: number;
  dateCreation: Timestamp;
  dateModification: Timestamp;
}

// ============================================
// 4. COLLECTION: devis
// ============================================

export interface Devis {
  id: string;
  demandeId: string;
  artisanId: string;
  clientId: string;
  montantHT: number;
  montantTVA: number;
  montantTTC: number;
  description: string;
  detailsTravaux: string;
  delaiRealisation: number; // jours
  validiteDevis: number; // jours (30 par défaut)
  conditions?: string;
  statut: DevisStatut;
  dateCreation: Timestamp;
  dateEnvoi?: Timestamp;
  dateValidation?: Timestamp;
  version: number; // Historique versions
}

// ============================================
// 5. COLLECTION: contrats
// ============================================

export interface Signature {
  date: Timestamp;
  ip: string;
}

export interface Contrat {
  id: string;
  devisId: string;
  artisanId: string;
  clientId: string;
  montantTTC: number;
  commission: number; // 8% = montantTTC * 0.08
  montantArtisan: number; // montantTTC - commission
  dateDebut: string; // YYYY-MM-DD
  dateFinEstimee: string; // YYYY-MM-DD
  dateFinReelle?: string; // YYYY-MM-DD
  statut: ContratStatut;
  paiementStatut: PaiementStatut;
  paiementId?: string; // Stripe PaymentIntent ID
  conditionsGenerales: string;
  signatureClient: Signature;
  signatureArtisan: Signature;
  dateCreation: Timestamp;
  dateSignature: Timestamp;
}

// ============================================
// 6. COLLECTION: conversations
// ============================================

export interface DernierMessage {
  contenu: string;
  senderId: string;
  date: Timestamp;
}

export interface Conversation {
  id: string;
  participants: string[]; // [clientId, artisanId]
  demandeId?: string;
  contratId?: string;
  dernierMessage: DernierMessage;
  contratValide: boolean; // Coordonnées autorisées si true
  dateCreation: Timestamp;
  dateModification: Timestamp;
}

// ============================================
// 7. COLLECTION: messages
// ============================================

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  contenu: string;
  type: MessageType;
  fichierUrl?: string;
  fichierNom?: string;
  lu: boolean;
  modere: boolean; // true si contient coordonnées filtrées
  dateEnvoi: Timestamp;
  dateLecture?: Timestamp;
}

// ============================================
// 8. COLLECTION: avis
// ============================================

export interface ReponseArtisan {
  contenu: string;
  date: Timestamp;
}

export interface Avis {
  id: string;
  contratId: string;
  artisanId: string;
  clientId: string;
  note: number; // 1-5
  commentaire: string;
  points_forts?: string[]; // ['ponctuel', 'soigneux', 'rapide']
  points_amelioration?: string[];
  photos?: string[]; // Photos résultat
  reponseArtisan?: ReponseArtisan;
  dateCreation: Timestamp;
  modere: boolean;
  signale: boolean;
  visible: boolean;
}

// ============================================
// 9. COLLECTION: litiges
// ============================================

export interface EchangeLitige {
  auteurId: string;
  message: string;
  date: Timestamp;
}

export interface DecisionLitige {
  type: 'paiement_artisan' | 'remboursement_client' | 'partage';
  montantArtisan: number;
  montantClient: number;
  justification: string;
  dateDecision: Timestamp;
}

export interface Litige {
  id: string;
  contratId: string;
  declarantId: string;
  declarantRole: UserRole; // 'client' | 'artisan'
  motif: LitigeMotif;
  description: string;
  preuves: string[]; // URLs photos/documents
  statut: LitigeStatut;
  adminId?: string; // Admin en charge
  echanges: EchangeLitige[];
  decision?: DecisionLitige;
  paiementBloque: boolean;
  dateCreation: Timestamp;
  dateResolution?: Timestamp;
}

// ============================================
// 10. COLLECTION: notifications
// ============================================

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  titre: string;
  contenu: string;
  lien?: string; // Deep link vers l'élément concerné
  lu: boolean;
  dateCreation: Timestamp;
  dateLecture?: Timestamp;
}

// ============================================
// 11. COLLECTION: transactions
// ============================================

export interface TransactionMetadata {
  description: string;
  [key: string]: any;
}

export interface Transaction {
  id: string;
  contratId: string;
  artisanId: string;
  clientId: string;
  type: 'paiement' | 'remboursement' | 'commission';
  montant: number;
  commission: number;
  statut: 'pending' | 'succeeded' | 'failed' | 'refunded';
  stripePaymentIntentId: string;
  stripeChargeId?: string;
  metadata: TransactionMetadata;
  dateCreation: Timestamp;
  dateCompletion?: Timestamp;
}

// ============================================
// TYPES UTILITAIRES
// ============================================

/**
 * Type pour la création d'un document (sans id/timestamps auto)
 */
export type CreateDocument<T> = Omit<T, 'id' | 'dateCreation' | 'dateModification'>;

/**
 * Type pour la mise à jour d'un document (tous les champs optionnels sauf id)
 */
export type UpdateDocument<T> = Partial<Omit<T, 'id'>> & { id: string };

/**
 * Résultat du moteur de matching
 */
export interface MatchingResult {
  artisanId: string;
  score: number;
  breakdown: {
    metierMatch: number; // 0-100
    distanceScore: number; // 0-50
    disponibiliteScore: number; // 0-50
    notationScore: number; // 0-50
    urgenceMatch: number; // 0-20
  };
  distance: number; // km
  disponible: boolean;
}

/**
 * Critères de recherche pour le matching
 */
export interface MatchingCriteria {
  categorie: Categorie;
  localisation: {
    latitude: number;
    longitude: number;
  };
  datesSouhaitees: DatesSouhaitees;
  budgetMax?: number;
  rayonMax?: number; // km (défaut 50)
}

// ============================================
// ADMIN - VÉRIFICATION DES ARTISANS
// ============================================

/**
 * Données d'un artisan en attente de vérification (pour admin)
 */
export interface AdminVerificationRequest {
  artisanId: string;
  userId: string;
  nomComplet: string;
  email: string;
  telephone: string;
  entreprise: {
    nom: string;
    siret: string;
    formeJuridique: FormeJuridique;
  };
  verificationStatus: VerificationStatus;
  siretVerified: boolean;
  contactVerification?: ContactVerification;
  verificationDocuments?: VerificationDocuments;
  dateInscription: Timestamp;
  dateLastUpdate?: Timestamp;
  // Données calculées pour l'affichage
  missingSteps: string[];
  completionPercentage: number;
}

/**
 * Action admin sur une vérification
 */
export interface AdminVerificationAction {
  adminId: string;
  adminEmail: string;
  action: 'approve' | 'reject';
  reason?: string; // Obligatoire si reject
  timestamp: Timestamp;
  documentChecked: 'kbis' | 'idCard' | 'both';
}

/**
 * Historique des actions admin sur un artisan
 */
export interface AdminActionHistory {
  artisanId: string;
  actions: AdminVerificationAction[];
  dateCreation: Timestamp;
  dateModification?: Timestamp;
}

/**
 * Utilisateur admin
 */
export interface Admin extends User {
  role: 'admin';
  permissions: AdminPermissions;
  actif: boolean;
  dateLastLogin?: Timestamp;
}

/**
 * Permissions admin
 */
export interface AdminPermissions {
  canVerifyArtisans: boolean;
  canManageUsers: boolean;
  canViewFinances: boolean;
  canManageLitige: boolean;
  isSuperAdmin: boolean;
}

// ============================================
// COLLECTION: admin_notifications
// ============================================

/**
 * Notification pour les administrateurs
 */
export interface AdminNotification {
  id: string;
  artisanId: string;
  artisanName: string;
  type: 'siret_mismatch' | 'document_uploaded' | 'quality_score_low' | 'suspicious_document';
  message: string;
  priority: 'low' | 'medium' | 'high';
  createdAt: Timestamp;
  read: boolean;
  readAt?: Timestamp;
  readBy?: string; // Admin ID
  resolved: boolean;
  resolvedAt?: Timestamp;
  resolvedBy?: string; // Admin ID
  resolutionNote?: string;
}
