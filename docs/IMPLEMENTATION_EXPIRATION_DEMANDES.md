# Implémentation - Expiration automatique des demandes

## ✅ Statut : Phase 1 COMPLÉTÉE

Date : 26 janvier 2026

## 🎯 Objectif

Résoudre le problème : **"Comment ça se passe si la date avec la flexibilité a été dépassé !"**

**Scénario utilisateur** :
- Client crée demande le 27/01 avec date souhaitée 29/01 ±3 jours
- Fenêtre valide : 26/01 au 01/02 (29 - 3 = 26, 29 + 3 = 01)
- **Question** : Que se passe-t-il après le 02/02 ?

**Problème actuel** :
- ❌ Demande reste en statut `'publiee'` indéfiniment
- ❌ Artisans voient des demandes "mortes"
- ❌ Client ne sait pas que sa demande est expirée
- ❌ Confusion dans l'interface

---

## 📋 Checklist Phase 1 : Expiration automatique

### ✅ 1. Modifications du modèle de données

**Fichier** : `frontend/src/types/firestore.ts`

- [x] Ajout statut `'expiree'` à `DemandeStatut`
  ```typescript
  export type DemandeStatut = 
    | 'brouillon' | 'publiee' | 'matchee' | 'en_cours' 
    | 'expiree'  // ← NOUVEAU
    | 'terminee' | 'annulee';
  ```

- [x] Ajout champ `dateExpiration` à interface `Demande`
  ```typescript
  export interface Demande {
    dateExpiration?: Timestamp; // Date fin fenêtre (dateDebut + flexibilité)
  }
  ```

### ✅ 2. Logique de calcul automatique

**Fichier** : `frontend/src/lib/firebase/demande-service.ts`

- [x] Modification fonction `createDemande()`
- [x] Calcul automatique : `dateExpiration = dateDebut + flexibiliteDays`
- [x] Heure : 23:59:59 (fin de journée)
  ```typescript
  const dateExp = new Date(dateClient.toDate());
  dateExp.setDate(dateExp.getDate() + flexDays);
  dateExp.setHours(23, 59, 59, 999);
  dateExpiration = Timestamp.fromDate(dateExp);
  ```

### ✅ 3. Cloud Function d'expiration

**Fichier** : `functions/src/scheduledJobs/expirerDemandesPassees.ts`

- [x] Fonction `expirerDemandesPassees` (cron quotidien 1h)
- [x] Query : `where('statut', '==', 'publiee') && where('dateExpiration', '<', now)`
- [x] Batch update : statut → `'expiree'`
- [x] Notification client automatique
  - Si devis reçus : "Vous avez X devis en attente"
  - Sinon : "Créez une nouvelle demande avec dates actualisées"

**Bonus** : `alerterDemandesProchesExpiration` (cron quotidien 9h)
- [x] Alerte 24h avant expiration
- [x] Envoi seulement si aucun devis reçu

**Fichier** : `functions/src/index.ts`
- [x] Export des 2 fonctions

### ✅ 4. Filtrage interface artisan

**Fichier** : `frontend/src/app/artisan/demandes/page.tsx`

- [x] Modification `filteredDemandes`
- [x] Exclusion : `statut === 'expiree'` et `statut === 'annulee'`
  ```typescript
  const filteredDemandes = demandes.filter(d => 
    d.statut !== 'expiree' && d.statut !== 'annulee'
  );
  ```

### ✅ 5. Index Firestore composite

**Fichier** : `firestore.indexes.json`

- [x] Ajout index `demandes` (statut + dateExpiration)
  ```json
  {
    "collectionGroup": "demandes",
    "fields": [
      { "fieldPath": "statut", "order": "ASCENDING" },
      { "fieldPath": "dateExpiration", "order": "ASCENDING" }
    ]
  }
  ```

### ✅ 6. Migration données existantes

**Fichier** : `frontend/scripts/migrate-demandes-expiration.ts`

