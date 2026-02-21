# 🧪 Guide de Test : Protection Doublons de Comptes

## Vue d'ensemble

Ce guide détaille comment tester la protection contre les doublons de comptes (même email avec différents providers).

## ✅ Fonctionnalités à tester

### 1. Inscription email/password puis Google Sign-In

**Scénario** : Utilisateur crée un compte avec email/password, puis essaie de se connecter avec Google.

**Étapes** :
```
1. Aller sur /inscription
2. Choisir "Client" ou "Artisan"
3. Remplir le formulaire :
   - Email : test-doublon@example.com
   - Mot de passe : TestPassword123!
   - Autres champs requis
4. Cliquer "S'inscrire"

Résultat attendu :
✅ Inscription réussie
✅ Redirection vers dashboard
✅ Email de vérification envoyé

5. Se déconnecter
6. Aller sur /connexion
7. Cliquer "Se connecter avec Google"
8. Sélectionner test-doublon@example.com dans la popup Google

Résultat attendu (APRÈS FIX) :
❌ Message d'erreur : "Ce compte existe déjà avec un mot de passe. Veuillez vous connecter avec votre mot de passe."
❌ Déconnexion automatique
❌ PAS de doublon créé
```

**Vérification technique** :
```bash
# Lancer le script de détection
cd backend
node scripts/detect-duplicate-accounts.js

# Résultat attendu :
# ✅ Aucun doublon détecté !
```

---

### 2. Google Sign-In puis inscription email/password

**Scénario** : Utilisateur crée un compte avec Google, puis essaie de s'inscrire avec email/password.

**Étapes** :
```
1. Aller sur /connexion
2. Cliquer "Se connecter avec Google"
3. Sélectionner test-doublon2@example.com dans la popup Google
4. Choisir rôle : "Client"
5. Compléter le profil si demandé
6. Se déconnecter

Résultat attendu :
✅ Inscription réussie via Google
✅ Redirection vers dashboard

7. Aller sur /inscription
8. Choisir "Client" ou "Artisan"
9. Remplir le formulaire :
   - Email : test-doublon2@example.com
   - Mot de passe : TestPassword123!
   - Autres champs
10. Cliquer "S'inscrire"

Résultat attendu (APRÈS FIX) :
❌ Message d'erreur : "Ce compte existe déjà avec Google Sign-In. Veuillez vous connecter avec Google."
❌ PAS de création de compte
❌ PAS de doublon créé
```

---

### 3. Deux Google Sign-In avec le même email

**Scénario** : Même email Google utilisé deux fois (ne devrait pas arriver normalement).

**Note** : Firebase Auth empêche automatiquement ce cas (même provider + même email = même UID).

**Test** :
```
1. Se connecter avec Google : test-doublon3@example.com
2. Choisir rôle : "Artisan"
3. Se déconnecter
4. Se connecter avec Google : test-doublon3@example.com

Résultat attendu :
✅ Connexion réussie (même compte)
✅ Même UID (pas de doublon)
✅ Redirection vers dashboard artisan
```

---

### 4. Email admin dans whitelist vs Google Sign-In

**Scénario** : Admin essaie de se connecter avec Google.

**Étapes** :
```
1. Créer admin via script :
   cd scripts
   node create-admin.js
   Email : admin-test@artisansafe.fr

2. Aller sur /connexion
3. Cliquer "Se connecter avec Google"
4. Sélectionner admin-test@artisansafe.fr

Résultat attendu :
❌ Message : "Les administrateurs doivent se connecter via l'interface dédiée."
❌ Déconnexion automatique
❌ PAS de compte Google créé
```

---

## 🔍 Détection des doublons existants

### Script de détection

```bash
# Vérifier s'il existe des doublons dans la base
cd backend
node scripts/detect-duplicate-accounts.js
```

**Sortie attendue (si aucun doublon)** :
```
🔍 Recherche des comptes en doublon...

📊 Total utilisateurs Firebase Auth : 25

═══════════════════════════════════════════
📋 RAPPORT DE DOUBLONS
═══════════════════════════════════════════

Total emails uniques : 25
Emails avec doublons : 0

✅ Aucun doublon détecté !

👋 Script terminé
```

