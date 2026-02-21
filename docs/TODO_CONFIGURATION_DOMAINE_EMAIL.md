# TODO - Configuration Domaine ArtisanDispo

## 🌐 Achat Domaine `artisandispo.fr`

**Statut** : ⏳ EN ATTENTE  
**Priorité** : MOYENNE (avant mise en production)

---

## ✅ Actions à effectuer après achat du domaine

### 1. Configuration Email Professionnel

#### Créer adresse email support

**Email à créer** : `support@artisandispo.fr`

**Options** :
- **Option A** : Google Workspace (recommandé)
  - Prix : ~5€/mois/utilisateur
  - Avantages : Interface Gmail, stockage 30GB, professionnel
  - URL : https://workspace.google.com

- **Option B** : Microsoft 365
  - Prix : ~4.50€/mois/utilisateur
  - Avantages : Outlook, intégration Office

- **Option C** : Email hébergeur (OVH, Gandi, etc.)
  - Prix : ~1-2€/mois
  - Avantages : Moins cher
  - Inconvénients : Interface basique

**Recommandation** : Google Workspace pour professionnalisme

#### Configuration SMTP

Une fois email créé, mettre à jour `.env` backend :

```bash
# backend/.env
SMTP_HOST=smtp.gmail.com  # Ou smtp.office365.com selon provider
SMTP_PORT=587
SMTP_USER=support@artisandispo.fr  # ← NOUVEAU EMAIL
SMTP_PASSWORD=mot_de_passe_application_gmail

ADMIN_EMAIL=support@artisandispo.fr  # ← MÊME EMAIL
```

**Important Google Workspace** :
1. Activer "Accès aux applications moins sécurisées" OU
2. Créer "Mot de passe d'application" (recommandé)
   - Compte Google → Sécurité → Validation en deux étapes → Mots de passe d'application

---

### 2. Adresses Email Complémentaires

**À créer également** :

```
admin@artisandispo.fr        # Notifications admin, rapports
contact@artisandispo.fr      # Contact général (formulaire site)
noreply@artisandispo.fr      # Emails automatiques (notifications)
facturation@artisandispo.fr  # Factures Stripe, comptabilité
```

**Configuration variables** :

```bash
# backend/.env - APRÈS achat domaine
SMTP_USER=noreply@artisandispo.fr           # Emails automatiques
ADMIN_EMAIL=admin@artisandispo.fr           # Notifications admin
SUPPORT_EMAIL=support@artisandispo.fr       # Tickets support
CONTACT_EMAIL=contact@artisandispo.fr       # Formulaire contact
BILLING_EMAIL=facturation@artisandispo.fr   # Stripe
```

---

### 3. Fichiers Backend à Modifier

#### `backend/src/routes/support.routes.ts`

**Ligne 32** :
```typescript
// ACTUEL (temporaire)
const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER || 'support@artisandispo.fr';

// APRÈS achat domaine - Supprimer fallback
const adminEmail = process.env.SUPPORT_EMAIL; // support@artisandispo.fr
```

**Lignes 47, 118** :
```typescript
// ACTUEL
from: `"ArtisanDispo Support" <${process.env.SMTP_USER}>`,

// APRÈS achat domaine
from: `"ArtisanDispo Support" <${process.env.SUPPORT_EMAIL}>`,
// Ou directement
from: '"ArtisanDispo Support" <support@artisandispo.fr>',
```

#### `backend/src/routes/email.routes.ts` (si existant)

Mettre à jour tous les `from:` pour utiliser `noreply@artisandispo.fr`

#### `backend/src/services/email-service.ts` (si existant)

Mettre à jour configuration transporter

---

### 4. Fichiers Frontend à Modifier

#### `frontend/src/app/artisan/contact-support/page.tsx`

**Aucune modification nécessaire** - Utilise déjà le backend

#### `frontend/src/app/mot-de-passe-oublie/page.tsx`

**Ligne 109** :
```tsx
{/* ACTUEL */}
<a href="mailto:support@artisansafe.fr" className="text-[#FF6B00] hover:underline">

{/* APRÈS achat domaine */}
<a href="mailto:support@artisandispo.fr" className="text-[#FF6B00] hover:underline">
```

**⚠️ Chercher toutes les occurrences** :
```bash
# Dans le terminal
cd frontend
grep -r "support@" src/
grep -r "artisansafe.fr" src/
grep -r "artisandispo.fr" src/
```

---

### 5. Documentation à Mettre à Jour

**Fichiers impactés** :

- `docs/SYSTEME_SUPPORT_TICKETS.md`
- `docs/SYSTEME_EMAILS_PLATEFORME.md` (si existant)
- `README.md`
- `.env.example` (backend + frontend)

**Chercher/Remplacer** :
- `support@artisansafe.fr` → `support@artisandispo.fr`
- `admin@artisansafe.fr` → `admin@artisandispo.fr`
- `contact@artisansafe.fr` → `contact@artisandispo.fr`

---

### 6. Configuration DNS Domaine

**Après achat chez registrar (OVH, Gandi, etc.)** :

#### Records MX (Mail Exchange)

