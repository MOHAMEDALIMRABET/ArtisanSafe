# Configuration Twilio pour l'envoi de SMS

## 📱 Qu'est-ce que Twilio ?

**Twilio** est le leader mondial des API de communication (SMS, voix, vidéo). C'est le service utilisé par Uber, Airbnb, WhatsApp et des milliers d'entreprises.

**Avantages :**
- ✅ **Essai gratuit** : $15 de crédit offert (≈ 100-150 SMS)
- ✅ **Fiable** : Utilisé par les plus grandes entreprises
- ✅ **Simple** : Configuration en 5 minutes
- ✅ **Global** : Envoi SMS dans 180+ pays
- ✅ **Pas d'installation** : API REST uniquement

**Tarifs après essai :**
- SMS France : ~0,09€ / SMS
- SMS International : Variable selon pays

## 🚀 Configuration en 4 étapes

### Étape 1 : Créer un compte Twilio (GRATUIT)

1. Aller sur **https://www.twilio.com/try-twilio**
2. Cliquer sur **"Sign up for free"** / **"Essai gratuit"**
3. Remplir le formulaire :
   - Prénom, Nom, Email
   - Mot de passe fort
   - Pays : **France**
4. Vérifier votre email
5. **Vérifier votre numéro de téléphone** (code SMS envoyé)

**✅ Vous recevez $15 de crédit gratuit !**

### Étape 2 : Récupérer vos credentials

Une fois connecté au **Dashboard Twilio** :

1. **Account SID** :
   - Visible sur la page d'accueil
   - Format : `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - 📋 **Copier** cette valeur

2. **Auth Token** :
   - Cliquer sur **"Show"** / **"Afficher"** à côté de Auth Token
   - Format : `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - 📋 **Copier** cette valeur

**⚠️ IMPORTANT :** Ne jamais partager ces credentials !

### Étape 3 : Acheter un numéro Twilio

1. Dans le menu gauche, aller à **"Phone Numbers"** → **"Buy a Number"**
2. Sélectionner le pays : **France** (+33)
3. Cocher **"SMS"** dans les capacités
4. Cliquer sur **"Search"**
5. Choisir un numéro disponible (ex: `+33 7 XX XX XX XX`)
6. Cliquer sur **"Buy"** (gratuit avec le crédit)

**Votre numéro émetteur :** `+33XXXXXXXXX`

### Étape 4 : Configurer le backend

**Ajouter les credentials dans `backend/.env` :**

```bash
# Twilio SMS
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+33XXXXXXXXX
```

**Exemple réel :**
```bash
TWILIO_ACCOUNT_SID=AC1234567890abcdef1234567890abcd
TWILIO_AUTH_TOKEN=9876543210fedcba9876543210fedcba
TWILIO_PHONE_NUMBER=+33756123456
```

**Redémarrer le serveur :**
```bash
cd backend
npm run dev
```

## 🧪 Tester le service SMS

### Test 1 : Vérifier la configuration

```bash
curl http://localhost:5000/api/v1/sms/status
```

**Réponse attendue :**
```json
{
  "configured": true,
  "provider": "Twilio",
  "status": "operational",
  "message": "Service SMS opérationnel (Twilio)"
}
```

### Test 2 : Envoyer un SMS de test

**Via cURL :**
```bash
curl -X POST http://localhost:5000/api/v1/sms/send-verification-code \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+33612345678", "code": "123456"}'
```

**Réponse attendue :**
```json
{
  "success": true,
  "messageId": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "message": "Code de vérification envoyé avec succès"
}
```

**Via l'application frontend :**
1. Aller sur http://localhost:3000/artisan/verification
2. Cliquer sur **"Envoyer le code SMS"**
3. **Vérifier réception** sur votre téléphone (< 5 secondes)

## 📱 Format des numéros de téléphone

Le service accepte plusieurs formats (conversion automatique) :

```
✅ +33612345678   (international - recommandé)
✅ 0612345678     (français - converti en +33)
✅ 06 12 34 56 78 (avec espaces - nettoyé)
✅ 06-12-34-56-78 (avec tirets - nettoyé)
```

## 🔧 Troubleshooting

### ❌ Erreur : "Credentials Twilio manquants"