**Sortie attendue (si doublons détectés)** :
```
═══════════════════════════════════════════
📋 RAPPORT DE DOUBLONS
═══════════════════════════════════════════

Total emails uniques : 23
Emails avec doublons : 2

⚠️  2 email(s) avec plusieurs comptes détectés

───────────────────────────────────────────
📧 Email : test@example.com
   Nombre de comptes : 2

   Compte #1 :
   ├─ UID : abc123xyz789
   ├─ Providers : password
   ├─ Email vérifié : Oui
   ├─ Créé : Wed, 10 Jan 2026 10:30:00 GMT
   └─ Dernière connexion : Thu, 20 Feb 2026 15:45:00 GMT

   📄 Document Firestore : OUI
   └─ Rôle : client

   Compte #2 :
   ├─ UID : def456uvw123
   ├─ Providers : google.com
   ├─ Email vérifié : Oui
   ├─ Créé : Fri, 21 Feb 2026 09:00:00 GMT
   └─ Dernière connexion : Fri, 21 Feb 2026 09:00:00 GMT

   📄 Document Firestore : NON (compte orphelin)

═══════════════════════════════════════════
📊 STATISTIQUES
═══════════════════════════════════════════

Conflits password ↔ Google : 2
Conflits Google ↔ Google : 0
Autres conflits : 0

═══════════════════════════════════════════
💡 RECOMMANDATIONS
═══════════════════════════════════════════

⚠️  Action requise :
   1. Contacter les utilisateurs concernés
   2. Identifier le compte principal (celui avec données Firestore)
   3. Migrer les données si nécessaire
   4. Supprimer les comptes orphelins

📝 Scripts disponibles :
   - scripts/merge-duplicate-accounts.js (TODO)
   - backend/scripts/delete-user-data.js (suppression)

✅ Détection terminée
```

---

## 🛠️ Actions correctives (si doublons détectés)

### Option 1 : Supprimer le compte orphelin

Si un compte n'a pas de document Firestore (compte orphelin) :

```bash
# Supprimer le compte Firebase Auth orphelin
# (Utiliser Firebase Console ou Admin SDK)

# Méthode Firebase Console :
1. Aller sur https://console.firebase.google.com
2. Authentication → Users
3. Chercher l'email concerné
4. Supprimer le compte orphelin (celui sans données)
```

### Option 2 : Migrer les données (si les deux comptes ont des données)

```bash
# TODO : Script à créer
cd scripts
node merge-duplicate-accounts.js
```

**Ce script devrait** :
1. Identifier le compte principal (le plus ancien ou avec le plus de données)
2. Migrer les données Firestore du compte secondaire vers le principal
3. Supprimer le compte secondaire
4. Conserver un seul compte

---

## 📋 Checklist de validation

Après implémentation du fix, vérifier :

- [ ] Inscription email/password vérifie `fetchSignInMethodsForEmail`
- [ ] Google Sign-In vérifie `fetchSignInMethodsForEmail`
- [ ] Message d'erreur clair si provider conflict détecté
- [ ] Pas de création de doublon possible
- [ ] Script `detect-duplicate-accounts.js` fonctionne
- [ ] Aucun doublon existant dans la base (ou plan de migration)
- [ ] Documentation à jour

---

## 🚨 Points d'attention

### Erreur possible : `auth/requires-recent-login`

Si un utilisateur connecté essaie de lier un provider :
```javascript
// Erreur possible
Error: auth/requires-recent-login

// Solution : Forcer reconnexion
await reauthenticateWithCredential(user, credential);
await linkWithPopup(user, provider);
```

### Erreur possible : `auth/provider-already-linked`

Si un provider est déjà lié :
```javascript
// Vérifier avant de lier
const providers = user.providerData.map(p => p.providerId);
if (!providers.includes('google.com')) {
  await linkWithPopup(user, googleProvider);
}
```

---

## 📚 Références

- Firebase Auth : [fetchSignInMethodsForEmail](https://firebase.google.com/docs/reference/js/auth#fetchsigninmethodsforemail)
- Account Linking : [Guide officiel](https://firebase.google.com/docs/auth/web/account-linking)
- Documentation projet : [USE_CASE_GOOGLE_VS_EMAIL_PASSWORD.md](USE_CASE_GOOGLE_VS_EMAIL_PASSWORD.md)

---

**Dernière mise à jour** : 21 février 2026  
**Auteur** : MOHAMED ALI MRABET  
**Statut** : ✅ Protection implémentée - En phase de test
