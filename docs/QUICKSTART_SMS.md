# Guide de configuration rapide - Twilio SMS

## 🎯 Configuration en 5 minutes

### 1. Créer un compte Twilio (GRATUIT)
- Aller sur **https://www.twilio.com/try-twilio**
- Cliquer "Sign up for free"
- Remplir le formulaire et vérifier votre email
- Vérifier votre téléphone (code SMS)
- **✅ $15 de crédit offert !**

### 2. Récupérer vos credentials
**Dans le Dashboard Twilio :**
- **Account SID** : Copier depuis la page d'accueil
- **Auth Token** : Cliquer "Show" et copier
- **Phone Number** : Acheter un numéro (+33 France)
  - Menu → Phone Numbers → Buy a Number
  - Cocher "SMS", chercher, acheter (gratuit avec crédit)

### 3. Configurer le backend
```bash
cd backend

# Ajouter dans le fichier .env (créer si n'existe pas)
echo "TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" >> .env
echo "TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" >> .env
echo "TWILIO_PHONE_NUMBER=+33XXXXXXXXX" >> .env

# Redémarrer le serveur
npm run dev
```

### 4. Tester
```bash
# Tester la configuration
curl http://localhost:5000/api/v1/sms/status

# Envoyer un SMS de test
curl -X POST http://localhost:5000/api/v1/sms/send-verification-code \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+33612345678", "code": "123456"}'
```

**✅ C'est tout !** Vous pouvez maintenant envoyer des SMS depuis votre application.

**💡 Crédit gratuit :** $15 = environ 100-150 SMS en France

**📖 Documentation complète :** Voir [SMS_GATEWAY_SETUP.md](./SMS_GATEWAY_SETUP.md)
