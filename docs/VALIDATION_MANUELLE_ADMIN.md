# ✅ Validation Manuelle par Admin - Documentation

**Date**: 15 février 2026  
**Statut**: ✅ IMPLÉMENTÉ

---

## 📋 Vue d'ensemble

Le système de vérification ArtisanSafe fonctionne désormais **100% manuellement** via l'admin. Aucun appel API SIRENE n'est effectué, même en développement.

### Principe de fonctionnement

```
┌─────────────────┐
│  Inscription    │
│   Artisan       │
└────────┬────────┘
         │
         ├─ SIRET : Vérification format 14 chiffres uniquement ✅
         ├─ Raison sociale : Acceptée telle quelle (pas de vérification) ✅
         ├─ Adresse : Acceptée telle quelle (pas de vérification) ✅
         │
         v
┌─────────────────┐
│  Compte créé    │
│ (pending)       │
└────────┬────────┘
         │
         ├─ Upload documents (KBIS, RC Pro, Garantie décennale)
         │
         v
┌─────────────────┐
│  Validation     │
│   Admin         │  ← L'ADMIN VÉRIFIE MANUELLEMENT TOUS LES DOCUMENTS
└────────┬────────┘
         │
         ├─ Vérification visuelle KBIS (SIRET, raison sociale, adresse)
         ├─ Vérification RC Pro (couverture assurance)
         ├─ Vérification Garantie décennale
         │
         v
┌─────────────────┐
│   Approved ✅   │
│  ou Rejected ❌ │
└─────────────────┘
```

---

## 🔧 Modifications apportées

### 1. Backend - `sirene-api.service.ts`

**Ancien comportement** :
- API SIRENE appelée si `SIRENE_BYPASS_VERIFICATION=false`
- Mode bypass avec données test si `SIRENE_BYPASS_VERIFICATION=true`

**Nouveau comportement** :
- ✅ Vérification **format SIRET uniquement** (14 chiffres)
- ✅ **Raison sociale acceptée** telle quelle (fournie par artisan)
- ✅ **Adresse acceptée** telle quelle (fournie par artisan)
- 🔒 **Code API SIRENE commenté** (réactivable si besoin futur)

```typescript
// ✅ Accepte les données fournies par l'artisan
return {
  valid: true,
  raisonSociale: raisonSocialeInput || 'À compléter',
  adresse: adresseInput || 'À compléter',
  activite: 'Vérifié par admin'
};

/* 🔒 CODE API DÉSACTIVÉ - Commenté pour réactivation future */
```

---

### 2. Frontend - `inscription/page.tsx`

**Ancien comportement** :
- Appel API `/sirene/verify` lors de l'inscription
- Vérification SIRET + raison sociale via API gouvernementale

**Nouveau comportement** :
- ✅ **Pas d'appel API** lors de l'inscription
- ✅ Données artisan **acceptées directement**
- ✅ Logs indiquent "Vérification manuelle par admin"

```typescript
// ✅ VALIDATION MANUELLE PAR ADMIN
console.log('✅ Inscription artisan - Données acceptées pour vérification manuelle admin');
console.log(`📝 SIRET: ${siret.trim()}`);
console.log(`🏢 Raison sociale: ${entreprise.trim()}`);
console.log(`📍 Adresse: ${adresse}`);

/* 🔒 VÉRIFICATION API DÉSACTIVÉE - Code commenté */
```

---

### 3. Frontend - `verification-service.ts`

**Ancien comportement** :
- Fonction `verifySiret()` appelait API backend
- Retournait données SIRENE (raison sociale officielle, adresse, etc.)

**Nouveau comportement** :
- ✅ Vérification **format 14 chiffres uniquement**
- ✅ **Raison sociale retournée telle quelle** (pas de vérification API)
- ✅ Logs indiquent "Vérification manuelle par admin"
- 🔒 **Code API commenté**

```typescript
// ✅ Format valide - Accepter pour vérification manuelle admin
return {
  valid: true,
  companyName: raisonSociale.trim(),
  legalForm: 'À vérifier par admin',
  adresse: '',
  active: true
};

/* 🔒 APPEL API BACKEND DÉSACTIVÉ */
```

---

## 📝 Workflow complet - Inscription Artisan

