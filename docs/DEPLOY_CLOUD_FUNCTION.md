# 🚀 Guide Déploiement Cloud Function - Annulation Devis Non Payés

## ⚡ Quick Start (5 minutes)

### 1. Installation dépendances

```bash
cd functions
npm install
```

**Packages installés** :
- `firebase-admin` : SDK Firebase pour Cloud Functions
- `firebase-functions` : Framework Cloud Functions
- `typescript` : Compilation TypeScript → JavaScript

### 2. Build TypeScript

```bash
npm run build
```

**Résultat** : Crée dossier `lib/` avec JavaScript compilé.

### 3. Test en local (Émulateur Firebase)

```bash
npm run serve
```

**Output attendu** :
```
✔  functions: Loaded functions definitions from source: annulerDevisNonPayes, annulerDevisNonPayesManual.
✔  functions[us-central1-annulerDevisNonPayes]: scheduled function initialized (every 1 hours).
✔  functions[us-central1-annulerDevisNonPayesManual]: http function initialized (http://localhost:5001/...)
```

**Tester fonction HTTP manuelle** :
```bash
curl -X POST http://localhost:5001/[PROJECT_ID]/us-central1/annulerDevisNonPayesManual \
  -H "Content-Type: application/json" \
  -d '{"secret": "dev-secret-123"}'
```

### 4. Déploiement Production

```bash
# Option 1: Déployer toutes les functions
npm run deploy

# Option 2: Déployer UNIQUEMENT annulerDevisNonPayes (recommandé)
npm run deploy:annulation
```

**Temps estimé** : 2-3 minutes  
**Output attendu** :
```
✔  functions[annulerDevisNonPayes(us-central1)] Successful create operation.
Function URL: (none - scheduled function)

✔  Deploy complete!
```

### 5. Vérification Post-Déploiement

```bash
# Voir logs temps réel
npm run logs:annulation

# Forcer exécution manuelle (test)
gcloud scheduler jobs run annulerDevisNonPayes --location=europe-west1
```

## 🎯 Workflow Complet

### Fonctionnement Automatique

```
┌──────────────────────────────────────────────────────┐
│ CLIENT SIGNE DEVIS                                    │
│ - statut: 'envoye' → 'en_attente_paiement'          │
│ - dateLimitePaiement: now + 24h                      │
│ - signatureClient: { url, date, ip }                 │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ CLOUD FUNCTION (toutes les heures)                   │
│                                                       │
│ Query Firestore:                                     │
│   WHERE statut == 'en_attente_paiement'             │
│   WHERE dateLimitePaiement < now                     │
│                                                       │
│ Si résultats trouvés:                                │
│   1. Batch update: statut → 'annule'                │
│   2. Créer notification artisan                      │
│   3. Log: "❌ Annulé DV-2026-00123"                 │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ ARTISAN REÇOIT NOTIFICATION                          │
│ Type: 'devis_annule_non_paye'                        │
│ Message: "Client n'a pas payé dans les 24h"         │
│                                                       │
│ → Même traitement qu'un refus de devis classique    │
└──────────────────────────────────────────────────────┘
```

### Scénarios Gérés

#### Scénario 1 : Client paie dans les 24h ✅
```
10:00 → Signature (dateLimitePaiement: demain 10:00)
12:00 → Paiement effectué (statut: 'paye')
14:00 → Cloud Function check: Statut='paye' → Ignoré ✅
```

#### Scénario 2 : Client ne paie pas ❌
```
10:00 → Signature (dateLimitePaiement: demain 10:00)
Demain 11:00 → Cloud Function check:
  - dateLimitePaiement (10:00) < now (11:00) ✅
  - statut='en_attente_paiement' ✅
  → ANNULATION AUTOMATIQUE
```

#### Scénario 3 : Client paie à 23h59 (limite) ✅
```
10:00 → Signature
Demain 09:59 → Paiement effectué (statut: 'paye')
Demain 10:00 → Cloud Function check: Statut='paye' → Ignoré ✅
```

## 🔧 Configuration Avancée

### Modifier Fréquence d'Exécution

**Fichier** : `functions/src/scheduledJobs/annulerDevisNonPayes.ts`

```typescript
// ACTUEL: Toutes les heures
.schedule('every 1 hours')

// OPTIONS DISPONIBLES:
.schedule('every 30 minutes')  // Plus réactif (coûts + élevés)
.schedule('every 2 hours')     // Moins fréquent (économies)
.schedule('every day 03:00')   // Une fois par jour à 3h
.schedule('0 */2 * * *')       // Cron: toutes les 2h (syntaxe avancée)
```

**Recommandation** : `every 1 hours` = bon équilibre réactivité/coûts.

### Timezone

**Par défaut** : `Europe/Paris`

```typescript
.timeZone('Europe/Paris')  // UTC+1 (hiver) / UTC+2 (été)
```

### Timeout Fonction

**Par défaut** : 60s (amplement suffisant)

```typescript
export const annulerDevisNonPayes = functions
  .runWith({ timeoutSeconds: 120 })  // 2 minutes max
  .pubsub
  .schedule(...)
```

## 📊 Monitoring

### Dashboard Firebase Console

**URL** : https://console.firebase.google.com/project/[PROJECT_ID]/functions

**Métriques à surveiller** :
- **Invocations** : 24/jour attendu (1/heure)
- **Erreurs** : < 1% acceptable
- **Temps d'exécution** : < 5s normal, < 10s acceptable
- **Mémoire** : < 128MB (amplement suffisant)

### Alertes Automatiques

**Configurer via Firebase Console** :

1. **Alerte Erreurs** :
   - Trigger: Taux erreur > 5%
   - Action: Email admin

