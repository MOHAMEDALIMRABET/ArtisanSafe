# 🗑️ Déploiement Cloud Function - Suppressions Programmées

## 📋 Vue d'ensemble

Cette Cloud Function exécute automatiquement les suppressions de comptes programmées arrivées à échéance, avec suppression cascade complète sur 15 collections Firestore et conformité RGPD.

**Fichier** : `functions/src/scheduledJobs/executePendingDeletions.ts`  
**Exécution** : Tous les jours à 3h du matin (Europe/Paris)  
**Timeout** : 540 secondes (9 minutes)  
**Mémoire** : 1GB

---

## 🎯 Fonctionnalités

### Workflow Complet

```
Suppression programmée (J0)
  ↓
Compte suspendu + email avertissement
  ↓
Délai de recours 15 jours
  ↓
J+15 à 3h : executePendingDeletions() s'exécute
  ↓
Pour chaque suppression programmée arrivée à échéance :
  ├─ Anonymise 6 collections (rétention légale 10 ans)
  │  ├─ avis : auteurNom → "[Compte supprimé]"
  │  ├─ devis : client/artisan → "[Compte supprimé]"
  │  ├─ demandes : client → "[Compte supprimé]"
  │  ├─ contrats : clientNom/artisanNom → "[Compte supprimé]"
  │  ├─ conversations : participantNames[userId] → "[Compte supprimé]"
  │  └─ messages : senderName → "[Compte supprimé]"
  │
  ├─ Supprime 9+ collections (RGPD)
  │  ├─ notifications
  │  ├─ rappels
  │  ├─ disponibilites
  │  ├─ scheduled_deletions
  │  ├─ email_notifications
  │  ├─ admin_access_logs
  │  ├─ users
  │  ├─ artisans (si artisan)
  │  └─ Firebase Auth
  │
  ├─ Archive statistiques dans deleted_accounts
  ├─ Envoie email confirmation
  └─ Marque scheduled_deletion comme 'executed'
```

### Collections Gérées (15 au total)

| Collection | Action | Raison |
|------------|--------|--------|
| `avis` | **Anonymise** | Rétention légale 10 ans (Code de Commerce) |
| `devis` | **Anonymise** | Documents comptables (Art. L123-22) |
| `demandes` | **Anonymise** | Historique commercial (10 ans) |
| `contrats` | **Anonymise** | Obligations légales BTP (10 ans) |
| `conversations` | **Anonymise** | Traçabilité litiges (10 ans) |
| `messages` | **Anonymise** | Preuves contractuelles (10 ans) |
| `notifications` | **Supprime** | Données temporaires (RGPD) |
| `rappels` | **Supprime** | Données personnelles (RGPD) |
| `disponibilites` | **Supprime** | Planning artisan (RGPD) |
| `scheduled_deletions` | **Supprime** | Tables techniques |
| `email_notifications` | **Supprime** | Logs emails (RGPD) |
| `admin_access_logs` | **Supprime** | Logs accès (RGPD) |
| `users` | **Supprime** | Compte principal (RGPD) |
| `artisans` | **Supprime** | Profil public (RGPD) |
| Firebase Auth | **Supprime** | Authentification (RGPD) |

---

## 🚀 Déploiement

### Prérequis

```bash
# Vérifier Firebase CLI installé
firebase --version  # Minimum v13.0.0

# Vérifier projet Firebase actif
firebase use
# Résultat attendu : artisandispo (production) ou artisan-safe-dev (staging)

# Vérifier Node.js version
node --version  # Minimum v18.x
```

### Installation des dépendances

```bash
cd functions
npm install
```

### Compilation TypeScript

```bash
# Build tous les fichiers TypeScript
npm run build

# Vérifier compilation réussie
ls lib/scheduledJobs/executePendingDeletions.js
```

### Déploiement Production

```bash
# Option 1 : Déployer UNIQUEMENT cette fonction (recommandé)
firebase deploy --only functions:executePendingDeletions

# Option 2 : Déployer toutes les Cloud Functions
firebase deploy --only functions

# Option 3 : Déployer avec version HTTP pour tests
firebase deploy --only functions:executePendingDeletions,functions:executePendingDeletionsManual
```

**Output attendu** :
```
✔  functions[executePendingDeletions(europe-west1)] Successful create operation.
Function URL (executePendingDeletions): https://europe-west1-artisandispo.cloudfunctions.net/executePendingDeletions

✔  Deploy complete!
```

### Vérification après déploiement

```bash
# Lister toutes les Cloud Functions déployées
firebase functions:list

# Vérifier logs
firebase functions:log --only executePendingDeletions

# Tester exécution manuelle (version HTTP)
curl -X POST https://europe-west1-artisandispo.cloudfunctions.net/executePendingDeletionsManual
```

