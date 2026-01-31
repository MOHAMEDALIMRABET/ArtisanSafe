/**
 * Script de vérification des devis - Système de variantes
 * Vérifie si les devis ont les bons numéros et métadonnées de variantes
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, orderBy } from 'firebase/firestore';

// Configuration Firebase (identique à config.ts)
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

async function verifierDevis() {
  console.log('🔍 Vérification des devis dans Firestore...\n');

  try {
    // Récupérer tous les devis DV-2026-00004
    const q = query(
      collection(db, 'devis'),
      where('numeroDevis', '>=', 'DV-2026-00004'),
      where('numeroDevis', '<=', 'DV-2026-00004\uf8ff')
    );

    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('❌ Aucun devis trouvé avec le numéro DV-2026-00004');
      return;
    }

    console.log(`📊 ${snapshot.size} devis trouvé(s) :\n`);

    snapshot.docs.forEach((doc, index) => {
      const devis = doc.data();
      console.log(`Devis ${index + 1} :`);
      console.log(`  ID Firestore: ${doc.id}`);
      console.log(`  Numéro: ${devis.numeroDevis}`);
      console.log(`  Titre: ${devis.titre}`);
      console.log(`  Statut: ${devis.statut}`);
      console.log(`  Variante groupe: ${devis.varianteGroupe || 'NON DÉFINI'}`);
      console.log(`  Variante lettre: ${devis.varianteLettreReference || 'NON DÉFINI'}`);
      console.log(`  Client: ${devis.client?.nom || 'N/A'}`);
      console.log(`  Demande ID: ${devis.demandeId || 'N/A'}`);
      console.log(`  Date création: ${devis.createdAt?.toDate?.()?.toLocaleString('fr-FR') || 'N/A'}`);
      console.log(`  Total TTC: ${devis.totaux?.totalTTC || 0} €`);
      console.log('');
    });

    // Analyser les problèmes
    const devisSansVariante = snapshot.docs.filter(doc => !doc.data().varianteGroupe);
    const devisAvecVariante = snapshot.docs.filter(doc => doc.data().varianteGroupe);

    console.log('\n📈 Analyse :');
    console.log(`  - Devis SANS variante (devrait être 0 si 2+ devis) : ${devisSansVariante.length}`);
    console.log(`  - Devis AVEC variante : ${devisAvecVariante.length}`);

    if (snapshot.size >= 2 && devisSansVariante.length > 0) {
      console.log('\n⚠️  PROBLÈME DÉTECTÉ :');
      console.log('  Il y a plusieurs devis mais certains n\'ont pas de variante.');
      console.log('  Le système de transformation progressive n\'a pas fonctionné.');
      console.log('\n💡 Solution :');
      console.log('  1. Supprimez les devis DV-2026-00004 dans Firestore');
      console.log('  2. Rechargez le frontend (Ctrl+Shift+R)');
      console.log('  3. Recréez les devis');
    } else if (snapshot.size >= 2) {
      console.log('\n✅ Système de variantes fonctionne correctement !');
      
      // Vérifier que les numéros sont cohérents
      const numerosUniques = new Set(snapshot.docs.map(doc => {
        const numero = doc.data().numeroDevis;
        return numero.split('-').slice(0, 3).join('-'); // Extraire base
      }));

      if (numerosUniques.size > 1) {
        console.log('\n⚠️  ATTENTION : Plusieurs numéros de base détectés :');
        numerosUniques.forEach(num => console.log(`  - ${num}`));
        console.log('  Les variantes devraient partager le même numéro de base !');
      }
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

// Exécution
verifierDevis()
  .then(() => {
    console.log('\n✅ Vérification terminée');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
