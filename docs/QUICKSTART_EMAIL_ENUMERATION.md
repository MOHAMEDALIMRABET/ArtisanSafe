# ⚡ Guide Rapide : Activer Email Enumeration Protection

## 🎯 Objectif

Permettre le comportement standard du marché (AlloVoisins, Airbnb) : un utilisateur peut se connecter avec **email/password OU Google** et accéder au **même compte**.

---

## 📋 Étapes (5 minutes)

### 1. Aller dans Firebase Console

```
https://console.firebase.google.com
```

### 2. Sélectionner votre projet

- Cliquer sur : **artisansafe-XXXXX** ou **artisandispo-XXXXX**

### 3. Aller dans Authentication

- Menu de gauche : **Authentication**
- Onglet : **Settings** (⚙️ Paramètres)

### 4. Activer Email Enumeration Protection

Chercher la section : **User account management**

Toggle ON :
```
✅ Email enumeration protection
```

**Description** :
> Prevent account enumeration by returning generic error messages  
> and automatically linking accounts with the same email

### 5. Sauvegarder

Cliquer **Save** ou **Enregistrer**

---

## ✅ Vérification

### Test 1 : Créer doublon (devrait être empêché)

```bash
# Terminal 1 - Créer compte email/password
1. Aller sur http://localhost:3000/inscription
2. Remplir :
   - Email : test-linking@example.com
   - Mot de passe : TestPass123!
   - Rôle : Client

# Terminal 2 - Essayer Google Sign-In
1. Aller sur http://localhost:3000/connexion
2. Cliquer "Se connecter avec Google"
3. Sélectionner test-linking@example.com

Résultat attendu (AVANT activation) :
❌ 2 comptes créés (doublons)

Résultat attendu (APRÈS activation) :
✅ Connexion au même compte
✅ Providers liés automatiquement
```

### Test 2 : Vérifier pas de doublon

```bash
cd backend
node scripts/detect-duplicate-accounts.js

# Attendu :
# ✅ Aucun doublon détecté !
```

### Test 3 : Vérifier providers liés

Dans la console navigateur (F12) :
```javascript
const user = auth.currentUser;
console.log(user.uid); // Même UID

console.log(user.providerData);
// Attendu :
// [
//   { providerId: 'password', ... },
//   { providerId: 'google.com', ... }
// ]
```

---

## 🔍 Si Email Enumeration Protection est grisée

### Cause possible : Firebase Identity Platform requis

Email Enumeration Protection est une fonctionnalité **Firebase Identity Platform** (gratuite jusqu'à 50k MAU).

**Solution** :
1. Dans Firebase Console → Authentication
2. Cliquer sur **Upgrade to Identity Platform** (si demandé)
3. C'est gratuit pour usage modéré (< 50 000 utilisateurs actifs/mois)

---

## 📊 Avant/Après

### Comportement AVANT

```
User : test@email.com

Action 1 : Inscription email/password
→ Compte créé : UID abc123

Action 2 : Connexion Google (même email)
→ Nouveau compte : UID xyz789  ← DOUBLON !

Résultat : 2 comptes différents 😡
```

### Comportement APRÈS

```
User : test@email.com

Action 1 : Inscription email/password
→ Compte créé : UID abc123

Action 2 : Connexion Google (même email)
→ Même compte : UID abc123  ✅
→ Provider Google ajouté automatiquement

Résultat : 1 compte, 2 méthodes de connexion 😊
```

---

## ⚠️ Migration si doublons existants

Si vous aviez des doublons AVANT l'activation :

```bash
# 1. Détecter
cd backend
node scripts/detect-duplicate-accounts.js

# 2. Pour chaque doublon :
#    - Identifier le compte principal (avec données)
#    - Supprimer le compte orphelin
#    - OU contacter l'utilisateur

# 3. Suppression (si orphelin confirmé)
cd backend
node scripts/delete-user-data.js <UID_ORPHELIN>
```

---

## 🎯 Checklist finale

- [ ] Email Enumeration Protection activée dans Firebase Console
- [ ] Aucun doublon détecté (`detect-duplicate-accounts.js`)
- [ ] Test réussi : email/password + Google = même compte
- [ ] Code modifié : blocage Google Sign-In retiré
- [ ] Documentation mise à jour

---

## 📚 Références

- **Firebase Docs** : [Email Enumeration Protection](https://cloud.google.com/identity-platform/docs/admin/email-enumeration-protection)
- **Guide complet** : [ACCOUNT_LINKING_MARCHE.md](ACCOUNT_LINKING_MARCHE.md)
- **Détection doublons** : `backend/scripts/detect-duplicate-accounts.js`

---

**Temps estimé** : ⏱️ 5 minutes  
**Impact** : 🚀 MAJEUR (UX identique aux leaders du marché)  
**Difficulté** : 🟢 FACILE (juste une case à cocher)

**Dernière mise à jour** : 21 février 2026
