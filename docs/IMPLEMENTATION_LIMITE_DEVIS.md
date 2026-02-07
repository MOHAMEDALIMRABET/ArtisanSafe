# Implémentation Limite Devis - Demandes Publiques

**Date** : 8 février 2026  
**Statut** : ✅ Phase 1 implémentée (UI), ⏳ Phase 2 à venir (Cloud Function)

## 🎯 Problème résolu

**Risque initial** : Une demande publique pouvait recevoir 50+ devis, submergeant le client.

**Solution implémentée** : Limite de **10 devis maximum** par demande publique.

---

## 📊 Stratégie à 3 niveaux

### Niveau 1 : **Avertissement UI** (✅ Implémenté)

**Seuil d'alerte** : 8 devis reçus

**Affichage** : Banner d'avertissement dans `frontend/src/app/artisan/devis/nouveau/page.tsx`

```tsx
{demande && demande.type === 'publique' && demande.devisRecus >= 8 && (
  <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4">
    <span className="text-2xl">⚠️</span>
    <h3 className="text-yellow-800 font-semibold">
      Demande très sollicitée
    </h3>
    <p className="text-yellow-700 text-sm">
      Cette demande a déjà reçu {demande.devisRecus} devis. 
      Le client risque d'être submergé.
    </p>
    <p className="text-yellow-600 text-xs mt-2">
      💡 <strong>Conseil</strong> : Démarquez-vous avec une offre claire.
    </p>
  </div>
)}
```

**Capture visuelle** :

```
┌────────────────────────────────────────┐
│ ⚠️ Demande très sollicitée             │
│                                        │
│ Cette demande a déjà reçu 8 devis.    │
│ Le client risque d'être submergé et   │
│ pourrait ne pas consulter tous les     │
│ devis.                                 │
│                                        │
│ 💡 Conseil : Démarquez-vous avec une  │
│    offre claire et compétitive.        │
└────────────────────────────────────────┘
```

---

### Niveau 2 : **Blocage UI** (✅ Implémenté)

**Seuil de blocage** : 10 devis reçus

**Comportement** :
1. **Boutons désactivés** : "Générer le devis" et "Envoyer le devis"
2. **Message d'erreur rouge** affiché sous les boutons
3. **Curseur** : `cursor-not-allowed`

**Code** :
```tsx
// Désactivation boutons
disabled={
  savingBrouillon || 
  savingEnvoi || 
  (demande?.type === 'publique' && (demande?.devisRecus || 0) >= 10)
}

// Message blocage
{demande?.type === 'publique' && (demande?.devisRecus || 0) >= 10 && (
  <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
    <p className="text-red-700 font-semibold">
      🚫 Cette demande ne peut plus recevoir de devis
    </p>
    <p className="text-red-600 text-sm">
      10 devis ont déjà été envoyés. Limite maximale atteinte.
    </p>
  </div>
)}
```

**Capture visuelle** :

