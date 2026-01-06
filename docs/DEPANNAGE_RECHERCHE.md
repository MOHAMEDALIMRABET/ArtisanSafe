# 🔧 Guide de Dépannage - Recherche d'Artisans

## Symptôme : "Aucun artisan disponible" alors qu'il devrait y en avoir

### 🚀 Démarrage Rapide

1. **Ouvrir la console navigateur** (F12)
2. **Aller sur la page de recherche** : `http://localhost:3000/recherche`
3. **Effectuer une recherche**
4. **Lire les logs** dans la console

### 📋 Logs à Surveiller

#### ✅ Logs Normaux (Artisan Trouvé)

```
🔍 Lancement du matching avec critères: {categorie: "renovation", ...}
📊 1 artisan(s) trouvé(s) pour renovation

🔍 Analyse artisan: Ma Société SARL
  - Métiers: ["renovation", "isolation", "serrurerie"]
  - Zones: [{ ville: "Paris", ... }]
  - Disponibilités: 1 créneau(x)
  - Verified: true

🗺️  Vérif zone - Client à: Paris 75001
🔍 Zone artisan: Paris, rayon: 50km
📍 Coords artisan: lat=48.8566, lon=2.3522
📍 Coords client: { latitude: 48.8566, longitude: 2.3522 }
📏 Distance calculée: 0.00km (rayon: 50km)
✅ MATCH GPS: dans le rayon
✅ Ma Société SARL: dans la zone

📅 Vérif dispo pour 2026-01-08
📆 Jour de la semaine: mercredi (3)
✅ 1 créneau(x) disponible(s) sur 1
🔍 Créneau ponctuel: 2026-01-08 vs 2026-01-08
✅ MATCH ponctuel trouvé !

✅ Ma Société SARL: score=250 (distance=50, dispo=50, note=0)
🎯 1 artisan(s) matchés (après filtres)
```

#### ❌ Problème 1 : Artisan Non Trouvé dans Firestore

```
🔍 Lancement du matching...
📊 0 artisan(s) trouvé(s) pour renovation
```

**Cause possible :**
- `verified` n'est pas à `true`
- Métier "renovation" pas dans le tableau `metiers`
- Métier avec mauvaise casse (ex: "Rénovation" au lieu de "renovation")

**Solution :**
1. Firebase Console → `artisans/{userId}`
2. Vérifier/modifier :
   ```json
   {
     "verified": true,
     "metiers": ["renovation", "isolation", "serrurerie"]
   }
   ```

#### ❌ Problème 2 : Hors Zone

```
📊 1 artisan(s) trouvé(s) pour renovation

🔍 Analyse artisan: Ma Société SARL
  - Métiers: ["renovation"]
  - Zones: [{ ville: "Paris", ... }]
  - Verified: true

🗺️  Vérif zone - Client à: Lyon 69001
🔍 Zone artisan: Paris, rayon: 50km
⚠️  Coordonnées GPS manquantes
❌ Aucune zone ne correspond
❌ Ma Société SARL: HORS ZONE
```

**Cause possible :**
- Coordonnées GPS manquantes dans `zonesIntervention`
- Distance > Rayon d'intervention
- Ville client différente de ville artisan (sans GPS)

**Solution :**
1. Aller sur `http://localhost:3000/artisan/profil`
2. Re-saisir "Ville principale" avec autocomplete
3. Sauvegarder → GPS ajoutées automatiquement
4. Vérifier console : `📍 Coordonnées ajoutées pour Paris: ...`

#### ❌ Problème 3 : Pas Disponible

```
✅ Ma Société SARL: dans la zone

📅 Vérif dispo pour 2026-01-08
📆 Jour de la semaine: mercredi (3)
❌ Pas de disponibilités définies
Score disponibilité: 0 points
```

**Cause possible :**
- Aucun créneau dans l'agenda
- Tous les créneaux marqués "Occupé" (`disponible: false`)
- Date ne correspond à aucun créneau

