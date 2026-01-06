# Système de Recherche Intelligente d'Artisans

## Vue d'ensemble

Le système de recherche d'ArtisanSafe utilise un algorithme de matching intelligent qui prend en compte **4 critères principaux** pour trouver les meilleurs artisans disponibles.

## 🎯 Critères de Recherche

### 1. **Métier / Catégorie** (100 points)
- Filtrage Firestore : `where('metiers', 'array-contains', categorie)`
- Seuls les artisans possédant le métier demandé sont retournés
- Score fixe de 100 points (match garanti)

### 2. **Zone Géographique** (0-50 points)
- **Ville principale** de l'artisan (définie dans `/artisan/profil`)
- **Rayon d'intervention** en km
- Calcul de distance avec formule de Haversine
- **Géocodage automatique** via API française `geo.api.gouv.fr`

**Scoring distance :**
```
0-5 km   → 50 points
5-10 km  → 40 points
10-20 km → 30 points
20-30 km → 20 points
30+ km   → 10 points
```

**Fonctionnement :**
1. Lors de la sauvegarde du profil artisan → coordonnées GPS récupérées automatiquement
2. Lors de la recherche client → ville convertie en coordonnées GPS
3. Distance calculée entre client et artisan
4. Artisan exclu si hors du rayon d'intervention

### 3. **Disponibilité** (0-50 points)
- Basé sur l'**agenda de l'artisan** (`/artisan/agenda`)
- Vérification des créneaux disponibles (slots avec `disponible: true`)
- Support des **créneaux récurrents** (ex: tous les mardis) et **ponctuels** (ex: 15/01/2026)

**Types de recherche :**

#### A. Date fixe
```typescript
Date souhaitée: 2026-01-20
Flexibilité: Non
→ Recherche uniquement le 2026-01-20
```

#### B. Dates flexibles
```typescript
Date souhaitée: 2026-01-20
Flexibilité: Oui (7 jours)
→ Recherche du 2026-01-20 au 2026-01-27
```

**Scoring disponibilité :**
```
Taux de match = Jours disponibles / Jours demandés
Score = Taux de match × 50
```

**Exemples :**
- 3 jours disponibles sur 3 demandés → 50 points
- 2 jours disponibles sur 4 demandés → 25 points
- 0 jour disponible → 0 point (artisan peut être quand même affiché si dates flexibles)

### 4. **Réputation** (0-50 points)
- Note moyenne : 0-5 étoiles → 0-40 points
- Bonus fiabilité selon nombre d'avis :
  - 50+ avis → +10 points
  - 20-49 avis → +7 points
  - 10-19 avis → +5 points
  - 5-9 avis → +3 points

### 5. **Urgence** (0-20 points)
- **Urgent** : +20 points si disponible dans les 3 prochains jours
- **Normale** : +10 points (neutre)
- **Faible** : +5 points

## 📊 Score Total

**Formule :**
```
Score Total = Métier (100) + Distance (0-50) + Disponibilité (0-50) + Réputation (0-50) + Urgence (0-20)
Maximum théorique = 270 points
```

**Tri des résultats :**
1. Score total décroissant
2. Top 10 artisans affichés

## 🔄 Architecture Technique

### Fichiers concernés

1. **`frontend/src/lib/firebase/matching-service.ts`**
   - Logique principale de matching
   - Calcul des scores
   - Filtrage par zone

2. **`frontend/src/lib/firebase/artisan-service.ts`**
   - Auto-enrichissement des coordonnées GPS lors de la mise à jour du profil
   - Fonction `updateArtisan()` modifiée

3. **`frontend/src/app/recherche/page.tsx`**
   - Formulaire de recherche client
   - Autocomplétion ville avec code postal
   - Géocodage avant envoi vers `/resultats`

4. **`frontend/src/app/resultats/page.tsx`**
   - Affichage des résultats matchés
   - Récupération des critères depuis URL
   - Appel à `matchArtisans()`

5. **`frontend/src/app/artisan/profil/page.tsx`**
   - Définition de la ville principale
   - Rayon d'intervention (5-100 km)
   - Autocomplétion ville

6. **`frontend/src/app/artisan/agenda/page.tsx`**
   - Gestion des créneaux de disponibilité
   - Créneaux récurrents (hebdomadaires)
   - Créneaux ponctuels (dates spécifiques)

### Types TypeScript

```typescript
// Zone d'intervention artisan
interface ZoneIntervention {
  ville: string;
  codePostal?: string;
  rayonKm?: number; // Rayon en km
  latitude?: number; // Auto-rempli
  longitude?: number; // Auto-rempli
}

// Slot de disponibilité
interface DisponibiliteSlot {
  id?: string;
  jour?: 'lundi' | 'mardi' | ...; // Récurrence hebdomadaire
  date?: Timestamp; // Créneau ponctuel
  heureDebut: string; // "09:00"
  heureFin: string; // "17:00"
  recurrence: 'hebdomadaire' | 'ponctuel';
  disponible: boolean; // true = dispo, false = occupé
}

// Critères de recherche
interface MatchingCriteria {
  categorie: Categorie;
  ville: string;
  codePostal: string;
  coordonneesGPS?: { latitude: number; longitude: number };
  dates: string[]; // ["2026-01-20"]
  flexible: boolean;
  flexibiliteDays?: number; // 0, 7, 14, 30
  urgence: 'faible' | 'normale' | 'urgent';
}
```

## 🚀 Workflow Complet

