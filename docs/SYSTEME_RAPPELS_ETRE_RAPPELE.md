# Système de Rappels "Être rappelé" - Documentation Complète

## 📋 Vue d'ensemble

Le système "Être rappelé" permet aux visiteurs du site de demander à être contactés par téléphone par l'équipe ArtisanDispo. Cette fonctionnalité a été inspirée de l'interface HelloArtisan et implémente un workflow complet avec validation stricte, notifications par email et tableau de bord administrateur.

---

## 🎯 Fonctionnalités

### Pour les visiteurs
- ✅ Bouton "Être rappelé" dans le header (visible sur toutes les pages)
- ✅ Formulaire simple et intuitif
- ✅ Validation stricte des numéros de téléphone français uniquement
- ✅ Choix de l'horaire préféré (matin, après-midi, soir, indifférent)
- ✅ Champ email optionnel pour confirmation
- ✅ Champ message optionnel pour préciser la demande
- ✅ Email de confirmation automatique (si email fourni)

### Pour les administrateurs
- ✅ Page dédiée `/admin/rappels` pour gérer toutes les demandes
- ✅ Statistiques avancées en temps réel
- ✅ Filtrage par statut (en attente, traitées, annulées)
- ✅ Actions rapides (marquer comme traitée, annuler)
- ✅ Notification email immédiate à chaque nouvelle demande
- ✅ Email de confirmation envoyé au client après traitement

---

## 📂 Structure des fichiers

### Frontend

#### 1. Composant Header
**Fichier** : `frontend/src/components/Header.tsx` (lignes 129-138)

```tsx
{/* Bouton Être rappelé */}
<Link
  href="/etre-rappele"
  className="flex items-center gap-2 bg-[#FF6B00] hover:bg-[#E56100] text-white px-4 py-2 rounded-lg transition-colors"
>
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
  Être rappelé
</Link>
```

**Caractéristiques** :
- Icône de téléphone SVG
- Couleur orange corporate `#FF6B00`
- Hover effect `#E56100`
- Positionné dans la navigation principale

---

#### 2. Page du formulaire
**Fichier** : `frontend/src/app/etre-rappele/page.tsx`

**Interface utilisateur** :
- Champs : nom, prénom, téléphone, email (optionnel), horaire préféré, message (optionnel)
- Validation triple couche :
  1. **HTML5 pattern** : `pattern="^(0[1-9]|\\+33[1-9]|0033[1-9])[0-9\\s\\.\\-]{8,}$"`
  2. **JavaScript regex** : Validation côté client avant envoi
  3. **Firestore rules** : Validation serveur pour sécurité absolue

**Code de validation JavaScript** :
```typescript
const phoneRegex = /^(0[1-9]|\+33[1-9]|0033[1-9])[0-9\s\.\-]{8,}$/;
if (!phoneRegex.test(formData.telephone.trim())) {
  alert('Veuillez saisir un numéro de téléphone français valide');
  return;
}
```

**Formats acceptés** :
- ✅ `0612345678` (format classique)
- ✅ `06 12 34 56 78` (avec espaces)
- ✅ `06.12.34.56.78` (avec points)
- ✅ `06-12-34-56-78` (avec tirets)
- ✅ `+33612345678` (international)
- ✅ `0033612345678` (international alternatif)
- ❌ `00312345678` (Pays-Bas refusé)
- ❌ `+1234567890` (USA refusé)

**Workflow soumission** :
1. Validation formulaire client-side
2. Appel à `createRappel()` du service layer
3. Service enregistre dans Firestore
4. Service envoie email notification admin
5. Redirection vers page de confirmation
6. Email de confirmation au client (si email fourni)

---

#### 3. Service Layer
**Fichier** : `frontend/src/lib/firebase/rappel-service.ts`

**Fonctions exportées** :

##### `createRappel(data: Omit<Rappel, 'id' | 'createdAt'>): Promise<string>`
Crée une nouvelle demande de rappel et envoie l'email notification admin.

