# 🔧 Résolution de l'erreur "fetch failed" - API SIRENE

## 🔍 Diagnostic de l'erreur

### Erreur observée
```
POST http://localhost:5000/api/v1/sirene/verify 400 (Bad Request)
❌ [Frontend] Échec vérification: fetch failed
```

### Causes identifiées

1. **Node.js version < 18** : `fetch()` n'est pas natif
2. **Problème réseau** : L'API SIRENE peut être bloquée ou indisponible
3. **AbortSignal.timeout()** : Non supporté dans toutes versions Node.js

## ✅ Solutions implémentées

### 1. Gestion d'erreur améliorée (✅ Fait)

Le fichier `backend/src/services/sirene-api.service.ts` a été mis à jour avec :
- Timeout manuel compatible toutes versions Node.js
- Messages d'erreur détaillés par type d'erreur réseau
- Logging amélioré

### 2. Script de test créé (✅ Fait)

Fichier: `backend/test-sirene-api.js`

**Exécution :**
```bash
cd backend
node test-sirene-api.js
```

Ce script va :
- Afficher la version de Node.js
- Tester la connexion à l'API SIRENE
- Diagnostiquer le type d'erreur précis
- Afficher les données SIRENE si succès

## 🚀 Actions à effectuer MAINTENANT

### Étape 1 : Vérifier la version de Node.js

**Ouvrir un nouveau terminal PowerShell ou CMD :**
```bash
node --version
```

**Requis :** Node.js **18.0.0 ou supérieur**

Si version < 18 :
```bash
# Télécharger depuis https://nodejs.org/
# Ou avec nvm (recommandé) :
nvm install 20
nvm use 20
```

### Étape 2 : Installer firebase-admin (OBLIGATOIRE)

```bash
cd backend
npm install firebase-admin
```

### Étape 3 : Tester l'API SIRENE

```bash
cd backend
node test-sirene-api.js
```

**Résultats attendus :**

✅ **Succès** :
```
✅ Réponse API reçue avec succès!
📦 Données établissement:
   - SIRET: 95288787500021
   - Raison sociale: ABOUDA
   - ...
```

❌ **Échec - SIRET inexistant** :
```
❌ Erreur HTTP 404:
💡 Le SIRET n'existe pas dans la base SIRENE
```

❌ **Échec - Problème réseau** :
```
❌ ERREUR DÉTECTÉE:
Type: FetchError
💡 DNS: Impossible de résoudre entreprise.data.gouv.fr
   Vérifiez votre connexion internet
```

❌ **Échec - fetch() manquant** :
```
💡 fetch() n'est pas disponible dans votre version de Node.js
   Solution: Installer Node.js 18+ ou utiliser node-fetch
```

### Étape 4 : Redémarrer le serveur backend

```bash
# Arrêter le serveur actuel (Ctrl+C dans le terminal du backend)
cd backend
npm run dev
```

### Étape 5 : Réessayer la vérification

1. Aller sur la page de vérification artisan
2. Saisir le SIRET : `95288787500021`
3. Saisir la raison sociale : `ABOUDA`
4. Cliquer sur "Vérifier"

## 🔍 Vérification du SIRET 95288787500021

### Recherche manuelle

Vous pouvez vérifier manuellement si ce SIRET existe :

**API SIRENE directe :**
```
https://entreprise.data.gouv.fr/api/sirene/v3/etablissements/95288787500021
```

**Annuaire des entreprises :**
```
https://annuaire-entreprises.data.gouv.fr/etablissement/95288787500021
```

### SIRET de test validés

Voici quelques SIRET **réellement existants** pour vos tests :

1. **TOTAL ENERGIES** : `54205118000047`
2. **ORANGE** : `38012986800094`
3. **CARREFOUR** : `65228260700025`
4. **DECATHLON** : `30841945600010`

## 📋 Checklist de dépannage

- [ ] Node.js version ≥ 18 installé
- [ ] `firebase-admin` installé dans backend
- [ ] Script de test exécuté avec succès
- [ ] API SIRENE accessible depuis le navigateur
- [ ] Connexion internet fonctionnelle
- [ ] Firewall/antivirus ne bloque pas les requêtes sortantes
- [ ] Backend redémarré après modifications

## 🛠️ Solutions alternatives si problème persiste

### Option 1 : Installer node-fetch (Node.js < 18)

```bash
cd backend
npm install node-fetch@2
```

Puis modifier `sirene-api.service.ts` :
```typescript
import fetch from 'node-fetch';
```

### Option 2 : Mode BYPASS temporaire (DEV uniquement)

**⚠️ À NE PAS UTILISER EN PRODUCTION**

Dans `backend/.env` :
```bash
SIRENE_BYPASS_VERIFICATION=true
```

Décommenter le code bypass dans `sirene-api.service.ts` (lignes 43-63).

### Option 3 : Utiliser une API alternative

Modifier l'URL dans `sirene-api.service.ts` :
```typescript
// Alternative 1 : API Entreprise (nécessite inscription)
`https://entreprise.api.gouv.fr/v3/insee/sirene/etablissements/${cleanSiret}`

// Alternative 2 : API Pappers (gratuite avec limite)
`https://api.pappers.fr/v2/entreprise?siret=${cleanSiret}`
```

## 📝 Logs à surveiller

Dans le terminal backend, vous devriez voir :
```
📡 Appel API SIRENE publique: 95288787500021
📊 Réponse API SIRENE - Status: 200
📦 Données reçues de SIRENE: {...}
✅ Données extraites SIRENE: {...}
✅ ====== VÉRIFICATION COMPLÈTE RÉUSSIE ======
```

Si vous voyez :
```
❌ Erreur lors de l'appel à l'API SIRENE: fetch failed
```

C'est un problème Node.js < 18 ou réseau.

## 🆘 Support

Si le problème persiste après toutes ces étapes :

1. **Copier les logs complets** du terminal backend
2. **Copier la sortie** du script `test-sirene-api.js`
3. **Vérifier** la version Node.js : `node --version`
4. **Créer un ticket** avec ces informations

---

**Dernière mise à jour :** 5 janvier 2026
**Fichiers modifiés :**
- ✅ `backend/src/services/sirene-api.service.ts`
- ✅ `backend/test-sirene-api.js` (nouveau)
- ✅ `docs/SIRENE_ERROR_RESOLUTION.md` (ce fichier)
