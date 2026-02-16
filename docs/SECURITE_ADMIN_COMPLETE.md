# 🔒 SÉCURITÉ ESPACE ADMIN - Guide Complet

## Vue d'ensemble

Ce document détaille les **5 niveaux de protection** mis en place pour sécuriser l'accès à l'espace administrateur d'ArtisanSafe.

---

## 🛡️ Niveau 1 : Middleware Next.js

**Fichier** : `frontend/src/middleware.ts`

### Fonctionnalités

1. **Logging automatique** de toutes les tentatives d'accès à `/admin/login`
   - IP source
   - User-Agent
   - Timestamp

2. **Headers de sécurité renforcés** pour toutes les pages `/admin/*`
   - `Cache-Control: no-store` (pas de cache)
   - `X-Frame-Options: DENY` (protection clickjacking)
   - `X-Content-Type-Options: nosniff` (protection MIME sniffing)
   - `X-XSS-Protection: 1` (protection XSS)

### Utilisation

Le middleware s'exécute **automatiquement** sur toutes les routes `/admin/*`. Aucune configuration requise.

---

## 🚫 Niveau 2 : Blocage indexation Google

**Fichier** : `frontend/public/robots.txt`

### Règles appliquées

```
Disallow: /admin/
Disallow: /admin/*
Disallow: /connexion
Disallow: /inscription
Disallow: /api/
```

### Objectif

- Empêcher Google d'indexer les pages admin
- Rendre l'interface admin **invisible** dans les résultats de recherche
- Réduire la surface d'attaque

### Vérification

Après déploiement, vérifier dans Google Search Console que `/admin/*` n'est pas indexé.

---

## 📝 Niveau 3 : Logging des accès

**Fichier** : `frontend/src/lib/firebase/admin-access-log.ts`

### Collections Firestore

#### `admin_access_logs`

Enregistre chaque tentative d'accès admin :

```typescript
{
  timestamp: Timestamp,
  adminId?: string,
  adminEmail: string,
  action: 'login_attempt' | 'login_success' | 'login_failed' | 'unauthorized_access',
  ipAddress: string,
  userAgent: string,
  details?: string
}
```

#### `blocked_ips`

IPs bloquées temporairement :

```typescript
{
  ipAddress: string,
  reason: string,
  blockedAt: Timestamp,
  expiresAt: Timestamp
}
```

### Fonctions disponibles

```typescript
// Logger un accès
await logAdminAccess({
  action: 'login_success',
  adminEmail: 'admin@example.com',
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0...'
});

// Détecter brute force (5+ tentatives en 10 min)
const isBruteForce = await detectBruteForce('192.168.1.1');

// Bloquer une IP (30 min par défaut)
await blockIP('192.168.1.1', 'Trop de tentatives', 30);

// Vérifier si IP bloquée
const blocked = await isIPBlocked('192.168.1.1');
```

---

## 🔐 Niveau 4 : Multi-vérifications

### A. Page de connexion (`/connexion`)

**Fichier** : `frontend/src/app/connexion/page.tsx`

**Protection** : Bloquer les admins

```typescript
if (userData?.role === 'admin') {
  await authService.signOut();
  setError('Les administrateurs doivent se connecter via l\'interface dédiée.');
  setTimeout(() => router.push('/admin/login'), 2000);
  return;
}
```

### B. Page admin login (`/admin/login`)

**Fichier** : `frontend/src/app/admin/login/page.tsx`

**Protections** :

1. **Vérification IP bloquée** (avant tentative)
2. **Détection brute force** (5 tentatives = blocage 30 min)
3. **Logging de toutes les tentatives** (succès/échec/non autorisé)
4. **Vérification rôle admin** (après connexion Firebase)
5. **Déconnexion immédiate** si non-admin

### C. Layout admin (`/admin/layout.tsx`)

**Fichier** : `frontend/src/app/admin/layout.tsx`

**Protection finale** :

```typescript
const adminStatus = await isAdmin(user.uid);
if (!adminStatus) {
  await authService.signOut();
  router.push('/connexion');
  return;
}
```

**Double vérification** : même si quelqu'un contourne `/admin/login`, le layout le bloquera.

---

## 📊 Niveau 5 : Monitoring & Alertes

### Page de visualisation

**Route** : `/admin/logs`

**Fichier** : `frontend/src/app/admin/logs/page.tsx`

