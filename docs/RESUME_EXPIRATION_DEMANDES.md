# ✅ Phase 1 : Expiration automatique des demandes - COMPLÉTÉ

## 🎯 Problème résolu

**Question** : "Comment ça se passe si la date avec la flexibilité a été dépassé !"

**Réponse** : Désormais, les demandes expirent automatiquement après la fin de leur fenêtre de dates.

---

## 📦 Fichiers modifiés/créés

### ✅ Modifications types (2 fichiers)

1. **frontend/src/types/firestore.ts**
   - Ajout statut `'expiree'` à `DemandeStatut`
   - Ajout champ `dateExpiration?: Timestamp` à interface `Demande`

2. **frontend/src/lib/firebase/demande-service.ts**
   - Fonction `createDemande()` calcule automatiquement `dateExpiration`
   - Formule : `dateDebut + flexibiliteDays` à 23:59:59

### ✅ Cloud Functions (2 fichiers)

3. **functions/src/scheduledJobs/expirerDemandesPassees.ts** (NOUVEAU)
   - `expirerDemandesPassees` : Cron quotidien à 1h du matin
   - `alerterDemandesProchesExpiration` : Alerte 24h avant à 9h
   
4. **functions/src/index.ts**
   - Export des 2 nouvelles fonctions

### ✅ Interface artisan (1 fichier)

5. **frontend/src/app/artisan/demandes/page.tsx**
   - Filtre automatique : Exclut demandes `'expiree'` et `'annulee'`

### ✅ Configuration Firestore (1 fichier)

6. **firestore.indexes.json**
   - Ajout index composite `demandes` (statut + dateExpiration)

### ✅ Migration (1 fichier)

7. **frontend/scripts/migrate-demandes-expiration.ts** (NOUVEAU)
   - Script pour ajouter `dateExpiration` aux demandes existantes

### ✅ Documentation (1 fichier)

8. **docs/IMPLEMENTATION_EXPIRATION_DEMANDES.md** (NOUVEAU)
   - Guide complet déploiement + tests

---

## 🚀 Prochaines étapes

### Étape 1 : Migrer les demandes existantes

```bash
cd frontend/scripts
npx ts-node --project tsconfig.json migrate-demandes-expiration.ts
```

**Résultat attendu** :
```
📊 15 demande(s) trouvée(s)
✅ 12 demande(s) migrée(s)
   └─ 3 marquée(s) comme expirée(s)
   └─ 9 encore valide(s)
⏭️  3 demande(s) ignorée(s)
```

### Étape 2 : Déployer l'index Firestore

```bash
firebase deploy --only firestore:indexes
```

**⚠️ ATTENDRE 5-10 minutes** que l'index soit créé.

### Étape 3 : Installer dépendances Cloud Functions

```bash
cd functions
npm install
```

### Étape 4 : Déployer les Cloud Functions

```bash
firebase deploy --only functions:expirerDemandesPassees,functions:alerterDemandesProchesExpiration
```

**Résultat attendu** :
```
✔ functions[expirerDemandesPassees] Successful create operation.
✔ functions[alerterDemandesProchesExpiration] Successful create operation.
```

### Étape 5 : Redémarrer le frontend

```bash
cd frontend
npm run dev
```

Vérifier que la page `/artisan/demandes` charge sans erreur.

---

## 🧪 Tests rapides

### Test 1 : Vérifier migration

**Console Firestore** → Collection `demandes` → Choisir un document

**Vérifier champs** :
- `dateExpiration` : Timestamp (ex: 01/02/2026 23:59:59)
- `statut` : `'publiee'` ou `'expiree'`

### Test 2 : Créer nouvelle demande

1. Connexion client → `/client/nouvelle-demande`
2. Date souhaitée : Aujourd'hui + 3 jours
3. Flexibilité : 2 jours
4. **Soumettre**

**Vérifier Firestore** :
- Champ `dateExpiration` automatiquement calculé
- Date = Date souhaitée + 2 jours à 23:59:59

### Test 3 : Interface artisan

1. Connexion artisan → `/artisan/demandes`
2. **Vérifier** : Demandes expirées absentes de la liste

---

## 📊 Fonctionnement détaillé

### Cycle de vie demande

```
1. Client crée demande (27/01)
   - Date souhaitée : 29/01
   - Flexibilité : ±3 jours
   → dateExpiration = 01/02 23:59:59 ✅

2. Demande visible artisans (27/01 → 01/02)
   - Statut : 'publiee'
   - Artisans peuvent envoyer devis

3. Cloud Function s'exécute (02/02 à 1h du matin)
   - Détecte dateExpiration < now
   - Change statut → 'expiree' ✅
   - Envoie notification client

4. Demande invisible artisans (02/02+)
   - Filtrée automatiquement
   - Client reçoit notification
```

### Notifications automatiques

**Alerte 24h avant** (quotidien 9h) :
```
Si demande expire demain ET aucun devis reçu :
→ "Votre demande expire dans 24h. Aucun devis reçu."
```

**Notification expiration** (quotidien 1h) :
```
Cas 1 : Devis reçus
→ "Votre demande est expirée. Vous avez 2 devis en attente."

Cas 2 : Aucun devis
→ "Votre demande est expirée sans réponse. Créez une nouvelle demande."
```

---

## 🔍 Monitoring

### Logs Cloud Functions

```bash
# Voir logs fonction expiration
firebase functions:log --only expirerDemandesPassees

# Voir logs alerte 24h
firebase functions:log --only alerterDemandesProchesExpiration
```

### Dashboard Firebase

**Console Firebase** → Functions → Logs
- Voir exécutions quotidiennes
- Nombre demandes expirées
- Erreurs éventuelles

---

## ⚠️ Points importants

### 1. Ordre déploiement

**RESPECTER CET ORDRE** :
1. ✅ Migration script (données)
2. ✅ Index Firestore (attendre 5-10 min)
3. ✅ Cloud Functions

Sinon erreur : "Missing index" lors exécution Cloud Function

### 2. Timezone

Les crons s'exécutent en **heure Paris (Europe/Paris)** :
- Expiration : 1h du matin
- Alertes : 9h du matin

### 3. Limite 500 docs

Si > 500 demandes expirées en 1 jour :
- Seulement 500 traitées par exécution
- Les autres traitées le lendemain

---

## 📚 Documentation complète

- **Analyse problème** : `docs/GESTION_DEMANDES_EXPIREES.md`
- **Guide déploiement** : `docs/IMPLEMENTATION_EXPIRATION_DEMANDES.md`

---

## ✅ Résumé

**AVANT** :
- ❌ Demandes restent `'publiee'` indéfiniment
- ❌ Artisans voient demandes mortes
- ❌ Client confus (pas de notification)

**APRÈS** :
- ✅ Expiration automatique quotidienne (1h)
- ✅ Demandes expirées invisibles artisans
- ✅ Client notifié avec options claires
- ✅ Alerte 24h avant expiration

---

**Implémenté par** : GitHub Copilot  
**Date** : 26 janvier 2026  
**Statut** : ✅ Phase 1 complète
