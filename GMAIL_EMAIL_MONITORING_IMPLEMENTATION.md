# 📊 Système de Monitoring Emails Gmail - Implémentation Complète

**Date** : 20 février 2026  
**Statut** : ✅ **OPÉRATIONNEL**

---

## 🎯 OBJECTIF

Gérer et suivre en temps réel le nombre d'emails envoyés par Gmail SMTP pour :
1. **Monitoring volume** : Tracker emails envoyés/jour
2. **Logging détaillé** : Enregistrer chaque email (destinataire, sujet, statut)
3. **Alertes automatiques** : Notifier admin si seuils dépassés (300, 400, 450, 500 emails/jour)
4. **Dashboard admin** : Visualiser stats en temps réel

---

## 🏗️ ARCHITECTURE IMPLÉMENTÉE

### Vue d'ensemble

```
┌─────────────────────────────────────────────────────┐
│  1. Email envoyé (Gmail SMTP)                       │
│     └─> emailTrackingService.logEmail()             │
│                                                      │
│  2. Sauvegarde Firestore                            │
│     ├─> Collection: email_logs (détails)            │
│     └─> Collection: email_stats_daily (agrégats)    │
│                                                      │
│  3. Vérification seuils                             │
│     ├─> 300 emails → Alerte niveau 1 (60%)          │
│     ├─> 400 emails → Alerte niveau 2 (80%)          │
│     ├─> 450 emails → Alerte niveau 3 (90%)          │
│     └─> 500 emails → Alerte limite atteinte         │
│                                                      │
│  4. Notification admin                              │
│     ├─> Collection: email_alerts                    │
│     └─> Collection: notifications (badge admin)     │
│                                                      │
│  5. Dashboard admin                                 │
│     └─> /admin/email-monitoring                     │
└─────────────────────────────────────────────────────┘
```

---

## 📁 FICHIERS CRÉÉS/MODIFIÉS

### Backend (Node.js + Express)

#### 1. `backend/src/services/email-tracking.service.ts` (NOUVEAU - 500+ lignes)

**Responsabilités** :
- Logger chaque email envoyé
- Mettre à jour statistiques journalières
- Vérifier seuils et déclencher alertes
- Fournir API pour récupérer stats

**Fonctions principales** :

```typescript
// Logger un email
await emailTrackingService.logEmail({
  recipient: 'client@example.com',
  subject: 'Nouveau devis reçu',
  type: 'transactional',
  provider: 'gmail',
  status: 'sent'
});

// Récupérer stats du jour
const stats = await emailTrackingService.getTodayStats();

// Rapport hebdomadaire
const report = await emailTrackingService.getWeeklyReport();

// Logs récents
const logs = await emailTrackingService.getRecentLogs(50);

// Alertes actives
const alerts = await emailTrackingService.getActiveAlerts();
```

**Seuils d'alerte** :
- **300 emails/jour (60%)** : ⚠️ Warning - "Surveiller de près"
- **400 emails/jour (80%)** : 🚨 Critical - "Migrer Brevo sous 24-48h"
- **450 emails/jour (90%)** : 🔥 Danger - "Migration URGENTE"
- **500 emails/jour (100%)** : ❌ Limite atteinte - "Compte peut être suspendu"

---

#### 2. `backend/src/services/email-service.ts` (MODIFIÉ)

**Changements** :
- Import `emailTrackingService`
- Ajout logging automatique après chaque envoi Gmail
- Logging échecs d'envoi

**Avant** :
```typescript
const info = await transporter.sendMail(mailOptions);
console.log(`✅ Email envoyé`);
return true;
```

**Après** :
```typescript
const info = await transporter.sendMail(mailOptions);
console.log(`✅ Email envoyé`);

// 📊 Logger l'email envoyé
await emailTrackingService.logEmail({
  recipient: emailData.to,
  subject: emailData.subject,
  type: emailData.type || 'transactional',
  provider: 'gmail',
  status: 'sent',
  metadata: { messageId: info.messageId }
});

return true;
```

---

#### 3. `backend/src/routes/admin-email-monitoring.routes.ts` (NOUVEAU)

