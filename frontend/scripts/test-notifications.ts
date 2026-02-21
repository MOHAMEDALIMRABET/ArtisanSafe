/**
 * Script de test pour vérifier les notifications Firestore
 * Usage: npx ts-node scripts/test-notifications.ts
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

// Config Firebase (même que frontend)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testNotifications() {
  console.log('🔍 Recherche des notifications récentes...\n');

  try {
    // Récupérer les 10 dernières notifications
    const q = query(
      collection(db, 'notifications'),
      orderBy('dateCreation', 'desc'),
      limit(10)
    );

    const snapshot = await getDocs(q);
    
    console.log(`📊 Total notifications trouvées : ${snapshot.size}\n`);

    if (snapshot.empty) {
      console.log('❌ Aucune notification trouvée dans Firestore');
      return;
    }

    snapshot.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\n--- Notification ${index + 1} ---`);
      console.log(`ID: ${doc.id}`);
      console.log(`Type: ${data.type}`);
      console.log(`Pour userId: ${data.userId}`);
      console.log(`Titre: ${data.titre}`);
      console.log(`Message: ${data.message?.substring(0, 80)}...`);
      console.log(`Lue: ${data.lue ? '✅' : '❌'}`);
      console.log(`Créée le: ${data.dateCreation?.toDate().toLocaleString('fr-FR')}`);
      console.log(`Lien: ${data.lien || 'N/A'}`);
    });

    // Filtrer les notifications admin_surveillance
    const adminSurveillance = snapshot.docs.filter(doc => doc.data().type === 'admin_surveillance');
    console.log(`\n\n🚨 Notifications "admin_surveillance": ${adminSurveillance.length}`);
    
    if (adminSurveillance.length > 0) {
      console.log('\nDétails admin_surveillance:');
      adminSurveillance.forEach((doc, index) => {
        const data = doc.data();
        console.log(`\n${index + 1}. userId: ${data.userId} | Lue: ${data.lue} | Créée: ${data.dateCreation?.toDate().toLocaleString('fr-FR')}`);
      });
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

// Fonction pour tester les notifications d'un utilisateur spécifique
async function testUserNotifications(userId: string) {
  console.log(`\n🔍 Recherche notifications pour userId: ${userId}\n`);

  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('dateCreation', 'desc'),
      limit(20)
    );

    const snapshot = await getDocs(q);
    
    console.log(`📊 Total notifications pour cet utilisateur : ${snapshot.size}\n`);

    if (snapshot.empty) {
      console.log('❌ Aucune notification pour cet utilisateur');
      return;
    }

    snapshot.forEach((doc, index) => {
      const data = doc.data();
      console.log(`${index + 1}. [${data.type}] ${data.titre} | Lue: ${data.lue ? '✅' : '❌'} | ${data.dateCreation?.toDate().toLocaleString('fr-FR')}`);
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

// Exécution
const args = process.argv.slice(2);
if (args.length > 0 && args[0]) {
  // Test pour un utilisateur spécifique
  testUserNotifications(args[0]);
} else {
  // Test général
  testNotifications();
}
