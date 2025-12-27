/**
 * Script de migration pour normaliser les métiers dans Firestore
 * Convertit les anciennes valeurs avec accents/majuscules vers les valeurs techniques
 * Utilise Firebase Admin SDK pour bypasser les règles de sécurité
 */

// Charger les variables d'environnement
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import admin from 'firebase-admin';

// Initialiser Firebase Admin SDK
if (!admin.apps.length) {
  const serviceAccount = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

const db = admin.firestore();

// Mapping ancien → nouveau
const METIERS_MIGRATION: Record<string, string> = {
  'Plomberie': 'plomberie',
  'plomberie': 'plomberie',
  'Électricité': 'electricite',
  'électricité': 'electricite',
  'Electricité': 'electricite',
  'electricité': 'electricite',
  'electricite': 'electricite',
  'Menuiserie': 'menuiserie',
  'menuiserie': 'menuiserie',
  'Maçonnerie': 'maconnerie',
  'maçonnerie': 'maconnerie',
  'Maconnerie': 'maconnerie',
  'maconnerie': 'maconnerie',
  'Peinture': 'peinture',
  'peinture': 'peinture',
  'Carrelage': 'carrelage',
  'carrelage': 'carrelage',
  'Toiture': 'toiture',
  'toiture': 'toiture',
  'Chauffage': 'chauffage',
  'chauffage': 'chauffage',
  'Climatisation': 'climatisation',
  'climatisation': 'climatisation',
  'Placo': 'placo',
  'placo': 'placo',
  'Isolation': 'isolation',
  'isolation': 'isolation',
  'Serrurerie': 'serrurerie',
  'serrurerie': 'serrurerie',
  'Autre': 'autre',
  'autre': 'autre'
};

async function migrateMetiers() {
  console.log('🚀 Démarrage de la migration des métiers...\n');

  try {
    // Récupérer tous les artisans
    const artisansRef = db.collection('artisans');
    const snapshot = await artisansRef.get();

    console.log(`📊 ${snapshot.size} artisan(s) trouvé(s)\n`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const artisanId = docSnap.id;
      const metiers = data.metiers;

      console.log(`\n👤 Artisan: ${data.raisonSociale || artisanId}`);
      console.log(`   Métiers actuels:`, metiers);

      // Vérifier si metiers existe et est un tableau ou objet
      if (!metiers) {
        console.log('   ⚠️  Pas de métiers définis - ignoré');
        skippedCount++;
        continue;
      }

      // Convertir l'objet en tableau si nécessaire
      let metiersArray: string[];
      if (Array.isArray(metiers)) {
        metiersArray = metiers;
      } else if (typeof metiers === 'object') {
        metiersArray = Object.values(metiers);
        console.log('   🔄 Conversion objet → tableau:', metiersArray);
      } else {
        console.log('   ⚠️  Format métiers invalide - ignoré');
        skippedCount++;
        continue;
      }

      // Normaliser les métiers
      const normalizedMetiers = metiersArray
        .map(m => METIERS_MIGRATION[m] || m.toLowerCase())
        .filter((m, i, arr) => arr.indexOf(m) === i); // Dédupliquer

      // Vérifier si une migration est nécessaire
      const needsMigration = JSON.stringify(metiers) !== JSON.stringify(normalizedMetiers);

      if (needsMigration) {
        console.log('   ✅ Migration nécessaire');
        console.log('   Avant:', metiersArray);
        console.log('   Après:', normalizedMetiers);

        // Mettre à jour Firestore avec Admin SDK (bypass security rules)
        await artisansRef.doc(artisanId).update({
          metiers: normalizedMetiers
        });

        console.log('   💾 Sauvegardé dans Firestore');
        migratedCount++;
      } else {
        console.log('   ⏭️  Déjà normalisé - ignoré');
        skippedCount++;
      }
    }

    console.log('\n\n✨ Migration terminée !');
    console.log(`   ✅ ${migratedCount} artisan(s) migré(s)`);
    console.log(`   ⏭️  ${skippedCount} artisan(s) ignoré(s)`);

  } catch (error) {
    console.error('❌ Erreur pendant la migration:', error);
    process.exit(1);
  }
}

// Exécuter la migration
migrateMetiers()
  .then(() => {
    console.log('\n🎉 Migration réussie !');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Échec de la migration:', error);
    process.exit(1);
  });
