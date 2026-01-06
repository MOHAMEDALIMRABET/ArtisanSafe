# Guide Rapide : Nettoyage du Cache (Boucle Infinie)

## 🎯 Vous avez ce problème ?

```
❌ Failed to execute 'deleteDatabase' on 'IDBFactory': access denied
❌ Failed to obtain primary lease for action 'Collect garbage'
❌ Page qui tourne en boucle
```

## ✅ Solution EN 3 CLICS

### Méthode 1 : DevTools (PLUS RAPIDE)

#### Chrome / Edge

1. **F12** (ouvrir DevTools)
2. Onglet **"Application"** (en haut)
3. Menu gauche → **"Storage"**
4. Bouton **"Clear site data"** (en haut à droite)
5. Cocher **tout** → **"Clear site data"**
6. **Ctrl+Shift+R** (rafraîchir)

```
F12 → Application → Storage → Clear site data → Ctrl+Shift+R
```

#### Firefox

1. **F12** (ouvrir DevTools)
2. Onglet **"Stockage"**
3. Clic droit sur **"IndexedDB"** → **"Tout supprimer"**
4. **Ctrl+Shift+R** (rafraîchir)

```
F12 → Stockage → Clic droit IndexedDB → Tout supprimer → Ctrl+Shift+R
```

---

### Méthode 2 : Nettoyage complet

#### Chrome / Edge

1. **Ctrl+Shift+Delete** (ouvrir les paramètres)
2. Période : **"Depuis toujours"**
3. Cocher :
   - ✅ Cookies et autres données de sites
   - ✅ Images et fichiers en cache
4. **"Effacer les données"**
5. **Redémarrer le navigateur**

```
Ctrl+Shift+Delete → Depuis toujours → Cookies + Cache → Effacer
```

#### Firefox

1. **Ctrl+Shift+Delete**
2. Période : **"Tout"**
3. Cocher :
   - ✅ Cookies
   - ✅ Cache
4. **"Effacer maintenant"**
5. **Redémarrer le navigateur**

---

### Méthode 3 : Mode sans cache (TEMPORAIRE)

**Si rien ne fonctionne **, la persistence Firestore a été désactivée automatiquement.

**Vérifier :**
1. Ouvrez http://localhost:3000
2. Ouvrez la console (F12)
3. Vous devriez voir : `🔴 Firestore persistence DÉSACTIVÉE (mode debug)`

**Avantages :**
- ✅ Pas de problème de cache
- ✅ Fonctionne immédiatement

**Inconvénients :**
- ❌ Pas de mode hors ligne
- ❌ Données rechargées à chaque fois

**Réactiver la persistence après nettoyage :**

Éditez [frontend/src/lib/firebase.ts](../frontend/src/lib/firebase.ts) :

```typescript
const DISABLE_PERSISTENCE = false; // ← Remettre à false
```

Puis redémarrez :
```bash
cd frontend
npm run dev
```

---

## 🚫 Erreurs courantes

### ❌ "access to the Indexed Database API is denied"

**Causes possibles :**
1. Vous êtes en **mode navigation privée** → Ouvrez un onglet normal
2. Les **cookies sont désactivés** → chrome://settings/content/cookies → Autoriser
3. Une **extension bloque** → Désactivez temporairement vos extensions

### ❌ "Failed to obtain primary lease"

**Cause :** Plusieurs onglets ouverts sur localhost:3000

**Solution :**
1. Fermez **tous** les onglets sauf un
2. Nettoyez le cache (Méthode 1 ci-dessus)
3. Rafraîchissez

---

## ✅ Validation

Après le nettoyage, vérifiez :

1. ✅ Console sans erreur "primary lease"
2. ✅ Page charge en <2 secondes
3. ✅ Clic sur "Vérification Profil" fonctionne
4. ✅ Pas de boucle infinie

---

## 🆘 Si ça ne marche toujours pas

1. **Redémarrez les serveurs** :
   ```bash
   # Terminal 1
   cd frontend
   npm run dev
   
   # Terminal 2
   cd backend
   npm run dev
   ```

2. **Redémarrez le navigateur complètement**

3. **Consultez** : [DEPANNAGE_BOUCLE_INFINIE.md](./DEPANNAGE_BOUCLE_INFINIE.md)

---

## 📝 Résumé en 10 secondes

```bash
# Chrome/Edge
F12 → Application → Storage → Clear site data → Ctrl+Shift+R

# Firefox
F12 → Stockage → Clic droit IndexedDB → Tout supprimer → Ctrl+Shift+R
```

**OU**

```bash
Ctrl+Shift+Delete → Depuis toujours → Cookies + Cache → Effacer → Redémarrer navigateur
```

**OU**

```
Mode sans cache activé automatiquement → Fonctionne directement
```
