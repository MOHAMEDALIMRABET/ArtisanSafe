# ⚡ Guide Rapide - Signature + Paiement (Pour l'Équipe)

## 🎯 Ce Qui a Été Implémenté

### En Bref
✅ Client peut **signer** un devis  
✅ Après signature, **paiement obligatoire sous 24h**  
✅ Si pas payé → **Annulation automatique** (Cloud Function)  
✅ Après paiement → **Coordonnées démasquées** (email, tel, adresse)

---

## 🚀 Comment Tester (5 minutes)

### 1. En tant que Client

#### a. Accepter et Signer
1. Se connecter comme **client**
2. Aller sur un devis reçu (statut: 'envoye')
3. Cliquer **"✅ Accepter ce devis"**
4. Dessiner signature dans le canvas
5. Cliquer **"✅ Valider"**

**Résultat attendu** :
- Signature enregistrée ✅
- Modale paiement s'ouvre automatiquement ✅
- Compte à rebours "24h" affiché ✅

#### b. Payer
1. Remplir formulaire carte :
   - **Numéro** : 4242 4242 4242 4242 (test)
   - **Nom** : Jean Dupont
   - **Expiration** : 12/25
   - **CVV** : 123
2. Cliquer **"💳 Payer {montant}€"**
3. Attendre 2s (simulation)

**Résultat attendu** :
- Statut → 'paye' ✅
- Email artisan visible : `artisan@email.com` (au lieu de `a***@email.com`) ✅
- Téléphone visible : `06 12 34 56 89` (au lieu de `06 ** ** ** 89`) ✅
- Adresse visible : `32 rue Jean Jaurès, 75001 Paris` ✅
- Banner vert : "Devis payé - Référence: PAY-xxx" ✅

---

### 2. En tant qu'Artisan

#### a. Recevoir Notification Paiement
1. Se connecter comme **artisan**
2. Vérifier **badge notifications** (🔔 1)
3. Cliquer → Voir notification :
   - **Type** : devis_paye
   - **Message** : "Le client a payé le devis DV-2026-00123"

#### b. Voir Signature Client
1. Aller sur **"/artisan/devis/[id]"**
2. Voir banner vert : **"Devis accepté et signé électroniquement"**
3. Voir **image signature** du client
4. Voir **métadonnées** : Date/heure signature

---

### 3. Timeout 24h (Test Cloud Function)

**Pré-requis** : Cloud Function déployée (voir [`MIGRATION_CLOUD_FUNCTION.md`](./MIGRATION_CLOUD_FUNCTION.md))

#### a. Créer Devis Expiré
1. Firestore Console → Collection `devis`
2. Créer document avec :
   ```json
   {
     "statut": "en_attente_paiement",
     "dateLimitePaiement": "2026-01-31T10:00:00Z",  // HIER
     "artisanId": "votre-artisan-id",
     "clientId": "votre-client-id",
     "numeroDevis": "DV-TEST-00001"
   }
   ```

#### b. Forcer Exécution Cloud Function
```bash
gcloud scheduler jobs run firebase-schedule-annulerDevisNonPayes-us-central1
```

#### c. Vérifier Résultat
1. Firestore → Rafraîchir devis
   - `statut` → **'annule'** ✅
   - `motifAnnulation` → **"Paiement non effectué dans les 24h"** ✅
2. Notifications → Nouvelle notification artisan créée ✅
3. Logs :
   ```bash
   firebase functions:log --only annulerDevisNonPayes --limit 5
   ```
   **Attendu** : `"❌ Annulé: DV-TEST-00001"` ✅

---

## 📁 Fichiers Importants

### Pour Développer

| Fichier | Description |
|---------|-------------|
| `frontend/src/components/SignatureCanvas.tsx` | Canvas signature (282 lignes) |
| `frontend/src/components/PaymentForm.tsx` | Formulaire paiement (416 lignes) |
| `frontend/src/app/client/devis/[id]/page.tsx` | Page client (workflow complet) |
| `frontend/src/types/devis.ts` | Types TypeScript (nouveaux statuts) |
| `functions/src/scheduledJobs/annulerDevisNonPayes.ts` | Cloud Function annulation |

### Pour Déployer

| Document | Usage |
|----------|-------|
| [`MIGRATION_CLOUD_FUNCTION.md`](./MIGRATION_CLOUD_FUNCTION.md) | Déployer Cloud Function (5 min) |
| [`DEPLOY_CLOUD_FUNCTION.md`](./DEPLOY_CLOUD_FUNCTION.md) | Guide déploiement complet |

### Pour Comprendre

