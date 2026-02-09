# Système de Marquage Automatique des Devis Remplacés

## 📋 Vue d'ensemble

Système automatique qui **marque les devis originaux comme "remplacés"** quand une variante est acceptée et payée par le client.

## 🎯 Problème résolu

**Situation avant** :
- Devis original : `DV-2026-00004` → Statut `en_attente_paiement`
- Variante payée : `DV-2026-00004-A` → Statut `paye`
- ❌ **Incohérence** : Le devis original reste actif alors que la variante a été choisie

**Situation après** (avec le système) :
- Devis original : `DV-2026-00004` → Statut `remplace` 
  - Champ `remplacePar` : `{ devisId, numeroDevis: "DV-2026-00004-A", date }`
- Variante payée : `DV-2026-00004-A` → Statut `paye`
- ✅ **Cohérence** : État clair indiquant quelle variante a été choisie

## 🔧 Architecture technique

### 1. Fonction principale

**Fichier** : `frontend/src/lib/firebase/devis-service.ts`

```typescript
export async function marquerDevisOriginalCommeRemplace(
  devisPayeId: string,        // ID du devis qui vient d'être payé
  numeroDevisPaye: string,     // Ex: "DV-2026-00004-A"
  demandeId: string            // ID de la demande concernée
): Promise<void>
```

**Logique** :
1. Vérifie si le devis payé est une variante (détecte suffixe `-A`, `-B`, etc.)
2. Si variante → extrait le numéro de base (`DV-2026-00004`)
3. Recherche le devis original (sans lettre) pour cette demande
4. Marque le devis original avec statut `remplace` + champ `remplacePar`
5. Annule toutes les autres variantes non finalisées

### 2. Point d'intégration

**Fichier** : `frontend/src/app/client/devis/[id]/page.tsx`

**Fonction** : `handlePaymentSuccess()` (quand le client paie le devis)

```typescript
// 🆕 Appel automatique lors du paiement
const { marquerDevisOriginalCommeRemplace } = await import('@/lib/firebase/devis-service');
await marquerDevisOriginalCommeRemplace(
  devisId, 
  devis.numeroDevis, 
  devis.demandeId
);
```

### 3. Nouveau statut Firestore

**Type** : `DevisStatut` (ajouté : `'remplace'`)

**Champ ajouté dans Devis** :
```typescript
remplacePar?: {
  devisId: string;           // ID de la variante payée
  numeroDevis: string;       // Numéro de la variante (ex: "DV-2026-00004-A")
  date: Timestamp;           // Date du paiement
}
```

## 🔄 Workflow complet

### Scénario : Client accepte une variante

```
1. Client reçoit devis original
   → DV-2026-00004 (statut: envoye)

2. Client refuse avec demande révision
   → DV-2026-00004 (statut: refuse, typeRefus: 'revision')

3. Artisan crée variante A
   → DV-2026-00004-A (statut: envoye)

4. Client accepte et paie variante A
   → DV-2026-00004-A (statut: paye)
   
   🤖 SYSTÈME AUTOMATIQUE DÉCLENCHÉ :
   
   a) Marque devis original comme remplacé
      → DV-2026-00004 
         - statut: 'remplace' ✅
         - remplacePar: { 
             devisId: "xxx-yyy-zzz",
             numeroDevis: "DV-2026-00004-A",
             date: Timestamp
           }
   
   b) Annule autres variantes (si existent)
      → DV-2026-00004-B (statut: annule)
      → DV-2026-00004-C (statut: annule)
   
   c) Ferme la demande
      → demande (statut: attribuee)

5. Résultat final
   ✅ DV-2026-00004-A : PAYÉ (contrat actif)
   🔒 DV-2026-00004   : REMPLACÉ (pour historique)
   ❌ DV-2026-00004-B : ANNULÉ
   ❌ DV-2026-00004-C : ANNULÉ
```

## 📊 États possibles d'un devis

| Statut | Description | Cas d'usage |
|--------|-------------|-------------|
| `envoye` | Envoyé au client | Devis en attente de réponse |
| `en_attente_paiement` | Signé, paiement en cours | Client a accepté, 24h pour payer |
| `paye` | ✅ Payé = Contrat actif | Contrat juridique en cours |
| `remplace` | 🔄 Remplacé par variante | Original remplacé par -A/-B/-C |
| `annule` | ❌ Annulé automatiquement | Autre variante choisie |
| `refuse` | ❌ Refusé par client | Client a explicitement refusé |

