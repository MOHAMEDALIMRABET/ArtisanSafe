# 🛠️ ArtisanSafe

## 📋 Description

**ArtisanSafe** est une plateforme innovante de mise en relation entre clients et artisans qualifiés.  Notre solution facilite la connexion entre les particuliers et professionnels recherchant des services artisanaux et les artisans compétents dans divers domaines (plomberie, électricité, menuiserie, maçonnerie, etc.).

### 🎯 Objectifs

- **Pour les clients** : Trouver rapidement des artisans qualifiés, vérifiés et de confiance près de chez eux
- **Pour les artisans** : Développer leur visibilité, accéder à de nouvelles opportunités et gérer leurs prestations efficacement
- **Sécurité** : Garantir des transactions sûres et transparentes entre les deux parties

## ✨ Fonctionnalités principales

### Pour les clients
- 🔍 Recherche d'artisans par métier, localisation et disponibilité
- ⭐ Consultation des profils, avis et évaluations
- 📅 Demande de devis en ligne
- 💬 Messagerie intégrée pour communiquer avec les artisans
- 💳 Paiement sécurisé
- 📊 Suivi des demandes et interventions

### Pour les artisans
- 👤 Création de profil professionnel détaillé
- 📸 Portfolio de réalisations
- 📨 Réception et gestion des demandes de devis
- 🗓️ Gestion d'agenda et disponibilités
- 💰 Gestion des paiements et facturation
- 📈 Statistiques et suivi d'activité

### Sécurité et confiance
- ✅ Vérification des identités et qualifications
- 🛡️ Système d'évaluation et d'avis vérifiés
- 🔒 Paiement sécurisé avec système d'escrow
- 📜 Contrats et conditions standardisés
- 🆘 Service de médiation en cas de litige

## 🚀 Technologies envisagées

### Frontend
- React.js / Next.js
- TailwindCSS / Material-UI
- Redux / Context API

### Backend
- Node. js + Express
- Python + Django/Flask
- ou NestJS

### Base de données
- PostgreSQL / MySQL
- MongoDB (pour données non-structurées)

### Services tiers
- Authentification :  Firebase Auth / Auth0
- Paiements : Stripe / PayPal
- Géolocalisation : Google Maps API / Mapbox
- Notifications : Firebase Cloud Messaging
- Stockage fichiers : AWS S3 / Cloudinary

## 📦 Installation

### 🚀 Pour les testeurs et développeurs

📖 **Guide d'installation complet** : Consultez [INSTALLATION.md](INSTALLATION.md) pour une configuration détaillée pas à pas.

**Résumé rapide :**

```bash
# 1. Cloner le repository
git clone https://github.com/MOHAMEDALIMRABET/ArtisanSafe.git
cd ArtisanSafe

# 2. Vérifier la configuration
node verify-setup.js
# ou sur Windows PowerShell :
# .\verify-setup.ps1

# 3. Configuration Frontend
cd frontend
npm install
# Créer .env.local avec les credentials Firebase (voir INSTALLATION.md)

# 4. Configuration Backend
cd ../backend
npm install
# Créer .env avec les credentials Firebase Admin (voir INSTALLATION.md)

# 5. Démarrer l'application
# Terminal 1 - Frontend
cd frontend && npm run dev  # http://localhost:3000

# Terminal 2 - Backend
cd backend && npm run dev   # http://localhost:5000
```

⚠️ **Important** : Vous devez obtenir les credentials Firebase auprès de l'administrateur du projet avant de pouvoir utiliser l'application. Voir [docs/ADMIN_CREDENTIALS_SHARING.md](docs/ADMIN_CREDENTIALS_SHARING.md) pour les administrateurs.

## 🏗️ Structure du projet

```
ArtisanSafe/
├── frontend/          # Application client
├── backend/           # API et logique serveur
├── mobile/            # Application mobile (optionnel)
├── docs/              # Documentation
├── tests/             # Tests unitaires et d'intégration
└── scripts/           # Scripts utilitaires
```

## 🗺️ Roadmap

### Phase 1 - MVP (Minimum Viable Product)
- [ ] Inscription/Connexion utilisateurs (clients et artisans)
- [ ] Profils artisans avec portfolio
- [ ] Recherche basique d'artisans
- [ ] Système de demande de devis
- [ ] Messagerie simple

### Phase 2 - Fonctionnalités avancées
- [ ] Système de paiement intégré
- [ ] Avis et évaluations
- [ ] Géolocalisation avancée
- [ ] Notifications en temps réel
- [ ] Application mobile

### Phase 3 - Optimisation
- [ ] Intelligence artificielle pour recommandations
- [ ] Système de fidélité
- [ ] API publique pour partenaires
- [ ] Dashboard analytics avancé

## 👥 Contribution

Les contributions sont les bienvenues ! Pour contribuer :

1. Forkez le projet
2. Créez une branche pour votre fonctionnalité (`git checkout -b feature/NouvelleFonctionnalite`)
3. Committez vos changements (`git commit -m 'Ajout d'une nouvelle fonctionnalité'`)
4. Poussez vers la branche (`git push origin feature/NouvelleFonctionnalite`)
5. Ouvrez une Pull Request

## 📄 Licence

Ce projet est sous licence MIT - voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 📞 Contact

**MOHAMEDALIMRABET** - [@MOHAMEDALIMRABET](https://github.com/MOHAMEDALIMRABET)

Lien du projet : [https://github.com/MOHAMEDALIMRABET/ArtisanSafe](https://github.com/MOHAMEDALIMRABET/ArtisanSafe)

## 🙏 Remerciements

- Tous les contributeurs du projet
- La communauté open source
- Les artisans et clients qui font confiance à notre plateforme

---

**ArtisanSafe** - *Connecter le savoir-faire à ceux qui en ont besoin* 🔨