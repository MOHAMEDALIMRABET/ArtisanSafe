# Implémentation Tracking Artisans - Demandes Publiques

**Date** : 8 février 2026  
**Statut** : ✅ Implémenté

## 🎯 Objectif

Utiliser les champs `artisansNotifiesIds` et `artisansInteressesIds` pour :
1. **Notifier** les artisans qualifiés quand une demande publique est créée
2. **Tracker** la consultation des demandes par les artisans

---

## 📋 Fonctionnalités implémentées

### 1. **Notification artisans qualifiés** ✅

**Service** : `frontend/src/lib/firebase/demande-service.ts`

```typescript
export async function notifyQualifiedArtisans(demandeId: string): Promise<string[]>
```

**Workflow** :
1. Client publie demande publique
2. Système récupère artisans qualifiés (métier + localisation)
3. Crée notification pour chaque artisan
4. Enregistre IDs dans `demande.artisansNotifiesIds`

**Déclenchement** : `frontend/src/app/resultats/page.tsx` ligne ~635
```typescript
// Créer la demande publique
const demandeId = await createDemande({ ... });

// Notifier les artisans qualifiés (en arrière-plan)
notifyQualifiedArtisans(demandeId).catch(error => {
  console.error('⚠️ Erreur notification artisans:', error);
});
```

---

### 2. **Tracking consultation demande** ✅

**Service** : `frontend/src/lib/firebase/demande-service.ts`

```typescript
export async function markDemandeAsViewed(demandeId: string, artisanId: string): Promise<void>
```

**Workflow** :
1. Artisan clique sur "Envoyer un devis" (demande publique)
2. Système ajoute artisanId à `demande.artisansInteressesIds`
3. Évite doublons (vérifie présence avant ajout)

**Déclenchement** : `frontend/src/app/artisan/demandes/page.tsx`
- Ligne ~808 : Bouton "📝 Envoyer un devis"
- Ligne ~779 : Bouton "🔄 Créer un devis révisé"

```typescript
onClick={async () => {
  // Tracker consultation pour demandes publiques
  if (demande.type === 'publique' && authUser) {
    const { markDemandeAsViewed } = await import('@/lib/firebase/demande-service');
    markDemandeAsViewed(demande.id, authUser.uid).catch(error => {
      console.error('⚠️ Erreur tracking consultation:', error);
    });
  }
  router.push(`/artisan/devis/nouveau?demandeId=${demande.id}`);
}}
```

---

### 3. **Service auxiliaire** ✅

**Service** : `frontend/src/lib/firebase/artisan-service.ts`

```typescript
export async function getArtisansByMetierAndLocation(
  metier: string,
  ville: string,
  rayonKm: number = 50
): Promise<Artisan[]>
```

**Utilisation** : Récupère artisans qualifiés pour notification

**Filtres** :
- ✅ `verificationStatus === 'approved'`
- ✅ Métier dans `artisan.metiers`
- ✅ Localisation (ville ou rayon si coordonnées GPS)

---

## 🔍 Données trackées

### Dans Firestore `demandes` collection

```typescript
interface Demande {
  // ...
  artisansNotifiesIds?: string[];    // IDs artisans notifiés (lors création)
  artisansInteressesIds?: string[];  // IDs artisans ayant consulté (clic devis)
}
```

**Exemple** :
```json
{
  "id": "abc123",
  "type": "publique",
  "categorie": "plomberie",
  "artisansNotifiesIds": ["artisan1", "artisan2", "artisan3"], // 3 notifiés
  "artisansInteressesIds": ["artisan1", "artisan3"],           // 2 ont consulté
  "devisRecus": 1                                              // 1 a envoyé devis
}
```

**Insights possibles** :
- Taux de consultation : `artisansInteressesIds.length / artisansNotifiesIds.length`
- Taux de conversion : `devisRecus / artisansInteressesIds.length`

---

## 📊 Cas d'usage métier

### 1. **Dashboard Admin**
```typescript
// Statistiques demandes publiques
const demandeStats = {
  notifies: demande.artisansNotifiesIds?.length || 0,
  consultes: demande.artisansInteressesIds?.length || 0,
  devisRecus: demande.devisRecus,
  tauxConsultation: (consultes / notifies * 100).toFixed(1) + '%',
  tauxConversion: (devisRecus / consultes * 100).toFixed(1) + '%'
};
```

### 2. **Relance artisans**
```typescript
// Artisans notifiés mais pas consultés (après 24h)
const artisansARelancer = demande.artisansNotifiesIds.filter(
  id => !demande.artisansInteressesIds?.includes(id)
);
```

### 3. **Scoring artisan**
```typescript
// Artisan réactif = consulte rapidement après notification
const artisanStats = {
  demandesNotifiees: 50,
  demandesConsultees: 45,  // artisansInteressesIds
  devisEnvoyes: 30,
  tauxReactivite: '90%'    // 45/50
};
```

---

## ⚠️ Points d'attention

### 1. **Notifications en arrière-plan**
```typescript
// Ne bloque PAS la redirection si notification échoue
notifyQualifiedArtisans(demandeId).catch(error => {
  console.error('⚠️ Erreur notification artisans:', error);
});
```

