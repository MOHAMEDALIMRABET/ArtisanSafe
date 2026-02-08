# 🚀 Guide Implémentation : Gestion des Travaux dans Pages Devis

**Date** : 2026-02-03  
**Objectif** : Ajouter la gestion des travaux (début/fin, validation, litige) dans les pages `/artisan/devis/[id]` et `/client/devis/[id]` existantes

---

## ✅ Fonctions Déjà Disponibles

Les fonctions backend sont **déjà implémentées** dans `frontend/src/lib/firebase/devis-service.ts` :

| Fonction | Acteur | Transition Statut | Ligne |
|----------|--------|-------------------|-------|
| `declarerDebutTravaux(devisId, artisanId)` | Artisan | `paye` → `en_cours` | 637 |
| `declarerFinTravaux(devisId, artisanId)` | Artisan | `en_cours` → `travaux_termines` | 686 |
| `validerTravaux(devisId, clientId)` | Client | `travaux_termines` → `termine_valide` | 737 |
| `signalerLitige(devisId, clientId, motif)` | Client | `travaux_termines` → `litige` | 790 |
| `validerAutomatiquementTravaux(devisId)` | Cloud Function | `travaux_termines` → `termine_auto_valide` | 848 |

**Notifications automatiques** : Chaque fonction envoie déjà une notification à la partie concernée.

---

## 📋 Modifications à Apporter

### 1. Page Artisan `/artisan/devis/[id]/page.tsx`

**Fichier** : `frontend/src/app/artisan/devis/[id]/page.tsx` (722 lignes actuellement)

**Position** : Après la section d'affichage du devis, avant le bouton "Retour"

#### A. Ajouter les imports nécessaires

```typescript
import { 
  declarerDebutTravaux, 
  declarerFinTravaux 
} from '@/lib/firebase/devis-service';
import { createNotification } from '@/lib/firebase/notification-service';
```

#### B. Ajouter les états pour gérer les actions

```typescript
const [declarationEnCours, setDeclarationEnCours] = useState(false);
```

#### C. Ajouter les fonctions handlers

```typescript
async function handleDeclarerDebut() {
  if (!devis || !user) return;
  
  if (!confirm('Confirmer le démarrage des travaux ?')) return;
  
  try {
    setDeclarationEnCours(true);
    await declarerDebutTravaux(devis.id, user.uid);
    
    await createNotification({
      recipientId: devis.clientId,
      type: 'travaux_demarres',
      title: '🚀 Travaux démarrés',
      message: `${devis.artisan.raisonSociale} a commencé les travaux.`,
      relatedId: devis.id
    });
    
    alert('✅ Début des travaux déclaré !');
    await loadDevis(); // Recharger le devis
  } catch (error: any) {
    console.error('Erreur:', error);
    alert(`❌ Erreur : ${error.message || 'Erreur inconnue'}`);
  } finally {
    setDeclarationEnCours(false);
  }
}

async function handleDeclarerFin() {
  if (!devis || !user) return;
  
  if (!confirm('Confirmer la fin des travaux ? Le client aura 7 jours pour valider.')) return;
  
  try {
    setDeclarationEnCours(true);
    await declarerFinTravaux(devis.id, user.uid);
    
    await createNotification({
      recipientId: devis.clientId,
      type: 'travaux_termines',
      title: '✅ Travaux terminés',
      message: `${devis.artisan.raisonSociale} a déclaré avoir terminé. Vous avez 7 jours pour valider.`,
      relatedId: devis.id
    });
    
    alert('✅ Fin des travaux déclarée ! En attente de validation client.');
    await loadDevis(); // Recharger le devis
  } catch (error: any) {
    console.error('Erreur:', error);
    alert(`❌ Erreur : ${error.message || 'Erreur inconnue'}`);
  } finally {
    setDeclarationEnCours(false);
  }
}
```

#### D. Ajouter la section UI conditionnelle (APRÈS l'affichage du devis, AVANT le bouton "Retour")

**Position approximative** : Ligne 650-660 (avant le bouton "Retour à mes devis")

