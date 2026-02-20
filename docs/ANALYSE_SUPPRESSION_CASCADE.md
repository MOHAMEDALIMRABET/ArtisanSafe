# 🗑️ ANALYSE SUPPRESSION CASCADE - ArtisanSafe

## 📋 État actuel vs Recommandations

### ⚠️ PROBLÈME MAJEUR IDENTIFIÉ

**Actuellement** : Quand l'admin supprime un artisan ou un client via `deleteArtisanAccount()` ou `deleteClientAccount()`, **SEULEMENT 3 actions** sont effectuées :

```typescript
// ❌ INCOMPLET - Code actuel (account-service.ts)
await anonymizeUserReviews(userId);        // 1. Anonymise avis
await deleteDoc(doc(db, 'artisans', UID)); // 2. Supprime profil artisan
await deleteDoc(doc(db, 'users', UID));    // 3. Supprime profil user
```

**➡️ CONSÉQUENCE : Données orphelines dans 15+ collections Firestore !**

---

## 📊 TOUTES LES COLLECTIONS FIRESTORE

Liste complète des collections et leur impact lors d'une suppression :

| Collection | Clé étrangère | Impact Artisan | Impact Client | Statut actuel |
|-----------|---------------|----------------|---------------|---------------|
| **1. users** | `uid` | ✅ Supprimé | ✅ Supprimé | ✅ OK |
| **2. artisans** | `uid` | ✅ Supprimé | - | ✅ OK |
| **3. avis** | `clientId`, `artisanId` | ✅ Anonymisé | ✅ Anonymisé | ✅ OK |
| **4. devis** | `clientId`, `artisanId` | ❌ **ORPHELIN** | ❌ **ORPHELIN** | ⚠️ À CORRIGER |
| **5. demandes** | `clientId` | - | ❌ **ORPHELIN** | ⚠️ À CORRIGER |
| **6. contrats** | `clientId`, `artisanId` | ❌ **ORPHELIN** | ❌ **ORPHELIN** | ⚠️ À CORRIGER |
| **7. conversations** | `participants[]` | ❌ **ORPHELIN** | ❌ **ORPHELIN** | ⚠️ À CORRIGER |
| **8. messages** | `senderId`, `receiverId` | ❌ **ORPHELIN** | ❌ **ORPHELIN** | ⚠️ À CORRIGER |
| **9. notifications** | `recipientId` | ❌ **ORPHELIN** | ❌ **ORPHELIN** | ⚠️ À CORRIGER |
| **10. disponibilites** | `artisanId` | ❌ **ORPHELIN** | - | ⚠️ À CORRIGER |
| **11. rappels** | `userId` | ❌ **ORPHELIN** | ❌ **ORPHELIN** | ⚠️ À CORRIGER |
| **12. admin_access_logs** | `userId` | - | - | ✅ Conserver (audit) |
| **13. email_notifications** | - | - | - | ✅ Conserver (légal) |
| **14. scheduled_deletions** | `userId` | ❌ **ORPHELIN** | ❌ **ORPHELIN** | ⚠️ À CORRIGER |
| **15. deleted_accounts** | - | ✅ Archive créée | ✅ Archive créée | ✅ OK |

**🚨 RÉSULTAT : 10 collections sur 15 ont des données orphelines !**

---

## 🎯 STRATÉGIE DE SUPPRESSION RECOMMANDÉE

### Option 1 : SUPPRESSION COMPLÈTE (Recommandé RGPD)

**Principe** : Supprimer TOUTES les données personnelles, anonymiser le reste.

#### 1️⃣ **Supprimer définitivement**
```typescript
// Collections à supprimer complètement
- users ✅ (déjà fait)
- artisans ✅ (déjà fait)  
- disponibilites ⚠️ (à ajouter)
- notifications ⚠️ (à ajouter)
- rappels ⚠️ (à ajouter - ou anonymiser)
- scheduled_deletions ⚠️ (à ajouter)
```

#### 2️⃣ **Anonymiser obligatoirement**
```typescript
// Collections à anonymiser (obligations légales)
- avis ✅ (déjà fait)
  → auteurNom: "[Compte supprimé]"
  
- devis ⚠️ (à ajouter)
  → Anonymiser nom/email artisan ET client
  → Conserver montants (compta légale 10 ans)
  
- demandes ⚠️ (à ajouter)
  → Anonymiser nom/contact client
  → Conserver description travaux (légal)
  
- contrats ⚠️ (à ajouter)
  → Anonymiser identité
  → Conserver montants/dates (légal 10 ans)
```