```typescript
const rappelId = await createRappel({
  nom: 'Dupont',
  prenom: 'Jean',
  telephone: '0612345678',
  email: 'jean@example.com',
  horairePrefere: 'matin',
  message: 'Je souhaite un devis',
  statut: 'en_attente'
});
```

**Actions** :
1. Ajoute `createdAt: serverTimestamp()`
2. Enregistre dans collection `rappels`
3. Appelle backend `/api/v1/emails/rappel-admin-notification`
4. Retourne l'ID du document créé

---

##### `getAllRappels(): Promise<Rappel[]>`
Récupère toutes les demandes de rappel, triées par date décroissante.

```typescript
const rappels = await getAllRappels();
// Retourne : [{ id: '...', nom: '...', statut: 'en_attente', ... }, ...]
```

**Tri** : Côté client avec `.sort()` pour éviter index composite Firestore.

---

##### `getRappelStats(): Promise<RappelStats>`
Calcule les statistiques avancées en temps réel.

```typescript
const stats = await getRappelStats();
console.log(stats);
// {
//   total: 45,
//   enAttente: 12,
//   traites: 28,
//   annules: 5,
//   tempsMoyenTraitement: 127, // minutes
//   tauxTraitement: 62.2, // %
//   rappelsAujourdhui: 8,
//   rappelsSemaine: 23
// }
```

**Métriques calculées** :
- **tempsMoyenTraitement** : `(dateTraitement - createdAt)` en minutes, moyenne de tous les rappels traités
- **tauxTraitement** : `(traités / (traités + annulés)) * 100`
- **rappelsAujourdhui** : Demandes créées aujourd'hui (00:00 - 23:59)
- **rappelsSemaine** : Demandes créées cette semaine (lundi - dimanche)

---

##### `markRappelAsTraite(rappelId: string, adminUid: string, emailClient?: string): Promise<void>`
Marque une demande comme traitée et envoie l'email de confirmation au client.

```typescript
await markRappelAsTraite(
  rappelId, 
  user.uid, 
  'client@example.com'
);
```

**Actions** :
1. Met à jour Firestore : `statut: 'traite'`, `traitePar: adminUid`, `dateTraitement: now()`
2. Si email fourni : appelle backend `/api/v1/emails/rappel-client-confirmation`

---

##### `markRappelAsAnnule(rappelId: string, adminUid: string): Promise<void>`
Marque une demande comme annulée (spam, doublon, etc.).

```typescript
await markRappelAsAnnule(rappelId, user.uid);
```

---

##### `formatTempsTraitement(minutes: number): string`
Convertit une durée en minutes vers format lisible.

```typescript
formatTempsTraitement(45);   // "45 min"
formatTempsTraitement(120);  // "2h 0min"
formatTempsTraitement(547);  // "9h 7min"
```

---

#### 4. Page Administration
**Fichier** : `frontend/src/app/admin/rappels/page.tsx`

**Interface administrateur** :

##### Section Statistiques (4 cartes)
```tsx
┌─────────────────────┬─────────────────────┬─────────────────────┬─────────────────────┐
│   EN ATTENTE        │   TRAITÉES          │   TEMPS MOYEN       │   CETTE SEMAINE     │
│   (jaune)           │   (vert)            │   (bleu)            │   (violet)          │
│                     │                     │                     │                     │
│   12                │   28                │   2h 7min           │   23                │
│                     │   Taux: 62.2%       │   Traitement        │   Aujourd'hui: 8    │
└─────────────────────┴─────────────────────┴─────────────────────┴─────────────────────┘
```