| Document | Contenu |
|----------|---------|
| [`WORKFLOW_SIGNATURE_PAIEMENT.md`](./WORKFLOW_SIGNATURE_PAIEMENT.md) | Workflow + diagrammes |
| [`RECAP_IMPLEMENTATION.md`](./RECAP_IMPLEMENTATION.md) | Récap complet (ce que vous lisez) |

---

## 🔍 Statuts Devis (Nouveaux)

| Statut | Signification | Coordonnées |
|--------|---------------|-------------|
| `envoye` | Devis envoyé au client | **Masquées** 🔒 |
| `en_attente_paiement` | Signé, attente paiement 24h | **Masquées** 🔒 |
| `paye` | Signé ET payé | **Démasquées** ✅ |
| `refuse` | Refusé par client | N/A |
| `annule` | Timeout 24h ou autre | N/A |

**Ancien statut `accepte`** : Déprécié, remplacé par `paye`

---

## 🎨 UI - Ce Que Voit l'Utilisateur

### Modale 1 : Signature
![Modale signature conceptuelle]
```
╔════════════════════════════════════════════╗
║  Signature Électronique                    ║
║                                            ║
║  Signez dans le cadre ci-dessous:          ║
║  ┌──────────────────────────────────────┐  ║
║  │                                      │  ║
║  │         [Zone canvas blanc]          │  ║
║  │                                      │  ║
║  └──────────────────────────────────────┘  ║
║                                            ║
║  [❌ Annuler] [🔄 Effacer] [✅ Valider]   ║
╚════════════════════════════════════════════╝
```

### Modale 2 : Paiement
![Modale paiement conceptuelle]
```
╔════════════════════════════════════════════╗
║  Paiement Sécurisé - 1 500,00€             ║
║                                            ║
║  ⏱️ Il vous reste 23h 45min                ║
║                                            ║
║  Numéro de carte                           ║
║  [4242 4242 4242 4242        ] 💳          ║
║                                            ║
║  Nom du titulaire                          ║
║  [Jean Dupont               ]              ║
║                                            ║
║  Date expiration          CVV              ║
║  [12/25        ]          [123  ]          ║
║                                            ║
║  🔒 Paiement 100% sécurisé                ║
║                                            ║
║  [❌ Annuler]        [💳 Payer 1 500€]    ║
╚════════════════════════════════════════════╝
```

### Banners
```
╔════════════════════════════════════════════╗
║ ℹ️ Coordonnées masquées                    ║
║ Visibles après signature et paiement       ║
╚════════════════════════════════════════════╝  (Orange - statut: envoye)

╔════════════════════════════════════════════╗
║ ⚠️ Paiement en attente                     ║
║ Reste 23h 45min avant annulation           ║
║ [Payer maintenant]                         ║
╚════════════════════════════════════════════╝  (Rouge - statut: en_attente_paiement)

╔════════════════════════════════════════════╗
║ ✅ Devis payé                              ║
║ Référence: PAY-abc123xyz456                ║
║ Coordonnées complètes visibles             ║
╚════════════════════════════════════════════╝  (Vert - statut: paye)
```

---

## 💬 FAQ Équipe

### Q1 : Que se passe-t-il si le client ferme la page après signature ?

**R** : Pas de problème ! Le statut est déjà `en_attente_paiement` dans Firestore. Quand le client revient :
1. Il voit le **banner rouge** "Paiement en attente"
2. Bouton **"Payer maintenant"** pour rouvrir modale paiement
3. Compte à rebours continue (ex: "Il vous reste 18h 30min")

### Q2 : Que se passe-t-il si le délai 24h expire exactement pendant le paiement ?

**R** : Séquence :
1. Client paie → Statut passe à `paye` immédiatement
2. Cloud Function (1h après) → Query `WHERE statut == 'en_attente_paiement'`
3. Ce devis **n'est plus renvoyé** (statut = `paye`)
4. → Pas d'annulation ✅

**Résultat** : Le paiement "gagne" (race condition favorable au client).

### Q3 : Peut-on modifier le délai 24h ?

**R** : Oui, modifier dans `page.tsx` :
```typescript
// Ligne ~220 (handleSignatureValidated)
const deadline = new Date(now + 24 * 60 * 60 * 1000);  // ← 24h

// Changer en :
const deadline = new Date(now + 48 * 60 * 60 * 1000);  // 48h
const deadline = new Date(now + 12 * 60 * 60 * 1000);  // 12h
```

**Aussi** modifier fréquence Cloud Function si besoin :
```typescript
// functions/src/scheduledJobs/annulerDevisNonPayes.ts
.schedule('every 1 hours')  // ← Actuel

// Options :
.schedule('every 30 minutes')  // Plus réactif
.schedule('every 2 hours')     // Moins fréquent
```

### Q4 : Comment voir les logs Cloud Function ?

**R** : 3 méthodes :

