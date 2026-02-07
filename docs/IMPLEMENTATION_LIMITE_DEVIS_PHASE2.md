# Phase 2 : Cloud Function - Limite 10 devis par demande publique

## 📋 Vue d'ensemble

**Objectif** : Automatiser l'incrémentation du compteur `devisRecus` et la fermeture automatique des demandes publiques à 10 devis reçus.

**Implémentation** : ✅ **TERMINÉE** (February 8, 2026)

---

## 🎯 Fonctionnalités implémentées

### 1. Cloud Function `onDevisCreated`

**Déclencheur** : `onCreate` sur collection `devis`  
**Région** : `europe-west1` (Paris)  
**Fichier** : `functions/src/triggers/devisTriggers.ts`

#### Workflow automatique

```
1. Artisan crée un nouveau devis
   ↓
2. Cloud Function s'exécute automatiquement
   ↓
3. Transaction atomique :
   - Incrémente demande.devisRecus +1
   - Met à jour demande.dateModification
   ↓
4. Vérification quota :
   - Si devisRecus < 8 : Continue normalement ✅
   - Si 8 ≤ devisRecus < 10 : Notification seuil proche ⚠️
   - Si devisRecus ≥ 10 : Fermeture automatique 🔒
   ↓
5. Si quota atteint (10 devis) :
   - Statut demande → 'quota_atteint'
   - Ajout dateFermeture (timestamp)
   - Notification client : "Quota atteint, demande fermée"
```

#### Code principal

```typescript
// Incrémentation atomique (évite race conditions)
const nouveauCompteur = await db.runTransaction(async (transaction) => {
  const freshDemandeSnap = await transaction.get(demandeRef);
  const currentCount = freshDemandeSnap.data()!.devisRecus || 0;
  const newCount = currentCount + 1;

  transaction.update(demandeRef, {
    devisRecus: newCount,
    dateModification: admin.firestore.FieldValue.serverTimestamp()
  });

  return newCount;
});

// Fermeture si quota atteint
if (nouveauCompteur >= 10) {
  await demandeRef.update({
    statut: 'quota_atteint',
    dateFermeture: admin.firestore.FieldValue.serverTimestamp()
  });

  // Notification client
  await db.collection('notifications').add({
    recipientId: demandeData.clientId,
    type: 'quota_devis_atteint',
    title: '✅ Quota de devis atteint',
    message: 'Votre demande a reçu 10 devis et a été automatiquement fermée...',
    // ...
  });
}
```

---

### 2. Cloud Function `onDevisDeleted` (Bonus)

**Déclencheur** : `onDelete` sur collection `devis`  
**Use case** : Admin supprime devis spam/frauduleux

#### Workflow

```
1. Admin supprime devis frauduleux
   ↓
2. Cloud Function décremente devisRecus -1
   ↓
3. Si demande était fermée (quota_atteint) :
   - Compteur redescend < 10
   - Statut → 'publiee' (réouverture)
   - Suppression dateFermeture
```

**Avantage** : Rétablit quota pour permettre devis légitime.

---

### 3. HTTP Function `syncDevisCounter` (Admin)

**Endpoint** : `POST /syncDevisCounter`  
**Use case** : Resynchroniser compteur manuellement si désynchronisé

#### Exemple utilisation

```bash
curl -X POST https://europe-west1-artisandispo.cloudfunctions.net/syncDevisCounter \
  -H "Content-Type: application/json" \
  -d '{"demandeId": "dem123"}'
```

#### Réponse

```json
{
  "success": true,
  "demandeId": "dem123",
  "oldCount": 8,
  "newCount": 7,
  "difference": -1
}
```

**Workflow interne** :
1. Compte les documents réels : `devis.where('demandeId', '==', ...)`
2. Met à jour `demande.devisRecus` avec le vrai compteur
3. Retourne différence pour audit

---

## 📊 Notifications automatiques

### Notification 1 : Seuil proche (8-9 devis)

**Déclencheur** : `devisRecus >= 8 && < 10`

```typescript
{
  type: 'seuil_devis_proche',
  title: '⚠️ Quota de devis bientôt atteint',
  message: 'Votre demande "Plomberie" a reçu 8 devis. La demande sera automatiquement fermée à 10 devis.',
  metadata: {
    devisRecus: 8,
    quotaMax: 10
  }
}
```

**Objectif** : Avertir client qu'il approche de la limite (temps de consulter devis).

---

### Notification 2 : Quota atteint (10 devis)

**Déclencheur** : `devisRecus >= 10`

```typescript
{
  type: 'quota_devis_atteint',
  title: '✅ Quota de devis atteint',
  message: 'Votre demande "Plomberie" a reçu 10 devis et a été automatiquement fermée. Vous pouvez maintenant comparer les offres...',
  metadata: {
    demandeId: 'dem123',
    metier: 'plomberie',
    ville: 'Paris',
    devisRecus: 10
  }
}
```

