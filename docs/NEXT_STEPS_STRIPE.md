# 🚀 Prochaine étape : Intégration Stripe Escrow

**Date**: 28 janvier 2025  
**Statut**: Étape 8/8 - Backend Stripe à implémenter  
**Priorité**: HAUTE 🔴

---

## 📋 Vue d'ensemble

Actuellement, le workflow Express est **complet côté frontend** (7/8 étapes). La dernière étape consiste à implémenter le **paiement sécurisé avec séquestre (escrow)** via Stripe.

**Concept escrow** :
- Client paie → Argent **bloqué** (pas encore reçu par l'artisan)
- Artisan intervient
- Client confirme fin travaux
- **Alors seulement** l'argent est libéré (capture Stripe)
- En cas de litige → Remboursement client possible

---

## 🎯 Objectifs

1. ✅ **Créer PaymentIntent Stripe** avec `capture_method: 'manual'`
2. ✅ **Gérer webhook Stripe** pour confirmation paiement
3. ✅ **Capture paiement** après intervention terminée
4. ✅ **Remboursement** en cas de litige
5. ✅ **Sécurité** : Vérifier signatures webhook

---

## 📁 Fichiers à créer

### **1. Backend API Stripe**

**Fichier** : `backend/src/routes/stripe-express.ts`

```typescript
import express from 'express';
import Stripe from 'stripe';
import { 
  getPropositionExpressById, 
  markDemandePaid 
} from '@/services/demande-express.service'; // À créer aussi
import { createPaiementExpress } from '@/services/paiement-express.service';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

// ====================================
// 1. Créer PaymentIntent (escrow)
// ====================================
router.post('/create-payment-intent', async (req, res) => {
  try {
    const { propositionId } = req.body;

    // Récupérer proposition
    const proposition = await getPropositionExpressById(propositionId);
    if (!proposition) {
      return res.status(404).json({ error: 'Proposition introuvable' });
    }

    // Vérifier statut
    if (proposition.statut !== 'acceptee') {
      return res.status(400).json({ error: 'Proposition non acceptée' });
    }

    // Créer PaymentIntent avec CAPTURE MANUELLE
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(proposition.montantPropose * 100), // Centimes
      currency: 'eur',
      capture_method: 'manual', // ← CRITIQUE pour escrow
      metadata: {
        propositionId: proposition.id,
        demandeId: proposition.demandeId,
        clientId: proposition.clientId,
        artisanId: proposition.artisanId,
      },
      description: `Travaux Express - ${proposition.description.substring(0, 50)}`,
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error('Erreur création PaymentIntent:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ====================================
// 2. Webhook Stripe (CRITIQUE)
// ====================================
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    // Vérifier signature
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error('Webhook signature invalide:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Gérer événements
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const { demandeId, propositionId, clientId, artisanId } = paymentIntent.metadata;

      console.log(`✅ Paiement réussi: ${paymentIntent.id}`);

      // Créer document paiement_express
      const commission = Math.round(paymentIntent.amount * 0.1); // 10%
      const montantArtisan = paymentIntent.amount - commission;

      await createPaiementExpress({
        demandeId,
        propositionId,
        clientId,
        artisanId,
        stripePaymentIntentId: paymentIntent.id,
        montant: paymentIntent.amount / 100,
        commission: commission / 100,
        montantArtisan: montantArtisan / 100,
        statut: 'paye',
      });

      // Mettre à jour demande
      await markDemandePaid(demandeId);

      break;

    case 'charge.refunded':
      const charge = event.data.object as Stripe.Charge;
      console.log(`💸 Remboursement: ${charge.id}`);
      // TODO: Mettre à jour paiement_express.statut = 'rembourse'
      break;

    default:
      console.log(`Événement non géré: ${event.type}`);
  }

  res.json({ received: true });
});

// ====================================
// 3. Capture paiement (libérer escrow)
// ====================================
router.post('/capture-payment', async (req, res) => {
  try {
    const { demandeId } = req.body;

    // Récupérer paiement
    const paiement = await getPaiementByDemandeId(demandeId);
    if (!paiement) {
      return res.status(404).json({ error: 'Paiement introuvable' });
    }

    if (paiement.statut !== 'paye') {
      return res.status(400).json({ error: 'Paiement déjà capturé ou remboursé' });
    }

    // Capturer PaymentIntent
    const paymentIntent = await stripe.paymentIntents.capture(
      paiement.stripePaymentIntentId,
      {
        amount_to_capture: Math.round(paiement.montantArtisan * 100), // 90%
      }
    );

    // Mettre à jour statut
    await updatePaiementStatut(paiement.id, 'libere', {
      releasedAt: new Date(),
      stripeChargeId: paymentIntent.latest_charge as string,
    });

    console.log(`💰 Paiement libéré: ${paiement.montantArtisan}€ → Artisan`);

    res.json({ success: true, chargeId: paymentIntent.latest_charge });
  } catch (error) {
    console.error('Erreur capture:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ====================================
// 4. Remboursement (litige)
// ====================================
router.post('/refund-payment', async (req, res) => {
  try {
    const { demandeId, reason } = req.body;

    const paiement = await getPaiementByDemandeId(demandeId);
    if (!paiement) {
      return res.status(404).json({ error: 'Paiement introuvable' });
    }

    if (paiement.statut === 'libere') {
      return res.status(400).json({ 
        error: 'Paiement déjà libéré, remboursement impossible' 
      });
    }

    // Créer refund Stripe
    const refund = await stripe.refunds.create({
      payment_intent: paiement.stripePaymentIntentId,
      reason: 'requested_by_customer',
      metadata: { reason },
    });

    // Mettre à jour statut
    await updatePaiementStatut(paiement.id, 'rembourse', {
      refundedAt: new Date(),
    });

    console.log(`💸 Remboursement: ${paiement.montant}€ → Client`);

    res.json({ success: true, refundId: refund.id });
  } catch (error) {
    console.error('Erreur remboursement:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
```

---

### **2. Services Backend Firestore**

**Fichier** : `backend/src/services/demande-express.service.ts`

```typescript
import { db } from '@/config/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export async function getPropositionExpressById(id: string) {
  const doc = await db.collection('propositions_express').doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

export async function markDemandePaid(demandeId: string) {
  await db.collection('demandes_express').doc(demandeId).update({
    statut: 'payee',
    updatedAt: Timestamp.now(),
  });
  console.log(`✅ Demande ${demandeId} marquée comme payée`);
}
```

**Fichier** : `backend/src/services/paiement-express.service.ts`

```typescript
import { db } from '@/config/firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

interface CreatePaiementExpressData {
  demandeId: string;
  propositionId: string;
  clientId: string;
  artisanId: string;
  stripePaymentIntentId: string;
  montant: number;
  commission: number;
  montantArtisan: number;
  statut: 'paye';
}

export async function createPaiementExpress(data: CreatePaiementExpressData) {
  const docRef = await db.collection('paiements_express').add({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
    paidAt: FieldValue.serverTimestamp(),
  });
  console.log(`💳 Paiement créé: ${docRef.id}`);
  return docRef.id;
}

export async function getPaiementByDemandeId(demandeId: string) {
  const snapshot = await db.collection('paiements_express')
    .where('demandeId', '==', demandeId)
    .limit(1)
    .get();
  
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}

export async function updatePaiementStatut(
  paiementId: string, 
  statut: 'libere' | 'rembourse',
  additionalData?: any
) {
  await db.collection('paiements_express').doc(paiementId).update({
    statut,
    ...additionalData,
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.log(`✅ Paiement ${paiementId} → ${statut}`);
}
```

---

### **3. Enregistrer route dans server**

**Fichier** : `backend/src/server.ts`

```typescript
import stripeExpressRoutes from './routes/stripe-express';

// ... autres imports

app.use('/api/v1/stripe-express', stripeExpressRoutes);
```

---

### **4. Variables d'environnement**

**Fichier** : `backend/.env`

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...  # Clé API Stripe (test mode)
STRIPE_WEBHOOK_SECRET=whsec_...  # Secret webhook (obtenu après création)
```

**Comment obtenir** :
1. Créer compte Stripe : https://dashboard.stripe.com
2. Mode test → Développeurs → Clés API
3. Copier "Clé secrète" → `STRIPE_SECRET_KEY`
4. Webhooks → Créer endpoint → URL : `https://votre-backend/api/v1/stripe-express/webhook`
5. Événements à écouter : `payment_intent.succeeded`, `charge.refunded`
6. Copier "Secret de signature du webhook" → `STRIPE_WEBHOOK_SECRET`

---

## 🔧 Frontend : Intégration Stripe Elements

**Fichier** : `frontend/src/app/client/paiement-express/[id]/page.tsx`

**Remplacer section "TODO"** par :

```typescript
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// Dans component
const [clientSecret, setClientSecret] = useState<string | null>(null);

useEffect(() => {
  if (!proposition) return;
  
  // Créer PaymentIntent
  fetch(`${process.env.NEXT_PUBLIC_API_URL}/stripe-express/create-payment-intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ propositionId: proposition.id }),
  })
    .then(res => res.json())
    .then(data => setClientSecret(data.clientSecret));
}, [proposition]);