**Code** :
```tsx
<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
  {/* En attente */}
  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
    <div className="text-yellow-800 font-semibold text-sm">En attente</div>
    <div className="text-3xl font-bold text-yellow-900">
      {stats?.enAttente || 0}
    </div>
  </div>
  
  {/* Traitées */}
  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
    <div className="text-green-800 font-semibold text-sm">Traitées</div>
    <div className="text-3xl font-bold text-green-900">
      {stats?.traites || 0}
    </div>
    <div className="text-xs text-green-700 mt-1">
      Taux: {stats?.tauxTraitement || 0}%
    </div>
  </div>
  
  {/* Temps moyen */}
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
    <div className="text-blue-800 font-semibold text-sm">Temps moyen</div>
    <div className="text-2xl font-bold text-blue-900">
      {stats ? formatTempsTraitement(stats.tempsMoyenTraitement) : '-'}
    </div>
    <div className="text-xs text-blue-700 mt-1">Traitement</div>
  </div>
  
  {/* Cette semaine */}
  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
    <div className="text-purple-800 font-semibold text-sm">Cette semaine</div>
    <div className="text-3xl font-bold text-purple-900">
      {stats?.rappelsSemaine || 0}
    </div>
    <div className="text-xs text-purple-700 mt-1">
      Aujourd'hui: {stats?.rappelsAujourdhui || 0}
    </div>
  </div>
</div>
```

##### Filtre par statut
```tsx
<select 
  value={filterStatut} 
  onChange={(e) => setFilterStatut(e.target.value)}
  className="..."
>
  <option value="all">Toutes ({rappels.length})</option>
  <option value="en_attente">En attente ({stats?.enAttente})</option>
  <option value="traite">Traitées ({stats?.traites})</option>
  <option value="annule">Annulées ({stats?.annules})</option>
</select>
```

##### Liste des demandes
- **Badge statut** : Couleurs jaune/vert/gris selon statut
- **Informations affichées** : Nom, téléphone, horaire préféré, date, email (si fourni), message (si fourni)
- **Actions** : Boutons "Marquer comme traitée" et "Annuler" (uniquement si statut = en_attente)

**Workflow clic bouton "Traiter"** :
```typescript
const updateStatut = async (rappelId: string, nouveauStatut: 'traite' | 'annule') => {
  try {
    const user = await authService.getCurrentUser();
    if (!user) return;

    const rappel = rappels.find(r => r.id === rappelId);
    
    if (nouveauStatut === 'traite') {
      await markRappelAsTraite(rappelId, user.uid, rappel?.email);
      // → Email de confirmation envoyé au client si email fourni
    } else {
      await markRappelAsAnnule(rappelId, user.uid);
    }

    await loadRappels(); // Recharger la liste
  } catch (error) {
    console.error('Erreur:', error);
    alert('Erreur lors de la mise à jour');
  }
};
```

---

### Backend

#### 1. Routes Email
**Fichier** : `backend/src/routes/email.routes.ts`

##### Endpoint : POST `/api/v1/emails/rappel-admin-notification`
Envoie un email à l'admin lors d'une nouvelle demande de rappel.

**Body** :
```json
{
  "nom": "Dupont",
  "prenom": "Jean",
  "telephone": "0612345678",
  "email": "jean@example.com",
  "horairePrefere": "matin",
  "message": "Je souhaite un devis pour plomberie",
  "rappelId": "abc123"
}
```

**Template email** :
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Nouvelle demande de rappel</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
    <!-- Header orange -->
    <div style="background-color: #FF6B00; color: white; padding: 20px; text-align: center;">
      <h1 style="margin: 0;">🔔 Nouvelle demande de rappel</h1>
    </div>
    
    <!-- Contenu -->
    <div style="background-color: white; padding: 30px; margin-top: 20px;">
      <h2 style="color: #2C3E50;">Coordonnées du contact</h2>
      
      <p><strong>Nom :</strong> Jean Dupont</p>
      <p><strong>Téléphone :</strong> 
        <a href="tel:0612345678" style="color: #FF6B00;">0612345678</a>
      </p>
      <p><strong>Email :</strong> 
        <a href="mailto:jean@example.com" style="color: #FF6B00;">jean@example.com</a>
      </p>
      <p><strong>Horaire préféré :</strong> Matin (9h - 12h)</p>
      
      <div style="background-color: #f8f9fa; padding: 15px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Message :</strong></p>
        <p style="margin: 5px 0 0 0;">Je souhaite un devis pour plomberie</p>
      </div>
      
      <!-- Bouton CTA -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="http://localhost:3000/admin/rappels" 
           style="background-color: #FF6B00; color: white; padding: 12px 30px; 
                  text-decoration: none; border-radius: 5px; display: inline-block;">
          Voir dans le tableau de bord
        </a>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; padding: 20px; color: #6c757d; font-size: 12px;">
      <p>ArtisanDispo - Plateforme de mise en relation artisans</p>
    </div>
  </div>