---

## 🧪 Tests

### Test Local (Émulateur Firebase)

```bash
# Démarrer émulateurs Firestore + Functions
firebase emulators:start --only firestore,functions

# Dans un autre terminal : Créer suppression programmée test
cd frontend
npm run test:create-scheduled-deletion

# Vérifier exécution dans logs émulateur
```

### Test Production (Manuel)

**⚠️ ATTENTION** : À utiliser UNIQUEMENT sur environnement de staging/test

```bash
# Étape 1 : Créer suppression programmée test (via admin UI)
# /admin/comptes → "Programmer Suppression (15 jours)"

# Étape 2 : Modifier deletionDate pour exécution immédiate (Firestore Console)
# Collection: scheduled_deletions
# Document: [TEST_USER_ID]
# Champ: deletionDate → Date actuelle - 1 jour

# Étape 3 : Déclencher fonction manuellement
curl -X POST https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/executePendingDeletionsManual

# Étape 4 : Vérifier logs
firebase functions:log --only executePendingDeletionsManual --follow

# Étape 5 : Vérifier Firestore
# - scheduled_deletions : status = 'executed' ✅
# - users : document supprimé ✅
# - artisans : document supprimé (si artisan) ✅
# - avis : auteurNom anonymisé ✅
# - devis : client/artisan anonymisés ✅
# - deleted_accounts : archive créée ✅
```

### Logs attendus (succès)

```
🗑️ ========================================
🗑️ EXÉCUTION SUPPRESSIONS PROGRAMMÉES
🗑️ ========================================
⏰ Exécution : 20/02/2026 03:00:00

🔍 Recherche suppressions programmées arrivées à échéance...
📊 2 suppression(s) programmée(s) à exécuter

🗑️ Exécution des suppressions...
─────────────────────────────────────

⏰ Suppression 1/2
   ID: abc123xyz456
   Utilisateur: Jean Dupont (jean.dupont@example.com)
   Type: client
   Programmée le: 05/02/2026
   Échéance: 20/02/2026

  🗑️ Suppression cascade pour: Jean Dupont (jean.dupont@example.com)
     Type: client | Raison: Demande utilisateur (RGPD)
     📝 Anonymisation (rétention 10 ans)...
        - 3 avis anonymisé(s)
        - 5 devis anonymisé(s)
        - 2 demande(s) anonymisée(s)
        - 1 contrat(s) anonymisé(s)
        - 2 conversation(s) anonymisée(s)
        - 15 message(s) anonymisé(s)
     ✅ 28 document(s) anonymisé(s)
     🗑️ Suppression complète (RGPD)...
        - 12 notification(s)
        - Document users supprimé
     ✅ 13 document(s) supprimé(s)
     📁 Archivage statistiques...
     ✅ Archive créée
     🔐 Suppression Firebase Auth...
     ✅ Compte Firebase Auth supprimé
     📧 Email de confirmation...
     ✅ Email programmé
   ✅ Suppression réussie: 28 docs anonymisés, 13 docs supprimés

⏰ Suppression 2/2
   [...]

🗑️ ========================================
🗑️ RÉSUMÉ DE L'EXÉCUTION
🗑️ ========================================
✅ Comptes supprimés avec succès : 2
❌ Erreurs rencontrées : 0

📊 Conformité RGPD respectée
📊 Rétention légale 10 ans appliquée
📊 Utilisateurs notifiés par email
💾 Base de données nettoyée

✅ Exécution terminée avec succès
```

---

## 📊 Monitoring Production

### Dashboard Firebase Console

1. Aller sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionner projet `artisandispo`
3. Functions → `executePendingDeletions`
4. Onglet "Logs" pour voir exécutions quotidiennes

### Alertes Recommandées

Configurer alertes Cloud Monitoring pour :
- ❌ Erreurs d'exécution (> 0)
- ⏱️ Timeout dépassé (> 500s)
- 📊 Suppressions multiples (> 10/jour → investigation)
- 💾 Mémoire utilisée (> 900MB → augmenter limite)

### Métriques Clés

```bash
# Nombre d'exécutions 7 derniers jours
gcloud logging read "resource.type=cloud_function AND resource.labels.function_name=executePendingDeletions" --limit 100 --format json | jq 'length'

# Temps d'exécution moyen
firebase functions:log --only executePendingDeletions | grep "Exécution terminée"

# Comptes supprimés ce mois
# Firestore Console → Collection: deleted_accounts
# Filtre: deletedAt >= Date début du mois
```

