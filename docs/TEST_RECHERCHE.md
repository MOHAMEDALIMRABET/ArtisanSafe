# Guide de Test - Recherche Intelligente

## 🧪 Protocole de Test Complet

### Prérequis
- ✅ Compte artisan créé et vérifié (`verified: true`)
- ✅ Profil artisan avec ville principale + rayon définis
- ✅ Agenda artisan avec créneaux de disponibilité
- ✅ Compte client créé (optionnel pour recherche)

---

## Phase 1 : Configuration Artisan

### Test 1.1 : Création du Profil
**URL :** `http://localhost:3000/artisan/profil`

**Actions :**
1. Remplir le formulaire :
   - Métiers : Sélectionner "Plomberie"
   - Ville principale : Taper "Paris"
   - Sélectionner : Paris 75001
   - Rayon : 30 km

2. Sauvegarder

**Résultat attendu :**
```javascript
// Console logs
📍 Coordonnées ajoutées pour Paris: 48.8566, 2.3522
```

**Vérification Firestore :**
```javascript
artisans/{userId}/zonesIntervention = [{
  ville: "Paris",
  codePostal: "75001",
  rayonKm: 30,
  latitude: 48.8566,
  longitude: 2.3522
}]
```

### Test 1.2 : Créneaux de Disponibilité
**URL :** `http://localhost:3000/artisan/agenda`

**Actions :**
1. Créer créneau récurrent :
   - Jour : Mardi
   - Heure : 09:00 - 17:00
   - Type : Hebdomadaire
   - Statut : ✅ Disponible

2. Créer créneau ponctuel :
   - Date : 15/01/2026
   - Heure : 10:00 - 12:00
   - Type : Ponctuel
   - Statut : ✅ Disponible

**Résultat attendu :**
```javascript
artisans/{userId}/disponibilites = [
  {
    jour: "mardi",
    heureDebut: "09:00",
    heureFin: "17:00",
    recurrence: "hebdomadaire",
    disponible: true
  },
  {
    date: Timestamp(2026-01-15),
    heureDebut: "10:00",
    heureFin: "12:00",
    recurrence: "ponctuel",
    disponible: true
  }
]
```

---

## Phase 2 : Recherche Client

### Test 2.1 : Recherche Simple (Match Parfait)
**URL :** `http://localhost:3000/recherche`

**Critères :**
- Métier : Plomberie
- Ville : Paris 75002 (proche de 75001)
- Date : Mardi prochain (ex: 2026-01-14)
- Flexibilité : Non
- Urgence : Normale

**Résultat attendu :**
- ✅ Artisan apparaît dans les résultats
- Score distance : ~50 points (< 5km)
- Score disponibilité : 50 points (match mardi)
- Score total : ~210-260 points

**Console logs :**
```
🔍 Lancement du matching avec critères: {...}
📊 1 artisan(s) trouvé(s) pour plomberie
✅ [Nom Artisan]: score=250 (distance=50, dispo=50, note=0)
🎯 1 artisan(s) matchés (après filtres)
```

### Test 2.2 : Recherche avec Flexibilité
**Critères :**
- Métier : Plomberie
- Ville : Paris 75002
- Date : Lundi 13/01/2026 (jour NON disponible)
- Flexibilité : ✅ Oui (7 jours)
- Urgence : Normale

**Résultat attendu :**
- ✅ Artisan apparaît (mardi 14/01 dans fenêtre de 7 jours)
- Score disponibilité : ~7-14 points (1 jour sur 7)
- Message : "Disponible le 14/01/2026 (mardi)"

### Test 2.3 : Recherche Hors Zone
**Critères :**
- Métier : Plomberie
- Ville : Lyon 69001 (> 400 km de Paris)
- Date : Mardi prochain
- Flexibilité : Non

**Résultat attendu :**
- ❌ Artisan N'apparaît PAS
- Message : "Aucun artisan disponible"
- Raison : Distance > Rayon (30 km)

**Console logs :**
```
⚠️ [Nom Artisan]: hors zone
```

### Test 2.4 : Recherche Métier Non Couvert
**Critères :**
- Métier : Électricité (artisan = Plomberie uniquement)
- Ville : Paris 75001
- Date : Mardi prochain

**Résultat attendu :**
- ❌ Artisan N'apparaît PAS
- Message : "Aucun artisan disponible"
- Raison : Métier non couvert

**Console logs :**
```
📊 0 artisan(s) trouvé(s) pour electricite
```

### Test 2.5 : Recherche Urgente
**Critères :**
- Métier : Plomberie
- Ville : Paris 75002
- Date : Aujourd'hui ou demain
- Urgence : ⚡ Urgent

**Si artisan dispo aujourd'hui/demain :**
- Bonus urgence : +20 points
- Badge : "🔥 Dispo immédiate"

**Si artisan NON dispo :**
- Bonus urgence : +10 points (neutre)
- Pas de badge spécial

---

## Phase 3 : Tests Edge Cases

### Test 3.1 : Artisan Non Vérifié
**Setup :**
```javascript
artisans/{userId}/verified = false
```

**Résultat attendu :**
- ❌ Artisan EXCLU des résultats (même si tous critères OK)

### Test 3.2 : Artisan Sans Disponibilités
**Setup :**
```javascript
artisans/{userId}/disponibilites = []
```

**Résultat attendu :**
- Score disponibilité : 0 point
- Artisan peut apparaître si dates flexibles activées