#### 3️⃣ **Archiver avec référence orpheline**
```typescript
// Conversations : Soft delete ou anonymisation
- conversations ⚠️ (à ajouter)
  → Option A: Supprimer conversations
  → Option B: Anonymiser participant supprimé
  
- messages ⚠️ (à ajouter)
  → Supprimer si < 90 jours (RGPD)
  → Anonymiser si > 90 jours (litiges)
```

---

## 🛠️ CODE CORRIGÉ - Suppression complète

### Fichier : `frontend/src/lib/firebase/account-service.ts`

```typescript
/**
 * Supprimer TOUTES les données liées à un utilisateur
 * Conforme RGPD + obligations légales françaises
 */
export async function deleteUserCompletely(
  userId: string,
  accountType: 'artisan' | 'client',
  adminId: string,
  adminName: string,
  reason: string
): Promise<{ success: boolean; error?: string; details?: string }> {
  try {
    let deletedCollections: string[] = [];
    let anonymizedCollections: string[] = [];

    // 1. Récupérer infos avant suppression
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      return { success: false, error: 'Utilisateur non trouvé' };
    }

    const userData = userSnap.data();
    const userEmail = userData.email;
    const userName = `${userData.prenom} ${userData.nom}`;

    // 2. ANONYMISER (obligations légales)
    
    // Avis → Anonymiser auteur
    await anonymizeUserReviews(userId);
    anonymizedCollections.push('avis');

    // Devis → Anonymiser parties
    const devisSnapshot = await getDocs(
      query(
        collection(db, 'devis'),
        where(accountType === 'artisan' ? 'artisanId' : 'clientId', '==', userId)
      )
    );
    for (const devisDoc of devisSnapshot.docs) {
      if (accountType === 'artisan') {
        await updateDoc(devisDoc.ref, {
          'artisan.nom': '[Compte supprimé]',
          'artisan.email': null,
          'artisan.telephone': null,
          anonymizedArtisan: true,
          anonymizedAt: Timestamp.now()
        });
      } else {
        await updateDoc(devisDoc.ref, {
          'client.nom': '[Compte supprimé]',
          'client.email': null,
          'client.telephone': null,
          anonymizedClient: true,
          anonymizedAt: Timestamp.now()
        });
      }
    }
    anonymizedCollections.push(`devis (${devisSnapshot.size})`);

    // Demandes → Anonymiser client (si client)
    if (accountType === 'client') {
      const demandesSnapshot = await getDocs(
        query(collection(db, 'demandes'), where('clientId', '==', userId))
      );
      for (const demandeDoc of demandesSnapshot.docs) {
        await updateDoc(demandeDoc.ref, {
          'client.nom': '[Compte supprimé]',
          'client.email': null,
          'client.telephone': null,
          anonymizedClient: true,
          anonymizedAt: Timestamp.now()
        });
      }
      anonymizedCollections.push(`demandes (${demandesSnapshot.size})`);
    }

    // Contrats → Anonymiser parties
    const contratsSnapshot = await getDocs(
      query(
        collection(db, 'contrats'),
        where(accountType === 'artisan' ? 'artisanId' : 'clientId', '==', userId)
      )
    );
    for (const contratDoc of contratsSnapshot.docs) {
      if (accountType === 'artisan') {
        await updateDoc(contratDoc.ref, {
          artisanNom: '[Compte supprimé]',
          artisanEmail: null,
          anonymizedArtisan: true,
          anonymizedAt: Timestamp.now()
        });
      } else {
        await updateDoc(contratDoc.ref, {
          clientNom: '[Compte supprimé]',
          clientEmail: null,
          anonymizedClient: true,
          anonymizedAt: Timestamp.now()
        });
      }
    }
    anonymizedCollections.push(`contrats (${contratsSnapshot.size})`);

    // 3. SUPPRIMER DÉFINITIVEMENT (données non légales)

    // Notifications
    const notificationsSnapshot = await getDocs(
      query(collection(db, 'notifications'), where('recipientId', '==', userId))
    );
    for (const notifDoc of notificationsSnapshot.docs) {
      await deleteDoc(notifDoc.ref);
    }
    deletedCollections.push(`notifications (${notificationsSnapshot.size})`);

    // Rappels
    const rappelsSnapshot = await getDocs(
      query(collection(db, 'rappels'), where('userId', '==', userId))
    );
    for (const rappelDoc of rappelsSnapshot.docs) {
      await deleteDoc(rappelDoc.ref);
    }
    deletedCollections.push(`rappels (${rappelsSnapshot.size})`);

    // Disponibilités (artisan uniquement)
    if (accountType === 'artisan') {
      const disponibilitesSnapshot = await getDocs(
        query(collection(db, 'disponibilites'), where('artisanId', '==', userId))
      );
      for (const dispoDoc of disponibilitesSnapshot.docs) {
        await deleteDoc(dispoDoc.ref);
      }
      deletedCollections.push(`disponibilites (${disponibilitesSnapshot.size})`);
    }

    // Conversations → Soft delete ou anonymisation
    const conversationsSnapshot = await getDocs(
      query(collection(db, 'conversations'), where('participants', 'array-contains', userId))
    );
    for (const convDoc of conversationsSnapshot.docs) {
      // Option 1: Marquer comme participant supprimé
      await updateDoc(convDoc.ref, {
        [`participantNames.${userId}`]: '[Compte supprimé]',
        participantDeleted: true,
        deletedParticipantId: userId,
        deletedAt: Timestamp.now()
      });
    }
    anonymizedCollections.push(`conversations (${conversationsSnapshot.size})`);

    // Messages → Anonymiser expéditeur
    const messagesSnapshot = await getDocs(
      query(collection(db, 'messages'), where('senderId', '==', userId))
    );
    for (const messageDoc of messagesSnapshot.docs) {
      await updateDoc(messageDoc.ref, {
        senderName: '[Compte supprimé]',
        anonymizedSender: true,
        anonymizedAt: Timestamp.now()
      });
    }
    anonymizedCollections.push(`messages (${messagesSnapshot.size})`);

    // Suppression programmée (si existe)
    const scheduledDeletionRef = doc(db, 'scheduled_deletions', userId);
    const scheduledDeletionSnap = await getDoc(scheduledDeletionRef);
    if (scheduledDeletionSnap.exists()) {
      await deleteDoc(scheduledDeletionRef);
      deletedCollections.push('scheduled_deletions (1)');
    }

    // 4. Créer archive anonymisée
    const archiveRef = doc(collection(db, 'deleted_accounts'), userId);
    const archiveData: any = {
      type: accountType,
      deletedAt: Timestamp.now(),
      deletedBy: adminId,
      deletedByName: adminName,
      reason,
      deletedCollections,
      anonymizedCollections
    };

    // Statistiques anonymisées uniquement
    if (accountType === 'artisan' && userSnap.exists()) {
      const artisanSnap = await getDoc(doc(db, 'artisans', userId));
      if (artisanSnap.exists()) {
        const artisanData = artisanSnap.data();
        if (artisanData.siret) archiveData.siret = artisanData.siret;
        if (artisanData.metiers) archiveData.metiers = artisanData.metiers;
        if (artisanData.dateInscription) archiveData.dateInscription = artisanData.dateInscription;
      }
    }
    if (userData.dateInscription) archiveData.dateInscription = userData.dateInscription;

    await setDoc(archiveRef, archiveData);

    // 5. Supprimer profils principaux
    if (accountType === 'artisan') {
      await deleteDoc(doc(db, 'artisans', userId));
      deletedCollections.push('artisans');
    }
    await deleteDoc(doc(db, 'users', userId));
    deletedCollections.push('users');

    // 6. Envoyer email confirmation
    await sendDeletionConfirmationEmail(userEmail, userName, reason);

    // 7. Supprimer Firebase Auth
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
      const response = await fetch(`${apiUrl}/auth/users/${userId}`, { method: 'DELETE' });
      if (response.ok) {
        console.log(`✅ Compte Firebase Auth supprimé pour ${userId}`);
      }
    } catch (authError) {
      console.error('Erreur suppression Firebase Auth:', authError);
    }

    const details = `
