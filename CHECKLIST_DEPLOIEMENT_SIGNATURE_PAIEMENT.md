# ✅ Checklist Déploiement - Signature + Paiement

## 📋 Pré-Déploiement (Développement Local)

### Tests Fonctionnels
- [ ] **Test Signature**
  - [ ] Ouvrir devis (statut: 'envoye')
  - [ ] Cliquer "Accepter ce devis"
  - [ ] Modale signature s'affiche ✅
  - [ ] Dessiner signature (souris/tactile)
  - [ ] Cliquer "Valider"
  - [ ] Signature uploadée Firebase Storage ✅
  - [ ] Statut → 'en_attente_paiement' ✅

- [ ] **Test Paiement Réussi**
  - [ ] Modale paiement s'affiche après signature ✅
  - [ ] Countdown "24h" visible ✅
  - [ ] Remplir carte : 4242 4242 4242 4242
  - [ ] Cliquer "Payer"
  - [ ] Statut → 'paye' ✅
  - [ ] Email démasqué : `john@gmail.com` (au lieu de `j***@gmail.com`) ✅
  - [ ] Téléphone démasqué : `06 12 34 56 89` (au lieu de `06 ** ** ** 89`) ✅
  - [ ] Adresse démasquée : `32 rue Jean Jaurès` (au lieu de `32 rue *********`) ✅
  - [ ] Banner vert "Devis payé" affiché ✅

- [ ] **Test Timeout 24h**
  - [ ] Créer devis test avec `dateLimitePaiement` passée (Firestore)
  - [ ] Forcer Cloud Function : `gcloud scheduler jobs run ...`
  - [ ] Statut → 'annule' ✅
  - [ ] `motifAnnulation` enregistré ✅
  - [ ] Notification artisan créée (type: 'devis_annule_non_paye') ✅

### Tests Techniques
- [ ] **TypeScript**
  - [ ] `cd frontend && npm run build` → 0 erreurs ✅
  - [ ] `cd functions && npm run build` → 0 erreurs ✅

- [ ] **Console Navigateur**
  - [ ] Aucune erreur JavaScript (F12 → Console) ✅
  - [ ] Aucun warning React (re-renders infinis) ✅

- [ ] **Firestore**
  - [ ] Champs `signatureClient`, `dateLimitePaiement`, `paiement` bien créés ✅
  - [ ] Nouveaux statuts dans enum ✅

---

## 🚀 Déploiement Production

### 1. Frontend (Next.js)

```bash
cd frontend
npm run build
firebase deploy --only hosting
```

**Vérifications** :
- [ ] Build réussi (0 erreurs) ✅
- [ ] Deploy réussi ✅
- [ ] URL production accessible : https://[PROJECT_ID].web.app ✅
- [ ] Test rapide : Ouvrir devis → Bouton "Accepter" visible ✅

### 2. Cloud Functions

```bash
cd functions
npm install
npm run build
firebase deploy --only functions:annulerDevisNonPayes
```

**Vérifications** :
- [ ] `npm install` → Dépendances installées ✅
- [ ] `npm run build` → Compilation TypeScript réussie ✅
- [ ] Deploy réussi ✅
- [ ] Fonction visible : `firebase functions:list` ✅
- [ ] Cloud Scheduler créé : Console GCP → Cloud Scheduler ✅
- [ ] Job actif : `firebase-schedule-annulerDevisNonPayes-[REGION]` ✅

### 3. Firebase Storage Rules

**Fichier** : `storage.rules`