**Cause :** Variables d'environnement non définies

**Solution :**
```bash
# Vérifier que .env existe
cat backend/.env

# Ajouter les variables (copier depuis Dashboard Twilio)
TWILIO_ACCOUNT_SID=ACxxxxxxx...
TWILIO_AUTH_TOKEN=xxxxxxx...
TWILIO_PHONE_NUMBER=+33xxxxxxx

# Redémarrer le serveur
npm run dev
```

### ❌ Erreur : "Unverified number" (compte essai)

**Cause :** En mode essai gratuit, Twilio n'envoie qu'aux numéros vérifiés

**Solution 1 - Vérifier le numéro destinataire :**
1. Dashboard Twilio → **"Phone Numbers"** → **"Verified Caller IDs"**
2. Cliquer **"Add a new number"**
3. Entrer le numéro de test
4. Recevoir + saisir le code de vérification

**Solution 2 - Passer au compte payant :**
- Ajouter une carte bancaire (pas de prélèvement automatique)
- Envoyer à n'importe quel numéro sans limitation

### ❌ SMS non reçu

**Vérifications :**
1. ✅ Le numéro est au **format international** (+33...)
2. ✅ Le numéro est **vérifié** (mode essai) OU compte **activé**
3. ✅ Vous avez **du crédit** ($15 offerts utilisés ?)
4. ✅ Le pays destinataire est **autorisé** (France OK par défaut)

**Voir les logs Twilio :**
1. Dashboard → **"Monitor"** → **"Logs"** → **"SMS Logs"**
2. Vérifier le statut du dernier SMS :
   - `sent` ✅ : Envoyé avec succès
   - `delivered` ✅ : Reçu par le destinataire
   - `failed` ❌ : Échec (voir raison)
   - `undelivered` ❌ : Non délivré

### ❌ Erreur 401 Unauthorized

**Cause :** Account SID ou Auth Token incorrect

**Solution :**
```bash
# Vérifier dans Dashboard Twilio (copier/coller à nouveau)
# Attention aux espaces/caractères invisibles !

# Tester manuellement
curl -X POST "https://api.twilio.com/2010-04-01/Accounts/ACxxx.../Messages.json" \
  -u "ACxxx...:your_auth_token" \
  -d "To=+33612345678" \
  -d "From=+33756123456" \
  -d "Body=Test"
```

## 🌐 Mode simulation (sans Twilio)

Si vous n'avez pas configuré Twilio, le backend fonctionne en **mode simulation** :

```typescript
// En développement, le code est affiché dans les logs
console.log(`📱 [SIMULATION] Code pour +33612345678: 123456`);
```

**Utilisation :**
1. Cliquer sur "Envoyer le code SMS"
2. Regarder les **logs backend** pour voir le code
3. Saisir le code manuellement dans le formulaire

## 💰 Gérer les coûts

**Crédit gratuit ($15) :**
- ≈ 100-150 SMS en France
- ≈ 200-300 SMS aux USA/Canada
- Valide pendant 1 an

**Après crédit gratuit :**
1. **Ajouter une carte bancaire** (Dashboard → Billing)
2. **Définir un plafond** : Settings → Budget Alerts
   - Ex: Alert si dépasse 20€/mois
3. **Surveillance** : Dashboard → Usage

**Alternatives gratuites (limitations) :**
- Firebase Phone Auth (quotas stricts)
- Vonage (10€ offerts, puis payant)
- MessageBird (9€ offerts, puis payant)

## 📊 API Endpoints

### `POST /api/v1/sms/send-verification-code`

**Request :**
```json
{
  "phoneNumber": "+33612345678",
  "code": "123456"
}
```

**Response (succès) :**
```json
{
  "success": true,
  "messageId": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "message": "Code de vérification envoyé avec succès"
}
```

**Response (simulation) :**
```json
{
  "success": true,
  "simulation": true,
  "message": "SMS simulé (service non configuré)",
  "code": "123456"  // Uniquement en dev
}
```

### `GET /api/v1/sms/status`

**Response :**
```json
{
  "configured": true,
  "provider": "Twilio",
  "status": "operational",
  "message": "Service SMS opérationnel (Twilio)"
}
```

## 🔒 Sécurité