### Test 3.3 : Ville Sans Coordonnées GPS
**Setup :**
Ville inventée ou problème API geo.gouv.fr

**Résultat attendu :**
- Fallback : Comparaison par nom de ville exact
- Score distance : 25 points (match ville) ou 0 (pas de match)

### Test 3.4 : Créneaux Mixtes (Récurrent + Ponctuel)
**Setup :**
- Récurrent : Mardi 09:00-17:00 (disponible)
- Ponctuel : 15/01/2026 (NON disponible - occupé)

**Recherche : 15/01/2026 (mardi)**

**Résultat attendu :**
- Créneau ponctuel prioritaire sur récurrent
- Score disponibilité : 0 point (occupé ce jour)

---

## 🔍 Debugging Checklist

### Problème : Artisan N'apparaît Pas

**Étape 1 : Vérifier Firestore**
```javascript
// Collection: artisans/{userId}
verified: true ← DOIT être true
metiers: ["plomberie"] ← DOIT contenir le métier cherché
zonesIntervention: [{
  ville: "Paris",
  rayonKm: 30, ← DOIT être > 0
  latitude: 48.xxx, ← DOIT exister
  longitude: 2.xxx
}]
```

**Étape 2 : Console Logs**
```
🔍 Lancement du matching... ← Requête lancée
📊 X artisan(s) trouvé(s) ← Combien en base ?
⚠️ Hors zone ← Distance > rayon
✅ Score=X ← Artisan matchable
```

**Étape 3 : Vérifier Distance**
- Utiliser : https://www.movable-type.co.uk/scripts/latlong.html
- Vérifier distance réelle entre coordonnées
- Comparer avec rayon artisan

**Étape 4 : Vérifier Disponibilité**
```javascript
// Jour de la semaine correct ?
new Date('2026-01-14').getDay() // 2 = mardi

// Créneau disponible ?
disponibilites.find(s => 
  s.jour === 'mardi' && 
  s.disponible === true
)
```

### Problème : Score Incorrect

**Distance :**
```javascript
// Formule Haversine
0-5 km → 50 points
5-10 km → 40 points
10-20 km → 30 points
...
```

**Disponibilité :**
```javascript
// Taux de match
matchCount = 3 // Jours disponibles
totalDates = 7 // Jours demandés (flexible)
score = (3/7) × 50 = 21.4 → 21 points
```

**Réputation :**
```javascript
notation = 4.5 / 5 × 40 = 36 points
nombreAvis = 12 → bonus = +5 points
total = 41 points
```

---

## 📊 Scénarios de Test Complets

### Scénario A : Client Parisien Urgent

**Contexte :**
- Client : Paris 75011
- Besoin : Plomberie
- Date : Aujourd'hui
- Urgence : Urgent

**Artisans en Base :**
1. **ArtisanPro** (Paris 75001, rayon 50km)
   - Dispo récurrente : Lundi-Vendredi
   - Note : 4.8/5 (40 avis)
   - **Score attendu :** ~265 points

2. **PlombExpress** (Boulogne 92100, rayon 20km)
   - Dispo : Créneau ponctuel aujourd'hui
   - Note : 4.2/5 (8 avis)
   - **Score attendu :** ~235 points

3. **AquaServices** (Versailles 78000, rayon 30km)
   - Dispo : Aucune aujourd'hui
   - Note : 5/5 (100 avis)
   - **Score attendu :** ~180 points (bonus urgence manqué)

**Classement attendu :**
1. ArtisanPro (265)
2. PlombExpress (235)
3. AquaServices (180)

---

## 🎯 Tests Automatisés (À Implémenter)

### Jest / Vitest

```typescript
describe('Matching Service', () => {
  it('doit calculer la distance correctement', () => {
    const distance = calculateDistance(
      48.8566, 2.3522, // Paris
      48.8606, 2.3376  // Tour Eiffel
    );
    expect(distance).toBeCloseTo(1.2, 1);
  });

  it('doit filtrer artisans hors zone', () => {
    const artisan = {
      zonesIntervention: [{
        ville: 'Paris',
        rayonKm: 10,
        latitude: 48.8566,
        longitude: 2.3522
      }]
    };
    const demande = {
      localisation: {
        coordonneesGPS: {
          latitude: 48.9566, // ~11 km
          longitude: 2.3522
        }
      }
    };
    expect(isInZone(artisan, demande)).toBe(false);
  });

  it('doit vérifier disponibilité récurrente', () => {
    const artisan = {
      disponibilites: [{
        jour: 'mardi',
        recurrence: 'hebdomadaire',
        disponible: true
      }]
    };
    const mardi = new Date('2026-01-14'); // mardi
    expect(isArtisanDisponibleDate(artisan, mardi)).toBe(true);
  });
});
```

---

## ✅ Validation Finale

**Avant mise en production :**
- [ ] Test avec 10+ artisans différentes villes
- [ ] Test avec toutes combinaisons métiers (14 métiers)
- [ ] Test dates passées/futures (validation)
- [ ] Test flexibilité 0, 7, 14, 30 jours
- [ ] Test urgences faible/normale/urgent
- [ ] Performance : <2s pour 100 artisans
- [ ] Logs propres (pas d'erreurs console)
- [ ] Index Firestore créés (pas d'erreur 9)

**Métriques de Succès :**
- Précision : 95%+ (artisan pertinent en top 3)
- Temps réponse : <2 secondes
- Taux de conversion : À mesurer post-lancement

---

**Dernière mise à jour :** 5 janvier 2026  
**Version :** 1.0