```tsx
{/* ========================================= */}
{/* SECTION GESTION TRAVAUX (selon statut)   */}
{/* ========================================= */}

{/* Statut: paye - Prêt à démarrer */}
{devis.statut === 'paye' && (
  <div className="bg-green-50 border-2 border-green-500 rounded-lg p-6 mb-6 no-print">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
        <span className="text-2xl">✅</span>
      </div>
      <div>
        <h3 className="text-lg font-bold text-green-800">Devis payé - Prêt à démarrer</h3>
        <p className="text-sm text-green-700">Le client a signé et payé. Vous pouvez démarrer les travaux.</p>
      </div>
    </div>
    
    <button
      onClick={handleDeclarerDebut}
      disabled={declarationEnCours}
      className="bg-[#FF6B00] hover:bg-[#E56100] text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {declarationEnCours ? 'Enregistrement...' : '🚀 Déclarer le début des travaux'}
    </button>
    
    <p className="text-xs text-gray-600 mt-3">
      💡 Une fois démarrés, le client sera notifié et le suivi des travaux sera activé.
    </p>
  </div>
)}

{/* Statut: en_cours - Travaux en cours */}
{devis.statut === 'en_cours' && (
  <div className="bg-blue-50 border-2 border-blue-500 rounded-lg p-6 mb-6 no-print">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
        <span className="text-2xl">⚙️</span>
      </div>
      <div>
        <h3 className="text-lg font-bold text-blue-800">Travaux en cours</h3>
        <p className="text-sm text-blue-700">
          Démarré le : {devis.travaux?.dateDebut?.toDate().toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })}
        </p>
      </div>
    </div>
    
    <button
      onClick={handleDeclarerFin}
      disabled={declarationEnCours}
      className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {declarationEnCours ? 'Enregistrement...' : '✅ Déclarer la fin des travaux'}
    </button>
    
    <p className="text-xs text-gray-600 mt-3">
      💡 Le client aura 7 jours pour valider les travaux. Passé ce délai, validation automatique.
    </p>
  </div>
)}

{/* Statut: travaux_termines - En attente validation */}
{devis.statut === 'travaux_termines' && (
  <div className="bg-orange-50 border-2 border-orange-500 rounded-lg p-6 mb-6 no-print">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
        <span className="text-2xl">⏳</span>
      </div>
      <div>
        <h3 className="text-lg font-bold text-orange-800">En attente de validation client</h3>
        <p className="text-sm text-orange-700">
          Vous avez déclaré avoir terminé les travaux le {devis.travaux?.dateFin?.toDate().toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })}.
        </p>
      </div>
    </div>
    
    <div className="bg-white rounded-lg p-4 border border-orange-200">
      <h4 className="font-semibold text-gray-800 mb-2">⏱️ Délai de validation :</h4>
      <p className="text-sm text-gray-700">
        Le client a <strong>7 jours</strong> pour valider ou signaler un problème.
        <br />
        Validation automatique le : {devis.travaux?.dateValidationAuto?.toDate().toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
      </p>
      
      <div className="mt-3 p-3 bg-green-50 rounded border border-green-200">
        <p className="text-sm text-green-800">
          💰 <strong>Paiement</strong> : Vous recevrez <strong>{devis.paiement?.montantArtisan || ((devis.montantTTC || 0) * 0.92).toFixed(2)}€</strong> après validation
          <br />
          <span className="text-xs text-green-700">(Commission plateforme : {devis.paiement?.commission || ((devis.montantTTC || 0) * 0.08).toFixed(2)}€)</span>
        </p>
      </div>
    </div>
  </div>
)}

{/* Statut: termine_valide ou termine_auto_valide - Paiement libéré */}
{['termine_valide', 'termine_auto_valide'].includes(devis.statut) && (
  <div className="bg-emerald-50 border-2 border-emerald-500 rounded-lg p-6 mb-6 no-print">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
        <span className="text-2xl">🎉</span>
      </div>
      <div>
        <h3 className="text-lg font-bold text-emerald-800">
          {devis.statut === 'termine_valide' ? '✅ Travaux validés par le client' : '✅ Travaux validés automatiquement'}
        </h3>
        <p className="text-sm text-emerald-700">
          Validé le : {devis.travaux?.dateValidationClient?.toDate().toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })}
        </p>
      </div>
    </div>
    
    <div className="bg-white rounded-lg p-4 border border-emerald-200">
      <h4 className="font-semibold text-gray-800 mb-2">💰 Paiement en cours</h4>
      <p className="text-sm text-gray-700 mb-3">
        Montant net artisan : <strong className="text-emerald-700 text-lg">{devis.paiement?.montantArtisan || ((devis.montantTTC || 0) * 0.92).toFixed(2)}€</strong>
        <br />
        <span className="text-xs text-gray-600">(Commission plateforme : {devis.paiement?.commission || ((devis.montantTTC || 0) * 0.08).toFixed(2)}€)</span>
      </p>
      
      <div className="p-3 bg-blue-50 rounded border border-blue-200">
        <p className="text-sm text-blue-800">
          ℹ️ Vous recevrez le paiement sous <strong>24-48 heures</strong> par virement bancaire.
        </p>
      </div>
    </div>
  </div>
)}

{/* Statut: litige - Problème signalé */}
{devis.statut === 'litige' && (
  <div className="bg-red-50 border-2 border-red-500 rounded-lg p-6 mb-6 no-print">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
        <span className="text-2xl">⚠️</span>
      </div>
      <div>
        <h3 className="text-lg font-bold text-red-800">Litige en cours</h3>
        <p className="text-sm text-red-700">
          Le client a signalé un problème le {devis.travaux?.litige?.date?.toDate().toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })}
        </p>
      </div>
    </div>
    
    <div className="bg-white rounded-lg p-4 border border-red-200">
      <h4 className="font-semibold text-gray-800 mb-2">Motif du litige :</h4>
      <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded border border-gray-200">
        {devis.travaux?.litige?.motif || 'Non spécifié'}
      </p>
      
      <div className="mt-4 p-3 bg-yellow-50 rounded border border-yellow-200">
        <p className="text-sm text-yellow-800">
          ⏳ <strong>En attente de médiation</strong>
          <br />
          Un administrateur va examiner le litige et prendre contact avec vous sous 24-48h.
          <br />
          Le paiement reste bloqué jusqu'à résolution.
        </p>
      </div>
    </div>
  </div>
)}
```

