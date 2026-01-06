# Alternatives API SIRENE - Blocage réseau

## Problème identifié
- DNS fonctionne : `entreprise.data.gouv.fr` → `213.186.33.5`
- Connexion TCP bloquée : Port 443 inaccessible
- Pare-feu Windows désactivé : Problème persiste
- Cause probable : Antivirus, routeur, ou FAI

## Solutions alternatives

### 🌟 Option 1 : API Pappers (RECOMMANDÉ)
- **Prix** : 29€/mois (illimité)
- **Fiabilité** : 99.9% uptime
- **Données** : SIRENE + BODACC + tribunaux de commerce
- **Avantages** : Pas de blocage réseau, données enrichies
- **Site** : https://www.pappers.fr/api

**Implémentation** :
```typescript
// backend/src/services/pappers-api.service.ts
const response = await fetch(
  `https://api.pappers.fr/v2/entreprise?api_token=${PAPPERS_API_KEY}&siret=${siret}`
);
```

### 💰 Option 2 : API Entreprise (Gratuite pour services publics)
- **Prix** : Gratuit (après validation dossier)
- **Site** : https://entreprise.api.gouv.fr
- **Délai** : 2-3 semaines validation
- **Conditions** : Projet d'intérêt public

### 🔧 Option 3 : Proxy/VPN
**Solution temporaire :**
```bash
# Utiliser un VPN pour contourner le blocage réseau
# Exemple : ProtonVPN, NordVPN, ou VPN gratuit
```

### 🏠 Option 4 : Déploiement cloud
- **Serveur cloud** : AWS, Azure, Google Cloud
- **Avantage** : Pas de restrictions réseau FAI/routeur
- **Test** : Déployer backend sur Heroku/Railway (gratuit)

## Décision immédiate

**Pour le développement (court terme)** :
- Garder `SIRENE_BYPASS_VERIFICATION=true`
- Simuler les vérifications avec données fictives
- Tester la logique métier

**Pour la production (avant lancement)** :
- ✅ API Pappers 29€/mois (recommandé)
- ⏳ API Entreprise gratuite (si éligible)
- 🔧 Déploiement cloud (contourne le blocage local)

## Test de contournement immédiat

Si vous voulez tester **maintenant** sans abonnement :

1. **Point d'accès mobile** (4G/5G du téléphone)
   - Partager connexion téléphone
   - Connecter PC en WiFi mobile
   - Relancer test réseau

2. **VPN gratuit**
   - ProtonVPN (gratuit)
   - Cloudflare WARP (gratuit)
   - Test connexion après activation
