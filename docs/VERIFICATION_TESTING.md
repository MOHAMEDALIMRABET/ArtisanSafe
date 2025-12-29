# Guide de Test - Système de Vérification ArtisanDispo

## 📦 Prérequis Installés

✅ **Packages NPM installés :**
- `tesseract.js` v5.1.1 - OCR pour images
- `pdfjs-dist` v4.9.155 - Parsing de PDF

## 🧪 Plan de Test Complet

### 1. Test SIRET API (Recherche Entreprises)

**Page :** `/artisan/verification`

**Étapes :**
1. Connectez-vous en tant qu'artisan
2. Vérifiez que le SIRET est déjà renseigné (depuis l'inscription)
3. Cliquez sur **"Vérifier le SIRET"**
4. **Résultat attendu :**
   - ✅ Message : "SIRET vérifié avec succès!"
   - ✅ Badge vert sur la carte SIRET
   - ✅ Raison sociale affichée
   - ✅ Forme juridique affichée (SARL, SAS, etc.)

**Test de cas d'erreur :**
- SIRET invalide (non 14 chiffres) → "Format SIRET invalide"
- SIRET inexistant → "SIRET non trouvé dans la base"
- SIRET radié → "Entreprise inactive"

---

### 2. Test Vérification Email

**Page :** `/artisan/verification`

**Étapes :**
1. Vérifiez que l'email est affiché
2. Cliquez sur **"Envoyer l'email de vérification"**
3. **Résultat attendu :**
   - ✅ Alert : "Email envoyé! Vérifiez votre boîte de réception"
   - ✅ Vérifiez votre boîte email (Firebase Auth)
   - ✅ Cliquez sur le lien dans l'email
4. Rechargez la page `/artisan/verification`
5. **Résultat attendu :**
   - ✅ Badge vert ✓ "Email vérifié"
   - ✅ Bouton caché/désactivé

---

### 3. Test Vérification Téléphone (SMS)

**Page :** `/artisan/verification`

**⚠️ Note :** SMS réel nécessite Twilio/AWS SNS (actuellement console.log)

**Étapes :**
1. Entrez un numéro de téléphone : `+33612345678`
2. Cliquez sur **"Envoyer le code SMS"**
3. **Résultat attendu :**
   - ✅ Message : "Code envoyé!"
   - ✅ Champ de saisie du code apparaît
   - ✅ **Vérifiez la console navigateur** pour le code (6 chiffres)
4. Entrez le code (ex: `123456`)
5. Cliquez sur **"Vérifier le code"**
6. **Résultat attendu :**
   - ✅ Alert : "Téléphone vérifié avec succès!"
   - ✅ Badge vert ✓ sur téléphone
   - ✅ Bouton caché

**Test de cas d'erreur :**
- Code incorrect → "Code invalide"
- Code expiré (10 min) → "Code expiré"

---

### 4. Test Parsing Kbis avec OCR ⭐ **NOUVEAU**

**Page :** `/artisan/documents`

**📄 Préparez un fichier Kbis :**
- Format accepté : PDF, JPG, PNG
- Taille max : 10 MB
- Doit contenir le **SIRET de votre profil artisan**

**Étapes :**

#### A. Test avec Kbis valide (SIRET correspond)

1. Cliquez sur **"Choisir un fichier"** dans la section Kbis
2. Sélectionnez votre document Kbis
3. Vérifiez que la taille du fichier s'affiche (ex: "2.5 MB")
4. Cliquez sur **"Analyser et Uploader le Kbis"**
5. **Pendant le traitement :**
   - ⏳ Spinner de chargement visible
   - 📊 Si image : barre de progression OCR (Tesseract.js)
   - 📄 Si PDF : extraction du texte (pdf.js)
6. **Résultat attendu :**
   - ✅ Panel vert de succès apparaît :
     ```
     ✅ Kbis vérifié avec succès!
     
     Informations extraites :
     • SIRET trouvé: 123 456 789 01234
     • Entreprise: ABC PLOMBERIE SARL
     • Forme juridique: SARL
     ```
   - ✅ Document uploadé dans Firebase Storage
   - ✅ Firestore mis à jour :
     ```json
     verificationDocuments: {
       kbis: {
         url: "https://firebasestorage...",
         uploadDate: Timestamp,
         verified: true,  // ← Auto-vérifié!
         siretMatched: true,
         extractedData: {
           siret: "12345678901234",
           companyName: "ABC PLOMBERIE SARL",
           legalForm: "SARL"
         }
       }
     }
     ```

#### B. Test avec Kbis invalide (SIRET différent)

1. Uploadez un Kbis avec un SIRET différent de votre profil
2. **Résultat attendu :**
   - ❌ Message d'erreur rouge :
     ```
     Le SIRET du Kbis (987 654 321 00000) ne correspond pas au SIRET de votre profil (123 456 789 01234).
     Veuillez uploader le Kbis de votre entreprise.
     ```
   - ❌ Document **NON uploadé**
   - ❌ Firestore **NON modifié**

#### C. Test avec document illisible

1. Uploadez une image floue ou un PDF scanné de mauvaise qualité
2. **Résultat attendu :**
   - ❌ Message d'erreur :
     ```
     SIRET non trouvé dans le document.
     Assurez-vous que le document est lisible et contient le SIRET.
     ```

#### D. Test avec format invalide

1. Tentez d'uploader un fichier `.docx` ou `.txt`
2. **Résultat attendu :**
   - ❌ Message : "Format de fichier invalide. PDF, JPG ou PNG uniquement."

---

### 5. Test Upload Pièce d'Identité

**Page :** `/artisan/documents`

**Étapes :**
1. Cliquez sur **"Choisir un fichier"** dans la section Pièce d'identité
2. Sélectionnez une image (JPG, PNG, PDF)
3. Taille max : 5 MB
4. Cliquez sur **"Uploader la pièce d'identité"**
5. **Résultat attendu :**
   - ✅ Message : "Pièce d'identité uploadée avec succès!"
   - ✅ Notice : "En attente de vérification manuelle (24-48h)"
   - ✅ Firestore mis à jour :
     ```json
     verificationDocuments: {
       idCard: {
         url: "https://firebasestorage...",
         uploadDate: Timestamp,
         verified: false  // ← Attend vérification admin
       }
     }
     ```

---

### 6. Test Dashboard - Statut de Vérification

**Page :** `/artisan/dashboard`

**Cas 1 : Profil non vérifié**
- ✅ Carte "Mon Profil" affiche badge orange : **"En attente de vérification"**
- ✅ Nouvelle carte "Vérification Profil" visible avec :
  - Badge animé : **"Action requise"**
  - Checklist :
    - ⏳ Vérification SIRET
    - ⏳ Vérification email
    - ⏳ Vérification téléphone
    - ⏳ Documents Kbis
    - ⏳ Pièce d'identité
  - Bouton : **"Compléter la vérification →"**

**Cas 2 : Vérifications partielles**
- ✅ Checklist mise à jour en temps réel :
  - ✅ Vérification SIRET (si complété)
  - ✅ Vérification email (si complété)
  - ⏳ Vérification téléphone (si en attente)
  - etc.

**Cas 3 : Profil entièrement vérifié**
- ✅ Badge vert sur "Mon Profil" : **"Profil Vérifié ✓"**
- ✅ Carte "Vérification Profil" **cachée**
- ✅ Firestore :
  ```json
  {
    verified: true,
    verificationStatus: 'approved',
    verificationDate: Timestamp
  }
  ```

---

### 7. Test Firestore - Vérification des Données

**Collection :** `artisans/{userId}`

**Après vérification SIRET :**
```json
{
  "siretVerified": true,
  "siretVerificationDate": Timestamp("2024-01-15T10:30:00Z")
}
```

**Après vérification email :**
```json
{
  "contactVerification": {
    "email": {
      "verified": true,
      "verifiedDate": Timestamp("2024-01-15T10:35:00Z")
    }
  }
}
```

**Après vérification téléphone :**
```json
{
  "contactVerification": {
    "telephone": {
      "verified": true,
      "verifiedDate": Timestamp("2024-01-15T10:40:00Z"),
      "verificationCode": null,  // Effacé après vérification
      "codeExpiry": null
    }
  }
}
```

**Après upload Kbis avec OCR :**
```json
{
  "verificationDocuments": {
    "kbis": {
      "url": "https://firebasestorage.googleapis.com/v0/b/...",
      "uploadDate": Timestamp("2024-01-15T10:45:00Z"),
      "verified": true,  // ← Auto-vérifié par OCR!
      "siretMatched": true,
      "extractedData": {
        "siret": "12345678901234",
        "siren": "123456789",
        "companyName": "ABC PLOMBERIE SARL",
        "legalForm": "SARL"
      }
    }
  }
}
```

**Après upload pièce d'identité :**
```json
{
  "verificationDocuments": {
    "idCard": {
      "url": "https://firebasestorage.googleapis.com/v0/b/...",
      "uploadDate": Timestamp("2024-01-15T10:50:00Z"),
      "verified": false  // ← Attend admin
    }
  }
}
```

**Vérification complète :**
```json
{
  "verified": true,
  "verificationStatus": "approved",
  "verificationDate": Timestamp("2024-01-15T11:00:00Z")
}
```

---

## 🔍 Vérification Console Navigateur

### Pendant le parsing Kbis :

**Console logs attendus :**
```
🔍 Parsing Kbis document...
📄 Extracting text from PDF...
✅ Text extracted successfully (1234 characters)
🔍 Parsing Kbis text...
✅ SIRET found: 12345678901234
✅ Company name: ABC PLOMBERIE SARL
✅ Legal form: SARL
✅ SIRET comparison: MATCH!
✅ Kbis parsing completed successfully
```

### Pendant l'OCR d'image :

```
🔍 Extracting text from image...
OCR: 0%
OCR: 15%
OCR: 30%
OCR: 45%
OCR: 60%
OCR: 75%
OCR: 90%
OCR: 100%
✅ Text extracted successfully (2156 characters)
```

---

## 🐛 Dépannage

### Erreur : "Cannot find module 'tesseract.js'"
**Solution :** 
```bash
cd frontend
npm install tesseract.js pdfjs-dist
```

### PDF.js worker error
**Solution :** Vérifiez que cette ligne est présente dans `document-parser.ts` :
```typescript
pdfjsLib.GlobalWorkerOptions.workerSrc = 
  `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
```

### OCR ne détecte pas le SIRET
**Causes possibles :**
- Document trop flou → Re-scanner en meilleure qualité
- SIRET écrit à la main → OCR ne fonctionne que sur texte imprimé
- Format non standard → Le Kbis doit respecter le format officiel

**Solution temporaire :** Entrez manuellement le SIRET lors de l'inscription

### Firebase Storage : Erreur 403 (Forbidden)
**Cause :** Règles de sécurité Storage trop restrictives

**Solution :** Vérifiez Firebase Console > Storage > Rules :
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /documents/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## ✅ Checklist de Test Complet

- [ ] SIRET API valide une entreprise existante
- [ ] SIRET API rejette un SIRET invalide
- [ ] Email de vérification envoyé (Firebase Auth)
- [ ] Email vérifié après clic sur lien
- [ ] Code SMS généré (visible dans console)
- [ ] Code SMS validé correctement
- [ ] Code SMS expiré après 10 minutes
- [ ] Kbis PDF parsé avec succès
- [ ] Kbis image (JPG) parsé avec OCR
- [ ] SIRET extrait automatiquement
- [ ] SIRET comparé avec profil artisan
- [ ] Upload autorisé si SIRET correspond
- [ ] Upload bloqué si SIRET différent
- [ ] Pièce d'identité uploadée sans parsing
- [ ] Dashboard affiche statut de vérification
- [ ] Checklist mise à jour en temps réel
- [ ] Badge "Profil Vérifié ✓" apparaît quand tout est complet
- [ ] Firestore contient toutes les données de vérification

---

## 📊 Métriques de Performance

**OCR (Tesseract.js) :**
- Image 1 MB → ~5-10 secondes
- Image 3 MB → ~15-20 secondes

**PDF (pdf.js) :**
- PDF 1 page → ~1-2 secondes
- PDF 3 pages → ~3-5 secondes

**API SIRET (Recherche Entreprises) :**
- Réponse moyenne → ~500ms - 1s

**Upload Firebase Storage :**
- 1 MB → ~2-3 secondes
- 5 MB → ~8-10 secondes

---

## 🚀 Prochaines Étapes

### Court terme :
1. ✅ **Tester le parsing Kbis avec des documents réels**
2. ⏳ Intégrer SMS réel (Twilio/AWS SNS)
3. ⏳ Créer dashboard admin pour validation manuelle

### Moyen terme :
4. ⏳ Emails automatiques (approbation/rejet)
5. ⏳ Filtrer recherche (artisans verified: true uniquement)
6. ⏳ Statistiques admin (% de profils vérifiés)

### Long terme :
7. ⏳ Vérification d'assurance professionnelle
8. ⏳ Vérification Qualibat/RGE
9. ⏳ Badge "Pro Certifié" avec plusieurs niveaux

---

## 📝 Notes Importantes

### Sécurité :
- ✅ Documents stockés dans Firebase Storage avec règles par userId
- ✅ Firestore protégé (artisan ne peut modifier que son profil)
- ✅ SIRET validé via API gouvernementale officielle
- ✅ OCR empêche l'upload de Kbis d'une autre entreprise

### Confidentialité :
- ℹ️ Pièce d'identité accessible uniquement par l'artisan et les admins
- ℹ️ Kbis public (document légal officiel)
- ℹ️ Email/téléphone vérifiés mais non affichés publiquement

### Conformité RGPD :
- ✅ Documents supprimés à la demande de l'artisan
- ✅ Données de vérification anonymisées après 3 ans (à implémenter)

---

**Dernière mise à jour :** 2024-01-15
**Version système :** 1.0.0
**Packages installés :** tesseract.js v5.1.1, pdfjs-dist v4.9.155