**Action** : Rediriger client vers `/client/devis?demandeId=dem123`.

---

## 🎨 Changements UI Frontend

### 1. Nouveau statut Firestore

**Type** : `DemandeStatut` (frontend/src/types/firestore.ts)

```typescript
export type DemandeStatut = 
  | 'genere' 
  | 'publiee' 
  | 'matchee' 
  | 'en_cours' 
  | 'attribuee'
  | 'expiree'
  | 'quota_atteint'  // ← NOUVEAU
  | 'terminee' 
  | 'annulee';
```

---

### 2. Badge artisan (artisan/demandes)

**Affichage** : Si `demande.statut === 'quota_atteint'`

```tsx
<span className="bg-orange-100 text-orange-800 px-3 py-1.5 rounded-full text-sm font-bold border-2 border-orange-300">
  🔒 Quota atteint (10 devis max)
</span>
```

**Bouton bloqué** :

```tsx
{demande.statut === 'quota_atteint' && (
  <div className="flex-1 bg-orange-50 text-orange-700 px-4 py-3 rounded-lg font-semibold border-2 border-orange-300 text-center">
    🔒 Quota atteint - Demande fermée
  </div>
)}
```

**Comportement** : Artisan ne peut plus envoyer de devis.

---

### 3. Badge client (client/demandes)

**Affichage** :

```tsx
{demande.statut === 'quota_atteint' && (
  <div className="mt-2 inline-block">
    <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-bold border-2 border-orange-300">
      🔒 Quota atteint (10/10)
    </span>
    <p className="text-xs text-orange-600 mt-1 font-medium">
      ✅ Demande fermée automatiquement
    </p>
  </div>
)}
```

**Message** : Informe client que demande est fermée, peut consulter les 10 devis.

---

## 🔐 Sécurité & Atomicité

### Pourquoi Cloud Function vs Frontend ?

| Critère | Frontend | Cloud Function |
|---------|----------|----------------|
| **Atomicité** | ❌ Race conditions possibles | ✅ Transaction Firestore |
| **Sécurité** | ❌ Peut être bypassé (DevTools) | ✅ Backend secure |
| **Fiabilité** | ❌ Si frontend crash/fermé | ✅ Toujours exécuté |
| **Cohérence** | ❌ Compteur peut désynchroniser | ✅ Garantie à 100% |

### Transaction atomique

**Problème sans transaction** :
```
T1 : Artisan A lit devisRecus = 9
T2 : Artisan B lit devisRecus = 9
T1 : Artisan A écrit devisRecus = 10
T2 : Artisan B écrit devisRecus = 10  ← BUG (devrait être 11)
```

**Solution avec transaction** :
```typescript
await db.runTransaction(async (transaction) => {
  const snapshot = await transaction.get(demandeRef);
  const currentCount = snapshot.data()!.devisRecus || 0;
  
  transaction.update(demandeRef, {
    devisRecus: currentCount + 1  // ✅ Incrémentation atomique
  });
});
```

**Garantie** : Firestore verrouille le document pendant la transaction.

---

## 📈 Logs & Monitoring

### Logs Cloud Function

**Exemple logs onDevisCreated** :

```
🔄 [onDevisCreated] Démarrage pour devis: dev123
   Demande ID: dem456
   Artisan ID: art789
   Client ID: cli012

📊 [onDevisCreated] Type: publique
📊 [onDevisCreated] Devis reçus actuel: 9

✅ [onDevisCreated] Compteur incrémenté: 9 → 10

🚨 [onDevisCreated] QUOTA ATTEINT (10/10) - Fermeture demande
✅ [onDevisCreated] Statut changé: → 'quota_atteint'
✅ [onDevisCreated] Notification client envoyée

📈 [ANALYTICS] Demande fermée par quota
   Demande ID: dem456
   Client: client@example.com
   Métier: plomberie
   Ville: Paris
   Devis reçus: 10

✅ [onDevisCreated] Traitement terminé avec succès
```

**Commandes Firebase** :

```bash
# Voir tous les logs
firebase functions:log

# Logs onDevisCreated uniquement
firebase functions:log --only onDevisCreated

# Logs en temps réel
firebase functions:log --only onDevisCreated --follow
```

---

## 🚀 Déploiement

### Prérequis

1. Installer Firebase CLI :
```bash
npm install -g firebase-tools
firebase login
```

2. Build TypeScript :
```bash
cd functions
npm run build
```

### Déployer toutes les fonctions

```bash
cd functions
npm run deploy
```

**Équivalent** :
```bash
npm run build && firebase deploy --only functions
```

### Déployer fonction spécifique

