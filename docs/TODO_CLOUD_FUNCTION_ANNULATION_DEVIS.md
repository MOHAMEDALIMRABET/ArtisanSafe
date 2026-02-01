# Cloud Function - Annulation Automatique Devis Non Payés (24h)

## 📋 Vue d'ensemble

Cette Cloud Function s'exécute automatiquement **toutes les heures** pour vérifier et annuler les devis qui :
1. Ont été signés (`signatureClient` existe)
2. Sont en attente de paiement (`statut === 'en_attente_paiement'`)
3. Ont dépassé le délai de 24h (`dateLimitePaiement` < maintenant)

## 🔧 Implémentation

### Fichier à créer

**Chemin** : `functions/src/scheduledJobs/annulerDevisNonPayes.ts`

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Cloud Function scheduled - S'exécute toutes les heures
 * Annule les devis non payés après 24h et notifie artisans
 */
export const annulerDevisNonPayes = functions.pubsub
  .schedule('every 1 hours')  // Toutes les heures
  .timeZone('Europe/Paris')
  .onRun(async (context) => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    try {
      // 1. Récupérer tous les devis en attente de paiement avec délai dépassé
      const snapshot = await db
        .collection('devis')
        .where('statut', '==', 'en_attente_paiement')
        .where('dateLimitePaiement', '<', now)
        .get();

      if (snapshot.empty) {
        console.log('✅ Aucun devis à annuler');
        return null;
      }

      console.log(`🔄 ${snapshot.size} devis à annuler (délai 24h dépassé)`);

      // 2. Batch pour mise à jour multiple
      const batch = db.batch();
      const notificationsPromises: Promise<any>[] = [];

      snapshot.forEach((doc) => {
        const devis = doc.data();

        // 2a. Annuler le devis
        batch.update(doc.ref, {
          statut: 'annule',
          dateAnnulation: now,
          motifAnnulation: 'Paiement non effectué dans les 24h après signature',
          dateDerniereNotification: now,
          vuParArtisan: false,
        });

        // 2b. Créer notification pour l'artisan
        const notificationRef = db.collection('notifications').doc();
        batch.set(notificationRef, {
          recipientId: devis.artisanId,
          type: 'devis_annule_non_paye',
          title: `Devis ${devis.numeroDevis} annulé`,
          message: `Le client n'a pas payé dans les 24h après signature. Le devis est automatiquement annulé.`,
          relatedId: doc.id,
          relatedType: 'devis',
          lue: false,
          dateCreation: now,
        });

        console.log(`  ❌ Annulé: ${devis.numeroDevis} (Client: ${devis.clientId})`);
      });

      // 3. Exécuter toutes les mises à jour
      await batch.commit();
      console.log(`✅ ${snapshot.size} devis annulés avec succès`);

      return {
        success: true,
        devisAnnules: snapshot.size,
        timestamp: now.toDate().toISOString(),
      };
    } catch (error) {
      console.error('❌ Erreur annulation devis:', error);
      throw error;
    }
  });
```

### Fichier index principal

**Chemin** : `functions/src/index.ts`

```typescript
import * as admin from 'firebase-admin';
admin.initializeApp();

// Exporter toutes les Cloud Functions
export { annulerDevisNonPayes } from './scheduledJobs/annulerDevisNonPayes';
```

### Configuration package.json

**Chemin** : `functions/package.json`

```json
{
  "name": "artisandispo-functions",
  "version": "1.0.0",
  "engines": {
    "node": "18"
  },
  "main": "lib/index.js",
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^4.5.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  },
  "scripts": {
    "build": "tsc",
    "serve": "npm run build && firebase emulators:start --only functions",
    "shell": "npm run build && firebase functions:shell",
    "deploy": "firebase deploy --only functions",
    "logs": "firebase functions:log"
  }
}
```

### Configuration TypeScript

**Chemin** : `functions/tsconfig.json`

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "outDir": "lib",
    "sourceMap": true,
    "strict": true,
    "target": "es2017",
    "esModuleInterop": true
  },
  "compileOnSave": true,
  "include": ["src"]
}
```

## 🚀 Déploiement

### Commandes

```bash
# 1. Installer dépendances
cd functions
npm install

# 2. Build TypeScript
npm run build

# 3. Tester en local (émulateur)
npm run serve

# 4. Déployer en production
firebase deploy --only functions:annulerDevisNonPayes

# 5. Vérifier logs
firebase functions:log --only annulerDevisNonPayes
```

### Vérification Post-Déploiement

```bash
# Voir les exécutions planifiées
gcloud scheduler jobs list

# Forcer exécution manuelle (test)
gcloud scheduler jobs run annulerDevisNonPayes

# Voir logs temps réel
firebase functions:log --only annulerDevisNonPayes --follow
```

## 📊 Monitoring

### Métriques à surveiller

**Firebase Console → Functions → annulerDevisNonPayes** :
- Nombre d'exécutions (1/heure = 24/jour = 720/mois)
- Temps d'exécution moyen (< 10s attendu)
- Taux d'erreur (< 1% acceptable)
- Nombre devis annulés par exécution

### Alertes recommandées

Configurer alertes si :
- Taux d'erreur > 5%
- Temps d'exécution > 30s
- Aucune exécution pendant 2h (fonction désactivée ?)

## 🧪 Tests

### Scénario Test Manuel

