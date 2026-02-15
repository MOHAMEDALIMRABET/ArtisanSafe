# 🚀 Guide de Test - Validation Manuelle Admin

**Date**: 15 février 2026  
**Modifications**: Système validation 100% manuel (pas d'API SIRENE)

---

## ✅ Changements appliqués

### Fichiers modifiés
1. ✅ `backend/src/services/sirene-api.service.ts` - Code API commenté
2. ✅ `frontend/src/app/inscription/page.tsx` - Appel API commenté
3. ✅ `frontend/src/lib/firebase/verification-service.ts` - Validation format uniquement
4. ✅ `backend/.env` - Variable obsolète commentée

### Nouveau comportement
- ✅ SIRET : Vérification **format 14 chiffres uniquement** (pas d'API)
- ✅ Raison sociale : **Acceptée telle quelle** (admin vérifie documents)
- ✅ Adresse : **Acceptée telle quelle** (admin vérifie documents)

---

## 🔧 Redémarrer l'application

### Méthode 1 : Script Windows (Recommandé)

```powershell
# Depuis le dossier racine ArtisanSafe
.\RESTART_ALL.bat
```

**Ce script va** :
1. Arrêter backend et frontend
2. Relancer backend sur port 5000
3. Relancer frontend sur port 3000

---

### Méthode 2 : Manuellement

#### Terminal 1 - Backend
```bash
cd backend
npm run dev
```

Vous devriez voir :
```
🚀 Backend démarré sur http://localhost:5000
📊 Mode: development
```

#### Terminal 2 - Frontend
```bash
cd frontend
npm run dev
```

Vous devriez voir :
```
✓ Ready in 2.5s
○ Local: http://localhost:3000
```

---

## 🧪 Tester la nouvelle validation

### Test 1 : Inscription Artisan

1. **Ouvrir** : http://localhost:3000/inscription?role=artisan

2. **Remplir le formulaire** :
   ```
   Email : test-artisan@example.com
   Mot de passe : Test1234!
   Nom : Dupont
   Prénom : Jean
   Téléphone : 0612345678
   
   --- Informations Entreprise ---
   Nom entreprise : Plomberie Dupont
   SIRET : 12345678901234  ← Format 14 chiffres (accepté sans API)
   Adresse : 12 Rue de la Paix, 75001 Paris  ← Acceptée telle quelle
   Métiers : Plomberie
   ```

3. **Soumettre le formulaire**

4. **Vérifier les logs backend** (Terminal 1) :
   ```
   ✅ SIRET format valide: 12345678901234
   📝 Raison sociale fournie: Plomberie Dupont
   📍 Adresse fournie: 12 Rue de la Paix, 75001 Paris
   ℹ️  Vérification manuelle par admin lors validation documents
   ```

5. **Vérifier les logs frontend** (Console navigateur F12) :
   ```javascript
   ✅ Inscription artisan - Données acceptées pour vérification manuelle admin
   📝 SIRET: 12345678901234
   🏢 Raison sociale: Plomberie Dupont
   📍 Adresse: 12 Rue de la Paix, 75001 Paris
   ℹ️  Admin vérifiera lors validation documents KBIS
   ```

6. **Résultat attendu** : 
   - ✅ Compte créé sans erreur
   - ✅ Redirection vers `/email-verified` ou dashboard artisan
   - ✅ **Pas d'appel API SIRENE** (pas de délai réseau)
   - ✅ Inscription **instantanée**

---

### Test 2 : Vérifier Firebase

1. **Ouvrir Firebase Console** : https://console.firebase.google.com/

2. **Naviguer** : Firestore Database → `artisans` collection

3. **Trouver le document créé** (userId du nouvel artisan)

4. **Vérifier les données** :
   ```javascript
   {
     userId: "abc123...",
     businessName: "Plomberie Dupont",  // ← Raison sociale fournie
     siret: "12345678901234",            // ← SIRET fourni (pas vérifié API)
     location: {
       address: "12 Rue de la Paix, 75001 Paris",  // ← Adresse fournie
       city: "Paris",
       postalCode: "75001"
     },
     metiers: ["plomberie"],
     verificationStatus: "pending",      // ← En attente validation admin
     emailVerified: false,               // ← Email à vérifier
     createdAt: Timestamp(...)
   }
   ```

5. **Résultat attendu** :
   - ✅ `businessName` = Exactement ce que l'artisan a saisi
   - ✅ `siret` = Exactement ce que l'artisan a saisi (14 chiffres)
   - ✅ `location.address` = Exactement ce que l'artisan a saisi
   - ✅ **Pas de "ENTREPRISE TEST (BYPASS MODE)"**
   - ✅ **Pas de "1 Rue de Test, 75001 Paris"**

---

### Test 3 : Validation Admin

1. **Connexion admin** : http://localhost:3000/login
   ```
   Email : admin@artisandispo.fr
   Password : [voir MY_CREDENTIALS.md]
   ```

2. **Naviguer** : Dashboard Admin → **Vérifications**

3. **Trouver l'artisan** "Plomberie Dupont" (pending)

4. **Vérifier les informations affichées** :
   ```
   Raison sociale : Plomberie Dupont  ← Tel que fourni
   SIRET : 12345678901234             ← Tel que fourni
   Adresse : 12 Rue de la Paix, 75001 Paris  ← Tel que fourni
   Métiers : Plomberie
   Documents : Aucun (artisan n'a pas encore uploadé)
   ```

5. **Note** : Admin **ne peut pas encore approuver** car aucun document uploadé

---

### Test 4 : Upload Documents (Simulation)

**Pour tester l'approbation complète** :

1. **Connecté comme artisan** : http://localhost:3000/artisan/verification

2. **Upload documents** :
   - KBIS (PDF ou image)
   - RC Pro (PDF)
   - Garantie décennale (PDF) - si métier BTP
   - Pièce identité (image)

3. **OCR Tesseract.js** (toujours actif) va :
   - ✅ Extraire SIRET du KBIS
   - ✅ Comparer SIRET profil vs SIRET KBIS
   - ✅ Pré-remplir raison sociale, représentant légal
   - ✅ Aider l'admin (pas décisif)

4. **Admin vérifie** :
   - ✅ SIRET KBIS = SIRET profil
   - ✅ Raison sociale KBIS = Raison sociale profil
   - ✅ Adresse KBIS = Adresse profil
   - ✅ Documents valides et récents

5. **Décision admin** :
   - ✅ **Approuver** → `verificationStatus: "approved"` → Profil visible
   - ❌ **Rejeter** → `verificationStatus: "rejected"` → Motif envoyé à artisan

---

## ⚠️ Erreurs possibles

### Erreur 1 : SIRET moins de 14 chiffres

**Symptôme** :
```
❌ Format SIRET invalide (14 chiffres requis)
```

**Solution** :
Rentrer exactement **14 chiffres** (pas plus, pas moins)

---

### Erreur 2 : Raison sociale vide

**Symptôme** :
```
❌ Raison sociale manquante ou invalide
```

**Solution** :
Rentrer au moins **2 caractères** dans le champ "Nom entreprise"

---

### Erreur 3 : Backend pas démarré

**Symptôme** :
```javascript
Error: fetch failed - Connection refused
```

**Solution** :
```bash
cd backend
npm run dev
```

Vérifier que le backend tourne sur **http://localhost:5000**

---

## 🔍 Logs de débogage

### Backend (attendu)
```bash
✅ SIRET format valide: 12345678901234
📝 Raison sociale fournie: Plomberie Dupont
📍 Adresse fournie: 12 Rue de la Paix, 75001 Paris
ℹ️  Vérification manuelle par admin lors validation documents
```

### Frontend (attendu)
```javascript
✅ [Frontend] SIRET format valide: 12345678901234
📝 [Frontend] Raison sociale: Plomberie Dupont
ℹ️ [Frontend] Vérification manuelle par admin lors validation documents KBIS
```

### ❌ Logs à NE PLUS voir
```bash
# ❌ Ces logs NE DOIVENT PLUS apparaître :
⚠️ MODE BYPASS ACTIVÉ
📡 Appel API SIRENE publique
📊 Réponse API SIRENE - Status: 200
ENTREPRISE TEST (BYPASS MODE)
1 Rue de Test, 75001 Paris
```

---

## ✅ Checklist de validation

Après chaque test, vérifier :

### Inscription
- [ ] Formulaire accepte SIRET 14 chiffres
- [ ] Raison sociale acceptée telle quelle
- [ ] Adresse acceptée telle quelle
- [ ] **Pas d'appel API** (vérifier Network tab F12)
- [ ] Inscription instantanée (< 1 seconde)

### Firebase
- [ ] Document `artisans` créé avec bonnes données
- [ ] `businessName` = Ce que l'artisan a saisi
- [ ] `siret` = Ce que l'artisan a saisi
- [ ] `location.address` = Ce que l'artisan a saisi
- [ ] **Pas de "ENTREPRISE TEST (BYPASS MODE)"**
- [ ] **Pas de "1 Rue de Test, 75001 Paris"**

### Logs
- [ ] Backend affiche "Validation manuelle par admin"
- [ ] Frontend affiche "Admin vérifiera lors validation documents"
- [ ] **Pas de "MODE BYPASS ACTIVÉ"**
- [ ] **Pas de "Appel API SIRENE"**

---

## 📚 Documentation

- **Guide complet** : [VALIDATION_MANUELLE_ADMIN.md](./VALIDATION_MANUELLE_ADMIN.md)
- **Architecture Firebase** : [FIREBASE.md](./FIREBASE.md)
- **Vérification KBIS (OCR)** : [KBIS_VERIFICATION_AUTOMATIQUE.md](./KBIS_VERIFICATION_AUTOMATIQUE.md)

---

## 🆘 Support

### Problème technique ?

1. Vérifier que backend et frontend tournent
2. Vérifier les logs backend (Terminal 1)
3. Vérifier la console navigateur (F12)
4. Lire la documentation complète

### Besoin de réactiver l'API SIRENE ?

Suivre les instructions dans [VALIDATION_MANUELLE_ADMIN.md](./VALIDATION_MANUELLE_ADMIN.md) section "Réactivation API"

---

**Dernière mise à jour** : 15 février 2026  
**Statut** : ✅ Prêt pour test
