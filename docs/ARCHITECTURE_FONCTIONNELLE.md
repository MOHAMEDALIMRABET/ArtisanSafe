# Architecture Fonctionnelle - Artisan Dispo

## 🎯 Vision MVP

Artisan Dispo est une plateforme marketplace qui connecte particuliers et artisans via un **moteur de matching par disponibilité**. 

**Différenciateur clé :** Gestion intelligente des disponibilités et flexibilité des dates.

---

## 💰 Modèle économique

### Commission principale
- **8% du montant du chantier** (assumé par l'artisan)
- Prélevée automatiquement
- Psychologiquement acceptable

**Exemple :**
```
Chantier : 1 500 €
Commission : 120 € (8%)
Artisan reçoit : 1 380 €
```

### Évolutions futures
- Abonnement "artisan premium" (meilleure visibilité)
- Assurance chantier intégrée
- Paiement fractionné client
- Urgence/dépannage express (commission plus élevée)

---

## 🎯 Cibles prioritaires

### 👤 Particuliers
- Travaux du quotidien (pas gros chantier)
- Urgence modérée ou planifiée
- Urbains & périurbains
- **Exemples :** plomberie, électricité, peinture, petits travaux

### 🧑‍🔧 Artisans
- Indépendants / auto-entrepreneurs
- TPE (1-5 personnes)
- Qui veulent remplir leur planning
- **Motivation :** Moins de perte de temps = artisans contents

---

## 📱 Parcours utilisateur détaillé

### 👤 PARCOURS PARTICULIER (ultra fluide)

#### 🟢 Écran 1 – Accueil
- "Quel type de travaux ?"
- Boutons catégories :
  - Plomberie
  - Électricité
  - Peinture
  - Menuiserie
  - Maçonnerie
  - Autres
- **👉 Pas d'inscription au début**

#### 🟢 Écran 2 – Localisation
- Adresse ou code postal
- Rayon automatique (ex: 20 km)

#### 🟢 Écran 3 – Dates & flexibilité (🌟 DIFFÉRENCIATEUR)
- **Date souhaitée**
- **Options :**
  - ✅ Date fixe
  - 🔄 Date flexible (+/- X jours)
- **Urgence :**
  - Normal
  - Rapide
  - Urgent
- **👉 C'est là que l'app devient unique**

#### 🟢 Écran 4 – Détails du besoin
- Description libre
- Photos (optionnel)
- Budget indicatif (facultatif)

#### 🟢 Écran 5 – Résultats
Liste d'artisans avec :
- ✅ Disponibles sur la période
- 📍 Distance
- ⭐ Note
- 💰 Prix estimatif
- 📅 Créneaux visibles
- **👉 Le particulier choisit, il ne subit pas**

#### 🟢 Écran 6 – Discussion / validation
- Chat intégré
- Ajustement du devis
- Validation du contrat

#### 🟢 Écran 7 – Paiement sécurisé
- Paiement bloqué (escrow)
- Commission 8% invisible pour le client

---

### 🧑‍🔧 PARCOURS ARTISAN

#### 🔵 Écran 1 – Inscription
- Infos professionnelles
- SIRET / statut juridique
- Zone d'intervention
- Métiers proposés

#### 🔵 Écran 2 – Disponibilités
- **Agenda simple**
- Créneaux libres
- Vacances / indisponibilités
- **👉 Clé de la qualité du matching**

#### 🔵 Écran 3 – Réception des demandes
- **UNIQUEMENT compatibles**
- Infos claires :
  - Type de travaux
  - Date + flexibilité
  - Localisation
  - Budget indicatif
- **👉 Moins de spam = artisans contents**

#### 🔵 Écran 4 – Acceptation / refus
- Accepté → discussion
- Refusé → rien à faire

#### 🔵 Écran 5 – Paiement
- Paiement sécurisé
- Argent libéré après validation
- Historique clair

---

## 🔐 Règle clé de protection

**👉 Coordonnées complètes visibles uniquement après validation du contrat**

Ça protège le modèle à 8% et évite les contournements.

---

## 🏗️ Architecture technique globale

```
┌──────────────────────────┐
│        Front-end         │
│  Next.js 15 + TypeScript │
└──────────┬───────────────┘
           │
┌──────────▼───────────────┐
│   Back-end applicatif    │
│ Node.js + Express + TS   │
│   (logique métier)       │
└──────────┬───────────────┘
           │
┌──────────▼───────────────┐
│  Services transverses    │
│ Paiement / Vérif / Avis  │
└──────────┬───────────────┘
           │
┌──────────▼───────────────┐
│        Données           │
│   Firebase Firestore     │
│   Firebase Storage       │
└──────────────────────────┘
```

---

## 📦 Modules & fonctionnalités (cœur de l'app)

### 🔹 1. Gestion des utilisateurs & profils

#### Profils
- 👤 **Particulier**
- 🧑‍🔧 **Artisan**
- 🛡️ **Administrateur**

#### Fonctionnalités
- Création de compte
- Connexion / récupération mot de passe
- Gestion du profil
- **Statut du compte :**
  - Non vérifié
  - Vérifié
  - Suspendu

**👉 Fondation obligatoire**

---

### 🔹 2. Vérification & confiance (différenciant)

#### Pour les artisans
**Dépôt documents :**
- SIRET
- Statut juridique (micro-entrepreneur / société)
- Assurance professionnelle (optionnel MVP)

**Vérification :**
- Entreprise active/inactive
- Dirigeant vérifié
- Badge : ✅ Artisan vérifié

#### Pour les clients
- Email / téléphone vérifié
- Historique des projets
- Notation globale

**👉 Sans confiance, pas de marketplace**

---

### 🔹 3. Catalogue de services & besoins

#### Côté client
- **Sélection de catégorie :**
  - Plomberie
  - Électricité
  - Peinture
  - Menuiserie
  - Maçonnerie
  - Rénovation légère
  - Autres
- Description du besoin
- Upload photos
- Budget indicatif (optionnel)

#### Côté artisan
- Métiers proposés (multi-sélection)
- Zones géographiques couvertes
- Types d'intervention acceptés
- Fourchette de prix

**👉 Base pour le matching**

---

### 🔹 4. Gestion des disponibilités (🌟 CŒUR DU PRODUIT)

#### Artisan
**Agenda simple :**
- Créneaux libres
- Jours indisponibles
- Vacances
- **Capacité :**
  - 1 chantier/jour
  - ou plusieurs

#### Client
- Date souhaitée
- Période flexible (+/- X jours)
- Niveau d'urgence :
  - Normal (7-14 jours)
  - Rapide (3-7 jours)
  - Urgent (24-48h)

**👉 C'est ici que tu bats la concurrence**

---

### 🔹 5. Moteur de matching intelligent

#### Critères de matching
1. **Métier** (exact match)
2. **Localisation** (distance max)
3. **Disponibilité réelle** (créneaux libres)
4. **Flexibilité des dates** (bonus pour flexibles)
5. **Urgence** (priorisation)
6. **Notation artisan** (qualité)

#### Résultat
- Liste restreinte et qualifiée
- Classement intelligent par score
- Maximum 10 artisans affichés

**Algorithme de scoring :**
```typescript
score = (
  (match_métier ? 100 : 0) +
  (distance_km < 10 ? 50 : distance_km < 20 ? 30 : 10) +
  (disponibilité_exacte ? 50 : disponibilité_flexible ? 30 : 0) +
  (notation * 10) +
  (urgence_match ? 20 : 0)
)
```

**👉 Moins de bruit = plus de conversion**

---

### 🔹 6. Devis, contrat & paiement

#### Devis
- Devis privé (artisan ↔ client)
- Ajustements via chat
- Historique des versions
- **Statuts :**
  - Brouillon
  - Envoyé
  - Accepté
  - Refusé

#### Contrat
- Validation explicite (signature électronique)
- Conditions générales intégrées
- Date début / fin estimée
- Montant TTC

#### Paiement
- **Paiement sécurisé** (Stripe)
- **Séquestre (escrow)** : argent bloqué
- **Commission 8%** prélevée automatiquement
- **Libération après validation client**
- **Délai de réclamation :** 7 jours

**👉 Monétisation directe**

---

### 🔹 7. Messagerie & notifications

#### Messagerie
- Chat client ↔ artisan
- Partage de documents (PDF, images)
- Historique conservé
- **Limitation :** Pas d'échange de coordonnées avant validation contrat

#### Notifications
- 📧 Email + 📱 Push
- **Événements :**
  - Nouvelle demande (artisan)
  - Acceptation/refus (client)
  - Nouveau message
  - Paiement effectué
  - Fin de chantier
  - Demande d'avis

---

### 🔹 8. Avis, suivi & litiges

#### Avis
- **Notation artisan** (1-5 étoiles)
- Commentaires (500 caractères max)
- **Visible après mission terminée**
- Modération automatique (mots interdits)
- Réponse artisan possible

#### Suivi chantier
- Statuts :
  - En attente
  - Accepté
  - En cours
  - Terminé
  - Annulé
- Photos avant/après
- Validation client

#### Litiges (inspiré Vinted)
1. **Déclaration du litige** (client ou artisan)
2. **Blocage paiement** automatique
3. **Médiation admin** (sous 48h)
4. **Décision finale** :
   - Paiement complet artisan
   - Remboursement partiel/complet client
   - Pénalités éventuelles

**👉 Rassure énormément les clients**

---

## 🔧 Services transverses (invisibles mais critiques)

### 🔐 Sécurité & conformité
- **RGPD** : consentement explicite, export données
- **Chiffrement** : données sensibles (SIRET, IBAN)
- **Logs & audit** : traçabilité complète
- **Rate limiting** : protection anti-spam
- **Validation inputs** : protection XSS/injections

### 💳 Paiement (Stripe)
- Carte bancaire
- Wallet (futur)
- **Séquestre (escrow)**
- Remboursement partiel/total
- Facturation automatique
- Prélèvement commission 8%

### 🛡️ Administration (back-office)
- **Gestion utilisateurs**
  - Validation artisans
  - Suspension comptes
- **Gestion litiges**
  - Queue de litiges
  - Décisions arbitrage
- **Statistiques globales**
  - Transactions
  - Commissions
  - Taux de conversion
  - NPS (Net Promoter Score)

---

## 💾 Data Layer (Firebase)

### Collections Firestore

#### `users`
```typescript
{
  uid: string;
  email: string;
  role: 'client' | 'artisan' | 'admin';
  nom: string;
  prenom: string;
  telephone: string;
  adresse?: string;
  dateCreation: Timestamp;
  statut: 'non_verifie' | 'verifie' | 'suspendu';
}
```

#### `artisans`
```typescript
{
  userId: string;
  siret: string;
  raisonSociale: string;
  metiers: string[]; // ['plomberie', 'electricite']
  zonesIntervention: {
    ville: string;
    rayon: number; // km
  }[];
  disponibilites: {
    date: string; // YYYY-MM-DD
    disponible: boolean;
  }[];
  notation: number; // 0-5
  nombreAvis: number;
  documentsVerifies: boolean;
  badgeVerifie: boolean;
}
```

#### `demandes`
```typescript
{
  id: string;
  clientId: string;
  categorie: string;
  description: string;
  localisation: {
    adresse: string;
    latitude: number;
    longitude: number;
  };
  datesSouhaitees: {
    dateDebut: string;
    dateFin?: string;
    flexible: boolean;
    urgence: 'normal' | 'rapide' | 'urgent';
  };
  budgetIndicatif?: number;
  photos: string[];
  statut: 'brouillon' | 'publiee' | 'en_cours' | 'terminee' | 'annulee';
  dateCreation: Timestamp;
}
```

#### `devis`
```typescript
{
  id: string;
  demandeId: string;
  artisanId: string;
  clientId: string;
  montantHT: number;
  montantTTC: number;
  description: string;
  delaiRealisation: number; // jours
  statut: 'brouillon' | 'envoye' | 'accepte' | 'refuse';
  dateCreation: Timestamp;
  dateValidation?: Timestamp;
}
```

#### `contrats`
```typescript
{
  id: string;
  devisId: string;
  artisanId: string;
  clientId: string;
  montantTTC: number;
  commission: number; // 8%
  dateDebut: string;
  dateFinEstimee: string;
  statut: 'signe' | 'en_cours' | 'termine' | 'litige';
  paiementStatut: 'attente' | 'bloque' | 'libere' | 'rembourse';
  dateSignature: Timestamp;
}
```

#### `messages`
```typescript
{
  conversationId: string;
  senderId: string;
  receiverId: string;
  contenu: string;
  type: 'texte' | 'document' | 'image';
  fichierUrl?: string;
  lu: boolean;
  dateEnvoi: Timestamp;
}
```

#### `avis`
```typescript
{
  id: string;
  contratId: string;
  artisanId: string;
  clientId: string;
  note: number; // 1-5
  commentaire: string;
  reponseArtisan?: string;
  dateCreation: Timestamp;
  modere: boolean;
}
```

#### `litiges`
```typescript
{
  id: string;
  contratId: string;
  declarantId: string;
  declarantRole: 'client' | 'artisan';
  motif: string;
  description: string;
  preuves: string[]; // URLs photos
  statut: 'ouvert' | 'en_mediation' | 'resolu' | 'clos';
  decision?: {
    type: 'paiement_artisan' | 'remboursement_client' | 'partage';
    montantArtisan: number;
    montantClient: number;
    justification: string;
  };
  dateCreation: Timestamp;
  dateResolution?: Timestamp;
}
```

### Firebase Storage

**Structure :**
```
/users/{userId}/
  /profil/
    avatar.jpg
  /documents/
    siret.pdf
    assurance.pdf

/demandes/{demandeId}/
  /photos/
    photo1.jpg
    photo2.jpg

/litiges/{litigeId}/
  /preuves/
    preuve1.jpg
    preuve2.jpg

/contrats/{contratId}/
  /documents/
    contrat_signe.pdf
    facture.pdf
```

**👉 Firebase Storage reste l'outil actuel (pas de changement)**

---

## 🚀 Roadmap MVP

### Phase 1 - Fondations (Semaines 1-2)
- ✅ Authentification Firebase
- ✅ Pages inscription/connexion
- ✅ Profils utilisateurs (client/artisan)
- ⏳ Vérification artisans (SIRET)

### Phase 2 - Cœur fonctionnel (Semaines 3-4)
- ⏳ Catalogue de services
- ⏳ Formulaire demande client
- ⏳ Agenda artisan (disponibilités)
- ⏳ **Moteur de matching**

### Phase 3 - Transactions (Semaines 5-6)
- ⏳ Messagerie
- ⏳ Système de devis
- ⏳ Intégration Stripe
- ⏳ Paiement + escrow

### Phase 4 - Confiance (Semaines 7-8)
- ⏳ Système d'avis
- ⏳ Gestion litiges
- ⏳ Back-office admin
- ⏳ Tests end-to-end

---

## 📊 Métriques de succès MVP

### Côté particuliers
- **Taux de conversion** : demande → devis validé > 20%
- **Délai de réponse** : < 4h en moyenne
- **Satisfaction** : NPS > 40

### Côté artisans
- **Taux d'acceptation demandes** : > 60%
- **Qualité du matching** : > 80% des demandes pertinentes
- **Temps de remplissage agenda** : réduction 50%

### Business
- **Commission moyenne** : 8% du volume
- **Taux de litige** : < 5%
- **Retention artisans** : > 70% à 3 mois

---

## 🎨 Charte graphique (rappel)

### Couleurs BTP
- **Primary (Orange)** : `#FF6B00` - Actions, CTA
- **Secondary (Bleu foncé)** : `#2C3E50` - Confiance, headers
- **Accent (Jaune)** : `#FFC107` - Sécurité, alertes
- **Success** : `#28A745`
- **Danger** : `#DC3545`

### Principes UI
- Interface claire et rassurante
- Processus en étapes visibles
- Feedback immédiat
- Mobile-first

---

**📌 Document créé le 26/12/2025**
**Version 1.0 - MVP**