```typescript
// 1. Créer devis test avec signature + délai expiré
const testDevis = {
  statut: 'en_attente_paiement',
  signatureClient: { url: '...', date: Timestamp.now() },
  dateLimitePaiement: Timestamp.fromDate(new Date(Date.now() - 2 * 60 * 60 * 1000)), // -2h
  artisanId: 'test-artisan-123',
  numeroDevis: 'DV-TEST-00001',
};

await db.collection('devis').add(testDevis);

// 2. Déclencher fonction manuellement
// Via Console Firebase ou gcloud

// 3. Vérifier résultats
const devisApres = await db.collection('devis').doc(testDevisId).get();
console.log(devisApres.data().statut); // Doit être 'annule'

const notifications = await db.collection('notifications')
  .where('relatedId', '==', testDevisId)
  .get();
console.log(notifications.size); // Doit être 1 (notification artisan)
```

### Test Automatisé (Emulateur)

```typescript
// functions/test/annulerDevisNonPayes.test.ts
import * as admin from 'firebase-admin';
import { annulerDevisNonPayes } from '../src/scheduledJobs/annulerDevisNonPayes';

describe('annulerDevisNonPayes', () => {
  it('devrait annuler devis avec délai dépassé', async () => {
    // Setup test data
    const testDevisRef = await admin.firestore().collection('devis').add({
      statut: 'en_attente_paiement',
      dateLimitePaiement: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 1000)),
      artisanId: 'test-123',
      numeroDevis: 'DV-TEST-001',
    });

    // Execute function
    await annulerDevisNonPayes(null as any);

    // Assert
    const devisApres = await testDevisRef.get();
    expect(devisApres.data()?.statut).toBe('annule');

    // Cleanup
    await testDevisRef.delete();
  });
});
```

## 💰 Coûts

### Quotas Firebase (Spark Plan Gratuit)

- **Cloud Scheduler** : 3 jobs gratuits/projet
- **Cloud Functions invocations** : 2M gratuits/mois
- **Firestore reads** : 50k gratuits/jour

### Estimation Coûts Mensuels

**Scénario** : 100 devis signés/jour
- Exécutions scheduled : 24/jour × 30 = 720/mois ✅ Gratuit
- Reads Firestore : ~100/exécution × 720 = 72k/mois ✅ Gratuit
- Writes Firestore : ~10/jour × 30 = 300/mois ✅ Gratuit

**Total** : 0€/mois (dans quotas gratuits)

## 🔐 Sécurité

### Permissions IAM requises

La Cloud Function a besoin de :
- `firebase.firestore.write` : Mettre à jour statut devis
- `firebase.firestore.read` : Lire devis en attente
- `firebase.cloudScheduler.jobs.run` : Exécuter tâche planifiée

### Firestore Rules

Pas de modification nécessaire (Cloud Functions bypassent les règles avec Admin SDK).

## 📝 Logs Typiques

### Exécution normale (aucun devis à annuler)

```
2026-02-01 10:00:00 INFO annulerDevisNonPayes: ✅ Aucun devis à annuler
```

### Exécution avec annulations

```
2026-02-01 14:00:00 INFO annulerDevisNonPayes: 🔄 3 devis à annuler (délai 24h dépassé)
2026-02-01 14:00:01 INFO annulerDevisNonPayes:   ❌ Annulé: DV-2026-00123 (Client: abc123)
2026-02-01 14:00:01 INFO annulerDevisNonPayes:   ❌ Annulé: DV-2026-00124 (Client: def456)
2026-02-01 14:00:01 INFO annulerDevisNonPayes:   ❌ Annulé: DV-2026-00125 (Client: ghi789)
2026-02-01 14:00:02 INFO annulerDevisNonPayes: ✅ 3 devis annulés avec succès
```

### Erreur

```
2026-02-01 18:00:00 ERROR annulerDevisNonPayes: ❌ Erreur annulation devis:
  Error: PERMISSION_DENIED: Missing or insufficient permissions
```

## 🆘 Troubleshooting

### Fonction ne s'exécute pas

1. Vérifier déploiement : `firebase functions:list`
2. Vérifier Cloud Scheduler : Console GCP → Cloud Scheduler
3. Forcer exécution : `gcloud scheduler jobs run annulerDevisNonPayes`

### Erreurs de permissions

```bash
# Vérifier service account
gcloud projects get-iam-policy [PROJECT_ID]

# Donner permissions Firestore
gcloud projects add-iam-policy-binding [PROJECT_ID] \
  --member="serviceAccount:firebase-adminsdk@[PROJECT_ID].iam.gserviceaccount.com" \
  --role="roles/datastore.user"
```

### Fonction trop lente

- Optimiser requête Firestore (ajouter index si nécessaire)
- Réduire batch size (max 500 docs/batch)
- Augmenter timeout : `functions.pubsub.schedule().timeoutSeconds(300)`

## 📚 Références

- **Cloud Scheduler** : https://cloud.google.com/scheduler/docs
- **Scheduled Functions** : https://firebase.google.com/docs/functions/schedule-functions
- **Firestore Batch Writes** : https://firebase.google.com/docs/firestore/manage-data/transactions#batched-writes

---

**Créé le** : 2026-02-01  
**Priorité** : 🔴 HAUTE (Critique pour workflow paiement)  
**Responsable** : Backend / DevOps  
**Statut** : ⚠️ À implémenter avant production
