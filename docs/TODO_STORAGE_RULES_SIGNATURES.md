# TODO - Règles Firebase Storage pour Signatures Électroniques

## ⚠️ IMPORTANT - À déployer avant mise en production

### Fichier à modifier

**Chemin** : `storage.rules`

### Règles à ajouter

Ajouter cette section dans `storage.rules` :

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // ... règles existantes ...
    
    // 🆕 SIGNATURES ÉLECTRONIQUES
    match /signatures/{signatureId} {
      // Création : Seuls clients authentifiés peuvent uploader
      // Limite : 5MB par signature
      allow create: if request.auth != null 
                    && request.auth.token.role == 'client'
                    && request.resource.size < 5 * 1024 * 1024; // Max 5MB
      
      // Lecture : Tout utilisateur authentifié peut consulter
      // (Client qui a signé + Artisan lié au devis + Admin)
      allow read: if request.auth != null;
      
      // Modification/Suppression : STRICTEMENT INTERDIT
      // Une signature ne peut jamais être modifiée ou supprimée
      // (Conformité juridique eIDAS)
      allow update, delete: if false;
    }
  }
}
```

### Commandes de déploiement

```bash
# 1. Vérifier la syntaxe des règles
firebase deploy --only storage --dry-run

# 2. Déployer les règles Storage
firebase deploy --only storage

# 3. Vérifier le déploiement
# Aller sur Firebase Console → Storage → Rules
# Copier/coller les règles ci-dessus si nécessaire
```

### Tests post-déploiement

**Test 1 : Client peut uploader**
```javascript
// Se connecter en tant que client
// Tester acceptation devis avec signature
// Vérifier upload réussit
```

**Test 2 : Lecture autorisée**
```javascript
// Se connecter en tant qu'artisan
// Consulter devis accepté
// Vérifier image signature s'affiche
```

**Test 3 : Modification interdite**
```javascript
// Tenter de modifier une signature existante
// Doit échouer avec erreur Permission Denied
```

**Test 4 : Suppression interdite**
```javascript
// Tenter de supprimer une signature
// Doit échouer avec erreur Permission Denied
```

### Règles Firestore complémentaires (optionnel)

Ajouter dans `firestore.rules` pour sécuriser le champ `signatureClient` :

```javascript
match /devis/{devisId} {
  // ... règles existantes ...
  
  // Empêcher modification du champ signatureClient après création
  allow update: if request.auth != null && (
    // Soit l'artisan met à jour ses champs
    (resource.data.artisanId == request.auth.uid &&
     request.resource.data.signatureClient == resource.data.signatureClient) ||
    
    // Soit le client accepte avec signature (une seule fois)
    (resource.data.clientId == request.auth.uid &&
     resource.data.statut == 'envoye' &&
     request.resource.data.statut == 'accepte' &&
     resource.data.signatureClient == null &&
     request.resource.data.signatureClient != null)
  );
}
```

### Monitoring

**Vérifier régulièrement** :
1. Nombre signatures uploadées (`Firebase Console → Storage → signatures/`)
2. Taille totale dossier signatures (quota 5GB plan gratuit)
3. Bandwidth utilisé (quota 1GB/jour plan gratuit)

**Alertes à configurer** :
- Storage > 80% quota (4GB)
- Bandwidth > 80% quota journalier (800MB)
- Erreurs upload fréquentes

### Backup

**Stratégie** :
- Signatures stockées dans Firebase Storage (redondance automatique)
- Backup hebdomadaire dans Google Cloud Storage (optionnel)
- Export PDF avec signature tous les mois (archives)

### Contact Admin

En cas de problème avec les règles :
- **Email** : admin@artisandispo.fr
- **Firebase Project** : artisandispo-[ID]
- **Documentation** : docs/SIGNATURE_ELECTRONIQUE.md

---

**Créé le** : 2026-02-01  
**Priorité** : 🔴 HAUTE (Avant mise en production)  
**Responsable** : DevOps / Admin Firebase