### Étape 1 : Formulaire d'inscription

L'artisan remplit :
- ✅ SIRET (14 chiffres) - **Validation format uniquement**
- ✅ Raison sociale (nom entreprise) - **Acceptée telle quelle**
- ✅ Adresse complète - **Acceptée telle quelle**
- ✅ Métiers (plomberie, électricité, etc.)

**Vérifications automatiques** :
- ✅ SIRET contient exactement 14 chiffres
- ✅ Raison sociale minimum 2 caractères
- ❌ **Pas de vérification API SIRENE**

### Étape 2 : Création compte

```
users (collection)
└─ {userId}
    ├─ email: "artisan@example.com"
    ├─ role: "artisan"
    ├─ nom: "Dupont"
    ├─ prenom: "Jean"
    └─ emailVerified: false

artisans (collection)
└─ {userId}
    ├─ businessName: "Plomberie Dupont" ← Raison sociale fournie
    ├─ siret: "12345678901234" ← SIRET fourni (format vérifié seulement)
    ├─ location:
    │   ├─ address: "12 Rue de la Paix" ← Adresse fournie
    │   ├─ city: "Paris"
    │   └─ postalCode: "75001"
    ├─ metiers: ["plomberie"]
    ├─ verificationStatus: "pending" ← EN ATTENTE VALIDATION ADMIN
    └─ documents: {}
```

### Étape 3 : Vérification email

Artisan clique sur lien email → `emailVerified: true`

### Étape 4 : Upload documents

Artisan upload depuis `/artisan/verification` :
- ✅ **KBIS** (obligatoire) - Contient SIRET, raison sociale, adresse officielle
- ✅ **RC Pro** (obligatoire) - Assurance responsabilité civile
- ✅ **Garantie décennale** (si métiers BTP)
- ✅ **Pièce d'identité** (représentant légal)

**OCR Tesseract.js** (aide admin, pas décisif) :
- Extrait automatiquement SIRET du KBIS
- Extrait raison sociale
- Détecte QR code INPI
- Pré-remplit champs pour faciliter vérification admin

### Étape 5 : Validation admin

Admin accède à `/admin/verifications` et vérifie **manuellement** :

#### Document KBIS
- ✅ SIRET correspond au SIRET fourni lors inscription
- ✅ Raison sociale correspond à celle fournie
- ✅ Adresse correspond à celle fournie
- ✅ Document récent (< 3 mois)
- ✅ Entreprise active (pas en liquidation)

#### RC Pro (Responsabilité Civile Professionnelle)
- ✅ Police d'assurance valide
- ✅ Couvre les activités déclarées
- ✅ Montants garantie corrects

#### Garantie décennale (si métiers BTP)
- ✅ Assurance valide
- ✅ Couvre les métiers déclarés
- ✅ Montants conformes

#### Pièce d'identité
- ✅ Correspond au représentant légal du KBIS
- ✅ Document valide

**Décision admin** :
```typescript
// Option 1 : Approuver ✅
verificationStatus → "approved"
→ Profil visible dans recherches

// Option 2 : Rejeter ❌
verificationStatus → "rejected"
motifRejet → "KBIS non conforme à l'adresse fournie"
→ Artisan notifié, doit corriger
```

---

## 🔄 Comparaison Avant/Après