**Règles signatures** :
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /signatures/{signatureId} {
      allow create: if request.auth != null 
                    && request.auth.token.role == 'client'
                    && request.resource.size < 5 * 1024 * 1024;
      allow read: if request.auth != null;
      allow delete: if false; // Jamais supprimer signatures
    }
  }
}
```

**Déploiement** :
```bash
firebase deploy --only storage
```

**Vérifications** :
- [ ] Règles déployées ✅
- [ ] Test upload signature (via app) → Succès ✅
- [ ] Test lecture signature → Accessible ✅

---

## 🧪 Tests Post-Déploiement

### Test 1 : Workflow Complet E2E

**Durée estimée** : 5 minutes

1. **Créer compte client test**
   - [ ] Inscription → Email vérification ✅

2. **Créer devis test (via compte artisan)**
   - [ ] Devis envoyé au client test ✅
   - [ ] Statut : 'envoye' ✅

3. **Accepter et signer (compte client)**
   - [ ] Ouvrir devis ✅
   - [ ] Cliquer "Accepter" ✅
   - [ ] Signer dans canvas ✅
   - [ ] Valider signature ✅
   - [ ] Vérifier Firestore :
     - [ ] `statut` → 'en_attente_paiement' ✅
     - [ ] `signatureClient.url` existe ✅
     - [ ] `dateLimitePaiement` = now + 24h ✅

4. **Payer (compte client)**
   - [ ] Modale paiement ouverte auto ✅
   - [ ] Countdown "24h" affiché ✅
   - [ ] Remplir carte : 4242 4242 4242 4242 ✅
   - [ ] Payer ✅
   - [ ] Vérifier Firestore :
     - [ ] `statut` → 'paye' ✅
     - [ ] `paiement.referenceTransaction` existe ✅
   - [ ] Vérifier UI :
     - [ ] Email artisan visible complet ✅
     - [ ] Téléphone artisan visible complet ✅
     - [ ] Adresse artisan visible complète ✅
     - [ ] Banner vert "Devis payé" ✅

5. **Vérifier côté artisan**
   - [ ] Notification reçue (type: 'devis_paye') ✅
   - [ ] Badge 🔔 avec compteur ✅
   - [ ] Signature visible dans devis ✅

### Test 2 : Annulation Automatique 24h

**Durée estimée** : 10 minutes

1. **Créer devis expiré (Firestore Console)**
   ```json
   {
     "statut": "en_attente_paiement",
     "dateLimitePaiement": "2026-01-31T10:00:00Z",  // HIER
     "signatureClient": {
       "url": "https://...",
       "date": "2026-01-31T10:00:00Z"
     },
     "artisanId": "test-artisan-id",
     "clientId": "test-client-id",
     "numeroDevis": "DV-TEST-00001",
     "montantTTC": 1500
   }
   ```
   - [ ] Document créé ✅

2. **Forcer exécution Cloud Function**
   ```bash
   gcloud scheduler jobs run firebase-schedule-annulerDevisNonPayes-us-central1
   ```
   - [ ] Commande réussie ✅

3. **Vérifier Firestore (après 10s)**
   - [ ] `statut` → 'annule' ✅
   - [ ] `dateAnnulation` créée ✅
   - [ ] `motifAnnulation` → "Paiement non effectué dans les 24h" ✅

4. **Vérifier Notifications**
   - [ ] Nouvelle notification artisan créée ✅
   - [ ] Type : 'devis_annule_non_paye' ✅
   - [ ] Message : "Le client n'a pas payé dans les 24h" ✅

5. **Vérifier Logs**
   ```bash
   firebase functions:log --only annulerDevisNonPayes --limit 10
   ```
   - [ ] Log visible : "❌ Annulé: DV-TEST-00001" ✅
   - [ ] Aucune erreur ✅

### Test 3 : Masking/Unmasking

**Avant paiement** :
- [ ] Email : `j***@gmail.com` ✅
- [ ] Téléphone : `06 ** ** ** 89` ✅
- [ ] Adresse : `32 rue *********, 75001 Paris` ✅

**Après paiement** :
- [ ] Email : `john@gmail.com` ✅
- [ ] Téléphone : `06 12 34 56 89` ✅
- [ ] Adresse : `32 rue Jean Jaurès, 75001 Paris` ✅

---

## 📊 Monitoring Post-Déploiement

### Dashboard Firebase Console

**URL** : https://console.firebase.google.com/project/[PROJECT_ID]/functions

**Métriques à surveiller** :
- [ ] **Invocations** : 24/jour attendu (1/heure) ✅
- [ ] **Erreurs** : 0% idéal, < 1% acceptable ✅
- [ ] **Temps d'exécution** : < 5s normal, < 10s acceptable ✅
- [ ] **Mémoire** : < 128MB ✅

### Logs Temps Réel (Premières 24h)

```bash
firebase functions:log --only annulerDevisNonPayes --follow
```

**Surveiller** :
- [ ] Exécution toutes les heures ✅
- [ ] Logs "✅ Aucun devis à annuler" (normal au début) ✅
- [ ] Aucune erreur `ERROR` ✅

### Alertes à Configurer

**Firebase Console → Functions → annulerDevisNonPayes → Metrics → Alertes** :

- [ ] **Alerte Erreurs**
  - Trigger : Taux erreur > 5%
  - Action : Email admin
  - ✅ Configuré

- [ ] **Alerte Performance**
  - Trigger : Temps exécution > 30s
  - Action : Slack notification
  - ✅ Configuré

- [ ] **Alerte Anomalie**
  - Trigger : Invocations > 50/heure (anomalie)
  - Action : Email admin
  - ✅ Configuré

---

## 💰 Vérification Coûts

### Quotas Firebase (Plan Gratuit)

**Cloud Scheduler** :
- Limite gratuite : 3 jobs
- Utilisé : 1 job ✅
- Reste : 2 jobs disponibles ✅

**Cloud Functions Invocations** :
- Limite gratuite : 2M/mois
- Attendu : 720/mois (24×30)
- Pourcentage : 0.036% ✅

**Firestore Reads** :
- Limite gratuite : 50k/jour
- Attendu : ~2400/jour (100 reads × 24 exécutions)
- Pourcentage : 4.8% ✅

**Firebase Storage** :
- Limite gratuite : 5GB
- Utilisé : ~10MB signatures (quelques KB chacune)
- Pourcentage : 0.2% ✅

**Conclusion** :
- [ ] **Coûts mensuels** : 0€ (largement sous quotas) ✅

---

## 📚 Documentation Équipe

### Formation Équipe

- [ ] **Équipe Support** : Lire [GUIDE_EQUIPE_SIGNATURE_PAIEMENT.md](./docs/GUIDE_EQUIPE_SIGNATURE_PAIEMENT.md) ✅
- [ ] **Équipe Dev** : Lire [RECAP_IMPLEMENTATION.md](./docs/RECAP_IMPLEMENTATION.md) ✅
- [ ] **DevOps** : Lire [DEPLOY_CLOUD_FUNCTION.md](./docs/DEPLOY_CLOUD_FUNCTION.md) ✅

### Communication Clients

- [ ] **Email annonce** : Nouvelle fonctionnalité signature + paiement ✅
- [ ] **Guide utilisateur** : Lien vers [GUIDE_SIGNATURE_CLIENT.md](./docs/GUIDE_SIGNATURE_CLIENT.md) ✅
- [ ] **FAQ mise à jour** : Section paiement 24h ✅

---

## 🔒 Sécurité

### Firestore Rules

**Vérifier règles pour champs sensibles** :
```
match /devis/{devisId} {
  allow read: if isOwner() || isArtisan() || isAdmin();
  allow update: if isOwner() || isArtisan();
  
  // Nouveau: Champ paiement protégé
  allow update: if request.resource.data.paiement == null
                || isOwner() || isAdmin();
}
```

- [ ] Règles déployées ✅
- [ ] Test : Client ne peut pas modifier paiement d'un autre ✅

### RGPD / Données Personnelles

- [ ] **Masking** : Coordonnées masquées avant paiement ✅
- [ ] **Démasking** : Seulement après engagement contractuel (paiement) ✅
- [ ] **Signature** : Stockée sécurisée Firebase Storage ✅
- [ ] **Paiement** : Données transaction chiffrées ✅
- [ ] **Logs** : Pas de données sensibles dans logs Cloud Function ✅

---

## ✅ Validation Finale

### Checklist GO/NO-GO Production

**CRITÈRES BLOQUANTS** :

- [ ] **Tests E2E passent** : Signature → Paiement → Unmask ✅
- [ ] **Cloud Function déployée** : Visible dans `firebase functions:list` ✅
- [ ] **Cloud Scheduler actif** : Job visible GCP Console ✅
- [ ] **Logs sans erreurs** : Premières 3 exécutions sans `ERROR` ✅
- [ ] **Coûts validés** : 0€/mois (quotas gratuits) ✅
- [ ] **Équipe formée** : Documentation lue et comprise ✅

**CRITÈRES OPTIONNELS** :

- [ ] Alertes configurées ✅
- [ ] Dashboard monitoring activé ✅
- [ ] Communication clients préparée ✅

---

## 🚨 Rollback Plan (Si Problèmes)

### Si Cloud Function échoue

**Symptômes** :
- Erreurs dans logs
- Devis non annulés après 24h

**Actions** :
1. **Désactiver Cloud Scheduler** :
   ```bash
   gcloud scheduler jobs pause firebase-schedule-annulerDevisNonPayes-us-central1
   ```

2. **Analyser logs** :
   ```bash
   firebase functions:log --only annulerDevisNonPayes --limit 50
   ```

3. **Corriger bug** → Redéployer :
   ```bash
   cd functions && npm run build && firebase deploy --only functions:annulerDevisNonPayes
   ```

4. **Réactiver Scheduler** :
   ```bash
   gcloud scheduler jobs resume firebase-schedule-annulerDevisNonPayes-us-central1
   ```

### Si Masking/Unmasking ne fonctionne pas

**Symptômes** :
- Coordonnées toujours masquées après paiement
- Coordonnées visibles avant paiement

**Actions** :
1. **Vérifier Firestore** : `devis.statut === 'paye'` ?
2. **Vérifier code** : `shouldMask = devis.statut !== 'paye'` ?
3. **Hard refresh** : Ctrl+Shift+R
4. **Si problème persiste** → Rollback frontend :
   ```bash
   git revert HEAD
   cd frontend && npm run build && firebase deploy --only hosting
   ```

---

## 📞 Support Post-Déploiement

**Slack** : #dev-artisandispo  
**Email** : dev@artisandispo.fr  
**Documentation** : [`docs/README.md`](./docs/README.md)

**Oncall** : [NOM] (première semaine)

---

**Créé le** : 2026-02-01  
**Responsable** : DevOps  
**Statut** : ✅ PRÊT - Attente validation finale avant déploiement
