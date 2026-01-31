# 🔐 Système de validation anti-contournement

## Vue d'ensemble

Le système de validation anti-contournement empêche les utilisateurs de partager des **informations de contact personnelles** (téléphone, email, adresses) directement dans les champs de texte du formulaire de devis.

**Objectif** : Garantir que tous les échanges se font via la **messagerie sécurisée** de la plateforme ArtisanSafe.

---

## 🎯 Champs protégés

### ✅ Tous les champs de texte libre sont validés :

1. **Titre du devis**
   - Validation en temps réel
   - Bloque la saisie si contenu interdit détecté

2. **Description**
   - Validation en temps réel
   - Empêche le collage d'informations personnelles

3. **Description de chaque ligne de prestation**
   - Validation pour chaque ligne ajoutée
   - Protection contre l'ajout d'infos dans les détails techniques

4. **Conditions particulières**
   - Validation complète
   - Empêche l'ajout de coordonnées dans les clauses

5. **Délai de réalisation**
   - Validé lors de l'envoi final du devis

---

## 🛡️ Détection automatique

### Types d'informations interdites :

#### 📞 Numéros de téléphone (15+ patterns détectés)

```
❌ Formats interdits :
- 06 12 34 56 78
- 06.12.34.56.78
- 06-12-34-56-78
- 0612345678
- +33 6 12 34 56 78
- zéro six douze trente-quatre (en toutes lettres)
- 0 six 12 34 cinquante-six (mixte lettres/chiffres)
```

**Algorithme de détection** :
1. Détection chiffres purs (regex)
2. Conversion mots → chiffres (dictionnaire 30 mots)
3. Détection séquences numériques longues
4. Détection formats internationaux

#### 📧 Adresses email

```
❌ Formats interdits :
- artisan@email.com
- contact.pro@gmail.fr
- toute adresse avec @ et extension (.com, .fr, .net, etc.)
```

#### 🏠 Adresses postales complètes

```
❌ Combinaisons interdites :
- "15 rue de la Paix" + "75001" → BLOQUÉ
- Détection : (rue/avenue/boulevard) + code postal 5 chiffres
```

**Mots-clés surveillés** :
- rue, avenue, boulevard, impasse, allée, chemin, place

---

## ⚙️ Fonctionnement technique

### Architecture

```typescript
// frontend/src/app/artisan/devis/nouveau/page.tsx

function detecterInformationsInterdites(texte: string): {
  valide: boolean;
  raison?: string;
}
```

### Workflow de validation

```
1. Utilisateur saisit du texte
         ↓
2. onChange déclenche validation
         ↓
3. detecterInformationsInterdites() analyse le texte
         ↓
4a. VALIDE → Texte accepté, state mis à jour
4b. INVALIDE → Erreur affichée, saisie bloquée
         ↓
5. Alerte rouge affichée pendant 5 secondes
         ↓
6. Auto-masquage de l'alerte
```

### Implémentation (exemple)

```typescript
// Champ Titre avec validation
<input
  type="text"
  value={titre}
  onChange={(e) => {
    const validation = detecterInformationsInterdites(e.target.value);
    if (!validation.valide) {
      setErreurValidation(validation.raison || null);
      return; // ← Bloque la saisie
    }
    setErreurValidation(null);
    setTitre(e.target.value); // ← Accepte la saisie
  }}
/>
```

---

## 🚨 Alertes utilisateur

### Message d'erreur temps réel

```tsx
{erreurValidation && (
  <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
    <div className="flex items-start">
      <span className="text-2xl mr-3">⚠️</span>
      <div>
        <h3 className="text-red-800 font-semibold">Contenu non autorisé</h3>
        <p className="text-red-700 text-sm">{erreurValidation}</p>
        <p className="text-red-600 text-xs mt-2">
          💡 <strong>Pour votre sécurité</strong> : tous les échanges doivent 
          se faire via la messagerie intégrée de la plateforme.
        </p>
      </div>
    </div>
  </div>
)}
```

**Exemples de messages affichés** :

- ⛔ Numéros de téléphone interdits. Utilisez la messagerie de la plateforme pour communiquer.
- ⛔ Numéros de téléphone (même partiellement écrits en lettres) interdits. Utilisez la messagerie de la plateforme.
- ⛔ Écriture de numéros en toutes lettres interdite. Utilisez la messagerie intégrée.
- ⛔ Adresses email interdites. Utilisez la messagerie de la plateforme.
- ⛔ Adresses complètes interdites.

### Validation finale à l'envoi

```typescript
// Validation complète avant envoi du devis
const champsAVerifier = [
  { nom: 'titre', valeur: titre },
  { nom: 'description', valeur: description },
  { nom: 'délai de réalisation', valeur: delaiRealisation },
  { nom: 'conditions', valeur: conditions },
  ...lignes.map((l, i) => ({ nom: `ligne ${i + 1}`, valeur: l.description }))
];

for (const champ of champsAVerifier) {
  const validation = detecterInformationsInterdites(champ.valeur);
  if (!validation.valide) {
    alert(`❌ ${validation.raison}\n\nChamp concerné : ${champ.nom}\n\n💬 Utilisez le bouton "Contacter client" pour échanger via la messagerie sécurisée de la plateforme.`);
    setSaving(false);
    return; // ← Bloque l'envoi
  }
}
```

---

## ⏱️ UX - Auto-masquage

```typescript
// Auto-masquer l'erreur après 5 secondes
useEffect(() => {
  if (erreurValidation) {
    const timer = setTimeout(() => {
      setErreurValidation(null);
    }, 5000);
    return () => clearTimeout(timer);
  }
}, [erreurValidation]);
```

