# Workflow Complet : Signature + Paiement + Annulation Automatique

## 📋 Vue d'ensemble

Ce document décrit le **workflow complet** d'acceptation d'un devis avec signature électronique, paiement obligatoire et annulation automatique après 24h.

---

## 🔄 Diagramme Workflow

```
┌──────────────────────────────────────────────────────────────────┐
│ ÉTAPE 1 : CLIENT SIGNE LE DEVIS                                  │
│                                                                   │
│ Client clique "✅ Accepter ce devis"                             │
│ → Modale signature s'ouvre (SignatureCanvas)                     │
│ → Client dessine signature (souris ou tactile)                   │
│ → Client clique "✅ Valider"                                     │
│                                                                   │
│ Actions automatiques:                                            │
│   1. Upload signature → Firebase Storage                         │
│   2. Calcul dateLimitePaiement = now + 24h                       │
│   3. Update Firestore:                                           │
│      - statut: 'en_attente_paiement'                             │
│      - signatureClient: { url, date, ip }                        │
│      - dateLimitePaiement: Timestamp                             │
│   4. Ferme modale signature                                      │
│   5. Ouvre modale paiement (PaymentForm)                         │
└────────────────┬──────────────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────────────┐
│ ÉTAPE 2 : CLIENT PAIE DANS LES 24H                               │
│                                                                   │
│ Modale PaymentForm affichée:                                     │
│ - Formulaire carte bancaire (numéro, nom, expiration, CVV)       │
│ - Compte à rebours: "Il vous reste 23h 45min"                   │
│ - ⚠️ Alerte rouge si < 2h restantes                             │
│                                                                   │
│ SCÉNARIO A - Client paie ✅                                      │
│   1. Validation formulaire (Luhn, expiration, CVV)               │
│   2. Simulation paiement (2s) [TODO: Stripe Phase 2]            │
│   3. Update Firestore:                                           │
│      - statut: 'paye'                                            │
│      - paiement: { montant, date, methode, reference, statut }   │
│      - datePaiement: Timestamp                                   │
│   4. Notification artisan (type: 'devis_paye')                   │
│   5. Recharge page → Données démasquées ✅                       │
│                                                                   │
│ SCÉNARIO B - Client ne paie pas ❌                               │
│   → Passe à l'ÉTAPE 3 (24h écoulées)                            │
└────────────────┬──────────────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────────────┐
│ ÉTAPE 3 : ANNULATION AUTOMATIQUE (SI NON PAYÉ)                   │
│                                                                   │
│ Cloud Function "annulerDevisNonPayes" (toutes les heures):       │
│                                                                   │
│ Query Firestore:                                                 │
│   WHERE statut == 'en_attente_paiement'                         │
│   WHERE dateLimitePaiement < now                                 │
│                                                                   │
│ Si résultats trouvés:                                            │
│   1. Batch update devis:                                         │
│      - statut: 'annule'                                          │
│      - dateAnnulation: Timestamp                                 │
│      - motifAnnulation: "Paiement non effectué dans les 24h"    │
│   2. Créer notification artisan:                                 │
│      - type: 'devis_annule_non_paye'                            │
│      - message: "Client n'a pas payé dans les 24h"              │
│      - relatedId: devisId                                        │
│   3. Log: "❌ Annulé: DV-2026-00123"                            │
│                                                                   │
│ → Artisan traite comme refus de devis classique                 │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📊 Transitions de Statut

```
envoye
  │
  │ Client clique "Accepter"
  │ → Signature validée
  ▼
en_attente_paiement (dateLimitePaiement = now + 24h)
  │
  ├─────── Client paie ────────► paye ✅ (coordonnées démasquées)
  │
  └─────── Timeout 24h ────────► annule ❌ (Cloud Function hourly)
```

---

## 🔒 Masking / Unmasking Coordonnées

### Avant Paiement (`statut !== 'paye'`)

**Email** : `john@gmail.com` → `j***@gmail.com`

**Téléphone** : `06 12 34 56 89` → `06 ** ** ** 89`

**Adresse** : `32 rue Jean Jaurès, 75001 Paris` → `32 rue *********, 75001 Paris`

### Après Paiement (`statut === 'paye'`)

**Email** : `john@gmail.com` ✅

**Téléphone** : `06 12 34 56 89` ✅

**Adresse** : `32 rue Jean Jaurès, 75001 Paris` ✅

### Implémentation

```typescript
// Dans page devis client
const shouldMask = devis.statut !== 'paye';

