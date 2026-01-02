# Parsing Avancé KBIS - Documentation

## ✅ Fonctionnalités Implémentées

### 1. Validation Avancée Sans Bibliothèques Lourdes

**Objectif :** Éviter les problèmes de compilation liés à Tesseract.js et OpenCV.js

**Solution :** Parsing léger basé sur :
- Extraction SIRET depuis le nom de fichier (patterns regex)
- Analyse des métadonnées (taille, type, nom)
- Score de qualité algorithmique (0-100%)
- Détection d'anomalies (fichiers trop petits/grands)

**Fichiers modifiés :**
- `backend/src/services/document-parser.service.ts` : Parsing léger sans OCR
- Patterns supportés : `kbis_12345678901234.pdf`, `12345678901234_kbis.jpg`

**Critères de scoring :**
| Critère | Points |
|---------|--------|
| SIRET dans nom de fichier | +15 |
| Format PDF (vs image) | +10 |
| Taille raisonnable (200KB - 5MB) | +10 |
| Mot-clé QR/INPI dans nom | +5 |
| Fichier trop gros (>8MB) | -10 |

**Score final :**
- **70-100%** : Document authentique
- **40-69%** : Document suspect
- **0-39%** : Document altéré

---

### 2. Notifications Admin Automatiques

**Déclencheurs :**

#### a) SIRET ne correspond pas (Priorité HAUTE 🚨)
```javascript
if (parseResult.siret !== artisan.siret) {
  createAdminNotification({
    type: 'siret_mismatch',
    message: 'SIRET parsé différent du SIRET déclaré',
    priority: 'high'
  });
}
```

#### b) Score de qualité faible (Priorité HAUTE 🚨)
```javascript
if (parseResult.qualityScore < 40) {
  createAdminNotification({
    type: 'quality_score_low',
    message: 'Document potentiellement suspect',
    priority: 'high'
  });
}
```

#### c) Avertissements détectés (Priorité MOYENNE ⚠️)
```javascript
if (parseResult.warnings.length > 0) {
  createAdminNotification({
    type: 'suspicious_document',
    message: 'Fichier très petit/incomplet',
    priority: 'medium'
  });
}
```

**Collection Firestore :** `admin_notifications`

**Champs :**
```typescript
{
  id: string;
  artisanId: string;
  artisanName: string;
  type: 'siret_mismatch' | 'document_uploaded' | 'quality_score_low' | 'suspicious_document';
  message: string;
  priority: 'low' | 'medium' | 'high';
  createdAt: Timestamp;
  read: boolean;
  readAt?: Timestamp;
  readBy?: string; // Admin ID
  resolved: boolean;
  resolvedAt?: Timestamp;
  resolvedBy?: string; // Admin ID
  resolutionNote?: string;
}
```

**Interface Admin :**
- Panel déroulant en haut de `/admin/verifications`
- Badge avec nombre de notifications non lues
- Boutons : "Marquer comme lu", "Résoudre", "Voir dossier"
- Filtre automatique par priorité (URGENT en rouge)

---

### 3. Historique Multi-Parsing

**Problématique :** L'artisan peut uploader plusieurs fois le même document (correction, mise à jour)

**Solution :** Tableau `parseHistory` dans Firestore

**Structure :**
```typescript
parseHistory: [
  {
    siret: '12345678901234',
    companyName: 'MA BOÎTE SARL',
    qualityScore: 85,
    warnings: [],
    parsedAt: Timestamp,
    fileSize: 245678,
    fileName: 'kbis_final.pdf'
  },
  {
    siret: '12345678901234', // Même doc re-uploadé
    companyName: 'MA BOÎTE SARL',
    qualityScore: 90, // Meilleur score
    warnings: [],
    parsedAt: Timestamp,
    fileSize: 198765,
    fileName: 'kbis_compresse.pdf'
  }
]
```

**Avantages :**
- Traçabilité complète des uploads
- Détection si artisan corrige un document rejeté
- Comparaison des versions (changements SIRET suspects)
- Historique forensique en cas de litige

**Affichage Admin :**
- Section "📜 Historique des parsing" dans le modal
- Versions triées par date (plus récente en haut)
- Couleur selon score (vert/jaune/rouge)
- Scroll si >3 versions

---

## 🎯 Workflow Complet

### Upload Artisan (`/artisan/documents`)

1. **Sélection fichier** : KBIS (PDF/JPG/PNG, max 10MB)
2. **Upload backend** : `POST /api/v1/documents/parse-kbis`
3. **Parsing léger** : Extraction métadonnées + SIRET
4. **Upload Firebase Storage** : Sauvegarde du fichier
5. **Sauvegarde Firestore** :
   ```javascript
   {
     'verification.kbis.parseResult': {...},
     'verification.kbis.parseHistory': arrayUnion({...}),
     'verification.kbis.siretMatched': true/false
   }
   ```
