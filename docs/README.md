# 📚 Documentation ArtisanSafe

Index complet de la documentation du projet.

---

## 🆕 Nouveautés - Signature Électronique + Paiement

### Guides Rapides (Commencer ici)

| Document | Description | Public |
|----------|-------------|--------|
| **[GUIDE_EQUIPE_SIGNATURE_PAIEMENT.md](./GUIDE_EQUIPE_SIGNATURE_PAIEMENT.md)** | Guide rapide pour l'équipe (5 min) | 👥 Équipe complète |
| **[MIGRATION_CLOUD_FUNCTION.md](./MIGRATION_CLOUD_FUNCTION.md)** | Déployer Cloud Function (5 min) | 🔧 DevOps |
| **[WORKFLOW_SIGNATURE_PAIEMENT.md](./WORKFLOW_SIGNATURE_PAIEMENT.md)** | Workflow complet + diagrammes | 📖 Tous |

### Documentation Technique

| Document | Description | Public |
|----------|-------------|--------|
| **[RECAP_IMPLEMENTATION.md](./RECAP_IMPLEMENTATION.md)** | Récap complet implémentation | 💻 Développeurs |
| **[SIGNATURE_ELECTRONIQUE.md](./SIGNATURE_ELECTRONIQUE.md)** | Architecture technique signature + paiement | 💻 Développeurs |
| **[TODO_CLOUD_FUNCTION_ANNULATION_DEVIS.md](./TODO_CLOUD_FUNCTION_ANNULATION_DEVIS.md)** | Implémentation Cloud Function annulation 24h | 🔧 Backend |
| **[DEPLOY_CLOUD_FUNCTION.md](./DEPLOY_CLOUD_FUNCTION.md)** | Guide déploiement Cloud Function | 🔧 DevOps |

### Guides Utilisateurs

| Document | Description | Public |
|----------|-------------|--------|
| **[GUIDE_SIGNATURE_CLIENT.md](./GUIDE_SIGNATURE_CLIENT.md)** | Guide utilisateur signature | 👤 Clients |

---

## 📁 Documentation par Catégorie

### 🏗️ Architecture

| Document | Description |
|----------|-------------|
| [ARCHITECTURE_TECHNIQUE.md](./ARCHITECTURE_TECHNIQUE.md) | Vue d'ensemble stack technique |
| [ARCHITECTURE_FONCTIONNELLE.md](./ARCHITECTURE_FONCTIONNELLE.md) | Schéma fonctionnel workflows |
| [FIREBASE.md](./FIREBASE.md) | Structure Firestore complète |

### 🔐 Authentification & Sécurité

| Document | Description |
|----------|-------------|
| [EMAIL_VERIFICATION_WORKFLOW.md](./EMAIL_VERIFICATION_WORKFLOW.md) | Validation email client/artisan |
| [FIREBASE_EMAIL_VERIFICATION_SETUP.md](./FIREBASE_EMAIL_VERIFICATION_SETUP.md) | Configuration Firebase Auth |
| [ADMIN_FIRESTORE_RULES.md](./ADMIN_FIRESTORE_RULES.md) | Règles sécurité Firestore |
| [VALIDATION_ANTI_CONTOURNEMENT.md](./VALIDATION_ANTI_CONTOURNEMENT.md) | Anti-bypass messagerie |

### 💼 Workflows Métier

| Document | Description |
|----------|-------------|
| **[WORKFLOW_SIGNATURE_PAIEMENT.md](./WORKFLOW_SIGNATURE_PAIEMENT.md)** | ⭐ Signature + Paiement (NOUVEAU) |
| [WORKFLOW_CLIENT_DEVIS.md](./WORKFLOW_CLIENT_DEVIS.md) | Cycle complet demande → devis |
| [WORKFLOW_POST_ACCEPTANCE_SEQUESTRE.md](./WORKFLOW_POST_ACCEPTANCE_SEQUESTRE.md) | Paiement séquestre (futur) |
| [DEVIS_ALTERNATIFS.md](./DEVIS_ALTERNATIFS.md) | Gestion variantes devis |

### 🔍 Vérification Documents

