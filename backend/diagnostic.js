#!/usr/bin/env node

/**
 * Script de diagnostic et réparation automatique
 * Vérifie et corrige la configuration backend pour l'API SIRENE
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 ===== DIAGNOSTIC BACKEND ARTISANSAFE =====\n');

// 1. Vérifier Node.js
console.log('1️⃣  Vérification Node.js...');
try {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
  
  console.log(`   Version: ${nodeVersion}`);
  
  if (majorVersion < 18) {
    console.log('   ❌ Node.js version < 18 détectée');
    console.log('   ⚠️  fetch() natif non disponible');
    console.log('   💡 Solution: Installer Node.js 18+ ou node-fetch');
    console.log('   📥 Télécharger: https://nodejs.org/\n');
  } else {
    console.log('   ✅ Version compatible (fetch natif disponible)\n');
  }
} catch (error) {
  console.error('   ❌ Erreur vérification Node.js:', error.message);
}

// 2. Vérifier package.json
console.log('2️⃣  Vérification package.json...');
try {
  const packageJsonPath = path.join(__dirname, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  
  const requiredDeps = ['firebase-admin', 'express', 'cors', 'dotenv'];
  const missingDeps = [];
  
  requiredDeps.forEach(dep => {
    if (!packageJson.dependencies?.[dep]) {
      missingDeps.push(dep);
      console.log(`   ❌ ${dep} manquant`);
    } else {
      console.log(`   ✅ ${dep} installé (${packageJson.dependencies[dep]})`);
    }
  });
  
  if (missingDeps.length > 0) {
    console.log(`\n   ⚠️  Dépendances manquantes: ${missingDeps.join(', ')}`);
    console.log('   💡 Exécutez: npm install ' + missingDeps.join(' '));
    console.log('');
  } else {
    console.log('   ✅ Toutes dépendances présentes\n');
  }
} catch (error) {
  console.error('   ❌ Erreur lecture package.json:', error.message, '\n');
}

// 3. Vérifier node_modules
console.log('3️⃣  Vérification node_modules...');
try {
  const nodeModulesPath = path.join(__dirname, 'node_modules');
  
  if (!fs.existsSync(nodeModulesPath)) {
    console.log('   ❌ node_modules absent');
    console.log('   💡 Exécutez: npm install\n');
  } else {
    const hasFirebaseAdmin = fs.existsSync(path.join(nodeModulesPath, 'firebase-admin'));
    
    if (!hasFirebaseAdmin) {
      console.log('   ❌ firebase-admin non installé');
      console.log('   💡 Exécutez: npm install firebase-admin\n');
    } else {
      console.log('   ✅ firebase-admin installé\n');
    }
  }
} catch (error) {
  console.error('   ❌ Erreur vérification node_modules:', error.message, '\n');
}

// 4. Vérifier fichier .env
console.log('4️⃣  Vérification .env...');
try {
  const envPath = path.join(__dirname, '.env');
  
  if (!fs.existsSync(envPath)) {
    console.log('   ⚠️  Fichier .env absent');
    console.log('   💡 Créez un fichier .env avec les variables Firebase\n');
  } else {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const requiredVars = [
      'FIREBASE_PROJECT_ID',
      'FIREBASE_CLIENT_EMAIL',
      'FIREBASE_PRIVATE_KEY',
      'PORT'
    ];
    
    const missingVars = [];
    requiredVars.forEach(varName => {
      if (!envContent.includes(varName)) {
        missingVars.push(varName);
      }
    });
    
    if (missingVars.length > 0) {
      console.log(`   ⚠️  Variables manquantes: ${missingVars.join(', ')}`);
    } else {
      console.log('   ✅ Toutes variables Firebase présentes');
    }
    
    // Vérifier SIRENE_BYPASS_VERIFICATION
    if (envContent.includes('SIRENE_BYPASS_VERIFICATION=true')) {
      console.log('   ⚠️  MODE BYPASS ACTIVÉ (dev uniquement)');
    }
    
    console.log('');
  }
} catch (error) {
  console.error('   ❌ Erreur vérification .env:', error.message, '\n');
}

// 5. Test connexion API SIRENE
console.log('5️⃣  Test connexion API SIRENE...');
console.log('   🌐 Tentative: https://entreprise.data.gouv.fr/api/sirene/v3/etablissements/54205118000047\n');

(async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(
      'https://entreprise.data.gouv.fr/api/sirene/v3/etablissements/54205118000047',
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ArtisanSafe/1.0 Diagnostic'
        },
        signal: controller.signal
      }
    );
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      console.log(`   ✅ API SIRENE accessible (Status ${response.status})`);
      console.log('   ✅ Connexion internet OK\n');
    } else {
      console.log(`   ⚠️  API SIRENE réponse ${response.status}`);
      console.log('   💡 L\'API peut avoir des problèmes temporaires\n');
    }
  } catch (error) {
    console.log(`   ❌ Impossible de joindre l'API SIRENE`);
    console.log(`   Type d'erreur: ${error.name}`);
    console.log(`   Message: ${error.message}`);
    
    if (error.name === 'AbortError') {
      console.log('   💡 Timeout - Connexion lente ou API indisponible');
    } else if (error.code === 'ENOTFOUND') {
      console.log('   💡 Vérifiez votre connexion internet');
    } else if (error.message.includes('fetch')) {
      console.log('   💡 fetch() non disponible - Node.js < 18 ?');
      console.log('   💡 Installez Node.js 18+ ou node-fetch');
    }
    console.log('');
  }

  // 6. Résumé et recommandations
  console.log('═'.repeat(50));
  console.log('📋 RÉSUMÉ ET ACTIONS RECOMMANDÉES\n');
  
  console.log('✅ Actions immédiates:');
  console.log('   1. cd backend');
  console.log('   2. npm install firebase-admin  (si manquant)');
  console.log('   3. npm run dev  (redémarrer serveur)');
  console.log('   4. node test-sirene-api.js  (tester API)\n');
  
  console.log('📚 Documentation complète:');
  console.log('   docs/SIRENE_ERROR_RESOLUTION.md\n');
  
  console.log('🏁 Diagnostic terminé');
})();
