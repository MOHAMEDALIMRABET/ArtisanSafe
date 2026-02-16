/**
 * Script de création d'un compte admin dans Firebase
 * Usage: node scripts/create-admin.js
 */

const admin = require('firebase-admin');
const readline = require('readline');

// Interface pour saisie utilisateur
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function createAdminUser() {
  try {
    console.log('🔧 Initialisation Firebase Admin SDK...\n');

    // Initialiser Firebase Admin
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID || 'your-project-id'
      });
    }

    const auth = admin.auth();
    const db = admin.firestore();

    // Demander les informations admin
    const email = await question('📧 Email admin (ex: admin@artisandispo.fr): ');
    const password = await question('🔑 Mot de passe (min 12 caractères): ');
    const nom = await question('👤 Nom (ex: Admin): ');
    const prenom = await question('👤 Prénom (ex: ArtisanDispo): ');
    const telephone = await question('📱 Téléphone (ex: +33600000000): ');

    console.log('\n⏳ Création du compte admin...\n');

    // 1. Créer l'utilisateur dans Firebase Auth
    let userRecord;
    try {
      userRecord = await auth.createUser({
        email: email,
        password: password,
        displayName: `${prenom} ${nom}`,
        emailVerified: true // Admin pré-vérifié
      });
      console.log('✅ Utilisateur créé dans Firebase Auth');
      console.log(`   UID: ${userRecord.uid}`);
    } catch (error) {
      if (error.code === 'auth/email-already-exists') {
        console.log('⚠️  L\'email existe déjà. Récupération de l\'utilisateur...');
        userRecord = await auth.getUserByEmail(email);
        console.log(`   UID existant: ${userRecord.uid}`);
      } else {
        throw error;
      }
    }

    // 2. Créer le document admin dans Firestore
    const adminData = {
      uid: userRecord.uid,
      email: email,
      role: 'admin',
      nom: nom,
      prenom: prenom,
      telephone: telephone,
      dateCreation: admin.firestore.FieldValue.serverTimestamp(), // ← Timestamp serveur!
      statut: 'verifie',
      actif: true,
      preferencesNotifications: {
        email: true,
        push: true,
        sms: false
      },
      permissions: {
        canVerifyArtisans: true,
        canManageUsers: true,
        canViewFinances: true,
        canManageLitige: true,
        isSuperAdmin: true
      }
    };

    await db.collection('users').doc(userRecord.uid).set(adminData);
    console.log('✅ Document admin créé dans Firestore');

    console.log('\n🎉 Compte admin créé avec succès!\n');
    console.log('📋 Informations de connexion:');
    console.log(`   Email: ${email}`);
    console.log(`   UID: ${userRecord.uid}`);
    console.log(`   Rôle: admin`);
    console.log('\n🔐 Vous pouvez maintenant vous connecter sur:');
    console.log('   🔒 http://localhost:3000/access-x7k9m2p4w8n3');
    console.log('\n⚠️  IMPORTANT: Cette URL est confidentielle - Ne la partagez jamais publiquement !\n');

  } catch (error) {
    console.error('❌ Erreur lors de la création du compte admin:', error);
    console.error('\nDétails:', error.message);
  } finally {
    rl.close();
    process.exit(0);
  }
}

// Exécuter le script
createAdminUser();
