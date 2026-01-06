# 🔧 Diagnostic Rapide - Recherche Ne Fonctionne Pas

## Problème : Artisan n'apparaît pas dans les résultats

### ✅ Checklist de Vérification

#### 1. Vérifier dans Firebase Console

**Collection `artisans/{userId}`** :

```javascript
// Champs OBLIGATOIRES pour être trouvé
{
  verified: true,  // ← DOIT être true (pas badgeVerifie)
  metiers: ["renovation", "isolation", "serrurerie"],  // ← Minuscules, tableau
  zonesIntervention: [{
    ville: "Paris",  // ← Première lettre majuscule
    codePostal: "75001",
    rayonKm: 50,  // ← Champ rayonKm (pas rayon)
    latitude: 48.8566,  // ← OBLIGATOIRE pour calcul distance
    longitude: 2.3522   // ← OBLIGATOIRE pour calcul distance
  }],
  disponibilites: [{
    id: "...",
    date: Timestamp(2026-01-08T00:00:00Z),  // ← Pour créneau ponctuel
    heureDebut: "09:00",
    heureFin: "17:00",
    recurrence: "ponctuel",  // ou "hebdomadaire"
    disponible: true,  // ← DOIT être true
    dateCreation: Timestamp(...)
  }]
}
```

#### 2. Console Logs (Navigateur)

Ouvrez la console (F12) et cherchez :

**Étape 1 : Requête Firestore**
```
🔍 Lancement du matching avec critères: {...}
📊 X artisan(s) trouvé(s) pour renovation
```

❌ **Si "0 artisan(s) trouvé(s)"** :
- Vérifier `verified: true` dans Firestore
- Vérifier `metiers` contient "renovation" (minuscule)

**Étape 2 : Analyse Artisan**
```
🔍 Analyse artisan: [Nom]
  - Métiers: ["renovation", "isolation", "serrurerie"]
  - Zones: [{ ville: "Paris", ... }]
  - Disponibilités: 1 créneau(x)
  - Verified: true
```

**Étape 3 : Vérification Zone**
```
🗺️  Vérif zone - Client à: Paris 75001
🔍 Zone artisan: Paris, rayon: 50km
📍 Coords artisan: lat=48.8566, lon=2.3522
📍 Coords client: { latitude: 48.8566, longitude: 2.3522 }
📏 Distance calculée: 0.00km (rayon: 50km)
✅ MATCH GPS: dans le rayon
```

❌ **Si "❌ Pas de zone d'intervention définie"** :
- Aller sur `/artisan/profil`
- Remplir "Ville principale" avec autocomplete
- Sauvegarder → Coordonnées GPS seront ajoutées auto

❌ **Si "⚠️ Coordonnées GPS manquantes"** :
- Réouvrir `/artisan/profil`
- Re-sauvegarder le profil
- Vérifier console : `📍 Coordonnées ajoutées pour Paris`

❌ **Si "❌ Hors rayon"** :
- Distance > Rayon défini
- Augmenter le rayon d'intervention
- Ou vérifier que la ville client est correcte

**Étape 4 : Vérification Disponibilité**
```
📅 Vérif dispo pour 2026-01-08
📆 Jour de la semaine: mercredi (3)
✅ 1 créneau(x) disponible(s) sur 1
🔍 Créneau ponctuel: 2026-01-08 vs 2026-01-08
✅ MATCH ponctuel trouvé !
```

❌ **Si "❌ Pas de disponibilités définies"** :
- Aller sur `/artisan/agenda`
- Créer un créneau pour la date demandée
- Statut : ✅ Disponible (pas occupé)

❌ **Si "❌ Aucun créneau disponible"** :
- Vérifier que `disponible: true` dans Firestore
- Vérifier que la date correspond exactement
- Vérifier le jour de la semaine pour créneaux récurrents

**Étape 5 : Score Final**
```
✅ [Nom Artisan]: score=250 (distance=50, dispo=50, note=0)
🎯 1 artisan(s) matchés (après filtres)
```

### 🐛 Problèmes Fréquents

#### Problème 1 : `verified: false`
**Solution :**
```javascript
// Dans Firebase Console
artisans/{userId}
→ Modifier le champ: verified = true
```