**Endpoints API** :

```typescript
// Stats du jour
GET /api/v1/admin/email-stats/today

// Stats période
GET /api/v1/admin/email-stats/range?startDate=2026-02-01&endDate=2026-02-20

// Rapport hebdomadaire
GET /api/v1/admin/email-stats/weekly-report

// Logs récents
GET /api/v1/admin/email-logs?limit=50

// Alertes actives
GET /api/v1/admin/email-alerts

// Marquer alerte comme lue
POST /api/v1/admin/email-alerts/:alertId/read
```

**Exemple réponse** `/api/v1/admin/email-stats/today` :
```json
{
  "date": "2026-02-20",
  "totalSent": 245,
  "totalFailed": 3,
  "byProvider": {
    "gmail": 220,
    "firebase": 25,
    "brevo": 0
  },
  "byType": {
    "transactional": 180,
    "notification": 60,
    "auth": 5,
    "system": 3
  }
}
```

---

#### 4. `backend/src/server.ts` (MODIFIÉ)

**Changements** :
- Import route `admin-email-monitoring.routes`
- Ajout route `/api/v1/admin/*`

```typescript
import adminEmailMonitoringRoutes from './routes/admin-email-monitoring.routes';

// Routes Admin - Monitoring Emails
app.use('/api/v1/admin', adminEmailMonitoringRoutes);
```

---

### Frontend (Next.js 15 + React)

#### 5. `frontend/src/app/admin/email-monitoring/page.tsx` (NOUVEAU - 600+ lignes)

**Dashboard admin complet avec** :

**1. Jauge Gmail en temps réel**
```
┌─────────────────────────────────────────────┐
│  📧 Limite Gmail Aujourd'hui                │
│                                             │
│  245 / 500                          49%     │
│  [████████████░░░░░░░░░░░░░░░░]            │
│                                             │
│  ✅ OK : Volume normal                      │
│  Capacité Gmail suffisante pour aujourd'hui │
└─────────────────────────────────────────────┘
```

**2. Alertes visuelles** :
- Vert (0-299) : Volume normal ✅
- Jaune (300-399) : Attention ⚠️
- Orange (400-449) : Critique 🚨
- Rouge (450-500) : Urgence 🔥

**3. Statistiques détaillées** :
- Emails envoyés vs échecs
- Répartition par provider (Gmail/Firebase/Brevo)
- Répartition par type (transactionnel/notification/auth/system)

**4. Rapport hebdomadaire** :
- Total 7 derniers jours
- Moyenne par jour
- Pic journalier
- Tendance (hausse/baisse/stable)

**5. Tableau logs récents** :
- 50 derniers emails
- Date/heure, destinataire, sujet
- Type, provider, statut

**6. Actualisation automatique** :
- Rafraîchit toutes les 60 secondes
- Bouton refresh manuel

---

## 🗄️ COLLECTIONS FIRESTORE CRÉÉES

### 1. `email_logs` (Logs détaillés)

**Structure document** :
```typescript
{
  timestamp: Timestamp,
  recipient: "client@example.com",
  subject: "Nouveau devis reçu",
  type: "transactional" | "notification" | "auth" | "system",
  provider: "gmail" | "firebase" | "brevo",
  status: "sent" | "failed" | "queued",
  error?: "Connection timeout",
  metadata?: {
    templateId: "devis-recu",
    userId: "abc123",
    relatedEntity: "devis-2026-001"
  }
}
```

**Utilité** : Audit trail complet, debugging, conformité RGPD

---

### 2. `email_stats_daily` (Statistiques agrégées)

**ID document** : `YYYY-MM-DD` (ex: `2026-02-20`)

**Structure document** :
```typescript
{
  date: "2026-02-20",
  totalSent: 245,
  totalFailed: 3,
  byProvider: {
    gmail: 220,
    firebase: 25,
    brevo: 0
  },
  byType: {
    transactional: 180,
    notification: 60,
    auth: 5,
    system: 3
  },
  timestamp: Timestamp
}
```

**Utilité** : Requêtes rapides, graphiques historiques, rapports

