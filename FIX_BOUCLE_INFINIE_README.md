# Fix Appliqué : Boucle Infinie Vérification Profil

## 🎯 Problème résolu

Boucle infinie avec erreur Firestore lors du clic sur "Vérification Profil" depuis le dashboard artisan.

```
Failed to obtain primary lease for action 'Collect garbage'
```

## ✅ Corrections appliquées

### 1. Configuration Firestore stable
- ✅ `persistentMultipleTabManager()` → `persistentSingleTabManager()`
- ✅ Élimine les conflits de "primary lease"

### 2. Désactivation du prefetch Next.js
- ✅ `prefetch={true}` → `prefetch={false}`
- ✅ Évite les requêtes Firestore prématurées

### 3. Protection contre double chargement
- ✅ Ajout de `useRef()` pour éviter les appels multiples
- ✅ Gestion du React Strict Mode

### 4. Mise à jour locale sans rechargement
- ✅ `setArtisan()` local au lieu de `loadArtisan()`
- ✅ Pas de requête Firestore supplémentaire

## 📁 Fichiers modifiés

1. ✅ [frontend/src/lib/firebase.ts](frontend/src/lib/firebase.ts)
2. ✅ [frontend/src/app/artisan/dashboard/page.tsx](frontend/src/app/artisan/dashboard/page.tsx)
3. ✅ [frontend/src/app/artisan/verification/page.tsx](frontend/src/app/artisan/verification/page.tsx)

## 🧪 Test

```bash
# Validation automatique
bash test-fix-boucle.sh

# Test manuel
1. Ouvrir http://localhost:3000/artisan/dashboard
2. Cliquer sur "Vérification Profil"
3. Vérifier : pas d'erreur dans la console
4. Vérifier : 1-2 requêtes Firestore max
```

## 📚 Documentation

- [Fix détaillé](docs/FIX_BOUCLE_INFINIE_VERIFICATION.md) - Explications techniques complètes
- [Guide de dépannage](docs/DEPANNAGE_BOUCLE_INFINIE.md) - Solutions rapides

## ⚠️ Actions requises

### Avant de tester :

**Option 1 : Nettoyage via DevTools (RECOMMANDÉ)**
```
Chrome/Edge : F12 → Application → Storage → Clear site data → Ctrl+Shift+R
Firefox     : F12 → Stockage → Clic droit IndexedDB → Tout supprimer → Ctrl+Shift+R
```

**Option 2 : Nettoyage complet navigateur**
```
Ctrl+Shift+Delete → Depuis toujours → Cookies + Cache → Effacer → Redémarrer
```

**Option 3 : Mode sans cache (ACTIF PAR DÉFAUT)**
- ✅ La persistence Firestore est **temporairement désactivée**
- ✅ Vous pouvez tester **immédiatement** sans nettoyer le cache
- ✅ Regardez la console : `🔴 Firestore persistence DÉSACTIVÉE (mode debug)`

**Puis :**
1. **Redémarrer le serveur dev** (déjà fait si vous voyez le message ci-dessus)
2. **Fermer tous les onglets** sauf un sur localhost:3000

### ⚠️ Si vous obtenez l'erreur `access to the Indexed Database API is denied`

**Causes :**
- Vous êtes en **mode navigation privée** → Ouvrez un onglet normal
- Les **cookies sont désactivés** → Vérifiez chrome://settings/content/cookies

**Solution :** Voir [Guide de nettoyage rapide](docs/NETTOYAGE_CACHE_RAPIDE.md)

### Si ça ne marche pas :
Consulter [DEPANNAGE_BOUCLE_INFINIE.md](docs/DEPANNAGE_BOUCLE_INFINIE.md)

## 🔍 Validation

- [x] Corrections appliquées
- [x] Aucune erreur TypeScript
- [ ] Tests manuels réussis (à faire par l'utilisateur)
- [ ] Cache navigateur nettoyé
- [ ] Serveur redémarré

---

**Date :** 2026-01-06  
**Issue :** Boucle infinie page vérification  
**Statut :** ✅ Corrections appliquées - En attente de validation utilisateur
