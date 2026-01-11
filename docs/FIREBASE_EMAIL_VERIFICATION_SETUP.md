# Configuration de l'envoi d'emails de vérification Firebase

## Problème
Les emails de vérification ne sont plus envoyés après l'inscription des clients.

## Solution

### 1. Vérifier la configuration Firebase Auth

Accédez à la console Firebase : https://console.firebase.google.com/project/artisansafe

#### a) Activer l'authentification par email
1. Allez dans **Authentication** > **Sign-in method**
2. Vérifiez que **Email/Password** est activé

#### b) Configurer les templates d'email
1. Allez dans **Authentication** > **Templates**
2. Cliquez sur **Email address verification**
3. Vérifiez/configurez :
   - **Expéditeur** : Utilisez un email vérifié (ex: noreply@artisandispo.com)
   - **Nom de l'expéditeur** : ArtisanDispo
   - **Sujet** : Vérifiez votre adresse email - ArtisanDispo
   - **Message** : Personnalisez le message en français

**Template recommandé :**
```
Bonjour,

Merci de vous être inscrit sur ArtisanDispo !

Pour activer votre compte, veuillez vérifier votre adresse email en cliquant sur le lien ci-dessous :

%LINK%

Ce lien expirera dans 24 heures.

Si vous n'avez pas créé de compte, vous pouvez ignorer cet email.

Cordialement,
L'équipe ArtisanDispo
```

#### c) URL de redirection
Dans **Authentication** > **Settings** :
1. Ajoutez les domaines autorisés :
   - `localhost` (pour le développement)
   - `http://localhost:3000`
   - Votre domaine de production

### 2. Vérifier les quotas Firebase

**Quotas officiels Firebase Auth pour les emails de vérification :**

| Type d'email | Plan Gratuit (Spark) | Plan Blaze (payant) |
|-------------|---------------------|---------------------|
| **Address verification emails** | **1 000 emails/jour** | **100 000 emails/jour** |
| Password reset emails | 150 emails/jour | 10 000 emails/jour |
| Email link sign-in | 5 emails/jour | 25 000 emails/jour |
| Address change emails | 1 000 emails/jour | 10 000 emails/jour |

**Pour votre projet :**
- Avec le **plan gratuit** : 1 000 emails de vérification par jour
- Avec le **plan Blaze** : 100 000 emails de vérification par jour

**Autres limites importantes :**
- Création de compte : 100 comptes/heure par adresse IP
- Génération de liens de vérification : 10 000 liens/jour (gratuit)

**Solution :** Si vous dépassez 1 000 inscriptions/jour, vous devrez passer au plan Blaze.

**Source :** [Documentation officielle Firebase Auth Limits](https://firebase.google.com/docs/auth/limits)

### 3. Tester l'envoi d'email manuellement

Créez un compte de test via l'interface :
1. Allez sur http://localhost:3000/inscription
2. Inscrivez-vous avec un email réel que vous contrôlez
3. Vérifiez la boîte de réception (et les spams)
4. Vérifiez la console du navigateur pour les erreurs

### 4. Vérifier les logs Firebase

Dans la console Firebase :
1. Allez dans **Authentication** > **Users**
2. Vérifiez que l'utilisateur a été créé
3. Regardez la colonne **Email verified** (doit être à `false` initialement)

### 5. Code d'envoi d'email (déjà implémenté)

Le code dans `frontend/src/lib/auth-service.ts` envoie déjà l'email :

```typescript
await sendEmailVerification(user, {
  url: `${window.location.origin}/email-verified`,
  handleCodeInApp: false,
});
```

### 6. Diagnostic en cas d'échec

Si l'email ne s'envoie toujours pas :

#### a) Vérifier les erreurs dans la console du navigateur
Ouvrez la console (F12) et cherchez :
- `⚠️ Erreur envoi email de vérification`
- Messages d'erreur Firebase Auth

#### b) Tester avec un email Gmail/Outlook
Certains providers bloquent les emails Firebase. Testez avec :
- Gmail
- Outlook/Hotmail
- Proton Mail

#### c) Vérifier le dossier spam
Les emails Firebase peuvent être marqués comme spam.

### 7. Solution alternative : Email personnalisé

Si Firebase Auth ne fonctionne pas, vous pouvez envoyer un email personnalisé via votre backend :

1. Créer un token de vérification dans Firestore
2. Envoyer l'email via votre service (Resend, SendGrid, etc.)
3. Valider le token lors du clic

**Exemple :** Voir `docs/EMAIL_VERIFICATION_WORKFLOW.md`

## Checklist de vérification

- [ ] Email/Password activé dans Firebase Auth
- [ ] Template d'email configuré en français
- [ ] Email expéditeur vérifié
- [ ] Domaines autorisés configurés
- [ ] Quota Firebase non dépassé
- [ ] Test avec un email réel effectué
- [ ] Vérification du dossier spam
- [ ] Console navigateur sans erreur

## Contact support Firebase

Si le problème persiste :
1. Contactez le support Firebase : https://firebase.google.com/support
2. Vérifiez le status Firebase : https://status.firebase.google.com/

## Logs utiles

Pour déboguer, activez les logs Firebase :
```typescript
import { getAuth } from 'firebase/auth';
import { setLogLevel } from 'firebase/app';

setLogLevel('debug');
```

## Ressources

- [Documentation Firebase Auth](https://firebase.google.com/docs/auth/web/manage-users#send_a_user_a_verification_email)
- [Templates d'email Firebase](https://firebase.google.com/docs/auth/custom-email-handler)
- [Quotas Firebase](https://firebase.google.com/docs/auth/limits)