```bash
# Déployer onDevisCreated uniquement
firebase deploy --only functions:onDevisCreated

# Déployer onDevisDeleted uniquement
firebase deploy --only functions:onDevisDeleted

# Déployer syncDevisCounter uniquement
firebase deploy --only functions:syncDevisCounter
```

### Déploiement combiné

```bash
# Déployer les 3 fonctions devis
firebase deploy --only functions:onDevisCreated,functions:onDevisDeleted,functions:syncDevisCounter
```

### Vérifier déploiement

```bash
# Lister fonctions actives
firebase functions:list

# Voir logs déploiement
firebase functions:log
```

---

## 🧪 Tests

### Test 1 : Incrémentation compteur

**Scénario** : Artisan envoie devis pour demande avec 5 devis existants

**Steps** :
1. Aller sur `/artisan/devis/nouveau?demandeId=dem123`
2. Remplir formulaire devis
3. Cliquer "Envoyer le devis"
4. ✅ Vérifier :
   - `demandes/dem123.devisRecus` = 6
   - Logs Cloud Function : `✅ Compteur incrémenté: 5 → 6`

---

### Test 2 : Notification seuil (8 devis)

**Scénario** : Demande passe de 7 à 8 devis

**Steps** :
1. Demande avec 7 devis existants
2. Artisan envoie 8e devis
3. ✅ Vérifier :
   - Client reçoit notification : "⚠️ Quota de devis bientôt atteint"
   - Demande reste `statut: 'publiee'`
   - Badge jaune affiché UI

---

### Test 3 : Fermeture quota (10 devis)

**Scénario** : Demande passe de 9 à 10 devis

**Steps** :
1. Demande avec 9 devis existants
2. Artisan envoie 10e devis
3. ✅ Vérifier :
   - `demandes/dem123.statut` = 'quota_atteint'
   - `demandes/dem123.dateFermeture` = timestamp actuel
   - Client reçoit notification : "✅ Quota de devis atteint"
   - Badge orange "🔒 Quota atteint" affiché
   - Bouton "Envoyer un devis" désactivé pour artisans

---

### Test 4 : Tentative 11e devis (UI bloquée)

**Scénario** : Artisan tente envoyer devis sur demande quota_atteint

**Steps** :
1. Demande avec `statut: 'quota_atteint'`
2. Artisan consulte `/artisan/demandes`
3. ✅ Vérifier :
   - Bouton "Envoyer un devis" **masqué**
   - Message affiché : "🔒 Quota atteint - Demande fermée"
   - Si artisan force URL `/artisan/devis/nouveau?demandeId=...` :
     - Banner rouge bloquant affiché (Phase 1 UI)
     - Boutons désactivés

**Sécurité supplémentaire** : Phase 3 (Firestore Rules) bloquera côté serveur.

---

### Test 5 : Suppression devis (onDevisDeleted)

**Scénario** : Admin supprime devis frauduleux

**Steps** :
1. Demande avec `devisRecus: 10` + `statut: 'quota_atteint'`
2. Admin supprime 1 devis depuis Firestore console
3. ✅ Vérifier :
   - `demandes/dem123.devisRecus` = 9
   - `demandes/dem123.statut` = 'publiee' (réouverture)
   - `demandes/dem123.dateFermeture` = supprimé
   - Logs : `🔓 Quota libéré - Réouverture demande`

---

### Test 6 : Resynchronisation manuelle

**Scénario** : Compteur désynchronisé (bug, migration)

**Steps** :
1. Demande avec `devisRecus: 8` mais 10 devis réels en base
2. Appeler API :
```bash
curl -X POST https://europe-west1-artisandispo.cloudfunctions.net/syncDevisCounter \
  -H "Content-Type: application/json" \
  -d '{"demandeId": "dem123"}'
```
3. ✅ Vérifier :
   - `demandes/dem123.devisRecus` = 10
   - Réponse API : `{ oldCount: 8, newCount: 10, difference: +2 }`

---

## 📊 Statistiques & Analytics

### Données collectées

Chaque fermeture quota génère log analytics :

```
📈 [ANALYTICS] Demande fermée par quota
   Demande ID: dem456
   Client: client@example.com
   Métier: plomberie
   Ville: Paris
   Devis reçus: 10
```

### Métriques exploitables

1. **Taux de saturation** : Combien de demandes atteignent quota ?
2. **Métiers populaires** : Quels métiers saturent le plus ?
3. **Villes actives** : Localités avec le plus de concurrence artisans
4. **Temps moyen quota** : Délai entre publication et 10 devis

### Export logs (BigQuery - futur)

**Configuration** : Firebase Console → Functions → Logs → Export to BigQuery

