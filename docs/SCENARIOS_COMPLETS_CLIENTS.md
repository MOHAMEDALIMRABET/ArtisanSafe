# 🎯 SCÉNARIOS COMPLETS - PARCOURS CLIENT

> **Analyse exhaustive** : Tous les scénarios possibles du parcours client de l'inscription à la fin des travaux  
> **Date** : 8 février 2026  
> **Pages concernées** : `/inscription`, `/client/*`, `/recherche`, `/artisan/[id]`

---

## 📋 TABLE DES MATIÈRES

1. [Inscription & Authentification](#1-inscription--authentification)
2. [Validation Email](#2-validation-email)
3. [Recherche d'Artisans](#3-recherche-dartisans)
4. [Création de Demande](#4-création-de-demande)
5. [Réception & Gestion des Devis](#5-réception--gestion-des-devis)
6. [Signature & Paiement](#6-signature--paiement)
7. [Suivi des Travaux](#7-suivi-des-travaux)
8. [Avis & Évaluation](#8-avis--évaluation)
9. [Gestion du Compte](#9-gestion-du-compte)
10. [Messagerie](#10-messagerie)

---

## 1️⃣ INSCRIPTION & AUTHENTIFICATION

### 📍 Scénario 1.1 : Inscription réussie

**Page** : `/inscription?role=client`

**Étapes** :
1. Client remplit formulaire :
   - ✅ Nom : `Dupont`
   - ✅ Prénom : `Marie`
   - ✅ Email : `marie.dupont@example.com` (unique)
   - ✅ Téléphone : `+33612345678`
   - ✅ Mot de passe : `MonMotDePasse123!` (≥8 caractères)

2. **Soumission** → `signUpClient()` appelé

3. **Résultats** :
   - ✅ Compte Firebase Auth créé (UID généré)
   - ✅ Document `users/{uid}` créé :
     ```typescript
     {
       uid: "abc123xyz",
       email: "marie.dupont@example.com",
       role: "client",
       nom: "Dupont",
       prenom: "Marie",
       telephone: "+33612345678",
       emailVerified: false,  // Important !
       statut: "non_verifie",
       createdAt: Timestamp
     }
     ```
   - ✅ Email de vérification envoyé automatiquement
   - ✅ Redirection vers `/dashboard`

**Accès client après inscription** :
- ✅ Dashboard accessible
- ✅ Création de demandes autorisée
- ✅ Recherche d'artisans autorisée
- ✅ Consultation profils artisans autorisée
- ❌ Signature de contrat **BLOQUÉE** (email non vérifié)
- ❌ Paiement **BLOQUÉ** (email non vérifié)

---

### 📍 Scénario 1.2 : Inscription échouée - Email déjà utilisé

**Étapes** :
1. Client entre email : `marie.dupont@example.com`
2. Email **déjà existant** dans Firebase Auth

**Résultat** :
- ❌ Erreur affichée : **"Cette adresse email est déjà utilisée. Veuillez vous connecter."**
- ✅ Lien vers `/connexion` proposé
- ❌ Aucun compte créé

**Code erreur Firebase** : `auth/email-already-in-use`

---

### 📍 Scénario 1.3 : Inscription échouée - Mot de passe trop faible

**Étapes** :
1. Client entre mot de passe : `123`
2. Mot de passe < 8 caractères

**Résultat** :
- ❌ Erreur affichée : **"Le mot de passe doit contenir au moins 8 caractères."**
- ✅ Client reste sur page inscription
- ❌ Aucun compte créé

**Code erreur Firebase** : `auth/weak-password`

---

### 📍 Scénario 1.4 : Inscription échouée - Email invalide

**Étapes** :
1. Client entre email : `marie.dupont@` (format invalide)

**Résultat** :
- ❌ Erreur affichée : **"Adresse email invalide."**
- ❌ Aucun compte créé

**Code erreur Firebase** : `auth/invalid-email`

---

### 📍 Scénario 1.5 : Connexion réussie

**Page** : `/connexion`

**Étapes** :
1. Client entre :
   - Email : `marie.dupont@example.com`
   - Mot de passe : `MonMotDePasse123!`

2. **Soumission** → `signIn()` appelé

**Résultat** :
- ✅ Authentification réussie
- ✅ Session créée (Firebase Auth)
- ✅ `user.emailVerified` vérifié
- ✅ Redirection vers `/dashboard`

---

### 📍 Scénario 1.6 : Connexion échouée - Mauvais mot de passe

**Étapes** :
1. Client entre mauvais mot de passe

**Résultat** :
- ❌ Erreur affichée : **"Email ou mot de passe incorrect."**
- ❌ Pas de connexion
- ✅ Client reste sur `/connexion`

**Code erreur Firebase** : `auth/wrong-password` ou `auth/invalid-credential`

---

### 📍 Scénario 1.7 : Connexion échouée - Compte inexistant

**Étapes** :
1. Client entre email non inscrit : `inconnu@example.com`

**Résultat** :
- ❌ Erreur affichée : **"Aucun compte associé à cet email. Veuillez vous inscrire."**
- ✅ Lien vers `/inscription` proposé

**Code erreur Firebase** : `auth/user-not-found`

---

### 📍 Scénario 1.8 : Déconnexion

**Page** : Toutes pages (menu utilisateur)

**Étapes** :
1. Client clique "Déconnexion" dans menu

**Résultat** :
- ✅ Session Firebase Auth supprimée
- ✅ `auth.currentUser` = `null`
- ✅ Redirection vers `/`
- ✅ Accès pages protégées bloqué

---

## 2️⃣ VALIDATION EMAIL

### 📍 Scénario 2.1 : Validation email réussie

**Workflow** :
1. Client reçoit email "Bienvenue sur ArtisanDispo - Validez votre email"
2. Client clique sur lien de vérification
3. Redirection Firebase Auth Handler
4. Firebase valide l'email
5. Redirection vers `/email-verified`

**Page `/email-verified`** :
```
✅ Email vérifié avec succès !
Votre compte est maintenant complet.
Redirection automatique vers le dashboard dans 3 secondes...
```

**Résultats** :
- ✅ `user.emailVerified` = `true` (Firebase Auth)
- ✅ `users/{uid}.emailVerified` = `true` (Firestore)
- ✅ Accès complet débloqué :
  - ✅ Signature de contrat autorisée
  - ✅ Paiement autorisé
  - ✅ Toutes fonctionnalités accessibles

---

### 📍 Scénario 2.2 : Email jamais validé (client actif sans validation)

**Contexte** : Client inscrit mais n'a jamais cliqué sur lien email

**Conséquences** :
- ✅ Accès dashboard : OK
- ✅ Recherche artisans : OK
- ✅ Création demandes : OK
- ✅ Navigation libre : OK
- ⚠️ **Bannière d'avertissement** affichée :
  ```
  ⚠️ Votre email n'est pas vérifié.
  Veuillez consulter votre boîte mail pour activer votre compte.
  [Renvoyer l'email]
  ```
- ❌ **Bloqué à l'étape signature/paiement** :
  ```
  🚫 Vous devez vérifier votre email avant de signer un contrat.
  [Renvoyer l'email de vérification]
  ```

---

### 📍 Scénario 2.3 : Renvoi email de vérification

**Page** : `/dashboard` ou toute page avec bannière

**Étapes** :
1. Client clique "Renvoyer l'email"
2. `sendEmailVerification(user)` appelé

**Résultat** :
- ✅ Nouvel email envoyé
- ✅ Message confirmation : **"Email de vérification renvoyé. Vérifiez votre boîte mail."**
- ⏳ Client attend réception email

**Limite** : Max 1 email/minute (protection spam)

---

### 📍 Scénario 2.4 : Lien de vérification expiré

**Contexte** : Client clique sur lien > 24h après envoi

**Résultat** :
- ❌ Erreur Firebase : **"Ce lien a expiré."**
- ✅ Page `/email-verification-error` :
  ```
  ⏰ Lien de vérification expiré
  
  Veuillez demander un nouveau lien de vérification.
  [Renvoyer l'email]
  ```

---

## 3️⃣ RECHERCHE D'ARTISANS

### 📍 Scénario 3.1 : Recherche avec métier + ville

**Page** : `/recherche` ou `/`

**Étapes** :
1. Client entre :
   - Métier : `Plomberie`
   - Ville : `Paris`
2. Clic "Rechercher"

**Requête Firestore** :
```typescript
query(
  collection(db, 'artisans'),
  where('metiers', 'array-contains', 'plomberie'),
  where('location.city', '==', 'Paris')
)
```

**Filtres supplémentaires (client-side)** :
```typescript
artisans.filter(a => 
  a.verificationStatus === 'approved' &&
  a.emailVerified === true
)
```

**Résultat** :
- ✅ **5 artisans trouvés** (exemple)
- ✅ Affichage cards :
  ```
  ┌─────────────────────────────────┐
  │ 🔧 PLOMBERIE DUPONT             │
  │ ⭐⭐⭐⭐⭐ 4.8 (32 avis)            │
  │ 📍 Paris 15ème                   │
  │ 💼 Plomberie, Chauffage          │
  │ [Voir le profil] [Demander devis]│
  └─────────────────────────────────┘
  ```

---

### 📍 Scénario 3.2 : Recherche sans résultat

**Étapes** :
1. Client cherche : `Plomberie` à `Marseille`
2. Aucun artisan approuvé à Marseille

**Résultat** :
- ❌ **Aucun artisan trouvé**
- ✅ Message affiché :
  ```
  😔 Aucun artisan disponible pour cette recherche.
  
  Suggestions :
  - Élargissez votre zone de recherche
  - Essayez un autre métier
  - Créez une demande pour être contacté
  
  [Créer une demande]
  ```

---

### 📍 Scénario 3.3 : Recherche métier uniquement

**Étapes** :
1. Client sélectionne : `Électricité`
2. **Ville vide**

**Résultat** :
- ✅ **20 artisans trouvés** (tous électriciens approuvés)
- ✅ Tri par distance (si géolocalisation activée) OU par note
- ✅ Affichage normal

---

### 📍 Scénario 3.4 : Consultation profil artisan

**Page** : `/artisan/[id]`

**Étapes** :
1. Client clique "Voir le profil"
2. Redirection vers `/artisan/abc123`

**Affichage** :
```
┌─────────────────────────────────────┐
│ PLOMBERIE DUPONT                    │
│ Professionnel vérifié ✅            │
├─────────────────────────────────────┤
│ 📍 32 Rue de la République, Paris   │
│ 📞 +33612345678                     │
│ 📧 contact@plomberie-dupont.fr      │
│ 🏢 SIRET : 12345678901234           │
├─────────────────────────────────────┤
│ Métiers :                           │
│ - Plomberie                         │
│ - Chauffage                         │
│ - Dépannage urgence                 │
├─────────────────────────────────────┤
│ Description :                       │
│ Artisan plombier depuis 15 ans...   │
├─────────────────────────────────────┤
│ Documents :                         │
│ ✅ KBIS vérifié                      │
│ ✅ Assurance décennale valide        │
├─────────────────────────────────────┤
│ Avis clients : ⭐⭐⭐⭐⭐ 4.8/5         │
│ [3 derniers avis affichés]          │
└─────────────────────────────────────┘

[Demander un devis] [Contacter]
```

---

### 📍 Scénario 3.5 : Profil artisan non vérifié (invisible)

**Contexte** : Artisan existe mais `verificationStatus = 'pending'` ou `emailVerified = false`

**Résultat** :
- ❌ **Profil INVISIBLE** dans recherches
- ❌ Accès URL direct `/artisan/abc123` → **404 ou page blanche**

**Protection** : Seuls artisans approuvés + email vérifié sont publics

---

## 4️⃣ CRÉATION DE DEMANDE

### 📍 Scénario 4.1 : Création demande publique réussie

**Page** : `/client/nouvelle-demande`

**Étapes** :
1. Client remplit formulaire :
   ```typescript
   {
     type: "publique",  // Visible tous artisans
     metier: "plomberie",
     titre: "Réparation fuite évier cuisine",
     description: "Fuite sous l'évier depuis 2 jours...",
     location: {
       address: "15 Rue de la Paix",
       city: "Paris",
       postalCode: "75002"
     },
     dateDebut: "2026-03-01",
     flexibiliteDays: 3,  // +/- 3 jours
     budgetMin: 100,
     budgetMax: 300,
     urgence: "normale",
     photos: [File1, File2]  // Optionnel
   }
   ```

2. **Soumission** → `createDemande()` appelé

**Résultat** :
- ✅ Document `demandes/{id}` créé :
  ```typescript
  {
    id: "demande-123",
    clientId: "abc123xyz",
    type: "publique",
    statut: "publiee",  // Immédiatement visible
    metier: "plomberie",
    titre: "Réparation fuite évier cuisine",
    description: "...",
    location: {...},
    dateDebut: Timestamp("2026-03-01"),
    flexibiliteDays: 3,
    dateExpiration: Timestamp("2026-03-04"),  // Auto-calculé
    budgetMin: 100,
    budgetMax: 300,
    urgence: "normale",
    devisRecus: 0,
    photos: ["url1", "url2"],
    createdAt: Timestamp.now()
  }
  ```
- ✅ **Photos uploadées** Firebase Storage (si présentes)
- ✅ **Visible immédiatement** pour tous artisans plombiers
- ✅ Redirection vers `/client/demandes`
- ✅ Message : **"Demande publiée avec succès ! Les artisans vont la consulter."**

---

### 📍 Scénario 4.2 : Création demande directe (artisan ciblé)

**Page** : `/artisan/[id]` → Bouton "Demander un devis"

**Étapes** :
1. Client clique "Demander un devis" sur profil artisan
2. Formulaire pré-rempli :
   ```typescript
   {
     type: "directe",
     artisanCibleId: "artisan-456",  // ID artisan
     metier: "plomberie",  // Auto-rempli depuis profil
     // ... reste du formulaire
   }
   ```
3. Client complète détails
4. Soumission

**Résultat** :
- ✅ Demande créée avec `type: "directe"`
- ✅ **Notification envoyée à l'artisan ciblé** :
  ```
  📬 Nouvelle demande de devis
  Marie Dupont vous a contacté pour : "Réparation fuite évier"
  [Voir la demande]
  ```
- ✅ Statut : `matchee` (artisan matché)
- ✅ **Non visible** pour autres artisans
- ✅ Redirection `/client/demandes`

---

### 📍 Scénario 4.3 : Création demande échouée - Champs manquants

**Étapes** :
1. Client ne remplit pas `description`
2. Clic "Publier"

**Résultat** :
- ❌ Erreur validation frontend : **"La description est obligatoire."**
- ❌ Demande non créée
- ✅ Client reste sur formulaire

**Champs obligatoires** :
- Métier
- Titre
- Description
- Location (adresse, ville, code postal)
- Date début
- Urgence

---

### 📍 Scénario 4.4 : Sauvegarde brouillon demande

**Étapes** :
1. Client remplit formulaire partiellement
2. Clic "Sauvegarder brouillon"

**Résultat** :
- ✅ Document `demandes/{id}` créé :
  ```typescript
  {
    statut: "genere",  // Brouillon
    // ... champs remplis
  }
  ```
- ❌ **Non visible artisans**
- ✅ Client peut modifier/supprimer librement
- ✅ Accessible dans `/client/demandes` (onglet "Brouillons")

---

### 📍 Scénario 4.5 : Publication brouillon ultérieure

**Étapes** :
1. Client accède brouillon `/client/demandes`
2. Clic "Publier"
3. Complétion champs manquants
4. Clic "Publier la demande"

**Résultat** :
- ✅ Statut mis à jour : `genere` → `publiee`
- ✅ `dateExpiration` calculée
- ✅ Visible artisans immédiatement
- ✅ Notifications envoyées (si demande directe)

---

### 📍 Scénario 4.6 : Upload photos (optionnel)

**Étapes** :
1. Client ajoute 3 photos (fuite, emplacement, état lieux)
2. Photos validées :
   - Format : JPG, PNG
   - Taille max : 5 MB/photo
   - Max 5 photos

**Résultat** :
- ✅ Upload Firebase Storage (`demandes/{demandeId}/photo1.jpg`)
- ✅ URLs ajoutées à `demandes.photos[]`
- ✅ Artisans voient photos dans détails demande

**Cas erreur** :
- ❌ Photo > 5 MB → **"Photo trop volumineuse. Max 5 MB."**
- ❌ > 5 photos → **"Maximum 5 photos autorisées."**

---

## 5️⃣ RÉCEPTION & GESTION DES DEVIS

### 📍 Scénario 5.1 : Réception notification nouveau devis

**Workflow** :
1. Artisan crée devis pour demande client
2. Artisan change statut : `brouillon` → `envoye`
3. **Notification automatique** créée :
   ```typescript
   {
     userId: "client-123",
     type: "devis_recu",
     titre: "📄 Nouveau devis reçu",
     message: "PLOMBERIE DUPONT vous a envoyé un devis",
     lien: "/client/devis/devis-456",
     lue: false,
     dateCreation: Timestamp.now()
   }
   ```

**Résultat côté client** :
- ✅ **Badge notification** : 🔔 **1**
- ✅ Dropdown notifications affiche :
  ```
  📄 Nouveau devis reçu
  PLOMBERIE DUPONT vous a envoyé un devis
  Il y a 2 minutes
  ```
- ✅ **Email notification** envoyé (si activé) :
  ```
  Sujet : Nouveau devis reçu - ArtisanDispo
  Vous avez reçu un devis de PLOMBERIE DUPONT pour votre demande.
  [Consulter le devis]
  ```

---

### 📍 Scénario 5.2 : Consultation liste devis

**Page** : `/client/devis`

**Affichage** :
```
MES DEVIS

Filtres : [Tous] [En attente] [Acceptés] [Refusés]

📊 Statistiques :
- En attente : 2
- Acceptés : 1
- Refusés : 3

┌─────────────────────────────────────┐
│ Réparation fuite évier cuisine      │
│ 🟡 En attente                       │
│ PLOMBERIE DUPONT                    │
│ 💰 350,00 € TTC                     │
│ 📅 Créé le 05/02/2026               │
│ ⏰ Valide jusqu'au 12/02/2026       │
│ [Voir détail] [Accepter] [Refuser]  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Installation chauffe-eau            │
│ ✅ Accepté                           │
│ PLOMBERIE MARTIN                    │
│ 💰 1 200,00 € TTC                   │
│ 📅 Accepté le 03/02/2026            │
│ [Voir détail] [Contacter]           │
└─────────────────────────────────────┘
```

---

### 📍 Scénario 5.3 : Détail d'un devis (statut "envoye")

**Page** : `/client/devis/[id]`

**Affichage** :
```
┌─────────────────────────────────────────┐
│ DEVIS N° DV-2026-00001                  │
│ 🟡 En attente de réponse                │
├─────────────────────────────────────────┤
│ ARTISAN                                 │
│ PLOMBERIE DUPONT                        │
│ 📞 +33612345678                         │
│ 📧 contact@plomberie-dupont.fr          │
├─────────────────────────────────────────┤
│ CLIENT                                  │
│ Marie Dupont                            │
│ 📧 marie.dupont@example.com             │
├─────────────────────────────────────────┤
│ TITRE                                   │
│ Réparation fuite évier cuisine          │
│                                         │
│ DESCRIPTION                             │
│ Remplacement joint siphon + contrôle... │
├─────────────────────────────────────────┤
│ PRESTATIONS                             │
│ ┌────────────────────────────────────┐ │
│ │ Désignation │ Qté │ PU HT │ TVA │ │ │
│ │─────────────│─────│───────│─────│ │ │
│ │ Main d'œuvre│  1  │ 80 €  │ 20% │ │ │
│ │ Pièces      │  1  │ 25 €  │ 20% │ │ │
│ │ Déplacement │  1  │ 40 €  │ 20% │ │ │
│ └────────────────────────────────────┘ │
│                                         │
│ TOTAL HT : 145,00 €                     │
│ TOTAL TVA : 29,00 €                     │
│ TOTAL TTC : 174,00 €                    │
├─────────────────────────────────────────┤
│ DÉLAI : 48h après acceptation           │
│ VALIDITÉ : 12/02/2026                   │
│ PAIEMENT : À la fin des travaux         │
├─────────────────────────────────────────┤
│ [✅ Accepter ce devis]                  │
│ [❌ Refuser ce devis]                   │
└─────────────────────────────────────────┘
```

---

### 📍 Scénario 5.4 : Acceptation devis

**Étapes** :
1. Client clique "✅ Accepter ce devis"
2. **Popup confirmation** :
   ```
   ⚠️ Confirmer l'acceptation
   
   Êtes-vous sûr de vouloir accepter ce devis ?
   
   Montant : 174,00 € TTC
   Artisan : PLOMBERIE DUPONT
   
   Cette action est irréversible.
   
   [Annuler] [Confirmer]
   ```
3. Client clique "Confirmer"

**Actions automatiques** :
```typescript
// 1. Mise à jour devis
await updateDoc(doc(db, 'devis', devisId), {
  statut: 'accepte',
  dateAcceptation: Timestamp.now()
});

// 2. Notification artisan
await createNotification({
  userId: artisanId,
  type: 'devis_accepte',
  titre: '✅ Devis accepté !',
  message: 'Marie Dupont a accepté votre devis DV-2026-00001',
  lien: `/artisan/devis/${devisId}`
});

// 3. Email artisan (optionnel)
await sendEmail({
  to: artisan.email,
  subject: 'Devis accepté - DV-2026-00001',
  template: 'devis-accepte'
});
```

**Résultat** :
- ✅ Statut devis : `envoye` → `accepte`
- ✅ Badge devis : 🟡 → ✅ Accepté
- ✅ Message succès : **"Devis accepté avec succès ! L'artisan a été notifié."**
- ✅ Redirection `/client/devis`
- ✅ **Bouton "Contacter l'artisan"** devient visible
- ⏳ **Phase suivante** : Signature + Paiement (Phase 2 - À implémenter)

---

### 📍 Scénario 5.5 : Refus devis avec motif

**Étapes** :
1. Client clique "❌ Refuser ce devis"
2. **Modal motif** s'ouvre :
   ```
   Refuser le devis
   
   Pourquoi refusez-vous ce devis ? (optionnel)
   
   [Motifs suggérés]
   - Tarif trop élevé
   - Délai trop long
   - Prestation non adaptée
   - Autre
   
   ┌──────────────────────────────────┐
   │ Votre motif (optionnel) :        │
   │                                  │
   │                                  │
   └──────────────────────────────────┘
   
   [Annuler] [Confirmer le refus]
   ```
3. Client entre motif : "Tarif trop élevé"
4. Clic "Confirmer le refus"

**Actions automatiques** :
```typescript
// 1. Mise à jour devis
await updateDoc(doc(db, 'devis', devisId), {
  statut: 'refuse',
  dateRefus: Timestamp.now(),
  motifRefus: 'Tarif trop élevé'
});

// 2. Notification artisan
await createNotification({
  userId: artisanId,
  type: 'devis_refuse',
  titre: '❌ Devis refusé',
  message: 'Marie Dupont a refusé votre devis DV-2026-00001',
  lien: `/artisan/devis/${devisId}`
});
```

**Résultat** :
- ✅ Statut devis : `envoye` → `refuse`
- ✅ Badge : ❌ Refusé
- ✅ Message : **"Devis refusé. L'artisan a été notifié."**
- ✅ Artisan voit motif dans détails devis
- ❌ **Aucune action possible** sur ce devis (historique)

---

### 📍 Scénario 5.6 : Refus devis sans motif

**Étapes** :
1. Client clique "❌ Refuser"
2. Modal motif ouverte
3. Client laisse champ vide
4. Clic "Confirmer le refus"

**Résultat** :
- ✅ Refus enregistré avec `motifRefus: "Aucun motif précisé"`
- ✅ Comportement identique à scénario 5.5

---

### 📍 Scénario 5.7 : Devis expiré (date validité dépassée)

**Contexte** : Client ne répond pas avant `dateValidite`

**Cloud Function quotidienne** :
```typescript
// Exécutée tous les jours à 3h
const devisExpires = await getDocs(
  query(
    collection(db, 'devis'),
    where('statut', '==', 'envoye'),
    where('dateValidite', '<', Timestamp.now())
  )
);

devisExpires.forEach(async (doc) => {
  await updateDoc(doc.ref, {
    statut: 'expire'
  });
});
```

**Résultat** :
- ✅ Statut automatique : `envoye` → `expire`
- ⏰ Badge : **⏰ Expiré**
- ❌ Boutons "Accepter/Refuser" **DÉSACTIVÉS**
- ✅ Message affiché :
  ```
  ⏰ Ce devis a expiré le 12/02/2026.
  Contactez l'artisan pour un nouveau devis.
  [Contacter l'artisan]
  ```

---

### 📍 Scénario 5.8 : Comparaison de plusieurs devis

**Page** : `/client/demandes/[id]` → Onglet "Devis reçus"

**Contexte** : Client a reçu 3 devis pour même demande

**Affichage** :
```
DEMANDE : Réparation fuite évier cuisine

3 DEVIS REÇUS

┌──────────────────────────────────────────┐
│ PLOMBERIE DUPONT                         │
│ 💰 174,00 € TTC                          │
│ ⭐ 4.8/5 (32 avis)                       │
│ ⏰ Délai : 48h                           │
│ 🟡 En attente                            │
│ [Voir détail] [Accepter] [Refuser]       │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ PLOMBERIE MARTIN                         │
│ 💰 220,00 € TTC                          │
│ ⭐ 4.5/5 (18 avis)                       │
│ ⏰ Délai : 24h                           │
│ 🟡 En attente                            │
│ [Voir détail] [Accepter] [Refuser]       │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ DÉPANNAGE EXPRESS                        │
│ 💰 150,00 € TTC                          │
│ ⭐ 3.9/5 (9 avis)                        │
│ ⏰ Délai : 72h                           │
│ 🟡 En attente                            │
│ [Voir détail] [Accepter] [Refuser]       │
└──────────────────────────────────────────┘
```

**Actions possibles** :
- ✅ Client compare prix, délais, avis
- ✅ Client consulte détails de chaque devis
- ✅ Client accepte **1 seul devis**
- ✅ Autres devis → refusés automatiquement ? **NON** (client doit refuser manuellement)

---

## 6️⃣ SIGNATURE & PAIEMENT

> **⚠️ Phase 2 - À implémenter (Stripe)**

### 📍 Scénario 6.1 : Signature électronique (futur)

**Workflow prévu** :
1. Client accepte devis
2. Redirection vers `/client/signature/[devisId]`
3. Client lit contrat
4. Client signe :
   - Signature manuscrite (canvas HTML5)
   - ✅ "J'accepte les conditions générales"
5. Soumission signature

**Résultat** :
- ✅ `devis.signatureClient` = `dataURL`
- ✅ `devis.dateSignature` = `Timestamp.now()`
- ✅ Statut : `accepte` → `en_attente_paiement`
- ✅ Redirection `/client/paiement/[devisId]`

---

### 📍 Scénario 6.2 : Paiement Stripe (futur)

**Workflow prévu** :
1. Client redirigé vers page paiement
2. Montant bloqué (escrow - séquestre)
3. Client paie par carte bancaire
4. Stripe valide paiement

**Résultat** :
- ✅ Statut : `en_attente_paiement` → `paye`
- ✅ **Contrat créé** :
  ```typescript
  {
    devisId: "devis-456",
    clientId: "client-123",
    artisanId: "artisan-789",
    statut: "en_cours",
    montantTTC: 174.00,
    montantEscrow: 174.00,  // Bloqué
    dateDebut: Timestamp("2026-03-01"),
    dateFin: null
  }
  ```
- ✅ Notification artisan : "💰 Paiement reçu - Travaux à planifier"
- ✅ Argent **bloqué** jusqu'à fin travaux

---

### 📍 Scénario 6.3 : Échec paiement (futur)

**Workflow** :
- ❌ Carte refusée
- ❌ Fonds insuffisants

**Résultat** :
- ❌ Statut reste `en_attente_paiement`
- ❌ Message : **"Paiement échoué. Veuillez réessayer."**
- ✅ Client peut réessayer

---

## 7️⃣ SUIVI DES TRAVAUX

> **Phase 2 - À implémenter**

### 📍 Scénario 7.1 : Début des travaux

**Workflow** :
1. Artisan clique "Commencer les travaux"
2. Photo "avant" uploadée (optionnel)

**Résultat** :
- ✅ `contrat.statut` : `en_cours` → `travaux_en_cours`
- ✅ `contrat.dateDebutReel` = `Timestamp.now()`
- ✅ Notification client : "🔧 Les travaux ont commencé"

---

### 📍 Scénario 7.2 : Fin des travaux

**Workflow** :
1. Artisan clique "Terminer les travaux"
2. Photos "après" uploadées
3. Client reçoit notification

**Résultat** :
- ✅ Statut : `travaux_en_cours` → `en_attente_validation`
- ✅ Notification client : "✅ Travaux terminés - Validation requise"

---

### 📍 Scénario 7.3 : Validation client

**Page** : `/client/contrats/[id]/valider`

**Workflow** :
1. Client consulte photos "après"
2. Client vérifie travaux sur place
3. Client clique "✅ Valider les travaux"

**Résultat** :
- ✅ Statut : `en_attente_validation` → `termine`
- ✅ **Argent libéré** (Stripe escrow → compte artisan)
- ✅ Commission 8% prélevée automatiquement
- ✅ Notification artisan : "💰 Paiement libéré"
- ✅ Redirection `/client/avis/nouveau/[contratId]` (laisser avis)

---

### 📍 Scénario 7.4 : Contestation client

**Page** : `/client/contrats/[id]/contester`

**Workflow** :
1. Client pas satisfait
2. Clic "⚠️ Signaler un problème"
3. Description problème
4. Photos preuves

**Résultat** :
- ✅ Statut : `en_attente_validation` → `litige`
- ✅ **Argent bloqué** (escrow maintenu)
- ✅ Médiation admin déclenchée
- ✅ Notification admin : "⚠️ Litige à traiter"
- ✅ Email artisan + client

**Résolution litige** :
- Admin tranche
- Argent redistribué selon décision

---

## 8️⃣ AVIS & ÉVALUATION

### 📍 Scénario 8.1 : Laisser un avis après travaux

**Page** : `/client/avis/nouveau/[contratId]`

**Workflow** :
1. Client accède page après validation travaux
2. Formulaire avis :
   ```
   Évaluer PLOMBERIE DUPONT
   
   Note globale : ⭐⭐⭐⭐⭐
   
   Détails :
   - Qualité du travail : ⭐⭐⭐⭐⭐
   - Respect des délais : ⭐⭐⭐⭐☆
   - Communication : ⭐⭐⭐⭐⭐
   - Propreté : ⭐⭐⭐⭐⭐
   
   Commentaire (optionnel) :
   ┌────────────────────────────────┐
   │ Excellent travail, très pro... │
   └────────────────────────────────┘
   
   [Publier l'avis]
   ```
3. Soumission

**Résultat** :
- ✅ Document `avis/{id}` créé :
  ```typescript
  {
    contratId: "contrat-123",
    clientId: "client-123",
    artisanId: "artisan-789",
    noteGlobale: 4.75,
    detailsNotes: {
      qualite: 5,
      delais: 4,
      communication: 5,
      proprete: 5
    },
    commentaire: "Excellent travail...",
    dateCreation: Timestamp.now(),
    verifie: true  // Avis lié à contrat payé
  }
  ```
- ✅ **Recalcul note moyenne artisan** :
  ```typescript
  await updateArtisanRating(artisanId);
  // artisan.noteGlobale = moyenne de tous avis
  ```
- ✅ Notification artisan : "⭐ Nouvel avis reçu"
- ✅ Avis **visible publiquement** sur profil artisan

---

### 📍 Scénario 8.2 : Modification avis (7 jours)

**Workflow** :
1. Client veut modifier avis dans les 7 jours
2. Accès `/client/avis/[id]/modifier`
3. Modification note/commentaire
4. Soumission

**Résultat** :
- ✅ Avis mis à jour
- ✅ `dateModification` enregistrée
- ✅ Recalcul note artisan

**Limite** : Modification uniquement dans **7 jours** après création

---

### 📍 Scénario 8.3 : Avis sans commentaire

**Workflow** :
1. Client met uniquement notes
2. Laisse commentaire vide
3. Publie

**Résultat** :
- ✅ Avis créé avec notes uniquement
- ✅ `commentaire: ""` (vide)
- ✅ Visible sur profil artisan

---

### 📍 Scénario 8.4 : Réponse artisan à avis (optionnel)

**Workflow** :
1. Artisan voit avis négatif
2. Clic "Répondre à cet avis"
3. Rédaction réponse
4. Publication

**Résultat** :
- ✅ `avis.reponseArtisan` = "Merci pour votre retour..."
- ✅ `avis.dateReponse` = `Timestamp.now()`
- ✅ Réponse visible sous avis client

---

## 9️⃣ GESTION DU COMPTE

### 📍 Scénario 9.1 : Modification profil

**Page** : `/client/profil`

**Workflow** :
1. Client modifie :
   - Nom : `Dupont` → `Durand`
   - Téléphone : `+33612345678` → `+33698765432`
2. Clic "Enregistrer"

**Résultat** :
- ✅ Mise à jour Firestore :
  ```typescript
  await updateDoc(doc(db, 'users', userId), {
    nom: 'Durand',
    telephone: '+33698765432'
  });
  ```
- ✅ Message : **"Profil mis à jour avec succès."**

**Champs non modifiables** :
- ❌ Email (nécessite re-authentification Firebase)
- ❌ UID
- ❌ Role

---

### 📍 Scénario 9.2 : Changement mot de passe

**Page** : `/client/profil` → Section "Sécurité"

**Workflow** :
1. Client clique "Changer mot de passe"
2. Formulaire :
   ```
   Mot de passe actuel : **********
   Nouveau mot de passe : **********
   Confirmer nouveau : **********
   ```
3. Soumission

**Actions** :
```typescript
// 1. Re-authentification obligatoire
const credential = EmailAuthProvider.credential(
  user.email,
  motDePasseActuel
);
await reauthenticateWithCredential(user, credential);

// 2. Changement mot de passe
await updatePassword(user, nouveauMotDePasse);
```

**Résultat** :
- ✅ Mot de passe changé
- ✅ Message : **"Mot de passe modifié avec succès."**

**Erreurs possibles** :
- ❌ Mot de passe actuel incorrect
- ❌ Nouveau mot de passe trop faible
- ❌ Confirmation ne correspond pas

---

### 📍 Scénario 9.3 : Suppression compte

**Page** : `/client/profil` → "Supprimer mon compte"

**Workflow** :
1. Client clique "Supprimer mon compte"
2. **Modal confirmation** :
   ```
   ⚠️ Supprimer définitivement votre compte ?
   
   Cette action est IRRÉVERSIBLE.
   
   Toutes vos données seront supprimées :
   - Profil
   - Demandes
   - Devis
   - Historique
   
   Pour confirmer, entrez votre mot de passe :
   ┌─────────────────────┐
   │ **********          │
   └─────────────────────┘
   
   [Annuler] [Supprimer définitivement]
   ```
3. Client entre mot de passe
4. Clic "Supprimer définitivement"

**Actions (cascade)** :
```typescript
// 1. Suppression données Firestore
await deleteUserData(userId);  // Script backend

// 2. Suppression Firebase Auth
await deleteUser(user);

// 3. Déconnexion
await signOut(auth);
```

**Résultat** :
- ✅ Compte supprimé définitivement
- ✅ Toutes données effacées (RGPD)
- ✅ Redirection `/`
- ✅ Message : **"Votre compte a été supprimé."**

**Données supprimées** :
- `users/{userId}` ❌
- `demandes` (clientId) ❌
- `devis` (clientId) ❌
- `contrats` (clientId) ❌
- `avis` → **Anonymisés** (client = "Utilisateur supprimé")

---

## 🔟 MESSAGERIE

> **Actuellement implémenté - Messagerie temps réel**

### 📍 Scénario 10.1 : Ouverture conversation avec artisan

**Page** : `/artisan/[id]` → Bouton "Contacter"

**Workflow** :
1. Client clique "Contacter l'artisan"
2. Vérification conversation existante
3. **Création automatique** si nouvelle :
   ```typescript
   {
     id: "conversation-123",
     participants: ["client-123", "artisan-789"],
     participantsDetails: {
       "client-123": { nom: "Marie Dupont", role: "client" },
       "artisan-789": { nom: "PLOMBERIE DUPONT", role: "artisan" }
     },
     dernierMessage: null,
     dateCreation: Timestamp.now()
   }
   ```
4. Redirection `/client/messagerie/conversation-123`

---

### 📍 Scénario 10.2 : Envoi message

**Page** : `/client/messagerie/[conversationId]`

**Workflow** :
1. Client tape message : `Bonjour, êtes-vous disponible jeudi ?`
2. Clic "Envoyer"

**Actions** :
```typescript
// 1. Validation anti-bypass
const validation = validateMessage(message);
if (!validation.isValid) {
  alert(validation.message);  // "Partage de coordonnées interdit"
  return;
}

// 2. Création message
await addDoc(collection(db, 'messages'), {
  conversationId: "conversation-123",
  authorId: "client-123",
  contenu: "Bonjour, êtes-vous disponible jeudi ?",
  dateCreation: Timestamp.now(),
  lu: false
});

// 3. Mise à jour conversation
await updateDoc(doc(db, 'conversations', 'conversation-123'), {
  dernierMessage: "Bonjour, êtes-vous disponible jeudi ?",
  dateDernierMessage: Timestamp.now()
});

// 4. Notification artisan
await createNotification({
  userId: "artisan-789",
  type: "nouveau_message",
  titre: "💬 Nouveau message",
  message: "Marie Dupont vous a envoyé un message",
  lien: "/artisan/messagerie/conversation-123"
});
```

**Résultat** :
- ✅ Message affiché instantanément (Firestore real-time)
- ✅ Artisan reçoit notification
- ✅ Badge conversation mise à jour

---

### 📍 Scénario 10.3 : Tentative partage coordonnées (BLOQUÉ)

**Workflow** :
1. Client tape : `Appelez-moi au 0612345678`
2. Clic "Envoyer"

**Validation anti-bypass** :
```typescript
const validation = validateMessage("Appelez-moi au 0612345678");
// validation.isValid = false
// validation.message = "Interdit de partager numéro de téléphone"
// validation.violations = ["telephone"]
```

**Résultat** :
- ❌ Message **non envoyé**
- ❌ Alert affichée :
  ```
  🚫 Message bloqué
  
  Vous ne pouvez pas partager de coordonnées personnelles
  (téléphone, email, adresse) avant la signature du contrat.
  
  Utilisez la messagerie pour échanger.
  ```

**Patterns bloqués** (40+) :
- Téléphones : `06 12 34 56 78`, `+33612345678`, `zero six...`
- Emails : `contact@gmail.com`, `exemple(at)mail.fr`
- Adresses : `15 rue de la Paix`, `75002 Paris`
- Réseaux sociaux : `whatsapp`, `facebook`, `instagram`

---

### 📍 Scénario 10.4 : Réception réponse artisan

**Workflow** :
1. Artisan répond : `Oui, jeudi je suis libre. À quelle heure ?`
2. **Notification client** :
   ```
   💬 Nouveau message
   PLOMBERIE DUPONT a répondu
   [Voir la conversation]
   ```
3. Client clique notification
4. Redirection `/client/messagerie/conversation-123`

**Affichage** :
```
┌─────────────────────────────────────┐
│ PLOMBERIE DUPONT                    │
├─────────────────────────────────────┤
│ Vous (il y a 2 min)                 │
│ Bonjour, êtes-vous disponible jeudi?│
│                                     │
│ PLOMBERIE DUPONT (à l'instant)      │
│ Oui, jeudi je suis libre.           │
│ À quelle heure ?                    │
├─────────────────────────────────────┤
│ [Tapez votre message...]   [Envoyer]│
└─────────────────────────────────────┘
```

---

### 📍 Scénario 10.5 : Marquage message lu

**Workflow** :
1. Client ouvre conversation
2. **Auto-marquage** :
   ```typescript
   useEffect(() => {
     const markMessagesRead = async () => {
       const unreads = messages.filter(m => 
         !m.lu && m.authorId !== userId
       );
       
       for (const msg of unreads) {
         await updateDoc(doc(db, 'messages', msg.id), {
           lu: true
         });
       }
     };
     
     markMessagesRead();
   }, [messages]);
   ```

**Résultat** :
- ✅ Messages marqués `lu: true`
- ✅ Badge notification disparaît
- ✅ Artisan voit "✓✓ Lu" sous message

---

## 📊 RÉCAPITULATIF DES STATUTS

### Statuts DEMANDE
```typescript
type DemandeStatut = 
  | 'genere'      // Brouillon (non publié)
  | 'publiee'     // Publiée, visible artisans
  | 'matchee'     // Demande directe artisan ciblé
  | 'en_cours'    // Devis accepté, travaux en cours
  | 'attribuee'   // Devis payé, contrat en cours
  | 'expiree'     // Date dépassée (auto Cloud Function)
  | 'terminee'    // Travaux terminés et validés
  | 'annulee';    // Annulée par client
```

### Statuts DEVIS
```typescript
type DevisStatut = 
  | 'brouillon'   // En cours de rédaction artisan
  | 'envoye'      // Envoyé au client, en attente réponse
  | 'accepte'     // Accepté par client
  | 'refuse'      // Refusé par client (avec motif)
  | 'expire';     // Date validité dépassée
```

**Phase 2 (Stripe)** :
```typescript
  | 'en_attente_paiement'  // Signé, attente paiement
  | 'paye'                 // Payé = Contrat juridique
  | 'annule';              // Annulé avant/après paiement
```

### Statuts CONTRAT (Phase 2)
```typescript
type ContratStatut = 
  | 'en_cours'              // Contrat actif, travaux non commencés
  | 'travaux_en_cours'      // Artisan a commencé
  | 'en_attente_validation' // Artisan a terminé, attente validation
  | 'termine'               // Validé par client, argent libéré
  | 'litige';               // Contestation client
```

---

## ✅ CHECKLIST COMPLÈTE - Parcours Client

### Inscription & Validation
- [x] Inscription réussie
- [x] Email déjà utilisé (erreur)
- [x] Mot de passe faible (erreur)
- [x] Email invalide (erreur)
- [x] Connexion réussie
- [x] Mauvais mot de passe (erreur)
- [x] Compte inexistant (erreur)
- [x] Déconnexion
- [x] Validation email réussie
- [x] Email non validé (restrictions)
- [x] Renvoi email vérification
- [x] Lien vérification expiré

### Recherche & Profils
- [x] Recherche métier + ville
- [x] Recherche sans résultat
- [x] Recherche métier uniquement
- [x] Consultation profil artisan
- [x] Profil non vérifié (invisible)

### Demandes
- [x] Création demande publique
- [x] Création demande directe
- [x] Champs manquants (erreur)
- [x] Sauvegarde brouillon
- [x] Publication brouillon
- [x] Upload photos
- [x] Photo trop volumineuse (erreur)

### Devis
- [x] Réception notification nouveau devis
- [x] Consultation liste devis
- [x] Détail devis (en attente)
- [x] Acceptation devis
- [x] Refus devis avec motif
- [x] Refus devis sans motif
- [x] Devis expiré
- [x] Comparaison plusieurs devis

### Signature & Paiement (Phase 2)
- [ ] Signature électronique
- [ ] Paiement Stripe
- [ ] Échec paiement

### Travaux (Phase 2)
- [ ] Début travaux
- [ ] Fin travaux
- [ ] Validation client
- [ ] Contestation client

### Avis
- [x] Laisser avis après travaux
- [x] Modification avis (7 jours)
- [x] Avis sans commentaire
- [x] Réponse artisan à avis

### Compte
- [x] Modification profil
- [x] Changement mot de passe
- [x] Suppression compte

### Messagerie
- [x] Ouverture conversation
- [x] Envoi message
- [x] Partage coordonnées (bloqué)
- [x] Réception réponse artisan
- [x] Marquage message lu

---

## 🔗 LIENS UTILES

**Documentation :**
- [Workflow Devis Client](./WORKFLOW_CLIENT_DEVIS.md)
- [Validation Email](./EMAIL_VERIFICATION_WORKFLOW.md)
- [Gestion Demandes](./GESTION_LIFECYCLE_DEMANDES.md)
- [Architecture Firestore](./FIREBASE.md)

**Services critiques :**
- `frontend/src/lib/auth-service.ts` - Authentification
- `frontend/src/lib/firebase/devis-service.ts` - Gestion devis
- `frontend/src/lib/firebase/demande-service.ts` - Gestion demandes
- `frontend/src/lib/firebase/notification-service.ts` - Notifications
- `frontend/src/lib/antiBypassValidator.ts` - Validation messages

---

**Fin du document - Parcours Client complet** 🎯