Collections supprimées: ${deletedCollections.join(', ')}
Collections anonymisées: ${anonymizedCollections.join(', ')}
    `.trim();

    console.log(`✅ Compte ${accountType} ${userId} supprimé définitivement`);
    console.log(details);

    return { success: true, details };
  } catch (error) {
    console.error('Erreur suppression complète:', error);
    return { success: false, error: 'Erreur lors de la suppression complète' };
  }
}

/**
 * Helper: Anonymiser les avis d'un utilisateur
 */
async function anonymizeUserReviews(userId: string): Promise<void> {
  try {
    const avisRef = collection(db, 'avis');
    
    // Avis écrits PAR l'utilisateur
    const q1 = query(avisRef, where('clientId', '==', userId));
    const snapshot1 = await getDocs(q1);

    for (const avisDoc of snapshot1.docs) {
      await updateDoc(avisDoc.ref, {
        clientNom: '[Compte supprimé]',
        clientEmail: null,
        clientId: null,
        anonymizedClient: true,
        anonymizedAt: Timestamp.now()
      });
    }

    // Avis reçus PAR l'artisan (si artisan)
    const q2 = query(avisRef, where('artisanId', '==', userId));
    const snapshot2 = await getDocs(q2);

    for (const avisDoc of snapshot2.docs) {
      await updateDoc(avisDoc.ref, {
        artisanNom: '[Compte supprimé]',
        artisanEmail: null,
        // ⚠️ NE PAS supprimer artisanId (pour statistiques)
        anonymizedArtisan: true,
        anonymizedAt: Timestamp.now()
      });
    }

    console.log(`✅ ${snapshot1.size + snapshot2.size} avis anonymisés pour userId ${userId}`);
  } catch (error) {
    console.error('Erreur anonymisation avis:', error);
    throw error;
  }
}
```