---

### 3. `email_alerts` (Alertes admin)

**Structure document** :
```typescript
{
  level: "warning" | "critical" | "danger",
  threshold: 300,
  current: 305,
  limit: 500,
  percentage: 61,
  message: "⚠️ Limite Gmail atteinte à 60% (305/500 emails)",
  recommendation: "Surveiller de près. Planifier migration Brevo si tendance continue.",
  timestamp: Timestamp,
  isRead: false
}
```

**Utilité** : Historique alertes, notifications admin

---

### 4. `notifications` (Notifications admin)

**Structure document** :
```typescript
{
  recipientId: "admin-uid-123",
  type: "email_limit_warning",
  title: "⚠️ Limite Gmail atteinte à 60% (305/500 emails)",
  message: "Surveiller de près. Planifier migration Brevo si tendance continue.",
  relatedId: null,
  isRead: false,
  priority: "medium",
  metadata: {
    current: 305,
    limit: 500,
    percentage: 61
  },
  createdAt: Timestamp
}
```

**Utilité** : Badge notifications admin, centre de notifications

---

## 🚀 UTILISATION

### 1. Démarrer Backend

```bash
cd backend
npm run dev
```

**Console logs attendus** :
```
🚀 Serveur démarré sur http://localhost:5000
📧 Surveillance des emails configurée (toutes les 5 minutes)
✅ Service email configuré - Surveillance active
```

---

### 2. Accéder Dashboard Admin

**URL** : http://localhost:3000/admin/email-monitoring

**Prérequis** : Connecté avec compte `role: 'admin'`

**Features** :
- ✅ Vue temps réel limite Gmail
- ✅ Alertes visuelles automatiques
- ✅ Stats détaillées par type/provider
- ✅ Rapport hebdomadaire
- ✅ Logs 50 derniers emails
- ✅ Actualisation automatique (60s)

---

### 3. Workflow Alertes Automatiques

**Scénario 1 : Dépassement 300 emails (60%)**

```
1. Email #300 envoyé via Gmail
   ↓
2. emailTrackingService.logEmail() appelé
   ↓
3. updateDailyStats() incrémente compteur
   ↓
4. checkThresholdsAndAlert() détecte 300 emails
   ↓
5. Alerte niveau 1 créée dans email_alerts
   ↓
6. Notification admin créée
   ↓
7. Dashboard affiche barre JAUNE + message warning
   ↓
8. Admin reçoit notification dans badge
```

**Scénario 2 : Dépassement 450 emails (90%)**

```
1. Email #450 envoyé
   ↓
2. Alerte niveau 3 DANGER créée
   ↓
3. Dashboard affiche barre ROUGE + message urgence
   ↓
4. Admin reçoit notification priorité HAUTE
   ↓
5. Recommandation : "MIGRATION URGENTE : Activer Brevo IMMÉDIATEMENT"
```

---

## 📊 EXEMPLES API

### Obtenir Stats du Jour

```bash
curl http://localhost:5000/api/v1/admin/email-stats/today
```

**Réponse** :
```json
{
  "date": "2026-02-20",
  "totalSent": 305,
  "totalFailed": 2,
  "byProvider": {
    "gmail": 280,
    "firebase": 25,
    "brevo": 0
  },
  "byType": {
    "transactional": 220,
    "notification": 80,
    "auth": 5,
    "system": 2
  },
  "timestamp": {
    "_seconds": 1737389000,
    "_nanoseconds": 0
  }
}
```

---

### Obtenir Rapport Hebdomadaire

```bash
curl http://localhost:5000/api/v1/admin/email-stats/weekly-report
```

**Réponse** :
```json
{
  "totalSent": 1850,
  "totalFailed": 15,
  "averagePerDay": 264,
  "peakDay": {
    "date": "2026-02-18",
    "count": 420
  },
  "byProvider": {
    "gmail": 1700,
    "firebase": 150,
    "brevo": 0
  },
  "trend": "increasing"
}
```

---

### Obtenir Alertes Actives

```bash
curl http://localhost:5000/api/v1/admin/email-alerts
```

