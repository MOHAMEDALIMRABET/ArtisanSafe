/**
 * Script de vérification artisan Firestore
 * 
 * Utilisation:
 * 1. Ouvrir Firebase Console
 * 2. Aller dans Firestore → Collections
 * 3. Copier le userId de l'artisan
 * 4. Exécuter ce script dans la console navigateur
 */

// REMPLACER PAR VOTRE USER_ID
const ARTISAN_USER_ID = "VOTRE_USER_ID_ICI";

async function verifierArtisan() {
  console.log('🔍 Vérification artisan:', ARTISAN_USER_ID);
  console.log('━'.repeat(60));

  try {
    const { db } = await import('./lib/firebase/config');
    const { doc, getDoc } = await import('firebase/firestore');

    const artisanRef = doc(db, 'artisans', ARTISAN_USER_ID);
    const artisanSnap = await getDoc(artisanRef);

    if (!artisanSnap.exists()) {
      console.error('❌ ERREUR: Artisan non trouvé avec userId:', ARTISAN_USER_ID);
      return;
    }

    const data = artisanSnap.data();
    
    // 1. Verified
    console.log('\n1️⃣ VERIFIED');
    if (data.verified === true) {
      console.log('✅ verified: true');
    } else {
      console.error('❌ verified:', data.verified, '(DOIT être true)');
    }

    // 2. Métiers
    console.log('\n2️⃣ MÉTIERS');
    console.log('Métiers enregistrés:', data.metiers);
    if (Array.isArray(data.metiers) && data.metiers.length > 0) {
      console.log('✅ Format correct (tableau)');
      data.metiers.forEach(m => {
        if (m === m.toLowerCase()) {
          console.log(`  ✅ "${m}" (minuscule OK)`);
        } else {
          console.warn(`  ⚠️  "${m}" (devrait être "${m.toLowerCase()}")`);
        }
      });
    } else {
      console.error('❌ Métiers manquants ou format incorrect');
    }

    // 3. Zones d'intervention
    console.log('\n3️⃣ ZONES D\'INTERVENTION');
    if (data.zonesIntervention && data.zonesIntervention.length > 0) {
      data.zonesIntervention.forEach((zone, i) => {
        console.log(`\n  Zone ${i + 1}:`);
        console.log('    Ville:', zone.ville);
        console.log('    Code postal:', zone.codePostal || '(manquant)');
        console.log('    Rayon:', zone.rayonKm || zone.rayon || '(manquant)', 'km');
        
        if (zone.latitude && zone.longitude) {
          console.log('    ✅ GPS: lat=' + zone.latitude + ', lon=' + zone.longitude);
        } else {
          console.error('    ❌ GPS MANQUANT - Aller sur /artisan/profil et sauvegarder');
        }
      });
    } else {
      console.error('❌ Aucune zone d\'intervention définie');
    }

    // 4. Disponibilités
    console.log('\n4️⃣ DISPONIBILITÉS');
    if (data.disponibilites && data.disponibilites.length > 0) {
      console.log(`Total: ${data.disponibilites.length} créneau(x)`);
      
      const disponibles = data.disponibilites.filter(d => d.disponible === true);
      const occupes = data.disponibilites.filter(d => d.disponible === false);
      
      console.log(`  ✅ Disponibles: ${disponibles.length}`);
      console.log(`  ⛔ Occupés: ${occupes.length}`);
      
      console.log('\n  Créneaux disponibles:');
      disponibles.forEach((slot, i) => {
        console.log(`\n    Créneau ${i + 1}:`);
        console.log('      Type:', slot.recurrence);
        
        if (slot.recurrence === 'ponctuel' && slot.date) {
          const date = slot.date.toDate();
          console.log('      Date:', date.toISOString().split('T')[0]);
          console.log('      Heure:', slot.heureDebut, '-', slot.heureFin);
        } else if (slot.recurrence === 'hebdomadaire') {
          console.log('      Jour:', slot.jour);
          console.log('      Heure:', slot.heureDebut, '-', slot.heureFin);
        }
      });

      if (disponibles.length === 0) {
        console.error('  ❌ Aucun créneau disponible (tous occupés)');
        console.log('  → Aller sur /artisan/agenda et basculer en "Disponible"');
      }
    } else {
      console.error('❌ Aucune disponibilité définie');
      console.log('→ Aller sur /artisan/agenda et créer des créneaux');
    }

    // 5. Résumé
    console.log('\n' + '━'.repeat(60));
    console.log('📊 RÉSUMÉ');
    console.log('━'.repeat(60));

    const checks = {
      verified: data.verified === true,
      metiers: Array.isArray(data.metiers) && data.metiers.length > 0,
      zones: data.zonesIntervention?.length > 0,
      gps: data.zonesIntervention?.[0]?.latitude && data.zonesIntervention?.[0]?.longitude,
      dispos: data.disponibilites?.some(d => d.disponible === true)
    };

    console.log('✅ Verified:', checks.verified ? 'OK' : '❌ MANQUANT');
    console.log('✅ Métiers:', checks.metiers ? 'OK' : '❌ MANQUANT');
    console.log('✅ Zones:', checks.zones ? 'OK' : '❌ MANQUANT');
    console.log('✅ GPS:', checks.gps ? 'OK' : '❌ MANQUANT');
    console.log('✅ Disponibilités:', checks.dispos ? 'OK' : '❌ MANQUANT');

    const allOk = Object.values(checks).every(v => v === true);
    
    if (allOk) {
      console.log('\n🎉 TOUT EST OK ! L\'artisan devrait être trouvé.');
    } else {
      console.error('\n⚠️  PROBLÈMES DÉTECTÉS - Corriger les éléments marqués ❌');
    }

  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error);
  }
}

// Exécuter
verifierArtisan();
