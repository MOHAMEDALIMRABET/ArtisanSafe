/**
 * 🗄️ Backup Firestore — ArtisanSafe
 * 
 * Export toutes les collections Firestore en JSON local.
 * À lancer manuellement ou via cron Windows (planificateur de tâches).
 * 
 * Usage : node scripts/backup-firestore.js
 * 
 * Cron Windows (toutes les nuits à 3h) :
 * → Planificateur de tâches Windows → Action : node C:\...\backup-firestore.js
 * 
 * Cron Linux/Mac (toutes les nuits à 3h) :
 * → crontab -e → 0 3 * * * node /path/backup-firestore.js
 */

require('dotenv').config({ path: './backend/.env' });

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// ── Init Firebase Admin ──────────────────────────────────
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

// ── Collections à sauvegarder ───────────────────────────
const COLLECTIONS = [
  'users',
  'artisans',
  'demandes',
  'devis',
  'contrats',
  'conversations',
  'messages',
  'notifications',
  'disponibilites',
  'wallets',
];

// ── Dossier de backup ───────────────────────────────────
const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}`);

async function backupCollection(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  const docs = {};
  
  snapshot.forEach((doc) => {
    docs[doc.id] = doc.data();
  });

  console.log(`  ✅ ${collectionName}: ${snapshot.size} documents`);
  return docs;
}

async function runBackup() {
  console.log('\n🗄️  BACKUP FIRESTORE — ArtisanSafe');
  console.log(`📅 Date : ${new Date().toLocaleString('fr-FR')}`);
  console.log(`📁 Dossier : ${backupPath}\n`);

  // Créer le dossier de backup
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  fs.mkdirSync(backupPath, { recursive: true });

  const summary = {
    timestamp: new Date().toISOString(),
    collections: {},
  };

  // Sauvegarder chaque collection
  for (const collectionName of COLLECTIONS) {
    try {
      const data = await backupCollection(collectionName);
      const filePath = path.join(backupPath, `${collectionName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      summary.collections[collectionName] = Object.keys(data).length;
    } catch (err) {
      console.error(`  ❌ Erreur sur ${collectionName}:`, err.message);
      summary.collections[collectionName] = 'ERROR';
    }
  }

  // Écrire le résumé
  fs.writeFileSync(
    path.join(backupPath, '_summary.json'),
    JSON.stringify(summary, null, 2),
    'utf8'
  );

  // ── Nettoyer les vieux backups (garder les 7 derniers) ──
  const backups = fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('backup-'))
    .sort()
    .reverse();

  if (backups.length > 7) {
    const toDelete = backups.slice(7);
    toDelete.forEach((dir) => {
      const dirPath = path.join(BACKUP_DIR, dir);
      fs.rmSync(dirPath, { recursive: true, force: true });
      console.log(`\n🗑️  Ancien backup supprimé : ${dir}`);
    });
  }

  const totalDocs = Object.values(summary.collections)
    .filter((v) => typeof v === 'number')
    .reduce((a, b) => a + b, 0);

  console.log(`\n✅ Backup terminé : ${totalDocs} documents sauvegardés`);
  console.log(`📁 Chemin : ${backupPath}`);
  console.log(`📦 Backups conservés : ${Math.min(backups.length + 1, 7)}/7`);
  
  process.exit(0);
}

runBackup().catch((err) => {
  console.error('❌ Backup échoué :', err);
  process.exit(1);
});