**Réponse** :
```json
[
  {
    "id": "alert-20260220-1",
    "level": "warning",
    "threshold": 300,
    "current": 305,
    "limit": 500,
    "percentage": 61,
    "message": "⚠️ Limite Gmail atteinte à 60% (305/500 emails)",
    "recommendation": "Surveiller de près. Planifier migration Brevo si tendance continue.",
    "timestamp": {
      "_seconds": 1737389000,
      "_nanoseconds": 0
    },
    "isRead": false
  }
]
```

---

## 🎯 SEUILS D'ALERTE

| Emails/Jour | % Limite | Niveau | Couleur | Message | Action Recommandée |
|-------------|----------|--------|---------|---------|-------------------|
| 0-299 | 0-59% | Safe | 🟢 Vert | Volume normal | Continuer monitoring |
| 300-399 | 60-79% | Warning | 🟡 Jaune | Attention | Surveiller de près |
| 400-449 | 80-89% | Critical | 🟠 Orange | Alerte | Migrer Brevo sous 24-48h |
| 450-500 | 90-100% | Danger | 🔴 Rouge | Urgence | Migration IMMÉDIATE |
| 500+ | 100%+ | Limit | ⛔ Noir | Bloqué | Compte Gmail suspendu |

---

## 🔔 TYPES DE NOTIFICATIONS ADMIN

Les alertes créent automatiquement des notifications dans le dashboard admin :

**1. Badge notifications** : Compteur avec alertes non lues

**2. Centre notifications** : Liste détaillée dans `/admin/dashboard`

**3. Email admin** (future) : Email de notification vers admin (si configuré)

---

## 🧪 TESTS

### Test 1 : Envoyer Email et Vérifier Logging

```bash
# 1. Backend : Créer email dans Firestore
# Collection: email_notifications
{
  to: "test@example.com",
  subject: "Test monitoring",
  htmlContent: "<p>Test</p>",
  textContent: "Test",
  type: "system",
  status: "pending"
}

# 2. Attendre 5 min (ou redémarrer backend)
# Backend traite email automatiquement

# 3. Vérifier collection email_logs
# Nouveau document créé avec provider: "gmail"

# 4. Vérifier collection email_stats_daily
# Document YYYY-MM-DD mis à jour avec totalSent++

# 5. Vérifier dashboard admin
# Stats mises à jour en temps réel
```

---

### Test 2 : Déclencher Alerte Niveau 1

```bash
# 1. Envoyer 300 emails (script test)
for i in {1..300}
do
  # Créer document email_notifications
done

# 2. Vérifier collection email_alerts
# Alerte niveau 1 créée automatiquement

# 3. Vérifier dashboard admin
# Barre jaune + message warning affiché

# 4. Vérifier notifications admin
# Notification type: "email_limit_warning" créée
```

---

## 📈 RAPPORTS DISPONIBLES

### 1. Stats Journalières

- Total envoyés/échecs
- Répartition par provider
- Répartition par type
- Taux de succès

### 2. Rapport Hebdomadaire

- Total 7 jours
- Moyenne quotidienne
- Pic journalier
- Tendance (hausse/baisse/stable)

### 3. Logs Détaillés

- 50 derniers emails
- Filtrable par date/type/provider
- Export CSV (à implémenter)

### 4. Alertes Historiques

- Historique toutes alertes
- Déclenchements multiples même jour
- Marquage lu/non lu

---

## 🔄 MIGRATION VERS BREVO

Quand atteindre **300 emails/jour de manière régulière** :

### Étape 1 : Créer Compte Brevo

```bash
1. Aller sur https://app.brevo.com/account/register
2. Plan Free : 300 emails/jour gratuit
3. Vérifier domaine artisansafe.fr
4. Récupérer API key
```

### Étape 2 : Implémenter Service Brevo

