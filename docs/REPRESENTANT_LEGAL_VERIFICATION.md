# 🔐 Vérification du Représentant Légal - Documentation Technique

## 📋 Vue d'ensemble

Le système de vérification du représentant légal compare automatiquement les informations saisies par l'artisan lors de l'inscription avec celles extraites du document KBIS uploadé.

## ✅ Fonctionnalités implémentées

### 1. Champ "Représentant légal" dans l'inscription

**Fichier** : [frontend/src/app/inscription/page.tsx](../frontend/src/app/inscription/page.tsx)

- ✅ Champ obligatoire pour les artisans
- ✅ Placeholder : "Nom complet (ex: Pierre DUPONT)"
- ✅ Texte d'aide : "Doit correspondre au nom figurant sur votre KBIS"
- ✅ Validation : Erreur si vide pour un artisan

**Stockage** : `users/[uid]/representantLegal`

---

### 2. Extraction du représentant légal depuis le KBIS

**Fichier** : [frontend/src/lib/firebase/document-parser.ts](../frontend/src/lib/firebase/document-parser.ts)

#### Fonction `parseKbisDocument()`

Extrait maintenant :
- ✅ SIRET
- ✅ SIREN
- ✅ Raison sociale
- ✅ Forme juridique
- ✅ **Représentant légal** (NOUVEAU)

#### Pattern de recherche

```typescript
const representantPattern = /(?:GERANT|PRESIDENT|DIRIGEANT|REPRESENTANT\s+LEGAL)[:\s]*([A-ZÀ-ÿ\s'-]+)/i;
```

Détecte les variations :
- "GERANT : Pierre DUPONT"
- "PRESIDENT : Marie MARTIN"
- "DIRIGEANT : Jean DURAND"
- "REPRESENTANT LEGAL : Sophie BERNARD"

---

### 3. Comparaison intelligente des noms

**Fichier** : [frontend/src/lib/firebase/document-parser.ts](../frontend/src/lib/firebase/document-parser.ts)

#### Fonction `compareRepresentantLegal()`

**Normalisation** :
```typescript
function normalizeName(name: string): string {
  return name
    .normalize('NFD')                     // Décompose les accents
    .replace(/[\u0300-\u036f]/g, '')      // Supprime les accents
    .toUpperCase()                         // Majuscules
    .replace(/[^A-Z\s]/g, '')             // Garde uniquement lettres
    .replace(/\s+/g, ' ')                 // Espaces multiples → un
    .trim();
}
```

**Niveaux de confiance** :

| Confiance | Condition | Exemple |
|-----------|-----------|---------|
| **High** | Correspondance exacte | "Pierre DUPONT" = "PIERRE DUPONT" |
| **Medium** | Tous les mots présents | "Pierre DUPONT" = "DUPONT Pierre" |
| **Low** | Nom de famille identique | "Pierre DUPONT" ≈ "P. DUPONT" |
| **No match** | Aucune correspondance | "Pierre DUPONT" ≠ "Marie MARTIN" |

**Exemples de correspondances** :

```typescript
// ✅ High confidence
compareRepresentantLegal("Pierre DUPONT", "PIERRE DUPONT")
// { match: true, confidence: 'high' }

// ✅ Medium confidence
compareRepresentantLegal("DUPONT Pierre", "Pierre DUPONT")  
// { match: true, confidence: 'medium' }

// ✅ Medium confidence (accents)
compareRepresentantLegal("José García", "JOSE GARCIA")
// { match: true, confidence: 'medium' }

// ⚠️ Low confidence (vérification manuelle)
compareRepresentantLegal("P. DUPONT", "Pierre DUPONT")
// { match: true, confidence: 'low', error: '...' }

// ❌ No match
compareRepresentantLegal("Pierre DUPONT", "Marie MARTIN")
// { match: false, error: 'Le représentant légal du KBIS...' }
```

---

### 4. Service de vérification mis à jour

**Fichier** : [frontend/src/lib/firebase/verification-service.ts](../frontend/src/lib/firebase/verification-service.ts)

#### Fonction `uploadAndVerifyKbis()`

