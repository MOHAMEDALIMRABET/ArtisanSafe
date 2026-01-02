# Guide de Délivrabilité des Emails Firebase

## 🎯 Problème

Les emails de vérification Firebase arrivent dans les SPAM car :
- ❌ Domaine générique Firebase (`noreply@artisansafe-6b100.firebaseapp.com`)
- ❌ Pas de SPF/DKIM configuré
- ❌ Template par défaut non personnalisé
- ❌ Pas de domaine personnalisé vérifié

## ✅ Solutions (Par Priorité)

### 1. Personnaliser le Template d'Email (URGENT)

**Firebase Console → Authentication → Templates → Email address verification**

**Avant (Template par défaut) :**
```
Subject: Verify your email for %APP_NAME%
```

**Après (Template personnalisé français) :**
```
Subject: ✅ Confirmez votre email - ArtisanDispo

Bonjour,

Bienvenue sur ArtisanDispo, la plateforme de confiance pour trouver des artisans qualifiés près de chez vous !

Pour finaliser votre inscription et accéder à toutes les fonctionnalités, veuillez confirmer votre adresse email en cliquant sur le lien ci-dessous :

%LINK%

Ce lien est valide pendant 24 heures.

Si vous n'avez pas créé de compte sur ArtisanDispo, ignorez cet email.

---
L'équipe ArtisanDispo
https://artisandispo.fr

📧 Des questions ? Répondez à cet email ou contactez-nous à support@artisandispo.fr
```

**Configuration Firebase Console :**
1. Allez dans **Authentication** → **Templates** (onglet)
2. Cliquez sur **Email address verification**
3. Cliquez sur **Edit template**
4. Personnalisez :
   - **From name**: `ArtisanDispo`
   - **Reply-to email**: `support@artisandispo.fr` (si vous avez un domaine)
   - **Subject**: `✅ Confirmez votre email - ArtisanDispo`
   - **Body**: Copiez le template français ci-dessus
5. **Save**

### 2. Configurer un Domaine Personnalisé (RECOMMANDÉ)

#### Option A : Domaine personnalisé complet (Meilleure solution)

**Prérequis :**
- Avoir un nom de domaine (ex: `artisandispo.fr`)
- Accès aux paramètres DNS du domaine

**Configuration :**

1. **Firebase Console → Authentication → Settings → Authorized domains**
   - Ajoutez votre domaine : `artisandispo.fr`

2. **Configurer les enregistrements DNS :**

```dns
; SPF Record (autorise Firebase à envoyer des emails)
@ TXT "v=spf1 include:_spf.firebasemail.com ~all"

; DKIM Record (signature électronique)
firebase._domainkey TXT "v=DKIM1; k=rsa; p=[CLÉ_PUBLIQUE_FIREBASE]"

; DMARC Record (politique anti-spam)
_dmarc TXT "v=DMARC1; p=quarantine; rua=mailto:postmaster@artisandispo.fr"
```

3. **Firebase Console → Authentication → Settings → Email sender**
   - Activez "Use custom SMTP" (Plan Blaze uniquement)
   - Ou utilisez Firebase avec domaine vérifié

#### Option B : SendGrid / Mailgun (Alternative)

Si vous voulez un contrôle total sur les emails :

