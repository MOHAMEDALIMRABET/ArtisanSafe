# Déploiement Cloud Function - Suppression automatique devis refusés

## 🚀 Déploiement rapide

```bash
# 1. Installer les dépendances
cd functions
npm install

# 2. Compiler TypeScript
npm run build

# 3. Déployer la fonction
firebase deploy --only functions:cleanupRefusedDevis

# 4. Vérifier le déploiement
firebase functions:log --only cleanupRefusedDevis
```

## ✅ Résultat attendu

```bash
✔  functions[cleanupRefusedDevis(europe-west1)] Successful create operation.
Function URL (cleanupRefusedDevisManual): https://europe-west1-artisandispo-xxx.cloudfunctions.net/cleanupRefusedDevisManual

✔  Deploy complete!
```

## 🧪 Test immédiat (sans attendre 3h du matin)

### Option 1 : Via HTTP (après déploiement)

```bash
# Récupérer l'URL de la fonction
firebase functions:config:get

# Appeler manuellement
curl -X POST https://europe-west1-[PROJECT_ID].cloudfunctions.net/cleanupRefusedDevisManual
```

### Option 2 : Script local (IMMÉDIAT)

```bash
cd backend/scripts
node cleanup-devis-refuses.js
```

**Avantage** : Pas besoin d'attendre le déploiement Cloud Function

## 📊 Exécution automatique

- **Fréquence** : Tous les jours à 3h du matin (heure de Paris)
- **Premier run** : Le lendemain après déploiement à 3h00
- **Logs** : Firebase Console > Functions > cleanupRefusedDevis

## 🔍 Vérifier les logs

```bash
# Dernières exécutions
firebase functions:log --only cleanupRefusedDevis --limit 10

# En temps réel
firebase functions:log --only cleanupRefusedDevis --tail
```

## 💰 Coûts

- **Exécutions** : 1 fois/jour = 30 fois/mois
- **Quota gratuit** : 2 000 000 invocations/mois
- **Coût estimé** : **0 € / mois** (largement sous le quota)

## 🔧 Dépannage

### Erreur : "Missing permissions"

```bash
# Vérifier les permissions du service account
gcloud projects get-iam-policy [PROJECT_ID]

# Ajouter le rôle nécessaire
gcloud projects add-iam-policy-binding [PROJECT_ID] \
  --member=serviceAccount:firebase-adminsdk@[PROJECT_ID].iam.gserviceaccount.com \
  --role=roles/datastore.user
```

### Erreur : "Function not found"

```bash
# Redéployer
firebase deploy --only functions:cleanupRefusedDevis --force

# Vérifier les fonctions déployées
firebase functions:list
```

### Fonction ne s'exécute pas

```bash
# Vérifier le schedule
firebase functions:config:get

# Forcer une exécution manuelle
curl -X POST [URL_FONCTION_MANUAL]
```

## 📝 Modifier la configuration

### Changer l'heure d'exécution

**Fichier** : `functions/src/cleanupRefusedDevis.ts`

```typescript
// Ligne 18 : Modifier le schedule
.schedule('0 3 * * *')  // Actuel : 3h du matin

// Exemples :
.schedule('0 1 * * *')  // 1h du matin
.schedule('0 */6 * * *')  // Toutes les 6 heures
.schedule('0 0 * * 0')  // Dimanche minuit
```

Puis redéployer :
```bash
npm run build
firebase deploy --only functions:cleanupRefusedDevis
```

### Changer le délai de suppression

**Fichier** : `functions/src/cleanupRefusedDevis.ts`

```typescript
// Ligne 30 : Modifier le délai
const vingtQuatreHeuresEnMillis = 24 * 60 * 60 * 1000;

// Exemples :
const vingtQuatreHeuresEnMillis = 48 * 60 * 60 * 1000;  // 48h
const vingtQuatreHeuresEnMillis = 7 * 24 * 60 * 60 * 1000;  // 7 jours
```

## ✅ Checklist post-déploiement

- [ ] Fonction déployée avec succès
- [ ] Test manuel réussi (curl ou script local)
- [ ] Logs visibles dans Firebase Console
- [ ] Première exécution automatique confirmée (lendemain 3h)
- [ ] 0 erreur dans les logs après 7 jours
- [ ] Documentation mise à jour

## 🔗 Ressources

- [Documentation Firebase Scheduled Functions](https://firebase.google.com/docs/functions/schedule-functions)
- [Cron syntax](https://crontab.guru/)
- [Firebase pricing](https://firebase.google.com/pricing)
