/**
 * Script de test de l'API SIRENE
 * Test la connexion et les réponses de l'API publique entreprise.data.gouv.fr
 */

const testSireneAPI = async () => {
  console.log('🧪 ===== TEST API SIRENE =====\n');
  
  // SIRET de test (doit exister dans la base SIRENE)
  const siretTest = '95288787500021'; // Le SIRET que vous testez
  
  console.log(`📋 SIRET testé: ${siretTest}`);
  console.log(`🌐 URL: https://entreprise.data.gouv.fr/api/sirene/v3/etablissements/${siretTest}\n`);
  
  try {
    console.log('🔄 Tentative de connexion à l\'API SIRENE...\n');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const startTime = Date.now();
    
    const response = await fetch(
      `https://entreprise.data.gouv.fr/api/sirene/v3/etablissements/${siretTest}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ArtisanSafe/1.0 (Test)'
        },
        signal: controller.signal
      }
    );
    
    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;
    
    console.log(`⏱️  Temps de réponse: ${duration}ms`);
    console.log(`📊 Status HTTP: ${response.status} ${response.statusText}`);
    console.log(`🏷️  Headers de réponse:`, Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`\n❌ Erreur HTTP ${response.status}:`);
      console.error(errorText);
      
      if (response.status === 404) {
        console.log('\n💡 Le SIRET n\'existe pas dans la base SIRENE');
      } else if (response.status === 429) {
        console.log('\n💡 Trop de requêtes - rate limit atteint');
      }
      
      return;
    }
    
    const data = await response.json();
    
    console.log(`\n✅ Réponse API reçue avec succès!\n`);
    console.log('📦 Données établissement:');
    
    if (data.etablissement) {
      const etab = data.etablissement;
      const uniteLegale = etab.unite_legale || {};
      
      console.log(`   - SIRET: ${etab.siret || 'N/A'}`);
      console.log(`   - Raison sociale: ${uniteLegale.denomination || uniteLegale.nom_raison_sociale || 'N/A'}`);
      console.log(`   - Adresse: ${etab.numero_voie || ''} ${etab.type_voie || ''} ${etab.libelle_voie || ''}`);
      console.log(`   - Code postal: ${etab.code_postal || 'N/A'}`);
      console.log(`   - Ville: ${etab.libelle_commune || 'N/A'}`);
      console.log(`   - Activité: ${etab.activite_principale || 'N/A'}`);
      console.log(`   - État: ${etab.etat_administratif || 'N/A'}`);
      
      console.log('\n📋 Données complètes (JSON):');
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log('⚠️  Pas de données établissement dans la réponse');
      console.log(JSON.stringify(data, null, 2));
    }
    
    console.log('\n✅ Test terminé avec succès!');
    
  } catch (error) {
    console.error('\n❌ ERREUR DÉTECTÉE:\n');
    console.error('Type:', error.name);
    console.error('Message:', error.message);
    console.error('Code:', error.code);
    
    if (error.name === 'AbortError') {
      console.log('\n💡 Timeout: L\'API SIRENE n\'a pas répondu dans les 15 secondes');
    } else if (error.code === 'ENOTFOUND') {
      console.log('\n💡 DNS: Impossible de résoudre entreprise.data.gouv.fr');
      console.log('   Vérifiez votre connexion internet');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Connexion refusée par le serveur');
    } else if (error.code === 'ERR_NETWORK') {
      console.log('\n💡 Erreur réseau générale');
    } else if (error.message.includes('fetch')) {
      console.log('\n💡 fetch() n\'est pas disponible dans votre version de Node.js');
      console.log('   Solution: Installer Node.js 18+ ou utiliser node-fetch');
    }
    
    console.error('\nStack trace complète:');
    console.error(error.stack);
  }
};

// Exécution
console.log('Node version:', process.version);
console.log('Platform:', process.platform);
console.log('');

testSireneAPI().then(() => {
  console.log('\n🏁 Script terminé');
}).catch(err => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});