---

## 📋 CHECKLIST AVANT SUPPRESSION

### Pré-vérifications Admin

Avant de supprimer un compte, l'admin DOIT vérifier :

```typescript
// Service: pre-deletion-check.ts
export async function getPreDeletionReport(userId: string, accountType: 'artisan' | 'client') {
  const report = {
    devis: 0,
    devisEnCours: 0,
    contrats: 0,
    contratsActifs: 0,
    avis: 0,
    conversations: 0,
    montantTotal: 0,
    warnings: []
  };

  // Compter devis
  const devisSnapshot = await getDocs(
    query(collection(db, 'devis'), where(accountType === 'artisan' ? 'artisanId' : 'clientId', '==', userId))
  );
  report.devis = devisSnapshot.size;
  report.devisEnCours = devisSnapshot.docs.filter(d => 
    ['envoye', 'accepte'].includes(d.data().statut)
  ).length;

  // Compter contrats actifs
  const contratsSnapshot = await getDocs(
    query(collection(db, 'contrats'), where(accountType === 'artisan' ? 'artisanId' : 'clientId', '==', userId))
  );
  report.contrats = contratsSnapshot.size;
  report.contratsActifs = contratsSnapshot.docs.filter(c => 
    c.data().statut === 'en_cours'
  ).length;

  // Calculer montant total
  report.montantTotal = contratsSnapshot.docs.reduce((sum, c) => sum + (c.data().montantTTC || 0), 0);

  // Warnings
  if (report.contratsActifs > 0) {
    report.warnings.push(`⚠️ ${report.contratsActifs} contrat(s) en cours !`);
  }
  if (report.devisEnCours > 0) {
    report.warnings.push(`⚠️ ${report.devisEnCours} devis en attente !`);
  }
  if (report.montantTotal > 1000) {
    report.warnings.push(`⚠️ Montant total contrats : ${report.montantTotal}€`);
  }

  return report;
}
```

---

## 🎯 RECOMMANDATIONS PRIORITAIRES

### 🔴 URGENT (À implémenter immédiatement)

1. **Remplacer `deleteArtisanAccount()` et `deleteClientAccount()`** par `deleteUserCompletely()`
2. **Ajouter rapport pré-suppression** dans l'UI admin
3. **Tester suppression** sur environnement de test avec données réelles

### 🟠 IMPORTANT (Semaine prochaine)

4. **Cloud Function automatique** pour nettoyer données expirées
5. **Audit trail** : Logger toutes suppressions dans `admin_action_logs`
6. **Interface admin** : Afficher impact avant confirmation

### 🟡 RECOMMANDÉ (Mois prochain)

7. **Soft delete** : Option "Suspendre définitivement" avant suppression réelle
8. **Export RGPD** : Permettre à l'utilisateur d'exporter ses données avant suppression
9. **Tests automatisés** : Tests E2E vérifiant cohérence après suppression

---

## 📄 OBLIGATIONS LÉGALES (France)

### Données à CONSERVER (OBLIGATOIRE)

```typescript
// ✅ À conserver 10 ans (Loi française)
- Contrats (montants, dates, prestations) → ANONYMISÉS
- Transactions financières → ANONYMISÉS
- Factures générées → ANONYMISÉS
- SIRET (archive statistique fraude)

// ✅ À anonymiser (pas supprimer)
- Avis clients (liberté d'expression)
- Historique interventions (garantie légale)
```

