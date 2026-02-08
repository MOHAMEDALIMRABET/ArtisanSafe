# 🔧 Guide d'Intégration Stripe Elements

> **Fichier à modifier** : `frontend/src/app/client/devis/[id]/page.tsx`  
> **Objectif** : Remplacer PaymentForm par StripePaymentForm  

---

## 📝 Modifications à effectuer

### 1. Imports (début du fichier)

**REMPLACER** :
```typescript
import { PaymentForm, PaymentData } from '@/components/PaymentForm';
```

**PAR** :
```typescript
import { StripePaymentForm } from '@/components/StripePaymentForm';
```

---

### 2. State management (après les autres useState)

**AJOUTER** :
```typescript
const [clientSecret, setClientSecret] = useState<string | null>(null);
const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
```

---

### 3. Fonction handleSignatureSuccess (modifier complètement)

**REMPLACER** la fonction existante par :

```typescript
const handleSignatureSuccess = async (signatureDataURL: string) => {
  try {
    setSignatureDataURL(signatureDataURL);
    
    // 1. Upload signature vers Firebase Storage
    const signatureRef = ref(storage, `signatures/${devis.id}_${Date.now()}.png`);
    await uploadString(signatureRef, signatureDataURL, 'data_url');
    const signatureUrl = await getDownloadURL(signatureRef);

    // 2. Récupérer IP client
    let ipAddress = 'unknown';
    try {
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      ipAddress = ipData.ip;
    } catch (err) {
      console.warn('Impossible de récupérer IP:', err);
    }

    // 3. Mettre à jour Firestore avec signature
    const dateLimite = new Date();
    dateLimite.setHours(dateLimite.getHours() + 24); // 24h pour payer

    await updateDoc(doc(db, 'devis', devis.id), {
      statut: 'en_attente_paiement',
      signatureClient: {
        url: signatureUrl,
        date: Timestamp.now(),
        ip: ipAddress
      },
      dateSignature: Timestamp.now(),
      dateLimitePaiement: Timestamp.fromDate(dateLimite)
    });

    // 4. ✅ NOUVEAU : Créer PaymentIntent escrow via backend
    console.log('📞 Création PaymentIntent escrow...');
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/payments/create-escrow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        devisId: devis.id,
        clientId: user!.uid,
        artisanId: devis.artisanId,
        montantTTC: devis.totaux?.totalTTC || 0,
        metadata: {
          numeroDevis: devis.numeroDevis,
          description: devis.titre || 'Devis ArtisanDispo'
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.details || 'Erreur création paiement');
    }

    const { clientSecret: cs, paymentIntentId: piId } = await response.json();

    console.log('✅ PaymentIntent créé:', piId);

    // 5. Sauvegarder paymentIntentId dans Firestore
    await updateDoc(doc(db, 'devis', devis.id), {
      'paiement.stripe.paymentIntentId': piId,
      'paiement.statut': 'en_attente'
    });

    // 6. Stocker dans state et afficher modal paiement
    setClientSecret(cs);
    setPaymentIntentId(piId);
    setShowSignatureModal(false);
    setShowPaymentModal(true);

  } catch (error: any) {
    console.error('❌ Erreur signature:', error);
    alert(`Erreur lors de la signature : ${error.message}`);
  }
};
```

---

### 4. Fonction handleStripePaymentSuccess (NOUVELLE)

**AJOUTER** après handleSignatureSuccess :

```typescript
const handleStripePaymentSuccess = async () => {
  try {
    console.log('✅ Paiement Stripe réussi');

    // 1. Mettre à jour statut devis
    await updateDoc(doc(db, 'devis', devis.id), {
      statut: 'paye',
      datePaiement: Timestamp.now(),
      'paiement.statut': 'bloque',
      'paiement.dateBlocage': Timestamp.now()
    });

    // 2. Créer contrat (via service)
    const { createContrat } = await import('@/lib/firebase/contrat-service');
    await createContrat({
      devisId: devis.id,
      clientId: user!.uid,
      artisanId: devis.artisanId,
      montantTotal: devis.totaux?.totalTTC || 0,
      paymentIntentId: paymentIntentId!
    });

    // 3. Notification artisan
    await notifyArtisanDevisAccepte(
      devis.artisanId,
      devis.numeroDevis,
      user!.uid,
      devis.id
    );

    // 4. Fermer modal et recharger
    setShowPaymentModal(false);
    
    alert('✅ Paiement réussi ! Le contrat a été créé et l\'artisan peut commencer les travaux.');
    
    router.refresh();
    await loadDevis(); // Recharger données

  } catch (error: any) {
    console.error('❌ Erreur post-paiement:', error);
    alert(`Erreur : ${error.message}`);
  }
};
```