**Temps réel** :
```bash
firebase functions:log --only annulerDevisNonPayes --follow
```

**Dernières 20 lignes** :
```bash
firebase functions:log --only annulerDevisNonPayes --limit 20
```

**Dashboard Firebase** :
https://console.firebase.google.com/project/[PROJECT_ID]/functions/logs

### Q5 : Combien coûte la Cloud Function ?

**R** : **0€/mois** dans le plan gratuit (Spark).

**Détails** :
- Exécutions : 24/jour × 30 = **720/mois** (< 2M gratuits ✅)
- Reads Firestore : ~100/exécution = **2400/jour** (< 50k gratuits ✅)

Même avec **500 devis/jour**, reste **0€** (largement sous quotas).

### Q6 : Stripe est-il déjà intégré ?

**R** : **Non**, actuellement c'est une **simulation** (2s de faux traitement).

**Phase 2** (à venir) :
- Stripe Payment Intents
- Webhook Stripe
- Vraie transaction bancaire
- Remboursements possibles

**Pour l'instant** : Le workflow est **complet**, seul le paiement réel manque.

### Q7 : Les coordonnées sont-elles démasquées PARTOUT après paiement ?

**R** : **Oui**, car le démasquage est basé sur `devis.statut` :

```typescript
const shouldMask = devis.statut !== 'paye';
```

**Où c'est démasqué** :
- ✅ Page devis client (`/client/devis/[id]`)
- ✅ Liste devis client (`/client/devis`)
- ✅ Conversations messagerie (TODO: vérifier)

**Important** : L'artisan **voit toujours** les coordonnées complètes (pas de masking côté artisan).

### Q8 : Peut-on annuler manuellement un devis en attente ?

**R** : **Oui**, deux méthodes :

**Via Firestore Console** :
1. Aller sur document `devis/[id]`
2. Modifier `statut` → `'annule'`
3. Ajouter `motifAnnulation` → `"Annulé par admin"`

**Via Cloud Function HTTP** :
```bash
curl -X POST https://[REGION]-[PROJECT].cloudfunctions.net/annulerDevisNonPayesManual \
  -H "Content-Type: application/json" \
  -d '{"secret": "YOUR_SECRET_KEY"}'
```

(Annule **tous** les devis expirés, pas un seul)

---

## 🛠️ Dépannage Rapide

### Problème : Signature ne s'affiche pas

**Cause probable** : Firebase Storage URL manquante

**Solution** :
1. Vérifier Firestore : `devis.signatureClient.url` existe ?
2. Vérifier Firebase Storage : Fichier dans `signatures/` ?
3. Vérifier règles Storage : Lecture autorisée ?

### Problème : Paiement ne se valide pas

**Cause probable** : Validation formulaire échoue

**Solution** :
1. Ouvrir Console navigateur (F12)
2. Chercher erreurs JavaScript
3. Vérifier :
   - Numéro carte : 16 chiffres ✅
   - Expiration : MM/YY format + pas passée ✅
   - CVV : 3-4 chiffres ✅

### Problème : Cloud Function ne s'exécute pas

**Cause probable** : Pas déployée ou erreur config

**Solution** :
```bash
# Vérifier fonctions déployées
firebase functions:list

# Si vide → Déployer
cd functions && npm run deploy:annulation

# Vérifier Cloud Scheduler
gcloud scheduler jobs list

# Forcer exécution test
gcloud scheduler jobs run firebase-schedule-annulerDevisNonPayes-us-central1
```

### Problème : Coordonnées toujours masquées après paiement

**Cause probable** : Reload page pas fait

**Solution** :
1. Vérifier Firestore : `devis.statut === 'paye'` ?
2. Si oui → Hard refresh navigateur (Ctrl+Shift+R)
3. Si non → Vérifier `handlePaymentSuccess` s'est exécuté

---

## 📞 Support

**Documentation complète** :
- [`WORKFLOW_SIGNATURE_PAIEMENT.md`](./WORKFLOW_SIGNATURE_PAIEMENT.md)
- [`RECAP_IMPLEMENTATION.md`](./RECAP_IMPLEMENTATION.md)

**Déploiement** :
- [`MIGRATION_CLOUD_FUNCTION.md`](./MIGRATION_CLOUD_FUNCTION.md)

**Technique** :
- [`TODO_CLOUD_FUNCTION_ANNULATION_DEVIS.md`](./TODO_CLOUD_FUNCTION_ANNULATION_DEVIS.md)

**Contact** :
- Slack : #dev-artisandispo
- Email : dev@artisandispo.fr

---

**Créé le** : 2026-02-01  
**Pour** : Équipe Dev + Produit + Support  
**Statut** : ✅ Complet et prêt à utiliser