**Solution :**
1. Aller sur `http://localhost:3000/artisan/agenda`
2. Créer créneau pour 8 janvier 2026
3. Statut : ✅ **Disponible** (pas Occupé)
4. Ou créer créneau récurrent (ex: tous les mercredis)

### 🛠️ Outils de Diagnostic

#### 1. Logs Navigateur (Le Plus Simple)

```bash
1. F12 → Console
2. Effectuer recherche
3. Lire les logs colorés
4. Copier/coller les logs pour partager
```

#### 2. Script de Vérification Firestore

```javascript
// Dans Firebase Console → Firestore → Query
const userId = "VOTRE_USER_ID";

// Copier le userId depuis artisans collection
// Puis vérifier les champs un par un
```

#### 3. Vérification Manuelle Firestore

**Checklist complète :**

```json
artisans/{userId}:
{
  // ✅ 1. Vérification
  "verified": true,  // ← OBLIGATOIRE
  
  // ✅ 2. Métiers (minuscules)
  "metiers": ["renovation", "isolation"],
  
  // ✅ 3. Zone avec GPS
  "zonesIntervention": [{
    "ville": "Paris",
    "codePostal": "75001",
    "rayonKm": 50,
    "latitude": 48.8566,  // ← OBLIGATOIRE
    "longitude": 2.3522   // ← OBLIGATOIRE
  }],
  
  // ✅ 4. Disponibilités
  "disponibilites": [{
    "id": "...",
    "date": Timestamp(2026-01-08),  // Firebase Timestamp
    "heureDebut": "09:00",
    "heureFin": "17:00",
    "recurrence": "ponctuel",
    "disponible": true,  // ← DOIT être true
    "dateCreation": Timestamp(...)
  }]
}
```

### 📖 Documentation Complète

- **[DIAGNOSTIC_RECHERCHE.md](./DIAGNOSTIC_RECHERCHE.md)** - Diagnostic détaillé avec tous les cas d'erreur
- **[TEST_RECHERCHE.md](./TEST_RECHERCHE.md)** - Guide de test pas à pas
- **[RECHERCHE_INTELLIGENTE.md](./RECHERCHE_INTELLIGENTE.md)** - Documentation technique

### 🆘 Besoin d'Aide ?

Si après toutes ces vérifications, le problème persiste :

**Informations à fournir :**

1. **Logs console complets** (Ctrl+A dans Console, Ctrl+C)
2. **Screenshot Firestore** de l'artisan concerné
3. **Critères de recherche exacts** :
   ```
   - Type de travaux : ?
   - Ville : ?
   - Code postal : ?
   - Date : ?
   - Flexibilité : ?
   ```
4. **URL de la page de recherche**

### 🔍 Tests Rapides

#### Test 1 : Vérifier Artisan Existe
```
Firebase Console → artisans
→ Rechercher par email artisan
→ Vérifier que le document existe
→ Noter le userId
```

#### Test 2 : Vérifier Verified
```
artisans/{userId}
→ Champ "verified" = true ?
→ Si false : modifier → true
```

#### Test 3 : Vérifier GPS
```
artisans/{userId}/zonesIntervention/0
→ Champs latitude et longitude existent ?
→ Si manquants : aller sur /artisan/profil et sauvegarder
```

#### Test 4 : Vérifier Disponibilités
```
artisans/{userId}/disponibilites
→ Au moins 1 créneau ?
→ Au moins 1 avec disponible=true ?
→ Date correspond ?
```

### ✨ Astuces

- **Dates flexibles** : Activer pour voir plus d'artisans
- **Rayon large** : Tester avec 100 km pour voir si c'est un problème de distance
- **Console toujours ouverte** : F12 avant de rechercher
- **Recharger la page** : Ctrl+F5 pour vider le cache

---

**Dernière mise à jour :** 5 janvier 2026  
**Version :** 1.1 (avec logs ultra-détaillés)