### Fonctionnalités

- **Tableau complet** de tous les logs d'accès
- **Filtres** : Tout / Succès / Échecs / Non autorisés
- **Statistiques** : Total tentatives, succès, échecs, accès refusés
- **Détails** : IP, User-Agent, timestamp, email

### Cas d'usage

1. **Détecter attaques** : Repérer pics d'échecs
2. **Audit de sécurité** : Qui s'est connecté quand
3. **Enquête** : Tracer une tentative suspecte
4. **Conformité** : Logs pour audits RGPD

---

## 📋 Checklist de sécurité

### ✅ Implémenté

- [x] Middleware avec headers sécurisés
- [x] Logging de toutes les tentatives
- [x] Détection brute force (5 tentatives)
- [x] Blocage IP temporaire (30 min)
- [x] Double vérification rôle (login + layout)
- [x] Déconnexion automatique si non-admin
- [x] Blocage admin sur `/connexion`
- [x] Page de visualisation logs
- [x] robots.txt (pas d'indexation)

### ⏳ À implémenter (Optionnel)

- [ ] **2FA obligatoire** pour admins (Google Authenticator)
- [ ] **IP whitelist** (seules certaines IPs autorisées)
- [ ] **Notification email** à chaque connexion admin
- [ ] **Session courte** (1h au lieu de 24h)
- [ ] **CAPTCHA** sur `/admin/login` (après 3 échecs)
- [ ] **Sous-domaine** : `admin.artisandispo.fr`
- [ ] **Alerte Slack/Discord** en cas de tentative suspecte
- [ ] **Récupération IP réelle** (API ipify.org)

---

## 🚨 Que faire en cas d'incident ?

### Tentative de brute force détectée

1. Vérifier `/admin/logs` pour voir l'IP
2. Si récurrent : bloquer manuellement l'IP dans `blocked_ips`
3. Ajouter règle Firewall (Cloudflare/Firebase Hosting)

### Admin légitime bloqué

```bash
# Débloquer une IP manuellement
cd frontend/scripts
node unblock-ip.js <IP_ADDRESS>
```

### Compte admin compromis

1. **Immédiat** : Désactiver le compte dans Firebase Auth
2. Changer le mot de passe
3. Vérifier logs pour voir actions suspectes
4. Revoir tous les admins actifs

---

## 📊 Métriques de sécurité

### KPIs à surveiller

- **Ratio succès/échecs** : Si < 50%, investigation requise
- **Tentatives par IP** : > 10/jour = suspect
- **Heures de connexion** : Connexions 3h du matin = suspect
- **Nouvelles IPs** : Admin se connecte depuis nouvelle IP = alerte

### Dashboard recommandé

Créer une page `/admin/security-dashboard` avec :
- Graphique tentatives/jour
- Top 10 IPs suspectes
- Alertes temps réel
- Comparaison mois précédent

---

## 🔗 Fichiers créés/modifiés

```
frontend/
├── src/
│   ├── middleware.ts                          # Nouveau - Middleware sécurité
│   ├── app/
│   │   ├── connexion/page.tsx                 # Modifié - Blocage admin
│   │   └── admin/
│   │       ├── login/page.tsx                 # Modifié - Logging + brute force
│   │       ├── layout.tsx                     # Modifié - Double vérification
│   │       └── logs/page.tsx                  # Nouveau - Visualisation logs
│   └── lib/firebase/
│       └── admin-access-log.ts                # Nouveau - Service logging
└── public/
    └── robots.txt                             # Nouveau - Blocage indexation
```

---

## 🎯 Résultat final

| Scénario | Avant | Après |
|----------|-------|-------|
| Admin se connecte sur `/connexion` | ✅ Accès | ❌ Bloqué + redirigé |
| Client tape `/admin/dashboard` | ⚠️ Possible | ❌ Bloqué + déconnecté |
| 5 tentatives échouées | ✅ Continue | ❌ IP bloquée 30 min |
| Google indexe `/admin/login` | ✅ Indexé | ❌ Disallow robots.txt |
| Admin légitime se connecte | ✅ Ok | ✅ Ok + loggé |

---

## 📚 Références

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [Firebase Auth Best Practices](https://firebase.google.com/docs/auth/web/best-practices)

---

**Dernière mise à jour** : 15 février 2026