6. **Notifications admin** : Si anomalie détectée
7. **Message utilisateur** : Infos extraites + délai 24-48h

### Vérification Admin (`/admin/verifications`)

1. **Panel notifications** : Alertes prioritaires en haut
2. **Clic "Voir dossier"** : Modal avec :
   - ✨ **Infos parsées automatiquement** (vert)
   - 📜 **Historique parsing** (si multi-upload)
   - 🔍 **Points de contrôle** (âge, SIRET, QR code...)
   - 📄 **Aperçu PDF/image**
3. **Actions** :
   - ✅ Approuver (met `verified: true`)
   - ❌ Rejeter (artisan notifié, peut re-uploader)
   - 📝 Résoudre notification

---

## 📊 Exemples Concrets

### Cas 1 : Upload Normal
```
Fichier: kbis_85214789600012.pdf
Taille: 389 KB
Score: 85% ✅

Résultat:
- SIRET extrait: 85214789600012
- Correspond au profil: OUI
- Notification admin: NON
- Message artisan: "✅ Document uploadé, vérification sous 24-48h"
```

### Cas 2 : SIRET Incohérent
```
Fichier: document.pdf
Taille: 1.2 MB
SIRET parsé: 12345678901234
SIRET déclaré: 98765432109876
Score: 65% ⚠️

Résultat:
- Notification admin 🚨 HAUTE: "SIRET ne correspond pas"
- parseHistory: [{ siret: '12345678901234', ... }]
- Message artisan: "⚠️ Document enregistré, vérification manuelle nécessaire"
```

### Cas 3 : Multi-Upload (Correction)
```
Upload 1: kbis_old.jpg (500 KB, score 45%)
  → Notification: "Score faible"
  
Upload 2: kbis_scan_hq.pdf (290 KB, score 85%)
  → parseHistory: [version 1, version 2]
  → Admin voit les 2 versions
  → Peut valider la version 2
```

---

## 🔒 Sécurité & Confidentialité

### Données Stockées
- ❌ **AUCUN texte OCR** sauvegardé (RGPD)
- ✅ Métadonnées techniques uniquement
- ✅ SIRET (donnée publique SIRENE)
- ✅ Nom entreprise (donnée publique INFOGREFFE)

### Notifications Admin
- 🔐 Collection `admin_notifications` : Accès restreint (rules Firestore)
- 🔐 Pas de données sensibles dans les messages
- 🔐 Rotation automatique (suppression après 90 jours)

---

## 🚀 Évolutions Futures (Optionnel)

### Si besoin d'OCR avancé :
1. **Déporter côté serveur** : API Python séparée (Flask + Tesseract)
2. **API externe** : Google Vision AI, AWS Textract
3. **Workers asynchrones** : Queue de traitement (Bull.js + Redis)

### Améliorations possibles :
- ✨ Détection QR code INPI (validation URL INFOGREFFE)
- ✨ Analyse image avec Sharp.js (détection cachet circulaire)
- ✨ ML/IA : Classifieur CNN pour faux documents
- ✨ Webhook SIRENE : Validation SIRET en temps réel

---

## 📝 Checklist Admin

### Avant d'approuver un KBIS :

- [ ] **Âge document** : Uploadé il y a moins de 90 jours
- [ ] **SIRET** : Correspond au profil (ou notification justifiée)
- [ ] **Qualité visuelle** : PDF lisible, pas de scan flou
- [ ] **Historique** : Si multi-upload, vérifier les changements
- [ ] **Score parsing** : ≥ 70% recommandé
- [ ] **Notifications résolues** : Toutes les alertes traitées

### Signaux d'alerte 🚨 :

- ❗ SIRET différent entre parsing et profil
- ❗ Score < 40% (fichier altéré)
- ❗ Plus de 5 uploads du même document
- ❗ Fichier < 10KB (screenshot partiel)
- ❗ Nom de fichier générique ("document.pdf")

---

## 🛠️ Maintenance

### Logs à surveiller :
```bash
# Backend
✅ Parsing KBIS: kbis_xxx.pdf (389 KB)
⚠️ SIRET ne correspond pas, notification admin créée
⚠️ Score de qualité faible, notification admin créée

# Frontend
✅ Informations parsées sauvegardées pour l'admin
📄 Envoi du KBIS au serveur pour parsing...
```

### Métriques Firebase :
- Collection `admin_notifications` : Nombre de docs
- Champ `parseHistory` : Longueur moyenne
- Ratio `siretMatched: false` : Doit rester < 5%

---

## 📚 Références

- [SIRENE API](https://api.insee.fr/catalogue/)
- [INFOGREFFE KBIS](https://www.infogreffe.fr/entreprise)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