### 2. **Éviter doublons tracking**
```typescript
// Vérifie si artisan déjà dans la liste
if (!artisansInteressesIds.includes(artisanId)) {
  await updateDoc(demandeRef, {
    artisansInteressesIds: [...artisansInteressesIds, artisanId]
  });
}
```

### 3. **Performance notification**
- **Problème** : Si 100 artisans qualifiés → 100 notifications Firestore writes
- **Solution future** : Batch writes (max 500/batch)
```typescript
const batch = db.batch();
artisansIds.forEach(id => {
  const notifRef = doc(collection(db, 'notifications'));
  batch.set(notifRef, { ... });
});
await batch.commit();
```

---

## 🚀 Évolutions futures

### Phase 2 : **Filtres avancés**
```typescript
// Exclure artisans déjà notifiés récemment (spam prevention)
const artisansDisponibles = artisans.filter(a => {
  const derniereNotif = a.derniereNotificationDemande;
  const delaiMinimum = 1 * 60 * 60 * 1000; // 1h
  return !derniereNotif || (Date.now() - derniereNotif.toMillis() > delaiMinimum);
});
```

### Phase 3 : **Analytics détaillées**
```typescript
interface DemandeAnalytics {
  tempsConsultationMoyen: number;      // Temps entre notification et consultation
  tempsDevisMoyen: number;             // Temps entre consultation et envoi devis
  artisansPlusReactifs: string[];      // Top 10 artisans réactifs
}
```

### Phase 4 : **Relances automatiques** (Cloud Function)
```typescript
// Cloud Function quotidienne
exports.relanceArtisans = functions.pubsub
  .schedule('every day 10:00')
  .onRun(async () => {
    // Demandes publiées il y a 24h avec peu de devis
    const demandes = await getDemandesAvecPeuDeDevis();
    
    demandes.forEach(async demande => {
      const artisansARelancer = demande.artisansNotifiesIds.filter(
        id => !demande.artisansInteressesIds?.includes(id)
      );
      
      // Envoyer notification de relance
      artisansARelancer.forEach(async artisanId => {
        await createNotification({
          recipientId: artisanId,
          type: 'relance_demande_publique',
          title: '🔔 Rappel : Demande encore disponible',
          message: `La demande "${demande.categorie}" à ${demande.localisation.ville} attend votre devis`,
          relatedId: demande.id
        });
      });
    });
  });
```

---

## 📝 Tests suggérés

### Test 1 : **Notification création demande**
```bash
# Scénario
1. Client publie demande publique (plomberie Paris)
2. Vérifier notifications créées pour artisans plombiers Paris
3. Vérifier artisansNotifiesIds contient IDs corrects

# Résultat attendu
✅ Notifications envoyées aux artisans qualifiés uniquement
✅ artisansNotifiesIds = ['artisan1', 'artisan2', ...]
```

### Test 2 : **Tracking consultation**
```bash
# Scénario
1. Artisan consulte demande publique
2. Clique "Envoyer un devis"
3. Vérifier artisansInteressesIds mis à jour

# Résultat attendu
✅ artisansInteressesIds contient ID artisan
✅ Pas de doublon si artisan clique 2 fois
```

### Test 3 : **Performance 100 artisans**
```bash
# Scénario
1. Demande publique matchant 100 artisans
2. Mesurer temps création notifications
3. Vérifier pas d'erreur timeout

# Résultat attendu
✅ Notifications créées en < 5s
✅ Pas d'erreur Firestore write limit
```

---

## 🔗 Fichiers modifiés

1. **`frontend/src/lib/firebase/demande-service.ts`**
   - `markDemandeAsViewed()` : Tracker consultation
   - `notifyQualifiedArtisans()` : Notifier artisans

2. **`frontend/src/lib/firebase/artisan-service.ts`**
   - `getArtisansByMetierAndLocation()` : Récupérer artisans qualifiés

3. **`frontend/src/app/resultats/page.tsx`**
   - Ligne ~635 : Appel `notifyQualifiedArtisans()` après création demande

4. **`frontend/src/app/artisan/demandes/page.tsx`**
   - Ligne ~808 : Tracking clic "Envoyer un devis"
   - Ligne ~779 : Tracking clic "Créer un devis révisé"

---

## ✅ Checklist implémentation

- [x] Service `markDemandeAsViewed()`
- [x] Service `notifyQualifiedArtisans()`
- [x] Service `getArtisansByMetierAndLocation()`
- [x] Appel notification création demande publique
- [x] Tracking consultation bouton "Envoyer devis"
- [x] Tracking consultation bouton "Devis révisé"
- [x] Éviter doublons artisansInteressesIds
- [x] Gestion erreurs (catch sans bloquer UX)
- [ ] Tests unitaires
- [ ] Analytics dashboard admin
- [ ] Relances automatiques (Cloud Function)

---

**Prochaine étape recommandée** : Implémenter limite 10 devis par demande publique (voir `IMPLEMENTATION_LIMITE_DEVIS.md`)
