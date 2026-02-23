/**
 * Script de migration : suppression du statut 'accepte' (obsolète)
 * 
 * Contexte :
 * - Ancien flux : envoye → accepte (terminal, sans paiement)
 * - Nouveau flux : envoye → en_attente_paiement → paye
 *
 * Migration :
 * - 'accepte' + signatureClient présente  → 'paye' (accepté + signé dans l'ancien flux = équivalent payé)
 * - 'accepte' + pas de signatureClient    → 'expire' (accepté mais jamais finalisé)
 *
 * Utilise Firebase Admin SDK pour bypasser les règles de sécurité Firestore.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

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

async function migrateAccepteStatut() {
  console.log('🚀 Démarrage migration statut "accepte" → suppression obsolète...\n');

  const snapshot = await db.collection('devis').where('statut', '==', 'accepte').get();

  if (snapshot.empty) {
    console.log('✅ Aucun devis avec statut "accepte" trouvé. Migration inutile.');
    return;
  }

  console.log(`📊 ${snapshot.size} devis avec statut "accepte" trouvé(s)\n`);

  let migreVersPaye = 0;
  let migresVersExpire = 0;
  let erreurs = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const numeroDevis = data.numeroDevis || docSnap.id;

    try {
      const aSignature = !!data.signatureClient;

      if (aSignature) {
        // Ancien devis "accepté + signé" → équivalent 'paye'
        await docSnap.ref.update({
          statut: 'paye',
          dateMigration: Timestamp.now(),
          noteMigration: 'Migré depuis statut obsolète "accepte" (avec signature) → "paye"',
        });
        console.log(`  ✅ ${numeroDevis} → "paye" (avait signatureClient)`);
        migreVersPaye++;
      } else {
        // Ancien devis "accepté sans signature ni paiement" → expiré
        await docSnap.ref.update({
          statut: 'expire',
          dateExpiration: Timestamp.now(),
          motifExpiration: 'Migration : devis accepté dans ancien système sans paiement',
          dateMigration: Timestamp.now(),
          noteMigration: 'Migré depuis statut obsolète "accepte" (sans signature) → "expire"',
        });
        console.log(`  ⏰ ${numeroDevis} → "expire" (sans signature ni paiement)`);
        migresVersExpire++;
      }
    } catch (error) {
      console.error(`  ❌ Erreur pour devis ${numeroDevis}:`, error);
      erreurs++;
    }
  }

  console.log('\n✨ Migration terminée !');
  console.log(`  ✅ ${migreVersPaye} devis migré(s) vers "paye"`);
  console.log(`  ⏰ ${migresVersExpire} devis migré(s) vers "expire"`);
  if (erreurs > 0) console.log(`  ❌ ${erreurs} erreur(s)`);
}

migrateAccepteStatut()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Erreur fatale:', error);
    process.exit(1);
  });