**Avantages** :
- ✅ Alerte visible immédiatement
- ✅ Disparaît automatiquement (pas de clics inutiles)
- ✅ Ne gêne pas la saisie ultérieure

---

## 🔍 Tests de validation

### Cas de test recommandés

```typescript
// Test 1 : Téléphone format classique
Input: "Appelez-moi au 06 12 34 56 78"
Output: ❌ BLOQUÉ - "Numéros de téléphone interdits"

// Test 2 : Téléphone sans espaces
Input: "Mon numéro : 0612345678"
Output: ❌ BLOQUÉ - "Numéros de téléphone interdits"

// Test 3 : Téléphone en lettres
Input: "Contactez zéro six douze trente-quatre cinquante-six"
Output: ❌ BLOQUÉ - "Numéros de téléphone (même en lettres) interdits"

// Test 4 : Email
Input: "Envoyez-moi un mail à artisan@email.com"
Output: ❌ BLOQUÉ - "Adresses email interdites"

// Test 5 : Adresse postale complète
Input: "Chantier au 15 rue de Paris 75001 Paris"
Output: ❌ BLOQUÉ - "Adresses complètes interdites"

// Test 6 : Texte légitime
Input: "Installation de 3 prises électriques"
Output: ✅ ACCEPTÉ

// Test 7 : Quantités/prix (nombres légitimes)
Input: "Fourniture de 12 mètres de câble 2.5mm²"
Output: ✅ ACCEPTÉ (pas de pattern téléphone détecté)
```

### Commandes de test

```bash
# Tester en développement
cd frontend
npm run dev

# Ouvrir http://localhost:3000/artisan/devis/nouveau?demandeId=xxx
# Essayer de saisir :
# - "06 12 34 56 78" dans le titre → doit être bloqué
# - "artisan@gmail.com" dans description → doit être bloqué
# - "15 rue de Paris 75001" dans conditions → doit être bloqué
```

---

## 📊 Statistiques de détection

### Patterns détectés (Total : 25+)

| Catégorie | Nombre de patterns | Exemples |
|-----------|-------------------|----------|
| Téléphone chiffres | 5 | `06 12 34 56 78`, `0612345678`, `+33 6...` |
| Téléphone lettres | 10+ | `zéro six`, `06 douze`, mixtes |
| Email | 1 | `xxx@xxx.xxx` |
| Adresse postale | 8 | `rue` + `75001`, `boulevard` + code postal |

### Faux positifs minimisés

```typescript
// ❌ Ancien algo : bloquait "12 prises électriques"
// ✅ Nouveau algo : autorise les quantités légitimes

// Vérification : séquence > 4 mots numériques
sequenceNumeros.length >= 4
```

---

## 🛠️ Maintenance

### Ajouter un nouveau pattern de détection

```typescript
// Dans detecterInformationsInterdites()
const nouveauxPatterns = [
  /nouveau_regex_pattern/g, // Description pattern
];

for (const pattern of nouveauxPatterns) {
  if (pattern.test(texte)) {
    return { valide: false, raison: 'Message personnalisé' };
  }
}
```

### Désactiver la validation (développement uniquement)

```typescript
// ⚠️ NE JAMAIS FAIRE EN PRODUCTION
function detecterInformationsInterdites(texte: string) {
  return { valide: true }; // Désactive toute validation
}
```

---

## ✅ Checklist d'implémentation

- [x] Fonction `detecterInformationsInterdites()` créée
- [x] State `erreurValidation` ajouté
- [x] Validation sur champ **Titre**
- [x] Validation sur champ **Description**
- [x] Validation sur champ **Description des lignes**
- [x] Validation sur champ **Conditions particulières**
- [x] Validation sur champ **Délai de réalisation**
- [x] Alerte rouge affichée en temps réel
- [x] Auto-masquage après 5 secondes
- [x] Validation finale avant envoi du devis
- [x] Tests manuels effectués
- [ ] Tests unitaires (à implémenter)

---

## 📝 TODO - Améliorations futures

### Phase 1 (Actuel) ✅
- ✅ Validation temps réel sur tous champs
- ✅ Alerte visuelle claire
- ✅ Double validation (temps réel + envoi)

### Phase 2 (Futur)
- [ ] **Tests automatisés** : Ajouter tests Jest pour `detecterInformationsInterdites()`
- [ ] **Logs admin** : Enregistrer tentatives de contournement dans Firestore
- [ ] **Statistiques** : Dashboard admin avec nombre de tentatives bloquées
- [ ] **IA/ML** : Détection avancée avec modèle NLP (Google Cloud Natural Language API)

### Phase 3 (Optionnel)
- [ ] **Sanctions** : Suspendre artisans récidivistes
- [ ] **Notifications** : Alerter admin en cas de tentatives répétées
- [ ] **Historique** : Tracker tentatives par utilisateur

---

## 🔗 Fichiers concernés

```
frontend/src/app/artisan/devis/nouveau/page.tsx
├── detecterInformationsInterdites() (lignes 26-147)
├── State erreurValidation (ligne 183)
├── useEffect auto-masquage (lignes 185-192)
├── Validation champ Titre (lignes 1121-1136)
├── Validation champ Description (lignes 1138-1153)
├── Validation lignes prestations (lignes 1551-1566)
├── Validation Conditions (lignes 1645-1660)
└── Validation finale envoyerDevis() (lignes 947-969)
```

---

## 🎓 Inspirations

- **BlaBlaCar** : Validation anti-contournement pour forcer paiement en ligne
- **Airbnb** : Détection coordonnées dans messages
- **Uber** : Masquage numéros téléphone entre clients/chauffeurs

---

## 📞 Support

**Questions/bugs** : Contacter l'équipe technique ArtisanSafe

**Dernière mise à jour** : 27 janvier 2026