</body>
</html>
```

**Configuration SMTP** :
```typescript
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true pour port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

await transporter.sendMail({
  from: `"ArtisanDispo" <${process.env.SMTP_USER}>`,
  to: process.env.ADMIN_EMAIL,
  subject: '🔔 Nouvelle demande de rappel - ArtisanDispo',
  html: emailTemplate,
});
```

---

##### Endpoint : POST `/api/v1/emails/rappel-client-confirmation`
Envoie un email de confirmation au client après traitement.

**Body** :
```json
{
  "email": "jean@example.com",
  "nom": "Dupont",
  "prenom": "Jean"
}
```

**Template email** :
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Votre demande a été traitée</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
    <!-- Header vert -->
    <div style="background-color: #28A745; color: white; padding: 20px; text-align: center;">
      <h1 style="margin: 0;">✅ Votre demande a été traitée</h1>
    </div>
    
    <!-- Contenu -->
    <div style="background-color: white; padding: 30px; margin-top: 20px;">
      <h2 style="color: #2C3E50;">Bonjour Jean,</h2>
      
      <p>Nous avons bien pris en compte votre demande de rappel.</p>
      <p>Notre équipe vous contactera dans les plus brefs délais à l'horaire que vous avez indiqué.</p>
      
      <div style="background-color: #d4edda; padding: 15px; margin: 20px 0; border-left: 4px solid #28A745;">
        <p style="margin: 0; color: #155724;">
          <strong>📞 Vous serez contacté prochainement</strong>
        </p>
      </div>
      
      <p>Si vous avez des questions, n'hésitez pas à nous contacter.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="http://localhost:3000" 
           style="background-color: #28A745; color: white; padding: 12px 30px; 
                  text-decoration: none; border-radius: 5px; display: inline-block;">
          Retour au site
        </a>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; padding: 20px; color: #6c757d; font-size: 12px;">
      <p>ArtisanDispo - Plateforme de mise en relation artisans</p>
      <p>Cet email est envoyé automatiquement, merci de ne pas y répondre.</p>
    </div>
  </div>
</body>
</html>
```

---

#### 2. Variables d'environnement
**Fichier** : `backend/.env`

Ajouter ces variables :
```env
# SMTP Configuration pour emails
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre-email@gmail.com
SMTP_PASSWORD=votre-mot-de-passe-app

# Email admin pour notifications
ADMIN_EMAIL=admin@artisandispo.fr

# URL frontend pour liens dans emails
FRONTEND_URL=http://localhost:3000
```

**Note** : Pour Gmail, créer un "mot de passe d'application" dans les paramètres de sécurité.

---

### Firestore

#### 1. Collection `rappels`
**Structure document** :
```typescript
{
  id: string;                    // Auto-généré par Firestore
  nom: string;                   // Nom du contact
  prenom: string;                // Prénom du contact
  telephone: string;             // Format français validé
  email?: string;                // Optionnel
  horairePrefere: 'matin' | 'apres-midi' | 'soir' | 'indifferent';
  message?: string;              // Optionnel
  statut: 'en_attente' | 'traite' | 'annule';
  createdAt: Timestamp;          // Date création
  traitePar?: string;            // UID admin (si traité)
  dateTraitement?: Timestamp;    // Date traitement (si traité)
}
```