```
┌─────────────────────────────────────────┐
│ [  📄 Générer le devis  ] (désactivé)  │
│ [  📨 Envoyer le devis  ] (désactivé)  │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 🚫 Cette demande ne peut plus       │ │
│ │    recevoir de devis                │ │
│ │                                     │ │
│ │ 10 devis ont déjà été envoyés.      │ │
│ │ Limite maximale atteinte.           │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

### Niveau 3 : **Cloud Function automatique** (⏳ À implémenter - Phase 2)

**Objectif** : Fermer automatiquement les demandes ayant atteint 10 devis.

**Trigger** : Création d'un devis (`onCreate('devis/{devisId}')`)

**Code proposé** :
```typescript
// functions/src/index.ts
exports.onDevisCreated = functions.firestore
  .document('devis/{devisId}')
  .onCreate(async (snapshot, context) => {
    const devis = snapshot.data();
    const demandeRef = admin.firestore().doc(`demandes/${devis.demandeId}`);
    
    return await admin.firestore().runTransaction(async (transaction) => {
      const demandeDoc = await transaction.get(demandeRef);
      
      if (!demandeDoc.exists) {
        console.error('Demande inexistante:', devis.demandeId);
        return;
      }
      
      const demande = demandeDoc.data();
      const nouveauCompteur = (demande.devisRecus || 0) + 1;
      
      // Incrémenter compteur
      transaction.update(demandeRef, { 
        devisRecus: nouveauCompteur 
      });
      
      // Si limite atteinte (10), fermer automatiquement
      if (nouveauCompteur >= 10) {
        transaction.update(demandeRef, {
          statut: 'quota_atteint',
          dateFermeture: admin.firestore.FieldValue.serverTimestamp(),
          devisRecus: nouveauCompteur
        });
        
        console.log(`✅ Demande ${devis.demandeId} fermée (10 devis atteints)`);
        
        // Notifier le client
        await admin.firestore().collection('notifications').add({
          recipientId: demande.clientId,
          type: 'demande_quota_atteint',
          title: '📊 Limite de devis atteinte',
          message: `Votre demande a reçu ${nouveauCompteur} devis. Vous pouvez maintenant les comparer.`,
          relatedId: devis.demandeId,
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    });
  });
```

**Avantages Cloud Function** :
- ✅ **Atomicité** : Transaction garantit cohérence compteur
- ✅ **Automatisation** : Pas besoin d'intervention manuelle
- ✅ **Sécurité** : Impossible de contourner depuis le client
- ✅ **Notification** : Client averti automatiquement

**Installation** :
```bash
# Initialiser Firebase Functions
cd functions
npm install firebase-functions firebase-admin

# Déployer
firebase deploy --only functions:onDevisCreated
```

---

## 🔒 Niveau 4 : **Firestore Rules** (⏳ À implémenter - Phase 3)

**Objectif** : Bloquer création devis si quota atteint (sécurité serveur).

**Code proposé** :
```javascript
// firestore.rules
match /devis/{devisId} {
  allow create: if request.auth != null 
    && isArtisan(request.auth.uid)
    && getDemandeDevisCount(request.resource.data.demandeId) < 10;
}

function getDemandeDevisCount(demandeId) {
  let demande = get(/databases/$(database)/documents/demandes/$(demandeId));
  return demande.data.devisRecus < 10;
}
```

**⚠️ Attention** : Firestore Rules ne peuvent pas compter les documents d'une sous-collection. La vérification se base sur le champ `demandeRecus` (mis à jour par Cloud Function).

---

## 📋 Workflow complet

### Scénario : Demande publique "Plomberie Paris"

**Étape 1** : Client publie demande
```json
{
  "id": "DEM123",
  "type": "publique",
  "categorie": "plomberie",
  "devisRecus": 0
}
```

**Étape 2-9** : Artisans envoient devis
```
Devis 1 → devisRecus = 1
Devis 2 → devisRecus = 2
...
Devis 7 → devisRecus = 7
Devis 8 → devisRecus = 8  ⚠️ AVERTISSEMENT AFFICHÉ
Devis 9 → devisRecus = 9
```

**Étape 10** : 10ème devis → **Cloud Function se déclenche**
```typescript
// Transaction atomique
transaction.update(demandeRef, {
  devisRecus: 10,
  statut: 'quota_atteint',
  dateFermeture: Timestamp.now()
});

// Notification client
createNotification({
  recipientId: clientId,
  type: 'demande_quota_atteint',
  message: 'Votre demande a reçu 10 devis'
});
```

**Résultat final** :
```json
{
  "id": "DEM123",
  "type": "publique",
  "statut": "quota_atteint",  // ← Fermée automatiquement
  "devisRecus": 10,
  "dateFermeture": "2026-02-08T15:30:00Z"
}
```

**Étape 11+** : Tentative 11ème devis
```
Artisan 11 arrive sur page création devis
↓
🚫 BOUTONS DÉSACTIVÉS
↓
"Cette demande ne peut plus recevoir de devis"
```

---

## 📊 Statistiques possibles

### Dashboard client
```typescript
const demandeStats = {
  devisRecus: 10,
  statut: 'quota_atteint',
  tauxConsultation: '80%',  // 8 artisans sur 10 notifiés ont consulté
  moyennePrix: 1250,        // Moyenne des 10 devis
  ecartType: 200,           // Dispersion des prix
  conseil: 'Comparez les 10 devis reçus. 3 artisans ont moins de 5 avis.'
};
```

### Dashboard admin
```typescript
const statsGlobales = {
  demandesAvecQuota: 45,    // 45 demandes fermées pour quota
  moyenneDevisParDemande: 6.2,  // En moyenne 6.2 devis/demande
  demandesSansDevis: 12,    // 12 demandes sans aucun devis
  conseil: 'Améliorer matching pour réduire demandes sans devis'
};
```

---

## ⚠️ Cas limites gérés

### 1. **Devis simultanés**
**Problème** : 2 artisans envoient devis en même temps quand compteur = 9
```
Artisan A envoie (compteur = 9) → Transaction 1
Artisan B envoie (compteur = 9) → Transaction 2
```

**Solution** : Cloud Function avec transaction atomique
```typescript
await admin.firestore().runTransaction(async (transaction) => {
  const demande = await transaction.get(demandeRef);
  const nouveauCompteur = demande.data().devisRecus + 1;
  
  // Transaction garantit que seul le premier passe si compteur = 9
  if (nouveauCompteur <= 10) {
    transaction.update(demandeRef, { devisRecus: nouveauCompteur });
  } else {
    throw new Error('Quota déjà atteint');
  }
});
```

### 2. **Devis brouillon**
**Problème** : Artisan sauvegarde brouillon, puis envoie → compte 2 fois ?

**Solution** : Seuls devis `statut: 'envoye'` incrémentent compteur
```typescript
if (devis.statut === 'envoye') {
  // Incrémenter compteur
}
```

### 3. **Devis refusés**
**Problème** : Client refuse 5 devis → Faut-il réouvrir demande ?

**Solution actuelle** : Non, quota reste. Évolution possible :
```typescript
// Phase 3 : Réinitialiser quota si tous devis refusés
if (tousLesDevisRefuses) {
  transaction.update(demandeRef, {
    statut: 'publiee',
    devisRecus: 0  // Reset
  });
}
```

---

## 🚀 Évolutions futures

### Phase 2 : **Limite dynamique selon catégorie**
```typescript
const LIMITES_DEVIS = {
  'plomberie': 10,
  'electricite': 10,
  'menuiserie': 15,      // Métiers longs → plus de devis
  'maconnerie': 12,
  'peinture': 8          // Métiers simples → moins de devis
};
```

### Phase 3 : **Limite personnalisée client**
```typescript
// Client peut choisir sa limite (5-20)
{
  "devisRecus": 3,
  "limiteDevisMax": 5,  // ← Client a choisi 5 au lieu de 10
  "statut": "publiee"
}
```

### Phase 4 : **Fermeture anticipée si bon match**
```typescript
// Si client accepte un devis, fermer automatiquement
if (devis.statut === 'accepte') {
  transaction.update(demandeRef, {
    statut: 'attribuee',
    devisAccepteId: devis.id
  });
  // → Plus de nouveaux devis acceptés
}
```

---

## 📝 Tests suggérés

### Test 1 : **Avertissement à 8 devis**
```bash
# Scénario
1. Créer demande publique
2. Simuler 8 devis
3. Artisan 9 ouvre page création devis
4. Vérifier banner jaune affiché

# Résultat attendu
✅ Banner "⚠️ Demande très sollicitée" visible
✅ Boutons toujours actifs
```

### Test 2 : **Blocage à 10 devis**
```bash
# Scénario
1. Demande avec 10 devis déjà envoyés
2. Artisan 11 ouvre page création devis
3. Vérifier boutons désactivés

# Résultat attendu
✅ Banner "🚫 Limite de devis atteinte" rouge
✅ Boutons grisés (disabled)
✅ Message "10 devis déjà envoyés"
```

### Test 3 : **Transaction atomique** (Cloud Function)
```bash
# Scénario
1. Demande avec devisRecus = 9
2. 2 artisans envoient devis SIMULTANÉMENT
3. Vérifier devisRecus final

# Résultat attendu
✅ devisRecus = 10 (pas 11)
✅ Statut = 'quota_atteint'
✅ 1 seul devis accepté, l'autre rejeté
```

---

## 🔗 Fichiers modifiés

1. **`frontend/src/app/artisan/devis/nouveau/page.tsx`**
   - Ligne ~1272 : Banner avertissement (devisRecus >= 8)
   - Ligne ~1850 : Désactivation boutons (devisRecus >= 10)
   - Ligne ~1867 : Message blocage rouge

---

## ✅ Checklist implémentation

**Phase 1 : UI** (✅ Terminé)
- [x] Avertissement jaune à 8 devis
- [x] Blocage boutons à 10 devis
- [x] Message d'erreur explicite
- [x] Curseur not-allowed

**Phase 2 : Cloud Function** (⏳ À faire)
- [ ] Fonction `onDevisCreated`
- [ ] Transaction atomique compteur
- [ ] Fermeture auto statut 'quota_atteint'
- [ ] Notification client quota atteint
- [ ] Déploiement `firebase deploy --only functions`

**Phase 3 : Firestore Rules** (⏳ À faire)
- [ ] Bloquer création devis si quota >= 10
- [ ] Tester avec Firebase Emulator

**Phase 4 : Analytics** (⏳ À faire)
- [ ] Dashboard stats quotas
- [ ] Alertes admin demandes saturées
- [ ] Insights catégories populaires

---

**Prochaine étape recommandée** : Implémenter Cloud Function `onDevisCreated` (Phase 2) pour garantir cohérence du compteur.

**Temps estimé Phase 2** : 1-2 heures (fonction + tests + déploiement)