### Données à SUPPRIMER (RGPD)

```typescript
// ❌ À supprimer définitivement
- Email, nom, prénom, téléphone
- Adresse complète
- Documents identité (KBIS, CNI)
- Photos profil/portfolio
- Messages privés < 90 jours
- Disponibilités agenda
- Notifications
```

---

## 🔄 WORKFLOW SUPPRESSION RECOMMANDÉ

```
1. Admin sélectionne compte → "Supprimer"
2. Système affiche RAPPORT PRÉ-SUPPRESSION
   ├─ Nombre devis/contrats
   ├─ Montant total engagé
   └─ Warnings si contrats actifs
3. Admin confirme → Saisit RAISON
4. Système exécute deleteUserCompletely()
   ├─ Anonymise avis, devis, contrats
   ├─ Supprime notifications, rappels
   ├─ Crée archive deleted_accounts
   └─ Supprime users + artisans + Firebase Auth
5. Email confirmation envoyé à utilisateur
6. Log admin_action_logs créé
```

---

## ✅ ACTIONS IMMÉDIATES

### 1. Modifier `account-service.ts`

Remplacer les fonctions actuelles par `deleteUserCompletely()` (code ci-dessus).

### 2. Ajouter UI rapport pré-suppression

```tsx
// Page admin: /admin/comptes/[userId]/delete
export function DeleteAccountPage({ userId, accountType }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, [userId]);

  const loadReport = async () => {
    const data = await getPreDeletionReport(userId, accountType);
    setReport(data);
    setLoading(false);
  };

  return (
    <div>
      <h1>Supprimer le compte {accountType}</h1>
      
      {report && (
        <div className="bg-yellow-50 p-6 rounded-lg mb-4">
          <h2 className="font-bold text-xl mb-4">⚠️ Impact de la suppression</h2>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-gray-600">Devis</p>
              <p className="text-2xl font-bold">{report.devis}</p>
              {report.devisEnCours > 0 && (
                <p className="text-orange-600 text-sm">dont {report.devisEnCours} en cours</p>
              )}
            </div>
            
            <div>
              <p className="text-gray-600">Contrats</p>
              <p className="text-2xl font-bold">{report.contrats}</p>
              {report.contratsActifs > 0 && (
                <p className="text-red-600 text-sm">dont {report.contratsActifs} actifs</p>
              )}
            </div>
          </div>

          {report.warnings.length > 0 && (
            <div className="bg-red-100 border border-red-400 p-4 rounded mb-4">
              <p className="font-bold text-red-800 mb-2">Avertissements :</p>
              {report.warnings.map((w, i) => (
                <p key={i} className="text-red-700">{w}</p>
              ))}
            </div>
          )}

          <div className="bg-blue-50 border border-blue-400 p-4 rounded">
            <p className="font-bold text-blue-800 mb-2">Données conservées (RGPD + Loi française) :</p>
            <ul className="text-blue-700 text-sm space-y-1">
              <li>✅ Avis → Anonymisés ([Compte supprimé])</li>
              <li>✅ Contrats → Anonymisés (montants conservés 10 ans)</li>
              <li>✅ Devis → Anonymisés (légal)</li>
              <li>❌ Données personnelles → Supprimées définitivement</li>
            </ul>
          </div>
        </div>
      )}

      <button 
        onClick={() => handleDelete()}
        className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg"
      >
        Confirmer la suppression
      </button>
    </div>
  );
}
```

### 3. Créer script de migration

Pour nettoyer les données orphelines existantes :

```bash
cd backend/scripts
node cleanup-orphaned-data.js
```

---

## 📊 RÉSUMÉ EXÉCUTIF

| Aspect | État actuel | État recommandé | Priorité |
|--------|-------------|-----------------|----------|
| Collections supprimées | 3/15 (20%) | 15/15 (100%) | 🔴 URGENT |
| Anonymisation | Avis uniquement | Avis + Devis + Contrats + Messages | 🔴 URGENT |
| Rapport pré-suppression | ❌ Aucun | ✅ Complet | 🟠 Important |
| Conformité RGPD | ⚠️ Partielle | ✅ Complète | 🔴 URGENT |
| Conformité loi française | ⚠️ Partielle | ✅ Complète | 🔴 URGENT |
| Données orphelines | ✅ 10 collections | ❌ 0 collection | 🔴 URGENT |

**Temps estimé implémentation** : 4-6 heures  
**Impact** : Protection juridique + Conformité RGPD complète
