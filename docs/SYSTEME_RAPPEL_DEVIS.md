# 🔔 Système de Rappel Automatique - Devis Non Répondus

**Date de création** : 2026-02-01  
**Statut** : ✅ Implémenté  
**Cloud Function** : `rappellerDevisNonRepondus`  
**Fréquence** : Tous les jours à 9h (Europe/Paris)

---

## 📋 Contexte

### Problème
Lorsqu'un artisan envoie un devis avec une **date de début des travaux** prévue, le client peut ne pas répondre (accepter/refuser). Si la date de début approche ou est dépassée sans réponse, cela crée :
- ❌ Frustration artisan (a réservé du temps pour rien)
- ❌ Blocage planning (artisan ne sait pas s'il peut prendre d'autres chantiers)
- ❌ Perte de temps (devis obsolète mais reste en statut 'envoye')

### Solution
Système de **rappels progressifs** automatiques basés sur la `dateDebutPrevue` du devis.

---

## 🎯 Fonctionnement

### Workflow Complet

```
┌─────────────────────────────────────────────────────────┐
│ Artisan envoie devis avec dateDebutPrevue: 15/02/2026   │
│ Statut: 'envoye'                                         │
└─────────────────────────────────────────────────────────┘
                    ↓
        [Client ne répond pas]
                    ↓
┌─────────────────────────────────────────────────────────┐
│ 8 février (-7 jours) : Cloud Function s'exécute         │
│ → Détecte : joursRestants = 7                           │
│ → Action: envoyerRappel7Jours()                         │
│   ✅ Notification client (type: 'rappel_devis_7j')      │
│   ✅ Mise à jour devis.rappels.rappel7JoursEnvoye       │
└─────────────────────────────────────────────────────────┘
                    ↓
        [Toujours pas de réponse]
                    ↓
┌─────────────────────────────────────────────────────────┐
│ 12 février (-3 jours) : Cloud Function s'exécute        │
│ → Détecte : joursRestants = 3                           │
│ → Action: envoyerRappel3Jours()                         │
│   ⚠️ Notification URGENTE (priority: 'urgent')          │
│   ✅ Mise à jour devis.rappels.rappel3JoursEnvoye       │
└─────────────────────────────────────────────────────────┘
                    ↓
        [Toujours pas de réponse]
                    ↓
┌─────────────────────────────────────────────────────────┐
│ 15 février (jour J) : Cloud Function s'exécute          │
│ → Détecte : joursRestants = 0                           │
│ → Action: expirerDevisDateDepassee()                    │
│   ❌ Statut devis → 'expire'                            │
│   📝 motifExpiration: 'date_debut_depassee'             │
│   ✅ Notification client + artisan                      │
└─────────────────────────────────────────────────────────┘
```

---

## ⚙️ Implémentation Technique

### Cloud Function

**Fichier** : `functions/src/scheduledJobs/rappellerDevisNonRepondus.ts`

**Déclencheur** : Cron expression `0 9 * * *` (tous les jours à 9h)

**Algorithme** :
```typescript
1. Query: Récupérer tous devis où statut = 'envoye'
2. Pour chaque devis :
   - Calculer: joursRestants = dateDebutPrevue - aujourd'hui
   - Si joursRestants == 7  → envoyerRappel7Jours()
   - Si joursRestants == 3  → envoyerRappel3Jours()
   - Si joursRestants <= 0  → expirerDevisDateDepassee()
3. Logger résultats (compteurs rappels/expirations)
```

**Complexité** : O(n) où n = nombre de devis 'envoye'  
**Coût estimé** : Gratuit (< 10k invocations/mois)

---

## 📧 Notifications Envoyées

### Rappel -7 jours (🔔 Information)

**Type** : `rappel_devis_7j`

**Titre** : `🔔 Rappel : Répondez au devis`