**Exemple document** :
```json
{
  "id": "abc123def456",
  "nom": "Dupont",
  "prenom": "Jean",
  "telephone": "0612345678",
  "email": "jean.dupont@example.com",
  "horairePrefere": "matin",
  "message": "Je souhaite un devis pour plomberie",
  "statut": "traite",
  "createdAt": "2026-01-26T10:30:00Z",
  "traitePar": "admin-uid-123",
  "dateTraitement": "2026-01-26T12:45:00Z"
}
```

---

#### 2. Règles de sécurité
**Fichier** : `firestore.rules` (lignes 365-377)

```javascript
// Collection rappels - Demandes "Être rappelé"
match /rappels/{rappelId} {
  // Lecture : Seulement admins
  allow read: if isAdmin();
  
  // Création : Tout le monde (formulaire public)
  allow create: if request.resource.data.keys().hasAll(['nom', 'prenom', 'telephone', 'horairePrefere', 'statut', 'createdAt'])
                && request.resource.data.statut == 'en_attente'
                && request.resource.data.telephone.matches('^0[1-9][0-9\\s\\.\\-]{8,}$');
  
  // Mise à jour : Seulement admins
  allow update: if isAdmin();
  
  // Suppression : Seulement admins
  allow delete: if isAdmin();
}
```

**Validation téléphone serveur** : `^0[1-9][0-9\\s\\.\\-]{8,}$`
- Doit commencer par `0` suivi de `1-9` (pas 00...)
- Minimum 8 chiffres après (total 10 chiffres minimum)
- Accepte espaces, points, tirets

**Déploiement** :
```bash
firebase deploy --only firestore:rules
```

---

## 🔄 Workflow complet

### 1. Soumission formulaire par visiteur

```
[Visiteur] Clique "Être rappelé" dans header
    ↓
[Frontend] Affiche /etre-rappele avec formulaire
    ↓
[Visiteur] Remplit : nom, prénom, téléphone, horaire (+ email, message optionnels)
    ↓
[Frontend] Validation triple couche :
    - HTML5 pattern attribute
    - JavaScript regex
    - Firestore rules
    ↓
[Frontend] Appelle createRappel() du service layer
    ↓
[Service] Enregistre dans Firestore collection "rappels"
    ↓
[Service] Appelle POST /api/v1/emails/rappel-admin-notification
    ↓
[Backend] Envoie email à ADMIN_EMAIL via SMTP
    ↓
[Frontend] Redirection vers page de confirmation
    ↓
[Admin] Reçoit email avec lien vers /admin/rappels
```

---

### 2. Traitement par admin

```
[Admin] Accède à /admin/rappels (lien depuis email ou navigation)
    ↓
[Frontend] Charge getAllRappels() + getRappelStats()
    ↓
[Frontend] Affiche statistiques + liste filtrée
    ↓
[Admin] Clique "Marquer comme traitée"
    ↓
[Frontend] Appelle markRappelAsTraite(rappelId, adminUid, emailClient)
    ↓
[Service] Met à jour Firestore :
    - statut: 'traite'
    - traitePar: adminUid
    - dateTraitement: now()
    ↓
[Service] SI email fourni : appelle POST /api/v1/emails/rappel-client-confirmation
    ↓
[Backend] Envoie email de confirmation au client
    ↓
[Frontend] Recharge la liste (nouvelles stats)
    ↓
[Client] Reçoit email "Votre demande a été traitée"
```

---

## 📊 Statistiques avancées - Détails techniques

### Calcul du temps moyen de traitement