**SendGrid (Gratuit jusqu'à 100 emails/jour) :**
```bash
npm install @sendgrid/mail
```

**Code personnalisé :**
```typescript
// frontend/src/lib/email-service.ts
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export async function sendCustomVerificationEmail(
  email: string,
  verificationLink: string,
  userName: string
) {
  const msg = {
    to: email,
    from: 'noreply@artisandispo.fr', // Votre domaine vérifié
    subject: '✅ Confirmez votre email - ArtisanDispo',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #FF6B00 0%, #2C3E50 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">ArtisanDispo</h1>
        </div>
        
        <div style="padding: 40px 30px; background: #f8f9fa;">
          <h2 style="color: #2C3E50;">Bonjour ${userName} 👋</h2>
          
          <p style="color: #6C757D; font-size: 16px; line-height: 1.6;">
            Bienvenue sur <strong>ArtisanDispo</strong>, la plateforme de confiance pour 
            trouver des artisans qualifiés près de chez vous !
          </p>
          
          <p style="color: #6C757D; font-size: 16px; line-height: 1.6;">
            Pour finaliser votre inscription, veuillez confirmer votre adresse email :
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" 
               style="background: #FF6B00; color: white; padding: 15px 40px; 
                      text-decoration: none; border-radius: 8px; font-weight: bold; 
                      display: inline-block;">
              ✅ Confirmer mon email
            </a>
          </div>
          
          <p style="color: #95A5A6; font-size: 14px;">
            Ce lien est valide pendant 24 heures.
          </p>
          
          <p style="color: #95A5A6; font-size: 14px;">
            Si vous n'avez pas créé de compte sur ArtisanDispo, ignorez cet email.
          </p>
        </div>
        
        <div style="background: #2C3E50; padding: 20px; text-align: center;">
          <p style="color: #95A5A6; margin: 0; font-size: 14px;">
            L'équipe ArtisanDispo | 
            <a href="https://artisandispo.fr" style="color: #FF6B00;">artisandispo.fr</a>
          </p>
        </div>
      </div>
    `,
  };

  await sgMail.send(msg);
}
```

### 3. Configurer SPF/DKIM (Technique)

**Pour Firebase par défaut (sans domaine personnalisé) :**

Firebase gère automatiquement SPF/DKIM pour son domaine `firebaseapp.com`, mais :
- ❌ Score de réputation faible (domaine partagé)
- ❌ Pas de contrôle sur la délivrabilité

**Solution :** Demander à vos utilisateurs de whitelister l'adresse

### 4. Améliorer le Score de Réputation

**Bonnes pratiques :**

✅ **Texte clair et professionnel**
- Évitez les mots spam : "URGENT", "GRATUIT", "GAGNEZ"
- Utilisez un français correct
- Incluez un pied de page avec coordonnées

✅ **Ratio texte/lien équilibré**
- Pas uniquement un lien
- Ajoutez du contexte

✅ **Authentification DMARC**
```dns
_dmarc.artisandispo.fr. IN TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@artisandispo.fr"
```

✅ **Taux d'engagement élevé**
- Envoyez uniquement aux emails valides
- Ne spammez pas (cooldown de 60s implémenté ✅)

## 📊 Checklist de Configuration

### Phase 1 : Immédiat (Sans domaine)
- [x] ✅ Template personnalisé en français
- [x] ✅ Cooldown anti-spam (60s)
- [ ] ⏳ Modifier "From name" en "ArtisanDispo"
- [ ] ⏳ Tester avec plusieurs fournisseurs (Gmail, Outlook, Yahoo)

### Phase 2 : Court terme (Avec domaine)
- [ ] 🔲 Acheter domaine `artisandispo.fr`
- [ ] 🔲 Configurer SPF/DKIM
- [ ] 🔲 Ajouter domaine aux Authorized Domains Firebase
- [ ] 🔲 Configurer DMARC
- [ ] 🔲 Vérifier domaine dans Firebase Console

### Phase 3 : Long terme (Production)
- [ ] 🔲 Passer à SendGrid/Mailgun pour emails transactionnels
- [ ] 🔲 Monitorer taux de délivrabilité
- [ ] 🔲 Configurer BIMI (logo dans boîte mail)
- [ ] 🔲 SSL/TLS pour emails

## 🧪 Tester la Délivrabilité

### 1. Outils en ligne

**Mail-Tester.com :**
```bash
# Envoyez un email de test à l'adresse fournie
# Vous obtiendrez un score /10
```

**MXToolbox.com :**
- Vérifiez vos enregistrements SPF/DKIM/DMARC
- Testez si votre domaine est blacklisté

### 2. Test multi-fournisseurs

Testez avec ces fournisseurs :
- ✅ Gmail (Google)
- ✅ Outlook (Microsoft)
- ✅ Yahoo Mail
- ✅ ProtonMail
- ✅ iCloud Mail

### 3. Score actuel Firebase (estimation)

Sans configuration :
```
Score Mail-Tester : 5-6/10
- ❌ Pas de SPF personnalisé
- ❌ Pas de DKIM personnalisé
- ❌ Pas de DMARC
- ✅ HTTPS valide
- ✅ Contenu non spam
```

Avec domaine personnalisé + SPF/DKIM :
```
Score Mail-Tester : 9-10/10
- ✅ SPF vérifié
- ✅ DKIM vérifié
- ✅ DMARC configuré
- ✅ Domaine réputé
- ✅ Contenu professionnel
```

## 🚨 Erreurs Courantes

### "Email non envoyé"
```typescript
// Vérifiez que l'utilisateur est connecté
const user = auth.currentUser;
if (!user) throw new Error('Non connecté');
```

### "too-many-requests"
```typescript
// Cooldown de 60s déjà implémenté ✅
// Si erreur persiste : attendre 15 min
```

### "Email en SPAM systématiquement"
```bash
# Vérifiez SPF/DKIM
dig TXT _spf.firebasemail.com

# Vérifiez réputation domaine
https://mxtoolbox.com/blacklists.aspx
```

## 📞 Support Firebase

Si problème persistant :
1. Firebase Console → Support
2. Stack Overflow : `[firebase-authentication] email spam`
3. GitHub Issues : `firebase/firebase-js-sdk`

## 🎯 Recommandation Finale

**Pour le MVP (maintenant) :**
```
✅ Personnaliser template Firebase (GRATUIT)
✅ Informer utilisateurs de vérifier SPAM
✅ Cooldown anti-spam actif
⏳ Acheter domaine artisandispo.fr (10-15€/an)
```

**Pour la production (3-6 mois) :**
```
✅ Domaine personnalisé configuré
✅ SPF/DKIM/DMARC actifs
✅ Migration vers SendGrid (gratuit jusqu'à 100/jour)
✅ Monitoring délivrabilité
```

---

**Coût estimé :**
- Firebase Auth : GRATUIT (10k emails/jour)
- Domaine .fr : 10-15€/an
- SendGrid Free Tier : GRATUIT (100 emails/jour)
- SendGrid Essentials : 19.95$/mois (100k emails/mois)

**ROI :** Meilleure expérience utilisateur = moins d'abandon d'inscription
