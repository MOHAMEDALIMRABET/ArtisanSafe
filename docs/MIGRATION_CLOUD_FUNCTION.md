# 🚀 Migration - Déploiement Cloud Function (5 min)

## Étapes Rapides

### 1. Installation Dépendances

```bash
cd functions
npm install
```

**Attendu** :
- `firebase-admin@^12.0.0` installé
- `firebase-functions@^4.5.0` installé
- `typescript@^5.0.0` installé
- Dossier `node_modules/` créé

### 2. Build TypeScript

```bash
npm run build
```

**Attendu** :
- Compilation réussie (0 erreurs)
- Dossier `lib/` créé avec JavaScript

**Si erreurs TypeScript** :
```bash
# Vérifier config
cat tsconfig.json

# Nettoyer et rebuild
rm -rf lib node_modules
npm install
npm run build
```

### 3. Test Local (Optionnel)

```bash
npm run serve
```

**Attendu** :
```
✔  functions: Loaded functions definitions from source: 
   annulerDevisNonPayes, annulerDevisNonPayesManual.
```

**Tester HTTP function** :
```bash
curl -X POST http://localhost:5001/[PROJECT_ID]/us-central1/annulerDevisNonPayesManual \
  -H "Content-Type: application/json" \
  -d '{"secret": "dev-secret-123"}'
```

### 4. Déploiement Production

```bash
npm run deploy:annulation
```

**OU complet** :
```bash
npm run deploy
```

**Attendu** :
```
✔  functions[annulerDevisNonPayes(us-central1)] Successful create operation.
Function URL: (none - scheduled function)
✔  Deploy complete!
```

**Temps estimé** : 2-3 minutes

### 5. Vérification Post-Déploiement

#### a. Vérifier fonction déployée

```bash
firebase functions:list
```

**Attendu** :
```
┌────────────────────────────┬─────────────┐
│ Function Name              │ Version     │
├────────────────────────────┼─────────────┤
│ annulerDevisNonPayes       │ 1           │
│ annulerDevisNonPayesManual │ 1           │
└────────────────────────────┴─────────────┘
```

#### b. Vérifier Cloud Scheduler

**Console GCP** : https://console.cloud.google.com/cloudscheduler

**Attendu** :
- Job `firebase-schedule-annulerDevisNonPayes-[REGION]` créé
- Fréquence : `every 1 hours`
- État : Activé ✅

**OU via CLI** :
```bash
gcloud scheduler jobs list
```

#### c. Forcer exécution test

```bash
gcloud scheduler jobs run firebase-schedule-annulerDevisNonPayes-us-central1
```

**Attendu** :
```
Job execution initiated.
```

#### d. Vérifier logs

```bash
firebase functions:log --only annulerDevisNonPayes --limit 10
```

**Attendu** :
```
2026-02-01 10:00:00 annulerDevisNonPayes: 🔄 Vérification devis non payés...
2026-02-01 10:00:01 annulerDevisNonPayes: ✅ Aucun devis à annuler
```

---

## 🧪 Tests Post-Déploiement

### Test 1 : Créer Devis Expiré

#### Firestore Console

1. Aller sur https://console.firebase.google.com
2. Firestore Database → Collection `devis`
3. Cliquer "Ajouter un document"
4. Copier-coller :

```json
{
  "statut": "en_attente_paiement",
  "signatureClient": {
    "url": "https://storage.googleapis.com/test.png",
    "date": "2026-02-01T10:00:00Z"
  },
  "dateLimitePaiement": "2026-01-31T10:00:00Z",
  "artisanId": "test-artisan-123",
  "clientId": "test-client-456",
  "numeroDevis": "DV-TEST-00001",
  "montantTTC": 1500,
  "createdAt": "2026-01-31T10:00:00Z"
}
```

**⚠️ IMPORTANT** : `dateLimitePaiement` doit être **dans le passé** (hier).

#### Forcer Exécution

```bash
gcloud scheduler jobs run firebase-schedule-annulerDevisNonPayes-us-central1
```

#### Vérifier Résultat

**Firestore** : Rafraîchir document `devis/test-devis-id`

**Attendu** :
```json
{
  "statut": "annule",  // ← Changé
  "dateAnnulation": "2026-02-01T10:05:00Z",  // ← Nouveau
  "motifAnnulation": "Paiement non effectué dans les 24h après signature",  // ← Nouveau
  ...
}
```

**Notifications** : Nouvelle notification créée

```json
{
  "recipientId": "test-artisan-123",
  "type": "devis_annule_non_paye",
  "title": "Devis DV-TEST-00001 annulé",
  "message": "Le client n'a pas effectué le paiement dans les 24h...",
  "relatedId": "test-devis-id",
  "lue": false,
  "dateCreation": "2026-02-01T10:05:00Z"
}
```

**Logs** :
```bash
firebase functions:log --only annulerDevisNonPayes --limit 20
```

