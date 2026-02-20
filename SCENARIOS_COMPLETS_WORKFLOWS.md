# 🎬 SCÉNARIOS COMPLETS - Tous les Workflows ArtisanSafe

**Date** : 19 février 2026  
**Portée** : De la connexion → Avis client → Commentaire artisan

---

## 📋 TABLE DES MATIÈRES

1. [Scénarios d'Inscription & Connexion](#1-scénarios-dinscription--connexion)
2. [Scénarios de Demande Client](#2-scénarios-de-demande-client)
3. [Scénarios de Création Devis Artisan](#3-scénarios-de-création-devis-artisan)
4. [Scénarios de Réponse Client au Devis](#4-scénarios-de-réponse-client-au-devis)
5. [Scénarios de Signature](#5-scénarios-de-signature)
6. [Scénarios de Paiement](#6-scénarios-de-paiement)
7. [Scénarios de Réalisation Travaux](#7-scénarios-de-réalisation-travaux)
8. [Scénarios de Validation Travaux](#8-scénarios-de-validation-travaux)
9. [Scénarios d'Avis Client](#9-scénarios-davis-client)
10. [Scénarios de Réponse Artisan](#10-scénarios-de-réponse-artisan)

---

## 1. SCÉNARIOS D'INSCRIPTION & CONNEXION

### 🔹 Scénario 1.1 : Inscription Client (Premier Contact)

**Étapes** :
1. **Utilisateur** clique sur "S'inscrire" depuis la page d'accueil
2. **Utilisateur** choisit le rôle "Client"
3. **Utilisateur** remplit le formulaire :
   - Nom, Prénom
   - Email
   - Mot de passe (min 6 caractères)
   - Téléphone
4. **Système** crée le compte Firebase Auth
5. **Système** crée le document `users` dans Firestore :
   ```typescript
   {
     uid: "client-abc123",
     email: "client@example.com",
     role: "client",
     nom: "Dupont",
     prenom: "Jean",
     telephone: "+33612345678",
     emailVerified: false,
     statut: "non_verifie",
     createdAt: Timestamp
   }
   ```
6. **Système** envoie email de vérification automatique
7. **Utilisateur** est redirigé vers `/client/dashboard`
8. **Système** affiche bannière "Veuillez vérifier votre email"

**Fichiers concernés** :
- `frontend/src/lib/auth-service.ts` → `signUpClient()`
- `frontend/src/lib/firebase/user-service.ts` → `createUser()`
- `frontend/src/app/inscription/page.tsx`

**Notifications** : Email de vérification Firebase Auth

---

### 🔹 Scénario 1.2 : Inscription Artisan (Professionnel)

**Étapes** :
1. **Artisan** clique sur "S'inscrire" → "Artisan"
2. **Artisan** remplit formulaire étendu :
   - Informations personnelles (nom, prénom, email, password, téléphone)
   - Informations entreprise :
     - Raison sociale
     - SIRET (14 chiffres)
     - Métiers (plomberie, électricité, menuiserie, maçonnerie)
     - Localisation (adresse, ville, code postal)
3. **Système** crée compte Firebase Auth
4. **Système** crée 2 documents Firestore :
   
   **Document `users`** :
   ```typescript
   {
     uid: "artisan-xyz789",
     email: "artisan@plomberie.fr",
     role: "artisan",
     nom: "Martin",
     prenom: "Pierre",
     telephone: "+33698765432",
     emailVerified: false,
     statut: "non_verifie"
   }
   ```
   
   **Document `artisans`** :
   ```typescript
   {
     userId: "artisan-xyz789",
     businessName: "Plomberie Martin",
     siret: "12345678901234",
     metiers: ["plomberie"],
     location: {
       address: "15 rue de la République",
       city: "Paris",
       postalCode: "75001"
     },
     verificationStatus: "pending",
     emailVerified: false,
     documents: {},
     createdAt: Timestamp
   }
   ```

5. **Système** envoie email de vérification
6. **Artisan** redirigé vers `/artisan/dashboard`
7. **Système** affiche 2 bannières :
   - ⚠️ "Veuillez vérifier votre email"
   - ⚠️ "Veuillez uploader vos documents (KBIS, assurances)"

**Fichiers concernés** :
- `frontend/src/lib/auth-service.ts` → `signUpArtisan()`
- `frontend/src/lib/firebase/user-service.ts` → `createUser()`
- `frontend/src/lib/firebase/artisan-service.ts` → `createArtisan()`

**Statut initial** : `verificationStatus: "pending"` (profil invisible dans recherches)

---

### 🔹 Scénario 1.3 : Vérification Email

**Étapes** :
1. **Utilisateur** reçoit email Firebase "Vérifiez votre adresse email"
2. **Utilisateur** clique sur le lien de vérification
3. **Firebase** valide automatiquement l'email
4. **Utilisateur** revient sur l'application
5. **Système** détecte via `syncEmailVerificationStatus()` (hook `useAuthStatus`)
6. **Système** met à jour Firestore :
   ```typescript
   users/{uid}: { emailVerified: true }
   artisans/{userId}: { emailVerified: true }
   ```
7. **Système** affiche message de succès ✅ "Email vérifié !"

**Fichiers concernés** :
- `frontend/src/hooks/useAuthStatus.ts` → `syncEmailVerificationStatus()`
- `frontend/src/lib/firebase/user-service.ts` → `updateUser()`

**Impact** :
- Client : Peut créer des demandes
- Artisan : Profil toujours invisible (nécessite aussi `verificationStatus: "approved"`)

---

### 🔹 Scénario 1.4 : Upload Documents Artisan

**Étapes** :
1. **Artisan** (email vérifié) accède à `/artisan/documents`
2. **Artisan** upload 4 documents :
   - ✅ KBIS (obligatoire)
   - ✅ Pièce d'identité (obligatoire)
   - ✅ RC Pro (assurance responsabilité civile)
   - ✅ Garantie décennale

3. **Pour chaque document** :
   - **Frontend** upload vers Firebase Storage
   - **Frontend** lance OCR Tesseract.js (pour KBIS uniquement) :
     ```typescript
     const ocrResult = await parseKbisDocument(kbisFile);
     // Extrait : SIRET, raison sociale, représentant légal, QR code INPI
     ```
   - **Système** sauvegarde métadonnées :
     ```typescript
     documents: {
       kbis: {
         url: "https://storage.googleapis.com/.../kbis.pdf",
         uploadedAt: Timestamp,
         ocrData: {
           siret: "12345678901234",
           raisonSociale: "PLOMBERIE MARTIN",
           representantLegal: "Pierre MARTIN",
           qrCodePresent: true
         },
         status: "pending"
       }
     }
     ```

4. **Système** met à jour `artisans/{userId}` dans Firestore
5. **Système** envoie notification à l'admin :
   ```typescript
   {
     type: "nouveau_document_artisan",
     recipientId: "ADMIN_UID",
     message: "Plomberie Martin a uploadé ses documents"
   }
   ```

**Fichiers concernés** :
- `frontend/src/lib/firebase/document-parser.ts` → `parseKbisDocument()` (OCR)
- `frontend/src/lib/firebase/verification-service.ts` → `verifyKbisDocument()`
- Firebase Storage (stockage fichiers)

**Statut** : `verificationStatus` reste "pending" (attend admin)

---

### 🔹 Scénario 1.5 : Validation Admin (Artisan devient visible)

**Étapes** :
1. **Admin** reçoit notification "Nouveau document artisan"
2. **Admin** accède à `/admin/verifications`
3. **Admin** voit liste artisans en attente :
   - Nom, Email, SIRET
   - Documents uploadés (badges ✅/❌)
   - Données OCR pré-remplies

4. **Admin** clique sur "Vérifier Plomberie Martin"
5. **Admin** consulte visuellement :
   - ✅ KBIS : SIRET correspond au profil, raison sociale OK
   - ✅ Pièce d'identité : Photo = représentant légal
   - ✅ RC Pro : Assurance valide, activités couvertes
   - ✅ Garantie décennale : Couverture travaux OK

6. **Admin** décide :
   
   **Option A : APPROUVER** ✅
   - Clique "✅ Approuver cet artisan"
   - **Système** met à jour :
     ```typescript
     artisans/{userId}: {
       verificationStatus: "approved",
       verifiedAt: Timestamp,
       verifiedBy: "ADMIN_UID"
     }
     ```
   - **Système** envoie notification artisan :
     ```typescript
     {
       type: "verification_approuvee",
       title: "Profil approuvé !",
       message: "Votre profil est maintenant visible par les clients"
     }
     ```
   - ✅ **Artisan devient visible dans les recherches**

   **Option B : REJETER** ❌
   - Clique "❌ Rejeter"
   - Saisit motif : "SIRET invalide, KBIS expiré"
   - **Système** met à jour :
     ```typescript
     artisans/{userId}: {
       verificationStatus: "rejected",
       rejectionReason: "SIRET invalide, KBIS expiré",
       rejectedAt: Timestamp
     }
     ```
   - **Système** envoie notification artisan :
     ```typescript
     {
       type: "verification_rejetee",
       title: "Documents non conformes",
       message: "Motif : SIRET invalide, KBIS expiré"
     }
     ```

**Fichiers concernés** :
- `frontend/src/app/admin/verifications/page.tsx`
- `frontend/src/lib/firebase/artisan-service.ts` → `updateArtisan()`

**Condition visibilité artisan** :
```typescript
emailVerified === true && verificationStatus === "approved"
```

---

### 🔹 Scénario 1.6 : Connexion Utilisateur Existant

**Étapes** :
1. **Utilisateur** accède à `/connexion`
2. **Utilisateur** saisit email + mot de passe
3. **Système** appelle `signIn()` :
   ```typescript
   const userCredential = await signInWithEmailAndPassword(auth, email, password);
   ```
4. **Système** récupère document `users/{uid}` depuis Firestore
5. **Système** détecte le rôle et redirige :
   - `role: "client"` → `/client/dashboard`
   - `role: "artisan"` → `/artisan/dashboard`
   - `role: "admin"` → `/admin/dashboard`

6. **Frontend** stocke user dans contexte global (`useAuth()`)

**Fichiers concernés** :
- `frontend/src/lib/auth-service.ts` → `signIn()`
- `frontend/src/app/connexion/page.tsx`

**Erreurs possibles** :
- `auth/user-not-found` → "Email non trouvé"
- `auth/wrong-password` → "Mot de passe incorrect"
- `auth/too-many-requests` → "Trop de tentatives, réessayez plus tard"

---

## 2. SCÉNARIOS DE DEMANDE CLIENT

### 🔹 Scénario 2.1 : Client Crée Demande Publique

**Contexte** : Client cherche un artisan sans profil spécifique en tête.

**Étapes** :
1. **Client** (connecté + email vérifié) accède à `/client/nouvelle-demande`
2. **Client** remplit formulaire :
   ```typescript
   {
     metier: "plomberie",
     titre: "Fuite d'eau sous évier",
     description: "Fuite importante sous l'évier de cuisine, besoin d'intervention rapide",
     localisation: {
       ville: "Paris",
       codePostal: "75015",
       adresse: "Optionnelle pour demande publique"
     },
     urgence: "normale", // ou "urgent"
     budget: "500-1000€",
     disponibilites: "Semaine prochaine, jours ouvrés"
   }
   ```

3. **Client** clique "📤 Publier ma demande"

4. **Système** crée document `demandes` :
   ```typescript
   {
     id: "demande-001",
     clientId: "client-abc123",
     metier: "plomberie",
     titre: "Fuite d'eau sous évier",
     description: "...",
     localisation: { ville: "Paris", codePostal: "75015" },
     statut: "publiee",
     type: "publique",
     devisRecus: 0,
     createdAt: Timestamp,
     expiresAt: Timestamp (maintenant + 30 jours)
   }
   ```

5. **Système** envoie notifications à TOUS les artisans actifs :
   - Métier = "plomberie"
   - Localisation proche de Paris 75015
   - `verificationStatus: "approved"`
   
   ```typescript
   {
     recipientId: "artisan-xyz789",
     type: "nouvelle_demande",
     title: "Nouvelle demande : Fuite d'eau sous évier",
     message: "Paris 75015 - Plomberie",
     relatedId: "demande-001"
   }
   ```

6. **Client** redirigé vers `/client/demandes`
7. **Client** voit sa demande avec badge 🟠 "Publiée - 0 devis reçu"

**Fichiers concernés** :
- `frontend/src/app/client/nouvelle-demande/page.tsx`
- `frontend/src/lib/firebase/demande-service.ts` → `createDemande()`
- `frontend/src/lib/firebase/notification-service.ts` → `createNotification()`

**Visibilité** :
- Visible par TOUS les artisans correspondant au métier + localisation
- Artisans peuvent créer devis multi-compétitifs

---

### 🔹 Scénario 2.2 : Client Crée Demande Directe (à un artisan spécifique)

**Contexte** : Client a trouvé un artisan via recherche et veut le contacter directement.

**Étapes** :
1. **Client** recherche artisans : `/client/recherche?metier=plomberie&ville=Paris`
2. **Client** consulte profil : `/artisan/profil/[artisanId]`
3. **Client** clique "📩 Envoyer une demande de devis"
4. **Client** remplit formulaire simplifié (pré-rempli métier + artisan) :
   ```typescript
   {
     titre: "Installation nouvelle salle de bain",
     description: "Pose baignoire, mitigeur, carrelage mural",
     adresse: "12 avenue Victor Hugo, Paris 75016",
     disponibilites: "À partir de mars 2026"
   }
   ```

5. **Système** crée demande :
   ```typescript
   {
     id: "demande-002",
     clientId: "client-abc123",
     artisanCibleId: "artisan-xyz789", // ← Artisan spécifique
     type: "directe",
     metier: "plomberie",
     titre: "Installation nouvelle salle de bain",
     statut: "envoyee", // Statut différent
     devisRecus: 0
   }
   ```

6. **Système** envoie notification **uniquement à cet artisan** :
   ```typescript
   {
     recipientId: "artisan-xyz789",
     type: "demande_directe",
     title: "Demande directe de Jean Dupont",
     message: "Installation nouvelle salle de bain - Paris 75016"
   }
   ```

7. **Client** redirigé vers `/client/demandes`

**Différences vs demande publique** :
- ✅ Notification à 1 seul artisan (pas broadcast)
- ✅ Statut initial "envoyee" (pas "publiee")
- ✅ Artisan voit qu'il a été choisi spécifiquement
- ✅ Plus confidentiel (autres artisans ne voient pas)

**Fichiers concernés** :
- `frontend/src/app/artisan/profil/[id]/page.tsx`
- `frontend/src/lib/firebase/demande-service.ts` → `createDemandeDirect()`

---

### 🔹 Scénario 2.3 : Client Annule une Demande

**Contexte** : Client a trouvé un artisan ailleurs ou change d'avis.

**Étapes** :
1. **Client** accède à `/client/demandes/[id]`
2. **Client** clique "🗑️ Annuler cette demande"
3. **Système** affiche confirmation : "Voulez-vous vraiment annuler ?"
4. **Client** confirme
5. **Système** met à jour :
   ```typescript
   demandes/{demandeId}: {
     statut: "annulee",
     annulationDate: Timestamp,
     annulationRaison: "Client a annulé" // Optionnel
   }
   ```

6. **Système** envoie notifications aux artisans qui ont fait un devis :
   ```typescript
   {
     type: "demande_annulee",
     title: "Demande annulée",
     message: "Le client a annulé la demande 'Fuite d'eau sous évier'"
   }
   ```

**Fichiers concernés** :
- `frontend/src/lib/firebase/demande-service.ts` → `cancelDemande()`

**Règles métier** :
- ❌ Impossible d'annuler si un devis est déjà accepté (statut "acceptee")
- ✅ Possible tant que statut = "publiee" ou "devis_recus"

---

## 3. SCÉNARIOS DE CRÉATION DEVIS ARTISAN

### 🔹 Scénario 3.1 : Artisan Consulte Demandes Disponibles

**Étapes** :
1. **Artisan** (approuvé + email vérifié) accède à `/artisan/demandes`
2. **Système** affiche liste demandes :
   - Filtre automatique :
     - Métier dans `artisan.metiers[]`
     - Localisation proche (même région/département)
     - Statut ≠ "annulee"
     - `expiresAt` > maintenant

3. **Artisan** voit pour chaque demande :
   ```
   🟠 Nouvelle demande
   📍 Paris 75015 - Plomberie
   💰 Budget : 500-1000€
   📅 Publié il y a 2 heures
   👤 Client : Jean D. (email masqué)
   
   [Voir détails] [Faire un devis]
   ```

4. **Artisan** clique "Voir détails" → `/artisan/demandes/[id]`
5. **Artisan** voit description complète :
   - Titre, description détaillée
   - Photos (si uploadées par client)
   - Disponibilités client
   - Distance estimée

**Fichiers concernés** :
- `frontend/src/app/artisan/demandes/page.tsx`
- `frontend/src/lib/firebase/demande-service.ts` → `getDemandesForArtisan()`

---

### 🔹 Scénario 3.2 : Artisan Crée Devis (Brouillon)

**Étapes** :
1. **Artisan** clique "📝 Faire un devis" depuis `/artisan/demandes/[demandeId]`
2. **Artisan** redirigé vers `/artisan/devis/nouveau?demandeId=[id]`
3. **Formulaire pré-rempli** :
   ```typescript
   {
     demandeId: "demande-001",
     clientId: "client-abc123", // Auto-détecté
     titre: "Devis pour Fuite d'eau sous évier"
   }
   ```

4. **Artisan** ajoute prestations :
   ```typescript
   prestations: [
     {
       designation: "Déplacement et diagnostic",
       quantite: 1,
       prixUnitaireHT: 50,
       tauxTVA: 20,
       montantTVA: 10,
       prixTTC: 60
     },
     {
       designation: "Remplacement joint siphon",
       quantite: 1,
       prixUnitaireHT: 30,
       tauxTVA: 20,
       montantTVA: 6,
       prixTTC: 36
     },
     {
       designation: "Main d'œuvre réparation (1h)",
       quantite: 1,
       prixUnitaireHT: 60,
       tauxTVA: 20,
       montantTVA: 12,
       prixTTC: 72
     }
   ]
   ```

5. **Système** calcule automatiquement totaux :
   ```typescript
   montantHT: 140€,
   montantTVA: 28€,
   montantTTC: 168€
   ```

6. **Artisan** ajoute informations complémentaires :
   - Délai de réalisation : "Intervention sous 48h"
   - Date de validité : 30 jours
   - Conditions particulières : "Paiement à la fin de l'intervention"

7. **Artisan** clique "💾 Sauvegarder en brouillon"

8. **Système** crée document `devis` :
   ```typescript
   {
     id: "devis-001",
     demandeId: "demande-001",
     clientId: "client-abc123",
     artisanId: "artisan-xyz789",
     statut: "brouillon",
     prestations: [...],
     montantHT: 140,
     montantTVA: 28,
     montantTTC: 168,
     delaiRealisation: "Intervention sous 48h",
     dateValidite: Timestamp (maintenant + 30 jours),
     createdAt: Timestamp
   }
   ```

9. **Artisan** voit message "✅ Brouillon sauvegardé"

**Fichiers concernés** :
- `frontend/src/app/artisan/devis/nouveau/page.tsx`
- `frontend/src/lib/firebase/devis-service.ts` → `createDevis()`

**État** : Devis invisible pour le client (statut "brouillon")

---

### 🔹 Scénario 3.3 : Artisan Envoie Devis au Client

**Étapes** :
1. **Artisan** consulte son brouillon `/artisan/devis/[id]`
2. **Artisan** vérifie les montants, prestations
3. **Artisan** clique "📤 Envoyer au client"
4. **Système** affiche confirmation :
   ```
   ⚠️ Confirmez l'envoi du devis :
   - Montant TTC : 168€
   - Délai : Intervention sous 48h
   - Une fois envoyé, vous ne pourrez plus modifier
   
   [Annuler] [Confirmer l'envoi]
   ```

5. **Artisan** confirme

6. **Système** met à jour devis :
   ```typescript
   devis/{devisId}: {
     statut: "envoye",
     datEnvoi: Timestamp
   }
   ```

7. **Système** met à jour demande :
   ```typescript
   demandes/{demandeId}: {
     devisRecus: increment(1), // 0 → 1
     statut: "devis_recus" // Si c'était "publiee"
   }
   ```

8. **Système** envoie notification au client :
   ```typescript
   {
     recipientId: "client-abc123",
     type: "devis_recu",
     title: "Nouveau devis reçu",
     message: "Plomberie Martin vous a envoyé un devis de 168€",
     relatedId: "devis-001"
   }
   ```

9. **📧 EMAIL CLIENT (Gmail SMTP)** :
   ```
   À : jean.dupont@gmail.com
   Objet : 📨 Nouveau devis reçu - Plomberie Martin (168€)
   
   Bonjour Jean Dupont,
   
   ✅ Bonne nouvelle !
   
   Un artisan a répondu à votre demande :
   
   🏢 Artisan : Plomberie Martin
   💰 Montant : 168,00 € TTC
   📋 Prestation : Fuite d'eau sous évier
   ⏱️ Délai : Intervention sous 48h
   
   📄 Détails du devis :
   - Déplacement et diagnostic : 60€
   - Remplacement joint siphon : 36€
   - Main d'œuvre réparation (1h) : 72€
   
   👉 Consultez et acceptez votre devis :
   https://artisandispo.fr/client/devis/devis-001
   
   ⏰ Ce devis est valable 30 jours (jusqu'au 21 mars 2026)
   
   💡 Prochaine étape :
   Si le devis vous convient, acceptez-le pour passer à la signature et au paiement sécurisé.
   
   Cordialement,
   L'équipe ArtisanDispo
   ```

10. **Artisan** voit message "✅ Devis envoyé au client"

**Fichiers concernés** :
- `frontend/src/lib/firebase/devis-service.ts` → `sendDevis()`
- `frontend/src/lib/firebase/notification-service.ts`

**Règles métier** :
- ❌ Devis envoyé = non modifiable
- ✅ Client peut maintenant consulter et répondre

---

### 🔹 Scénario 3.4 : Artisan Modifie Brouillon

**Étapes** :
1. **Artisan** consulte brouillon `/artisan/devis/[id]`
2. **Artisan** clique "✏️ Modifier"
3. **Artisan** change :
   - Ajoute/supprime prestation
   - Modifie prix unitaire
   - Change délai

4. **Système** recalcule totaux automatiquement
5. **Artisan** clique "💾 Sauvegarder"
6. **Système** met à jour Firestore
7. **Artisan** voit "✅ Modifications sauvegardées"

**Limitation** : Possible UNIQUEMENT si `statut === "brouillon"`

---

## 4. SCÉNARIOS DE RÉPONSE CLIENT AU DEVIS

### 🔹 Scénario 4.1 : Client Consulte Devis Reçu

**Étapes** :
1. **Client** reçoit notification 🔔 "Nouveau devis reçu"
2. **Client** clique sur notification → `/client/devis/[id]`
3. **Client** voit devis complet :
   ```
   ══════════════════════════════════════
   📄 DEVIS N° DEV-2026-001
   ══════════════════════════════════════
   
   🏢 Artisan : Plomberie Martin
   📍 Paris 75010
   📧 Contact : contact@plomberiemartin.fr
   📞 06 98 76 54 32
   ⭐ Note : 4.8/5 (12 avis)
   
   ══════════════════════════════════════
   PRESTATIONS
   ══════════════════════════════════════
   
   1. Déplacement et diagnostic
      Quantité : 1
      Prix unitaire HT : 50,00 €
      TVA (20%) : 10,00 €
      Total TTC : 60,00 €
   
   2. Remplacement joint siphon
      Quantité : 1
      Prix unitaire HT : 30,00 €
      TVA (20%) : 6,00 €
      Total TTC : 36,00 €
   
   3. Main d'œuvre réparation (1h)
      Quantité : 1
      Prix unitaire HT : 60,00 €
      TVA (20%) : 12,00 €
      Total TTC : 72,00 €
   
   ══════════════════════════════════════
   TOTAUX
   ══════════════════════════════════════
   
   Total HT : 140,00 €
   Total TVA : 28,00 €
   TOTAL TTC : 168,00 €
   
   ══════════════════════════════════════
   CONDITIONS
   ══════════════════════════════════════
   
   ⏱️ Délai : Intervention sous 48h
   📅 Validité : Jusqu'au 21 mars 2026
   💳 Paiement : À la fin de l'intervention
   
   ══════════════════════════════════════
   
   [✅ Accepter ce devis]  [❌ Refuser]
   ```

**Fichiers concernés** :
- `frontend/src/app/client/devis/[id]/page.tsx`

**Actions possibles** :
- ✅ Accepter le devis
- ❌ Refuser le devis
- 📥 Télécharger PDF
- 💬 Envoyer message à l'artisan

---

### 🔹 Scénario 4.2 : Client Accepte Devis

**Étapes** :
1. **Client** clique "✅ Accepter ce devis"
2. **Système** affiche récapitulatif :
   ```
   ⚠️ Confirmation d'acceptation
   
   Vous allez accepter le devis de Plomberie Martin :
   - Montant : 168€ TTC
   - Délai : Intervention sous 48h
   
   Prochaines étapes :
   1. Signature électronique du devis
   2. Paiement sécurisé (168€)
   3. L'artisan démarre les travaux
   
   [Annuler] [Je confirme]
   ```

3. **Client** clique "Je confirme"

4. **Système** met à jour devis :
   ```typescript
   devis/{devisId}: {
     statut: "accepte",
     dateAcceptation: Timestamp
   }
   ```

5. **Système** met à jour demande :
   ```typescript
   demandes/{demandeId}: {
     statut: "acceptee"
   }
   ```

6. **Système** envoie notification artisan :
   ```typescript
   {
     recipientId: "artisan-xyz789",
     type: "devis_accepte",
     title: "🎉 Devis accepté !",
     message: "Jean Dupont a accepté votre devis de 168€",
     relatedId: "devis-001"
   }
   ```

7. **📧 EMAIL ARTISAN (Gmail SMTP)** :
   ```
   À : pierre.martin@plomberie.fr
   Objet : �� Votre devis a été accepté ! - Jean Dupont (168€)
   
   Bonjour Pierre Martin,
   
   🎉 Excellente nouvelle !
   
   Votre devis a été accepté par le client :
   
   👤 Client : Jean Dupont
   💰 Montant : 168,00 € TTC
   📋 Prestation : Fuite d'eau sous évier
   📍 Localisation : 12 rue de la Paix, Paris 75001
   
   📝 Prochaines étapes :
   1. Le client va signer électroniquement le devis
   2. Le client va effectuer le paiement (montant en séquestre)
   3. Vous pourrez démarrer les travaux une fois le paiement validé
   
   👉 Suivez l'avancement :
   https://artisandispo.fr/artisan/devis/devis-001
   
   ⏰ Délai promis : Intervention sous 48h
   
   💡 Important :
   Le paiement sera retenu en sécurité jusqu'à validation des travaux par le client.
   
   Cordialement,
   L'équipe ArtisanDispo
   ```

8. **Client** redirigé vers modal signature (Scénario 5.1)

**Fichiers concernés** :
- `frontend/src/lib/firebase/devis-service.ts` → `acceptDevis()`

---

### 🔹 Scénario 4.3 : Client Refuse Devis

**Étapes** :
1. **Client** clique "❌ Refuser"
2. **Système** affiche modal :
   ```
   Refus du devis
   
   Pourquoi refusez-vous ce devis ? (optionnel)
   
   [  ] Prix trop élevé
   [  ] Délai trop long
   [  ] Prestations non adaptées
   [  ] J'ai trouvé un autre artisan
   [  ] Autre raison
   
   💬 Commentaire (optionnel) :
   ┌─────────────────────────────────────┐
   │                                      │
   └─────────────────────────────────────┘
   
   [Annuler] [Confirmer le refus]
   ```

3. **Client** sélectionne "Prix trop élevé" + ajoute "Budget max 150€"
4. **Client** confirme

5. **Système** met à jour devis :
   ```typescript
   devis/{devisId}: {
     statut: "refuse",
     dateRefus: Timestamp,
     motifRefus: "Prix trop élevé",
     commentaireRefus: "Budget max 150€"
   }
   ```

6. **Système** envoie notification artisan :
   ```typescript
   {
     recipientId: "artisan-xyz789",
     type: "devis_refuse",
     title: "Devis refusé",
     message: "Jean Dupont a refusé votre devis. Motif : Prix trop élevé",
     relatedId: "devis-001"
   }
   ```

7. **Client** redirigé vers `/client/demandes/[demandeId]`
8. **Demande** reste avec statut "devis_recus" (peut recevoir autres devis)

**Fichiers concernés** :
- `frontend/src/lib/firebase/devis-service.ts` → `refuseDevis()`

**Impact** :
- Artisan peut voir le motif (améliorer futurs devis)
- Client peut encore recevoir d'autres devis sur cette demande
- Devis refusé ne peut plus être accepté

---

### 🔹 Scénario 4.4 : Devis Expire (Date de validité dépassée)

**Contexte** : Client n'a pas répondu avant la date de validité.

**Étapes** :
1. **Système** (Cloud Function ou tâche cron) vérifie quotidiennement :
   ```typescript
   const devisExpires = await db.collection('devis')
     .where('statut', '==', 'envoye')
     .where('dateValidite', '<', new Date())
     .get();
   ```

2. **Pour chaque devis expiré** :
   ```typescript
   devis/{devisId}: {
     statut: "expire",
     dateExpiration: Timestamp
   }
   ```

3. **Système** envoie notifications :
   
   **Au client** :
   ```typescript
   {
     type: "devis_expire",
     title: "Devis expiré",
     message: "Le devis de Plomberie Martin a expiré (validité 30 jours)"
   }
   ```
   
   **À l'artisan** :
   ```typescript
   {
     type: "devis_expire",
     title: "Devis expiré",
     message: "Votre devis pour Jean Dupont a expiré sans réponse"
   }
   ```

**Fichiers concernés** :
- Cloud Function (à implémenter) : `functions/src/checkExpiredDevis.ts`
- Alternative actuelle : Vérification client-side dans `devis-service.ts`

**Actions post-expiration** :
- Client peut contacter artisan pour renouveler
- Artisan peut créer nouveau devis avec prix actualisé

---

## 5. SCÉNARIOS DE SIGNATURE

### 🔹 Scénario 5.1 : Client Signe le Devis Accepté

**Contexte** : Après acceptation devis (Scénario 4.2).

**Étapes** :
1. **Modal signature** s'affiche automatiquement :
   ```
   ══════════════════════════════════════
   📝 SIGNATURE ÉLECTRONIQUE
   ══════════════════════════════════════
   
   Devis : DEV-2026-001
   Artisan : Plomberie Martin
   Montant : 168€ TTC
   
   ⚠️ En signant, vous acceptez :
   - Les conditions générales de vente
   - Le délai de réalisation (48h)
   - Le montant total (168€ TTC)
   
   ══════════════════════════════════════
   
   ✍️ Signez avec votre souris/doigt :
   
   ┌─────────────────────────────────────┐
   │                                      │
   │     [Zone de dessin signature]       │
   │                                      │
   └─────────────────────────────────────┘
   
   [🗑️ Effacer] [❌ Annuler] [✅ Valider signature]
   ```

2. **Client** dessine sa signature
3. **Client** clique "✅ Valider signature"

4. **Système** enregistre signature :
   ```typescript
   devis/{devisId}: {
     statut: "signe",
     signature: {
       data: "data:image/png;base64,iVBORw0KGgo...", // Image base64
       signedAt: Timestamp,
       signataireName: "Jean Dupont",
       ipAddress: "192.168.1.1",
       userAgent: "Mozilla/5.0..."
     }
   }
   ```

5. **Système** envoie notification artisan :
   ```typescript
   {
     type: "devis_signe",
     title: "✍️ Devis signé",
     message: "Jean Dupont a signé le devis. En attente de paiement."
   }
   ```

6. **Client** redirigé vers modal paiement (Scénario 6.1)

**Fichiers concernés** :
- `frontend/src/components/SignatureModal.tsx`
- `frontend/src/lib/firebase/devis-service.ts` → `signDevis()`

**Valeur légale** :
- ✅ Signature horodatée
- ✅ IP + User-Agent enregistrés (traçabilité)
- ✅ Conforme réglementation signature électronique

---

## 6. SCÉNARIOS DE PAIEMENT

### 🔹 Scénario 6.1 : Client Paie via Stripe (Succès)

**Contexte** : Après signature devis (Scénario 5.1).

**Étapes** :
1. **Modal paiement Stripe** s'affiche :
   ```
   ══════════════════════════════════════
   💳 PAIEMENT SÉCURISÉ
   ══════════════════════════════════════
   
   Montant : 168,00 €
   Artisan : Plomberie Martin
   
   🔒 Paiement sécurisé par Stripe
   
   ══════════════════════════════════════
   
   💳 Informations de paiement :
   
   Numéro de carte :
   ┌─────────────────────────────────────┐
   │ 4242 4242 4242 4242                 │ 🔒
   └─────────────────────────────────────┘
   
   Date expiration :          CVC :
   ┌──────────┐               ┌──────┐
   │ 12 / 26  │               │ 123  │
   └──────────┘               └──────┘
   
   Nom sur la carte :
   ┌─────────────────────────────────────┐
   │ JEAN DUPONT                         │
   └─────────────────────────────────────┘
   
   ⚠️ Le montant sera retenu en séquestre
   jusqu'à validation des travaux.
   
   [Annuler] [💳 Payer 168€]
   ```

2. **Client** saisit coordonnées bancaires
3. **Client** clique "💳 Payer 168€"

4. **Frontend** appelle Stripe API :
   ```typescript
   const paymentIntent = await stripe.confirmCardPayment(clientSecret, {
     payment_method: {
       card: cardElement,
       billing_details: { name: "Jean Dupont" }
     }
   });
   ```

5. **Stripe** valide le paiement :
   ```typescript
   {
     status: "succeeded",
     amount: 16800, // En centimes
     currency: "eur"
   }
   ```

6. **Système** met à jour devis :
   ```typescript
   devis/{devisId}: {
     statut: "paye",
     paiement: {
       montant: 168,
       paymentIntentId: "pi_3ABC123...",
       paymentMethod: "card",
       last4: "4242",
       status: "succeeded",
       paidAt: Timestamp,
       transferTo: "artisan-xyz789", // Bénéficiaire final
       holdUntil: Timestamp (validation travaux + 48h)
     }
   }
   ```

7. **Système** crée contrat :
   ```typescript
   {
     id: "contrat-001",
     devisId: "devis-001",
     clientId: "client-abc123",
     artisanId: "artisan-xyz789",
     statut: "en_attente_travaux",
     montantTotal: 168,
     dateCreation: Timestamp,
     conditions: "Paiement en séquestre jusqu'à validation"
   }
   ```

8. **Système** envoie notifications :
   
   **Au client** :
   ```typescript
   {
     type: "paiement_confirme",
     title: "✅ Paiement confirmé",
     message: "168€ retenu en sécurité jusqu'à fin des travaux"
   }
   ```
   
   **À l'artisan** :
   ```typescript
   {
     type: "paiement_recu",
     title: "💰 Paiement reçu",
     message: "Jean Dupont a payé 168€. Vous pouvez démarrer les travaux."
   }
   ```

9. **📧 EMAIL CLIENT (Gmail SMTP)** :
   ```
   À : jean.dupont@gmail.com
   Objet : ✅ Paiement confirmé - Plomberie Martin (168€)
   
   Bonjour Jean Dupont,
   
   ✅ Votre paiement a été confirmé avec succès !
   
   💳 Récapitulatif :
   - Montant payé : 168,00 € TTC
   - Artisan : Plomberie Martin
   - Prestation : Fuite d'eau sous évier
   - Moyen de paiement : Carte bancaire •••• 4242
   - Date : 19 février 2026 à 10:30
   
   🔒 Sécurité de votre paiement :
   Le montant est retenu en séquestre sécurisé jusqu'à validation des travaux.
   L'artisan NE recevra le paiement qu'après votre validation.
   
   📋 Prochaines étapes :
   1. L'artisan démarre les travaux (délai : 48h)
   2. L'artisan déclare la fin des travaux
   3. Vous validez les travaux (ou signalez un problème)
   4. Le paiement est transféré à l'artisan
   
   👉 Suivez l'avancement :
   https://artisandispo.fr/client/devis/devis-001
   
   💡 Rappel :
   Vous aurez 7 jours pour valider les travaux après leur fin.
   Validation automatique si aucune action.
   
   Cordialement,
   L'équipe ArtisanDispo
   ```

10. **📧 EMAIL ARTISAN (Gmail SMTP)** :
    ```
    À : pierre.martin@plomberie.fr
    Objet : 💰 Paiement reçu - Jean Dupont (168€)
    
    Bonjour Pierre Martin,
    
    💰 Le client a effectué le paiement !
    
    💳 Récapitulatif :
    - Montant : 168,00 € TTC
    - Client : Jean Dupont
    - Prestation : Fuite d'eau sous évier
    - Adresse : 12 rue de la Paix, Paris 75001
    - Date paiement : 19 février 2026 à 10:30
    
    🚀 Vous pouvez maintenant démarrer les travaux !
    
    ⏰ Délai promis : Intervention sous 48h
    
    📋 Rappel des prestations :
    - Déplacement et diagnostic
    - Remplacement joint siphon
    - Main d'œuvre réparation (1h)
    
    👉 Déclarez le démarrage des travaux :
    https://artisandispo.fr/artisan/devis/devis-001
    
    💡 Important :
    Le paiement est en séquestre sécurisé. Vous recevrez les fonds (168€)
    après validation des travaux par le client (délai : 7 jours + 48h).
    
    Bon courage avec votre intervention !
    
    L'équipe ArtisanDispo
    ```

11. **Client** redirigé vers `/client/devis/[id]`
10. **Page** affiche nouveau statut : 🟢 "Payé - Travaux en attente de démarrage"

**Fichiers concernés** :
- `frontend/src/components/StripePaymentModal.tsx`
- `frontend/src/lib/stripe-service.ts` → `createPaymentIntent()`
- `backend/src/routes/stripe.routes.ts`

**Sécurité Stripe** :
- ✅ Montant en séquestre (escrow)
- ✅ Transfert artisan seulement après validation travaux
- ✅ 3D Secure activé (authentification bancaire)

---

### 🔹 Scénario 6.2 : Paiement Échoue (Carte Refusée)

**Étapes** :
1. **Client** saisit carte bancaire
2. **Client** clique "💳 Payer 168€"
3. **Stripe** refuse la transaction :
   ```typescript
   {
     status: "failed",
     error: {
       code: "card_declined",
       message: "Votre carte a été refusée"
     }
   }
   ```

4. **Système** affiche erreur :
   ```
   ❌ Paiement refusé
   
   Votre carte a été refusée par votre banque.
   
   Raisons possibles :
   - Fonds insuffisants
   - Carte expirée
   - Limite de paiement atteinte
   
   Veuillez :
   - Vérifier vos informations bancaires
   - Contacter votre banque
   - Essayer une autre carte
   
   [Réessayer] [Annuler]
   ```

5. **Statut devis** reste "signe" (pas de changement)
6. **Client** peut réessayer ou annuler

**Fichiers concernés** :
- `frontend/src/lib/stripe-service.ts` → Gestion erreurs Stripe

**Erreurs possibles** :
- `card_declined` - Carte refusée
- `insufficient_funds` - Fonds insuffisants
- `expired_card` - Carte expirée
- `incorrect_cvc` - CVC incorrect
- `processing_error` - Erreur technique

---

### 🔹 Scénario 6.3 : Client Veut Annuler Après Paiement

**Contexte** : Client a payé mais veut annuler avant démarrage travaux.

**Étapes** :
1. **Client** accède à `/client/devis/[id]`
2. **Client** voit statut 🟢 "Payé - Travaux en attente"
3. **Client** clique "🗑️ Annuler et demander remboursement"
4. **Système** affiche conditions :
   ```
   ⚠️ Demande d'annulation
   
   Statut actuel : Payé (168€ en séquestre)
   Travaux : Pas encore démarrés
   
   Conditions d'annulation :
   - Remboursement intégral si travaux non démarrés
   - Frais de 5% si artisan a déjà préparé matériel
   
   Confirmez-vous l'annulation ?
   
   [Non, garder] [Oui, annuler]
   ```

5. **Client** confirme

6. **Système** met à jour :
   ```typescript
   devis/{devisId}: {
     statut: "annule_par_client",
     annulation: {
       date: Timestamp,
       motif: "Client a changé d'avis",
       remboursementStatus: "pending"
     }
   }
   ```

7. **Système** initie remboursement Stripe :
   ```typescript
   const refund = await stripe.refunds.create({
     payment_intent: "pi_3ABC123...",
     amount: 16800, // Remboursement total
     reason: "requested_by_customer"
   });
   ```

8. **Système** envoie notifications :
   
   **Au client** :
   ```typescript
   {
     title: "✅ Annulation confirmée",
     message: "Remboursement de 168€ en cours (2-5 jours ouvrés)"
   }
   ```
   
   **À l'artisan** :
   ```typescript
   {
     title: "⚠️ Devis annulé",
     message: "Jean Dupont a annulé le devis. Aucun paiement ne sera transféré."
   }
   ```

**Fichiers concernés** :
- `frontend/src/lib/stripe-service.ts` → `refundPayment()`

**Règles métier** :
- ✅ Remboursement intégral si `statut === "paye"` (travaux non démarrés)
- ❌ Impossible si `statut === "en_cours"` (travaux commencés)
- ⚠️ Médiation admin si litige

---

## 7. SCÉNARIOS DE RÉALISATION TRAVAUX

### 🔹 Scénario 7.1 : Artisan Démarre les Travaux

**Contexte** : Après paiement client (Scénario 6.1).

**Étapes** :
1. **Artisan** reçoit notification "💰 Paiement reçu - Vous pouvez démarrer"
2. **Artisan** accède à `/artisan/devis/[id]`
3. **Artisan** voit section :
   ```
   ══════════════════════════════════════
   🟢 DEVIS PAYÉ - PRÊT À DÉMARRER
   ══════════════════════════════════════
   
   Client : Jean Dupont
   Montant : 168€ (en séquestre)
   Adresse : 12 rue de la Paix, Paris 75001
   
   📋 Prestations à réaliser :
   - Déplacement et diagnostic
   - Remplacement joint siphon
   - Main d'œuvre réparation (1h)
   
   ⏱️ Délai promis : Intervention sous 48h
   
   [🚀 Démarrer les travaux]
   ```

4. **Artisan** clique "🚀 Démarrer les travaux"

5. **Système** affiche confirmation :
   ```
   ⚠️ Démarrage des travaux
   
   En démarrant les travaux :
   - Vous vous engagez à respecter le devis
   - Le client sera notifié
   - Vous pourrez déclarer la fin une fois terminé
   
   Date de démarrage : Aujourd'hui, 19 février 2026
   
   [Annuler] [✅ Confirmer le démarrage]
   ```

6. **Artisan** confirme

7. **Système** met à jour devis :
   ```typescript
   devis/{devisId}: {
     statut: "en_cours",
     travaux: {
       dateDebut: Timestamp,
       statut: "en_cours",
       artisanId: "artisan-xyz789"
     }
   }
   ```

8. **Système** envoie notification client :
   ```typescript
   {
     type: "travaux_demarres",
     title: "🚀 Travaux démarrés",
     message: "Plomberie Martin a commencé les travaux"
   }
   ```

9. **Artisan** redirigé vers `/artisan/devis/[id]`
10. **Page** affiche : 🟤 "Travaux en cours depuis le 19 février 2026"

**Fichiers concernés** :
- `frontend/src/lib/firebase/devis-service.ts` → `demarrerTravaux()`

**Impact** :
- Client ne peut plus annuler (travaux commencés)
- Artisan engage sa responsabilité professionnelle

---

### 🔹 Scénario 7.2 : Artisan Déclare Fin des Travaux

**Contexte** : Artisan a terminé l'intervention.

**Étapes** :
1. **Artisan** termine la réparation (changement joint siphon)
2. **Artisan** accède à `/artisan/devis/[id]`
3. **Artisan** clique "✅ Déclarer la fin des travaux"

4. **Système** affiche formulaire :
   ```
   ══════════════════════════════════════
   ✅ DÉCLARATION DE FIN DE TRAVAUX
   ══════════════════════════════════════
   
   📅 Date de fin :
   ┌──────────────────┐
   │ 19/02/2026 15:30 │ (Aujourd'hui)
   └──────────────────┘
   
   📝 Commentaire (optionnel) :
   ┌─────────────────────────────────────┐
   │ Réparation effectuée. Joint siphon  │
   │ remplacé. Fuite résolue. Aucun      │
   │ problème détecté.                   │
   └─────────────────────────────────────┘
   
   📸 Photos des travaux (optionnel) :
   [📷 Ajouter photo avant]
   [📷 Ajouter photo après]
   
   ⚠️ En déclarant la fin :
   - Le client aura 7 jours pour valider
   - Validation automatique après 7 jours si pas de réponse
   - Vous recevrez le paiement après validation
   
   [Annuler] [✅ Confirmer la fin des travaux]
   ```

5. **Artisan** ajoute commentaire + photos
6. **Artisan** confirme

7. **Système** met à jour devis :
   ```typescript
   devis/{devisId}: {
     statut: "travaux_termines",
     travaux: {
       dateDebut: Timestamp(19/02 09:00),
       dateFin: Timestamp(19/02 15:30),
       statut: "termines",
       commentaireArtisan: "Réparation effectuée...",
       photosApres: [
         "https://storage.googleapis.com/.../photo1.jpg",
         "https://storage.googleapis.com/.../photo2.jpg"
       ],
       dateValidationAuto: Timestamp(26/02 15:30) // +7 jours
     }
   }
   ```

8. **Système** envoie notification client :
   ```typescript
   {
     type: "travaux_termines",
     title: "✅ Travaux terminés",
     message: "Plomberie Martin a déclaré avoir terminé. Validez sous 7 jours."
   }
   ```

9. **📧 EMAIL CLIENT (Gmail SMTP)** :
   ```
   À : jean.dupont@gmail.com
   Objet : ✅ Travaux terminés - Validation requise - Plomberie Martin
   
   Bonjour Jean Dupont,
   
   ✅ L'artisan a déclaré avoir terminé les travaux !
   
   🏢 Artisan : Plomberie Martin
   📋 Prestation : Fuite d'eau sous évier
   📅 Date de fin : 19 février 2026 à 15:30
   
   💬 Commentaire de l'artisan :
   "Réparation effectuée. Joint siphon remplacé. Fuite résolue. Aucun problème détecté."
   
   📸 Photos des travaux disponibles
   
   ⚠️ ACTION REQUISE :
   
   Vous avez 7 JOURS pour valider ou signaler un problème.
   
   🕒 Date limite : 26 février 2026 à 15:30
   ⏰ Si aucune action : validation automatique après 7 jours
   
   👉 Validez les travaux maintenant :
   https://artisandispo.fr/client/devis/devis-001
   
   💡 Deux options :
   ✅ Valider les travaux → Paiement transféré à l'artisan sous 48h
   ⚠️ Signaler un problème → Notre équipe intervient comme médiateur
   
   💰 Rappel :
   Le paiement (168€) est toujours en séquestre sécurisé.
   Il sera transféré à l'artisan uniquement après votre validation.
   
   Cordialement,
   L'équipe ArtisanDispo
   ```

10. **Artisan** voit message :
   ```
   ✅ Fin de travaux déclarée
   
   Statut : En attente de validation client
   Validation automatique le : 26 février 2026 à 15:30
   
   Le paiement (168€) sera transféré après validation.
   ```

**Fichiers concernés** :
- `frontend/src/lib/firebase/devis-service.ts` → `declarerFinTravaux()`

**Règles métier** :
- ✅ Client a 7 JOURS pour valider ou signaler problème
- ✅ Validation AUTO après 7 jours si aucune action
- ✅ Photos = preuve pour éviter litiges

---

## 8. SCÉNARIOS DE VALIDATION TRAVAUX

### 🔹 Scénario 8.1 : Client Valide les Travaux

**Contexte** : Artisan a déclaré fin (Scénario 7.2).

**Étapes** :
1. **Client** reçoit notification "✅ Travaux terminés - Validez sous 7 jours"
2. **Client** clique sur notification → `/client/devis/[id]`
3. **Client** voit section :
   ```
   ══════════════════════════════════════
   ✅ TRAVAUX TERMINÉS - VALIDATION REQUISE
   ══════════════════════════════════════
   
   🏢 Artisan : Plomberie Martin
   📅 Date de fin : 19 février 2026 à 15:30
   
   💬 Commentaire artisan :
   "Réparation effectuée. Joint siphon remplacé.
   Fuite résolue. Aucun problème détecté."
   
   📸 Photos :
   [Avant]  [Après]
   
   ══════════════════════════════════════
   
   Vous avez 7 JOURS pour valider ou signaler un problème.
   
   🕒 Validation automatique le : 26 février 2026 à 15:30
   
   💡 Que se passe-t-il ensuite ?
   • Si vous validez : l'artisan reçoit le paiement sous 24-48h
   • Si vous signalez un problème : notre équipe intervient
   • Si aucune action : validation automatique après 7 jours
   
   ══════════════════════════════════════
   
   [✅ Valider les travaux]  [⚠️ Signaler un problème]
   ```

4. **Client** inspecte les travaux (fuite résolue ✅)
5. **Client** clique "✅ Valider les travaux"

6. **Système** affiche confirmation :
   ```
   ⚠️ Validation des travaux
   
   En validant :
   - Vous confirmez que les travaux sont conformes
   - Le paiement (168€) sera transféré à l'artisan sous 48h
   - Vous pourrez laisser un avis après validation
   
   [Annuler] [✅ Je valide les travaux]
   ```

7. **Client** confirme

8. **Système** met à jour devis :
   ```typescript
   devis/{devisId}: {
     statut: "termine_valide",
     travaux: {
       ...existingData,
       dateValidationClient: Timestamp,
       validePar: "client",
       statutValidation: "valide_manuellement"
     }
   }
   ```

9. **Système** déclenche transfert Stripe :
   ```typescript
   const transfer = await stripe.transfers.create({
     amount: 16800,
     currency: "eur",
     destination: "artisan_stripe_account_id",
     transfer_group: "devis-001"
   });
   ```

10. **Système** envoie notifications :
    
    **Au client** :
    ```typescript
    {
      type: "travaux_valides",
      title: "✅ Travaux validés",
      message: "Paiement transféré à Plomberie Martin. Vous pouvez maintenant laisser un avis."
    }
    ```
    
    **⭐ NOTIFICATION AVIS (NOUVELLE)** :
    ```typescript
    {
      type: "demande_avis_express",
      title: "⭐ Donnez votre avis !",
      message: "Partagez votre expérience avec Plomberie Martin",
      relatedId: "devis-001"
    }
    ```
    
    **À l'artisan** :
    ```typescript
    {
      type: "paiement_transfere",
      title: "💰 Paiement transféré",
      message: "168€ transférés sur votre compte. Disponible sous 2-5 jours."
    }
    ```

11. **📧 EMAIL ARTISAN (Gmail SMTP)** :
    ```
    À : pierre.martin@plomberie.fr
    Objet : 💰 Paiement transféré - Jean Dupont (168€)
    
    Bonjour Pierre Martin,
    
    🎉 Excellente nouvelle !
    
    Le client a validé les travaux et le paiement a été transféré sur votre compte.
    
    💰 Transfert bancaire :
    - Montant : 168,00 € TTC
    - Client : Jean Dupont
    - Prestation : Fuite d'eau sous évier
    - Date validation : 19 février 2026 à 16:45
    - Date transfert : 19 février 2026 à 16:50
    
    🏦 Disponibilité des fonds :
    Les fonds seront disponibles sur votre compte bancaire sous 2 à 5 jours ouvrés.
    
    ✅ Détails du transfert :
    - ID transfert : tr_3ABC123XYZ
    - Statut : Transféré avec succès
    
    👉 Consultez votre historique de paiements :
    https://artisandispo.fr/artisan/paiements
    
    ⭐ Le client peut maintenant laisser un avis sur votre travail.
    
    Félicitations pour cette prestation réussie !
    
    L'équipe ArtisanDispo
    ```

12. **Client** redirigé vers `/client/devis/[id]` avec nouveau statut
12. **Page** affiche :
    ```
    🎉 TRAVAUX VALIDÉS
    
    ✅ Validation effectuée le 19 février 2026
    💰 Paiement transféré à l'artisan
    
    ⭐ Vous pouvez maintenant donner votre avis
    
    [⭐ Donner mon avis maintenant]
    ```

**Fichiers concernés** :
- `frontend/src/lib/firebase/devis-service.ts` → `validerTravaux()`
- `backend/src/services/stripe.service.ts` → Transfert paiement

**Impact** :
- ✅ Artisan reçoit paiement sous 48h
- ✅ Client peut maintenant laisser un avis (Scénario 9)
- ✅ Badge navigation 🟡 "+1 avis en attente" apparaît

---

### 🔹 Scénario 8.2 : Client Signale un Problème (Litige)

**Contexte** : Travaux non conformes ou problème détecté.

**Étapes** :
1. **Client** consulte page `/client/devis/[id]`
2. **Client** clique "⚠️ Signaler un problème"

3. **Système** affiche formulaire litige :
   ```
   ══════════════════════════════════════
   ⚠️ SIGNALEMENT DE PROBLÈME
   ══════════════════════════════════════
   
   Type de problème :
   
   [  ] Travaux non conformes au devis
   [  ] Malfaçons détectées
   [  ] Problème non résolu
   [  ] Dégâts causés pendant travaux
   [  ] Autre
   
   📝 Description détaillée (obligatoire) :
   ┌─────────────────────────────────────┐
   │ La fuite n'est pas résolue. L'eau    │
   │ continue de couler sous l'évier.     │
   │ Le joint installé semble défectueux. │
   └─────────────────────────────────────┘
   
   📸 Photos du problème (recommandé) :
   [📷 Ajouter photo]
   
   ⚠️ Conséquences du signalement :
   - Le paiement reste bloqué en séquestre
   - Notre équipe contacte l'artisan
   - Médiation pour résolution amiable
   - Remboursement possible si non résolu
   
   [Annuler] [⚠️ Confirmer le signalement]
   ```

4. **Client** sélectionne "Problème non résolu" + ajoute description + photo
5. **Client** confirme

6. **Système** met à jour devis :
   ```typescript
   devis/{devisId}: {
     statut: "litige",
     litige: {
       dateSignalement: Timestamp,
       motif: "Problème non résolu",
       description: "La fuite n'est pas résolue...",
       photos: ["https://storage.googleapis.com/.../litige1.jpg"],
       signalePar: "client",
       statut: "ouvert"
     },
     travaux: {
       ...existingData,
       dateValidationAuto: null // Annule validation auto
     }
   }
   ```

7. **Système** envoie notifications :
   
   **Au client** :
   ```typescript
   {
     type: "litige_enregistre",
     title: "⚠️ Problème enregistré",
     message: "Notre équipe va contacter Plomberie Martin pour résolution."
   }
   ```
   
   **À l'artisan** :
   ```typescript
   {
     type: "litige_signale",
     title: "⚠️ Problème signalé",
     message: "Jean Dupont a signalé : Problème non résolu. Paiement bloqué.",
     relatedId: "devis-001"
   }
   ```
   
   **À l'admin** :
   ```typescript
   {
     type: "nouveau_litige",
     title: "⚠️ Nouveau litige",
     message: "Devis DEV-2026-001 - Client vs Plomberie Martin"
   }
   ```

8. **📧 EMAIL CLIENT (Gmail SMTP)** :
   ```
   À : jean.dupont@gmail.com
   Objet : ⚠️ Litige enregistré - Plomberie Martin - Intervention support
   
   Bonjour Jean Dupont,
   
   ⚠️ Votre signalement de problème a bien été enregistré.
   
   📋 Récapitulatif du litige :
   - Artisan : Plomberie Martin
   - Devis : DEV-2026-001
   - Montant : 168,00 € (en séquestre)
   - Motif : Problème non résolu
   - Date signalement : 19 février 2026 à 17:00
   
   💬 Votre description :
   "La fuite n'est pas résolue. L'eau continue de couler sous l'évier. Le joint installé semble défectueux."
   
   🔒 Protection de votre paiement :
   Le montant (168€) reste BLOQUÉ en séquestre sécurisé.
   L'artisan NE recevra PAS le paiement tant que le litige n'est pas résolu.
   
   📞 Prochaines étapes :
   1. Notre équipe va contacter l'artisan sous 24h
   2. Nous allons proposer une solution amiable
   3. Options possibles :
      - Nouvelle intervention de l'artisan (gratuite)
      - Remboursement partiel
      - Remboursement intégral si non résolu
   
   💡 Nous restons à votre disposition :
   - Email : support@artisandispo.fr
   - Téléphone : +33 1 XX XX XX XX
   
   👉 Suivez la résolution du litige :
   https://artisandispo.fr/client/litiges/litige-001
   
   Nous mettons tout en œuvre pour résoudre votre problème rapidement.
   
   Cordialement,
   L'équipe ArtisanDispo - Service Médiation
   ```

9. **📧 EMAIL ARTISAN (Gmail SMTP)** :
   ```
   À : pierre.martin@plomberie.fr
   Objet : ⚠️ Litige signalé - Jean Dupont - Action requise
   
   Bonjour Pierre Martin,
   
   ⚠️ Le client a signalé un problème sur le devis DEV-2026-001.
   
   📋 Récapitulatif :
   - Client : Jean Dupont
   - Devis : DEV-2026-001
   - Montant : 168,00 € (BLOQUÉ en séquestre)
   - Motif : Problème non résolu
   - Date signalement : 19 février 2026 à 17:00
   
   💬 Description du client :
   "La fuite n'est pas résolue. L'eau continue de couler sous l'évier. Le joint installé semble défectueux."
   
   📸 Photo jointe par le client : [Voir la photo]
   
   🔒 Statut du paiement :
   Le paiement (168€) est SUSPENDU jusqu'à résolution du litige.
   
   📞 Action requise :
   Notre équipe va vous contacter sous 24h pour trouver une solution.
   
   💡 Solutions possibles :
   ✅ Nouvelle intervention gratuite pour corriger le problème
   ✅ Accord remboursement partiel
   ✅ Médiation amiable
   
   👉 Consultez le litige et proposez une solution :
   https://artisandispo.fr/artisan/litiges/litige-001
   
   ⚠️ Important :
   Une résolution rapide et professionnelle améliore votre réputation sur la plateforme.
   
   Contactez-nous vite :
   - Email : support@artisandispo.fr
   - Téléphone : +33 1 XX XX XX XX
   
   Cordialement,
   L'équipe ArtisanDispo - Service Médiation
   ```

10. **Admin** intervient comme médiateur :
   - Contacte client + artisan
   - Propose solutions (nouvelle intervention, remboursement partiel)
   - Suit résolution

**Fichiers concernés** :
- `frontend/src/lib/firebase/litige-service.ts` → `signalerProbleme()`
- Admin dashboard : `/admin/litiges`

**Résolutions possibles** :
- ✅ Artisan refait intervention → Client valide → Paiement transféré
- ✅ Accord remboursement partiel → Résolution amiable
- ❌ Aucun accord → Remboursement intégral client

---

### 🔹 Scénario 8.3 : Validation Automatique (7 jours sans action)

**Contexte** : Client n'a ni validé ni signalé de problème.

**Étapes** :
1. **J+0** : Artisan déclare fin travaux (19 février 2026 à 15:30)
2. **J+1 à J+6** : Client ne fait aucune action
3. **J+7** : 26 février 2026 à 15:30 (date de validation auto)

4. **Cloud Function** (tâche automatique) :
   ```typescript
   // Exécutée toutes les heures
   const devisAValiderAuto = await db.collection('devis')
     .where('statut', '==', 'travaux_termines')
     .where('travaux.dateValidationAuto', '<=', new Date())
     .get();
   
   for (const doc of devisAValiderAuto.docs) {
     await validerAutomatiquement(doc.id);
   }
   ```

5. **Système** met à jour devis :
   ```typescript
   devis/{devisId}: {
     statut: "termine_auto_valide",
     travaux: {
       ...existingData,
       dateValidationClient: Timestamp,
       validePar: "auto",
       statutValidation: "valide_automatiquement"
     }
   }
   ```

6. **Système** transfère paiement Stripe (identique Scénario 8.1)

7. **Système** envoie notifications :
   
   **Au client** :
   ```typescript
   {
     type: "validation_automatique",
     title: "✅ Travaux validés automatiquement",
     message: "Validation automatique après 7 jours. Paiement transféré à l'artisan."
   }
   ```
   
   **+ Notification avis** :
   ```typescript
   {
     type: "demande_avis_express",
     title: "⭐ Donnez votre avis !",
     message: "Partagez votre expérience avec Plomberie Martin"
   }
   ```
   
   **À l'artisan** :
   ```typescript
   {
     type: "paiement_transfere",
     title: "💰 Paiement transféré (validation auto)",
     message: "168€ transférés après 7 jours. Disponible sous 2-5 jours."
   }
   ```

8. **📧 EMAIL CLIENT (Gmail SMTP)** :
   ```
   À : jean.dupont@gmail.com
   Objet : ✅ Validation automatique - Paiement transféré - Plomberie Martin
   
   Bonjour Jean Dupont,
   
   ✅ Les travaux ont été validés automatiquement.
   
   📋 Récapitulatif :
   - Artisan : Plomberie Martin
   - Prestation : Fuite d'eau sous évier
   - Montant : 168,00 € TTC
   - Date fin travaux : 19 février 2026
   - Date validation auto : 26 février 2026 (7 jours écoulés)
   
   💰 Statut du paiement :
   Le paiement (168€) a été transféré à l'artisan car vous n'avez signalé aucun problème.
   
   💡 Pourquoi cette validation automatique ?
   Vous aviez 7 jours pour valider ou signaler un problème.
   Aucune action n'ayant été effectuée, nous avons considéré que les travaux étaient conformes.
   
   ⭐ Donnez votre avis maintenant !
   Partagez votre expérience avec Plomberie Martin pour aider d'autres clients.
   
   👉 Laissez un avis (délai : 30 jours) :
   https://artisandispo.fr/client/avis/nouveau?devisId=devis-001
   
   ⚠️ Problème après validation ?
   Si vous constatez un problème maintenant, contactez notre support :
   support@artisandispo.fr
   
   Merci d'utiliser ArtisanDispo !
   
   L'équipe ArtisanDispo
   ```

9. **📧 EMAIL ARTISAN (Gmail SMTP)** :
   ```
   À : pierre.martin@plomberie.fr
   Objet : 💰 Paiement transféré (validation auto) - Jean Dupont (168€)
   
   Bonjour Pierre Martin,
   
   🎉 Excellente nouvelle !
   
   Les travaux ont été validés automatiquement et le paiement a été transféré.
   
   💰 Transfert bancaire :
   - Montant : 168,00 € TTC
   - Client : Jean Dupont
   - Prestation : Fuite d'eau sous évier
   - Date fin travaux : 19 février 2026
   - Date validation : 26 février 2026 (validation automatique après 7 jours)
   - Date transfert : 26 février 2026
   
   🏦 Disponibilité des fonds :
   Les fonds seront disponibles sur votre compte bancaire sous 2 à 5 jours ouvrés.
   
   ✅ Détails du transfert :
   - ID transfert : tr_3ABC456XYZ
   - Statut : Transféré avec succès (validation automatique)
   
   💡 Qu'est-ce que la validation automatique ?
   Le client avait 7 jours pour valider ou signaler un problème.
   Aucune action n'ayant été effectuée, le système a validé automatiquement.
   
   👉 Consultez votre historique de paiements :
   https://artisandispo.fr/artisan/paiements
   
   ⭐ Le client peut maintenant laisser un avis sur votre travail.
   
   Félicitations pour cette prestation !
   
   L'équipe ArtisanDispo
   ```

**Fichiers concernés** :
- Cloud Function : `functions/src/autoValidateDevis.ts`
- `frontend/src/lib/firebase/devis-service.ts` → `validerTravaux()`

**Logique métier** :
- ✅ Protection artisan (paiement garanti si client ne répond pas)
- ✅ Incitation client à valider rapidement (7 jours raisonnables)
- ✅ Même notifications avis que validation manuelle

---

## 9. SCÉNARIOS D'AVIS CLIENT

### 🔹 Scénario 9.1 : Client Voit Invitation Avis (Badge + Bouton)

**Contexte** : Après validation travaux (Scénario 8.1 ou 8.3).

**Étapes** :
1. **Client** navigue dans l'application
2. **Badge jaune** apparaît dans navigation :
   ```
   ┌─────────────────────┐
   │  Mes avis  🟡 1     │
   └─────────────────────┘
   ```

3. **Client** consulte `/client/devis/[id]` (devis validé)
4. **Page** affiche section invitation :
   ```
   ══════════════════════════════════════
   ⭐ DONNEZ VOTRE AVIS
   ══════════════════════════════════════
   
   🎉 Travaux terminés et validés !
   
   Votre avis aide d'autres clients à choisir
   le bon artisan.
   
   📅 Créé le : 19 février 2026
   📅 Donnez votre avis avant le : 21 mars 2026
   
   [⭐ Donner mon avis maintenant]
   
   OU
   
   ✅ Avis déjà donné (si déjà fait)
   ```

**Fichiers concernés** :
- `frontend/src/hooks/useContratsANoter.ts` → Compteur avis en attente
- `frontend/src/components/UserMenu.tsx` → Badge jaune
- `frontend/src/app/client/devis/[id]/page.tsx` → Section invitation

**Déclencheurs** :
- ✅ Notification `demande_avis_express` envoyée après validation
- ✅ Badge compteur mis à jour via `useContratsANoter()`
- ✅ Expiration automatique après 30 jours

---

### 🔹 Scénario 9.2 : Client Donne un Avis (Note + Commentaire)

**Étapes** :
1. **Client** clique "⭐ Donner mon avis maintenant"
2. **Système** redirige vers `/client/avis/nouveau?devisId=devis-001`

3. **Formulaire avis** s'affiche :
   ```
   ══════════════════════════════════════
   ⭐ VOTRE AVIS SUR PLOMBERIE MARTIN
   ══════════════════════════════════════
   
   Devis : Fuite d'eau sous évier
   Montant : 168€
   Date des travaux : 19 février 2026
   
   ══════════════════════════════════════
   
   ⭐ Note générale (obligatoire) :
   
   ☆ ☆ ☆ ☆ ☆  (Cliquez pour noter)
   
   ══════════════════════════════════════
   
   📝 Votre commentaire (optionnel) :
   
   ┌─────────────────────────────────────┐
   │ Très bon artisan, ponctuel et       │
   │ professionnel. Travail soigné,      │
   │ fuite résolue rapidement. Je        │
   │ recommande vivement !               │
   └─────────────────────────────────────┘
   
   ══════════════════════════════════════
   
   📸 Photos (optionnel) :
   [📷 Ajouter des photos]
   
   ══════════════════════════════════════
   
   ⚠️ Rappel :
   - Votre avis sera visible publiquement
   - Soyez honnête et constructif
   - Évitez les propos injurieux
   
   [Annuler] [⭐ Publier mon avis]
   ```

4. **Client** sélectionne 5 étoiles ⭐⭐⭐⭐⭐
5. **Client** écrit commentaire positif
6. **Client** ajoute photo du travail fini
7. **Client** clique "⭐ Publier mon avis"

8. **Système** vérifie :
   ```typescript
   // Anti-doublon
   const avisExiste = await getAvisByContratId(devisId);
   if (avisExiste) {
     throw new Error("Vous avez déjà donné un avis pour ce devis");
   }
   
   // Expiration 30 jours
   const dateValidation = devis.travaux.dateValidationClient;
   const now = new Date();
   const diff = (now - dateValidation) / (1000 * 60 * 60 * 24);
   if (diff > 30) {
     throw new Error("Délai expiré (max 30 jours après validation)");
   }
   ```

9. **Système** crée document `avis` :
   ```typescript
   {
     id: "avis-001",
     devisId: "devis-001",
     clientId: "client-abc123",
     artisanId: "artisan-xyz789",
     note: 5,
     commentaire: "Très bon artisan, ponctuel et professionnel...",
     photos: ["https://storage.googleapis.com/.../avis-photo1.jpg"],
     createdAt: Timestamp,
     statut: "publie",
     reponseArtisan: null // Pas encore de réponse
   }
   ```

10. **Système** met à jour statistiques artisan :
    ```typescript
    artisans/{artisanId}: {
      stats: {
        nombreAvis: increment(1),  // 5 → 6
        noteMoyenne: recalculate(), // (4.5*5 + 5*1) / 6 = 4.58
        dernierAvis: Timestamp
      }
    }
    ```

11. **Système** envoie notification artisan :
    ```typescript
    {
      recipientId: "artisan-xyz789",
      type: "nouvel_avis",
      title: "⭐ Nouvel avis reçu !",
      message: "Jean Dupont vous a donné 5/5 étoiles",
      relatedId: "avis-001"
    }
    ```

12. **Client** redirigé vers `/client/avis`
13. **Page** affiche :
    ```
    ✅ Avis publié avec succès !
    
    Votre avis aide la communauté à trouver
    les meilleurs artisans. Merci !
    
    [Voir mes avis]
    ```

14. **Badge navigation** disparaît : ~~🟡 1~~ → Plus de badge

**Fichiers concernés** :
- `frontend/src/app/client/avis/nouveau/page.tsx`
- `frontend/src/lib/firebase/avis-service.ts` → `createAvis()`
- `frontend/src/lib/firebase/artisan-stats-service.ts` → Mise à jour stats

**Règles métier** :
- ✅ 1 seul avis par devis (anti-doublon)
- ✅ Délai max 30 jours après validation
- ✅ Note obligatoire (1-5 étoiles)
- ✅ Commentaire optionnel mais recommandé
- ✅ Photos optionnelles

---

### 🔹 Scénario 9.3 : Client Consulte Ses Avis Donnés

**Étapes** :
1. **Client** clique sur "Mes avis" dans navigation
2. **Système** redirige vers `/client/avis`
3. **Page** affiche liste complète :
   ```
   ══════════════════════════════════════
   MES AVIS DONNÉS
   ══════════════════════════════════════
   
   📊 Total : 3 avis donnés
   
   ──────────────────────────────────────
   
   [Carte 1]
   🏢 Plomberie Martin
   ⭐⭐⭐⭐⭐ 5/5
   📅 Donné le : 19 février 2026
   
   💬 Mon avis :
   "Très bon artisan, ponctuel et professionnel.
   Travail soigné, fuite résolue rapidement."
   
   💬 Réponse de l'artisan :
   (Aucune réponse pour le moment)
   
   [Voir détails]
   
   ──────────────────────────────────────
   
   [Carte 2]
   🏢 Électricité Durand
   ⭐⭐⭐⭐☆ 4/5
   📅 Donné le : 10 janvier 2026
   
   💬 Mon avis :
   "Bon travail mais délai un peu long."
   
   💬 Réponse de l'artisan :
   "Merci pour votre retour. Nous avons
   amélioré notre planning depuis."
   
   [Voir détails]
   
   ──────────────────────────────────────
   ```

**Fichiers concernés** :
- `frontend/src/app/client/avis/page.tsx`
- `frontend/src/lib/firebase/avis-service.ts` → `getAvisByClient()`

**Informations affichées** :
- ✅ Artisan concerné
- ✅ Note donnée
- ✅ Commentaire client
- ✅ Date publication
- ✅ Réponse artisan (si existe)
- ✅ Photos uploadées

---

### 🔹 Scénario 9.4 : Avis Expire (30 jours dépassés)

**Contexte** : Client n'a pas donné d'avis dans les 30 jours.

**Étapes** :
1. **J+0** : Validation travaux (19 février 2026)
2. **J+1 à J+29** : Client ne donne pas d'avis
3. **J+30** : 21 mars 2026 (expiration)

4. **Hook `useContratsANoter`** filtre automatiquement :
   ```typescript
   const thirtyDaysAgo = new Date();
   thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
   
   const q = query(
     collection(db, 'devis'),
     where('clientId', '==', clientId),
     where('statut', 'in', ['termine_valide', 'termine_auto_valide']),
     where('travaux.dateValidationClient', '>', Timestamp.fromDate(thirtyDaysAgo))
   );
   ```

5. **Devis expiré** exclu automatiquement de :
   - ❌ Badge compteur navigation
   - ❌ Liste "Contrats à noter"
   - ❌ Bouton "Donner mon avis"

6. **Client** tente d'accéder à `/client/avis/nouveau?devisId=devis-001` (lien ancien)
7. **Système** affiche erreur :
   ```
   ⚠️ Avis non disponible
   
   Le délai pour donner un avis sur ce devis
   est expiré (max 30 jours après validation).
   
   [Retour à mes devis]
   ```

**Fichiers concernés** :
- `frontend/src/hooks/useContratsANoter.ts` → Filtre expiration
- `frontend/src/lib/firebase/avis-service.ts` → Vérification `createAvis()`

**Raisons expiration** :
- ✅ Évite avis trop anciens (mémoire biaisée)
- ✅ Incite client à donner avis rapidement
- ✅ Cohérence temporelle (artisan peut avoir changé)

---

## 10. SCÉNARIOS DE RÉPONSE ARTISAN

### 🔹 Scénario 10.1 : Artisan Voit Nouvel Avis Reçu

**Contexte** : Client a publié avis (Scénario 9.2).

**Étapes** :
1. **Artisan** reçoit notification 🔔 "⭐ Nouvel avis reçu ! Jean Dupont vous a donné 5/5"
2. **Artisan** clique sur notification → `/artisan/avis`

3. **Page** affiche liste avis reçus :
   ```
   ══════════════════════════════════════
   MES AVIS REÇUS
   ══════════════════════════════════════
   
   📊 Note moyenne : 4.58/5 (6 avis)
   ⭐⭐⭐⭐☆
   
   ──────────────────────────────────────
   
   [Carte 1 - NOUVEAU]
   👤 Jean D.
   ⭐⭐⭐⭐⭐ 5/5
   📅 Publié le : 19 février 2026
   
   💬 Commentaire :
   "Très bon artisan, ponctuel et professionnel.
   Travail soigné, fuite résolue rapidement.
   Je recommande vivement !"
   
   📸 Photos : [Photo 1]
   
   💬 Votre réponse :
   (Vous n'avez pas encore répondu)
   
   [💬 Répondre à cet avis]
   
   ──────────────────────────────────────
   
   [Carte 2]
   👤 Marie L.
   ⭐⭐⭐⭐☆ 4/5
   📅 Publié le : 5 février 2026
   
   💬 Commentaire :
   "Bon travail mais prix un peu élevé."
   
   💬 Votre réponse :
   "Merci pour votre retour ! Nos tarifs
   incluent matériel professionnel + garantie."
   
   ──────────────────────────────────────
   ```

**Fichiers concernés** :
- `frontend/src/app/artisan/avis/page.tsx`
- `frontend/src/lib/firebase/avis-service.ts` → `getAvisByArtisan()`

**Informations affichées** :
- ✅ Client (prénom + initiale nom)
- ✅ Note reçue (étoiles)
- ✅ Commentaire client
- ✅ Photos client
- ✅ Date publication
- ✅ Réponse artisan (si déjà faite)

---

### 🔹 Scénario 10.2 : Artisan Répond à un Avis (Commentaire)

**Contexte** : Artisan veut remercier client pour bon avis.

**Étapes** :
1. **Artisan** consulte `/artisan/avis`
2. **Artisan** clique "💬 Répondre à cet avis" sous l'avis de Jean D.

3. **Modal réponse** s'affiche :
   ```
   ══════════════════════════════════════
   💬 RÉPONDRE À L'AVIS
   ══════════════════════════════════════
   
   Avis de : Jean D.
   Note : ⭐⭐⭐⭐⭐ 5/5
   
   "Très bon artisan, ponctuel et professionnel.
   Travail soigné, fuite résolue rapidement.
   Je recommande vivement !"
   
   ══════════════════════════════════════
   
   📝 Votre réponse (publique) :
   
   ┌─────────────────────────────────────┐
   │ Merci beaucoup Jean pour cet avis   │
   │ très positif ! C'était un plaisir   │
   │ de travailler pour vous. N'hésitez  │
   │ pas à me recontacter pour vos       │
   │ prochains travaux de plomberie.     │
   │ Cordialement, Pierre Martin         │
   └─────────────────────────────────────┘
   
   ⚠️ Rappel :
   - Votre réponse sera visible publiquement
   - Vous NE POUVEZ PAS donner d'avis en retour
   - Restez professionnel et courtois
   
   [Annuler] [💬 Publier ma réponse]
   ```

4. **Artisan** écrit réponse professionnelle
5. **Artisan** clique "💬 Publier ma réponse"

6. **Système** vérifie :
   ```typescript
   // Anti-doublon réponse
   const avis = await getAvisById(avisId);
   if (avis.reponseArtisan) {
     throw new Error("Vous avez déjà répondu à cet avis");
   }
   
   // Vérifier propriétaire
   if (avis.artisanId !== currentArtisanId) {
     throw new Error("Vous ne pouvez répondre qu'à vos propres avis");
   }
   ```

7. **Système** met à jour avis :
   ```typescript
   avis/{avisId}: {
     reponseArtisan: {
       texte: "Merci beaucoup Jean pour cet avis...",
       date: Timestamp,
       artisanId: "artisan-xyz789",
       artisanName: "Pierre Martin"
     }
   }
   ```

8. **Système** envoie notification client :
   ```typescript
   {
     recipientId: "client-abc123",
     type: "reponse_avis",
     title: "💬 Réponse à votre avis",
     message: "Plomberie Martin a répondu à votre avis",
     relatedId: "avis-001"
   }
   ```

9. **Artisan** voit confirmation :
   ```
   ✅ Réponse publiée avec succès !
   
   Votre réponse est maintenant visible
   sur votre profil public.
   
   [OK]
   ```

10. **Avis mis à jour** s'affiche :
    ```
    [Carte 1]
    👤 Jean D.
    ⭐⭐⭐⭐⭐ 5/5
    📅 Publié le : 19 février 2026
    
    💬 Commentaire :
    "Très bon artisan, ponctuel et professionnel..."
    
    💬 Réponse de Plomberie Martin :
    📅 19 février 2026 à 17:30
    
    "Merci beaucoup Jean pour cet avis très positif !
    C'était un plaisir de travailler pour vous..."
    ```

**Fichiers concernés** :
- `frontend/src/app/artisan/avis/[id]/page.tsx`
- `frontend/src/lib/firebase/avis-service.ts` → `addReponseArtisan()`

**Règles métier** :
- ✅ Artisan peut UNIQUEMENT répondre (pas donner avis en retour)
- ✅ 1 seule réponse par avis (anti-doublon)
- ✅ Réponse visible publiquement
- ✅ Notification client automatique

---

### 🔹 Scénario 10.3 : Artisan Voit Avis sur Profil Public

**Contexte** : Client consulte profil artisan avant de demander devis.

**Étapes** :
1. **Client potentiel** recherche artisans : `/client/recherche?metier=plomberie`
2. **Client** clique sur "Plomberie Martin" → `/artisan/profil/artisan-xyz789`

3. **Section avis** s'affiche :
   ```
   ══════════════════════════════════════
   ⭐ AVIS CLIENTS (6)
   ══════════════════════════════════════
   
   📊 Note moyenne : 4.58/5
   ⭐⭐⭐⭐☆
   
   Répartition :
   ⭐⭐⭐⭐⭐ (5 étoiles) : 4 avis  ████████░░  67%
   ⭐⭐⭐⭐☆ (4 étoiles) : 2 avis  ████░░░░░░  33%
   ⭐⭐⭐☆☆ (3 étoiles) : 0 avis  ░░░░░░░░░░   0%
   ⭐⭐☆☆☆ (2 étoiles) : 0 avis  ░░░░░░░░░░   0%
   ⭐☆☆☆☆ (1 étoile)  : 0 avis  ░░░░░░░░░░   0%
   
   ──────────────────────────────────────
   
   AVIS LES PLUS RÉCENTS :
   
   [Carte 1]
   👤 Jean D. (vérifié ✅)
   ⭐⭐⭐⭐⭐ 5/5
   📅 19 février 2026
   
   💬 "Très bon artisan, ponctuel et professionnel.
   Travail soigné, fuite résolue rapidement.
   Je recommande vivement !"
   
   📸 [Photo du travail]
   
   💬 Réponse de l'artisan :
   "Merci beaucoup Jean pour cet avis très positif !..."
   
   ──────────────────────────────────────
   
   [Carte 2]
   👤 Marie L. (vérifié ✅)
   ⭐⭐⭐⭐☆ 4/5
   📅 5 février 2026
   
   💬 "Bon travail mais prix un peu élevé."
   
   💬 Réponse de l'artisan :
   "Merci pour votre retour ! Nos tarifs incluent..."
   
   ──────────────────────────────────────
   
   [Voir tous les avis (6)]
   ```

**Fichiers concernés** :
- `frontend/src/app/artisan/profil/[id]/page.tsx`
- `frontend/src/lib/firebase/avis-service.ts` → `getAvisPublicsArtisan()`

**Impact SEO/Confiance** :
- ✅ Avis visibles publiquement (transparence)
- ✅ Note moyenne influent choix client
- ✅ Réponses artisan montrent professionnalisme
- ✅ Badge "vérifié ✅" = client réel (pas fake)

---

### 🔹 Scénario 10.4 : Artisan NE PEUT PAS Donner Avis en Retour

**Contexte** : Règle métier stricte - flux unidirectionnel.

**Tentative artisan** :
1. **Artisan** consulte avis client
2. **Artisan** cherche bouton "⭐ Donner avis au client"
3. **Bouton n'existe PAS** ❌

**Seule option disponible** :
```
[💬 Répondre à cet avis]  ← Seule action possible
```

**Raison métier** :
- ✅ Évite escalade (client donne mauvais avis → artisan donne mauvais avis en retour)
- ✅ Client = donneur d'ordre (payeur)
- ✅ Artisan = fournisseur de service
- ✅ Réponse artisan = espace d'expression suffisant

**Fichiers concernés** :
- Logique dans `avis-service.ts` → Fonction `createAvis()` vérifie :
  ```typescript
  if (authorRole === 'artisan') {
    throw new Error("Les artisans ne peuvent pas donner d'avis, uniquement répondre");
  }
  ```

---

## 📊 RÉCAPITULATIF COMPLET DES WORKFLOWS

### 🔄 Flux Complet (De A à Z)

```
1. INSCRIPTION
   └─ Client s'inscrit → Email vérifié
   └─ Artisan s'inscrit → Email vérifié → Upload docs → Admin approuve

2. DEMANDE CLIENT
   └─ Client crée demande publique/directe
   └─ Notifications artisans

3. DEVIS ARTISAN
   └─ Artisan crée brouillon → Artisan envoie
   └─ Notification client

4. RÉPONSE CLIENT
   └─ Client accepte → Signature
   └─ Client refuse → Fin
   └─ Devis expire → Fin

5. SIGNATURE
   └─ Client signe électroniquement

6. PAIEMENT
   └─ Client paie Stripe → Séquestre
   └─ Paiement échoue → Réessayer

7. TRAVAUX
   └─ Artisan démarre
   └─ Artisan déclare fin

8. VALIDATION
   └─ Client valide manuellement → Paiement transféré → Notification avis
   └─ Client signale litige → Médiation
   └─ Validation auto (7j) → Paiement transféré → Notification avis

9. AVIS CLIENT
   └─ Client voit invitation (badge 🟡)
   └─ Client donne avis (note + commentaire)
   └─ Avis expire après 30j
   └─ Notification artisan

10. RÉPONSE ARTISAN
    └─ Artisan voit avis
    └─ Artisan répond (commentaire uniquement)
    └─ Notification client
```

---

## 📁 FICHIERS CLÉS PAR SCÉNARIO

| Scénario | Fichiers Principaux |
|----------|---------------------|
| **Inscription** | `auth-service.ts`, `user-service.ts`, `artisan-service.ts` |
| **Demande** | `demande-service.ts`, `notification-service.ts` |
| **Devis** | `devis-service.ts`, `/artisan/devis/nouveau/page.tsx` |
| **Signature** | `SignatureModal.tsx`, `devis-service.ts` |
| **Paiement** | `stripe-service.ts`, `StripePaymentModal.tsx` |
| **Travaux** | `devis-service.ts` → `demarrerTravaux()`, `declarerFinTravaux()` |
| **Validation** | `devis-service.ts` → `validerTravaux()`, `signalerProbleme()` |
| **Avis** | `avis-service.ts`, `/client/avis/nouveau/page.tsx`, `useContratsANoter.ts` |
| **Réponse** | `avis-service.ts` → `addReponseArtisan()` |

---

## 🎯 POINTS D'ATTENTION CRITIQUES

### ⚠️ Sécurité
- ✅ Validation anti-bypass messages (`antiBypassValidator.ts`)
- ✅ Paiement séquestre (pas de transfert direct)
- ✅ Signature horodatée (IP + User-Agent)
- ✅ Email vérification obligatoire
- ✅ Admin approuve artisans (KBIS, assurances)

### ⚠️ Délais
- ✅ Devis valide 30 jours
- ✅ Validation travaux : 7 jours (puis auto)
- ✅ Avis : 30 jours max après validation
- ✅ Demande expire si non acceptée (30 jours)

### ⚠️ Anti-Abus
- ✅ 1 seul avis par contrat (anti-doublon)
- ✅ Artisan ne peut pas donner avis en retour
- ✅ Modération admin des avis injurieux
- ✅ Limitation messages si spam détecté

---

**FIN DU DOCUMENT - Tous les scénarios couverts** ✅