Pour Google Workspace :
```
MX    @    ASPMX.L.GOOGLE.COM.         Priorité: 1
MX    @    ALT1.ASPMX.L.GOOGLE.COM.    Priorité: 5
MX    @    ALT2.ASPMX.L.GOOGLE.COM.    Priorité: 5
MX    @    ALT3.ASPMX.L.GOOGLE.COM.    Priorité: 10
MX    @    ALT4.ASPMX.L.GOOGLE.COM.    Priorité: 10
```

#### Records SPF/DKIM (Anti-spam)

```
TXT   @    "v=spf1 include:_spf.google.com ~all"
TXT   @    DKIM key (fourni par Google Workspace)
```

#### Record DMARC (Sécurité email)

```
TXT   _dmarc.artisandispo.fr    "v=DMARC1; p=quarantine; rua=mailto:admin@artisandispo.fr"
```

---

### 7. Tests Email Après Configuration

**Script de test backend** :

```bash
cd backend
node test-email-config.js
```

**Créer** `backend/test-email-config.js` :

```javascript
require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

async function testEmail() {
  try {
    const info = await transporter.sendMail({
      from: `"ArtisanDispo Support" <${process.env.SUPPORT_EMAIL}>`,
      to: process.env.ADMIN_EMAIL,
      subject: 'Test Configuration Email ArtisanDispo',
      html: `
        <h1>✅ Configuration Email Réussie</h1>
        <p>Les emails ArtisanDispo fonctionnent correctement.</p>
        <ul>
          <li>SMTP Host: ${process.env.SMTP_HOST}</li>
          <li>From: ${process.env.SUPPORT_EMAIL}</li>
          <li>To: ${process.env.ADMIN_EMAIL}</li>
        </ul>
      `,
    });
    
    console.log('✅ Email envoyé avec succès !');
    console.log('Message ID:', info.messageId);
  } catch (error) {
    console.error('❌ Erreur envoi email:', error);
  }
}

testEmail();
```

**Tests à effectuer** :

1. ✅ Email support → admin (nouveau ticket)
2. ✅ Email support → artisan (réponse ticket)
3. ✅ Email noreply → client (confirmation inscription)
4. ✅ Email noreply → artisan (nouveau devis reçu)
5. ✅ Vérifier réception (inbox, pas spam)
6. ✅ Vérifier expéditeur correct (support@artisandispo.fr)

---

### 8. Redirection Emails (Transition)

**Si vous avez déjà un email actuel configuré** :

Option 1 : **Redirection temporaire**
- Configurer redirection `support@artisandispo.fr` → votre email actuel
- Permet réception immédiate sans modifier code
- À supprimer après migration complète

Option 2 : **Période de transition**
- Garder ancien email + nouveau email actifs
- Modifier progressivement le code
- Désactiver ancien email après 1 mois

---

### 9. Monitoring & Alertes

**Après configuration, surveiller** :

- Taux de délivrabilité emails (éviter spam)
- Temps de réception emails (< 5 secondes)
- Erreurs SMTP logs backend
- Bounce rate (emails non délivrés)

**Outils recommandés** :

- **SendGrid** (alternative SMTP si problèmes)
  - 100 emails/jour gratuit
  - Dashboard analytics
  - URL : https://sendgrid.com

- **Mailgun**
  - 5000 emails/mois gratuit
  - APIs puissantes

---

## 📋 Checklist Déploiement Email

**Avant production** :

- [ ] Domaine `artisandispo.fr` acheté
- [ ] Email `support@artisandispo.fr` créé
- [ ] Email `admin@artisandispo.fr` créé
- [ ] Email `noreply@artisandispo.fr` créé
- [ ] Configuration DNS (MX, SPF, DKIM, DMARC)
- [ ] Variables `.env` backend mises à jour
- [ ] Code backend `support.routes.ts` modifié
- [ ] Code frontend emails mis à jour
- [ ] Documentation mise à jour
- [ ] Tests emails envoyés avec succès
- [ ] Vérification anti-spam (inbox, pas spam)
- [ ] Logs backend sans erreurs SMTP
- [ ] Redirection ancien email configurée (optionnel)
- [ ] Monitoring emails activé

---

## 💰 Coûts Estimés

| Service | Prix/mois | Prix/an |
|---------|-----------|---------|
| Domaine `artisandispo.fr` | - | ~12€ |
| Google Workspace (1 utilisateur) | ~5€ | ~60€ |
| **Total** | **~5€** | **~72€** |

**Alternative moins chère** : Email hébergeur (~1€/mois) = ~24€/an

---

## 🔗 Ressources Utiles

- [Google Workspace Setup](https://support.google.com/a/answer/140034)
- [Nodemailer Gmail Config](https://nodemailer.com/usage/using-gmail/)
- [SPF/DKIM Guide](https://www.cloudflare.com/learning/dns/dns-records/dns-spf-record/)
- [Email Tester](https://www.mail-tester.com/) - Vérifier score anti-spam

---

**Auteur** : Équipe Technique ArtisanDispo  
**Dernière mise à jour** : 21 février 2026  
**Statut** : TODO - En attente achat domaine