**Code** (`rappel-service.ts`) :
```typescript
const traites = rappels.filter(r => r.statut === 'traite' && r.dateTraitement);

if (traites.length > 0) {
  const totalMinutes = traites.reduce((sum, r) => {
    const createdMs = r.createdAt.toMillis();
    const traiteMs = r.dateTraitement!.toMillis();
    const diffMinutes = Math.floor((traiteMs - createdMs) / (1000 * 60));
    return sum + diffMinutes;
  }, 0);
  
  stats.tempsMoyenTraitement = Math.round(totalMinutes / traites.length);
} else {
  stats.tempsMoyenTraitement = 0;
}
```

**Formule** :
```
Temps moyen = Σ(dateTraitement - createdAt) / Nombre de rappels traités
```

**Exemple** :
- Rappel 1 : Créé 10h, traité 12h → 120 minutes
- Rappel 2 : Créé 14h, traité 15h30 → 90 minutes
- Rappel 3 : Créé 16h, traité 17h → 60 minutes
- **Moyenne** : (120 + 90 + 60) / 3 = **90 minutes** → Affiché "1h 30min"

---

### Calcul du taux de traitement

**Code** :
```typescript
const traites = rappels.filter(r => r.statut === 'traite').length;
const annules = rappels.filter(r => r.statut === 'annule').length;

if (traites + annules > 0) {
  stats.tauxTraitement = Math.round((traites / (traites + annules)) * 100 * 10) / 10;
} else {
  stats.tauxTraitement = 0;
}
```

**Formule** :
```
Taux = (Traités / (Traités + Annulés)) × 100
```

**Exemple** :
- Traités : 28
- Annulés : 5
- **Taux** : (28 / (28 + 5)) × 100 = **84.8%**

---

### Calcul rappels aujourd'hui

**Code** :
```typescript
const today = new Date();
today.setHours(0, 0, 0, 0);
const todayTimestamp = Timestamp.fromDate(today);

stats.rappelsAujourdhui = rappels.filter(r => 
  r.createdAt.toMillis() >= todayTimestamp.toMillis()
).length;
```

**Logique** : Compte les rappels créés depuis 00:00:00 aujourd'hui.

---

### Calcul rappels cette semaine

**Code** :
```typescript
const weekStart = new Date();
const day = weekStart.getDay();
const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1); // Lundi
weekStart.setDate(diff);
weekStart.setHours(0, 0, 0, 0);
const weekStartTimestamp = Timestamp.fromDate(weekStart);

stats.rappelsSemaine = rappels.filter(r => 
  r.createdAt.toMillis() >= weekStartTimestamp.toMillis()
).length;
```

**Logique** : Compte les rappels créés depuis lundi 00:00:00 de cette semaine.

---

## 🧪 Tests manuels recommandés

### Test 1 : Validation téléphone

**Objectif** : Vérifier que seuls les numéros français sont acceptés.

**Étapes** :
1. Aller sur `/etre-rappele`
2. Essayer ces numéros :
   - ✅ `0612345678` → Accepté
   - ✅ `06 12 34 56 78` → Accepté
   - ✅ `+33612345678` → Accepté
   - ❌ `00312345678` (Pays-Bas) → Refusé
   - ❌ `+1234567890` (USA) → Refusé
   - ❌ `123` (trop court) → Refusé

**Résultat attendu** : Alert "Veuillez saisir un numéro de téléphone français valide" pour formats invalides.

---

### Test 2 : Email admin notification

**Objectif** : Vérifier que l'admin reçoit un email à chaque nouvelle demande.

**Prérequis** :
```env
SMTP_HOST=smtp.gmail.com
SMTP_USER=votre-email@gmail.com
SMTP_PASSWORD=mot-de-passe-app
ADMIN_EMAIL=admin@artisandispo.fr
```

**Étapes** :
1. Soumettre formulaire avec tous les champs
2. Vérifier boîte email `ADMIN_EMAIL`
3. Email doit contenir :
   - Sujet : "🔔 Nouvelle demande de rappel - ArtisanDispo"
   - Header orange
   - Nom, téléphone (cliquable), email (cliquable)
   - Horaire préféré en français (ex: "Matin (9h - 12h)")
   - Message si fourni
   - Bouton "Voir dans le tableau de bord" → lien vers `/admin/rappels`

