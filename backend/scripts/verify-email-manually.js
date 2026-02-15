/**
 * Script pour vérifier manuellement l'email d'un utilisateur
 * Usage: node verify-email-manually.js <EMAIL>
 * Exemple: node verify-email-manually.js artisandali@gmail.com
 */

const admin = require('firebase-admin');
const path = require('path');

// Charger les credentials Firebase Admin depuis .env
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Initialiser Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const auth = admin.auth();
const db = admin.firestore();

async function verifyEmailManually(email) {
  try {
    console.log(`\n🔍 Recherche de l'utilisateur: ${email}...\n`);

    // 1. Trouver l'utilisateur par email
    const userRecord = await auth.getUserByEmail(email);
    console.log(`✅ Utilisateur trouvé:`);
    console.log(`   UID: ${userRecord.uid}`);
    console.log(`   Email: ${userRecord.email}`);
    console.log(`   Email verified (avant): ${userRecord.emailVerified}\n`);

    if (userRecord.emailVerified) {
      console.log('⚠️  Email déjà vérifié !\n');
      return;
    }

    // 2. Mettre à jour Firebase Authentication
    console.log('🔧 Mise à jour Firebase Authentication...');
    await auth.updateUser(userRecord.uid, {
      emailVerified: true,
    });
    console.log('✅ Firebase Auth mis à jour: emailVerified = true\n');

    // 3. Mettre à jour Firestore (collection users)
    console.log('🔧 Mise à jour Firestore (users)...');
    await db.collection('users').doc(userRecord.uid).update({
      emailVerified: true,
      emailVerifiedDate: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('✅ Firestore mis à jour: emailVerified = true\n');

    // 4. Vérification finale
    const updatedUser = await auth.getUser(userRecord.uid);
    console.log('🎉 Vérification finale:');
    console.log(`   Email verified (après): ${updatedUser.emailVerified}`);
    console.log(`\n✨ Email vérifié avec succès pour ${email} !\n`);
    console.log('👉 Rafraîchissez votre application (F5) ou reconnectez-vous.\n');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    
    if (error.code === 'auth/user-not-found') {
      console.error(`\n⚠️  Aucun utilisateur trouvé avec l'email: ${email}`);
      console.error('   Vérifiez que l\'adresse email est correcte.\n');
    }
    
    process.exit(1);
  }
}

// Récupérer l'email depuis les arguments
const email = process.argv[2];

if (!email) {
  console.log('\n❌ Usage: node verify-email-manually.js <EMAIL>\n');
  console.log('Exemple:');
  console.log('  node verify-email-manually.js artisandali@gmail.com\n');
  process.exit(1);
}

// Exécuter
verifyEmailManually(email)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Erreur fatale:', error);
    process.exit(1);
  });