**Requête exemple** :
```sql
SELECT
  JSON_EXTRACT(jsonPayload.metadata, '$.metier') AS metier,
  JSON_EXTRACT(jsonPayload.metadata, '$.ville') AS ville,
  COUNT(*) AS nb_fermetures_quota
FROM `project.dataset.logs_table`
WHERE textPayload LIKE '%ANALYTICS%Demande fermée par quota%'
GROUP BY metier, ville
ORDER BY nb_fermetures_quota DESC
```

---

## 🔮 Évolutions futures

### Phase 3 : Firestore Rules (Sécurité)

**Objectif** : Bloquer côté serveur création 11e devis (double protection).

**Fichier** : `firestore.rules`

```javascript
match /devis/{devisId} {
  allow create: if request.auth != null && 
                   request.auth.uid == request.resource.data.artisanId &&
                   getDemandeDevisCount(request.resource.data.demandeId) < 10;
}

// Helper function
function getDemandeDevisCount(demandeId) {
  let demande = get(/databases/$(database)/documents/demandes/$(demandeId));
  return demande.data.devisRecus;
}
```

**Limitation** : Firestore Rules ne peuvent pas faire `count()`  
**Solution** : Utiliser compteur `devisRecus` (maintenu par Cloud Function).

---

### Quota personnalisé par demande

**Use case** : Client urgent veut 5 devis max (pas 10).

**Ajout champ** :
```typescript
interface Demande {
  // ...
  quotaMax?: number;  // Par défaut: 10
}
```

**Modification Cloud Function** :
```typescript
const quotaMax = demandeData.quotaMax || 10;

if (nouveauCompteur >= quotaMax) {
  // Fermeture
}
```

---

### Notification artisans à 9 devis

**Use case** : Avertir artisans que demande va bientôt fermer.

**Trigger** : `devisRecus === 9`

**Notification** :
```typescript
await db.collection('notifications').add({
  recipientId: artisan.id,  // Pour TOUS artisans matchés (artisansNotifiesIds)
  type: 'demande_bientot_fermee',
  title: '⏰ Dernière chance !',
  message: 'La demande "Plomberie à Paris" va recevoir son 10e devis. Envoyez le vôtre rapidement !',
  relatedId: demandeId
});
```

**Objectif** : Créer urgence pour artisans indécis.

---

## 📝 Checklist déploiement

- [x] **Code Cloud Function** : `functions/src/triggers/devisTriggers.ts`
- [x] **Export fonction** : `functions/src/index.ts`
- [x] **Type Firestore** : `DemandeStatut` ajouté 'quota_atteint'
- [x] **UI Artisan** : Badge + bouton bloqué
- [x] **UI Client** : Badge + message fermeture
- [x] **Documentation** : Ce fichier
- [ ] **Tests unitaires** : Jest (à implémenter)
- [ ] **Tests E2E** : Cypress (à implémenter)
- [ ] **Déploiement production** : `firebase deploy --only functions:onDevisCreated`
- [ ] **Monitoring** : Alertes Stackdriver si erreurs > 5%
- [ ] **Phase 3** : Firestore Rules (optionnel)

---

## 🎉 Résumé Phase 2

| Composant | Statut | Fichiers modifiés |
|-----------|--------|-------------------|
| Cloud Function `onDevisCreated` | ✅ FAIT | `functions/src/triggers/devisTriggers.ts` |
| Cloud Function `onDevisDeleted` | ✅ FAIT | (même fichier) |
| HTTP Function `syncDevisCounter` | ✅ FAIT | (même fichier) |
| Type `DemandeStatut` | ✅ FAIT | `frontend/src/types/firestore.ts` |
| UI Artisan (badges + blocage) | ✅ FAIT | `frontend/src/app/artisan/demandes/page.tsx` |
| UI Client (badge quota) | ✅ FAIT | `frontend/src/app/client/demandes/page.tsx` |
| Documentation | ✅ FAIT | Ce fichier |
| Tests | ⏳ TODO | `functions/src/__tests__/` |
| Déploiement production | ⏳ TODO | Firebase Functions |

**Temps total** : ~2h (estimation vs réalité)

**Prochaine étape** : Déployer en production avec `npm run deploy` dans `functions/`.

---

## 🔗 Références

- **Phase 1 (UI)** : `docs/IMPLEMENTATION_LIMITE_DEVIS.md`
- **Tracking artisans** : `docs/IMPLEMENTATION_TRACKING_ARTISANS.md`
- **Cloud Functions Doc** : https://firebase.google.com/docs/functions
- **Transactions Firestore** : https://firebase.google.com/docs/firestore/manage-data/transactions

---

**Dernière mise à jour** : February 8, 2026  
**Version** : 2.0  
**Auteur** : GitHub Copilot + User  
**Status** : ✅ Production Ready (après déploiement)