#### Problème 2 : Métier avec mauvaise casse
**Mauvais :**
```javascript
metiers: ["Rénovation", "ISOLATION"]  // ❌ Majuscules
```

**Bon :**
```javascript
metiers: ["renovation", "isolation"]  // ✅ Minuscules
```

**Comment corriger :**
- Utiliser l'interface `/artisan/profil`
- Sélectionner les métiers via les boutons
- Sauvegarder

#### Problème 3 : Coordonnées GPS manquantes
**Symptôme :**
```javascript
zonesIntervention: [{
  ville: "Paris",
  rayonKm: 50,
  // latitude: manquant
  // longitude: manquant
}]
```

**Solution :**
1. Aller sur `http://localhost:3000/artisan/profil`
2. Saisir "Paris" dans le champ "Ville principale"
3. Sélectionner "Paris 75001" dans l'autocomplete
4. Cliquer "Sauvegarder le profil"
5. Vérifier console : `📍 Coordonnées ajoutées pour Paris: 48.8566, 2.3522`
6. Vérifier Firestore : champs `latitude` et `longitude` présents

#### Problème 4 : Format de date incorrect
**Mauvais :**
```javascript
disponibilites: [{
  date: "2026-01-08",  // ❌ String
  ...
}]
```

**Bon :**
```javascript
disponibilites: [{
  date: Timestamp,  // ✅ Firebase Timestamp
  ...
}]
```

**Solution :**
- Créer les créneaux via l'interface `/artisan/agenda`
- Ne PAS modifier manuellement dans Firestore

#### Problème 5 : Créneau marqué "occupé"
```javascript
disponibilites: [{
  ...
  disponible: false,  // ❌ Occupé = pas trouvé
}]
```

**Solution :**
- Aller sur `/artisan/agenda`
- Modifier le créneau
- Basculer sur "✅ Disponible"

### 📋 Script de Test Firestore

Exécutez dans la console Firebase :

```javascript
// Vérifier un artisan
const userId = "VOTRE_USER_ID";
const artisanRef = db.collection('artisans').doc(userId);

artisanRef.get().then(doc => {
  const data = doc.data();
  
  console.log('✅ Vérifications:');
  console.log('1. Verified:', data.verified);
  console.log('2. Métiers:', data.metiers);
  console.log('3. Zones:', data.zonesIntervention);
  console.log('4. GPS zone 0:', {
    lat: data.zonesIntervention?.[0]?.latitude,
    lon: data.zonesIntervention?.[0]?.longitude
  });
  console.log('5. Disponibilités:', data.disponibilites?.length);
  console.log('6. Première dispo:', data.disponibilites?.[0]);
});
```

### 🔍 Test Manuel Complet

1. **Préparer l'artisan** :
```bash
# Firestore Console
artisans/{userId}:
  verified: true
  metiers: ["renovation"]
  zonesIntervention: [{
    ville: "Paris",
    codePostal: "75001",
    rayonKm: 50,
    latitude: 48.8566,
    longitude: 2.3522
  }]
  disponibilites: [{
    id: "test_001",
    date: Timestamp(2026-01-08),
    heureDebut: "09:00",
    heureFin: "17:00",
    recurrence: "ponctuel",
    disponible: true
  }]
```

2. **Rechercher** :
```
http://localhost:3000/recherche
- Type de travaux : Rénovation
- Ville : Paris
- Code postal : 75001 (auto-fill)
- Date : 08/01/2026
- Flexibilité : Non
→ Rechercher
```

3. **Vérifier console** :
```
✅ Doit afficher:
📊 1 artisan(s) trouvé(s) pour renovation
✅ MATCH ville exacte: Paris
✅ MATCH ponctuel trouvé !
✅ [Nom]: score=XXX
```

### 📞 Support

Si le problème persiste après toutes ces vérifications :

1. **Copier tous les logs console** (Ctrl+A dans Console, Ctrl+C)
2. **Exporter l'artisan de Firestore** (JSON)
3. **Screenshot de la page de recherche**
4. **Partager pour diagnostic approfondi**

---

**Dernière mise à jour :** 5 janvier 2026  
**Version :** 1.1 (avec logs détaillés)
