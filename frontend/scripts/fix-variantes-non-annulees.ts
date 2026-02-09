/**
 * SCRIPT DE CORRECTION : Annuler les variantes qui auraient dû l'être
 * 
 * PROBLÈME RÉSOLU :
 * - Quand une variante est payée (ex: DV-2026-00004-A)
 * - Les autres variantes du même groupe (ex: DV-2026-00004) ne sont pas annulées
 * - Bug ancien : filtre trop restrictif dans annulerAutresVariantes
 * 
 * OBJECTIF :
 * - Scanner tous les devis avec variantes
 * - Si une variante est payée, annuler toutes les autres du même groupe
 * 
 * USAGE :
 * cd frontend/scripts
 * npx ts-node --project tsconfig.json fix-variantes-non-annulees.ts
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

interface Devis {
  id: string;
  numeroDevis: string;
  demandeId?: string;
  varianteGroupe?: string;
  statut: string;
  artisanId: string;
  montantTTC: number;
}

async function fixVariantesNonAnnulees() {
  console.log('🚀 Démarrage correction variantes non annulées...\n');
  
  let devisAnnules = 0;
  let groupesTraites = 0;
  
  try {
    // 1. Récupérer tous les devis
    console.log('📥 Récupération de tous les devis...');
    const devisSnapshot = await db.collection('devis').get();
    console.log(`📊 ${devisSnapshot.size} devis trouvé(s)\n`);
    
    // 2. Grouper par demandeId (système moderne)
    const groupesParDemande = new Map<string, Devis[]>();
    
    devisSnapshot.forEach(doc => {
      const devis = { id: doc.id, ...doc.data() } as Devis;
      
      // Système moderne : grouper par demandeId
      if (devis.demandeId) {
        if (!groupesParDemande.has(devis.demandeId)) {
          groupesParDemande.set(devis.demandeId, []);
        }
        groupesParDemande.get(devis.demandeId)!.push(devis);
      }
    });
    
    console.log(`🔗 ${groupesParDemande.size} groupe(s) de devis trouvé(s)\n`);
    console.log('─'.repeat(80));
    
    // 3. Pour chaque groupe, vérifier s'il y a un devis payé
    for (const [demandeId, devisGroupe] of groupesParDemande.entries()) {
      // Ignorer les groupes avec un seul devis (pas de variantes)
      if (devisGroupe.length <= 1) {
        continue;
      }
      
      // Chercher un devis payé dans le groupe
      const devisPaye = devisGroupe.find(d => 
        ['paye', 'en_cours', 'travaux_termines', 'termine_valide', 'termine_auto_valide'].includes(d.statut)
      );
      
      if (!devisPaye) {
        // Pas de devis payé dans ce groupe → ignorer
        continue;
      }
      
      // Il y a un devis payé → annuler les autres
      console.log(`\n💰 Groupe avec devis PAYÉ détecté :`);
      console.log(`   Demande ID : ${demandeId}`);
      console.log(`   Devis payé : ${devisPaye.numeroDevis} (${devisPaye.statut})`);
      console.log(`   Total variantes : ${devisGroupe.length}`);
      
      // Filtrer les devis à annuler
      const devisAannuler = devisGroupe.filter(d => 
        d.id !== devisPaye.id &&  // Pas le devis payé
        d.statut !== 'annule' &&  // Pas déjà annulé
        d.statut !== 'paye'       // Pas déjà payé (sécurité)
      );
      
      if (devisAannuler.length === 0) {
        console.log(`   ✅ Toutes les autres variantes déjà annulées`);
        continue;
      }
      
      console.log(`   ⚠️  ${devisAannuler.length} variante(s) NON ANNULÉE(S) à corriger :`);
      
      // Annuler chaque devis
      for (const devis of devisAannuler) {
        console.log(`      🗑️  ${devis.numeroDevis} (statut: ${devis.statut}) → annule`);
        
        await db.collection('devis').doc(devis.id).update({
          statut: 'annule',
          dateModification: admin.firestore.FieldValue.serverTimestamp(),
          historiqueStatuts: admin.firestore.FieldValue.arrayUnion({
            statut: 'annule',
            date: admin.firestore.FieldValue.serverTimestamp(),
            commentaire: `Annulé rétroactivement (variante ${devisPaye.numeroDevis} payée)`,
          }),
        });
        
        devisAnnules++;
      }
      
      console.log(`   💾 ${devisAannuler.length} variante(s) annulée(s)`);
      groupesTraites++;
    }
    
    console.log('\n' + '─'.repeat(80));
    console.log('\n✨ Correction terminée !');
    console.log(`   ✅ ${groupesTraites} groupe(s) de variantes corrigé(s)`);
    console.log(`   🗑️  ${devisAnnules} devis annulé(s) au total`);
    
    if (devisAnnules === 0) {
      console.log('\n   🎉 Aucune correction nécessaire - Toutes les variantes sont cohérentes !');
    }
    
  } catch (error) {
    console.error('\n❌ Erreur lors de la correction:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Exécution
fixVariantesNonAnnulees();
