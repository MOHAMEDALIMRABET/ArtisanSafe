# 📊 Guide de Lecture des Logs - Vérification SIRET

## 🎯 Objectif
Ce document explique comment lire et interpréter les logs générés lors de la vérification SIRET + Raison Sociale.

## 🔍 Flux complet des logs

### 1️⃣ **Réception de la requête** (Backend - Route)
**Fichier :** `backend/src/routes/sirene.routes.ts`

```log
📥 Requête reçue - Headers: { host: 'localhost:5000', ... }
📥 Requête reçue - Body: { siret: '81196407100013', raisonSociale: 'ENTREPRISE EXEMPLE' }
📥 Type de body: object
🔍 Vérification SIRET: 81196407100013 - Raison sociale: ENTREPRISE EXEMPLE
```

**Informations :**
- Headers HTTP de la requête
- Body JSON envoyé par le frontend
- SIRET et raison sociale extraits

---

### 2️⃣ **Début de vérification** (Backend - Service)
**Fichier :** `backend/src/services/sirene-api.service.ts`

```log
🔍 ====== DÉBUT VÉRIFICATION SIRET + RAISON SOCIALE ======
📋 SIRET reçu: 81196407100013
📋 Raison sociale reçue: ENTREPRISE EXEMPLE
```

**Informations :**
- Début du processus de vérification
- Paramètres reçus pour traitement

---

### 3️⃣ **Appel API SIRENE publique**

```log
📡 Appel API SIRENE publique: 81196407100013
📊 Réponse API SIRENE - Status: 200
```

**URL appelée :**
```
https://entreprise.data.gouv.fr/api/sirene/v3/etablissements/81196407100013
```

**Status possibles :**
- `200` : SIRET trouvé ✅
- `404` : SIRET introuvable ❌
- `500` : Erreur serveur API SIRENE ⚠️

---

### 4️⃣ **Données reçues de SIRENE** (JSON complet)

```log
📦 Données reçues de SIRENE: {
  "etablissement": {
    "siret": "81196407100013",
    "siren": "811964071",
    "numero_voie": "1",
    "type_voie": "RUE",
    "libelle_voie": "DE LA PAIX",
    "code_postal": "75001",
    "libelle_commune": "PARIS",
    "activite_principale": "43.21Z",
    "unite_legale": {
      "denomination": "ENTREPRISE EXEMPLE SARL",
      "nom_raison_sociale": "ENTREPRISE EXEMPLE",
      "nature_juridique": "5499",
      "etat_administratif": "A"
    }
  }
}
```

**Champs importants :**
- `siret` : Numéro SIRET (14 chiffres)
- `siren` : Numéro SIREN (9 premiers chiffres)
- `unite_legale.denomination` : Nom officiel complet
- `unite_legale.nom_raison_sociale` : Raison sociale
- `unite_legale.etat_administratif` : 
  - `A` = Actif ✅
  - `C` = Cessé ❌
- `activite_principale` : Code APE (Activité)

---

### 5️⃣ **Extraction des données**

```log
✅ Données extraites SIRENE: {
  raisonSociale: 'ENTREPRISE EXEMPLE SARL',
  adresse: '1 RUE DE LA PAIX 75001 PARIS',
  activite: '43.21Z',
  codePostal: '75001',
  ville: 'PARIS'
}
```

**Informations :**
- Raison sociale officiellement enregistrée
- Adresse complète reconstituée
- Code APE (activité principale)
- Code postal et ville

---

### 6️⃣ **Validation SIRET**

```log
✅ SIRET valide dans la base SIRENE
```

**OU en cas d'erreur :**

```log
❌ SIRET 12345678901234 introuvable dans la base SIRENE
```

---

### 7️⃣ **Comparaison raisons sociales**

```log
📊 Comparaison raisons sociales:
   - Saisie artisan: "ENTREPRISE EXEMPLE"
   - Base SIRENE:    "ENTREPRISE EXEMPLE SARL"
🔎 Résultat comparaison: ✅ MATCH
```

**Algorithme de comparaison :**
1. Normalisation (minuscules, sans accents, sans ponctuation)
2. Comparaison exacte après normalisation
3. Vérification d'inclusion (tolère "SARL", "SAS", etc.)
4. Calcul de similarité (algorithme de Levenshtein, seuil 80%)

**Exemples acceptés :**
```
✅ "ENTREPRISE EXEMPLE" = "ENTREPRISE EXEMPLE SARL"
✅ "Plomberie Martin" = "PLOMBERIE MARTIN"
✅ "BTP Services" = "BTP-Services"
```

**Exemples rejetés :**
```
❌ "ENTREPRISE A" ≠ "ENTREPRISE B"
❌ Similarité < 80%
```

---

### 8️⃣ **Résultat final**

#### ✅ **SUCCÈS**

```log
✅ ====== VÉRIFICATION COMPLÈTE RÉUSSIE ======

✅ SIRET vérifié: 81196407100013 - ENTREPRISE EXEMPLE SARL
```

**Réponse HTTP 200 :**
```json
{
  "success": true,
  "message": "SIRET et raison sociale vérifiés avec succès",
  "data": {
    "siret": "81196407100013",
    "raisonSociale": "ENTREPRISE EXEMPLE SARL",
    "adresse": "1 RUE DE LA PAIX 75001 PARIS",
    "activite": "43.21Z"
  }
}
```

#### ❌ **ÉCHEC - Raison sociale non conforme**

```log
❌ Raisons sociales non conformes
```