// JSX
{clientSecret && (
  <Elements stripe={stripePromise} options={{ clientSecret }}>
    <CheckoutForm propositionId={proposition.id} />
  </Elements>
)}

// Composant CheckoutForm
function CheckoutForm({ propositionId }: { propositionId: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/client/paiement-success?propositionId=${propositionId}`,
      },
    });

    if (error) {
      alert(error.message);
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <button disabled={!stripe || loading}>
        {loading ? 'Traitement...' : 'Payer maintenant'}
      </button>
    </form>
  );
}
```

**Variables d'environnement frontend** :

**Fichier** : `frontend/.env.local`

```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...  # Clé publique Stripe
```

---

## 📋 Checklist Implémentation

### **Phase 1 : Backend Stripe** ⏳

- [ ] Créer compte Stripe (mode test)
- [ ] Installer dépendance : `npm install stripe` (backend)
- [ ] Créer `backend/src/routes/stripe-express.ts`
- [ ] Créer `backend/src/services/demande-express.service.ts`
- [ ] Créer `backend/src/services/paiement-express.service.ts`
- [ ] Ajouter route dans `backend/src/server.ts`
- [ ] Ajouter variables d'environnement `.env`
- [ ] Tester endpoint `/create-payment-intent` (Postman)

### **Phase 2 : Webhook Stripe** ⏳

- [ ] Créer webhook dans Stripe Dashboard
- [ ] URL: `https://votre-backend/api/v1/stripe-express/webhook`
- [ ] Événements: `payment_intent.succeeded`, `charge.refunded`
- [ ] Copier secret webhook → `.env`
- [ ] Tester avec Stripe CLI : `stripe listen --forward-to localhost:5000/api/v1/stripe-express/webhook`
- [ ] Vérifier création document `paiements_express`
- [ ] Vérifier update `demandes_express.statut = 'payee'`

### **Phase 3 : Frontend Elements** ⏳

- [ ] Installer dépendances : `npm install @stripe/stripe-js @stripe/react-stripe-js`
- [ ] Ajouter `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` dans `.env.local`
- [ ] Modifier `paiement-express/[id]/page.tsx`
- [ ] Créer composant `CheckoutForm`
- [ ] Créer page success : `/client/paiement-success/page.tsx`
- [ ] Tester paiement complet avec carte test : `4242 4242 4242 4242`

### **Phase 4 : Capture & Remboursement** ⏳

- [ ] Implémenter Cloud Function : `onInterventionTerminee()`
  - Écoute `demandes_express` → statut='terminee'
  - Appelle `/stripe-express/capture-payment`
- [ ] Créer page admin litiges : `/admin/litiges-express`
- [ ] Bouton "Rembourser client" → Appelle `/refund-payment`
- [ ] Tester capture manuelle (Postman)
- [ ] Tester remboursement (Postman)

### **Phase 5 : Sécurité** ⏳

- [ ] Ajouter authentification JWT sur endpoints
- [ ] Vérifier autorisation (userId === paiement.clientId)
- [ ] Firestore rules `paiements_express` (read-only pour users)
- [ ] Rate limiting sur endpoints paiement
- [ ] Logs détaillés (montant, userId, timestamp)

---

## 🧪 Tests recommandés

### **Test 1 : Paiement réussi E2E**

1. Client accepte proposition
2. Redirection page paiement
3. Stripe Elements affiche formulaire carte
4. Entrer carte test : `4242 4242 4242 4242`, expiration future, CVC 123
5. Cliquer "Payer"
6. **Vérifier** :
   - Webhook reçu (`payment_intent.succeeded`)
   - Document `paiements_express` créé
   - `demandes_express.statut = 'payee'`
   - Notification artisan envoyée

### **Test 2 : Capture paiement**

1. Artisan marque intervention terminée
2. Cloud Function déclenche capture
3. Appel API `/capture-payment`
4. **Vérifier** :
   - Stripe PaymentIntent capturé
   - `paiements_express.statut = 'libere'`
   - `releasedAt` renseigné
   - Artisan voit montant dans Stripe Dashboard

### **Test 3 : Remboursement**

1. Client signale litige avant intervention
2. Admin → Page litiges
3. Cliquer "Rembourser"
4. **Vérifier** :
   - Stripe refund créé
   - `paiements_express.statut = 'rembourse'`
   - Client reçoit email Stripe (remboursement)

### **Test 4 : Webhook signature invalide**

1. Simuler requête webhook sans signature
2. **Attendu** : Erreur 400 "Webhook signature invalide"
3. **Vérifier** : Pas de création paiement

### **Test 5 : Cartes déclinées**

- Carte insuffisante : `4000 0000 0000 9995`
- Carte expirée : `4000 0000 0000 0069`
- **Attendu** : Erreur frontend, pas de webhook, pas de paiement créé

---

## 📚 Ressources Stripe

**Documentation** :
- [PaymentIntents avec capture manuelle](https://stripe.com/docs/payments/capture-later)
- [Webhooks sécurisés](https://stripe.com/docs/webhooks/signatures)
- [Stripe Elements React](https://stripe.com/docs/stripe-js/react)
- [Testing cards](https://stripe.com/docs/testing#cards)

**Stripe CLI** (utile pour tests locaux) :
```bash
# Installer
npm install -g stripe

# Login
stripe login

# Écouter webhooks en local
stripe listen --forward-to localhost:5000/api/v1/stripe-express/webhook

# Déclencher événement test
stripe trigger payment_intent.succeeded
```

**Dashboard Stripe** :
- Paiements : https://dashboard.stripe.com/test/payments
- Webhooks : https://dashboard.stripe.com/test/webhooks
- Logs : https://dashboard.stripe.com/test/logs

---

## 🚨 Points d'attention

1. **⚠️ CRITIQUE : Mode Test vs Production**
   - Développement : Utiliser clés `sk_test_...` et `pk_test_...`
   - Production : Basculer vers `sk_live_...` et `pk_live_...`
   - Ne JAMAIS commiter clés dans Git

2. **⚠️ Webhook endpoint public**
   - Route `/webhook` doit être accessible publiquement
   - TOUJOURS vérifier signature Stripe
   - JAMAIS faire confiance au body sans vérification

3. **⚠️ Commission 10%**
   - Hardcodée actuellement
   - Envisager variable config si besoin changement

4. **⚠️ Capture automatique**
   - Nécessite Cloud Function ou cron job
   - Alternative : Capture manuelle par admin

5. **⚠️ Délai capture Stripe**
   - PaymentIntent non capturé expire après 7 jours
   - Si intervention > 7 jours : Utiliser Stripe Checkout Session

---

## 🎯 Résultat attendu

Après implémentation complète :

```
Frontend                    Backend                      Stripe
──────────                  ────────                     ──────

1. Client paie
   └─> Elements              └─> PaymentIntent créé       └─> Argent bloqué
                                 (capture_method='manual')

2. Webhook reçu                                          └─> payment_intent.succeeded
   └─> createPaiementExpress()
   └─> markDemandePaid()
   └─> Notification artisan

3. Artisan intervient
   └─> "Terminée"            └─> Cloud Function déclenche
                                 └─> capture-payment
                                                          └─> Argent libéré (90%)

4. Client satisfait
   └─> Laisser avis          └─> paiements_express.statut='libere'
```

**Ou en cas de litige** :

```
Admin → Refund button        └─> refund-payment
                                                          └─> Argent remboursé (100%)
                             └─> paiements_express.statut='rembourse'
```

---

## ✅ Validation finale

- [ ] Paiement test réussi (carte 4242)
- [ ] Webhook signature validée
- [ ] Document paiement créé en Firestore
- [ ] Capture manuelle testée
- [ ] Remboursement testé
- [ ] Montant artisan correct (90%)
- [ ] Commission plateforme correcte (10%)
- [ ] Notifications client/artisan fonctionnelles
- [ ] Stripe Dashboard affiche transactions
- [ ] Logs backend détaillés

---

**🚀 Une fois cette étape terminée, le système Travaux Express sera 100% opérationnel !**
