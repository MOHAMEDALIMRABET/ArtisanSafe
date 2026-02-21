/**
 * Script de détection des comptes en doublon
 * Identifie les utilisateurs ayant plusieurs comptes Firebase Auth avec le même email
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialiser Firebase Admin SDK
const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
let serviceAccount;

try {
  serviceAccount = require(serviceAccountPath);
} catch (error) {
  console.error('❌ Erreur : serviceAccountKey.json non trouvé');
  console.error('   Placez le fichier dans la racine du projet');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
  });
}

const db = admin.firestore();
const auth = admin.auth();

/**
 * Détecter les comptes en doublon
 */
async function detectDuplicates() {
  console.log('🔍 Recherche des comptes en doublon...\n');

  try {
    // Récupérer tous les utilisateurs Firebase Auth
    const listUsersResult = await auth.listUsers();
    console.log(`📊 Total utilisateurs Firebase Auth : ${listUsersResult.users.length}\n`);

    // Grouper par email
    const emailMap = new Map();
    
    listUsersResult.users.forEach(user => {
      const email = user.email?.toLowerCase();
      if (!email) return;
      
      if (!emailMap.has(email)) {
        emailMap.set(email, []);
      }
      
      emailMap.get(email).push({
        uid: user.uid,
        email: user.email,
        providers: user.providerData.map(p => p.providerId),
        createdAt: user.metadata.creationTime,
        lastSignIn: user.metadata.lastSignInTime,
        emailVerified: user.emailVerified,
      });
    });

    // Identifier les doublons
    const duplicates = Array.from(emailMap.entries())
      .filter(([_, users]) => users.length > 1);

    // Afficher le rapport
    console.log('═══════════════════════════════════════════');
    console.log('📋 RAPPORT DE DOUBLONS');
    console.log('═══════════════════════════════════════════\n');
    
    console.log(`Total emails uniques : ${emailMap.size}`);
    console.log(`Emails avec doublons : ${duplicates.length}`);
    
    if (duplicates.length === 0) {
      console.log('\n✅ Aucun doublon détecté !\n');
      return;
    }

    console.log(`\n⚠️  ${duplicates.length} email(s) avec plusieurs comptes détectés\n`);

    // Détails des doublons
    for (const [email, users] of duplicates) {
      console.log('───────────────────────────────────────────');
      console.log(`📧 Email : ${email}`);
      console.log(`   Nombre de comptes : ${users.length}\n`);

      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        console.log(`   Compte #${i + 1} :`);
        console.log(`   ├─ UID : ${user.uid}`);
        console.log(`   ├─ Providers : ${user.providers.join(', ')}`);
        console.log(`   ├─ Email vérifié : ${user.emailVerified ? 'Oui' : 'Non'}`);
        console.log(`   ├─ Créé : ${user.createdAt}`);
        console.log(`   └─ Dernière connexion : ${user.lastSignIn || 'Jamais'}\n`);

        // Vérifier si un document Firestore existe
        try {
          const userDoc = await db.collection('users').doc(user.uid).get();
          if (userDoc.exists()) {
            const userData = userDoc.data();
            console.log(`   📄 Document Firestore : OUI`);
            console.log(`   └─ Rôle : ${userData.role}`);
          } else {
            console.log(`   📄 Document Firestore : NON (compte orphelin)`);
          }
        } catch (error) {
          console.log(`   📄 Document Firestore : ERREUR`);
        }
        console.log('');
      }
    }

    console.log('═══════════════════════════════════════════');
    console.log('📊 STATISTIQUES');
    console.log('═══════════════════════════════════════════\n');

    // Statistiques par type de conflit
    let passwordGoogleConflicts = 0;
    let googleGoogleConflicts = 0;
    let otherConflicts = 0;

    for (const [_, users] of duplicates) {
      const hasPassword = users.some(u => u.providers.includes('password'));
      const hasGoogle = users.some(u => u.providers.includes('google.com'));
      
      if (hasPassword && hasGoogle) {
        passwordGoogleConflicts++;
      } else if (users.every(u => u.providers.includes('google.com'))) {
        googleGoogleConflicts++;
      } else {
        otherConflicts++;
      }
    }

    console.log(`Conflits password ↔ Google : ${passwordGoogleConflicts}`);
    console.log(`Conflits Google ↔ Google : ${googleGoogleConflicts}`);
    console.log(`Autres conflits : ${otherConflicts}\n`);

    // Recommandations
    console.log('═══════════════════════════════════════════');
    console.log('💡 RECOMMANDATIONS');
    console.log('═══════════════════════════════════════════\n');

    if (duplicates.length > 0) {
      console.log('⚠️  Action requise :');
      console.log('   1. Contacter les utilisateurs concernés');
      console.log('   2. Identifier le compte principal (celui avec données Firestore)');
      console.log('   3. Migrer les données si nécessaire');
      console.log('   4. Supprimer les comptes orphelins\n');
      
      console.log('📝 Scripts disponibles :');
      console.log('   - scripts/merge-duplicate-accounts.js (TODO)');
      console.log('   - backend/scripts/delete-user-data.js (suppression)\n');
    }

    console.log('✅ Détection terminée\n');

  } catch (error) {
    console.error('❌ Erreur lors de la détection :', error);
    process.exit(1);
  }
}

// Exécution
detectDuplicates()
  .then(() => {
    console.log('👋 Script terminé');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Erreur fatale :', error);
    process.exit(1);
  });