### Côté Artisan

1. **Inscription** → Profil créé dans Firestore
2. **Profil** → Définir ville principale + rayon
   - Coordonnées GPS ajoutées automatiquement
3. **Agenda** → Créer des créneaux de disponibilité
   - Récurrents : "Tous les mardis 9h-17h"
   - Ponctuels : "15 janvier 2026, 10h-12h"

### Côté Client

1. **Recherche** (`/recherche`)
   - Sélectionner métier
   - Entrer ville (autocomplétion)
   - Choisir date (+ flexibilité optionnelle)
   - Sélectionner urgence

2. **Géocodage** automatique de la ville client

3. **Redirection** vers `/resultats?categorie=plomberie&ville=Paris&...`

4. **Matching** (backend)
   - Requête Firestore : artisans vérifiés + métier
   - Filtrage zone : distance ≤ rayon
   - Vérification disponibilité : agenda
   - Calcul scores
   - Tri par pertinence

5. **Affichage** des résultats
   - Top 10 artisans
   - Scores détaillés (distance, dispo, réputation)
   - Badges (TOP MATCH, Vérifié, Dispo immédiate)

## 🌍 Géocodage & API

**API utilisée :** `https://geo.api.gouv.fr`

**Avantages :**
- ✅ Gratuite
- ✅ Données officielles françaises
- ✅ Pas de quota
- ✅ Précise au niveau commune

**Endpoints :**
```
GET /communes?nom={ville}&codePostal={CP}&fields=centre&limit=1

Réponse :
[{
  "centre": {
    "coordinates": [2.3522, 48.8566] // [lon, lat]
  }
}]
```

## 📝 Exemples Concrets

### Exemple 1 : Recherche stricte
```
Client cherche :
- Métier: Plomberie
- Ville: Paris 75001
- Date: 2026-01-25
- Flexibilité: Non
- Urgence: Normale

Artisan A :
- Métiers: Plomberie ✅
- Zone: Paris, rayon 20km ✅
- Distance: 2km → 50 points
- Dispo 2026-01-25: Oui (créneau récurrent mardi) → 50 points
- Note: 4.8/5, 30 avis → 45 points
- Urgence: +10 points
→ Score total: 255/270

Artisan B :
- Métiers: Plomberie ✅
- Zone: Boulogne, rayon 15km ✅
- Distance: 8km → 40 points
- Dispo 2026-01-25: Non → 0 point
- Note: 5/5, 60 avis → 50 points
- Urgence: +10 points
→ Score total: 200/270

Classement : A > B
```

### Exemple 2 : Recherche flexible
```
Client cherche :
- Métier: Électricité
- Ville: Lyon 69003
- Date: 2026-02-10
- Flexibilité: Oui (14 jours)
- Urgence: Faible

Artisan C :
- Métiers: Électricité ✅
- Zone: Lyon, rayon 30km ✅
- Distance: 1km → 50 points
- Dispo : 3 jours sur 14 demandés → 11 points (3/14 × 50)
- Note: 4.5/5, 12 avis → 41 points
- Urgence: +5 points
→ Score total: 207/270

Artisan D :
- Métiers: Électricité ✅
- Zone: Villeurbanne, rayon 50km ✅
- Distance: 4km → 50 points
- Dispo : 10 jours sur 14 demandés → 36 points (10/14 × 50)
- Note: 4.2/5, 5 avis → 36 points
- Urgence: +5 points
→ Score total: 227/270

Classement : D > C (plus de disponibilités)
```

## ⚡ Optimisations

### 1. Index Firestore requis
```javascript
Collection: artisans
Index composites:
- (verified, metiers) → Pour query de base
```

### 2. Cache côté client
```typescript
// Sauvegarder critères dans sessionStorage
sessionStorage.setItem('searchCriteria', JSON.stringify(criteria));
```

### 3. Limitation résultats
- Maximum 10 artisans affichés
- Évite surcharge interface
- Encourage qualité vs quantité

## 🔮 Évolutions Futures

### Phase 2
- [ ] Cache Redis pour géocodage fréquent
- [ ] Index Algolia pour recherche textuelle
- [ ] Filtres avancés (note min, rayon max)

### Phase 3
- [ ] Machine Learning : prédire disponibilités futures
- [ ] Recommandations personnalisées
- [ ] Système de réservation en temps réel

## 🐛 Debugging

### Logs activés
```javascript
console.log('🔍 Lancement du matching avec critères:', criteria);
console.log(`📊 ${snapshot.docs.length} artisan(s) trouvé(s)`);
console.log(`⚠️ ${artisan.raisonSociale}: hors zone`);
console.log(`✅ ${artisan.raisonSociale}: score=${scoreTotal}`);
console.log(`📍 Coordonnées ajoutées pour ${zone.ville}`);
```

### Tests manuels
1. Créer artisan avec agenda complet
2. Créer disponibilités (mardi + jeudi)
3. Rechercher avec date = mardi → score dispo = 50
4. Rechercher avec date = lundi → score dispo = 0

## 📚 Références

- [API Geo Gouv](https://geo.api.gouv.fr/decoupage-administratif/communes)
- [Formule Haversine](https://en.wikipedia.org/wiki/Haversine_formula)
- [Firestore Query Best Practices](https://firebase.google.com/docs/firestore/query-data/queries)

---

**Dernière mise à jour :** 5 janvier 2026  
**Version :** 1.0  
**Auteur :** Équipe ArtisanSafe