```typescript
// backend/src/services/email-service-brevo.ts
import { TransactionalEmailsApi } from '@sendinblue/client';

export async function sendEmailViaBrevo(emailData) {
  const apiInstance = new TransactionalEmailsApi();
  apiInstance.setApiKey('xkeysib-...');

  await apiInstance.sendTransacEmail({
    sender: { email: 'contact@artisansafe.fr', name: 'ArtisanSafe' },
    to: [{ email: emailData.to }],
    subject: emailData.subject,
    htmlContent: emailData.htmlContent
  });

  // Logger avec provider: 'brevo'
  await emailTrackingService.logEmail({
    recipient: emailData.to,
    subject: emailData.subject,
    type: emailData.type,
    provider: 'brevo', // ← Important
    status: 'sent'
  });
}
```

### Étape 3 : Basculer Provider

```env
# backend/.env
EMAIL_PROVIDER=brevo  # Au lieu de 'gmail'
BREVO_API_KEY=xkeysib-...
```

### Étape 4 : Monitoring Continue

Dashboard affichera automatiquement :
- Gmail : 0 emails/jour
- Brevo : X emails/jour (nouveau)
- Alertes désactivées (pas de limite Brevo gratuit jusqu'à 300/jour)

---

## ✅ CHECKLIST IMPLÉMENTATION

- [x] Service tracking créé (`email-tracking.service.ts`)
- [x] Logging automatique dans `email-service.ts`
- [x] Routes API admin créées
- [x] Routes intégrées dans `server.ts`
- [x] Dashboard admin frontend créé
- [x] Collections Firestore documentées
- [x] Seuils alertes configurés (300, 400, 450, 500)
- [x] Notifications admin intégrées
- [x] Actualisation automatique (60s)
- [x] Documentation complète

---

## 🎯 NEXT STEPS

### Court Terme (0-3 mois)
- [ ] Dashboard : Ajouter graphiques historiques (Chart.js)
- [ ] Dashboard : Export CSV des logs
- [ ] Alertes : Email notification admin (en plus notification dashboard)
- [ ] Logs : Filtres avancés (date, type, provider)

### Moyen Terme (3-6 mois)
- [ ] Migration Brevo quand volume > 300 emails/jour
- [ ] Monitoring Brevo (limite 300/jour gratuit)
- [ ] Rapports mensuels automatiques
- [ ] Prédiction volume (ML simple)

### Long Terme (6+ mois)
- [ ] Multi-provider failover (Gmail → Brevo automatique)
- [ ] A/B testing templates
- [ ] Optimisation taux ouverture
- [ ] Analytics avancés (géolocalisation, devices)

---

## 🐛 TROUBLESHOOTING

### Problème : Stats non mises à jour

**Cause** : Backend non démarré ou email-service.ts non modifié

**Solution** :
```bash
1. Vérifier logs backend : npm run dev
2. Vérifier import emailTrackingService dans email-service.ts
3. Vérifier appel logEmail() après sendEmail()
```

---

### Problème : Alertes non reçues

**Cause** : Collection notifications non créée ou admin UID incorrect

**Solution** :
```bash
1. Vérifier collection users avec role: 'admin'
2. Vérifier collection notifications créée automatiquement
3. Vérifier logs backend : "🚨 ALERTE EMAIL:"
```

---

### Problème : Dashboard affiche 0 emails

**Cause** : API URL incorrecte ou CORS bloqué

**Solution** :
```bash
1. Vérifier NEXT_PUBLIC_API_URL dans frontend/.env.local
2. Vérifier backend CORS activé
3. Ouvrir console navigateur : vérifier erreurs réseau
```

---

## 📚 DOCUMENTATION COMPLÉMENTAIRE

- Email System Architecture : `SYSTEME_EMAILS_PLATEFORME.md`
- Étude Marché Solutions : `ETUDE_MARCHE_SOLUTIONS_EMAILS.md`
- Firebase Auth Templates : `FIREBASE_AUTH_TEMPLATES_PERSONNALISATION.md`
- Migration Brevo Guide : (à créer lors de la migration)

---

**Document créé le** : 20 février 2026  
**Auteur** : GitHub Copilot  
**Statut système** : ✅ **OPÉRATIONNEL**  
**Prochaine action** : Monitorer volume quotidien, migrer Brevo si > 300 emails/jour
