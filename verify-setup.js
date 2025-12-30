#!/usr/bin/env node

/**
 * Script de vérification de la configuration
 * Vérifie que tous les fichiers .env sont présents et valides
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Vérification de la configuration ArtisanSafe...\n');

let hasErrors = false;

// Fonction de vérification
function checkFile(filePath, requiredVars) {
  const fileName = path.basename(filePath);
  const fileExists = fs.existsSync(filePath);
  
  if (!fileExists) {
    console.log(`❌ ${fileName} - MANQUANT`);
    console.log(`   Créez le fichier : ${filePath}\n`);
    hasErrors = true;
    return;
  }
  
  console.log(`✅ ${fileName} - TROUVÉ`);
  
  // Lire le contenu
  const content = fs.readFileSync(filePath, 'utf-8');
  const missingVars = [];
  
  requiredVars.forEach(varName => {
    const regex = new RegExp(`^${varName}=.+`, 'm');
    if (!regex.test(content)) {
      missingVars.push(varName);
    }
  });
  
  if (missingVars.length > 0) {
    console.log(`   ⚠️  Variables manquantes ou vides :`);
    missingVars.forEach(v => console.log(`      - ${v}`));
    hasErrors = true;
  } else {
    console.log(`   ✅ Toutes les variables requises sont présentes`);
  }
  
  console.log('');
}

// Vérification Frontend
console.log('📱 FRONTEND\n' + '='.repeat(50));
checkFile(
  path.join(__dirname, 'frontend', '.env.local'),
  [
    'NEXT_PUBLIC_API_URL',
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID'
  ]
);

// Vérification Backend
console.log('🖥️  BACKEND\n' + '='.repeat(50));
checkFile(
  path.join(__dirname, 'backend', '.env'),
  [
    'PORT',
    'NODE_ENV',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY',
    'ALLOWED_ORIGINS'
  ]
);

// Vérification des dépendances
console.log('📦 DÉPENDANCES\n' + '='.repeat(50));

const frontendNodeModules = fs.existsSync(path.join(__dirname, 'frontend', 'node_modules'));
const backendNodeModules = fs.existsSync(path.join(__dirname, 'backend', 'node_modules'));

if (frontendNodeModules) {
  console.log('✅ frontend/node_modules - INSTALLÉ\n');
} else {
  console.log('❌ frontend/node_modules - MANQUANT');
  console.log('   Exécutez : cd frontend && npm install\n');
  hasErrors = true;
}

if (backendNodeModules) {
  console.log('✅ backend/node_modules - INSTALLÉ\n');
} else {
  console.log('❌ backend/node_modules - MANQUANT');
  console.log('   Exécutez : cd backend && npm install\n');
  hasErrors = true;
}

// Résultat final
console.log('='.repeat(50));
if (hasErrors) {
  console.log('\n❌ CONFIGURATION INCOMPLÈTE\n');
  console.log('Veuillez corriger les erreurs ci-dessus avant de démarrer l\'application.');
  console.log('Consultez le fichier INSTALLATION.md pour plus d\'informations.\n');
  process.exit(1);
} else {
  console.log('\n✅ CONFIGURATION VALIDE\n');
  console.log('Vous pouvez démarrer l\'application :');
  console.log('  1. Terminal 1 : cd frontend && npm run dev');
  console.log('  2. Terminal 2 : cd backend && npm run dev\n');
  process.exit(0);
}