---

## 🔒 Sécurité

### Permissions Firebase Admin SDK

La Cloud Function utilise Firebase Admin SDK avec permissions complètes :
- ✅ Lecture/écriture Firestore (toutes collections)
- ✅ Suppression Firebase Auth
- ✅ Création email_notifications

**Aucune configuration supplémentaire nécessaire** - Permissions accordées automatiquement aux Cloud Functions.

### Conformité RGPD

✅ **Article 17** : Droit à l'effacement respecté (délai 15 jours)  
✅ **Article 5(1)(e)** : Conservation limitée (anonymisation automatique)  
✅ **Article 30** : Traçabilité complète (logs + archives)  
✅ **Article 32** : Sécurité (Firebase Admin SDK sécurisé)

### Protection Données Financières

✅ **Code de Commerce Art. L123-22** : Rétention 10 ans (devis, contrats)  
✅ **Anonymisation** : Noms supprimés, montants conservés  
✅ **Traçabilité** : Archives statistiques pour audits

---

## ❓ Troubleshooting

### Erreur : "Missing index"

```
Error: The query requires an index.
```

**Solution** :
1. Cliquer sur lien dans erreur (crée index automatiquement)
2. Attendre 5-10 minutes création index
3. Relancer fonction

**Alternative** : Tri client-side (déjà implémenté dans code)

### Erreur : "Timeout exceeded"

```
Error: Function execution took longer than 540000ms
```

**Solution** :
```typescript
// Dans functions/src/scheduledJobs/executePendingDeletions.ts
export const executePendingDeletions = functions
  .runWith({
    timeoutSeconds: 900,  // Augmenter à 15 minutes
    memory: '2GB'         // Augmenter mémoire
  })
```

Redéployer : `firebase deploy --only functions:executePendingDeletions`

### Erreur : "auth/user-not-found"

```
Error: There is no user record corresponding to the provided identifier.
```

**Solution** : Normal si compte Firebase Auth déjà supprimé manuellement. Fonction gère cette erreur automatiquement (log warning, continue exécution).

### Suppression ne s'exécute pas

**Checklist** :
1. ✅ Fonction déployée : `firebase functions:list | grep executePendingDeletions`
2. ✅ Scheduled_deletion existe : Firestore Console → Collection `scheduled_deletions`
3. ✅ Status correct : `status = 'scheduled'` (pas 'executed' ou 'cancelled')
4. ✅ Date échue : `deletionDate <= maintenant`
5. ✅ Timezone correcte : `timeZone: 'Europe/Paris'` dans code

**Test manuel** :
```bash
# Forcer exécution immédiate (version HTTP)
curl -X POST https://europe-west1-artisandispo.cloudfunctions.net/executePendingDeletionsManual
```

---

## 📝 Changelog

### Version 1.0.0 (20/02/2026)

**Implémentation initiale** :
- ✅ Exécution quotidienne à 3h (cron)
- ✅ Suppression cascade 15 collections
- ✅ Anonymisation 6 collections (10 ans)
- ✅ Archive statistiques
- ✅ Email confirmation
- ✅ Logs détaillés
- ✅ Version HTTP pour tests manuels

**Collections gérées** :
- avis, devis, demandes, contrats, conversations, messages (anonymisées)
- notifications, rappels, disponibilites, scheduled_deletions, email_notifications, admin_access_logs, users, artisans, Firebase Auth (supprimées)

---

## 📚 Ressources

- [Documentation Firebase Functions](https://firebase.google.com/docs/functions)
- [Scheduled Functions (Cron)](https://firebase.google.com/docs/functions/schedule-functions)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [RGPD Article 17](https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre3#Article17)
- [Code de Commerce Art. L123-22](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006219327)

---

## 🎯 Prochaines Étapes

### Phase 2 : Améliorations

- [ ] Dashboard admin : Statistiques suppressions (nombre/mois)
- [ ] Notification Slack/email admins après chaque exécution
- [ ] Export CSV archives deleted_accounts
- [ ] Restauration compte avant échéance (annulation suppression)
- [ ] Webhook externe pour systèmes tiers
- [ ] Retry automatique en cas d'erreur
- [ ] Rate limiting (max 50 suppressions/jour)

### Phase 3 : Optimisations

- [ ] Batch processing parallèle (plusieurs comptes simultanément)
- [ ] Cache Firebase Storage documents à supprimer
- [ ] Compression archives deleted_accounts
- [ ] Partitionnement Firestore (hot/cold storage)

---

**Auteur** : ArtisanDispo Dev Team  
**Date** : 20/02/2026  
**Version** : 1.0.0
