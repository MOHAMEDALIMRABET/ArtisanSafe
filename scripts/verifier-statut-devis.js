/**
 * Script de vérification du statut d'un devis
 * Usage: node scripts/verifier-statut-devis.js <DEVIS_ID>
 * 
 * Exemple: node scripts/verifier-statut-devis.js DV-2026-00042
 */

const admin = require('firebase-admin');
const path = require('path');

// Charger les credentials Firebase
const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');

if (!admin.apps.length) {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function verifierStatutDevis(devisId) {
  console.log(`\n🔍 Vérification du devis: ${devisId}\n`);
  
  try {
    const devisDoc = await db.collection('devis').doc(devisId).get();
    
    if (!devisDoc.exists) {
      console.error(`❌ Devis introuvable: ${devisId}`);
      process.exit(1);
    }
    
    const devis = devisDoc.data();
    
    // Afficher les informations clés
    console.log('📊 INFORMATIONS DU DEVIS\n');
    console.log(`   Numéro: ${devis.numeroDevis || devisId}`);
    console.log(`   Client: ${devis.client?.prenom} ${devis.client?.nom}`);
    console.log(`   Artisan: ${devis.artisan?.raisonSociale}`);
    console.log(`   Montant TTC: ${devis.totaux?.totalTTC || 0} €`);
    console.log('');
    
    // Afficher le statut actuel
    console.log(`📌 STATUT ACTUEL: ${devis.statut}\n`);
    
    const statutColors = {
      'paye': '🟢',
      'en_cours': '🔵',
      'travaux_termines': '🟣',
      'termine_valide': '🟢',
      'termine_auto_valide': '🟢',
      'litige': '🔴'
    };
    
    console.log(`   ${statutColors[devis.statut] || '⚪'} ${devis.statut.toUpperCase()}\n`);
    
    // Vérifier l'objet travaux
    console.log('🔨 INFORMATIONS TRAVAUX\n');
    
    if (devis.travaux) {
      if (devis.travaux.dateDebut) {
        const dateDebut = devis.travaux.dateDebut.toDate();
        console.log(`   ✅ Date début: ${dateDebut.toLocaleString('fr-FR')}`);
      } else {
        console.log(`   ⏳ Date début: Non définie`);
      }
      
      if (devis.travaux.dateFin) {
        const dateFin = devis.travaux.dateFin.toDate();
        console.log(`   ✅ Date fin: ${dateFin.toLocaleString('fr-FR')}`);
      } else {
        console.log(`   ⏳ Date fin: Non définie`);
      }
      
      if (devis.travaux.dateValidationClient) {
        const dateValidation = devis.travaux.dateValidationClient.toDate();
        console.log(`   ✅ Date validation client: ${dateValidation.toLocaleString('fr-FR')}`);
      }
      
      if (devis.travaux.dateValidationAuto) {
        const dateValidationAuto = devis.travaux.dateValidationAuto.toDate();
        console.log(`   ⏰ Validation auto prévue: ${dateValidationAuto.toLocaleString('fr-FR')}`);
      }
      
      if (devis.travaux.litige) {
        console.log(`\n   ⚠️ LITIGE EN COURS:`);
        console.log(`      Motif: ${devis.travaux.litige.motif}`);
        console.log(`      Déclaré par: ${devis.travaux.litige.declarePar}`);
        console.log(`      Statut: ${devis.travaux.litige.statut}`);
      }
    } else {
      console.log(`   ⚪ Aucune information sur les travaux`);
    }
    
    // Historique des statuts
    console.log('\n📜 HISTORIQUE DES STATUTS\n');
    
    if (devis.historiqueStatuts && devis.historiqueStatuts.length > 0) {
      devis.historiqueStatuts.forEach((h, index) => {
        const date = h.date?.toDate() || new Date();
        const icon = statutColors[h.statut] || '⚪';
        console.log(`   ${index + 1}. ${icon} ${h.statut.toUpperCase()}`);
        console.log(`      Date: ${date.toLocaleString('fr-FR')}`);
        if (h.commentaire) {
          console.log(`      Commentaire: ${h.commentaire}`);
        }
        console.log('');
      });
    } else {
      console.log(`   ⚪ Aucun historique disponible`);
    }
    
    // Vérifier les incohérences
    console.log('\n🔍 VÉRIFICATIONS\n');
    
    let warnings = [];
    
    if (devis.statut === 'en_cours' && !devis.travaux?.dateDebut) {
      warnings.push('⚠️  Statut "en_cours" mais pas de dateDebut dans travaux');
    }
    
    if (devis.statut === 'travaux_termines' && !devis.travaux?.dateFin) {
      warnings.push('⚠️  Statut "travaux_termines" mais pas de dateFin dans travaux');
    }
    
    if (devis.statut === 'termine_valide' && !devis.travaux?.dateValidationClient) {
      warnings.push('⚠️  Statut "termine_valide" mais pas de dateValidationClient');
    }
    
    if (warnings.length > 0) {
      console.log('   AVERTISSEMENTS:\n');
      warnings.forEach(w => console.log(`   ${w}`));
    } else {
      console.log('   ✅ Tout est cohérent !');
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

// Récupérer l'ID du devis depuis les arguments
const devisId = process.argv[2];

if (!devisId) {
  console.error('❌ Usage: node scripts/verifier-statut-devis.js <DEVIS_ID>');
  console.error('   Exemple: node scripts/verifier-statut-devis.js DV-2026-00042');
  process.exit(1);
}

verifierStatutDevis(devisId);
