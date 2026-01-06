# Vérification Complète SIRET + Raison Sociale

## 📋 Vue d'ensemble

Le système de vérification SIRET effectue désormais **4 vérifications obligatoires** pour garantir l'authenticité des profils artisans.

## ✅ Les 4 vérifications effectuées

### 1. **Format SIRET valide**
- Vérification que le SIRET contient exactement **14 chiffres**
- Nettoyage automatique (suppression des espaces)

### 2. **Existence dans la base SIRENE**
- Appel à l'API publique du gouvernement français
- Vérification que le SIRET existe dans le registre officiel INSEE

### 3. **Statut de l'entreprise ACTIF**
- L'entreprise doit être **active** (pas fermée, radiée ou en cessation d'activité)
- Vérification via le champ `etat_administratif` de l'API SIRENE

### 4. **⭐ NOUVEAU : Adéquation Raison Sociale / SIRET**
- Comparaison entre :
  - La **raison sociale déclarée par l'artisan** lors de l'inscription
  - Le **nom officiel de l'entreprise** dans la base SIRENE
- Utilise un algorithme de comparaison intelligent avec tolérance pour :
  - Majuscules/minuscules
  - Accents
  - Espaces multiples
  - Ponctuation
  - Formes juridiques (SARL, SAS, etc.)

## 🔧 Architecture technique

### Frontend
**Fichier :** `frontend/src/lib/firebase/verification-service.ts`

```typescript
export async function verifySiret(
  siret: string, 
  raisonSociale: string
): Promise<SiretValidationResult>
```

**Paramètres :**
- `siret` : Numéro SIRET (14 chiffres)
- `raisonSociale` : Raison sociale déclarée dans le profil artisan

**Retour :**
```typescript
{
  valid: boolean,
  companyName?: string,
  legalForm?: string,
  active?: boolean,
  error?: string
}
```

### Backend
**Route :** `POST /api/v1/sirene/verify`

**Fichier :** `backend/src/routes/sirene.routes.ts`

**Body :**
```json
{
  "siret": "12345678901234",
  "raisonSociale": "ENTREPRISE EXEMPLE SARL"
}
```

**Réponse succès :**
```json
{
  "success": true,
  "message": "SIRET et raison sociale vérifiés avec succès",
  "data": {
    "siret": "12345678901234",
    "raisonSociale": "ENTREPRISE EXEMPLE",
    "adresse": "1 Rue Example, 75001 Paris",
    "activite": "43.21Z - Installation électrique"
  }
}
```

**Réponse erreur :**
```json
{
  "success": false,
  "error": "La raison sociale ne correspond pas. Base SIRENE indique : \"AUTRE ENTREPRISE SARL\"",
  "details": {
    "raisonSocialeSaisie": "ENTREPRISE EXEMPLE",
    "raisonSocialeSIRENE": "AUTRE ENTREPRISE"
  }
}
```

### Service de comparaison
**Fichier :** `backend/src/services/sirene-api.service.ts`

**Fonction :** `compareRaisonsSociales(input: string, reference: string)`

**Algorithme :**
1. Normalisation (minuscules, sans accents, sans ponctuation)
2. Comparaison exacte
3. Tolérance : vérification d'inclusion (pour gérer "SARL XXX" vs "XXX")
4. Calcul de similarité (algorithme de Levenshtein) - **seuil : 80%**

**Exemples acceptés :**
```
✅ "ENTREPRISE SARL" = "entreprise sarl"
✅ "PLOMBERIE MARTIN" ⊂ "SARL PLOMBERIE MARTIN"
✅ "Électricité Durand" = "ELECTRICITE DURAND" (accents)
✅ "BTP Services" = "BTP-Services" (ponctuation)
```

**Exemples rejetés :**
```
❌ "ENTREPRISE A" ≠ "ENTREPRISE B"
❌ "PLOMBERIE MARTIN" ≠ "ELECTRICITE MARTIN"
❌ "SOCIETE XXX" ≠ "SOCIETE YYY"
```

## 🎯 Flux utilisateur

### Page de vérification
**URL :** `http://localhost:3000/artisan/verification`

**Étapes :**

1. L'artisan accède à la page de vérification
2. La section "Vérification SIRET" affiche :
   - SIRET actuel (affiché)
   - Raison sociale déclarée (affiché en bleu)
   - Liste des 4 vérifications effectuées
3. Clic sur le bouton **"Vérifier le SIRET"**
4. Appel backend avec SIRET + raison sociale
5. Affichage du résultat :
   - ✅ **Succès** : Badge vert "Vérifié" + message de confirmation
   - ❌ **Échec** : Message d'erreur rouge avec détails

### Messages d'erreur possibles

| Erreur | Message | Solution |
|--------|---------|----------|
| Format invalide | "Format SIRET invalide (14 chiffres requis)" | Vérifier le SIRET saisi |
| SIRET inexistant | "SIRET non trouvé dans la base SIRENE" | Vérifier la validité du SIRET |
| Entreprise fermée | "Cette entreprise est fermée ou radiée" | Mettre à jour le SIRET |
| Raison sociale non conforme | "La raison sociale ne correspond pas. Base SIRENE indique : \"XXX\"" | Modifier la raison sociale dans le profil |
| Raison sociale manquante | "Raison sociale manquante dans votre profil" | Compléter le profil |
| Erreur technique | "Erreur technique lors de la vérification" | Réessayer plus tard |

## 🔒 Sécurité

### Validation côté serveur
- Toutes les vérifications sont effectuées **côté backend**
- L'API SIRENE publique est appelée uniquement depuis le serveur
- Impossible de contourner la vérification depuis le frontend

### Stockage dans Firestore
Une fois vérifié, les données suivantes sont enregistrées :

```typescript
{
  siretVerified: true,
  siretVerificationDate: Timestamp.now(),
  companyName: "Nom officiel SIRENE",
  legalForm: "Code APE"
}
```

## 🧪 Mode développement (BYPASS)

Pour faciliter les tests en développement, ajoutez dans `backend/.env` :

```env
SIRENE_BYPASS_VERIFICATION=true
```

**⚠️ ATTENTION :** Ne JAMAIS activer en production !

Avec ce mode :
- La vérification SIRET/raison sociale est acceptée automatiquement
- Données fictives retournées
- Utile pour tester sans connexion Internet

## 📊 Monitoring

### Logs backend
```
🔍 Vérification SIRET: 12345678901234 - Raison sociale: ENTREPRISE EXEMPLE
✅ SIRET vérifié: 12345678901234 - ENTREPRISE EXEMPLE SARL
```

### Logs frontend
```
Erreur vérification SIRET: Error: La raison sociale ne correspond pas
```

## 🚀 Déploiement

### Variables d'environnement requises

**Backend** (`.env`) :
```env
PORT=5000
NODE_ENV=production
# Pas de clé API nécessaire - API publique gratuite
```

**Frontend** (`.env.local`) :
```env
NEXT_PUBLIC_API_URL=https://api.votredomaine.com/api/v1
```

### Tester en local

1. Démarrer le backend :
```bash
cd backend
npm run dev
```

2. Démarrer le frontend :
```bash
cd frontend
npm run dev
```

3. Accéder à : `http://localhost:3000/artisan/verification`

## 📚 Ressources

- [API SIRENE publique](https://entreprise.data.gouv.fr/api_doc/sirene)
- [Documentation complète Firebase](docs/FIREBASE.md)
- [Guide vérification KBIS](docs/KBIS_VERIFICATION_AUTOMATIQUE.md)

---

**Date de mise à jour :** 4 janvier 2026  
**Version :** 2.0 (ajout vérification raison sociale)
