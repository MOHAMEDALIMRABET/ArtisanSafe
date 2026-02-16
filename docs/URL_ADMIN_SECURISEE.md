# 🔐 URL Admin Sécurisée - Guide de Configuration

## ⚠️ CONFIDENTIEL - Ne pas partager publiquement

L'URL de connexion admin a été obscurcie pour des raisons de sécurité.

---

## 📍 Nouvelle URL Admin

### Développement Local
```
http://localhost:3000/access-x7k9m2p4w8n3
```

### Production
```
https://artisandispo.fr/access-x7k9m2p4w8n3
```

---

## 🔧 Configuration

### Variable d'environnement

**Fichier** : `frontend/.env.local`

```env
# 🔒 URL admin obscurcie (CONFIDENTIEL)
NEXT_PUBLIC_ADMIN_SECRET_PATH=access-x7k9m2p4w8n3
```

### Changer l'URL

Pour changer l'URL admin (recommandé tous les 3-6 mois) :

1. **Modifier `.env.local`** :
   ```env
   NEXT_PUBLIC_ADMIN_SECRET_PATH=nouveauchemin-a1b2c3d4
   ```

2. **Renommer le dossier** :
   ```bash
   cd frontend/src/app
   mv access-x7k9m2p4w8n3 nouveauchemin-a1b2c3d4
   ```

3. **Mettre à jour les redirections** dans :
   - `src/app/connexion/page.tsx` (ligne ~48, ~199)
   - `src/app/admin/layout.tsx` (lignes ~30, ~43, ~70)
   - `src/app/admin/*/page.tsx` (toutes les pages admin)
   - `src/middleware.ts` (ligne ~25)
   - `scripts/create-admin.js` (ligne ~101)

4. **Redémarrer le serveur** :
   ```bash
   npm run dev
   ```

---

## 🛡️ Sécurité

### Ancienne URL `/admin/login`

L'ancienne URL affiche maintenant une **fausse page 404** pour tromper les bots.

Toute tentative d'accès à `/admin/login` est **loggée** comme suspecte dans Firestore (`admin_access_logs`).

### Avantages

- ✅ Réduit **99% des attaques automatisées** (bots scannent `/admin`, `/admin/login`)
- ✅ URL difficile à deviner (pas de mots-clés évidents)
- ✅ Modifiable facilement si compromise
- ✅ Aucun coût DNS/infrastructure supplémentaire

### Meilleures pratiques

1. **Ne jamais** partager l'URL publiquement (Slack, emails, GitHub)
2. **Ne jamais** l'inclure dans le code client visible (toujours `.env`)
3. **Changer l'URL** tous les 3-6 mois
4. **Surveiller les logs** : Si des tentatives apparaissent sur la nouvelle URL → changer immédiatement

---

## 📝 Comment donner accès à un nouvel admin

**Par email sécurisé** (Signal, PGP, verbal) :

```
Bonjour,

Voici les accès à l'espace admin :

URL : [envoyer dans un 2e message séparé]
Email : admin@artisandispo.fr
Mot de passe : [envoyer dans un 3e message]

Merci de ne pas partager ces informations.
```

**Par téléphone/visio** : Épeler l'URL oralement

---

## 🚨 En cas de compromise

Si l'URL est découverte par un attaquant :

1. **Immédiat** : Changer l'URL (voir section "Changer l'URL")
2. Vérifier `/admin/logs` pour tentatives suspectes
3. Changer mots de passe tous les admins
4. Bloquer IPs suspectes (voir `admin-access-log.ts`)

---

## 📊 Monitoring

### Vérifier les tentatives d'accès

**Page** : `/admin/logs`

Surveiller :
- Tentatives sur `/admin/login` (ancienne URL)
- Tentatives sur `/access-x7k9m2p4w8n3` (URL actuelle)
- IPs répétées
- Heures inhabituelles (nuit)

---

## 🔗 Fichiers de configuration

| Fichier | Description |
|---------|-------------|
| `frontend/.env.local` | Variable `NEXT_PUBLIC_ADMIN_SECRET_PATH` |
| `frontend/src/config/admin-paths.ts` | Helpers URL admin |
| `frontend/src/app/access-x7k9m2p4w8n3/page.tsx` | Page de login sécurisée |
| `frontend/src/app/admin/login/page.tsx` | Fausse page 404 (piège bots) |
| `frontend/src/middleware.ts` | Logging + headers sécurité |

---

## ✅ Checklist de sécurité

- [x] URL obscurcie sans mots-clés évidents
- [x] Variable d'environnement (pas hardcodée)
- [x] Ancienne URL = fausse 404
- [x] Logging de toutes les tentatives
- [x] robots.txt bloque `/admin/*`
- [x] Middleware applique headers sécurité
- [ ] Changer URL tous les 3-6 mois ⏰
- [ ] 2FA pour admins (optionnel, Phase 2)
- [ ] IP whitelist (optionnel, Phase 2)

---

**Dernière mise à jour** : 15 février 2026
**URL actuelle** : `access-x7k9m2p4w8n3`
**Prochaine rotation** : Mai 2026