**Bonnes pratiques :**
- ❌ NE JAMAIS commit `.env` dans Git
- ✅ Utiliser des variables d'environnement
- ✅ Activer **2FA** sur votre compte Twilio
- ✅ Limiter les permissions des API keys (créer une clé dédiée)
- ✅ Définir des **budgets** pour éviter les surprises

**Protection contre abus :**
```typescript
// Rate limiting côté backend (à implémenter)
// Max 3 SMS / 10 minutes par numéro
```

## 📝 Résumé checklist

- [ ] Créer compte sur https://www.twilio.com/try-twilio
- [ ] Vérifier email + téléphone
- [ ] Récupérer Account SID depuis Dashboard
- [ ] Récupérer Auth Token depuis Dashboard
- [ ] Acheter un numéro Twilio (France +33)
- [ ] Ajouter `TWILIO_ACCOUNT_SID` dans `.env`
- [ ] Ajouter `TWILIO_AUTH_TOKEN` dans `.env`
- [ ] Ajouter `TWILIO_PHONE_NUMBER` dans `.env`
- [ ] Redémarrer le serveur backend
- [ ] Tester avec `GET /api/v1/sms/status`
- [ ] Envoyer un SMS de test
- [ ] Vérifier réception sur téléphone
- [ ] Vérifier logs dans Dashboard Twilio

---

**Besoin d'aide ?** 
- 📖 Documentation officielle : https://www.twilio.com/docs/sms
- 💬 Support Twilio : https://support.twilio.com
- 🎥 Tutoriel vidéo : https://www.twilio.com/docs/sms/quickstart/node

**Avantages :**
- ✅ **Gratuit** (utilise votre forfait mobile)
- ✅ Facile à configurer (5 minutes)
- ✅ Pas de limite d'envoi (dépend de votre forfait)
- ✅ Parfait pour MVP et tests

## 🚀 Configuration en 3 étapes

### Étape 1 : Créer un compte SMS Gateway

1. Aller sur **https://smsgateway.me**
2. Cliquer sur **"Sign Up"**
3. Créer un compte avec votre email
4. **Noter vos identifiants** (email + mot de passe)

### Étape 2 : Installer l'application mobile

