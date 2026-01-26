// Script de suppression complète des données liées à un utilisateur Firebase UID
// Usage : node delete-user-data.js <UID>

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

if (process.argv.length < 3) {
  console.error('Usage: node delete-user-data.js <UID>');
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
  console.log(`Supprimé ${snap.size} documents de ${collection} où ${field} == ${value}`);
}

async function main() {
  // users (privé)
  await db.collection('users').doc(UID).delete();
  // artisans (public)
  await db.collection('artisans').doc(UID).delete();
  // devis (client ou artisan)
  await deleteCollectionDocs('devis', 'clientId', UID);
  await deleteCollectionDocs('devis', 'artisanId', UID);
  // avis (auteur ou cible)
  await deleteCollectionDocs('avis', 'clientId', UID);
  await deleteCollectionDocs('avis', 'artisanId', UID);
  // conversations (participant)
  await deleteCollectionDocs('conversations', 'participants', UID);
  // messages (auteur)
  await deleteCollectionDocs('messages', 'authorId', UID);
  // contrats (client ou artisan)
  await deleteCollectionDocs('contrats', 'clientId', UID);
  await deleteCollectionDocs('contrats', 'artisanId', UID);
  // disponibilites (artisan)
  await deleteCollectionDocs('disponibilites', 'artisanId', UID);

  console.log('Suppression terminée pour UID:', UID);
}

main().catch(console.error);