---

### 5. Fonction handleStripePaymentError (NOUVELLE)

**AJOUTER** :

```typescript
const handleStripePaymentError = (errorMessage: string) => {
  console.error('❌ Erreur paiement Stripe:', errorMessage);
  alert(`Paiement échoué : ${errorMessage}\n\nVeuillez réessayer avec une autre carte.`);
  
  // Rester sur le modal pour permettre nouvel essai
};
```

---

### 6. Fonction handlePaymentCancel (modifier)

**REMPLACER** :
```typescript
const handlePaymentCancel = () => {
  setShowPaymentModal(false);
  // Client peut revenir signer à nouveau si nécessaire
};
```

**PAR** :
```typescript
const handlePaymentCancel = () => {
  setShowPaymentModal(false);
  setClientSecret(null);
  setPaymentIntentId(null);
  
  // Optionnel : Remettre devis en attente signature
  updateDoc(doc(db, 'devis', devis.id), {
    statut: 'envoye',
    'paiement.statut': 'annule'
  }).catch(console.error);
};
```

---

### 7. Modal Paiement (dans le JSX, section modals)

**REMPLACER** tout le bloc PaymentForm modal par :

```typescript
{/* Modal Paiement Stripe */}
{showPaymentModal && clientSecret && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[#2C3E50]">
            💳 Paiement sécurisé
          </h2>
          <button
            onClick={handlePaymentCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {/* Composant Stripe */}
        <StripePaymentForm
          devisId={devis.id}
          montantTTC={devis.totaux?.totalTTC || 0}
          numeroDevis={devis.numeroDevis}
          clientSecret={clientSecret}
          onSuccess={handleStripePaymentSuccess}
          onError={handleStripePaymentError}
          onCancel={handlePaymentCancel}
        />

        {/* Note sécurité escrow */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-700">
            🔒 <strong>Paiement sécurisé avec escrow</strong>
            <br />
            Votre argent sera bloqué en sécurité et versé à l'artisan uniquement 
            après validation des travaux. Vous êtes protégé à 100%.
          </p>
        </div>
      </div>
    </div>
  </div>
)}
```

---

### 8. SUPPRIMER (ne plus utiliser)

**Supprimer** ces fonctions devenues obsolètes :
- `handlePaymentSuccess(paymentData: PaymentData)`
- Tous les usages de `PaymentForm`

---

## 🧪 Test rapide

Après modifications :

1. **Vérifier compilation** :
   ```bash
   cd frontend
   npm run dev
   ```
   
   ✅ Pas d'erreur TypeScript

2. **Tester workflow** :
   - Client accepte devis
   - Modal signature → OK
   - Modal paiement Stripe → Carte test `4242 4242 4242 4242`
   - Paiement réussi → Contrat créé

3. **Vérifier console** :
   ```
   📞 Création PaymentIntent escrow...
   ✅ PaymentIntent créé: pi_...
   ✅ Paiement Stripe réussi
   ```

---

## 🔍 Debugging

### Erreur "Cannot find module StripePaymentForm"
**Solution** : Vérifier que `frontend/src/components/StripePaymentForm.tsx` existe

### Erreur "stripe is not defined"
**Solution** :
```bash
cd frontend
npm install @stripe/stripe-js @stripe/react-stripe-js
```

### Erreur "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is undefined"
**Solution** : Ajouter dans `frontend/.env.local` :
```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51...
```

### Modal paiement reste bloqué
**Cause** : Backend pas démarré ou erreur API
**Solution** : Vérifier `http://localhost:5000/api/v1/health`

---

**✅ Intégration complète !** Le système Stripe Elements est maintenant actif.