**Nouvelle signature** :
```typescript
async function uploadAndVerifyKbis(
  userId: string,
  file: File,
  profileSiret: string,
  profileRepresentant?: string  // ← NOUVEAU paramètre
): Promise<{
  success: boolean;
  url?: string;
  parseResult?: KbisParseResult;
  warnings?: string[];           // ← NOUVEAU
  error?: string;
}>
```

**Workflow de vérification** :

```
1. Parser le KBIS
   ├─ Extraire SIRET
   ├─ Extraire raison sociale
   └─ Extraire représentant légal

2. Vérifier SIRET
   ├─ ✅ Match → Continue
   └─ ❌ No match → Erreur fatale

3. Vérifier représentant légal (si disponible)
   ├─ ✅ High confidence → Auto-vérifié
   ├─ ⚠️ Medium/Low confidence → Warning + vérification manuelle
   └─ ❌ No match → Warning + vérification manuelle

4. Sauvegarder dans Firestore
   ├─ URL du document
   ├─ Résultats de la vérification
   ├─ Données extraites
   └─ Flag requiresManualReview
```

**Données sauvegardées** :

```json
{
  "artisans/[userId]/verificationDocuments/kbis": {
    "url": "https://storage.googleapis.com/...",
    "uploadDate": Timestamp,
    "verified": true/false,
    "siretMatched": true/false,
    "representantMatched": true/false,
    "representantConfidence": "high" | "medium" | "low",
    "requiresManualReview": true/false,
    "extractedData": {
      "siret": "12345678900012",
      "siren": "123456789",
      "companyName": "ENTREPRISE DUPONT SARL",
      "legalForm": "SARL",
      "representantLegal": "DUPONT PIERRE"
    }
  }
}
```

---

### 5. Page d'upload de documents

**Fichier** : [frontend/src/app/artisan/documents/page.tsx](../frontend/src/app/artisan/documents/page.tsx)

**Modifications** :
- ✅ Récupère le `representantLegal` depuis `users/[uid]`
- ✅ Passe le paramètre à `uploadAndVerifyKbis()`
- ✅ Affiche les warnings dans une alerte
- ✅ Montre le représentant légal extrait

**Message de succès** :
```
✅ KBIS vérifié avec succès !

SIRET trouvé : 12345678900012
Entreprise : ENTREPRISE DUPONT SARL
Représentant légal : DUPONT PIERRE

⚠️ Avertissements :
- Vérification manuelle du représentant légal recommandée
```

---

## 🔄 Flux de vérification complet

### Scénario 1 : Vérification automatique réussie

```
1. Artisan s'inscrit
   representantLegal = "Pierre DUPONT"
   
2. Upload KBIS
   KBIS extrait: "DUPONT Pierre"
   
3. Comparaison
   normalizeName("Pierre DUPONT") = "PIERRE DUPONT"
   normalizeName("DUPONT Pierre") = "DUPONT PIERRE"
   → Tous les mots présents → Medium confidence
   
4. Résultat
   ✅ verified: true
   ✅ representantMatched: true
   ✅ representantConfidence: "medium"
   ❌ requiresManualReview: false
```

### Scénario 2 : Nécessite vérification manuelle

```
1. Artisan s'inscrit
   representantLegal = "Pierre DUPONT"
   
2. Upload KBIS
   KBIS extrait: "P. DUPONT"
   
3. Comparaison
   → Nom de famille identique mais prénoms incomplets
   → Low confidence
   
4. Résultat
   ⚠️ verified: false
   ⚠️ representantMatched: true
   ⚠️ representantConfidence: "low"
   ⚠️ requiresManualReview: true
   
5. Admin vérifie manuellement et valide
```

### Scénario 3 : Non-correspondance

```
1. Artisan s'inscrit
   representantLegal = "Pierre DUPONT"
   
2. Upload KBIS
   KBIS extrait: "Marie MARTIN"
   
3. Comparaison
   → Aucune correspondance
   
4. Résultat
   ❌ verified: false
   ❌ representantMatched: false
   ⚠️ requiresManualReview: true
   ⚠️ warnings: ["Le représentant légal du KBIS ne correspond pas..."]
   
5. Admin contacte l'artisan pour clarification
```

---

## 📊 Types mis à jour

**Fichier** : [frontend/src/types/firestore.ts](../frontend/src/types/firestore.ts)

### Interface `User`

