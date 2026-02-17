/**
 * Types TypeScript pour les collections Firestore
 * Artisan Dispo - MVP
 */

import { Timestamp } from 'firebase/firestore';

// ============================================
// TYPES DE BASE
// ============================================

export type UserRole = 'client' | 'artisan' | 'admin';
export type UserStatut = 'non_verifie' | 'verifie' | 'suspendu' | 'inactif';

export type Categorie = 
  | 'plomberie' 
  | 'electricite' 
  | 'peinture' 
  | 'menuiserie' 
  | 'maconnerie'
  | 'charpente'
  | 'carrelage'
  | 'chauffage'
  | 'climatisation'
  | 'toiture'
  | 'isolation'
  | 'serrurerie'
  | 'renovation'
  | 'autre';

export type Urgence = 'normal' | 'rapide' | 'urgent';

export type DemandeType = 'directe' | 'publique' | 'petit_travail';

export type TypeProjet = 'express' | 'standard';

export type DemandeStatut = 
  | 'genere' 
  | 'publiee' 
  | 'matchee' 
  | 'en_cours' 
  | 'attribuee'      // Devis accepté et payé, demande fermée
  | 'expiree'        // Date + flexibilité dépassée, demande archivée
  | 'quota_atteint'  // 10 devis reçus, demande automatiquement fermée (Phase 2)
  | 'terminee' 
  | 'annulee';

export type DevisStatut = 
  | 'genere' 
  | 'envoye'
  | 'en_revision'          // Client demande des modifications (statut dédié)
  | 'accepte' 
  | 'en_attente_paiement'  // Devis accepté, en attente de paiement
  | 'paye'                 // Devis payé et signé
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
  | 'nouvelle_demande_publique'  // ✅ Notification artisan pour demande publique
  | 'demande_expiree'            // ✅ Notification client demande expirée
  | 'demande_refusee'            // ✅ Ajouté - utilisé dans artisan/demandes
  | 'nouveau_devis'              // ✅ Ajouté - utilisé dans notification-service
  | 'devis_recu' 
  | 'devis_accepte'
  | 'devis_refuse'
  | 'devis_annule'               // ✅ Ajouté - client annule devis accepté
  | 'devis_supprime'             // ✅ Ajouté - suppression auto après 24h
  | 'devis_revision'             // ✅ Ajouté - demande de révision/nouvelle variante
  | 'contrat_signe'
  | 'paiement' 
  | 'paiement_libere'
  | 'nouveau_message'            // ✅ Ajouté - utilisé dans NotificationBell
  | 'message'                    // Gardé pour compatibilité
  | 'avis'
  | 'nouvel_avis'
  | 'litige';

export type MessageType = 'texte' | 'document' | 'image';

// ============================================
// STATISTIQUES ARTISAN (SCORING RÉACTIVITÉ)
// ============================================

/**
 * Statistiques de performance artisan
 * Collection Firestore: artisan_stats/{artisanId}
 */
export interface ArtisanStats {
  artisanId: string;
  
  // === TAUX DE RÉPONSE DEVIS ===
  demandesRecues: number;         // Total demandes reçues/matchées
  devisEnvoyes: number;           // Nombre de devis effectivement envoyés
  tauxReponseDevis: number;       // % = (devisEnvoyes / demandesRecues) * 100
  
  // === DÉLAI DE RÉPONSE ===
  delaiMoyenReponseHeures: number;  // Délai moyen en heures
  dernieresReponses: number[];      // Derniers 20 délais (pour moyenne glissante)
  reponseRapide24h: number;         // Nombre réponses < 24h
  
  // === TAUX D'ACCEPTATION CLIENT ===
  devisAcceptes: number;          // Devis acceptés par les clients
  devisRefuses: number;           // Devis refusés par les clients
  tauxAcceptation: number;        // % = (devisAcceptes / devisEnvoyes) * 100
  
