// Script de suppression complète des données liées à un utilisateur Firebase UID avec rapport détaillé
// Usage : node delete-user-data-report.js <UID>

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

if (process.argv.length < 3) {
  console.error('Usage: node delete-user-data-report.js <UID>');
  process.exit(1);
}

const UID = process.argv[2];

initializeApp({
  credential: applicationDefault(),
});

const db = getFirestore();

async function deleteCollectionDocs(collection, field, value) {
  const snap = await db.collection(collection).where(field, '==', value).get();
  const batch = db.batch();
  snap.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  return snap.size;
}

async function main() {
  const report = [];
  // users (privé)
  await db.collection('users').doc(UID).delete();
  report.push('users: 1 document supprimé');
  // artisans (public)
  await db.collection('artisans').doc(UID).delete();
  report.push('artisans: 1 document supprimé');
  // devis (client ou artisan)
  let n = await deleteCollectionDocs('devis', 'clientId', UID);
  if (n) report.push(`devis (clientId): ${n} documents supprimés`);
  n = await deleteCollectionDocs('devis', 'artisanId', UID);
  if (n) report.push(`devis (artisanId): ${n} documents supprimés`);
  // avis (auteur ou cible)
  n = await deleteCollectionDocs('avis', 'clientId', UID);
  if (n) report.push(`avis (clientId): ${n} documents supprimés`);
  n = await deleteCollectionDocs('avis', 'artisanId', UID);
  if (n) report.push(`avis (artisanId): ${n} documents supprimés`);
  // conversations (participant)
  n = await deleteCollectionDocs('conversations', 'participants', UID);
  if (n) report.push(`conversations: ${n} documents supprimés`);
  // messages (auteur)
  n = await deleteCollectionDocs('messages', 'authorId', UID);
  if (n) report.push(`messages: ${n} documents supprimés`);
  // contrats (client ou artisan)
  n = await deleteCollectionDocs('contrats', 'clientId', UID);
  if (n) report.push(`contrats (clientId): ${n} documents supprimés`);
  n = await deleteCollectionDocs('contrats', 'artisanId', UID);
  if (n) report.push(`contrats (artisanId): ${n} documents supprimés`);
  // disponibilites (artisan)
  n = await deleteCollectionDocs('disponibilites', 'artisanId', UID);
  if (n) report.push(`disponibilites: ${n} documents supprimés`);

  console.log('--- Rapport de suppression ---');
  report.forEach(line => console.log(line));
  console.log('Suppression terminée pour UID:', UID);
}

main().catch(console.error);
