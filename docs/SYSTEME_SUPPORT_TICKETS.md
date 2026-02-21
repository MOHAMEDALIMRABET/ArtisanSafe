# Système de Support Tickets - ArtisanDispo

## 📋 Vue d'ensemble

Le système de support tickets permet aux artisans et clients de contacter l'équipe ArtisanDispo pour obtenir de l'aide, poser des questions ou résoudre des problèmes.

**Date implémentation** : 21 février 2026  
**Version** : 1.0

---

## 🎯 Fonctionnalités

### Côté Artisan/Client

1. **Création ticket** via formulaire `/artisan/contact-support`
2. **Catégories prédéfinies** :
   - 💳 Modification IBAN
   - ⚠️ Compte Restreint
   - 📄 Vérification Documents
   - 🔧 Problème Technique
   - ❓ Question Générale
   - 📌 Autre

3. **Suivi ticket** :
   - Numéro unique (ex: #2026-001)
   - Statuts : Ouvert → En cours → Résolu → Fermé
   - Notifications email à chaque réponse
   - Historique complet des échanges

4. **Conversation** :
   - Interface chat familière
   - Envoi/réception messages
   - Réponses en temps réel

### Côté Admin

1. **Dashboard tickets** `/admin/support-tickets`
2. **Statistiques** :
   - Total tickets
   - Tickets ouverts
   - Tickets en cours
   - Non vus (nouveaux)

3. **Filtres avancés** :
   - Par statut
   - Par catégorie
   - Par priorité
   - Non vus uniquement

4. **Gestion ticket** :
   - Changer statut (Ouvert/En cours/Résolu/Fermé)
   - Modifier priorité (Basse/Normale/Haute/Urgente)
   - Répondre à l'artisan
   - Assigner à un admin (futur)

5. **Notifications email** :
   - Email admin lors création ticket
   - Email artisan lors réponse

---

## 📁 Architecture Fichiers

### Frontend

```
frontend/src/
├── lib/firebase/
│   └── support-ticket-service.ts          # Service CRUD tickets (550 lignes)
├── app/
│   ├── artisan/
│   │   └── contact-support/
│   │       ├── page.tsx                   # Formulaire création ticket (450 lignes)
│   │       └── [id]/
│   │           └── page.tsx               # Détail ticket artisan (280 lignes)
│   └── admin/
│       └── support-tickets/
│           └── page.tsx                   # Dashboard admin (600 lignes)
```

### Backend

```
backend/src/
└── routes/
    └── support.routes.ts                  # Routes notifications email (180 lignes)
```

**Total** : ~2060 lignes de code

---

## 🔥 Collection Firestore

### `support_tickets`

```typescript
{
  numero: "#2026-001",                     // Unique ID
  
  // Demandeur
  userId: "artisan-uid-123",
  userEmail: "artisan@test.com",
  userNom: "Jean Dupont",
  userRole: "artisan" | "client",
  
  // Contenu
  categorie: "modification_iban",
  sujet: "Changement IBAN après changement de banque",
  message: "Bonjour, j'ai changé de banque...",
  
  // Statut
  statut: "ouvert" | "en_cours" | "resolu" | "ferme",
  priorite: "basse" | "normale" | "haute" | "urgente",
  
  // Conversation
  reponses: [
    {
      auteurId: "admin-uid-456",
      auteurNom: "Admin Support",
      auteurRole: "admin",
      message: "Bonjour, nous allons traiter...",
      dateReponse: Timestamp
    }
  ],
  
  dernierMessagePar: "admin" | "user",
  dernierMessageDate: Timestamp,
  
  // Admin
  assigneA?: "admin-uid-456",
  assigneNom?: "Marie Admin",
  vueParAdmin: false,                      // Nouveau ticket non vu
  nonLuParUser: false,                     // Réponse admin non lue
  
  // Dates
  createdAt: Timestamp,
  updatedAt: Timestamp,
  resoluAt?: Timestamp,
  fermeAt?: Timestamp
}
```

---

## 🚀 Workflow Utilisateur

### 1️⃣ Artisan crée un ticket

**Depuis** : Page `/artisan/wallet` → Bouton "📨 Contacter le support"

1. Clic bouton → Redirection `/artisan/contact-support?sujet=modification_iban`
2. Formulaire pré-rempli avec catégorie
3. Artisan remplit sujet + message détaillé
4. Soumission → Service `createSupportTicket()`
5. ✅ Ticket créé dans Firestore avec numéro #2026-XXX
6. 📧 Email automatique envoyé à `admin@artisandispo.fr`

**Email admin** :
```
Objet: [Support] Nouveau ticket #2026-001 - modification_iban
Corps:
  🎫 Nouveau Ticket Support
  
  Ticket #2026-001
  Catégorie: 💳 Modification IBAN
  Sujet: Changement IBAN après changement de banque
  De: Jean Dupont (artisan@test.com)
  
  [Bouton: 📋 Voir le ticket]
```

### 2️⃣ Admin répond au ticket

**Depuis** : Page `/admin/support-tickets`

1. Admin voit badge "Non vus: 1"
2. Clic sur ticket #2026-001
3. Lecture message artisan
4. Ticket marqué automatiquement "vu" (`vueParAdmin: true`)
5. Admin change statut : Ouvert → En cours
6. Admin écrit réponse dans textarea
7. Clic "📨 Envoyer la réponse"
8. ✅ Réponse ajoutée au tableau `reponses[]`
9. 📧 Email automatique envoyé à l'artisan

**Email artisan** :
```
Objet: [ArtisanDispo] Réponse à votre ticket #2026-001
Corps:
  📨 Réponse du Support
  
  Bonjour,
  
  Notre équipe a répondu à votre ticket #2026-001 :
  
  │ Pour modifier votre IBAN, merci de nous envoyer :
  │ - Nouveau RIB
  │ - Copie pièce d'identité
  │ Nous traiterons votre demande sous 24h.
  
  [Bouton: 💬 Voir la conversation]
```

### 3️⃣ Artisan répond

1. Artisan reçoit email → Clic "Voir la conversation"
2. Redirection `/artisan/contact-support/ticket-id-123`
3. Badge "Nouvelle réponse" sur ticket
4. Lecture réponse admin
5. Artisan écrit réponse
6. Soumission → `addTicketResponse()`
7. ✅ Réponse ajoutée
8. Notification admin (via email ou dashboard)

### 4️⃣ Résolution

1. Admin répond avec solution finale
2. Admin change statut : En cours → Résolu
3. 📧 Email artisan : "Ticket résolu"
4. Artisan peut :
   - Confirmer résolution
   - Répondre si problème persiste
   - Fermer ticket

5. Si inactivité 7 jours :
   - Statut automatique → Fermé (future Cloud Function)

---

## 🎨 Interface Utilisateur

### Page Formulaire Artisan

```
┌─────────────────────────────────────────────────────┐
│ ← Retour                                            │
│                                                     │
│ 💬 Contacter le Support                            │
│ Notre équipe vous répondra sous 24-48 heures       │
├─────────────────────────────────────────────────────┤
│ ┌──────────────────┐ ┌────────────────────────┐   │
│ │ 📝 Nouvelle      │ │ 📋 Mes demandes        │   │
│ │ demande          │ │                        │   │
│ │                  │ │ #2026-003 [ouvert]     │   │
│ │ Catégorie* [v]   │ │ Mon compte restreint   │   │
│ │ 💳 Modification  │ │ ⚠️ Compte Restreint    │   │
│ │ IBAN             │ │ 🔴 Nouvelle réponse    │   │
│ │                  │ │                        │   │
│ │ Sujet*           │ │ #2026-001 [en_cours]   │   │
│ │ [_____________]  │ │ Changement IBAN        │   │
│ │                  │ │ 💳 Modification IBAN   │   │
│ │ Message*         │ │                        │   │
│ │ [____________]   │ │ Voir tous (5)          │   │
│ │ [____________]   │ └────────────────────────┘   │
│ │ [____________]   │                              │
│ │                  │ ┌────────────────────────┐   │
│ │ [📨 Envoyer]     │ │ 💡 Info utile          │   │
│ │ [Annuler]        │ │ ✓ Réponse 24-48h       │   │
│ └──────────────────┘ │ ✓ Notification email   │   │
│                      │ ✓ Suivi complet        │   │
│                      └────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Dashboard Admin

```
┌──────────────────────────────────────────────────────────┐
│ 🎫 Support Tickets                                       │
│ Gestion des demandes utilisateurs                       │
├──────────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│ │ Total   │ │ Ouverts │ │ En cours│ │ Non vus │        │
│ │   15    │ │    3    │ │    5    │ │    2    │        │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘        │
│                                                          │
│ Filtres: [Statut v] [Catégorie v] ✓ Seulement non vus  │
├──────────────────────────────────────────────────────────┤
│ ┌────────────────┐ ┌──────────────────────────────────┐ │
│ │ Liste (12)     │ │ Détail Ticket                    │ │
│ │                │ │                                  │ │
│ │ 🔴 #2026-003   │ │ #2026-003 [En cours v] [Haute v]│ │
│ │ Compte         │ │ Mon compte Stripe restreint     │ │
│ │ restreint      │ │                                  │ │
│ │ [ouvert]       │ │ De: Jean Dupont (artisan@...)   │ │
│ │                │ │ Catégorie: ⚠️ Compte Restreint  │ │
│ │ #2026-002      │ │ Créé: 21/02/2026 14:30          │ │
│ │ Question doc   │ ├──────────────────────────────────┤ │
│ │ [en_cours]     │ │ 💬 Conversation                 │ │
│ │                │ │                                  │ │
│ │ #2026-001      │ │ [Message artisan initial]       │ │
│ │ Modification   │ │ [Réponse admin]                 │ │
│ │ IBAN           │ │ [Réponse artisan]               │ │
│ │ [resolu]       │ │                                  │ │
│ └────────────────┘ ├──────────────────────────────────┤ │
│                    │ Votre réponse:                   │ │
│                    │ [________________________]       │ │
│                    │ [________________________]       │ │
│                    │ 💡 Email notification            │ │
│                    │        [📨 Envoyer la réponse]   │ │
│                    └──────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

## 📧 Configuration Email

### Variables Environnement Backend

```bash
# .env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=support@artisandispo.fr
SMTP_PASSWORD=votre_mot_de_passe_app

ADMIN_EMAIL=admin@artisandispo.fr
FRONTEND_URL=https://artisandispo.fr
```

### Nodemailer Configuration

```typescript
const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // TLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});
```

---

## 🔌 API Endpoints

### POST `/api/v1/support/notify-new-ticket`

**Description** : Envoyer email admin lors création ticket

**Body** :
```json
{
  "ticketId": "abc123",
  "numero": "#2026-001",
  "categorie": "modification_iban",
  "sujet": "Changement IBAN",
  "userEmail": "artisan@test.com",
  "userNom": "Jean Dupont"
}
```

**Réponse** :
```json
{
  "success": true,
  "message": "Notification envoyée"
}
```

### POST `/api/v1/support/notify-user-response`

**Description** : Envoyer email artisan lors réponse admin

**Body** :
```json
{
  "ticketId": "abc123",
  "numero": "#2026-001",
  "userEmail": "artisan@test.com",
  "message": "Pour modifier votre IBAN..."
}
```

**Réponse** :
```json
{
  "success": true,
  "message": "Notification envoyée"
}
```

---

## 🧪 Tests Manuels

### Test 1 : Création ticket artisan

1. Se connecter comme artisan
2. Aller sur `/artisan/wallet`
3. Cliquer "📨 Contacter le support"
4. ✅ Vérifier : Redirection `/artisan/contact-support?sujet=modification_iban`
5. ✅ Vérifier : Catégorie pré-sélectionnée "💳 Modification IBAN"
6. Remplir sujet + message
7. Cliquer "📨 Envoyer la demande"
8. ✅ Vérifier : Message succès vert s'affiche
9. ✅ Vérifier : Ticket apparaît dans colonne "Mes demandes"
10. ✅ Vérifier : Email reçu à `admin@artisandispo.fr`

### Test 2 : Réponse admin

1. Se connecter comme admin
2. Aller sur `/admin/support-tickets`
3. ✅ Vérifier : Badge "Non vus: 1" (orange)
4. Cliquer sur ticket #2026-001
5. ✅ Vérifier : Message artisan affiché
6. ✅ Vérifier : Badge "Non vus" décrémente
7. Changer statut "Ouvert" → "En cours"
8. Écrire réponse dans textarea
9. Cliquer "📨 Envoyer la réponse"
10. ✅ Vérifier : Réponse ajoutée conversation
11. ✅ Vérifier : Email reçu par artisan

### Test 3 : Conversation artisan

1. Se connecter comme artisan
2. Aller sur `/artisan/contact-support`
3. ✅ Vérifier : Badge "Nouvelle réponse" sur ticket
4. Cliquer sur ticket #2026-001
5. ✅ Vérifier : Redirection `/artisan/contact-support/ticket-id-123`
6. ✅ Vérifier : Réponse admin affichée (fond orange)
7. Écrire réponse artisan
8. Cliquer "📨 Envoyer"
9. ✅ Vérifier : Réponse ajoutée (fond bleu)
10. ✅ Vérifier : Admin notifié (dashboard)

### Test 4 : Clôture ticket

1. Admin change statut "En cours" → "Résolu"
2. ✅ Vérifier : Badge vert "Résolu"
3. Admin ferme ticket "Résolu" → "Fermé"
4. ✅ Vérifier : Message "Ce ticket est fermé" côté artisan
5. ✅ Vérifier : Textarea réponse désactivée

---

## 📊 Métriques Admin (Future)

### KPI à tracker

- **Temps de première réponse** : Moyenne temps admin répond
- **Temps de résolution** : Moyenne création → résolution
- **Satisfaction** : Note artisan après résolution (future)
- **Volume** : Tickets/jour, tickets/catégorie

### Dashboard Stats (Future Enhancement)

```typescript
export async function getSupportTicketStats(): Promise<{
  totalTickets: number;
  ouverts: number;
  enCours: number;
  resolus: number;
  fermes: number;
  tempsReponseMoyen: number; // minutes
  tempsResolutionMoyen: number; // heures
  parCategorie: Record<SupportTicketCategorie, number>;
  parPriorite: Record<SupportTicketPriorite, number>;
}> {
  // Implémentation future
}
```

---

## 🚀 Améliorations Futures

### Phase 2 (Priorité moyenne)

1. **Pièces jointes** :
   - Upload fichiers (RIB, captures d'écran)
   - Stockage Firebase Storage
   - Affichage dans conversation

2. **Assignation tickets** :
   - Assigner ticket à admin spécifique
   - Filtrer "Mes tickets assignés"
   - Notifications push admin

3. **Templates réponse** :
   - Bibliothèque réponses rapides
   - Ex: "Modification IBAN : Merci de nous envoyer..."
   - Gain de temps admin

4. **Recherche tickets** :
   - Recherche par numéro, sujet, email
   - Filtres avancés (date, admin assigné)

### Phase 3 (Long terme)

1. **Chat en direct** :
   - WebSocket pour temps réel
   - Typing indicators
   - Statut "Admin en ligne"

2. **Base de connaissances** :
   - FAQ publique
   - Articles aide
   - Réduire volume tickets

3. **Escalade automatique** :
   - Si pas de réponse 48h → Priorité "Haute"
   - Si compte restreint → Priorité "Urgente"

4. **Satisfaction client** :
   - Note après résolution (1-5 étoiles)
   - Feedback optionnel
   - Métriques qualité support

---

## 🔒 Sécurité & Permissions

### Règles Firestore

```javascript
// firestore.rules
match /support_tickets/{ticketId} {
  // Artisan : Lire UNIQUEMENT ses propres tickets
  allow read: if request.auth != null && 
                 resource.data.userId == request.auth.uid;
  
  // Artisan : Créer ticket
  allow create: if request.auth != null;
  
  // Artisan : Ajouter réponse à son ticket
  allow update: if request.auth != null && 
                   resource.data.userId == request.auth.uid;
  
  // Admin : Accès complet
  allow read, write: if request.auth != null && 
                        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
}
```

### Validation Backend

- ✅ Vérifier `userId` correspond à l'utilisateur connecté
- ✅ Sanitizer messages (XSS)
- ✅ Rate limiting création tickets (max 5/jour)
- ✅ Vérifier longueur messages (max 2000 caractères)

---

## 📝 Logs & Monitoring

### Logs importants

```typescript
// Création ticket
console.log('✅ Ticket créé:', numero, ticketId);

// Email envoyé
console.log('📧 Email admin envoyé pour ticket', numero);

// Réponse ajoutée
console.log('✅ Réponse ajoutée au ticket', ticketId);

// Erreurs
console.error('❌ Erreur création ticket:', error);
console.warn('⚠️ Notification email admin échouée:', emailError);
```

### Alertes à configurer

- ⚠️ Tickets non vus > 10
- ⚠️ Tickets ouverts > 3 jours
- ⚠️ Email notification échouée
- ⚠️ Ticket priorité "Urgente" non vu

---

## 🎯 Cas d'Usage Principaux

### 1. Modification IBAN (50% tickets estimés)

**Workflow** :
1. Artisan clique bouton depuis wallet
2. Ticket pré-rempli catégorie "Modification IBAN"
3. Admin demande : Nouveau RIB + Pièce d'identité
4. Artisan upload pièces jointes (future)
5. Admin modifie IBAN dans Stripe Dashboard
6. Admin confirme + ferme ticket
7. Artisan notifié → Nouveau paiement OK

### 2. Compte Stripe Restreint (20% tickets)

**Workflow** :
1. Artisan reçoit notification Stripe
2. Compte bloqué → Création ticket priorité "Haute"
3. Admin consulte raison (Stripe Dashboard)
4. Admin demande documents complémentaires
5. Artisan fournit documents
6. Admin upload dans Stripe
7. Stripe lève restriction
8. Admin notifie artisan + clôture ticket

### 3. Question Vérification Documents (15% tickets)

**Workflow** :
1. Artisan upload KBIS flou
2. Admin rejette → Artisan crée ticket
3. Admin explique : "SIRET illisible, merci de re-uploader"
4. Artisan comprend problème
5. Re-upload document correct
6. Admin approuve
7. Ticket résolu

---

## 📚 Documentation Liée

- [Firebase Structure](./FIREBASE.md) - Collection `support_tickets`
- [Stripe Connect Phase 2](./STRIPE_CONNECT_PHASE2_COMPLETE.md) - Contexte IBAN
- [Email Configuration](./SYSTEME_EMAILS_PLATEFORME.md) - Setup SMTP

---

## ✅ Checklist Déploiement

- [x] Service support-ticket-service.ts créé
- [x] Page formulaire artisan créée
- [x] Page détail ticket artisan créée
- [x] Page dashboard admin créée
- [x] Routes backend notifications email
- [x] Intégration server.ts
- [x] Bouton wallet → contact support
- [x] Tests manuels (4 scénarios)
- [ ] Configuration SMTP production
- [ ] Firestore rules support_tickets
- [ ] Monitoring erreurs email
- [ ] Documentation admin interne

---

**Auteur** : Équipe Technique ArtisanDispo  
**Dernière mise à jour** : 21 février 2026