---

### 2. Page Client `/client/devis/[id]/page.tsx`

**Fichier** : À vérifier si existe, sinon créer ou utiliser une autre page client

#### A. Ajouter les imports

```typescript
import { 
  validerTravaux, 
  signalerLitige 
} from '@/lib/firebase/devis-service';
import { createNotification } from '@/lib/firebase/notification-service';
```

#### B. Ajouter les états

```typescript
const [validationEnCours, setValidationEnCours] = useState(false);
const [showLitigeModal, setShowLitigeModal] = useState(false);
const [motifLitige, setMotifLitige] = useState('');
const [litigeEnCours, setLitigeEnCours] = useState(false);
```

#### C. Ajouter les fonctions handlers

```typescript
async function handleValiderTravaux() {
  if (!devis || !user) return;
  
  if (!confirm('Confirmer que les travaux sont conformes et terminés ?')) return;
  
  try {
    setValidationEnCours(true);
    
    // Valider les travaux
    await validerTravaux(devis.id, user.uid);
    
    // Notification artisan
    await createNotification({
      recipientId: devis.artisanId,
      type: 'travaux_valides',
      title: '✅ Travaux validés !',
      message: `${user.prenom} ${user.nom} a validé vos travaux. Paiement en cours de transfert.`,
      relatedId: devis.id
    });
    
    // TODO Phase 2: Appeler API backend pour capturer le paiement
    // const response = await fetch('/api/v1/payments/release-escrow', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ contratId: devis.id, validePar: 'client' })
    // });
    
    alert('✅ Travaux validés ! L\'artisan sera payé sous 24-48h.');
    await loadDevis();
  } catch (error: any) {
    console.error('Erreur validation:', error);
    alert(`❌ Erreur : ${error.message || 'Erreur inconnue'}`);
  } finally {
    setValidationEnCours(false);
  }
}

async function handleSignalerLitige() {
  if (!devis || !user || !motifLitige.trim()) {
    alert('Veuillez décrire le problème rencontré');
    return;
  }
  
  try {
    setLitigeEnCours(true);
    
    // Signaler le litige
    await signalerLitige(devis.id, user.uid, motifLitige);
    
    // Notification artisan + admin
    await createNotification({
      recipientId: devis.artisanId,
      type: 'litige_ouvert',
      title: '⚠️ Litige signalé',
      message: `${user.prenom} ${user.nom} a signalé un problème. Un médiateur va intervenir.`,
      relatedId: devis.id
    });
    
    alert('⚠️ Litige signalé. Notre équipe va vous contacter sous 24h.');
    setShowLitigeModal(false);
    setMotifLitige('');
    await loadDevis();
  } catch (error: any) {
    console.error('Erreur litige:', error);
    alert(`❌ Erreur : ${error.message || 'Erreur inconnue'}`);
  } finally {
    setLitigeEnCours(false);
  }
}
```