---

### Test 3 : Email confirmation client

**Objectif** : Vérifier que le client reçoit un email après traitement.

**Étapes** :
1. Soumettre formulaire en fournissant un vrai email
2. Se connecter en admin → `/admin/rappels`
3. Cliquer "Marquer comme traitée"
4. Vérifier boîte email du client
5. Email doit contenir :
   - Sujet : "✅ Votre demande a été traitée - ArtisanDispo"
   - Header vert
   - Message personnalisé avec prénom
   - Encadré vert "📞 Vous serez contacté prochainement"
   - Bouton "Retour au site"

---

### Test 4 : Statistiques temps réel

**Objectif** : Vérifier que les stats se mettent à jour automatiquement.

**Étapes** :
1. Aller sur `/admin/rappels`
2. Noter les stats affichées (ex: En attente: 5, Traités: 10)
3. Soumettre une nouvelle demande via `/etre-rappele`
4. Recharger `/admin/rappels`
5. Vérifier que "En attente" a augmenté de 1
6. Marquer la nouvelle demande comme "traitée"
7. Vérifier que :
   - "En attente" a diminué de 1
   - "Traitées" a augmenté de 1
   - "Taux de traitement" a été recalculé

---

### Test 5 : Filtre par statut

**Objectif** : Vérifier que le filtre fonctionne correctement.

**Étapes** :
1. Aller sur `/admin/rappels`
2. Sélectionner "En attente" dans le filtre
3. Vérifier que seules les demandes jaunes sont affichées
4. Sélectionner "Traitées"
5. Vérifier que seules les demandes vertes sont affichées
6. Sélectionner "Toutes"
7. Vérifier que toutes les demandes réapparaissent

---

## ⚙️ Configuration production

### 1. Variables d'environnement

**Backend** `.env` :
```env
# SMTP Production (exemple Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@artisandispo.fr
SMTP_PASSWORD=xxxx-xxxx-xxxx-xxxx  # Mot de passe d'application

# Admin
ADMIN_EMAIL=admin@artisandispo.fr

# Frontend URL
FRONTEND_URL=https://artisandispo.fr
```

**Alternatives SMTP** :
- **SendGrid** : SMTP_HOST=smtp.sendgrid.net, PORT=587
- **Mailgun** : SMTP_HOST=smtp.mailgun.org, PORT=587
- **Amazon SES** : SMTP_HOST=email-smtp.eu-west-1.amazonaws.com, PORT=587

---

### 2. Firebase Firestore Rules

Déployer les règles :
```bash
firebase deploy --only firestore:rules
```

Vérifier dans Firebase Console > Firestore Database > Règles que la section `rappels` est bien présente.

---

### 3. Monitoring

**Créer une Cloud Function pour notifier si trop de demandes en attente** :
```javascript
// functions/src/index.ts
exports.checkPendingRappels = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async () => {
    const snapshot = await admin.firestore()
      .collection('rappels')
      .where('statut', '==', 'en_attente')
      .get();
    
    if (snapshot.size > 10) {
      // Envoyer email d'alerte à l'admin
      await sendAlertEmail(
        process.env.ADMIN_EMAIL,
        `⚠️ ${snapshot.size} demandes de rappel en attente !`,
        `Vous avez ${snapshot.size} demandes en attente. Veuillez les traiter.`
      );
    }
  });
```

---

## 🐛 Dépannage

### Problème : Email admin non reçu

**Causes possibles** :
1. Variables SMTP mal configurées
2. Mot de passe d'application Gmail invalide
3. Pare-feu bloque port 587
4. Email dans spam