**Message** :
```
Début des travaux prévu le 15 février 2026 (dans 7 jours).

Vous devez répondre avant cette date :
→ Accepter et payer
→ Refuser (avec motif)
→ Proposer une nouvelle date de début
```

**Actions client** :
- Voir le devis : `/client/devis/[id]`
- Bouton "Accepter" → Signature + paiement
- Bouton "Refuser" → Modal motif
- Bouton "Proposer nouvelle date" (TODO)

---

### Rappel -3 jours (⚠️ Urgent)

**Type** : `rappel_devis_3j`  
**Priority** : `urgent`

**Titre** : `⚠️ URGENT : Devis expire dans 3 jours`

**Message** :
```
Début des travaux : 15 février 2026

Si vous ne répondez pas, le devis sera automatiquement annulé.
Répondez maintenant !
```

**Apparence UI** :
- Badge rouge "Urgent" sur la notification
- Placée en haut de la liste
- Son/vibration (si activé)

---

### Expiration automatique (❌ Finale)

**Type** : `devis_expire_date`

**Notification CLIENT** :
```
❌ Devis expiré - Date de début dépassée

Le devis n°DV-2026-00123 a été automatiquement annulé car 
la date de début des travaux (15/02/2026) est dépassée sans 
réponse de votre part.

Vous pouvez contacter l'artisan pour un nouveau devis.
```

**Notification ARTISAN** :
```
❌ Devis expiré - Client n'a pas répondu

Devis n°DV-2026-00123 : Le client n'a pas répondu avant la 
date de début prévue (15/02/2026). Le devis a été 
automatiquement annulé.
```

**Modifications Firestore** :
```typescript
{
  statut: 'expire',
  motifExpiration: 'date_debut_depassee',
  dateExpiration: Timestamp.now(),
  historiqueStatuts: [
    ...ancien,
    {
      statut: 'expire',
      date: Timestamp.now(),
      commentaire: 'Date de début dépassée (15/02/2026) sans réponse client'
    }
  ]
}
```

---

## 🧪 Tests

### Test Manuel

```bash
# Déployer la fonction
cd functions
npm run build
firebase deploy --only functions:rappellerDevisNonRepondus

# Forcer l'exécution (sans attendre 9h)
# Option 1: Console Firebase Functions
https://console.firebase.google.com/project/[PROJECT_ID]/functions

# Option 2: gcloud CLI
gcloud scheduler jobs run firebase-schedule-rappellerDevisNonRepondus-europe-west1

# Vérifier logs
firebase functions:log --only rappellerDevisNonRepondus
```

### Créer Devis de Test

```typescript
// Dans Firestore Console, créer devis test :
{
  statut: 'envoye',
  clientId: 'test-client-123',
  artisanId: 'test-artisan-456',
  numeroDevis: 'DV-2026-TEST',
  dateDebutPrevue: Timestamp (dans 3 jours), // Pour tester rappel -3j
  totaux: { totalTTC: 1500 },
  ...
}

// Attendre exécution Cloud Function à 9h
// Ou forcer avec gcloud scheduler
```

### Tests Automatisés (TODO)

```typescript
// functions/src/__tests__/rappellerDevisNonRepondus.test.ts

test('Rappel -7j envoyé si joursRestants = 7', async () => {
  const devis = createTestDevis({ 
    dateDebutPrevue: add(today, { days: 7 }) 
  });
  
  await rappellerDevisNonRepondus();
  
  const notifications = await getNotificationsByUser(devis.clientId);
  expect(notifications).toHaveLength(1);
  expect(notifications[0].type).toBe('rappel_devis_7j');
});
```

---

## 📊 Monitoring

### Métriques à surveiller

**Quotidiennes** :
- Nombre rappels -7j envoyés
- Nombre rappels -3j envoyés
- Nombre devis expirés

**Hebdomadaires** :
- Taux de réponse après rappel -7j
- Taux de réponse après rappel -3j
- Taux d'expiration sans réponse

