# 📧 SYSTÈME D'EMAILS - ArtisanSafe

**Date** : 20 février 2026  
**Source** : Analyse de SCENARIOS_COMPLETS_WORKFLOWS.md  
**Objectif** : Inventaire complet des emails envoyés par la plateforme

---

## 📋 TABLE DES MATIÈRES

1. [Emails Actuellement Envoyés (Firebase Auth)](#1-emails-actuellement-envoyés-firebase-auth)
2. [Emails Recommandés pour Événements Critiques](#2-emails-recommandés-pour-événements-critiques)
3. [Architecture Technique](#3-architecture-technique)
4. [Implémentation Proposée](#4-implémentation-proposée)

---

## ⚠️ SYSTÈMES D'ENVOI D'EMAILS

**ArtisanSafe utilise 2 systèmes distincts d'envoi d'emails :**

### 🔥 Système 1 : Firebase Auth (Automatique)
- **Technologie** : Firebase Authentication
- **Configuration** : Automatique, non personnalisable
- **Emails envoyés** : 
  - Vérification d'adresse email (client + artisan)
  - Réinitialisation de mot de passe
- **Statut** : ✅ **ACTIF**

### 📧 Système 2 : Nodemailer + Gmail (Transactionnel)
- **Technologie** : Nodemailer + Gmail SMTP
- **Configuration** : `.env` backend (SMTP_USER, SMTP_PASSWORD)
- **Emails envoyés** :
  - Avertissement suppression compte (15 jours avant)
  - Confirmation suppression définitive
  - Suspension de compte
  - Réactivation de compte
- **Statut** : ✅ **ACTIF** (configuré avec `mohamedalimrabet22@gmail.com`)

**Architecture** :
```typescript
Frontend (email-notification-service.ts)
  → Crée document dans Firestore 'email_notifications' (status: 'pending')
     ↓
Backend (email-service.ts)
  → Surveille collection 'email_notifications' (toutes les 5 min)
  → Envoie via Nodemailer + Gmail SMTP
  → Marque status: 'sent' ou 'failed'
```

---

## 1. EMAILS FIREBASE AUTH (3 emails actifs)

### ✅ Email 1 : Vérification d'adresse email (Inscription Client)

**Scénario** : Scénario 1.1 - Inscription Client

**Déclencheur** :
- Utilisateur s'inscrit avec rôle "Client"
- Système crée compte Firebase Auth
- Firebase envoie automatiquement email de vérification

**Contenu de l'email** :
```
Objet : Vérifiez votre adresse email - ArtisanSafe

Bonjour Jean Dupont,

Bienvenue sur ArtisanSafe !

Pour activer votre compte et commencer à publier des demandes 
de travaux, veuillez vérifier votre adresse email en cliquant 
sur le lien ci-dessous :

[Vérifier mon adresse email]
(Lien valide 24 heures)

Si vous n'avez pas créé de compte sur ArtisanSafe, ignorez 
cet email.

Cordialement,
L'équipe ArtisanSafe
```

**Fichier concerné** : `frontend/src/lib/auth-service.ts` → `signUpClient()`

**Code** :
```typescript
import { sendEmailVerification } from 'firebase/auth';

// Après création compte
await sendEmailVerification(user);
```

**Remarques** :
- ✅ Email envoyé automatiquement par Firebase
- ⚠️ Template NON personnalisable (Firebase default)
- ✅ Obligatoire pour activer le compte

---

### ✅ Email 2 : Vérification d'adresse email (Inscription Artisan)

**Scénario** : Scénario 1.2 - Inscription Artisan

**Déclencheur** :
- Artisan s'inscrit avec rôle "Artisan"
- Système crée compte Firebase Auth
- Firebase envoie automatiquement email de vérification

**Contenu de l'email** :
```
Objet : Vérifiez votre adresse email - ArtisanSafe

Bonjour Pierre Martin,

Bienvenue sur ArtisanSafe !

Pour activer votre profil d'artisan et recevoir des demandes 
de devis, veuillez vérifier votre adresse email en cliquant 
sur le lien ci-dessous :

[Vérifier mon adresse email]
(Lien valide 24 heures)

Prochaines étapes après vérification :
1. Uploader vos documents (KBIS, assurances)
2. Validation par notre équipe
3. Profil visible par les clients

Si vous n'avez pas créé de compte sur ArtisanSafe, ignorez 
cet email.

Cordialement,
L'équipe ArtisanSafe
```

**Fichier concerné** : `frontend/src/lib/auth-service.ts` → `signUpArtisan()`

**Code** :
```typescript
import { sendEmailVerification } from 'firebase/auth';

// Après création compte artisan
await sendEmailVerification(user);
```

**Remarques** :
- ✅ Email envoyé automatiquement par Firebase
- ⚠️ Template NON personnalisable (Firebase default)
- ✅ Obligatoire pour activer le compte
- ✅ Après vérification, artisan peut uploader documents

---

### ✅ Email 3 : Réinitialisation de mot de passe

**Scénario** : Utilisateur a oublié son mot de passe

**Déclencheur** :
- Utilisateur clique sur "Mot de passe oublié ?" sur page connexion
- Saisit son email
- Firebase envoie lien de réinitialisation

**Contenu de l'email** :
```
Objet : Réinitialisation de votre mot de passe - ArtisanSafe

Bonjour,NODEMAILER + GMAIL (4 emails actifs)

> **✅ SYSTÈME ACTIF** : Ces emails sont **opérationnels** via Nodemailer + Gmail SMTP.  
> Configuration : `backend/.env` (SMTP_USER=mohamedalimrabet22@gmail.com)  
> Fichiers : `frontend/src/lib/firebase/email-notification-service.ts` + `backend/src/services/email-service.ts`

---

### ✅ Email 4 : Avertissement Suppression (15 jours avant) - **ACTIF**

**Scénario** : Admin programme suppression de compte

**Déclencheur** :
- Admin programme suppression avec période de recours de 15 jours
- Fonction `scheduleAccountDeletion()` dans `account-service.ts`

**Contenu de l'email** :
```
Objet : ⚠️ Avertissement : Suppression de votre compte ArtisanDispo

Bonjour [Nom Utilisateur],

Votre compte ArtisanDispo sera supprimé définitivement le [Date].

Raison de la suppression :
[Motif fourni par admin]

Ce qui sera supprimé :
- Votre profil complet (informations personnelles, photos)
- Vos documents vérifiés (KBIS, assurance, etc.)
- Votre agenda et disponibilités
- Vos messages et conversations

Ce qui sera conservé (obligations légales) :
- Vos avis publiés (anonymisés)
- Vos contrats signés (archives comptables)
- Votre historique de transactions (10 ans)

Vous avez jusqu'au [Date] pour :
- Contester cette décision en contactant notre support
- Télécharger vos données personnelles (RGPD)
- Récupérer vos documents importants

Contact : support@artisandispo.fr

Cette action fait suite à une décision administrative. Après la date 
indiquée, la suppression sera définitive et irréversible.

Cordialement,
L'équipe ArtisanDispo
```

**Fichier concerné** : 
- `frontend/src/lib/firebase/email-notification-service.ts` → `sendDeletionWarningEmail()`
- `frontend/src/lib/firebase/account-service.ts` → `scheduleAccountDeletion()`

**Code** :
```typescript
import { sendDeletionWarningEmail } from './email-notification-service';

// Dans scheduleAccountDeletion()
await sendDeletionWarningEmail(
  user.email,
  `${user.prenom} ${user.nom}`,
  reason,
  deletionDate
);
```

**Remarques** :
- ✅ Email envoyé via Nodemailer + Gmail
- ✅ Template HTML complet avec styling
- ✅ Période de recours : 15 jours
- ✅ Statut surveillé dans collection `email_notifications`

---

### ✅ Email 5 : Confirmation Suppression Définitive - **ACTIF**

**Scénario** : Compte supprimé définitivement après période de recours

**Déclencheur** :
- Admin ou Cloud Function exécute suppression définitive
- Fonction `deleteArtisanAccount()` ou `deleteClientAccount()`

**Contenu de l'email** :
```
Objet : 🗑️ Confirmation : Votre compte ArtisanDispo a été supprimé

Bonjour [Nom Utilisateur],

Votre compte ArtisanDispo a été supprimé définitivement.

Raison :
[Motif fourni par admin]

Données supprimées :
✓ Profil complet
✓ Documents (KBIS, assurances, pièces d'identité)
✓ Messages et conversations
✓ Agenda et disponibilités

Données conservées (obligations légales) :
- Avis publiés (anonymisés)
- Contrats signés (10 ans)
- Historique transactions (10 ans)

Si vous pensez qu'il s'agit d'une erreur, contactez :
support@artisandispo.fr

Cordialement,
L'équipe ArtisanDispo
```

**Fichier concerné** : 
- `frontend/src/lib/firebase/email-notification-service.ts` → `sendDeletionConfirmationEmail()`
- `frontend/src/lib/firebase/account-service.ts` → `deleteArtisanAccount()` / `deleteClientAccount()`

**Code** :
```typescript
import { sendDeletionConfirmationEmail } from './email-notification-service';

// Après suppression complète
await sendDeletionConfirmationEmail(
  user.email,
  `${user.prenom} ${user.nom}`,
  reason
);
```

**Remarques** :
- ✅ Email envoyé APRÈS suppression (dernière communication)
- ✅ Confirmé via Nodemailer + Gmail
- ✅ Archive email conservée dans `email_notifications`

---

### ✅ Email 6 : Suspension de Compte - **ACTIF**

**Scénario** : Admin suspend temporairement un compte

**Déclencheur** :
- Admin suspend compte (non-respect CGU, activité suspecte)
- Fonction `suspendAccount()` dans `account-service.ts`

**Contenu de l'email** :
```
Objet : 🔒 Suspension de votre compte ArtisanDispo

Bonjour [Nom Utilisateur],

Votre compte ArtisanDispo a été SUSPENDU temporairement.

Raison :
[Motif fourni par admin]

Conséquences :
❌ Connexion impossible
❌ Profil non visible
❌ Notifications désactivées

Actions possibles :
- Contacter le support : support@artisandispo.fr
- Fournir des explications
- Régulariser votre situation

Votre compte pourra être réactivé après examen de votre cas.

Cordialement,
L'équipe ArtisanDispo
```

**Fichier concerné** : 
- `frontend/src/lib/firebase/email-notification-service.ts` → `sendSuspensionEmail()`
- `frontend/src/lib/firebase/account-service.ts` → `suspendAccount()`

**Code** :
```typescript
import { sendSuspensionEmail } from './email-notification-service';

// Après suspension
await sendSuspensionEmail(
  user.email,
  `${user.prenom} ${user.nom}`,
  reason
);
```

**Remarques** :
- ✅ Email envoyé immédiatement après suspension
- ✅ Explications claires des conséquences
- ✅ Possibilité de contestation

---

### ✅ Email 7 : Réactivation de Compte - **ACTIF**

**Scénario** : Admin réactive un compte suspendu

**Déclencheur** :
- Admin réactive compte après résolution du problème
- Fonction `reactivateAccount()` dans `account-service.ts`

**Contenu de l'email** :
```
Objet : ✅ Réactivation de votre compte ArtisanDispo

Bonjour [Nom Utilisateur],

Bonne nouvelle ! Votre compte ArtisanDispo a été RÉACTIVÉ.

✅ Connexion possible
✅ Profil visible
✅ Notifications actives
✅ Toutes fonctionnalités rétablies

Vous pouvez de nouveau utiliser normalement votre compte.

Si vous rencontrez des problèmes, contactez-nous :
support@artisandispo.fr

Cordialement,
L'équipe ArtisanDispo
```

**Fichier concerné** : 
- `frontend/src/lib/firebase/email-notification-service.ts` → `sendReactivationEmail()`
- `frontend/src/lib/firebase/account-service.ts` → `reactivateAccount()`

**Code** :
```typescript
import { sendReactivationEmail } from './email-notification-service';

// Après réactivation
await sendReactivationEmail(
  user.email,
  `${user.prenom} ${user.nom}`
);
```

**Remarques** :
- ✅ Email de confirmation positive
- ✅ Toutes fonctionnalités rétablies
- ✅ Utilisateur peut se reconnecter immédiatement

---

## 3. EMAILS TRANSACTIONNELS (Gmail SMTP) - **11 EMAILS ACTIFS**

> **✅ IMPLÉMENTÉS** : Ces emails sont documentés dans SCENARIOS_COMPLETS_WORKFLOWS.md  
> Ils sont envoyés via **Gmail SMTP** (backend/src/services/email-service.ts)  
> Transition prévue vers **Brevo** quand volume > 300 emails/jour

---

### ✅ Email 8 : Profil Artisan Approuvé - **ACTIF** de passe :

[Réinitialiser mon mot de passe]
(Lien valide 1 heure)

Si vous n'avez pas demandé cette réinitialisation, ignorez 
cet email. Votre mot de passe actuel reste inchangé.

Cordialement,
L'équipe ArtisanSafe
```

**Fichier concerné** : `frontend/src/app/mot-de-passe-oublie/page.tsx`

**Code** :
```typescript
import { sendPasswordResetEmail } from 'firebase/auth';

await sendPasswordResetEmail(auth, email);
```

**Remarques** :
- ✅ Email envoyé automatiquement par Firebase
- ⚠️ Template NON personnalisable (Firebase default)
- ✅ Lien valide 1 heure
- ✅ Sécurisé (lien unique + expiration)

---

## 2. EMAILS RECOMMANDÉS POUR ÉVÉNEMENTS CRITIQUES

> **⚠️ IMPORTANT** : Ces emails ne sont PAS encore implémentés dans l'application.  
> Actuellement, seules des **notifications in-app** (Firestore) sont envoyées.  
> Les emails ci-dessous sont **RECOMMANDÉS** pour améliorer l'expérience utilisateur.

---

### 📧 Email 8 : Profil Artisan Approuvé (À IMPLÉMENTER)

**Scénario** : Scénario 1.5 - Validation Admin → Option A

**Déclencheur** :
- Admin approuve profil artisan
- `verificationStatus` → "approved"

**Contenu recommandé** :
```
Objet : 🎉 Votre profil artisan est approuvé !

Bonjour Pierre Martin,

Excellente nouvelle ! Votre profil ArtisanSafe vient d'être 
approuvé par notre équipe.

✅ Profil vérifié : Plomberie Martin
✅ Documents validés : KBIS, RC Pro, Garantie décennale
✅ Statut : Visible par les clients

Vous pouvez maintenant :
- Recevoir des demandes de devis clients
- Consulter les demandes publiques dans votre zone
- Créer et envoyer des devis

👉 [Accéder à mon tableau de bord artisan]

Prochaines étapes :
1. Complétez votre profil (photos, description)
2. Définissez vos zones d'intervention
3. Commencez à recevoir des demandes !

Besoin d'aide ? Consultez notre guide artisan :
👉 [Guide de démarrage artisan]

Cordialement,
L'équipe ArtisanSafe
```

**Fichier à modifier** : `frontend/src/lib/firebase/artisan-service.ts`

**Code proposé** :
```typescript
import { sendEmail } from '@/lib/email-service';

// Dans la fonction updateArtisan()
if (verificationStatus === 'approved') {
  await sendEmail({
    to: artisan.email,
    template: 'artisan-approved',
    data: {
      businessName: artisan.businessName,
      artisanName: `${artisan.prenom} ${artisan.nom}`,
      dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/artisan/dashboard`
    }
  });
}
```

**Bénéfice** :
- ✅ Artisan notifié immédiatement (même hors ligne)
- ✅ Explications claires des prochaines étapes
- ✅ Réduit support client ("Quand mon profil sera-t-il approuvé ?")

---

### 📧 Email 9 : Profil Artisan Rejeté (À IMPLÉMENTER)

**Scénario** : Scénario 1.5 - Validation Admin → Option B

**Déclencheur** :
- Admin rejette profil artisan
- `verificationStatus` → "rejected"

**Contenu recommandé** :
```
Objet : ⚠️ Documents non conformes - Action requise

Bonjour Pierre Martin,

Nous avons examiné votre demande d'inscription sur ArtisanSafe.

Malheureusement, nous ne pouvons pas approuver votre profil 
pour la raison suivante :

❌ Motif : SIRET invalide, KBIS expiré

Pour que votre profil soit approuvé, veuillez :
1. Vérifier votre numéro SIRET (14 chiffres)
2. Uploader un KBIS récent (moins de 3 mois)
3. Soumettre à nouveau vos documents

👉 [Modifier mes documents]

Besoin d'aide ?
- Consultez notre FAQ : [Lien FAQ]
- Contactez-nous : support@artisansafe.fr

Cordialement,
L'équipe ArtisanSafe
```

**Fichier à modifier** : `frontend/src/lib/firebase/artisan-service.ts`

**Code proposé** :
```typescript
if (verificationStatus === 'rejected') {
  await sendEmail({
    to: artisan.email,
    template: 'artisan-rejected',
    data: {
      businessName: artisan.businessName,
      artisanName: `${artisan.prenom} ${artisan.nom}`,
      rejectionReason: rejectionReason,
      documentsUrl: `${process.env.NEXT_PUBLIC_APP_URL}/artisan/documents`
    }
  });
}
```

**Bénéfice** :
- ✅ Communication claire du problème
- ✅ Instructions pour corriger
- ✅ Réduit frustration artisan

---

### 📧 Email 10 : Nouveau Devis Reçu (Client) (À IMPLÉMENTER)

**Scénario** : Scénario 3.3 - Artisan Envoie Devis

**Déclencheur** :
- Artisan envoie devis au client
- `statut` → "envoye"

**Contenu recommandé** :
```
Objet : 📄 Nouveau devis reçu - Plomberie Martin

Bonjour Jean Dupont,

Vous avez reçu un nouveau devis sur ArtisanSafe !

🏢 Artisan : Plomberie Martin
📍 Localisation : Paris 75010
⭐ Note : 4.8/5 (12 avis)

💰 Montant : 168€ TTC
⏱️ Délai : Intervention sous 48h
📅 Validité : Jusqu'au 21 mars 2026

Pour votre demande :
"Fuite d'eau sous évier"

👉 [Consulter le devis complet]

Actions disponibles :
✅ Accepter le devis (signature + paiement)
❌ Refuser le devis
💬 Poser des questions à l'artisan

⚠️ Ce devis expire le 21 mars 2026

Cordialement,
L'équipe ArtisanSafe
```

**Fichier à modifier** : `frontend/src/lib/firebase/devis-service.ts`

**Code proposé** :
```typescript
// Dans sendDevis()
await sendEmail({
  to: client.email,
  template: 'devis-received',
  data: {
    clientName: `${client.prenom} ${client.nom}`,
    artisanName: artisan.businessName,
    montantTTC: devis.montantTTC,
    delai: devis.delaiRealisation,
    devisUrl: `${process.env.NEXT_PUBLIC_APP_URL}/client/devis/${devisId}`,
    expirationDate: devis.dateValidite.toDate().toLocaleDateString('fr-FR')
  }
});
```

**Bénéfice** :
- ✅ Client notifié immédiatement (même hors ligne)
- ✅ Augmente taux de réponse au devis
- ✅ Rappel date d'expiration

---

### 📧 Email 11 : Devis Accepté (Artisan) (À IMPLÉMENTER)

**Scénario** : Scénario 4.2 - Client Accepte Devis

**Déclencheur** :
- Client accepte devis
- `statut` → "accepte"

**Contenu recommandé** :
```
Objet : 🎉 Devis accepté - Jean Dupont

Bonjour Pierre Martin,

Excellente nouvelle ! Votre devis vient d'être accepté.

👤 Client : Jean Dupont
💰 Montant : 168€ TTC
📍 Adresse : 12 rue de la Paix, Paris 75001

Pour votre prestation :
"Fuite d'eau sous évier"
- Déplacement et diagnostic
- Remplacement joint siphon
- Main d'œuvre réparation (1h)

⏱️ Délai promis : Intervention sous 48h

Prochaines étapes :
1. ✅ Client signe électroniquement
2. ✅ Client paie (168€ en séquestre)
3. 🚀 Vous pouvez démarrer les travaux

👉 [Voir détails du devis]

💡 Le paiement (168€) sera retenu en sécurité jusqu'à 
validation des travaux par le client.

Cordialement,
L'équipe ArtisanSafe
```

**Fichier à modifier** : `frontend/src/lib/firebase/devis-service.ts`

**Code proposé** :
```typescript
// Dans acceptDevis()
await sendEmail({
  to: artisan.email,
  template: 'devis-accepted',
  data: {
    artisanName: `${artisan.prenom} ${artisan.nom}`,
    clientName: `${client.prenom} ${client.nom}`,
    montantTTC: devis.montantTTC,
    adresse: devis.adresse,
    prestations: devis.prestations,
    devisUrl: `${process.env.NEXT_PUBLIC_APP_URL}/artisan/devis/${devisId}`
  }
});
```

**Bénéfice** :
- ✅ Artisan informé immédiatement
- ✅ Rappel délai promis
- ✅ Explications séquestre

---

### 📧 Email 12 : Paiement Confirmé (Client) (À IMPLÉMENTER)

**Scénario** : Scénario 6.1 - Client Paie via Stripe

**Déclencheur** :
- Paiement Stripe réussi
- `statut` → "paye"

**Contenu recommandé** :
```
Objet : ✅ Paiement confirmé - Devis Plomberie Martin

Bonjour Jean Dupont,

Votre paiement a été confirmé avec succès.

💳 Montant payé : 168€ TTC
🏢 Artisan : Plomberie Martin
🔒 Paiement sécurisé par Stripe

Détails de la transaction :
- Date : 19 février 2026 à 14:30
- Carte : •••• 4242
- Statut : En séquestre (sécurisé)

⚠️ IMPORTANT :
Votre paiement est retenu en SÉCURITÉ sur notre plateforme.
L'artisan recevra le montant UNIQUEMENT après que vous ayez 
validé les travaux.

Protection ArtisanSafe :
✅ Paiement sécurisé Stripe
✅ Séquestre jusqu'à validation travaux
✅ Médiation en cas de litige
✅ Garantie remboursement si non conforme

Prochaines étapes :
1. 🚀 L'artisan démarre les travaux
2. ✅ Vous validez la fin (ou validation auto 7 jours)
3. 💰 Paiement transféré à l'artisan

👉 [Suivre l'avancement]

📧 Reçu de paiement en pièce jointe.

Cordialement,
L'équipe ArtisanSafe
```

**Fichier à modifier** : `frontend/src/lib/stripe-service.ts`

**Code proposé** :
```typescript
// Après paiement réussi
await sendEmail({
  to: client.email,
  template: 'payment-confirmed',
  data: {
    clientName: `${client.prenom} ${client.nom}`,
    montantTTC: devis.montantTTC,
    artisanName: artisan.businessName,
    last4: paymentIntent.payment_method.card.last4,
    devisUrl: `${process.env.NEXT_PUBLIC_APP_URL}/client/devis/${devisId}`
  },
  attachments: [
    {
      filename: `recu-paiement-${devisId}.pdf`,
      content: await generateRecuPDF(devis, paymentIntent)
    }
  ]
});
```

**Bénéfice** :
- ✅ Confirmation officielle paiement
- ✅ Reçu PDF joint
- ✅ Explications séquestre (rassure client)

---

### 📧 Email 13 : Paiement Reçu (Artisan) (À IMPLÉMENTER)

**Scénario** : Scénario 6.1 - Client Paie via Stripe

**Déclencheur** :
- Paiement Stripe réussi
- `statut` → "paye"

**Contenu recommandé** :
```
Objet : 💰 Paiement reçu (en séquestre) - Jean Dupont

Bonjour Pierre Martin,

Le client a effectué le paiement pour votre devis.

💰 Montant : 168€ TTC
👤 Client : Jean Dupont
📅 Date paiement : 19 février 2026

⚠️ PAIEMENT EN SÉQUESTRE :
Le montant est actuellement retenu en sécurité sur notre 
plateforme. Vous le recevrez APRÈS validation des travaux
par le client.

🚀 Vous pouvez maintenant DÉMARRER LES TRAVAUX

Informations client :
📍 Adresse : 12 rue de la Paix, Paris 75001
📞 Téléphone : 06 12 34 56 78
📧 Email : jean.dupont@example.com

Prestations à réaliser :
- Déplacement et diagnostic
- Remplacement joint siphon
- Main d'œuvre réparation (1h)

⏱️ Délai promis : Intervention sous 48h

👉 [Démarrer les travaux]

Chronologie paiement :
1. ✅ Client a payé → En séquestre
2. 🚀 Vous réalisez les travaux
3. ✅ Client valide (ou validation auto 7j)
4. 💰 Transfert sur votre compte (2-5 jours)

Cordialement,
L'équipe ArtisanSafe
```

**Fichier à modifier** : `frontend/src/lib/stripe-service.ts`

**Code proposé** :
```typescript
// Après paiement réussi
await sendEmail({
  to: artisan.email,
  template: 'payment-received-artisan',
  data: {
    artisanName: `${artisan.prenom} ${artisan.nom}`,
    montantTTC: devis.montantTTC,
    clientName: `${client.prenom} ${client.nom}`,
    clientPhone: client.telephone,
    adresse: devis.adresse,
    prestations: devis.prestations,
    devisUrl: `${process.env.NEXT_PUBLIC_APP_URL}/artisan/devis/${devisId}`
  }
});
```

**Bénéfice** :
- ✅ Artisan informé immédiatement
- ✅ Explications claires séquestre
- ✅ Coordonnées client pour démarrage

---

### 📧 Email 14 : Travaux Terminés - Validation Requise (Client) (À IMPLÉMENTER)

**Scénario** : Scénario 7.2 - Artisan Déclare Fin

**Déclencheur** :
- Artisan déclare fin des travaux
- `statut` → "travaux_termines"

**Contenu recommandé** :
```
Objet : ✅ Travaux terminés - Validez sous 7 jours

Bonjour Jean Dupont,

L'artisan Plomberie Martin vient de déclarer avoir terminé 
les travaux.

🏢 Artisan : Plomberie Martin
📅 Date de fin : 19 février 2026 à 15:30
💰 Montant : 168€ (en séquestre)

💬 Commentaire de l'artisan :
"Réparation effectuée. Joint siphon remplacé. Fuite résolue.
Aucun problème détecté."

📸 Photos des travaux : [Voir les photos]

⚠️ ACTION REQUISE DANS LES 7 JOURS :

Vous avez JUSQU'AU 26 février 2026 pour :

✅ Option 1 : VALIDER les travaux
   → Le paiement (168€) sera transféré à l'artisan sous 48h
   → Vous pourrez laisser un avis
   
⚠️ Option 2 : SIGNALER un problème
   → Le paiement reste bloqué
   → Notre équipe intervient comme médiateur
   → Résolution garantie

🕒 Si aucune action : Validation AUTOMATIQUE le 26 février

👉 [Valider les travaux]  [Signaler un problème]

Protection ArtisanSafe :
✅ Délai de 7 jours pour vérifier
✅ Médiation gratuite en cas de litige
✅ Paiement bloqué tant que non validé

Cordialement,
L'équipe ArtisanSafe
```

**Fichier à modifier** : `frontend/src/lib/firebase/devis-service.ts`

**Code proposé** :
```typescript
// Dans declarerFinTravaux()
await sendEmail({
  to: client.email,
  template: 'travaux-termines-validation',
  data: {
    clientName: `${client.prenom} ${client.nom}`,
    artisanName: artisan.businessName,
    dateFin: devis.travaux.dateFin.toDate().toLocaleDateString('fr-FR'),
    dateValidationAuto: devis.travaux.dateValidationAuto.toDate().toLocaleDateString('fr-FR'),
    montantTTC: devis.montantTTC,
    commentaireArtisan: devis.travaux.commentaireArtisan,
    photosUrl: devis.travaux.photosApres,
    devisUrl: `${process.env.NEXT_PUBLIC_APP_URL}/client/devis/${devisId}`
  }
});
```

**Bénéfice** :
- ✅ Client informé immédiatement
- ✅ Rappel délai 7 jours
- ✅ Explications validation auto
- ✅ Incitation à agir rapidement

---

### 📧 Email 15 : Validation Automatique (Client) (À IMPLÉMENTER)

**Scénario** : Scénario 8.3 - Validation Auto 7 jours

**Déclencheur** :
- 7 jours après déclaration fin
- Aucune action client
- `statut` → "termine_auto_valide"

**Contenu recommandé** :
```
Objet : ✅ Travaux validés automatiquement - Paiement transféré

Bonjour Jean Dupont,

Les travaux de Plomberie Martin ont été VALIDÉS AUTOMATIQUEMENT 
après 7 jours sans réponse de votre part.

🏢 Artisan : Plomberie Martin
📅 Date validation auto : 26 février 2026
💰 Paiement transféré : 168€

Détails :
- Date fin travaux : 19 février 2026
- Délai validation : 7 jours
- Aucune action reçue → Validation automatique

⚠️ IMPORTANT :
Le paiement (168€) a été transféré à l'artisan.

En cas de problème constaté APRÈS cette validation :
- Contactez notre support : support@artisansafe.fr
- Délai de réclamation : 30 jours
- Médiation possible si justifiée

⭐ DONNEZ VOTRE AVIS !

Votre avis aide d'autres clients à choisir le bon artisan.
Vous avez 30 jours pour partager votre expérience.

👉 [Donner mon avis maintenant]

Cordialement,
L'équipe ArtisanSafe
```

**Fichier à modifier** : Cloud Function `functions/src/autoValidateDevis.ts`

**Code proposé** :
```typescript
// Dans la fonction de validation auto
await sendEmail({
  to: client.email,
  template: 'validation-automatique',
  data: {
    clientName: `${client.prenom} ${client.nom}`,
    artisanName: artisan.businessName,
    montantTTC: devis.montantTTC,
    dateFin: devis.travaux.dateFin.toDate().toLocaleDateString('fr-FR'),
    avisUrl: `${process.env.NEXT_PUBLIC_APP_URL}/client/avis/nouveau?devisId=${devisId}`
  }
});
```

**Bénéfice** :
- ✅ Client informé de la validation
- ✅ Explications claires du processus
- ✅ Rappel possibilité réclamation
- ✅ Invitation à donner avis

---

### 📧 Email 16 : Paiement Transféré (Artisan) (À IMPLÉMENTER)

**Scénario** : Scénario 8.1 ou 8.3 - Validation Travaux

**Déclencheur** :
- Client valide travaux (manuel ou auto)
- Transfert Stripe effectué

**Contenu recommandé** :
```
Objet : 💰 Paiement transféré - 168€ disponible sous 2-5 jours

Bonjour Pierre Martin,

Bonne nouvelle ! Le paiement pour votre devis vient d'être 
transféré sur votre compte.

💰 Montant : 168€
👤 Client : Jean Dupont
📅 Date transfert : 19 février 2026
✅ Travaux validés par le client

Détails du transfert :
- Montant brut : 168€
- Commission ArtisanSafe : 12€ (7%)
- Montant net : 156€
- Disponibilité : 2-5 jours ouvrés

📊 Votre compte Stripe :
[Consulter votre compte Stripe]

Transaction :
- ID Stripe : tr_3ABC123...
- Devis : DEV-2026-001
- Date validation : 19 février 2026 à 16:45

⭐ Le client peut maintenant vous laisser un avis !

💡 Prochaines étapes :
- Attendez 2-5 jours pour voir l'argent sur votre compte
- Répondez aux avis clients (professionnalisme)
- Continuez à recevoir de nouvelles demandes !

👉 [Voir mes transactions]

Cordialement,
L'équipe ArtisanSafe
```

**Fichier à modifier** : `frontend/src/lib/firebase/devis-service.ts`

**Code proposé** :
```typescript
// Après transfert Stripe
await sendEmail({
  to: artisan.email,
  template: 'paiement-transfere',
  data: {
    artisanName: `${artisan.prenom} ${artisan.nom}`,
    montantBrut: devis.montantTTC,
    commission: devis.montantTTC * 0.07,
    montantNet: devis.montantTTC * 0.93,
    clientName: `${client.prenom} ${client.nom}`,
    transferId: transfer.id,
    stripeAccountUrl: `https://dashboard.stripe.com/connect/accounts/${artisan.stripeAccountId}`
  }
});
```

**Bénéfice** :
- ✅ Artisan informé du transfert
- ✅ Détails transparents (commission)
- ✅ Rappel délai bancaire

---

### 📧 Email 17 : Donnez votre avis ! (Client) (À IMPLÉMENTER)

**Scénario** : Scénario 8.1 ou 8.3 - Après Validation Travaux

**Déclencheur** :
- Client valide travaux (manuel ou auto)
- Notification avis envoyée

**Contenu recommandé** :
```
Objet : ⭐ Partagez votre expérience avec Plomberie Martin

Bonjour Jean Dupont,

Merci d'avoir utilisé ArtisanSafe pour vos travaux !

Votre projet est maintenant terminé :
🏢 Artisan : Plomberie Martin
💰 Montant : 168€
✅ Travaux validés le 19 février 2026

⭐ VOTRE AVIS COMPTE !

Aidez d'autres clients à choisir le bon artisan en partageant 
votre expérience (2 minutes) :

- L'artisan était-il ponctuel ?
- Les travaux sont-ils conformes ?
- Recommanderiez-vous cet artisan ?

👉 [Donner mon avis maintenant]

Votre avis sera visible publiquement sur le profil de 
l'artisan et aidera la communauté ArtisanSafe.

📅 Délai : 30 jours pour donner votre avis

💡 Pourquoi donner un avis ?
✅ Aide d'autres clients
✅ Valorise les bons artisans
✅ Améliore la qualité du service

Merci pour votre confiance !

Cordialement,
L'équipe ArtisanSafe
```

**Fichier à modifier** : `frontend/src/lib/firebase/devis-service.ts`

**Code proposé** :
```typescript
// Après validation travaux
await sendEmail({
  to: client.email,
  template: 'demande-avis',
  data: {
    clientName: `${client.prenom} ${client.nom}`,
    artisanName: artisan.businessName,
    montantTTC: devis.montantTTC,
    dateValidation: devis.travaux.dateValidationClient.toDate().toLocaleDateString('fr-FR'),
    avisUrl: `${process.env.NEXT_PUBLIC_APP_URL}/client/avis/nouveau?devisId=${devisId}`,
    expirationJours: 30
  }
});
```

**Bénéfice** :
- ✅ Augmente taux de collecte d'avis
- ✅ Rappel importance avis
- ✅ Lien direct vers formulaire

---

### 📧 Email 18 : Nouvel Avis Reçu (Artisan) (À IMPLÉMENTER)

**Scénario** : Scénario 9.2 - Client Donne Avis

**Déclencheur** :
- Client publie avis
- Avis créé dans Firestore

**Contenu recommandé** :
```
Objet : ⭐ Nouvel avis reçu - 5/5 étoiles !

Bonjour Pierre Martin,

Félicitations ! Vous avez reçu un nouvel avis sur ArtisanSafe.

⭐⭐⭐⭐⭐ 5/5 étoiles

👤 Client : Jean D.
📅 Date publication : 19 février 2026

💬 Avis du client :
"Très bon artisan, ponctuel et professionnel. Travail soigné,
fuite résolue rapidement. Je recommande vivement !"

📊 Impact sur votre profil :
- Note moyenne : 4.58/5 (6 avis)
- Avis 5 étoiles : 4 (67%)
- Visibilité profil : +15% (excellent)

💬 RÉPONDEZ À CET AVIS !

Montrez votre professionnalisme en répondant au client.
Les artisans qui répondent aux avis obtiennent +30% de 
demandes en moyenne.

👉 [Répondre à cet avis]

💡 Conseils pour répondre :
✅ Remerciez le client
✅ Mentionnez un détail du chantier
✅ Restez professionnel et courtois

Continuez comme ça !

Cordialement,
L'équipe ArtisanSafe
```

**Fichier à modifier** : `frontend/src/lib/firebase/avis-service.ts`

**Code proposé** :
```typescript
// Dans createAvis()
await sendEmail({
  to: artisan.email,
  template: 'nouvel-avis-recu',
  data: {
    artisanName: `${artisan.prenom} ${artisan.nom}`,
    note: avis.note,
    commentaire: avis.commentaire,
    clientName: `${client.prenom} ${client.nom.charAt(0)}.`,
    noteMoyenne: artisan.stats.noteMoyenne,
    nombreAvis: artisan.stats.nombreAvis,
    avisUrl: `${process.env.NEXT_PUBLIC_APP_URL}/artisan/avis`
  }
});
```

**Bénéfice** :
- ✅ Artisan informé immédiatement
- ✅ Incitation à répondre (augmente engagement)
- ✅ Stats impact sur profil

---

### 📧 Email 19 : Réponse à votre avis (Client) (À IMPLÉMENTER)

**Scénario** : Scénario 10.2 - Artisan Répond à Avis

**Déclencheur** :
- Artisan répond à avis client
- `reponseArtisan` ajoutée

**Contenu recommandé** :
```
Objet : 💬 Plomberie Martin a répondu à votre avis

Bonjour Jean Dupont,

L'artisan Plomberie Martin vient de répondre à votre avis !

⭐ Votre avis : 5/5 étoiles
📅 Publié le : 19 février 2026

💬 Votre commentaire :
"Très bon artisan, ponctuel et professionnel. Travail soigné,
fuite résolue rapidement. Je recommande vivement !"

💬 Réponse de Plomberie Martin :
"Merci beaucoup Jean pour cet avis très positif ! C'était 
un plaisir de travailler pour vous. N'hésitez pas à me 
recontacter pour vos prochains travaux de plomberie.
Cordialement, Pierre Martin"

👉 [Voir la conversation complète]

💡 Continuez à utiliser ArtisanSafe pour vos prochains 
travaux et bénéficiez d'artisans certifiés !

Cordialement,
L'équipe ArtisanSafe
```

**Fichier à modifier** : `frontend/src/lib/firebase/avis-service.ts`

**Code proposé** :
```typescript
// Dans addReponseArtisan()
await sendEmail({
  to: client.email,
  template: 'reponse-avis',
  data: {
    clientName: `${client.prenom} ${client.nom}`,
    artisanName: artisan.businessName,
    commentaireClient: avis.commentaire,
    reponseArtisan: reponseTexte,
    avisUrl: `${process.env.NEXT_PUBLIC_APP_URL}/client/avis`
  }
});
```

**Bénéfice** :
- ✅ Client notifié de la réponse
- ✅ Encourage dialogue client-artisan
- ✅ Augmente engagement plateforme

---

### 📧 Email 20 : Rappel - Devis Expire Bientôt (Client) (À IMPLÉMENTER)

**Scénario** : 3 jours avant expiration devis

**Déclencheur** :
- Devis envoyé il y a 27 jours
- `statut` = "envoye"
- `dateValidite` dans 3 jours

**Contenu recommandé** :
```
Objet : ⏰ Rappel - Votre devis expire dans 3 jours

Bonjour Jean Dupont,

Le devis que vous avez reçu de Plomberie Martin expire 
bientôt !

🏢 Artisan : Plomberie Martin
💰 Montant : 168€ TTC
⏰ Expiration : 21 mars 2026 (dans 3 jours)

Pour votre demande :
"Fuite d'eau sous évier"

⚠️ ACTION REQUISE :

Si vous souhaitez accepter ce devis, vous devez agir avant 
le 21 mars 2026.

👉 [Consulter le devis]

Options disponibles :
✅ Accepter maintenant (signature + paiement)
❌ Refuser le devis
💬 Poser des questions à l'artisan
📞 Demander une nouvelle date de validité

⏰ Après expiration :
- Le devis ne sera plus valable
- Vous devrez demander un nouveau devis
- Les prix peuvent avoir changé

Besoin d'aide pour décider ?
Consultez le profil de l'artisan :
👉 [Voir profil + avis clients]

Cordialement,
L'équipe ArtisanSafe
```

**Fichier à créer** : Cloud Function `functions/src/sendDevisExpirationReminder.ts`

**Code proposé** :
```typescript
// Cloud Function quotidienne
const threeDaysFromNow = new Date();
threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

const devisExpirant = await db.collection('devis')
  .where('statut', '==', 'envoye')
  .where('dateValidite', '<=', threeDaysFromNow)
  .where('dateValidite', '>', new Date())
  .get();

for (const doc of devisExpirant.docs) {
  await sendEmail({
    to: client.email,
    template: 'devis-expiration-reminder',
    data: {
      clientName: `${client.prenom} ${client.nom}`,
      artisanName: artisan.businessName,
      montantTTC: devis.montantTTC,
      expirationDate: devis.dateValidite.toDate().toLocaleDateString('fr-FR'),
      joursRestants: 3,
      devisUrl: `${process.env.NEXT_PUBLIC_APP_URL}/client/devis/${devis.id}`
    }
  });
}
```

**Bénéfice** :
- ✅ Réduit taux d'expiration devis
- ✅ Incite à la décision
- ✅ Améliore taux de conversion

---

### 📧 Email 21 : Litige Enregistré (Client) (À IMPLÉMENTER)

**Scénario** : Scénario 8.2 - Client Signale Problème

**Déclencheur** :
- Client signale litige
- `statut` → "litige"

**Contenu recommandé** :
```
Objet : ⚠️ Litige enregistré - Nous intervenons

Bonjour Jean Dupont,

Votre signalement de problème a bien été enregistré.

🏢 Artisan : Plomberie Martin
💰 Montant : 168€ (BLOQUÉ en séquestre)
📅 Date signalement : 19 février 2026

⚠️ Problème signalé :
"La fuite n'est pas résolue. L'eau continue de couler sous 
l'évier. Le joint installé semble défectueux."

🛡️ PROTECTION ARTISANSAFE ACTIVÉE :

✅ Paiement BLOQUÉ (168€ reste en séquestre)
✅ Équipe médiation contactée
✅ Résolution garantie

Prochaines étapes :
1. Notre équipe examine votre signalement (24-48h)
2. Nous contactons l'artisan pour explications
3. Médiation pour trouver une solution :
   - Nouvelle intervention gratuite
   - Remboursement partiel
   - Remboursement intégral si justifié

📧 Vous serez contacté par email sous 48h maximum.

📞 Besoin urgent ?
Contactez notre support : support@artisansafe.fr
Tél : 01 23 45 67 89 (Lun-Ven 9h-18h)

Documents utiles :
- Vos photos du problème : [Voir photos]
- Devis original : [Consulter devis]

Nous mettons tout en œuvre pour résoudre ce litige 
rapidement et équitablement.

Cordialement,
L'équipe Médiation ArtisanSafe
```

**Fichier à modifier** : `frontend/src/lib/firebase/litige-service.ts`

**Code proposé** :
```typescript
// Dans signalerProbleme()
await sendEmail({
  to: client.email,
  template: 'litige-enregistre-client',
  data: {
    clientName: `${client.prenom} ${client.nom}`,
    artisanName: artisan.businessName,
    montantTTC: devis.montantTTC,
    motifLitige: litige.motif,
    descriptionLitige: litige.description,
    devisUrl: `${process.env.NEXT_PUBLIC_APP_URL}/client/devis/${devis.id}`,
    supportEmail: 'support@artisansafe.fr'
  }
});
```

**Bénéfice** :
- ✅ Client rassuré (paiement bloqué)
- ✅ Délai d'intervention annoncé
- ✅ Procédure claire

---

### 📧 Email 22 : Litige Signalé (Artisan) (À IMPLÉMENTER)

**Scénario** : Scénario 8.2 - Client Signale Problème

**Déclencheur** :
- Client signale litige
- `statut` → "litige"

**Contenu recommandé** :
```
Objet : ⚠️ Problème signalé par le client - Action requise

Bonjour Pierre Martin,

Le client Jean Dupont a signalé un problème concernant 
vos travaux.

👤 Client : Jean Dupont
💰 Montant : 168€ (BLOQUÉ en séquestre)
📅 Date signalement : 19 février 2026

⚠️ Motif du signalement :
Type : Problème non résolu

💬 Description du client :
"La fuite n'est pas résolue. L'eau continue de couler sous 
l'évier. Le joint installé semble défectueux."

📸 Photos du problème : [Voir photos]

🛡️ PROCÉDURE DE MÉDIATION :

⚠️ Le paiement (168€) reste BLOQUÉ jusqu'à résolution.

Vos options :
1️⃣ Proposer une nouvelle intervention GRATUITE
   → Réparer le problème identifié
   → Client valide → Paiement débloqué

2️⃣ Contester le signalement
   → Expliquer votre point de vue
   → Médiation équipe ArtisanSafe
   → Décision basée sur preuves (photos, devis)

3️⃣ Proposition arrangement
   → Remboursement partiel
   → Accord amiable

⏰ ACTION REQUISE SOUS 48H :

👉 [Répondre au litige]

💡 Conseils :
✅ Restez professionnel et courtois
✅ Analysez les photos du client
✅ Proposez solution constructive
✅ Documentez avec photos si possible

📧 Notre équipe médiation vous contactera sous 24-48h
pour faciliter la résolution.

Impact sur votre profil :
⚠️ Litige en cours visible temporairement
✅ Résolution positive = aucun impact
❌ Litige non résolu = impact sur visibilité

Cordialement,
L'équipe Médiation ArtisanSafe
```

**Fichier à modifier** : `frontend/src/lib/firebase/litige-service.ts`

**Code proposé** :
```typescript
// Dans signalerProbleme()
await sendEmail({
  to: artisan.email,
  template: 'litige-signale-artisan',
  data: {
    artisanName: `${artisan.prenom} ${artisan.nom}`,
    clientName: `${client.prenom} ${client.nom}`,
    montantTTC: devis.montantTTC,
    motifLitige: litige.motif,
    descriptionLitige: litige.description,
    photosLitige: litige.photos,
    litigeUrl: `${process.env.NEXT_PUBLIC_APP_URL}/artisan/litiges/${litige.id}`
  }
});
```

**Bénéfice** :
- ✅ Artisan informé immédiatement
- ✅ Incitation à résolution rapide
- ✅ Explications impact profil

---

## 4. ARCHITECTURE TECHNIQUE

### Stack Technique Recommandée

**Service d'emails** : Plusieurs options possibles

#### Option 1 : SendGrid (⭐ RECOMMANDÉ)
```typescript
// Installation
npm install @sendgrid/mail

// Configuration
import sgMail from '@sendgrid/mail';
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Envoi email
await sgMail.send({
  to: 'client@example.com',
  from: 'noreply@artisansafe.fr',
  templateId: 'd-1234567890abcdef',
  dynamicTemplateData: {
    clientName: 'Jean Dupont',
    artisanName: 'Plomberie Martin',
    montantTTC: 168
  }
});
```

**Avantages SendGrid** :
- ✅ 100 emails/jour gratuits
- ✅ Templates visuels drag & drop
- ✅ Analytics détaillés (ouvertures, clics)
- ✅ Gestion désabonnements automatique
- ✅ Réputation IP excellente

#### Option 2 : Nodemailer + Gmail
```typescript
// Installation
npm install nodemailer

// Configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Envoi email
await transporter.sendMail({
  from: '"ArtisanSafe" <noreply@artisansafe.fr>',
  to: 'client@example.com',
  subject: 'Nouveau devis reçu',
  html: htmlTemplate
});
```

**Avantages Nodemailer** :
- ✅ Gratuit (si compte Gmail)
- ✅ Contrôle total templates
- ✅ Simple à configurer
- ❌ Limite 500 emails/jour (Gmail)
- ❌ Risque spam si volume élevé

#### Option 3 : Resend (🆕 Modern)
```typescript
// Installation
npm install resend

// Configuration
const resend = new Resend(process.env.RESEND_API_KEY);

// Envoi email
await resend.emails.send({
  from: 'ArtisanSafe <onboarding@resend.dev>',
  to: 'client@example.com',
  subject: 'Nouveau devis reçu',
  react: EmailTemplate({ clientName, artisanName })
});
```

**Avantages Resend** :
- ✅ 100 emails/jour gratuits
- ✅ Templates React JSX (moderne)
- ✅ API simple
- ✅ Pricing transparent

---

### 🔧 Configuration Actuelle (Nodemailer + Gmail)

**Fichier** : `backend/.env`

```env
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=mohamedalimrabet22@gmail.com
SMTP_PASSWORD=rmhn dhal kpeh zypd  # Mot de passe d'application Gmail
```

**Surveillance automatique** :
```typescript
// backend/src/server.ts
import { startEmailWatcher } from './services/email-service';

// Lance surveillance toutes les 5 minutes
if (process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
  await startEmailWatcher();
  console.log('📧 Service email actif (Nodemailer + Gmail)');
}
```

**Workflow complet** :
```
1. Frontend (email-notification-service.ts)
   → Appelle sendDeletionWarningEmail(email, nom, raison, date)
   → Crée document dans collection Firestore 'email_notifications'
   → Champs : to, subject, htmlContent, textContent, type, status='pending'

2. Backend (email-service.ts - Surveille toutes les 5 min)
   → Récupère emails status='pending' (max 50 par batch)
   → Envoie via Nodemailer + Gmail SMTP
   → Marque status='sent' (succès) ou status='failed' (échec)

3. Résultat
   → Email reçu dans boîte mail utilisateur
   → Log : ✅ Email envoyé à user@example.com - ID: <messageId>
   → Ou log : ❌ Erreur email doc123: Invalid recipient
```

**Tests manuels** :
```bash
# Tester envoi emails en attente
curl -X POST http://localhost:5000/api/v1/emails/send-pending
```

**Limite Gmail** :
- ⚠️ **500 emails/jour max** avec compte Gmail standard
- ✅ Suffisant pour MVP ArtisanSafe (< 50 emails/jour estimés)
- 💡 Passer à SendGrid si volume > 500/jour

---

### Service Email Centralisé

**Fichier** : `backend/src/services/email-service.ts`

```typescript
import sgMail from '@sendgrid/mail';
import { EmailTemplate, EmailData } from '@/types/email';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

const TEMPLATES: Record<EmailTemplate, string> = {
  'artisan-approved': 'd-1234567890abcdef',
  'artisan-rejected': 'd-abcdef1234567890',
  'devis-received': 'd-fedcba0987654321',
  'devis-accepted': 'd-1122334455667788',
  'payment-confirmed': 'd-9988776655443322',
  // ... autres templates
};

export async function sendEmail(
  to: string,
  template: EmailTemplate,
  data: EmailData
): Promise<void> {
  try {
    await sgMail.send({
      to,
      from: {
        email: 'noreply@artisansafe.fr',
        name: 'ArtisanSafe'
      },
      templateId: TEMPLATES[template],
      dynamicTemplateData: data,
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true }
      }
    });
    
    console.log(`✅ Email sent: ${template} to ${to}`);
  } catch (error) {
    console.error(`❌ Email failed: ${template}`, error);
    // Ne pas bloquer l'exécution si email échoue
  }
}
```

---

### Bonnes Pratiques

#### 1. Emails Transactionnels vs Marketing

**Transactionnels** (⭐ Prioritaire) :
- Email vérification
- Paiement confirmé
- Devis reçu
- Travaux terminés
- ✅ Taux ouverture élevé (60-80%)
- ✅ Contenu personnalisé

**Marketing** (📢 Optionnel) :
- Newsletter mensuelle
- Promotions artisans
- Conseils travaux
- ⚠️ Nécessite opt-in (RGPD)

#### 2. Personnalisation

Toujours inclure :
- ✅ Nom du destinataire (`Bonjour Jean Dupont`)
- ✅ Détails transaction (montant, artisan, date)
- ✅ Lien d'action direct (CTA clair)
- ✅ Signature ArtisanSafe

#### 3. Design Responsive

Template mobile-first :
```html
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; }
      .button { width: 100% !important; }
    }
  </style>