**Solution** :
```bash
# Vérifier logs backend
cd backend
npm run dev

# Tester envoi email manuellement
curl -X POST http://localhost:5000/api/v1/emails/rappel-admin-notification \
  -H "Content-Type: application/json" \
  -d '{
    "nom": "Test",
    "prenom": "User",
    "telephone": "0612345678",
    "horairePrefere": "matin",
    "rappelId": "test123"
  }'
```

**Vérifier réponse** :
- ✅ `{ success: true, message: "Email envoyé" }` → OK
- ❌ `{ error: "..." }` → Lire message erreur

---

### Problème : Validation téléphone échoue

**Causes possibles** :
1. Firestore rules pas déployées
2. Numéro invalide
3. Regex mal configurée

**Solution** :
```bash
# Déployer rules
firebase deploy --only firestore:rules

# Tester regex JavaScript
const phoneRegex = /^(0[1-9]|\+33[1-9]|0033[1-9])[0-9\s\.\-]{8,}$/;
console.log(phoneRegex.test('0612345678')); // true
console.log(phoneRegex.test('00312345678')); // false
```

---

### Problème : Stats ne se mettent pas à jour

**Causes possibles** :
1. Utilisateur non admin
2. Erreur dans getRappelStats()
3. Cache navigateur

**Solution** :
```javascript
// Vérifier console navigateur (F12)
// Devrait voir logs :
"Chargement des rappels..."
"15 rappels chargés"
"Stats:", { total: 15, enAttente: 5, ... }

// Si erreur "Permission denied" → Vérifier role admin dans Firestore
```

---

## 📈 Évolutions futures possibles

### Phase 2 : SMS

- Ajouter envoi SMS automatique au client après soumission formulaire
- Utiliser Twilio ou Firebase Extensions SMS
- Coût estimé : ~0.05€/SMS

### Phase 3 : Calendrier RDV

- Intégrer Google Calendar pour planifier rappels
- Synchronisation bidirectionnelle
- Créer événement automatique lors du clic "Traiter"

### Phase 4 : Analytics

- Tableau de bord statistiques avancées :
  - Graphique évolution demandes/jour
  - Répartition par horaire préféré
  - Taux conversion demande → client
  - Temps moyen de réponse par admin

### Phase 5 : Automatisation

- Détection automatique des doublons (même téléphone < 24h)
- Auto-annulation si pas traité sous 48h
- Email relance admin si demande > 6h non traitée
- Webhook vers CRM externe

---

## 📝 Checklist mise en production

- [ ] Variables SMTP configurées dans backend/.env
- [ ] Mot de passe d'application Gmail créé
- [ ] ADMIN_EMAIL configuré
- [ ] FRONTEND_URL configuré (sans trailing slash)
- [ ] Firestore rules déployées (`firebase deploy --only firestore:rules`)
- [ ] Test envoi email admin réussi
- [ ] Test envoi email client réussi
- [ ] Test validation téléphone français uniquement
- [ ] Backend redémarré avec nouvelles variables
- [ ] Monitoring configuré (optionnel)
- [ ] Tests manuels effectués (voir section Tests)

---

## 🎯 Résumé technique

**Architecture** : Service layer pattern + Email notification + Admin dashboard

**Technologies** :
- Frontend : Next.js 16, TypeScript, React
- Backend : Node.js, Express, Nodemailer
- Database : Firebase Firestore
- Email : SMTP (Gmail, SendGrid, Mailgun, etc.)

**Sécurité** :
- Triple validation téléphone (HTML5 + JS + Firestore)
- Admin-only access pour consultation/modification
- Public création (formulaire public)
- SMTP credentials en variables d'environnement

**Performance** :
- Tri client-side (évite index composite Firestore)
- Chargement parallèle stats + rappels
- Email asynchrone (pas de blocage UI)

**Conformité** :
- Données client stockées selon RGPD
- Email optionnel
- Soft delete possible (à implémenter si besoin)

---

**Date de création** : 26 janvier 2026  
**Version** : 1.0  
**Auteur** : ArtisanDispo Dev Team