| Document | Description |
|----------|-------------|
| [KBIS_VERIFICATION_AUTOMATIQUE.md](./KBIS_VERIFICATION_AUTOMATIQUE.md) | OCR Tesseract.js + validation SIRET |
| [SIRET_VERIFICATION_COMPLETE.md](./SIRET_VERIFICATION_COMPLETE.md) | Process vérification SIRET |
| [REPRESENTANT_LEGAL_VERIFICATION.md](./REPRESENTANT_LEGAL_VERIFICATION.md) | Validation représentant légal |
| [PARSING_AVANCE_KBIS.md](./PARSING_AVANCE_KBIS.md) | Extraction données KBIS |
| [LOGS_VERIFICATION_SIRET.md](./LOGS_VERIFICATION_SIRET.md) | Logs debug vérification |

### 📧 Notifications & Communication

| Document | Description |
|----------|-------------|
| [SYSTEME_NOTIFICATIONS.md](./SYSTEME_NOTIFICATIONS.md) | Architecture notifications temps réel |
| [NOTIFICATIONS_DEVIS.md](./NOTIFICATIONS_DEVIS.md) | Notifications cycle devis |
| [REJECTION_NOTIFICATIONS.md](./REJECTION_NOTIFICATIONS.md) | Notifications refus devis |
| [HISTORISATION_CONVERSATIONS.md](./HISTORISATION_CONVERSATIONS.md) | Archivage conversations |
| [EMAIL_DELIVERABILITY_GUIDE.md](./EMAIL_DELIVERABILITY_GUIDE.md) | Délivrabilité emails |
| [EMAIL_TEMPLATE_CREDENTIALS.md](./EMAIL_TEMPLATE_CREDENTIALS.md) | Templates emails Firebase |

### 🔧 Administration

| Document | Description |
|----------|-------------|
| [ADMIN_CREDENTIALS_SHARING.md](./ADMIN_CREDENTIALS_SHARING.md) | Partage credentials Firebase |
| [ADMIN_UPLOAD_HISTORY.md](./ADMIN_UPLOAD_HISTORY.md) | Historique uploads documents |
| [ACCOUNT_DELETION_GUIDE.md](./ACCOUNT_DELETION_GUIDE.md) | Suppression comptes (RGPD) |
| [ACCOUNT_DELETION_IMPLEMENTATION.md](./ACCOUNT_DELETION_IMPLEMENTATION.md) | Implémentation suppression |

### 🔎 Recherche & Géolocalisation

| Document | Description |
|----------|-------------|
| [RECHERCHE_INTELLIGENTE.md](./RECHERCHE_INTELLIGENTE.md) | Recherche artisans avancée |
| [DIAGNOSTIC_RECHERCHE.md](./DIAGNOSTIC_RECHERCHE.md) | Diagnostic problèmes recherche |
| [DEPANNAGE_RECHERCHE.md](./DEPANNAGE_RECHERCHE.md) | Troubleshooting recherche |
| [TEST_RECHERCHE.md](./TEST_RECHERCHE.md) | Tests recherche |

### 🐛 Fixes & Troubleshooting

| Document | Description |
|----------|-------------|
| [FIX_VALIDATION_TELEPHONE_COLLE.md](./FIX_VALIDATION_TELEPHONE_COLLE.md) | Fix numéros collés lettres |
| [FIX_TELEPHONE_FRAGMENTE.md](./FIX_TELEPHONE_FRAGMENTE.md) | Fix numéros fragmentés |
| [FIX_CORS_UPLOAD.md](./FIX_CORS_UPLOAD.md) | Configuration CORS Storage |
| [FIX_BOUCLE_INFINIE_VERIFICATION.md](./FIX_BOUCLE_INFINIE_VERIFICATION.md) | Fix boucles re-render |
| [DEPANNAGE_BOUCLE_INFINIE.md](./DEPANNAGE_BOUCLE_INFINIE.md) | Troubleshooting boucles |
| [NETTOYAGE_CACHE_RAPIDE.md](./NETTOYAGE_CACHE_RAPIDE.md) | Vider cache développement |
| [NETTOYAGE_VERIFICATION.md](./NETTOYAGE_VERIFICATION.md) | Nettoyage données vérification |
| [SIRENE_ERROR_RESOLUTION.md](./SIRENE_ERROR_RESOLUTION.md) | Résolution erreurs API SIRENE |

