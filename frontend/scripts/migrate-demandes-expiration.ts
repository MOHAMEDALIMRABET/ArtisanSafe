/**
 * Script de migration : Ajouter dateExpiration aux demandes existantes
 * 
 * Contexte :
 * - Nouvelle fonctionnalité : Expiration automatique des demandes
 * - Nouvelle fonction createDemande calcule automatiquement dateExpiration
 * - PROBLÈME : Demandes existantes n'ont pas ce champ
 * 
 * Solution :
 * - Pour chaque demande sans dateExpiration
 * - Calculer : dateDebut + flexibiliteDays (fin de journée 23:59:59)
 * - Sauvegarder dans Firestore
 * 
 * Exécution :
 * cd frontend/scripts
 * npx ts-node --project tsconfig.json migrate-demandes-expiration.ts
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config({ path: path.join(__dirname, '../../backend/.env') });

interface Demande {
  id: string;
  statut: string;
  datesSouhaitees?: {
    dateDebut?: string;
    flexibiliteDays?: number;
    dates?: admin.firestore.Timestamp[];
  };
  dateExpiration?: admin.firestore.Timestamp;
  titre: string;
}

/**
 * Initialiser Firebase Admin SDK
 */
function initializeFirebase() {
  if (admin.apps.length === 0) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    
    if (!privateKey || !process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL) {
      throw new Error('❌ Variables d\'environnement Firebase manquantes');
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });

    console.log('✅ Firebase Admin SDK initialisé');
  }
  
  return admin.firestore();
}

/**
 * Calculer dateExpiration depuis datesSouhaitees
 */
function calculateExpiration(demande: Demande): admin.firestore.Timestamp | null {
  // Récupérer la première date souhaitée
  const dateClient = demande.datesSouhaitees?.dates?.[0];
  if (!dateClient) {
    console.log(`   ⚠️  Pas de date souhaitée trouvée`);
    return null;
  }

  // Récupérer flexibilité (0 par défaut)
  const flexDays = demande.datesSouhaitees?.flexibiliteDays || 0;

  // Calculer date d'expiration
  const dateExp = new Date(dateClient.toDate());
  dateExp.setDate(dateExp.getDate() + flexDays);
  dateExp.setHours(23, 59, 59, 999); // Fin de journée

  return admin.firestore.Timestamp.fromDate(dateExp);
}

/**
 * Vérifier si demande doit être marquée comme expirée
 */
function shouldBeExpired(dateExpiration: admin.firestore.Timestamp): boolean {
  return dateExpiration.toMillis() < Date.now();
}

/**
 * Migration principale
 */
async function migrateDemandes() {
  console.log('🚀 Démarrage migration dateExpiration demandes...\n');
  
  const db = initializeFirebase();
  
  try {
    // 1. Récupérer toutes les demandes
    const snapshot = await db.collection('demandes').get();
    console.log(`📊 ${snapshot.size} demande(s) trouvée(s)\n`);
    
    if (snapshot.empty) {
      console.log('✅ Aucune demande à migrer');
      return;
    }
    
    let migratedCount = 0;
    let skippedCount = 0;
    let expiredCount = 0;
    let errorCount = 0;
    
    // 2. Pour chaque demande
    for (const docSnap of snapshot.docs) {
      const demande = { id: docSnap.id, ...docSnap.data() } as Demande;
      
      console.log(`\n📋 Demande: ${demande.titre || demande.id}`);
      console.log(`   Statut: ${demande.statut}`);
      
      // 3. Skip si dateExpiration existe déjà
      if (demande.dateExpiration) {
        console.log(`   ⏭️  Déjà migrée (dateExpiration existe)`);
        skippedCount++;
        continue;
      }
      
      // 4. Skip si annulée ou terminée
      if (demande.statut === 'annulee' || demande.statut === 'terminee' || demande.statut === 'expiree') {
        console.log(`   ⏭️  Ignorée (statut: ${demande.statut})`);
        skippedCount++;
        continue;
      }
      
      // 5. Calculer dateExpiration
      const dateExpiration = calculateExpiration(demande);
      
      if (!dateExpiration) {
        console.log(`   ❌ Impossible de calculer dateExpiration (pas de dates)`);
        errorCount++;
        continue;
      }
      
      // 6. Vérifier si déjà expirée
      const isExpired = shouldBeExpired(dateExpiration);
      const newStatut = isExpired ? 'expiree' : demande.statut;
      
      console.log(`   📅 Date expiration: ${dateExpiration.toDate().toLocaleDateString('fr-FR')} ${dateExpiration.toDate().toLocaleTimeString('fr-FR')}`);
      console.log(`   ${isExpired ? '⏰ EXPIRÉE' : '✅ Encore valide'}`);
      
      // 7. Mettre à jour Firestore
      try {
        const updateData: any = {
          dateExpiration,
          dateModification: admin.firestore.FieldValue.serverTimestamp()
        };
        
        // Changer statut si expirée
        if (isExpired) {
          updateData.statut = 'expiree';
          expiredCount++;
        }
        
        await db.collection('demandes').doc(demande.id).update(updateData);
        
        console.log(`   💾 Sauvegardée dans Firestore`);
        if (isExpired) {
          console.log(`   🔴 Statut changé: ${demande.statut} → expiree`);
        }
        
        migratedCount++;
        
      } catch (error) {
        console.error(`   ❌ Erreur sauvegarde:`, error);
        errorCount++;
      }
    }
    
    // 8. Résumé
    console.log('\n' + '='.repeat(60));
    console.log('✨ Migration terminée !');
    console.log('='.repeat(60));
    console.log(`✅ ${migratedCount} demande(s) migrée(s)`);
    console.log(`   └─ ${expiredCount} marquée(s) comme expirée(s)`);
    console.log(`   └─ ${migratedCount - expiredCount} encore valide(s)`);
    console.log(`⏭️  ${skippedCount} demande(s) ignorée(s)`);
    console.log(`❌ ${errorCount} erreur(s)`);
    
  } catch (error) {
    console.error('❌ Erreur migration:', error);
    process.exit(1);
  }
}

/**
 * Exécution
 */
migrateDemandes()
  .then(() => {
    console.log('\n🎉 Script terminé avec succès');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erreur fatale:', error);
    process.exit(1);
  });
