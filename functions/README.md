# ArtisanSafe - Cloud Functions

Firebase Cloud Functions pour automatiser les workflows critiques du système.

## 📁 Structure

```
functions/
├── src/
│   ├── index.ts                          # Point d'entrée (export functions)
│   └── scheduledJobs/
│       └── annulerDevisNonPayes.ts       # Annulation devis non payés (24h)
├── lib/                                   # JavaScript compilé (généré)
├── package.json                           # Dépendances Node.js
├── tsconfig.json                          # Config TypeScript
└── .gitignore                             # Exclusions Git
```

## 🚀 Quick Start

### 1. Installation

```bash
cd functions
npm install
```

### 2. Build

```bash
npm run build
```

### 3. Test Local (Émulateur)

```bash
npm run serve
```

### 4. Déploiement Production

```bash
# Déployer toutes les functions
npm run deploy

# Déployer fonction spécifique
npm run deploy:annulation
```

## 📋 Cloud Functions Disponibles

### 1. `annulerDevisNonPayes` (Scheduled)

**Fonction** : Annulation automatique des devis non payés après 24h

**Trigger** : Toutes les heures (Cloud Scheduler)

**Workflow** :
```
1. Client signe devis → statut: 'en_attente_paiement'
2. dateLimitePaiement = now + 24h
3. Cloud Function vérifie chaque heure:
   - WHERE statut == 'en_attente_paiement'
   - WHERE dateLimitePaiement < now
4. Si trouvé → Annulation:
   - statut → 'annule'
   - motifAnnulation: "Paiement non effectué dans les 24h"
   - Notification artisan (type refus)
```

**Logs typiques** :
```
✅ Aucun devis à annuler
OU
⚠️  3 devis à annuler (délai 24h dépassé)
  ❌ Annulé: DV-2026-00123
✅ 3 devis annulés avec succès
```

**Coûts** : 0€/mois (dans quotas gratuits)

### 2. `annulerDevisNonPayesManual` (HTTP)

**Fonction** : Version manuelle de l'annulation (pour tests/admin)

**Trigger** : HTTP POST (authentifié)

**Usage** :
```bash
curl -X POST https://[REGION]-[PROJECT].cloudfunctions.net/annulerDevisNonPayesManual \
  -H "Content-Type: application/json" \
  -d '{"secret": "YOUR_SECRET_KEY"}'
```

**Sécurité** : Requiert secret key (config Firebase)

## 🛠️ Commandes Disponibles

```bash
# Build TypeScript → JavaScript
npm run build

# Démarrer émulateur local
npm run serve

# Shell interactif Cloud Functions
npm run shell

# Déployer toutes functions
npm run deploy

# Déployer uniquement annulation
npm run deploy:annulation

# Voir logs (toutes functions)
npm run logs

# Voir logs (uniquement annulation)
npm run logs:annulation
```

## 📊 Monitoring

### Logs Temps Réel

```bash
# Suivre logs en continu
firebase functions:log --only annulerDevisNonPayes --follow

# Dernières 50 lignes
firebase functions:log --only annulerDevisNonPayes --limit 50

# Filtrer erreurs
firebase functions:log --only annulerDevisNonPayes | grep "ERROR"
```

### Dashboard Firebase

**URL** : https://console.firebase.google.com/project/[PROJECT_ID]/functions

**Métriques clés** :
- Invocations/jour : 24 attendu (1/heure)
- Temps d'exécution : < 5s normal
- Taux d'erreur : < 1%
- Mémoire : < 128MB

### Forcer Exécution (Tests)

```bash
# Via gcloud CLI
gcloud scheduler jobs run annulerDevisNonPayes --location=europe-west1

# Via Console GCP
# → Cloud Scheduler → annulerDevisNonPayes → "Run now"
```

## 🔐 Sécurité

### Permissions IAM

La Cloud Function a accès :
- ✅ Firestore read/write (Admin SDK)
- ✅ Cloud Scheduler
- ❌ Pas accès Firebase Auth user passwords

### Firestore Rules

Les Cloud Functions **bypassent** les security rules Firestore (utilisent Admin SDK).