### 📊 Systèmes Avancés

| Document | Description |
|----------|-------------|
| [SYSTEME_VARIANTES_PROGRESSIF.md](./SYSTEME_VARIANTES_PROGRESSIF.md) | Variantes devis progressives |
| [FIX_VARIANTES_AUTOMATIQUES.md](./FIX_VARIANTES_AUTOMATIQUES.md) | Fix variantes auto |
| [FIX_VARIANTES_NUMEROTATION.md](./FIX_VARIANTES_NUMEROTATION.md) | Fix numérotation variantes |
| [TASK-3.2-AGENDA.md](./TASK-3.2-AGENDA.md) | Agenda disponibilités artisans |

### 🔗 APIs & Intégrations

| Document | Description |
|----------|-------------|
| [API_SIRENE_ALTERNATIVES.md](./API_SIRENE_ALTERNATIVES.md) | Alternatives API SIRENE |
| [SMS_GATEWAY_SETUP.md](./SMS_GATEWAY_SETUP.md) | Configuration passerelle SMS |
| [QUICKSTART_SMS.md](./QUICKSTART_SMS.md) | Quick start SMS |

### 📝 Guides Credentials

| Document | Description |
|----------|-------------|
| [FIREBASE_CREDENTIALS_GUIDE.md](./FIREBASE_CREDENTIALS_GUIDE.md) | Guide credentials Firebase |

### 🧪 Rapports & Audits

| Document | Description |
|----------|-------------|
| [RAPPORT_COHERENCE_VERIFICATION.md](./RAPPORT_COHERENCE_VERIFICATION.md) | Audit cohérence vérification |
| [AUDIT_NOTIFICATIONS.md](./AUDIT_NOTIFICATIONS.md) | Audit système notifications |

---

## 🚀 Quick Start (Nouveaux Développeurs)

### 1. Comprendre le Projet (30 min)

1. **[ARCHITECTURE_TECHNIQUE.md](./ARCHITECTURE_TECHNIQUE.md)** - Vue d'ensemble stack
2. **[FIREBASE.md](./FIREBASE.md)** - Structure données Firestore
3. **[WORKFLOW_CLIENT_DEVIS.md](./WORKFLOW_CLIENT_DEVIS.md)** - Workflow principal

### 2. Configurer Environnement (15 min)

1. **[FIREBASE_CREDENTIALS_GUIDE.md](./FIREBASE_CREDENTIALS_GUIDE.md)** - Credentials Firebase
2. **[ADMIN_CREDENTIALS_SHARING.md](./ADMIN_CREDENTIALS_SHARING.md)** - Accès admin
3. Lire `README.md` racine projet

### 3. Fonctionnalités Clés (1h)

1. **[WORKFLOW_SIGNATURE_PAIEMENT.md](./WORKFLOW_SIGNATURE_PAIEMENT.md)** - Signature + Paiement (NOUVEAU)
2. **[KBIS_VERIFICATION_AUTOMATIQUE.md](./KBIS_VERIFICATION_AUTOMATIQUE.md)** - Vérification documents
3. **[SYSTEME_NOTIFICATIONS.md](./SYSTEME_NOTIFICATIONS.md)** - Notifications temps réel

### 4. Déployer (30 min)

1. **[MIGRATION_CLOUD_FUNCTION.md](./MIGRATION_CLOUD_FUNCTION.md)** - Cloud Function annulation 24h
2. Suivre checklist déploiement

---

## 📞 Support

**Questions** : Lire d'abord la documentation ci-dessus.

**Bugs** : Vérifier section "Fixes & Troubleshooting".

**Contact** :
- Slack : #dev-artisandispo
- Email : dev@artisandispo.fr

---

**Dernière mise à jour** : 2026-02-01  
**Nombre documents** : 50+ fichiers markdown  
**Taille totale** : ~15000 lignes documentation