| Aspect | ❌ Avant (API SIRENE) | ✅ Après (Validation manuelle) |
|--------|----------------------|------------------------------|
| **SIRET** | API vérifie existence + validité | Format 14 chiffres uniquement |
| **Raison sociale** | API retourne raison sociale officielle | Acceptée telle quelle (artisan) |
| **Adresse** | API retourne adresse officielle | Acceptée telle quelle (artisan) |
| **Temps réponse** | 1-3 secondes (appel API) | Instantané (pas d'API) |
| **Dépendance réseau** | Requiert connexion internet | Aucune dépendance |
| **Coût** | Gratuit (API publique) mais limite taux | Zéro coût |
| **Validation finale** | Automatique (API) + Admin (documents) | Admin uniquement (documents) |
| **Risque erreur** | Échec si API en panne | Aucun échec technique |
| **Flexibilité** | Bloqué si SIRET non trouvé | Accepte tous SIRET valides |

---

## 🎯 Avantages de la validation manuelle

### 1. **Fiabilité totale**
- ✅ Admin vérifie **visuellement** les documents officiels
- ✅ Pas de risque d'erreur API (timeout, API en panne, SIRET non trouvé)
- ✅ Pas de dépendance réseau externe

### 2. **Flexibilité**
- ✅ Accepte entreprises récemment créées (pas encore dans SIRENE)
- ✅ Gère cas particuliers (auto-entrepreneurs, micro-entreprises)
- ✅ Tolérance pour divergences mineures (SARL vs EURL, etc.)

### 3. **Performance**
- ✅ Inscription **instantanée** (pas d'attente API)
- ✅ Pas de limite de taux API
- ✅ Fonctionne hors ligne (dev local)

### 4. **Conformité RGPD**
- ✅ Pas de transmission données à API tierce
- ✅ Données restent dans système ArtisanSafe uniquement

### 5. **Évolutivité**
- ✅ Code API commenté, **réactivable facilement** si besoin futur
- ✅ Pas de coût API (gratuit maintenant, payant si volume augmente)

---

## 🔐 Sécurité et qualité

### Contrôles en place

#### Niveau 1 : Inscription (automatique)
- ✅ SIRET : Format 14 chiffres obligatoire
- ✅ Raison sociale : Minimum 2 caractères
- ✅ Email : Format valide + vérification par lien

#### Niveau 2 : Upload documents (OCR aide)
- ✅ OCR Tesseract.js extrait SIRET du KBIS
- ✅ Comparaison auto SIRET profil vs SIRET KBIS
- ✅ Alerte si divergence (aide admin)

#### Niveau 3 : Validation admin (décisif)
- ✅ Vérification visuelle KBIS (SIRET, raison sociale, adresse)
- ✅ Vérification RC Pro (couverture assurance)
- ✅ Vérification Garantie décennale (métiers BTP)
- ✅ Vérification identité représentant légal

### Risques gérés

| Risque | Mitigation |
|--------|-----------|
| Faux SIRET | Admin vérifie KBIS officiel (QR code INPI) |
| Fausse raison sociale | Admin compare KBIS vs profil |
| Fausse adresse | Admin vérifie concordance KBIS |
| Assurance expirée | Admin vérifie dates validité RC Pro/Décennale |
| Usurpation identité | Admin vérifie pièce identité vs KBIS |

---

## 🚀 Réactivation API (si besoin futur)

Si vous décidez plus tard de réactiver l'API SIRENE :

### Étape 1 : Décommenter le code

#### Backend - `sirene-api.service.ts`
```typescript
// Ligne ~80 : Enlever /* */ autour du code API
// Commenter le return manuel actuel
```

#### Frontend - `inscription/page.tsx`
```typescript
// Ligne ~130 : Enlever /* */ autour de l'appel API
```

#### Frontend - `verification-service.ts`
```typescript
// Ligne ~50 : Enlever /* */ autour de l'appel fetch
// Commenter le return manuel actuel
```

### Étape 2 : Configurer .env (optionnel)
```env
# backend/.env
SIRENE_BYPASS_VERIFICATION=false  # Active API réelle
```

### Étape 3 : Redémarrer backend
```bash
cd backend
npm run dev
```

### Étape 4 : Tester
```bash
# Tester avec SIRET réel
node backend/test-sirene-api.js
```

**Note** : Le code commenté est **100% fonctionnel**, il suffit de le décommenter.

---

## 📊 Logs de débogage

### Backend (Node.js)
```bash
✅ SIRET format valide: 12345678901234
📝 Raison sociale fournie: Plomberie Dupont
📍 Adresse fournie: 12 Rue de la Paix, 75001 Paris
ℹ️  Vérification manuelle par admin lors validation documents
```

### Frontend (Browser Console)
```javascript
✅ Inscription artisan - Données acceptées pour vérification manuelle admin
📝 SIRET: 12345678901234
🏢 Raison sociale: Plomberie Dupont
📍 Adresse: 12 Rue de la Paix, 75001 Paris
ℹ️  Admin vérifiera lors validation documents KBIS
```

---

## ✅ Checklist Admin - Validation Artisan

À chaque validation artisan, l'admin doit vérifier :

### 1. KBIS (Obligatoire)
- [ ] Document récent (< 3 mois)
- [ ] SIRET correspond au profil (14 chiffres)
- [ ] Raison sociale correspond au profil
- [ ] Adresse correspond au profil
- [ ] Entreprise active (pas de mention liquidation/cessation)
- [ ] Activité cohérente avec métiers déclarés
- [ ] QR code INPI présent et scannable (si possible)

### 2. RC Pro (Obligatoire)
- [ ] Police d'assurance en cours de validité
- [ ] Date expiration > aujourd'hui
- [ ] Couvre activités déclarées (plomberie, électricité, etc.)
- [ ] Montant garantie conforme (min. 500k€)
- [ ] Assureur reconnu

### 3. Garantie Décennale (Si métiers BTP)
- [ ] Assurance en cours de validité
- [ ] Couvre métiers BTP déclarés
- [ ] Montant garantie conforme
- [ ] Attestation originale (pas photocopie)

### 4. Pièce d'identité (Obligatoire)
- [ ] CNI ou Passeport valide
- [ ] Nom/Prénom correspond au représentant légal KBIS
- [ ] Photo claire et lisible
- [ ] Document non expiré

**Si tout est conforme** → ✅ **Approuver**  
**Si problème détecté** → ❌ **Rejeter** + indiquer motif précis

---

## 📚 Fichiers modifiés

### Backend
- ✅ `backend/src/services/sirene-api.service.ts` - Code API commenté, validation manuelle implémentée

### Frontend
- ✅ `frontend/src/app/inscription/page.tsx` - Appel API commenté, logs explicites
- ✅ `frontend/src/lib/firebase/verification-service.ts` - Validation format uniquement

### Documentation
- ✅ `docs/VALIDATION_MANUELLE_ADMIN.md` - Ce document

---

## 🔗 Références

### Documentation existante
- [KBIS_VERIFICATION_AUTOMATIQUE.md](./KBIS_VERIFICATION_AUTOMATIQUE.md) - OCR Tesseract.js (toujours actif)
- [ADMIN_UPLOAD_HISTORY.md](./ADMIN_UPLOAD_HISTORY.md) - Interface admin vérification
- [FIREBASE.md](./FIREBASE.md) - Structure collections Firestore

### Code source
- Backend API service : `backend/src/services/sirene-api.service.ts`
- Frontend inscription : `frontend/src/app/inscription/page.tsx`
- Frontend vérification : `frontend/src/lib/firebase/verification-service.ts`
- Admin vérifications : `frontend/src/app/admin/verifications/page.tsx`

---

## ❓ FAQ

### Pourquoi désactiver l'API SIRENE ?

**Réponses** :
1. **Contrôle total** : Admin vérifie visuellement les documents officiels (KBIS)
2. **Fiabilité** : Pas de dépendance réseau/API externe (risque panne)
3. **Flexibilité** : Accepte entreprises récentes, cas particuliers
4. **Performance** : Inscription instantanée (pas d'attente API)
5. **Évolutivité** : Code réactivable facilement si besoin futur

### L'OCR Tesseract.js est-il toujours actif ?

**Oui**, l'OCR fonctionne toujours pour **aider l'admin** :
- Extrait automatiquement SIRET du KBIS
- Pré-remplit raison sociale, représentant légal
- Détecte QR code INPI
- **Mais** : Admin a le dernier mot (vérification visuelle)

### Quand réactiver l'API ?

**Réactiver si** :
- Volume inscriptions > 100/jour (gain temps admin)
- Besoin automatisation maximale
- Budget disponible pour API payante (si API publique limitée)

**Code prêt** : Juste décommenter, tout est déjà implémenté !

---

## 📝 Changelog

### Version 2.0 - 15 février 2026
- ✅ Validation 100% manuelle par admin
- ✅ Code API SIRENE commenté (réactivable)
- ✅ Logs explicites pour traçabilité
- ✅ Documentation complète

### Version 1.0 - Janvier 2026
- ✅ API SIRENE active avec mode bypass dev
- ✅ Vérification automatique SIRET

---

**Auteur** : Équipe ArtisanSafe  
**Dernière mise à jour** : 15 février 2026  
**Statut** : ✅ Production Ready
