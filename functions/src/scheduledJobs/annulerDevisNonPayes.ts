import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Cloud Function scheduled - S'exécute toutes les heures
 * 
 * Fonctionnalité :
 * - Recherche tous les devis avec statut 'en_attente_paiement'
 * - Vérifie si dateLimitePaiement (24h après signature) est dépassée
 * - Annule automatiquement le devis (statut → 'annule')
 * - Notifie l'artisan (comme un refus de devis classique)
 * 
 * Référence user requirement :
 * "si après 24h le client n'a pas encore payer le devis sera annulé 
 *  comme ci le client a refusé la variantes et l'artisant reçoit un 
 *  refus de devis classique"
 */
export const annulerDevisNonPayes = functions.pubsub
  .schedule('every 1 hours')  // Toutes les heures
  .timeZone('Europe/Paris')
  .onRun(async (context) => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    console.log('🔄 Vérification devis non payés...', now.toDate().toISOString());

    try {
      // 1. Récupérer tous les devis en attente de paiement avec délai dépassé
      const snapshot = await db
        .collection('devis')
        .where('statut', '==', 'en_attente_paiement')
        .where('dateLimitePaiement', '<', now)
        .get();

      if (snapshot.empty) {
        console.log('✅ Aucun devis à annuler');
        return {
          success: true,
          devisAnnules: 0,
          message: 'Aucun devis à annuler',
        };
      }

      console.log(`⚠️  ${snapshot.size} devis à annuler (délai 24h dépassé)`);

      // 2. Batch pour mise à jour multiple (max 500 ops)
      const batch = db.batch();
      const devisAnnules: string[] = [];

      snapshot.forEach((doc) => {
        const devis = doc.data();
        const numeroDevis = devis.numeroDevis || doc.id;

        // Calculer délai dépassement
        const delaiDepasse = now.toMillis() - devis.dateLimitePaiement.toMillis();
        const heuresDepasse = Math.floor(delaiDepasse / (1000 * 60 * 60));

        console.log(`  ❌ Annulation: ${numeroDevis}`);
        console.log(`     Client: ${devis.clientId}`);
        console.log(`     Artisan: ${devis.artisanId}`);
        console.log(`     Délai dépassé: ${heuresDepasse}h`);

        // 2a. Mettre à jour le devis (statut → annule)
        batch.update(doc.ref, {
          statut: 'annule',
          dateAnnulation: now,
          motifAnnulation: 'Paiement non effectué dans les 24h après signature',
          dateDerniereModification: now,
          vuParArtisan: false,  // Force artisan à voir l'annulation
        });

        // 2b. Créer notification pour l'artisan (type refus classique)
        const notificationRef = db.collection('notifications').doc();
        batch.set(notificationRef, {
          recipientId: devis.artisanId,
          type: 'devis_annule_non_paye',  // Type spécial pour distinction
          title: `Devis ${numeroDevis} annulé`,
          message: `Le client n'a pas effectué le paiement dans les 24h après signature. Le devis a été automatiquement annulé.`,
          relatedId: doc.id,
          relatedType: 'devis',
          lue: false,
          dateCreation: now,
        });

        devisAnnules.push(numeroDevis);
      });

      // 3. Exécuter toutes les mises à jour atomiquement
      await batch.commit();

      console.log(`✅ ${snapshot.size} devis annulés avec succès`);
      console.log(`   Numéros: ${devisAnnules.join(', ')}`);

      return {
        success: true,
        devisAnnules: snapshot.size,
        numeroDevis: devisAnnules,
        timestamp: now.toDate().toISOString(),
      };

    } catch (error: any) {
      console.error('❌ Erreur lors de l\'annulation des devis:', error);
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);

      // Rethrow pour Firebase error tracking
      throw new functions.https.HttpsError(
        'internal',
        'Erreur lors de l\'annulation automatique des devis',
        error.message
      );
    }
  });

/**
 * ALTERNATIVE: Cloud Function HTTP (pour tests manuels)
 * 
 * Usage:
 * curl -X POST https://[REGION]-[PROJECT].cloudfunctions.net/annulerDevisNonPayesManual \
 *   -H "Content-Type: application/json" \
 *   -d '{"secret": "YOUR_SECRET_KEY"}'
 */
export const annulerDevisNonPayesManual = functions.https.onRequest(async (req, res) => {
  // Sécurité basique (à améliorer en prod)
  const secret = req.body.secret || req.query.secret;
  const expectedSecret = functions.config().admin?.secret || 'dev-secret-123';

  if (secret !== expectedSecret) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }

  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  try {
    const snapshot = await db
      .collection('devis')
      .where('statut', '==', 'en_attente_paiement')
      .where('dateLimitePaiement', '<', now)
      .get();

    if (snapshot.empty) {
      res.status(200).json({
        success: true,
        devisAnnules: 0,
        message: 'Aucun devis à annuler',
      });
      return;
    }

    const batch = db.batch();
    const devisAnnules: string[] = [];

    snapshot.forEach((doc) => {
      const devis = doc.data();

      batch.update(doc.ref, {
        statut: 'annule',
        dateAnnulation: now,
        motifAnnulation: 'Paiement non effectué dans les 24h après signature (manuel)',
        dateDerniereModification: now,
        vuParArtisan: false,
      });

      const notificationRef = db.collection('notifications').doc();
      batch.set(notificationRef, {
        recipientId: devis.artisanId,
        type: 'devis_annule_non_paye',
        title: `Devis ${devis.numeroDevis} annulé`,
        message: `Le client n'a pas effectué le paiement dans les 24h. Devis annulé automatiquement.`,
        relatedId: doc.id,
        relatedType: 'devis',
        lue: false,
        dateCreation: now,
      });

      devisAnnules.push(devis.numeroDevis || doc.id);
    });

    await batch.commit();

    res.status(200).json({
      success: true,
      devisAnnules: snapshot.size,
      numeroDevis: devisAnnules,
      timestamp: now.toDate().toISOString(),
    });

  } catch (error: any) {
    console.error('Erreur:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: error.message,
    });
  }
});
