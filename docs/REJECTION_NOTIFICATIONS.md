# Système de Notifications - Rejet de Documents

## Vue d'ensemble

Ce document décrit comment les artisans sont notifiés lorsque leurs documents (KBIS ou pièce d'identité) sont rejetés par l'équipe admin.

## 🎯 Objectifs

1. **Informer immédiatement** l'artisan du rejet de son document
2. **Expliquer clairement** la raison du rejet
3. **Guider l'artisan** pour corriger et re-uploader un document conforme
4. **Traçabilité** de toutes les actions admin (validation/rejet)

---

## 📊 Flux de Notification

### 1. Admin rejette un document

**Page :** `/admin/verifications`

**Action :** L'admin clique sur "Rejeter" dans la modal de vérification et saisit une raison.

**Backend :** La fonction `updateDocumentStatus` est appelée avec :
```typescript
{
  userId: string,
  documentType: 'kbis' | 'idCard',
  status: 'rejected',
  reason: string  // Raison du rejet saisie par admin
}
```

**Mise à jour Firestore :**
```typescript
'verificationDocuments.kbis.rejected': true,
'verificationDocuments.kbis.rejectedAt': Timestamp.now(),
'verificationDocuments.kbis.rejectedBy': adminEmail,
'verificationDocuments.kbis.rejectionReason': reason,
'verificationDocuments.kbis.verified': false,
```

---

### 2. Notification visuelle dans le Dashboard

**Page :** `/artisan/dashboard`

**Affichage conditionnel :**
- **Alerte rouge** en haut du dashboard si un document est rejeté
- **Badge "❌ Rejeté"** dans la section "Vérification Profil"
- **Raison du rejet** affichée clairement
- **Bouton CTA** "📤 Uploader un nouveau document" → redirige vers `/artisan/documents`

**Code :**
```tsx
{(artisan?.verificationDocuments?.kbis?.rejected || 
  artisan?.verificationDocuments?.idCard?.rejected) && (
  <div className="bg-red-50 border-l-4 border-red-500 p-5">
    <h3>⚠️ Document(s) rejeté(s) - Action requise</h3>
    
    {artisan.verificationDocuments.kbis.rejected && (
      <div>
        <p>📄 KBIS rejeté</p>
        <p><strong>Raison :</strong> {kbisRejectionReason}</p>
      </div>
    )}
    
    <button onClick={() => router.push('/artisan/documents')}>
      📤 Uploader un nouveau document
    </button>
  </div>
)}
```

---

### 3. Affichage détaillé dans la page Documents

**Page :** `/artisan/documents`

**Logique d'affichage :**

#### États du document :
- `verified = true` → ✅ Badge vert "Vérifié" + pas de formulaire
- `rejected = true` → ❌ Badge rouge "Rejeté" + message + formulaire re-upload
- `url exists && !verified && !rejected` → ⏳ Badge bleu "En cours de vérification" + pas de formulaire
- Aucun document → 📄 Icône orange + formulaire upload

#### Message de rejet (exemple KBIS) :
```tsx
{kbisRejected && (
  <div className="bg-red-50 border-l-4 border-red-500 p-4">
    <div className="flex items-start gap-3">
      <span className="text-2xl">❌</span>
      <div>
        <p className="font-bold text-red-800">
          Document rejeté par notre équipe
        </p>
        <p className="text-red-700">
          <strong>Raison :</strong> {kbisRejectionReason || 'Non spécifiée'}
        </p>
        <p className="text-red-600">
          📤 Veuillez uploader un nouveau document conforme aux exigences.
        </p>
      </div>
    </div>
  </div>
)}
```

#### Formulaire de re-upload :
Le formulaire d'upload s'affiche **uniquement si** :
- Le document n'est **pas vérifié**
- Le document n'est **pas en cours de vérification** (uploaded mais pas encore traité)
- Le document n'a **pas de message de succès** temporaire affiché

```tsx
{!kbisVerified && !kbisUploaded && !kbisSuccess && !kbisRejected && (
  <div>
    {/* Formulaire upload */}
  </div>
)}
```

**⚠️ CORRECTION IMPORTANTE :**
Quand un document est **rejeté**, l'artisan doit pouvoir **re-uploader**. Donc la condition devient :
```tsx
{!kbisVerified && !kbisUploaded && !kbisSuccess && (
  <div>
    {/* Formulaire upload */}
  </div>
)}
```

---

## 🔔 Notifications Email (Phase future)

### Implémentation prévue

**Déclencheur :** Lorsque l'admin rejette un document, envoyer automatiquement un email à l'artisan.

**Service :** `notification-service.ts`

**Fonction :**
```typescript
export async function sendDocumentRejectionEmail(
  artisanEmail: string,
  artisanName: string,
  documentType: 'KBIS' | 'Pièce d\'identité',
  rejectionReason: string
) {
  const emailContent = {
    to: artisanEmail,
    subject: `❌ Document ${documentType} rejeté - ArtisanSafe`,
    html: `
      <h2>Bonjour ${artisanName},</h2>
      
      <p>Votre document <strong>${documentType}</strong> a été examiné par notre équipe et <strong style="color: #DC3545;">n'a pas pu être validé</strong>.</p>
      
      <div style="background: #FEE; border-left: 4px solid #DC3545; padding: 15px; margin: 20px 0;">
        <h3>Raison du rejet :</h3>
        <p><strong>${rejectionReason}</strong></p>
      </div>
      
      <h3>Que faire maintenant ?</h3>
      <ol>
        <li>Vérifiez que votre document respecte les critères :
          <ul>
            <li>Document récent (moins de 3 mois pour le KBIS)</li>
            <li>Image claire et lisible</li>
            <li>Toutes les informations visibles</li>
          </ul>
        </li>
        <li>Préparez un nouveau document conforme</li>
        <li>Uploadez-le depuis votre espace artisan</li>
      </ol>
      
      <a href="https://artisansafe.com/artisan/documents" 
         style="display: inline-block; background: #FF6B00; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0;">
        📤 Uploader un nouveau document
      </a>
      
      <p>Notre équipe examinera votre nouveau document sous 24-48h.</p>
      
      <hr>
      <p style="color: #666; font-size: 12px;">
        Si vous avez des questions, contactez-nous à support@artisansafe.com
      </p>
    `,
  };
  
  // Utiliser Firebase Functions + SendGrid/Resend
  await sendEmail(emailContent);
}
```

**Appel dans `updateDocumentStatus` :**
```typescript
if (status === 'rejected') {
  // Récupérer infos artisan
  const userDoc = await getDoc(doc(db, 'users', userId));
  const artisan = userDoc.data();
  
  // Envoyer email
  await sendDocumentRejectionEmail(
    artisan.email,
    `${artisan.prenom} ${artisan.nom}`,
    documentType === 'kbis' ? 'KBIS' : 'Pièce d\'identité',
    reason
  );
}
```

---

## 📱 Notifications Push (Phase future)

Pour une expérience optimale, implémenter des **notifications push** via :

### Firebase Cloud Messaging (FCM)

**Quand :** Document rejeté

**Message :**
```json
{
  "notification": {
    "title": "❌ Document rejeté",
    "body": "Votre {documentType} a été rejeté. Raison : {reason}",
    "click_action": "https://artisansafe.com/artisan/documents"
  },
  "data": {
    "type": "document_rejected",
    "documentType": "kbis",
    "rejectionReason": "{reason}"
  }
}
```

---

## 🛠️ États et Transitions

### Cycle de vie d'un document

```
┌─────────────┐
│   Initial   │
│  (Aucun doc)│
└──────┬──────┘
       │ Upload
       ↓
┌─────────────┐
│  En attente │
│ (uploaded)  │
└──────┬──────┘
       │ Admin examine
       ↓
    ┌──┴──┐
    │     │
    ↓     ↓
┌────────┐ ┌────────┐
│Vérifié │ │Rejeté  │
│  (✅)  │ │  (❌)  │
└────────┘ └────┬───┘
              │
              │ Artisan re-upload
              ↓
          ┌─────────────┐
          │  En attente │
          │ (uploaded)  │
          └─────────────┘
```

### Variables Firestore par état

| État | verified | rejected | url | rejectionReason |
|------|----------|----------|-----|-----------------|
| **Initial** | false | false | null | null |
| **En attente** | false | false | "https://..." | null |
| **Vérifié** | true | false | "https://..." | null |
| **Rejeté** | false | true | "https://..." | "Raison..." |
| **Re-upload** | false | false | "https://new..." | null *(reset)* |

---

## 🎨 UI/UX - Guide visuel

### Dashboard - Alerte de rejet

```
┌─────────────────────────────────────────────────────────┐
│ ⚠️  Document(s) rejeté(s) - Action requise             │
│                                                         │
│  📄 KBIS rejeté                                         │
│     Raison : Document périmé (datant de plus de 3 mois) │
│                                                         │
│  [ 📤 Uploader un nouveau document ]                    │
└─────────────────────────────────────────────────────────┘
```
*Couleur : `bg-red-50 border-red-500`*

---

### Page Documents - Section KBIS rejeté

```
┌─────────────────────────────────────────────────────────┐
│  ❌  Extrait Kbis                         [ ✗ Rejeté ] │
│      Moins de 3 mois                                    │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ ❌  Document rejeté par notre équipe              │ │
│  │                                                   │ │
│  │  Raison : Document périmé (> 3 mois)             │ │
│  │                                                   │ │
│  │  📤 Veuillez uploader un nouveau document        │ │
│  │     conforme aux exigences.                      │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  Sélectionner le fichier Kbis (PDF, JPG, PNG)          │
│  [ Choisir un fichier ]                                 │
│                                                         │
│  [ 📤 Uploader le Kbis ]                                │
└─────────────────────────────────────────────────────────┘
```

---

## ✅ Checklist d'implémentation

### Phase 1 - MVP ✅ (Complété)
- [x] Affichage badge "❌ Rejeté" dans dashboard
- [x] Affichage raison du rejet dans dashboard
- [x] Alerte rouge en haut du dashboard si document rejeté
- [x] Message détaillé dans page `/artisan/documents`
- [x] Formulaire de re-upload disponible si document rejeté
- [x] Icône rouge ❌ pour documents rejetés
- [x] Distinction visuelle claire : vérifié ✅ / en attente ⏳ / rejeté ❌

### Phase 2 - Notifications (À venir)
- [ ] Service d'envoi d'emails (`notification-service.ts`)
- [ ] Template email de rejet (HTML + texte)
- [ ] Envoi automatique d'email lors du rejet
- [ ] Lien direct dans l'email vers page documents
- [ ] Historique des emails envoyés (collection `email_logs`)

### Phase 3 - Notifications Push (Future)
- [ ] Configuration Firebase Cloud Messaging
- [ ] Demande de permission notifications dans frontend
- [ ] Envoi de notification push lors du rejet
- [ ] Click action vers page documents
- [ ] Badge de notification dans header

---

## 🔒 Sécurité et Bonnes Pratiques

### Prévention des abus

1. **Limite de re-upload :** Max 3 tentatives par document par jour
2. **Blocage automatique :** Après 5 rejets consécutifs, compte suspendu
3. **Traçabilité :** Logger toutes les actions admin avec timestamp et raison

### Privacy

- Ne jamais exposer les emails admin dans les messages artisan
- Anonymiser les données dans les logs après 90 jours
- Permettre à l'artisan de contester un rejet via support

---

## 📝 Messages types de rejet

### KBIS
- "Document périmé (datant de plus de 3 mois)"
- "Document illisible ou de mauvaise qualité"
- "SIRET ne correspond pas à celui déclaré"
- "Document incomplet ou partiellement masqué"
- "Nom du représentant légal ne correspond pas"

### Pièce d'identité
- "Document expiré ou non valide"
- "Photo floue ou illisible"
- "Document partiellement masqué"
- "Recto-verso incomplet"
- "Type de document non accepté (permis de conduire non autorisé)"
- "Nom ne correspond pas au profil"

---

## 🚀 Améliorations futures

1. **Feedback proactif :**
   - Indiquer le score de qualité du document uploadé
   - Suggérer des corrections avant soumission à l'admin

2. **Chat support :**
   - Bouton "Contester ce rejet" → ouvre un ticket support
   - L'artisan peut expliquer sa situation

3. **IA de pré-validation :**
   - OCR automatique pour détecter erreurs avant envoi à admin
   - Alerte si document périmé ou SIRET incorrect

4. **Tableau de bord admin :**
   - Statistiques de rejets par type de document
   - Raisons de rejet les plus fréquentes
   - Taux de conformité après re-upload

---

## 📞 Support

En cas de problème ou question, l'artisan peut :
- Consulter la FAQ : `/faq`
- Contacter le support : `support@artisansafe.com`
- Appeler le service client : `01 XX XX XX XX`

---

**Dernière mise à jour :** 2 janvier 2026
**Statut :** Phase 1 complétée ✅ | Phase 2 en planification