#### D. Ajouter les sections UI conditionnelles

```tsx
{/* SECTION SUIVI TRAVAUX */}

{/* Statut: paye - En attente démarrage */}
{devis.statut === 'paye' && (
  <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-6 mb-6">
    <div className="flex items-center gap-3 mb-4">
      <span className="text-3xl">⏳</span>
      <div>
        <h3 className="text-lg font-bold text-yellow-800">En attente du démarrage des travaux</h3>
        <p className="text-sm text-yellow-700">
          L'artisan doit déclarer le début des travaux. Vous serez notifié.
        </p>
      </div>
    </div>
  </div>
)}

{/* Statut: en_cours - Travaux en cours */}
{devis.statut === 'en_cours' && (
  <div className="bg-blue-50 border-2 border-blue-400 rounded-lg p-6 mb-6">
    <div className="flex items-center gap-3 mb-4">
      <span className="text-3xl">⚙️</span>
      <div>
        <h3 className="text-lg font-bold text-blue-800">Travaux en cours</h3>
        <p className="text-sm text-blue-700">
          Démarré le : {devis.travaux?.dateDebut?.toDate().toLocaleDateString('fr-FR')}
        </p>
      </div>
    </div>
  </div>
)}

{/* Statut: travaux_termines - VALIDATION REQUISE */}
{devis.statut === 'travaux_termines' && (
  <div className="bg-orange-50 border-2 border-orange-500 rounded-lg p-6 mb-6">
    <div className="flex items-center gap-3 mb-4">
      <span className="text-3xl">✅</span>
      <div>
        <h3 className="text-lg font-bold text-orange-800">Travaux terminés - Validation requise</h3>
        <p className="text-sm text-orange-700">
          L'artisan a déclaré avoir terminé les travaux le {devis.travaux?.dateFin?.toDate().toLocaleDateString('fr-FR')}.
        </p>
      </div>
    </div>
    
    <div className="bg-white rounded-lg p-4 border border-orange-300 mb-4">
      <p className="text-sm text-gray-700 mb-3">
        Vous avez <strong>7 jours</strong> pour valider les travaux ou signaler un problème.
        <br />
        Validation automatique le : <strong>{devis.travaux?.dateValidationAuto?.toDate().toLocaleDateString('fr-FR')}</strong>
      </p>
    </div>
    
    <div className="flex gap-3">
      <button
        onClick={handleValiderTravaux}
        disabled={validationEnCours}
        className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
      >
        {validationEnCours ? 'Validation...' : '✅ Valider les travaux'}
      </button>
      
      <button
        onClick={() => setShowLitigeModal(true)}
        className="flex-1 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold"
      >
        ⚠️ Signaler un problème
      </button>
    </div>
  </div>
)}

{/* Statut: termine_valide - Travaux validés */}
{['termine_valide', 'termine_auto_valide'].includes(devis.statut) && (
  <div className="bg-green-50 border-2 border-green-500 rounded-lg p-6 mb-6">
    <div className="flex items-center gap-3 mb-4">
      <span className="text-3xl">🎉</span>
      <div>
        <h3 className="text-lg font-bold text-green-800">Travaux validés</h3>
        <p className="text-sm text-green-700">
          {devis.statut === 'termine_valide' 
            ? `Validé par vous le ${devis.travaux?.dateValidationClient?.toDate().toLocaleDateString('fr-FR')}`
            : `Validé automatiquement le ${devis.travaux?.dateValidationClient?.toDate().toLocaleDateString('fr-FR')}`
          }
        </p>
      </div>
    </div>
    
    <div className="bg-white rounded-lg p-4 border border-green-200">
      <p className="text-sm text-gray-700">
        ✅ Le paiement a été transféré à l'artisan.
        <br />
        💰 Montant : <strong>{devis.montantTTC}€</strong>
      </p>
    </div>
  </div>
)}

{/* Modal Signaler Litige */}
{showLitigeModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-lg max-w-2xl w-full p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-800">⚠️ Signaler un problème</h3>
        <button
          onClick={() => setShowLitigeModal(false)}
          className="text-gray-500 hover:text-gray-700 text-2xl"
        >
          ×
        </button>
      </div>
      
      <p className="text-sm text-gray-600 mb-4">
        Décrivez précisément le problème rencontré. Notre équipe de médiation interviendra sous 24-48h.
      </p>
      
      <textarea
        placeholder="Exemple : Les joints de la salle de bain ne sont pas étanches, il y a des fuites..."
        value={motifLitige}
        onChange={(e) => setMotifLitige(e.target.value)}
        className="w-full border-2 border-gray-300 rounded-lg p-3 text-gray-800 mb-4 focus:border-[#FF6B00] focus:outline-none"
        rows={6}
      />
      
      <div className="flex gap-3">
        <button
          onClick={() => {
            setShowLitigeModal(false);
            setMotifLitige('');
          }}
          className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-3 rounded-lg font-semibold"
        >
          Annuler
        </button>
        
        <button
          onClick={handleSignalerLitige}
          disabled={litigeEnCours || !motifLitige.trim()}
          className="flex-1 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
        >
          {litigeEnCours ? 'Envoi...' : 'Envoyer le signalement'}
        </button>
      </div>
    </div>
  </div>
)}
```