- [x] Script TypeScript complet
- [x] Logique :
  1. Récupère toutes les demandes
  2. Skip si `dateExpiration` existe déjà
  3. Skip si statut `'annulee'` ou `'terminee'`
  4. Calcule `dateExpiration` depuis `datesSouhaitees`
  5. Vérifie si déjà expirée (< now)
  6. Update Firestore (+ change statut si expirée)
- [x] Logs détaillés (avant/après, résumé)

---

## 🚀 Déploiement

### Étape 1 : Migrer les demandes existantes

```bash
# Terminal 1 : Exécuter migration
cd frontend/scripts
npx ts-node --project tsconfig.json migrate-demandes-expiration.ts

# Vérifier logs :
# ✅ X demande(s) migrée(s)
# ⏭️ Y demande(s) ignorée(s)
```

### Étape 2 : Déployer l'index Firestore

```bash
# Terminal 2 : Déployer index
firebase deploy --only firestore:indexes

# Attendre confirmation :
# ✅ Indexes deployed successfully
```

### Étape 3 : Déployer les Cloud Functions

```bash
# Terminal 3 : Installer dépendances
cd functions
npm install

# Déployer fonctions
firebase deploy --only functions:expirerDemandesPassees,functions:alerterDemandesProchesExpiration

# Vérifier logs :
# ✅ Function(s) expirerDemandesPassees deployed successfully
# ✅ Function(s) alerterDemandesProchesExpiration deployed successfully
```

### Étape 4 : Redémarrer frontend

```bash
# Terminal 4 : Redémarrer Next.js
cd frontend
npm run dev

# Vérifier :
# - Page artisan/demandes charge sans erreur
# - Demandes expirées absentes de la liste
```

---

## 🧪 Tests manuels

### Test 1 : Création nouvelle demande

1. **Connexion client** → `/client/nouvelle-demande`
2. **Remplir formulaire** :
   - Date souhaitée : Aujourd'hui + 2 jours
   - Flexibilité : 1 jour
3. **Soumettre**
4. **Vérifier Firestore** :
   ```
   demandes/{id}:
     dateExpiration: Date(aujourd'hui + 2 + 1 jours, 23:59:59)
     statut: 'publiee'
   ```

### Test 2 : Cloud Function (test manuel)

**Option A : Simuler expiration**
1. Créer demande avec date passée (ex: hier)
2. Attendre exécution cron (1h du matin)
3. Vérifier le lendemain :
   - Statut → `'expiree'`
   - Notification client reçue