</head>
<body>
  <table class="container" width="600">
    <tr>
      <td>
        <h1>{{ title }}</h1>
        <p>{{ content }}</p>
        <a href="{{ actionUrl }}" class="button">{{ actionText }}</a>
      </td>
    </tr>
  </table>
</body>
</html>
```

#### 4. Désabonnement (RGPD)

Footer obligatoire :
```html
<footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc;">
  <p style="font-size: 12px; color: #666;">
    Vous recevez cet email car vous avez un compte sur ArtisanSafe.
    <br>
    <a href="{{ unsubscribeUrl }}">Se désabonner des emails marketing</a>
    <br>
    ArtisanSafe - 123 rue Example, 75001 Paris
  </p>
</footer>
```

---

## 5. IMPLÉMENTATION PROPOSÉE

### Plan de Déploiement

#### Phase 1 : Emails Critiques (Semaine 1-2)
```
✅ Email vérification (déjà fait - Firebase)
📧 Email profil approuvé (artisan)
📧 Email profil rejeté (artisan)
📧 Email devis reçu (client)
📧 Email paiement confirmé (client)
```

**Impact** : +40% engagement utilisateurs

#### Phase 2 : Emails Workflow (Semaine 3-4)
```
📧 Email travaux terminés (client)
📧 Email paiement transféré (artisan)
📧 Email donnez votre avis (client)
📧 Email nouvel avis reçu (artisan)
```

**Impact** : +30% taux d'avis collectés

#### Phase 3 : Emails Rappels (Semaine 5-6)
```
📧 Email rappel devis expire bientôt (client)
📧 Email rappel validation auto (client)
📧 Email rappel donner avis (client)
```

**Impact** : +20% conversions devis

#### Phase 4 : Emails Litiges (Semaine 7-8)
```
📧 Email litige enregistré (client)
📧 Email litige signalé (artisan)
📧 Email litige résolu (client + artisan)
```

**Impact** : Meilleure gestion litiges

---

### Métriques à Suivre

**KPIs Emails** :
```
📊 Taux d'envoi réussi : > 99%
📊 Taux d'ouverture : > 40% (transactionnels)
📊 Taux de clics : > 10%
📊 Taux de désabonnement : < 0.5%
📊 Taux de spam : < 0.1%
```

**Dashboard SendGrid** :
- Emails envoyés / jour
- Emails ouverts / jour
- Clics CTA / jour
- Bounces (emails invalides)
- Spam reports

---

## 📊 RÉCAPITULATIF FINAL

### ✅ Emails Actuellement Envoyés (7)

**Système Firebase Auth (3 emails)** :

| # | Email | Destinataire | Déclencheur | Status |
|---|-------|--------------|-------------|--------|
| 1 | Vérification email | Client | Inscription | ✅ Actif |
| 2 | Vérification email | Artisan | Inscription | ✅ Actif |
| 3 | Réinitialisation MDP | Tous | Mot de passe oublié | ✅ Actif |

**Système Nodemailer + Gmail (4 emails)** :

| # | Email | Destinataire | Déclencheur | Status |
|---|-------|--------------|-------------|--------|
| 4 | Avertissement suppression | Client/Artisan | Admin programme suppression | ✅ Actif |
| 5 | Confirmation suppression | Client/Artisan | Suppression définitive | ✅ Actif |
| 6 | Suspension compte | Client/Artisan | Admin suspend | ✅ Actif |
| 7 | Réactivation compte | Client/Artisan | Admin réactive | ✅ Actif |

### 📧 Emails Recommandés à Implémenter (15)

| # | Email | Destinataire | Déclencheur | Priorité |
|---|-------|--------------|-------------|----------|
| 8 | Profil approuvé | Artisan | Admin approuve | 🔥 Haute |
| 9 | Profil rejeté | Artisan | Admin rejette | 🔥 Haute |
| 10 | Devis reçu | Client | Artisan envoie | 🔥 Haute |
| 11 | Devis accepté | Artisan | Client accepte | 🔥 Haute |
| 12 | Paiement confirmé | Client | Paiement Stripe | 🔥 Haute |
| 13 | Paiement reçu | Artisan | Paiement Stripe | 🔥 Haute |
| 14 | Travaux terminés | Client | Artisan déclare fin | 🔥 Haute |
| 15 | Validation auto | Client | 7j sans action | 🟡 Moyenne |
| 16 | Paiement transféré | Artisan | Validation travaux | 🔥 Haute |
| 17 | Donnez votre avis | Client | Validation travaux | 🟡 Moyenne |
| 18 | Nouvel avis reçu | Artisan | Client publie avis | 🟡 Moyenne |
| 19 | Réponse à votre avis | Client | Artisan répond | 🟢 Basse |
| 20 | Rappel devis expire | Client | 3j avant expiration | 🟡 Moyenne |
| 21 | Litige enregistré | Client | Client signale | 🔥 Haute |
| 22 | Litige signalé | Artisan | Client signale | 🔥 Haute |

**Total** : **22 emails** (7 actifs + 15 à implémenter)

---

## 🎯 RECOMMANDATIONS FINALES

### Impératifs

1. ✅ **Implémenter SendGrid** (meilleure solution)
2. ✅ **Créer templates visuels** (branding ArtisanSafe)
3. ✅ **Tester emails** sur tous clients (Gmail, Outlook, etc.)
4. ✅ **Suivre métriques** (ouvertures, clics, conversions)
5. ✅ **Respecter RGPD** (désabonnement facile)

### Éviter

1. ❌ Spam - Max 1-2 emails/jour par utilisateur
2. ❌ Contenu générique - Toujours personnaliser
3. ❌ Images lourdes - Optimiser < 100KB
4. ❌ Liens cassés - Tester avant envoi
5. ❌ Oublier mobile - 60% ouvertures mobile

### Budget Estimé

**SendGrid** :
- 0-100 emails/jour : **Gratuit**
- 101-40k emails/mois : **19.95$/mois**
- 40k-100k emails/mois : **89.95$/mois**

**Pour ArtisanSafe** : Gratuit pendant 6 premiers mois (< 100 emails/jour)

---

**Document créé le** : 20 février 2026  
**Dernière mise à jour** : 20 février 2026  
**Auteur** : GitHub Copilot