---

## 📝 Checklist Implémentation

### Page Artisan
- [ ] Ajouter imports (`declarerDebutTravaux`, `declarerFinTravaux`)
- [ ] Ajouter état `declarationEnCours`
- [ ] Ajouter fonction `handleDeclarerDebut()`
- [ ] Ajouter fonction `handleDeclarerFin()`
- [ ] Insérer section UI conditionnelle (5 statuts : paye, en_cours, travaux_termines, termine_valide, litige)
- [ ] Tester parcours complet artisan

### Page Client
- [ ] Vérifier si page `/client/devis/[id]` existe
- [ ] Ajouter imports (`validerTravaux`, `signalerLitige`)
- [ ] Ajouter états (`validationEnCours`, `showLitigeModal`, `motifLitige`)
- [ ] Ajouter fonction `handleValiderTravaux()`
- [ ] Ajouter fonction `handleSignalerLitige()`
- [ ] Insérer section UI conditionnelle (4 statuts : paye, en_cours, travaux_termines, termine_valide)
- [ ] Ajouter modal litige
- [ ] Tester parcours complet client

### Tests Manuels
- [ ] Créer devis test → Signer → Payer (statut: paye)
- [ ] Artisan déclare début → Vérifier statut 'en_cours'
- [ ] Artisan déclare fin → Vérifier statut 'travaux_termines' + délai 7j
- [ ] Client valide → Vérifier statut 'termine_valide'
- [ ] Client signale litige → Vérifier statut 'litige' + motif enregistré
- [ ] Vérifier notifications envoyées à chaque étape

---

## 🚀 Ordre d'Implémentation Recommandé

1. ✅ **Commencer par la page artisan** (plus simple, 2 boutons)
2. ✅ **Tester le workflow complet artisan** (paye → en_cours → travaux_termines)
3. ✅ **Implémenter la page client** (validation + litige)
4. ✅ **Tester le workflow complet** (début → fin → validation OU litige)
5. ⏳ **Phase 2** : Intégrer API Stripe pour capture réelle du paiement

---

## 📌 Notes Importantes

### Commission Plateforme
- **8%** du montant TTC
- Calculée automatiquement dans `devis.paiement.commission`
- Artisan reçoit **92%** du montant

### Délai Validation Automatique
- **7 jours** après déclaration fin travaux
- Géré par `travaux.dateValidationAuto`
- TODO : Créer Cloud Function pour exécuter auto-validation

### Statuts Paiement Escrow
- `bloque` : Argent bloqué sur Stripe (capture_method: manual)
- `libere` : Argent capturé et transféré à l'artisan
- `rembourse` : Argent remboursé au client (annulation/litige)

### API Backend à Intégrer (Phase 2)
```typescript
// Dans handleValiderTravaux()
const response = await fetch('/api/v1/payments/release-escrow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contratId: devis.id,
    validePar: 'client',
    commentaire: 'Travaux conformes'
  })
});

if (!response.ok) {
  throw new Error('Erreur lors de la libération du paiement');
}
```

---

## 🎯 Résultat Attendu

**Avant** :
- Page devis affiche uniquement les détails du devis
- Aucune gestion du cycle de vie après paiement

**Après** :
- ✅ Artisan peut déclarer début/fin travaux depuis la page devis
- ✅ Client peut valider ou signaler un litige depuis la page devis
- ✅ Suivi visuel clair de l'avancement (badges colorés)
- ✅ Notifications automatiques à chaque étape
- ✅ Workflow escrow géré (argent bloqué → libéré après validation)

---

**Besoin d'aide pour l'implémentation ?** Demandez-moi de créer les fichiers modifiés ou de vous guider étape par étape !