## 🎨 Affichage UI recommandé

### Page artisan `/artisan/devis`

**Badge devis original remplacé** :
```tsx
{devis.statut === 'remplace' && (
  <div className="bg-purple-50 border-2 border-purple-300 p-4 rounded-lg">
    <p className="font-bold text-purple-700">
      🔄 Devis remplacé par {devis.remplacePar?.numeroDevis}
    </p>
    <p className="text-sm text-purple-600">
      Le client a choisi la variante {devis.remplacePar?.numeroDevis} qui a été payée le{' '}
      {devis.remplacePar?.date?.toDate().toLocaleDateString('fr-FR')}
    </p>
    <button
      onClick={() => router.push(`/artisan/devis/${devis.remplacePar?.devisId}`)}
      className="mt-2 bg-purple-600 text-white px-4 py-2 rounded-lg"
    >
      📋 Voir la variante acceptée
    </button>
  </div>
)}
```

### Page client `/client/devis`

**Distinction visuelle** :
```tsx
// Variante payée → Badge vert
{devis.statut === 'paye' && (
  <span className="bg-green-600 text-white px-3 py-1 rounded-full">
    ✅ Devis accepté et payé
  </span>
)}

// Devis original remplacé → Badge violet
{devis.statut === 'remplace' && (
  <span className="bg-purple-600 text-white px-3 py-1 rounded-full">
    🔄 Remplacé par {devis.remplacePar?.numeroDevis}
  </span>
)}
```

## 🧪 Test du système

### Test manuel

1. **Créer devis original**
   ```
   Artisan crée: DV-2026-00010
   Client refuse avec révision
   ```

2. **Créer variante**
   ```
   Artisan crée: DV-2026-00010-A
   Client accepte et paie
   ```

3. **Vérifier résultats**
   - ✅ `DV-2026-00010-A` : statut = `paye`
   - ✅ `DV-2026-00010` : statut = `remplace`
   - ✅ `DV-2026-00010` : champ `remplacePar` renseigné

### Logs console attendus

```
🔄 Recherche devis original à remplacer pour: DV-2026-00010-A
📋 Numéro de base extrait: DV-2026-00010
✅ Devis original trouvé: DV-2026-00010 (xyz-123-abc)
✅ Devis original DV-2026-00010 marqué comme REMPLACÉ par DV-2026-00010-A
✅ Système de marquage devis original exécuté
```

## 🔍 Requêtes Firestore utiles

### Trouver tous les devis remplacés

```typescript
const q = query(
  collection(db, 'devis'),
  where('statut', '==', 'remplace')
);
```

### Trouver devis remplacé par une variante spécifique

```typescript
const q = query(
  collection(db, 'devis'),
  where('remplacePar.devisId', '==', varianteId)
);
```

## 📝 TODO / Améliorations futures

- [ ] **Dashboard artisan** : Afficher icône 🔄 pour devis remplacés
- [ ] **Statistiques** : Taux d'acceptation original vs variantes
- [ ] **Notification** : Alerte artisan quand variante choisie
- [ ] **Export PDF** : Mention "Remplacé par variante X" sur PDF original
- [ ] **Cloud Function** : Nettoyer vieux devis remplacés (> 365 jours)

## 🐛 Troubleshooting

### Devis original reste "en_attente_paiement"

**Cause** : Système pas déclenché (erreur lors du paiement)

**Solution** :
1. Vérifier logs console lors du paiement
2. Appeler manuellement la fonction :
   ```typescript
   await marquerDevisOriginalCommeRemplace(
     'devis-variante-id',
     'DV-2026-00004-A',
     'demande-id'
   );
   ```

### Plusieurs devis marqués "remplacé"

**Cause** : Plusieurs variantes payées pour même demande (anormal)

**Solution** :
1. Vérifier workflow acceptation devis
2. S'assurer qu'une seule variante peut être payée à la fois

## 📌 Références

- **Type DevisStatut** : `frontend/src/types/devis.ts`
- **Service devis** : `frontend/src/lib/firebase/devis-service.ts`
- **Page paiement** : `frontend/src/app/client/devis/[id]/page.tsx`
- **Workflow devis** : `docs/WORKFLOW_CLIENT_DEVIS.md`

---

**Auteur** : ArtisanSafe Dev Team  
**Date** : 2026-02-09  
**Version** : 1.0.0