**Attendu** :
```
⚠️  1 devis à annuler (délai 24h dépassé)
  ❌ Annulation: DV-TEST-00001
     Client: test-client-456
     Artisan: test-artisan-123
     Délai dépassé: 24h
✅ 1 devis annulés avec succès
   Numéros: DV-TEST-00001
```

---

## 🔧 Troubleshooting

### Erreur: "Function not found"

**Symptôme** :
```
Error: No functions found
```

**Solution** :
```bash
# Vérifier build
cd functions
npm run build

# Redéployer
npm run deploy:annulation
```

### Erreur: "Permission denied"

**Symptôme** :
```
Error: Missing permissions for service account
```

**Solution** :
```bash
# Vérifier IAM
gcloud projects get-iam-policy [PROJECT_ID]

# Ajouter rôle Firestore
gcloud projects add-iam-policy-binding [PROJECT_ID] \
  --member="serviceAccount:firebase-adminsdk@[PROJECT_ID].iam.gserviceaccount.com" \
  --role="roles/datastore.user"
```

### Logs Vides

**Symptôme** : `firebase functions:log` ne renvoie rien

**Solution** :
```bash
# Forcer exécution pour générer logs
gcloud scheduler jobs run firebase-schedule-annulerDevisNonPayes-us-central1

# Attendre 10 secondes
sleep 10

# Réessayer
firebase functions:log --only annulerDevisNonPayes --limit 10
```

### Scheduler Ne Se Crée Pas

**Symptôme** : Pas de job Cloud Scheduler après deploy

**Solution** :
```bash
# Activer API Cloud Scheduler
gcloud services enable cloudscheduler.googleapis.com

# Redéployer fonction
cd functions
npm run deploy:annulation
```

---

## 📊 Monitoring Production

### Dashboard Firebase

**URL** : https://console.firebase.google.com/project/[PROJECT_ID]/functions

**Vérifier** :
- **Invocations** : 24/jour attendu (1/heure)
- **Erreurs** : < 1% (idéalement 0%)
- **Temps d'exécution** : < 5s (normal), < 10s (acceptable)
- **Mémoire** : < 128MB

### Alertes Recommandées

**Firebase Console → Functions → annulerDevisNonPayes → Metrics**

**Configurer alertes** :
1. **Erreur rate** : > 5% → Email admin
2. **Execution time** : > 30s → Slack notification
3. **Invocations** : > 50/heure → Email (anomalie)

### Logs Temps Réel

```bash
# Suivre logs en continu
firebase functions:log --only annulerDevisNonPayes --follow

# Filtrer erreurs uniquement
firebase functions:log --only annulerDevisNonPayes | grep "ERROR"

# Filtrer annulations
firebase functions:log --only annulerDevisNonPayes | grep "Annulé"
```

---

## 💰 Coûts Estimés

### Plan Gratuit (Spark)

**Quotas** :
- Cloud Scheduler : **3 jobs gratuits** ✅ (on utilise 1)
- Invocations : **2M/mois gratuits** ✅ (720/mois = 24×30)
- Firestore reads : **50k/jour gratuits** ✅ (~2400/jour)

**Coût mensuel** : **0€**

### Plan Blaze (Si dépassement)

**Même avec 500 devis/jour** :
- Invocations : 720/mois → 0€ (< 2M)
- Reads : 12k/jour → 0€ (< 50k)
- Compute : 2160s/mois → 0€ (< 400k s)

**Coût mensuel** : **0€** (largement sous quotas)

---

## ✅ Checklist Finale

- [ ] `npm install` dans `functions/` ✅
- [ ] `npm run build` sans erreurs ✅
- [ ] `npm run deploy:annulation` réussi ✅
- [ ] Fonction visible dans `firebase functions:list` ✅
- [ ] Cloud Scheduler job créé (Console GCP) ✅
- [ ] Test manuel avec devis expiré ✅
- [ ] Logs visibles et corrects ✅
- [ ] Alertes configurées (Firebase Console) ✅
- [ ] Documentation lue par équipe ✅

---

## 📚 Documentation Complète

- **Workflow complet** : [`docs/WORKFLOW_SIGNATURE_PAIEMENT.md`](./WORKFLOW_SIGNATURE_PAIEMENT.md)
- **Guide déploiement** : [`docs/DEPLOY_CLOUD_FUNCTION.md`](./DEPLOY_CLOUD_FUNCTION.md)
- **Doc technique** : [`docs/TODO_CLOUD_FUNCTION_ANNULATION_DEVIS.md`](./TODO_CLOUD_FUNCTION_ANNULATION_DEVIS.md)
- **README Functions** : [`functions/README.md`](../functions/README.md)

---

**Temps total estimé** : **5-10 minutes**  
**Compétences requises** : Connaissance Firebase CLI, accès GCP  
**Support** : Voir docs ci-dessus ou contacter DevOps