  // === FIABILITÉ ===
  missionsTerminees: number;      // Contrats terminés avec succès
  missionsAnnulees: number;       // Contrats annulés (par artisan ou client)
  tauxCompletion: number;         // % missions terminées
  
  // === QUALITÉ ===
  noteGlobale: number;            // Note moyenne 0-5
  nombreAvis: number;             // Nombre total d'avis
  dernierAvisDate?: Timestamp;
  
  // === LITIGES ===
  nombreLitiges: number;          // Total litiges ouverts
  litigesResolus: number;         // Litiges résolus favorablement
  
  // === HISTORIQUE ===
  premiereActivite?: Timestamp;   // Première demande reçue
  derniereActivite?: Timestamp;   // Dernière action (devis envoyé/mission terminée)
  derniereMiseAJour: Timestamp;   // Dernière mise à jour stats
  
  // === PÉRIODES ===
  stats30Jours?: {
    demandesRecues: number;
    devisEnvoyes: number;
    tauxReponse: number;
    delaiMoyen: number;
  };
  stats90Jours?: {
    demandesRecues: number;
    devisEnvoyes: number;
    tauxReponse: number;
    delaiMoyen: number;
  };
}

/**
 * Événement historique pour traçabilité
 */
export interface StatsEvent {
  type: 'demande_recue' | 'devis_envoye' | 'devis_accepte' | 'devis_refuse' | 'mission_terminee' | 'mission_annulee';
  timestamp: Timestamp;
  demandeId?: string;
  devisId?: string;
  delaiReponse?: number; // Pour devis_envoye
}

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
  representantLegal?: string; // Nom du représentant légal (UNIQUEMENT pour artisans, pour vérification KBIS)
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
  adresse?: string; // Adresse complète de l'entreprise (ex: "123 rue de la République")
  ville: string;
  codePostal?: string; // Ajout code postal
  rayon?: number; // km (deprecated - utiliser rayonKm)
  rayonKm?: number; // km (nouveau champ standard)
  latitude?: number; // Coordonnées GPS (auto-remplies)
  longitude?: number; // Coordonnées GPS (auto-remplies)
  departements?: string[]; // Départements couverts (optionnel)
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
    /**
     * Attestation d'assurance décennale (obligatoire pour certains métiers BTP)
     */
    decennale?: {
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
        compagnie?: string;
        numeroPolice?: string;
        dateDebut?: string;
        dateFin?: string;
      };
      expirationDate?: Timestamp;
    };
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

  /**
   * Garantie Responsabilité Civile Professionnelle (RC Pro)
   */
  rcPro?: {
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
      compagnie?: string;
      numeroPolice?: string;
      dateDebut?: string;
      dateFin?: string;
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
  
  compteBancaire?: CompteBancaire;
  presentation?: string; // Description/bio
  photoProfil?: string; // URL Firebase Storage
  
  // Tarification pour petits travaux
  tarifHoraire?: number; // Tarif horaire en € (pour interventions rapides < 150€)
  disponiblePetitsTravaux?: boolean; // Accepte les petits travaux sans devis
  delaiInterventionRapide?: number; // Délai en heures pour intervention rapide (ex: 2h, 4h, 24h)
}

// ============================================
// 3. COLLECTION: demandes
// ============================================

export interface DemandeLocalisation {
  adresse: string;
  ville: string;
  codePostal: string;
  latitude?: number; // Optionnel (peut être dans coordonneesGPS)
  longitude?: number; // Optionnel (peut être dans coordonneesGPS)
  coordonneesGPS?: { // Alternative pour lat/lon
    latitude: number;
    longitude: number;
  };
}

export interface DatesSouhaitees {
  dateDebut: string; // YYYY-MM-DD
  dateFin?: string; // YYYY-MM-DD (optionnel)
  dates: Timestamp[]; // Format Timestamp pour matching (liste de dates souhaitées)
  flexible: boolean;
  flexibiliteDays?: number; // +/- X jours
  urgence: Urgence;
}