**Android :**
- Télécharger sur [Google Play Store](https://play.google.com/store/apps/details?id=networked.solutions.sms.gateway.api)
- Chercher "SMS Gateway - API for SMS"

**iOS :**
- Télécharger sur [App Store](https://apps.apple.com/app/sms-gateway-api/id1442888896)

**Après installation :**
1. Ouvrir l'app
2. Se connecter avec vos identifiants (email + mot de passe)
3. Autoriser les permissions SMS
4. **Laisser l'app ouverte en arrière-plan** (important !)

### Étape 3 : Configurer le backend

**Ajouter les credentials dans `.env` :**

```bash
# SMS Gateway (https://smsgateway.me)
SMS_GATEWAY_EMAIL=votre-email@example.com
SMS_GATEWAY_PASSWORD=votre-mot-de-passe
SMS_GATEWAY_DEVICE_ID=  # Optionnel - laissez vide pour auto-détection
```

**Exemple réel :**
```bash
SMS_GATEWAY_EMAIL=mohamed@example.com
SMS_GATEWAY_PASSWORD=MonMotDePasseSecurise123
SMS_GATEWAY_DEVICE_ID=  # Vide = utilise le 1er device disponible
```

## 🧪 Tester le service SMS

### Test 1 : Vérifier la configuration

```bash
cd backend
curl http://localhost:5000/api/v1/sms/status
```

**Réponse attendue :**
```json
{
  "configured": true,
  "provider": "SMS Gateway API",
  "status": "operational",
  "message": "Service SMS opérationnel"
}
```

### Test 2 : Envoyer un SMS de test

**Via cURL :**
```bash
curl -X POST http://localhost:5000/api/v1/sms/send-verification-code \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+33612345678", "code": "123456"}'
```

**Via l'application frontend :**
1. Aller sur `/artisan/verification`
2. Cliquer sur "Envoyer le code SMS"
3. Vérifier réception sur votre téléphone

## 📱 Format des numéros de téléphone

Le service accepte plusieurs formats (conversion automatique) :

```
✅ +33612345678   (international - recommandé)
✅ 0612345678     (français - converti en +33)
✅ 06 12 34 56 78 (avec espaces - nettoyé)
✅ 06-12-34-56-78 (avec tirets - nettoyé)
```

## 🔧 Troubleshooting

### ❌ Erreur : "Credentials SMS Gateway manquants"

**Cause :** Variables d'environnement non définies

**Solution :**
```bash
# Vérifier que .env existe
cat backend/.env

# Ajouter les variables
SMS_GATEWAY_EMAIL=votre-email@example.com
SMS_GATEWAY_PASSWORD=votre-mot-de-passe

# Redémarrer le serveur
npm run dev
```

### ❌ SMS non reçu

**Vérifications :**
1. ✅ L'app mobile est **ouverte en arrière-plan**
2. ✅ Vous êtes **connecté** dans l'app
3. ✅ Votre téléphone a **du réseau mobile**
4. ✅ Le numéro est au **format international** (+33...)
5. ✅ Vous avez **du crédit/forfait SMS**

**Logs utiles :**
```bash
# Backend (terminal)
📤 Envoi SMS vers +33612345678...
✅ SMS envoyé avec succès: msg_abc123

# App mobile
- Une notification doit apparaître
- Le SMS doit s'afficher dans "Messages Sent"
```

### ❌ "SMS send failed"

**Causes possibles :**
- Email/mot de passe incorrect
- App mobile fermée/déconnectée
- Pas de device configuré
- Problème réseau mobile

**Vérifier les credentials :**
```bash
# Tester la connexion
curl https://smsgateway.me/api/v4/message/status \
  -u "votre-email:votre-mot-de-passe"
```

## 🌐 Mode simulation (sans SMS Gateway)

Si vous n'avez pas configuré SMS Gateway, le backend fonctionne en **mode simulation** :

```typescript
// En développement, le code est affiché dans les logs
console.log(`📱 [SIMULATION] Code pour +33612345678: 123456`);
```

**Utilisation :**
1. Cliquer sur "Envoyer le code SMS"
2. Regarder les **logs backend** pour voir le code
3. Saisir le code manuellement dans le formulaire

## 🔒 Sécurité

**Bonnes pratiques :**
- ❌ NE JAMAIS commit `.env` dans Git
- ✅ Utiliser un mot de passe fort
- ✅ Activer 2FA sur votre compte SMS Gateway
- ✅ En production : utiliser Twilio/AWS SNS pour plus de fiabilité

## 🔄 Alternatives (production)

Pour un environnement de **production** avec gros volume :

**1. Twilio** (payant - fiable)
```bash
npm install twilio
```

**2. AWS SNS** (payant - scalable)
```bash
npm install @aws-sdk/client-sns
```

**3. Firebase Phone Auth** (gratuit - limites)
```bash
# Déjà intégré dans votre projet
```

## 📊 API Endpoints

### `POST /api/v1/sms/send-verification-code`

**Request :**
```json
{
  "phoneNumber": "+33612345678",
  "code": "123456"
}
```

**Response (succès) :**
```json
{
  "success": true,
  "messageId": "msg_abc123",
  "message": "Code de vérification envoyé avec succès"
}
```

**Response (erreur) :**
```json
{
  "error": {
    "code": "SMS_SEND_FAILED",
    "message": "Credentials SMS Gateway manquants"
  }
}
```

### `GET /api/v1/sms/status`

**Response :**
```json
{
  "configured": true,
  "provider": "SMS Gateway API",
  "status": "operational",
  "message": "Service SMS opérationnel"
}
```

## 📝 Résumé checklist

- [ ] Créer compte sur https://smsgateway.me
- [ ] Installer app mobile (Android/iOS)
- [ ] Se connecter dans l'app
- [ ] Ajouter `SMS_GATEWAY_EMAIL` dans `.env`
- [ ] Ajouter `SMS_GATEWAY_PASSWORD` dans `.env`
- [ ] Redémarrer le serveur backend
- [ ] Tester avec `GET /api/v1/sms/status`
- [ ] Envoyer un SMS de test via l'app
- [ ] Vérifier réception sur téléphone

---

**Besoin d'aide ?** Consultez la [documentation officielle](https://smsgateway.me/docs).