// Appels avec masking conditionnel
masquerEmail(artisan.email, shouldMask)
masquerTelephoneComplet(artisan.telephone, shouldMask)
masquerAdresse(artisan.location.address, shouldMask)
```

---

## 🎨 UI/UX - Banners Statut

### Banner Orange (statut: 'envoye')

```
ℹ️ Coordonnées masquées
Les coordonnées complètes de l'artisan seront visibles après 
signature et paiement du devis.
```

### Banner Rouge (statut: 'en_attente_paiement')

```
⚠️ Paiement en attente
Vous avez signé ce devis. Il vous reste 23h 45min pour effectuer 
le paiement avant annulation automatique.

[Payer maintenant] ← Bouton CTA
```

### Banner Vert (statut: 'paye')

```
✅ Devis payé
Paiement confirmé - Référence: PAY-abc123xyz456
Les coordonnées complètes de l'artisan sont désormais visibles.
```

---

## 🛠️ Composants Créés

### 1. SignatureCanvas.tsx

**Props** :
- `onSave: (dataURL: string) => void`
- `onCancel: () => void`

**Features** :
- Canvas 700x300px
- Souris + tactile
- Effacer + Valider
- Conversion PNG base64

**Fichier** : `frontend/src/components/SignatureCanvas.tsx`

### 2. PaymentForm.tsx

**Props** :
- `montant: number`
- `devisId: string`
- `dateLimitePaiement: Timestamp`
- `onSuccess: (paymentData) => void`
- `onCancel: () => void`

**Features** :
- Formulaire carte (numéro, nom, expiration, CVV)
- Auto-formatage (XXXX XXXX XXXX XXXX)
- Validation (Luhn, expiration, CVV)
- Compte à rebours 24h
- ⚠️ Alerte si < 2h
- Simulation paiement 2s

**Fichier** : `frontend/src/components/PaymentForm.tsx`

---

## 🔥 Cloud Function

### annulerDevisNonPayes

**Type** : Scheduled (PubSub)

**Fréquence** : Toutes les heures

**Trigger** : Cloud Scheduler (`every 1 hours`)

**Code** :
```typescript
export const annulerDevisNonPayes = functions.pubsub
  .schedule('every 1 hours')
  .timeZone('Europe/Paris')
  .onRun(async () => {
    const db = admin.firestore();
    const now = Timestamp.now();

    const snapshot = await db
      .collection('devis')
      .where('statut', '==', 'en_attente_paiement')
      .where('dateLimitePaiement', '<', now)
      .get();

    // Annulation batch + notifications
    // ...
  });
```

**Fichier** : `functions/src/scheduledJobs/annulerDevisNonPayes.ts`

**Déploiement** :
```bash
cd functions
npm install
npm run build
firebase deploy --only functions:annulerDevisNonPayes
```

**Coûts** : 0€/mois (dans quotas gratuits)

**Logs** :
```bash
firebase functions:log --only annulerDevisNonPayes --follow
```

---

## 📝 Types Firestore

### Devis (Mis à jour)

```typescript
export type DevisStatut = 
  | 'brouillon'
  | 'envoye'
  | 'en_attente_paiement'  // ← Nouveau
  | 'paye'                 // ← Nouveau (remplace 'accepte')
  | 'refuse'
  | 'annule';              // ← Nouveau

export interface Devis {
  // ... champs existants
  statut: DevisStatut;
  
  // Signature
  signatureClient?: {
    url: string;
    date: Timestamp;
    ip?: string;
  };
  
  // Paiement
  dateLimitePaiement?: Timestamp;  // ← Nouveau (now + 24h)
  datePaiement?: Timestamp;        // ← Nouveau
  paiement?: {                     // ← Nouveau
    montant: number;
    date: Timestamp;
    methode: 'carte_bancaire';
    referenceTransaction: string;
    statut: 'confirme' | 'en_attente' | 'echoue';
  };
  
  // Annulation
  dateAnnulation?: Timestamp;      // ← Nouveau
  motifAnnulation?: string;        // ← Nouveau
}
```

---

## ⏱️ Timeline Exemple

### Exemple Scénario Complet

```
Lundi 10:00 → Client signe devis
              - statut: 'en_attente_paiement'
              - dateLimitePaiement: Mardi 10:00

Lundi 12:00 → Client paie
              - statut: 'paye'
              - paiement: { ... }
              - Notification artisan envoyée
              - Données démasquées ✅

Lundi 14:00 → Cloud Function check
              - Devis statut='paye' → Ignoré ✅
```

### Exemple Scénario Timeout

```
Lundi 10:00 → Client signe devis
              - statut: 'en_attente_paiement'
              - dateLimitePaiement: Mardi 10:00