**Logs Firebase Functions** :
```
✅ Rappels terminés :
   - 🔔 Rappels -7 jours : 12
   - ⚠️ Rappels -3 jours : 5
   - ❌ Devis expirés : 3
```

### Alertes à configurer

- ⚠️ Si > 50% des devis expirent sans réponse → Problème UX/notifications
- ⚠️ Si fonction échoue 3 fois de suite → Vérifier logs

---

## 🔧 Configuration

### Modifier les délais

**Fichier** : `functions/src/scheduledJobs/rappellerDevisNonRepondus.ts`

```typescript
// Actuellement : -7j, -3j, 0j
// Pour changer :

if (joursRestants === 14) {  // Rappel -14 jours
  await envoyerRappel14Jours(devisId, devis);
}
```

### Désactiver temporairement

```bash
# Pause Cloud Scheduler
gcloud scheduler jobs pause firebase-schedule-rappellerDevisNonRepondus-europe-west1

# Reprendre
gcloud scheduler jobs resume firebase-schedule-rappellerDevisNonRepondus-europe-west1
```

---

## 🚀 Déploiement

### Première fois

```bash
cd functions
npm install
npm run build
firebase deploy --only functions:rappellerDevisNonRepondus
```

**Output attendu** :
```
✔  functions[rappellerDevisNonRepondus(europe-west1)]: Successful create operation.
Function URL (rappellerDevisNonRepondus): https://...
```

### Vérifier Cloud Scheduler créé

```bash
# Console GCP → Cloud Scheduler
# Ou CLI :
gcloud scheduler jobs list

# Devrait afficher :
# NAME: firebase-schedule-rappellerDevisNonRepondus-europe-west1
# SCHEDULE: 0 9 * * *
# TIME_ZONE: Europe/Paris
# STATE: ENABLED
```

---

## 🐛 Troubleshooting

### Fonction ne s'exécute pas

1. Vérifier Cloud Scheduler actif :
   ```bash
   gcloud scheduler jobs describe firebase-schedule-rappellerDevisNonRepondus-europe-west1
   ```

2. Forcer exécution manuelle :
   ```bash
   gcloud scheduler jobs run firebase-schedule-rappellerDevisNonRepondus-europe-west1
   ```

3. Vérifier logs :
   ```bash
   firebase functions:log --only rappellerDevisNonRepondus
   ```

### Notifications non reçues

1. Vérifier collection `notifications` créée
2. Vérifier `recipientId` correct
3. Vérifier frontend écoute bien `useNotifications(userId)`

### Devis non expiré malgré date dépassée

1. Vérifier `dateDebutPrevue` bien définie (champ obligatoire)
2. Vérifier calcul `joursRestants` dans logs
3. Forcer exécution manuelle pour tester

---

## 📚 Fichiers Associés

**Cloud Function** :
- `functions/src/scheduledJobs/rappellerDevisNonRepondus.ts` (nouvelle)
- `functions/src/index.ts` (export ajouté)

**Types** :
- `frontend/src/types/devis.ts` (ajout champs `rappels`, `motifExpiration`, `dateExpiration`)

**Frontend** (TODO - affichage notifications) :
- `frontend/src/components/NotificationBadge.tsx` (déjà gère tous types)
- `frontend/src/app/client/devis/page.tsx` (badge "Urgent" si rappel -3j)

**Documentation** :
- `docs/SYSTEME_RAPPEL_DEVIS.md` (ce fichier)
- `.github/copilot-instructions.md` (à mettre à jour)

---

## ✅ Checklist Déploiement

- [x] Cloud Function créée
- [x] Intégrée dans `index.ts`
- [x] Types TypeScript mis à jour
- [x] Documentation complète
- [ ] Tests manuels effectués
- [ ] Déployée en production
- [ ] Cloud Scheduler vérifié actif
- [ ] Monitoring configuré (Alertes)

---

**Prochaine étape** : Tester en local puis déployer avec `firebase deploy --only functions:rappellerDevisNonRepondus` 🚀
