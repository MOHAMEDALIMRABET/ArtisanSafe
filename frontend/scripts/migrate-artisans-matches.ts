/**
 * SCRIPT DE MIGRATION : Corriger artisansMatches sur demandes existantes
 * 
 * PROBLÈME RÉSOLU :
 * - Les demandes ont des devis acceptés/payés MAIS artisansMatches est vide
 * - Incohérence : devis.artisanId existe mais demande.artisansMatches = []
 * 
 * OBJECTIF :
 * - Scanner toutes les demandes
 * - Pour chaque demande avec devis accepté/payé
 * - Vérifier si artisan est dans artisansMatches
 * - Sinon, l'ajouter
 * 
 * USAGE :
 * cd frontend/scripts
 * npx ts-node --project tsconfig.json migrate-artisans-matches.ts
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Charger variables d'environnement
dotenv.config({ path: resolve(__dirname, '../../.env.local') });

// Initialiser Firebase Admin
const serviceAccount = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

const db = admin.firestore();

interface Demande {
  id: string;
  titre: string;
  artisansMatches: string[];
  statut: string;
  type?: 'directe' | 'publique';
}

interface Devis {
  id: string;
  demandeId: string;
  artisanId: string;
  statut: string;
  numeroDevis: string;
}

async function migrerArtisansMatches() {
  console.log('🚀 Démarrage migration artisansMatches...\n');
  
  let demandesMigrees = 0;
  let demandesIgnorees = 0;
  let artisansAjoutes = 0;
  
  try {
    // 1. Récupérer toutes les demandes
    console.log('📥 Récupération des demandes...');
    const demandesSnapshot = await db.collection('demandes').get();
    console.log(`📊 ${demandesSnapshot.size} demande(s) trouvée(s)\n`);
    
    // 2. Récupérer tous les devis avec statut accepté/payé
    console.log('📥 Récupération des devis acceptés/payés...');
    const devisSnapshot = await db.collection('devis')
      .where('statut', 'in', ['accepte', 'paye', 'en_cours', 'travaux_termines', 'termine_valide', 'termine_auto_valide'])
      .get();
    console.log(`📊 ${devisSnapshot.size} devis accepté(s)/payé(s) trouvé(s)\n`);
    
    // 3. Créer un Map demandeId → artisanIds
    const demandeToArtisans = new Map<string, Set<string>>();
    
    devisSnapshot.forEach(doc => {
      const devis = doc.data() as Devis;
      if (devis.demandeId && devis.artisanId) {
        if (!demandeToArtisans.has(devis.demandeId)) {
          demandeToArtisans.set(devis.demandeId, new Set());
        }
        demandeToArtisans.get(devis.demandeId)!.add(devis.artisanId);
      }
    });
    
    console.log(`🔗 ${demandeToArtisans.size} demande(s) avec devis accepté/payé\n`);
    console.log('─'.repeat(80));
    
    // 4. Pour chaque demande, vérifier et corriger artisansMatches
    for (const docSnap of demandesSnapshot.docs) {
      const demande = { id: docSnap.id, ...docSnap.data() } as Demande;
      const artisansFromDevis = demandeToArtisans.get(demande.id);
      
      // Si pas de devis accepté/payé, ignorer
      if (!artisansFromDevis || artisansFromDevis.size === 0) {
        demandesIgnorees++;
        continue;
      }
      
      // Vérifier si artisansMatches existe et est cohérent
      const artisansActuels = new Set(demande.artisansMatches || []);
      const artisansManquants = Array.from(artisansFromDevis).filter(a => !artisansActuels.has(a));
      
      if (artisansManquants.length === 0) {
        console.log(`⏭️  Demande "${demande.titre}" (${demande.id})`);
        console.log(`   ✅ Déjà à jour : artisansMatches = [${Array.from(artisansActuels).join(', ')}]`);
        demandesIgnorees++;
        continue;
      }
      
      // Artisans manquants → Migration nécessaire
      console.log(`\n👤 Demande : "${demande.titre}" (${demande.id})`);
      console.log(`   Type : ${demande.type || 'non défini'}`);
      console.log(`   Statut : ${demande.statut}`);
      console.log(`   artisansMatches AVANT : [${Array.from(artisansActuels).join(', ') || 'VIDE'}]`);
      console.log(`   Artisans manquants : [${artisansManquants.join(', ')}]`);
      
      // Ajouter artisans manquants
      const nouveauxArtisans = [...artisansActuels, ...artisansManquants];
      
      await db.collection('demandes').doc(demande.id).update({
        artisansMatches: nouveauxArtisans,
        dateModification: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      console.log(`   ✅ artisansMatches APRÈS : [${nouveauxArtisans.join(', ')}]`);
      console.log(`   💾 Sauvegardé dans Firestore`);
      
      demandesMigrees++;
      artisansAjoutes += artisansManquants.length;
    }
    
    console.log('\n' + '─'.repeat(80));
    console.log('\n✨ Migration terminée !');
    console.log(`   ✅ ${demandesMigrees} demande(s) migrée(s)`);
    console.log(`   👥 ${artisansAjoutes} artisan(s) ajouté(s) au total`);
    console.log(`   ⏭️  ${demandesIgnorees} demande(s) ignorée(s) (déjà à jour ou sans devis)`);
    
  } catch (error) {
    console.error('\n❌ Erreur lors de la migration:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Exécution
migrerArtisansMatches();