2. **Alerte Performance** :
   - Trigger: Temps exécution > 30s
   - Action: Slack notification

3. **Alerte Coûts** :
   - Trigger: Invocations > 1000/jour
   - Action: Email admin (anomalie)

### Logs Temps Réel

```bash
# Suivre logs en direct
firebase functions:log --only annulerDevisNonPayes --follow

# Filtrer par type
firebase functions:log --only annulerDevisNonPayes | grep "Annulé"

# Dernières 50 lignes
firebase functions:log --only annulerDevisNonPayes --limit 50
```

## 💰 Coûts Estimés

### Plan Gratuit (Spark)

**Limites gratuites** :
- Cloud Scheduler : **3 jobs** ✅ (on utilise 1)
- Invocations Functions : **2M/mois** ✅ (24×30 = 720/mois)
- Firestore reads : **50k/jour** ✅ (~100 reads/heure = 2400/jour)
- Firestore writes : **20k/jour** ✅ (~10 writes/jour si annulations)

**Coût mensuel** : **0€** (dans quotas gratuits)

### Plan Blaze (Si dépassement)

**Scénario** : 500 devis/jour
- Invocations : 720/mois → **0€** (< 2M gratuits)
- Reads : 500×24 = 12k/jour → **0€** (< 50k gratuits)
- Writes : ~50/jour → **0€** (< 20k gratuits)
- Temps compute : 720×3s = 2160s/mois → **0€** (< 400k s gratuits)

**Coût mensuel estimé** : **0€** (même avec volume élevé)

## 🧪 Tests

### Test 1 : Annulation Automatique

```typescript
// 1. Créer devis test (Firestore Console ou script)
{
  statut: 'en_attente_paiement',
  signatureClient: {
    url: 'https://...',
    date: Timestamp.now()
  },
  dateLimitePaiement: Timestamp.fromDate(new Date(Date.now() - 2*60*60*1000)), // -2h
  artisanId: 'test-artisan-123',
  clientId: 'test-client-456',
  numeroDevis: 'DV-TEST-00001',
  montantTTC: 1500
}

// 2. Attendre prochaine exécution (max 1h)
// OU forcer exécution:
gcloud scheduler jobs run annulerDevisNonPayes

// 3. Vérifier résultat
// Firestore: devis.statut == 'annule' ✅
// Notifications: nouvelle notification artisan ✅
```

### Test 2 : Paiement Dans Les Temps

```typescript
// 1. Créer devis
{
  statut: 'en_attente_paiement',
  dateLimitePaiement: Timestamp.fromDate(new Date(Date.now() + 10*60*60*1000)), // +10h
  ...
}

// 2. Payer avant délai
await updateDoc(devisRef, {
  statut: 'paye',
  paiement: { ... }
});

// 3. Attendre exécution Cloud Function
// → Devis ignoré (statut = 'paye') ✅
```

### Test 3 : Batch (Plusieurs Devis)

```typescript
// Créer 5 devis expirés
for (let i = 1; i <= 5; i++) {
  await addDoc(collection(db, 'devis'), {
    statut: 'en_attente_paiement',
    dateLimitePaiement: Timestamp.fromDate(new Date(Date.now() - 1000)),
    numeroDevis: `DV-TEST-${i.toString().padStart(3, '0')}`,
    ...
  });
}

// Forcer exécution
gcloud scheduler jobs run annulerDevisNonPayes

// Vérifier logs
// → "5 devis à annuler" ✅
// → "5 devis annulés avec succès" ✅
```

## 🆘 Troubleshooting

### Erreur: "Function not found"

```bash
# Vérifier déploiement
firebase functions:list

# Redéployer si nécessaire
cd functions && npm run deploy:annulation
```

### Erreur: "Permission denied"

```bash
# Vérifier IAM permissions
gcloud projects get-iam-policy [PROJECT_ID]

# Ajouter role Firestore si nécessaire
gcloud projects add-iam-policy-binding [PROJECT_ID] \
  --member="serviceAccount:firebase-adminsdk@[PROJECT_ID].iam.gserviceaccount.com" \
  --role="roles/datastore.user"
```

### Fonction ne s'exécute jamais

```bash
# Vérifier Cloud Scheduler
gcloud scheduler jobs list --location=europe-west1

# Si vide → Fonction mal déployée, redéployer
npm run deploy:annulation
```

### Logs vides

```bash
# Forcer exécution pour générer logs
gcloud scheduler jobs run annulerDevisNonPayes --location=europe-west1

# Attendre 10s puis vérifier
firebase functions:log --only annulerDevisNonPayes --limit 20
```

## 📋 Checklist Déploiement Production

- [ ] **Build sans erreurs** : `npm run build` ✅
- [ ] **Tests en local** : Émulateur fonctionne ✅
- [ ] **Déploiement** : `npm run deploy:annulation` ✅
- [ ] **Vérification Cloud Scheduler** : Job visible dans GCP Console ✅
- [ ] **Test exécution manuelle** : `gcloud scheduler jobs run ...` ✅
- [ ] **Logs visibles** : `firebase functions:log ...` ✅
- [ ] **Alertes configurées** : Email si erreurs ✅
- [ ] **Documentation** : Équipe au courant du comportement ✅

## 📚 Ressources

- **Cloud Functions Documentation** : https://firebase.google.com/docs/functions
- **Cloud Scheduler** : https://cloud.google.com/scheduler/docs
- **Cron Syntax** : https://crontab.guru/
- **Firebase Console** : https://console.firebase.google.com

---

**Créé le** : 2026-02-01  
**Responsable** : DevOps / Backend  
**Statut** : ✅ Prêt pour déploiement
