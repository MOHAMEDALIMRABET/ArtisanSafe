/**
 * Script de test pour simuler une notification de devis
 * Usage: npx ts-node scripts/test-notification-devis.ts <devisId>
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, Timestamp } from 'firebase/firestore';

// Configuration Firebase (à adapter selon votre .env)
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

async function marquerDevisCommeNouveau(devisId: string) {
  try {
    console.log('🔔 Marquage du devis comme nouveau:', devisId);
    
    const devisRef = doc(db, 'devis', devisId);
    await updateDoc(devisRef, {
      dateDerniereNotification: Timestamp.now(),
      dateModification: Timestamp.now(),
    });
    
    console.log('✅ Devis marqué avec succès !');
    console.log('→ Le badge "NOUVEAU" apparaîtra pendant 48h');
    console.log('→ Rechargez la page /artisan/devis pour voir l\'effet');
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

// Récupérer l'ID du devis depuis les arguments
const devisId = process.argv[2];

if (!devisId) {
  console.error('❌ Usage: npx ts-node scripts/test-notification-devis.ts <devisId>');
  process.exit(1);
}

marquerDevisCommeNouveau(devisId);