export interface CritereRecherche {
  metier: string;  // Métier recherché ('plomberie', 'electricite', etc.)
  ville: string;   // Ville de recherche
  rayon?: number;  // Rayon de recherche en km (pour demandes publiques)
}

export interface Demande {
  id: string;
  clientId: string;
  categorie: Categorie;
  titre: string;
  description: string;
  localisation: DemandeLocalisation;
  datesSouhaitees: DatesSouhaitees;
  dateExpiration?: Timestamp; // Date de fin de fenêtre (dateDebut + flexibilité) - calculée auto
  budgetIndicatif?: number;
  photos?: string[]; // URLs Firebase Storage (ancienne version - pour rétrocompatibilité)
  photosUrls?: string[]; // URLs Firebase Storage (nouvelle version)
  statut: DemandeStatut;
  
  // ⭐ NOUVEAU : Type de demande
  type?: DemandeType; // 'directe' | 'publique' (défaut = 'directe' pour rétrocompatibilité)
  
  // ⭐ NOUVEAU : Type de projet (express vs standard)
  typeProjet?: TypeProjet; // 'express' | 'standard' (défaut = 'standard' pour rétrocompatibilité)
  sousCategorie?: string; // Ex: 'eclairage', 'robinetterie', 'fenetres-pvc'
  
  // Pour toutes les demandes
  artisansMatches?: string[]; // IDs artisans matchés
  devisRecus?: number;
  urgence?: boolean;
  
  // Refus
  artisanRefuseId?: string; // ID de l'artisan qui a refusé (pour historique)
  artisanRefuseNom?: string; // Raison sociale de l'artisan qui a refusé
  dateRefus?: Timestamp; // Date du refus
  
  // Attribution
  devisAccepteId?: string; // ID du devis accepté et payé
  artisanAttributaireId?: string; // ID de l'artisan qui a remporté la demande
  dateAttribution?: Timestamp; // Date d'attribution du devis
  
  // ⭐ NOUVEAU : Pour demandes publiques
  artisansNotifiesIds?: string[];   // Artisans déjà notifiés (éviter doublons)
  artisansInteressesIds?: string[]; // Artisans ayant consulté la demande
  critereRecherche?: CritereRecherche; // Critères de matching automatique
  
  // Dates
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
  dateAnnulation?: Timestamp; // Date d'annulation par le client
  dateDebutPrevue?: Timestamp; // Date de début des travaux prévue
  numeroDevis?: string; // Numéro de devis (ex: "DEV-2026-001")
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
  message: string;        // Requis maintenant (toujours utilisé)
  lien?: string;          // Deep link vers l'élément concerné
  lue: boolean;           // État de lecture
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
  artisan: Artisan; // Objet artisan complet pour affichage
  score: number; // Sur 350 points max (ajout réactivité)
  breakdown: {
    metierMatch: number; // 0-100
    distanceScore: number; // 0-50
    disponibiliteScore: number; // 0-50
    notationScore: number; // 0-50
    reactiviteScore: number; // 0-80 🆕 (taux réponse + délai)
    urgenceMatch: number; // 0-20
  };
  details: { // Alias pour breakdown (compatibilité)
    metierMatch: number;
    distanceScore: number;
    disponibiliteScore: number;
    notationScore: number;
    reactiviteScore: number; // 🆕
    urgenceMatch: number;
  };
  distance?: number; // km
  disponible?: boolean;
}

/**
 * Critères de recherche pour le matching
 */
export interface MatchingCriteria {
  categorie: Categorie;
  ville: string;
  codePostal: string;
  adresse?: string;
  coordonneesGPS?: {
    latitude: number;
    longitude: number;
  };
  dates: string[]; // Dates au format "YYYY-MM-DD"
  flexible: boolean;
  flexibiliteDays?: number; // Nombre de jours de flexibilité (0, 7, 14, 30)
  urgence: 'faible' | 'normale' | 'urgent';
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