**Réponse HTTP 400 :**
```json
{
  "success": false,
  "error": "La raison sociale ne correspond pas. Base SIRENE indique : \"AUTRE ENTREPRISE\"",
  "details": {
    "raisonSocialeSaisie": "ENTREPRISE EXEMPLE",
    "raisonSocialeSIRENE": "AUTRE ENTREPRISE"
  }
}
```

#### ❌ **ÉCHEC - SIRET invalide**

```log
❌ Échec vérification SIRET: SIRET introuvable dans la base SIRENE
```

**Réponse HTTP 400 :**
```json
{
  "success": false,
  "error": "SIRET introuvable dans la base SIRENE"
}
```

---

## 🧪 Mode Développement (BYPASS)

Si `SIRENE_BYPASS_VERIFICATION=true` dans `.env` :

```log
⚠️ MODE BYPASS - Vérification SIRENE désactivée (dev uniquement)
✅ MODE BYPASS - Vérification acceptée sans comparaison raison sociale
```

**⚠️ NE JAMAIS ACTIVER EN PRODUCTION !**

---

## 📋 Exemple de logs complets (cas réussi)

```log
📥 Requête reçue - Body: { siret: '81196407100013', raisonSociale: 'ENTREPRISE EXEMPLE' }
🔍 Vérification SIRET: 81196407100013 - Raison sociale: ENTREPRISE EXEMPLE

🔍 ====== DÉBUT VÉRIFICATION SIRET + RAISON SOCIALE ======
📋 SIRET reçu: 81196407100013
📋 Raison sociale reçue: ENTREPRISE EXEMPLE

📡 Appel API SIRENE publique: 81196407100013
📊 Réponse API SIRENE - Status: 200

📦 Données reçues de SIRENE: {
  "etablissement": {
    "siret": "81196407100013",
    "unite_legale": {
      "denomination": "ENTREPRISE EXEMPLE SARL",
      "etat_administratif": "A"
    },
    "numero_voie": "1",
    "libelle_voie": "DE LA PAIX",
    "code_postal": "75001",
    "libelle_commune": "PARIS",
    "activite_principale": "43.21Z"
  }
}

✅ Données extraites SIRENE: {
  raisonSociale: 'ENTREPRISE EXEMPLE SARL',
  adresse: '1 RUE DE LA PAIX 75001 PARIS',
  activite: '43.21Z',
  codePostal: '75001',
  ville: 'PARIS'
}

✅ SIRET valide dans la base SIRENE

📊 Comparaison raisons sociales:
   - Saisie artisan: "ENTREPRISE EXEMPLE"
   - Base SIRENE:    "ENTREPRISE EXEMPLE SARL"
🔎 Résultat comparaison: ✅ MATCH

✅ ====== VÉRIFICATION COMPLÈTE RÉUSSIE ======

✅ SIRET vérifié: 81196407100013 - ENTREPRISE EXEMPLE SARL
```

---

## 🔧 Comment activer les logs détaillés

### 1. **Backend déjà configuré**
Les logs sont automatiquement affichés dans la console du serveur backend.

### 2. **Démarrer le backend avec capture de logs**

**Windows PowerShell :**
```powershell
cd backend
npm run dev 2>&1 | Tee-Object -FilePath backend.log
```

**Linux/Mac :**
```bash
cd backend
npm run dev 2>&1 | tee backend.log
```

### 3. **Consulter les logs en temps réel**

**PowerShell :**
```powershell
Get-Content backend.log -Wait -Tail 50
```

**Linux/Mac :**
```bash
tail -f backend.log
```

---

## 🐛 Debugging - Cas d'erreurs fréquents

### ❌ **Erreur : SIRET introuvable**

```log
❌ SIRET 12345678901234 introuvable dans la base SIRENE
```

**Causes possibles :**
- SIRET inexistant ou mal saisi
- SIRET trop récent (délai de mise à jour SIRENE)
- Entreprise radiée

**Solution :** Vérifier sur [https://annuaire-entreprises.data.gouv.fr](https://annuaire-entreprises.data.gouv.fr)

---

### ❌ **Erreur : Raison sociale non conforme**

```log
📊 Comparaison raisons sociales:
   - Saisie artisan: "ABC"
   - Base SIRENE:    "XYZ SARL"
🔎 Résultat comparaison: ❌ PAS DE MATCH
```

**Causes possibles :**
- Faute de frappe dans la raison sociale
- Raison sociale incomplète
- Différence > 20% (seuil de tolérance)

**Solution :** Modifier la raison sociale dans le profil artisan

---

### ⚠️ **Erreur : Timeout API SIRENE**

```log
❌ Erreur vérification SIRET: AbortError: The operation was aborted
```

**Cause :** L'API SIRENE n'a pas répondu en 15 secondes

**Solution :** 
- Réessayer
- Vérifier la connexion Internet
- Activer temporairement le mode BYPASS en développement

---

## 📚 Ressources

- **API SIRENE Documentation :** [https://entreprise.data.gouv.fr/api_doc/sirene](https://entreprise.data.gouv.fr/api_doc/sirene)
- **Tester un SIRET :** [https://annuaire-entreprises.data.gouv.fr](https://annuaire-entreprises.data.gouv.fr)
- **Code source logs :** 
  - [sirene.routes.ts](../backend/src/routes/sirene.routes.ts)
  - [sirene-api.service.ts](../backend/src/services/sirene-api.service.ts)

---

**Date de mise à jour :** 5 janvier 2026  
**Version :** 1.0