```typescript
export interface User {
  uid: string;
  email: string;
  role: UserRole;
  nom: string;
  prenom: string;
  representantLegal?: string;  // ← NOUVEAU
  telephone: string;
  // ...
}
```

### Interface `VerificationDocuments`

```typescript
export interface VerificationDocuments {
  kbis?: {
    url: string;
    uploadDate: Timestamp;
    verified: boolean;
    siretMatched?: boolean;              // ← NOUVEAU
    representantMatched?: boolean;       // ← NOUVEAU
    representantConfidence?: 'high' | 'medium' | 'low';  // ← NOUVEAU
    requiresManualReview?: boolean;      // ← NOUVEAU
    extractedData?: {
      siret?: string;
      siren?: string;
      companyName?: string;
      legalForm?: string;
      representantLegal?: string;        // ← NOUVEAU
    };
  };
  // ...
}
```

### Interface `KbisParseResult`

```typescript
export interface KbisParseResult {
  success: boolean;
  siret?: string;
  siren?: string;
  companyName?: string;
  legalForm?: string;
  representantLegal?: string;  // ← NOUVEAU
  registrationDate?: string;
  error?: string;
}
```

---

## 🧪 Tests recommandés

### Test 1 : Inscription artisan
```typescript
// Données de test
email: "artisan@test.com"
nom: "DUPONT"
prenom: "Pierre"
representantLegal: "Pierre DUPONT"  // ← Vérifier que c'est sauvegardé

// Vérifier dans Firestore
users/[uid]/representantLegal = "Pierre DUPONT"
```

### Test 2 : Upload KBIS avec correspondance exacte
```typescript
// KBIS contient : "GERANT : Pierre DUPONT"
// Profil contient : "Pierre DUPONT"

// Résultat attendu
{
  verified: true,
  siretMatched: true,
  representantMatched: true,
  representantConfidence: "high",
  requiresManualReview: false
}
```

### Test 3 : Upload KBIS avec variation
```typescript
// KBIS contient : "PRESIDENT : DUPONT Pierre"
// Profil contient : "Pierre DUPONT"

// Résultat attendu
{
  verified: true,
  siretMatched: true,
  representantMatched: true,
  representantConfidence: "medium",
  requiresManualReview: false
}
```

### Test 4 : Upload KBIS sans représentant
```typescript
// KBIS ne contient pas de représentant lisible
// Profil contient : "Pierre DUPONT"

// Résultat attendu
{
  verified: false,
  siretMatched: true,
  representantMatched: false,
  requiresManualReview: true,
  warnings: ["Impossible d'extraire le représentant légal..."]
}
```

---

## 🎯 Prochaines étapes possibles

### 1. Interface admin de vérification manuelle
- Afficher les documents nécessitant une revue manuelle
- Comparer visuellement le KBIS avec les données du profil
- Bouton "Approuver" / "Rejeter" avec commentaire

### 2. Notifications
- Email à l'artisan si vérification automatique échoue
- Email à l'admin si documents nécessitent une revue
- Email à l'artisan quand le profil est vérifié

### 3. Amélioration de l'OCR
- Tesseract.js fonctionne mais peut être amélioré
- Considérer Google Vision API ou AWS Textract pour meilleure précision
- Pré-traitement d'image (contraste, rotation, etc.)

### 4. Tests unitaires
```typescript
// document-parser.test.ts
describe('compareRepresentantLegal', () => {
  it('should match exact names', () => {
    const result = compareRepresentantLegal(
      "Pierre DUPONT",
      "PIERRE DUPONT"
    );
    expect(result.match).toBe(true);
    expect(result.confidence).toBe('high');
  });
  
  it('should match reversed names', () => {
    const result = compareRepresentantLegal(
      "DUPONT Pierre",
      "Pierre DUPONT"
    );
    expect(result.match).toBe(true);
    expect(result.confidence).toBe('medium');
  });
});
```

---

## 📚 Ressources

- **OCR** : Tesseract.js - https://tesseract.projectnaptha.com/
- **Normalisation des chaînes** : String.prototype.normalize() MDN
- **API SIRENE** : https://api.gouv.fr/les-api/sirene_v3

---

**📅 Dernière mise à jour :** 30 décembre 2025
