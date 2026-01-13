/**
 * Script pour vérifier les notifications dans Firestore
 * Usage: node scripts/verifier-notifications.js <userId>
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialiser Firebase Admin
const serviceAccount = require('../MY_CREDENTIALS.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function verifierNotifications(userId) {
  try {
    console.log('🔍 Vérification des notifications pour userId:', userId);
    console.log('─'.repeat(60));

    const notificationsRef = db.collection('notifications');
    const q = notificationsRef
      .where('userId', '==', userId)
      .orderBy('dateCreation', 'desc')
      .limit(20);

    const snapshot = await q.get();

    if (snapshot.empty) {
      console.log('❌ Aucune notification trouvée pour cet utilisateur');
      return;
    }

    console.log(`✅ ${snapshot.size} notification(s) trouvée(s)\n`);

    snapshot.forEach((doc, index) => {
      const data = doc.data();
      const dateCreation = data.dateCreation ? data.dateCreation.toDate() : null;
      
      console.log(`📬 Notification ${index + 1}:`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Type: ${data.type}`);
      console.log(`   Titre: ${data.titre}`);
      console.log(`   Message: ${data.message}`);
      console.log(`   Lue: ${data.lue ? '✅' : '❌'}`);
      console.log(`   Date: ${dateCreation ? dateCreation.toLocaleString('fr-FR') : 'N/A'}`);
      console.log(`   Lien: ${data.lien || 'N/A'}`);
      console.log('─'.repeat(60));
    });

    // Compter par type
    const notifParType = {};
    snapshot.forEach(doc => {
      const type = doc.data().type;
      notifParType[type] = (notifParType[type] || 0) + 1;
    });

    console.log('\n📊 Statistiques:');
    Object.entries(notifParType).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

// Récupérer userId depuis les arguments
const userId = process.argv[2];

if (!userId) {
  console.error('❌ Usage: node scripts/verifier-notifications.js <userId>');
  console.log('\n💡 Exemple: node scripts/verifier-notifications.js abc123xyz');
  process.exit(1);
}

verifierNotifications(userId).then(() => {
  console.log('\n✅ Vérification terminée');
  process.exit(0);
});
