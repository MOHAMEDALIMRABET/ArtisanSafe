# Guide de Dépannage Rapide - Boucle Infinie Vérification

## 🚨 Symptômes

- La console affiche en boucle : `Failed to obtain primary lease for action 'Collect garbage'`
- Utilisation CPU élevée
- Page qui ne finit jamais de charger
- Requêtes Firestore répétées

## ✅ Solutions immédiates

### 1. Nettoyage du cache navigateur (PRIORITÉ 1)

⚠️ **Si vous obtenez l'erreur :** `Failed to execute 'deleteDatabase' on 'IDBFactory': access to the Indexed Database API is denied`

**Cause :** Vous êtes en mode navigation privée OU le stockage est désactivé.

**Solution rapide - Via DevTools (RECOMMANDÉ) :**

**Chrome/Edge :**
```
1. F12 → Onglet "Application"
2. Dans le menu gauche : "Storage"
3. Bouton "Clear site data" (en haut à droite)
4. Cocher TOUT → "Clear site data"
5. Ctrl+Shift+R pour rafraîchir
```

**Firefox :**
```
1. F12 → Onglet "Stockage"
2. Clic droit sur "IndexedDB" → "Tout supprimer"
3. Ctrl+Shift+R pour rafraîchir
```

**Alternative - Nettoyage complet du navigateur :**

**Chrome/Edge :**
```
1. chrome://settings/clearBrowserData (ou Ctrl+Shift+Delete)
2. Période : "Depuis toujours"
3. Cocher : Cookies + Cache
4. Effacer les données
5. Redémarrer le navigateur
```

**Si vous êtes en mode navigation privée :**
1. Fermez l'onglet privé
2. Ouvrez un **onglet normal**
3. Allez sur http://localhost:3000

**Via console (si ça fonctionne) :**
```javascript
// Copier-coller dans la console
indexedDB.deleteDatabase('firestore/[main]/artisansafe-c7b7f/main');
location.reload();
```

### 2. Vérifier que les corrections sont appliquées

```bash
# Depuis le répertoire racine
bash test-fix-boucle.sh
```

### 3. Redémarrer le serveur de développement

```bash
# Terminal 1 - Frontend
cd frontend
npm run dev

# Terminal 2 - Backend
cd backend
npm run dev
```

### 4. Fermer tous les onglets sauf un

Le mode `persistentSingleTabManager()` ne fonctionne qu'avec **un seul onglet** à la fois.

**Si vous avez besoin de plusieurs onglets :**
- Ouvrir un onglet en **mode navigation privée** pour tester
- OU désactiver temporairement la persistence Firestore (voir ci-dessous)

---

## 🔧 Dépannage avancé

### Désactiver temporairement la persistence Firestore

Si le problème persiste, désactivez temporairement la persistence :

**Dans `frontend/src/lib/firebase.ts` :**

```typescript
// Configuration SANS persistence (temporaire)
let db: ReturnType<typeof getFirestore>;
db = getFirestore(app); // ✅ Pas de cache = pas de conflit

export { db };
```

**Avantages :**
- ✅ Élimine tous les conflits de cache
- ✅ Comportement prévisible

**Inconvénients :**
- ❌ Pas de mode hors ligne
- ❌ Requêtes réseau à chaque chargement

**Quand réactiver :**
Une fois le problème identifié, réactivez avec `persistentSingleTabManager()`.

---

### Logs de débogage détaillés

Ajoutez ces logs dans `frontend/src/app/artisan/verification/page.tsx` :

```typescript
const loadArtisan = async () => {
  console.log('🔵 [DEBUG] loadArtisan() - DÉBUT');
  
  try {
    const user = authService.getCurrentUser();
    console.log('🔵 [DEBUG] User:', user?.uid);
    
    // ... reste du code ...
    
    const artisanData = await getArtisanByUserId(user.uid);
    console.log('🔵 [DEBUG] Artisan chargé:', artisanData?.userId);
    
  } finally {
    console.log('🔵 [DEBUG] loadArtisan() - FIN');
  }
};
```

**Console attendue (normal) :**
```
🔵 [DEBUG] loadArtisan() - DÉBUT
🔵 [DEBUG] User: abc123...
🔵 [DEBUG] Artisan chargé: abc123...
🔵 [DEBUG] loadArtisan() - FIN
```

**Console problématique (boucle) :**
```
🔵 [DEBUG] loadArtisan() - DÉBUT
🔵 [DEBUG] loadArtisan() - DÉBUT  ← Doublon sans FIN
🔵 [DEBUG] loadArtisan() - DÉBUT
...
```

---

### Vérifier le mode React Strict

Le mode Strict de React **double les appels** à `useEffect()` en développement.

**Vérifier dans `frontend/src/app/layout.tsx` :**

```tsx
// Si vous voyez ça, c'est normal de voir 2 appels en dev
<React.StrictMode>
  {children}
</React.StrictMode>
```

**Pour désactiver temporairement (DEBUG SEULEMENT) :**

```tsx
// ❌ TEMPORAIRE - NE PAS commiter
{children}
```

**⚠️ IMPORTANT :** Toujours réactiver Strict Mode avant de push !

---

### Vérifier les requêtes Firestore dans DevTools

**Chrome DevTools → Network :**

1. Filtrer par `firestore`
2. Cliquer sur "Vérification Profil"
3. **Attendu :** 1-2 requêtes max
4. **Problème :** 10+ requêtes qui continuent

**Screenshot attendu :**
```
GET firestore.googleapis.com/...  [1 requête]
✅ Status 200
```

**Screenshot problématique :**
```
GET firestore.googleapis.com/...  [Pending]
GET firestore.googleapis.com/...  [Pending]
GET firestore.googleapis.com/...  [Pending]
... (boucle infinie)
```

---

## 📊 Checklist de validation

Cochez chaque étape :

- [ ] Cache navigateur nettoyé
- [ ] Un seul onglet ouvert sur localhost:3000
- [ ] Serveur dev redémarré
- [ ] `test-fix-boucle.sh` passe tous les tests
- [ ] Console sans erreur "primary lease"
- [ ] Network tab : 1-2 requêtes Firestore max
- [ ] Page charge en <2 secondes

---

## 🆘 Si rien ne fonctionne

1. **Sauvegarder vos changements locaux**
   ```bash
   git stash
   ```

2. **Récupérer la version corrigée**
   ```bash
   git pull origin main
   cd frontend && npm install
   cd ../backend && npm install
   ```

3. **Réappliquer vos changements**
   ```bash
   git stash pop
   ```

4. **Supprimer complètement node_modules**
   ```bash
   cd frontend
   rm -rf node_modules .next
   npm install
   npm run dev
   ```

5. **Vider TOUT le cache navigateur**
   - Chrome : chrome://settings/clearBrowserData
   - Cocher : Cookies, Cache, Données site
   - Période : Depuis toujours

---

## 📞 Support

Si le problème persiste, ouvrir une issue GitHub avec :

1. **Console logs** (copier-coller complet)
2. **Network tab** (screenshot)
3. **Résultat de `test-fix-boucle.sh`**
4. **Version de Node.js** : `node --version`
5. **Version de npm** : `npm --version`
6. **Navigateur utilisé** : Chrome/Firefox/Edge + version

---

## 📚 Références

- [Fix détaillé](./FIX_BOUCLE_INFINIE_VERIFICATION.md)
- [Configuration Firebase](../frontend/src/lib/firebase.ts)
- [Page de vérification](../frontend/src/app/artisan/verification/page.tsx)
- [Dashboard artisan](../frontend/src/app/artisan/dashboard/page.tsx)