Lundi 23:00 → Client voit "Il vous reste 11h"
              - Banner rouge avec alerte

Mardi 08:00 → Client voit "Il vous reste 2h"
              - ⚠️ Alerte rouge critique

Mardi 11:00 → Cloud Function check
              - dateLimitePaiement (10:00) < now (11:00) ✅
              - statut='en_attente_paiement' ✅
              - → ANNULATION AUTOMATIQUE
              - statut: 'annule'
              - Notification artisan (type refus)
```

---

## 🧪 Tests Recommandés

### Test 1 : Signature + Paiement Réussi

```
1. Créer devis test (statut: 'envoye')
2. Client signe → Vérifier:
   - Signature uploadée Firebase Storage ✅
   - statut → 'en_attente_paiement' ✅
   - dateLimitePaiement = now + 24h ✅
3. Client paie → Vérifier:
   - statut → 'paye' ✅
   - paiement object créé ✅
   - Notification artisan envoyée ✅
   - Données démasquées affichées ✅
```

### Test 2 : Timeout Paiement

```
1. Créer devis test avec dateLimitePaiement passée
   {
     statut: 'en_attente_paiement',
     dateLimitePaiement: Timestamp(-2h),  // Dans le passé
     ...
   }
2. Forcer exécution Cloud Function:
   gcloud scheduler jobs run annulerDevisNonPayes
3. Vérifier:
   - statut → 'annule' ✅
   - motifAnnulation enregistré ✅
   - Notification artisan créée ✅
```

### Test 3 : Compte à Rebours UI

```
1. Créer devis avec dateLimitePaiement = now + 2h
2. Vérifier affichage:
   - "Il vous reste 1h 59min" ✅
   - ⚠️ Alerte rouge si < 2h ✅
3. Attendre 1 minute → Vérifier countdown décrémente
```

---

## 📦 Fichiers Modifiés/Créés

### Créés

✅ `frontend/src/components/PaymentForm.tsx` (416 lignes)  
✅ `functions/src/scheduledJobs/annulerDevisNonPayes.ts` (170 lignes)  
✅ `functions/src/index.ts` (exportation functions)  
✅ `functions/package.json` (configuration npm)  
✅ `functions/tsconfig.json` (configuration TypeScript)  
✅ `functions/.gitignore` (exclusions)  
✅ `functions/README.md` (documentation)  
✅ `docs/TODO_CLOUD_FUNCTION_ANNULATION_DEVIS.md`  
✅ `docs/DEPLOY_CLOUD_FUNCTION.md`  
✅ `docs/WORKFLOW_SIGNATURE_PAIEMENT.md` (ce fichier)

### Modifiés

✅ `frontend/src/types/devis.ts` (nouveaux statuts + paiement)  
✅ `frontend/src/app/client/devis/[id]/page.tsx` (paiement + masking)  
✅ `docs/SIGNATURE_ELECTRONIQUE.md` (section paiement + Cloud Function)

---

## 🚀 Déploiement Production

### Checklist Avant Déploiement

- [ ] **Tests locaux** : Signature + Paiement + Masking ✅
- [ ] **Cloud Function** : Build + Deploy ✅
- [ ] **Firebase Storage Rules** : Déployer `storage.rules` ✅
- [ ] **Documentation** : Mise à jour complète ✅
- [ ] **Monitoring** : Configurer alertes Cloud Function ✅

### Commandes Déploiement

```bash
# 1. Frontend
cd frontend
npm run build
firebase deploy --only hosting

# 2. Cloud Functions
cd ../functions
npm install
npm run build
firebase deploy --only functions:annulerDevisNonPayes

# 3. Storage Rules
firebase deploy --only storage

# 4. Vérification
firebase functions:log --only annulerDevisNonPayes --limit 10
```

---

## 💡 Évolutions Futures (Phase 2)

### Stripe Integration

- Remplacer simulation paiement par Stripe Payment Intents
- Webhook Stripe pour confirmer paiement
- Stripe Elements pour PCI compliance
- Gestion remboursements

### Amélirations UX

- Email rappel à H-2 (client n'a pas payé)
- SMS rappel à H-1
- Possibilité de prolonger délai (admin only)
- Historique paiements dans profil client

### Analytics

- Dashboard admin : Taux conversion signature → paiement
- Temps moyen avant paiement
- Taux annulation 24h
- Montant total traité

---

**Créé le** : 2026-02-01  
**Responsable** : Équipe Produit + Dev  
**Statut** : ✅ Implémenté et documenté  
**Version** : 1.0.0
