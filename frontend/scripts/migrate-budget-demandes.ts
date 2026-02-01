/**
 * Script de migration : Budget demandes
 * 
 * Ancien format : { min: number, max: number }
 * Nouveau format : budgetIndicatif: number
 * 
 * Stratégie :
 * - Si budget est un objet { min, max } : prendre la valeur max comme budgetIndicatif
 * - Si budget est déjà un number : ne rien changer
 * - Si budget est null/undefined : ne rien changer
 * 
 * Utilisation :
 * cd frontend/scripts
 * npx ts-node --project tsconfig.json migrate-budget-demandes.ts
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Charger .env depuis le dossier backend (contient credentials Firebase Admin)
dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') });

// Initialiser Firebase Admin SDK
if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
  });
}

const db = admin.firestore();

interface OldBudget {
  min?: number;
  max?: number;
}

async function migrateBudgetDemandes() {
  console.log('🚀 Démarrage de la migration des budgets des demandes...\n');

  try {
    // Récupérer toutes les demandes
    const demandesSnapshot = await db.collection('demandes').get();
    console.log(`📊 ${demandesSnapshot.size} demande(s) trouvée(s)\n`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const demandeDoc of demandesSnapshot.docs) {
      const demande = demandeDoc.data();
      const demandeId = demandeDoc.id;

      try {
        // Vérifier le format du budget
        const budget = demande.budget;

        if (!budget) {
          console.log(`⏭️  Demande ${demandeId}: Pas de budget défini`);
          skippedCount++;
          continue;
        }

        // Si budget est déjà un number (nouveau format)
        if (typeof budget === 'number') {
          console.log(`✅ Demande ${demandeId}: Déjà au nouveau format (budgetIndicatif: ${budget}€)`);
          skippedCount++;
          continue;
        }

        // Si budget est un objet (ancien format)
        if (typeof budget === 'object' && (budget.min !== undefined || budget.max !== undefined)) {
          const oldBudget = budget as OldBudget;
          // Prendre la valeur max comme budgetIndicatif (plus pertinent pour les artisans)
          const budgetIndicatif = oldBudget.max || oldBudget.min || 0;

          console.log(`\n👤 Demande: ${demande.titre || demandeId}`);
          console.log(`   📍 Ancien format: { min: ${oldBudget.min || 0}€, max: ${oldBudget.max || 0}€ }`);
          console.log(`   ✅ Nouveau format: budgetIndicatif: ${budgetIndicatif}€`);

          if (budgetIndicatif > 0) {
            // Mise à jour Firestore
            await db.collection('demandes').doc(demandeId).update({
              budgetIndicatif: budgetIndicatif,
              budget: admin.firestore.FieldValue.delete(), // Supprimer ancien champ
            });
            console.log(`   💾 Sauvegardé dans Firestore`);
            migratedCount++;
          } else {
            console.log(`   ⚠️  Budget = 0, suppression du champ`);
            await db.collection('demandes').doc(demandeId).update({
              budget: admin.firestore.FieldValue.delete(),
            });
            skippedCount++;
          }
        } else {
          console.log(`⚠️  Demande ${demandeId}: Format budget inconnu:`, budget);
          skippedCount++;
        }
      } catch (error: any) {
        console.error(`❌ Erreur migration demande ${demandeId}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n✨ Migration terminée !`);
    console.log(`   ✅ ${migratedCount} demande(s) migrée(s)`);
    console.log(`   ⏭️  ${skippedCount} demande(s) ignorée(s)`);
    console.log(`   ❌ ${errorCount} erreur(s)`);

  } catch (error: any) {
    console.error('❌ Erreur fatale:', error.message);
    process.exit(1);
  }
}

// Exécution
migrateBudgetDemandes()
  .then(() => {
    console.log('\n🎉 Migration terminée avec succès !');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erreur lors de la migration:', error);
    process.exit(1);
  });