**Conséquence** : Pas besoin de modifier `firestore.rules` pour cette function.

### Variables d'Environnement

**Fichier** : `.env` (JAMAIS commit)

```bash
# Stocker secret pour HTTP function
firebase functions:config:set admin.secret="YOUR_SECRET_KEY"

# Voir config actuelle
firebase functions:config:get

# Supprimer config
firebase functions:config:unset admin.secret
```

## 💰 Coûts

### Plan Gratuit (Spark)

**Quotas** :
- Cloud Scheduler : 3 jobs gratuits
- Invocations : 2M/mois gratuits
- Firestore reads : 50k/jour gratuits

**Utilisation attendue** :
- 1 job scheduler ✅
- 720 invocations/mois (24×30) ✅
- ~2400 reads/jour ✅

**Total** : **0€/mois** (largement sous les quotas)

### Plan Blaze (Payant)

Seulement si dépassement quotas gratuits.

**Tarification** :
- Invocations : 0,40$/million (après 2M gratuits)
- Temps compute : 0,0000025$/GBs (après 400k s gratuits)
- Réseau : 0,12$/GB (après 5GB gratuits)

**Scénario volume élevé** (500 devis/jour) :
- Invocations : 720/mois → **0€** (< 2M)
- Reads : 12k/jour → **0€** (< 50k)
- Temps compute : 2160s/mois → **0€** (< 400k)

**Total** : **0€/mois** même avec gros volume

## 🧪 Tests

### Test Local (Émulateur)

```bash
# 1. Démarrer émulateur
npm run serve

# 2. Dans autre terminal, créer devis test
firebase firestore:write devis/test-123 \
  '{"statut":"en_attente_paiement","dateLimitePaiement":{"_seconds":1609459200},...}'

# 3. Attendre exécution automatique (1h)
# OU forcer via HTTP function locale
curl -X POST http://localhost:5001/[PROJECT]/us-central1/annulerDevisNonPayesManual \
  -d '{"secret":"dev-secret-123"}'
```

### Test Production

```bash
# 1. Créer devis test via Firestore Console
# 2. Forcer exécution
gcloud scheduler jobs run annulerDevisNonPayes

# 3. Vérifier logs
firebase functions:log --only annulerDevisNonPayes --limit 10

# 4. Vérifier Firestore
# → devis.statut == 'annule' ✅
# → notification artisan créée ✅
```

## 🆘 Troubleshooting

### Erreur: "Function not deployed"

```bash
# Vérifier fonctions déployées
firebase functions:list

# Si vide → Déployer
cd functions && npm run deploy
```

### Erreur: "Missing index"

```bash
# Firestore affiche lien index dans erreur
# → Cliquer lien pour créer index automatiquement
# OU créer manuellement via Console
```

### Logs ne s'affichent pas

```bash
# Vérifier région
firebase functions:log --region=us-central1

# Forcer exécution pour générer logs
gcloud scheduler jobs run annulerDevisNonPayes
```

### Fonction trop lente (> 30s)

```typescript
// Augmenter timeout dans code
export const annulerDevisNonPayes = functions
  .runWith({ timeoutSeconds: 120 })  // 2 min max
  .pubsub.schedule(...)
```

## 📚 Documentation Complète

- **Guide déploiement** : [`docs/DEPLOY_CLOUD_FUNCTION.md`](../docs/DEPLOY_CLOUD_FUNCTION.md)
- **Documentation technique** : [`docs/TODO_CLOUD_FUNCTION_ANNULATION_DEVIS.md`](../docs/TODO_CLOUD_FUNCTION_ANNULATION_DEVIS.md)
- **Workflow paiement** : [`docs/SIGNATURE_ELECTRONIQUE.md`](../docs/SIGNATURE_ELECTRONIQUE.md)

## 🔗 Liens Utiles

- **Firebase Console** : https://console.firebase.google.com
- **Cloud Functions Docs** : https://firebase.google.com/docs/functions
- **Cloud Scheduler** : https://cloud.google.com/scheduler/docs
- **Cron Syntax** : https://crontab.guru/

---

**Maintenu par** : DevOps ArtisanSafe  
**Dernière mise à jour** : 2026-02-01