**Option B : Trigger manuel (Cloud Console)**
1. Aller sur [Firebase Console](https://console.firebase.google.com)
2. Functions → `expirerDemandesPassees` → Logs
3. Cliquer "Run now" (exécution manuelle)
4. Vérifier logs en temps réel

### Test 3 : Interface artisan

1. **Connexion artisan** → `/artisan/demandes`
2. **Vérifier** :
   - Demandes expirées absentes
   - Compteur correct (n'inclut pas expirées)
3. **Créer demande expirée manuellement** (Firestore)
   - Changer statut → `'expiree'`
   - Rafraîchir page artisan
   - **Résultat attendu** : Demande disparaît

### Test 4 : Alerte 24h avant

1. Créer demande expirant demain (dateExpiration = demain 23:59)
2. Attendre cron 9h
3. Vérifier notification client :
   - Type : `'demande_proche_expiration'`
   - Message : "Votre demande expire dans 24h"

---

## 📊 Monitoring

### Logs Cloud Functions

```bash
# Voir logs exécution
firebase functions:log --only expirerDemandesPassees

# Exemple output attendu :
🔄 Début expiration demandes passées...
⏰ Date/heure : 26/01/2026 01:00:00
📊 3 demande(s) expirée(s) trouvée(s)
⏰ Demande abc123 expirée
   - Titre: Réparation fuite
   - Date expiration: 25/01/2026
   - Devis reçus: 2
✅ 3 demande(s) marquée(s) comme expirée(s)
📧 3 notification(s) envoyée(s)
✨ Expiration demandes terminée avec succès
```

### Requête Firestore (vérification manuelle)

```javascript
// Console Firebase ou scripts
db.collection('demandes')
  .where('statut', '==', 'expiree')
  .get()
  .then(snap => {
    console.log(`${snap.size} demandes expirées`);
    snap.forEach(doc => {
      const d = doc.data();
      console.log(`- ${d.titre}: expiré le ${d.dateExpiration.toDate()}`);
    });
  });
```

---

## 🔄 Phases suivantes (TODO)

### Phase 2 : Notifications proactives (OPTIONNEL)

**Déjà implémenté** : Fonction `alerterDemandesProchesExpiration`
- [x] Cron quotidien 9h
- [x] Détection demandes expirant < 24h
- [x] Notification si aucun devis reçu

**À tester** : Attendre qu'une demande expire naturellement

### Phase 3 : Options client (FUTUR)

**Idées** :
- [ ] Bouton "Prolonger demande" (+3 jours)
  - Recalcule `dateExpiration`
  - Repasse statut `'publiee'`
  - Limite : 1 prolongation max
  
- [ ] Bouton "Archiver"
  - Change statut → `'archivee'`
  - Retire de la liste principale
  
- [ ] Bouton "Relancer recherche"
  - Clone demande avec nouvelles dates
  - Ancienne → `'archivee'`

**Fichiers à modifier** :
- `frontend/src/app/client/demandes/page.tsx` (affichage demandes expirées)
- `frontend/src/lib/firebase/demande-service.ts` (fonctions prolonger/archiver)

---

## 📚 Documentation créée

- [x] `docs/GESTION_DEMANDES_EXPIREES.md` - Analyse complète du problème
- [x] `docs/IMPLEMENTATION_EXPIRATION_DEMANDES.md` - Ce fichier

---

## ⚠️ Points d'attention

### 1. Index Firestore

**IMPORTANT** : L'index composite doit être créé **AVANT** de déployer la Cloud Function.

Sinon erreur :
```
Error: The query requires an index. You can create it here: https://...
```

**Solution** :
```bash
firebase deploy --only firestore:indexes
# Attendre 5-10 minutes (création index)
# PUIS déployer functions
```

### 2. Migration existantes

**Exécuter 1 SEULE FOIS** le script de migration **AVANT** déploiement Cloud Function.

Sinon :
- Demandes anciennes sans `dateExpiration` → Erreur Cloud Function
- Impossible de savoir si expiré ou non

### 3. Timezone Cloud Functions

**Vérification** : `.timeZone('Europe/Paris')` dans les crons

Si oublié → Exécution à 1h UTC (2h/3h Paris selon heure d'été)

### 4. Limite 500 docs/batch

Si > 500 demandes expirées en 1 jour :
- Cloud Function traite seulement 500
- Les autres traitées le lendemain

**Amélioration future** : Boucle while jusqu'à tout traiter

---

## 🎉 Résultat attendu

### Avant (problème)

```
Demandes artisan :
- Demande A (29/01 ±3 jours) → Visible le 05/02 ❌
- Demande B (01/02 ±2 jours) → Visible le 10/02 ❌
- Client confus : Pourquoi pas de réponses ? 😕
```

### Après (solution)

```
Demandes artisan :
- Demande A → Statut 'expiree' le 02/02 ✅
  → Invisible pour artisans ✅
  → Client notifié "Demande expirée" ✅
  
- Demande B → Encore valide jusqu'au 04/02 ✅
  → Visible pour artisans ✅
  → Alerte client 24h avant (03/02) ✅
```

---

## 📞 Support

En cas de problème :

1. **Vérifier logs** : `firebase functions:log`
2. **Vérifier index** : Firebase Console → Firestore → Indexes
3. **Relancer migration** : Script idempotent (safe)
4. **Consulter** : `docs/GESTION_DEMANDES_EXPIREES.md`

---

**Auteur** : GitHub Copilot  
**Date** : 26 janvier 2026  
**Version** : 1.0.0
