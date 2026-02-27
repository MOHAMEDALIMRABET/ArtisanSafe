import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * TRIGGER: Incrémentation automatique compteur devis + fermeture quota
 * 
 * DÉCLENCHEUR: Lorsqu'un nouveau devis est créé
 * 
 * Workflow:
 * 1. Artisan crée devis → document créé dans collection 'devis'
 * 2. Cette fonction s'exécute automatiquement
 * 3. Incrémente demande.devisRecus de manière ATOMIQUE (transaction Firestore)
 * 4. Si devisRecus >= 10:
 *    - Change statut demande → 'quota_atteint'
 *    - Notifie client "Vous avez reçu 10 devis, la demande est automatiquement fermée"
 * 5. Logs détaillés pour debug
 * 
 * Phase 2: Système limite devis (évite spam client)
 * - Phase 1 (UI): Warnings 8 devis, blocage 10 devis ✅
 * - Phase 2 (Cloud Function): Incrémentation atomique + fermeture auto ✅ (ce fichier)
 * - Phase 3 (Firestore Rules): Validation sécurité côté serveur ⏳
 * 
 * Avantages Cloud Function vs Frontend:
 * - ✅ Atomicité: Pas de race condition (2 devis créés en même temps)
 * - ✅ Sécurité: Frontend peut être bypassé, Cloud Function non
 * - ✅ Fiabilité: S'exécute même si frontend fermé
 * - ✅ Cohérence: Garantit compteur toujours exact
 * 
 * @example
 * // Artisan crée devis
 * await createDevis({ demandeId: 'dem123', ... });
 * 
 * // Cloud Function s'exécute automatiquement
 * // → demandes/dem123.devisRecus: 5 → 6
 * // → Si 6 < 10: continue normalement
 * // → Si >= 10: statut='quota_atteint', notification client
 */
export const onDevisCreated = functions
  .region('europe-west1') // Paris (plus proche = latence réduite)
  .firestore
  .document('devis/{devisId}')
  .onCreate(async (snapshot, context) => {
    const devisId = context.params.devisId;
    const devisData = snapshot.data();
    
    // Log début traitement
    console.log(`🔄 [onDevisCreated] Démarrage pour devis: ${devisId}`);
    console.log(`   Demande ID: ${devisData.demandeId}`);
    console.log(`   Artisan ID: ${devisData.artisanId}`);
    console.log(`   Client ID: ${devisData.clientId}`);

    try {
      // ========================================
      // ÉTAPE 1: Récupérer la demande
      // ========================================
      const demandeRef = db.collection('demandes').doc(devisData.demandeId);
      const demandeSnap = await demandeRef.get();

      if (!demandeSnap.exists) {
        console.error(`❌ [onDevisCreated] Demande introuvable: ${devisData.demandeId}`);
        return;
      }

      const demandeData = demandeSnap.data()!;

      // ⚠️ Vérifier que c'est une demande PUBLIQUE (privées n'ont pas de limite)
      if (demandeData.type !== 'publique') {
        console.log(`⏭️  [onDevisCreated] Demande privée (pas de limite) - Fin`);
        return;
      }

      console.log(`📊 [onDevisCreated] Type: ${demandeData.type}`);
      console.log(`📊 [onDevisCreated] Devis reçus actuel: ${demandeData.devisRecus || 0}`);

      // ========================================
      // ÉTAPE 2: Incrémenter compteur (ATOMIQUE)
      // ========================================
      // Utiliser transaction pour éviter race conditions
      const nouveauCompteur = await db.runTransaction(async (transaction) => {
        const freshDemandeSnap = await transaction.get(demandeRef);
        
        if (!freshDemandeSnap.exists) {
          throw new Error('Demande supprimée pendant transaction');
        }

        const currentCount = freshDemandeSnap.data()!.devisRecus || 0;
        const newCount = currentCount + 1;

        // Mettre à jour compteur
        transaction.update(demandeRef, {
          devisRecus: newCount,
          dateModification: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`✅ [onDevisCreated] Compteur incrémenté: ${currentCount} → ${newCount}`);
        return newCount;
      });

      // ========================================
      // ÉTAPE 3: Vérifier quota atteint (10 devis)
      // ========================================
      if (nouveauCompteur >= 10) {
        console.log(`🚨 [onDevisCreated] QUOTA ATTEINT (${nouveauCompteur}/10) - Fermeture demande`);

        // 3.1: Fermer la demande
        await demandeRef.update({
          statut: 'quota_atteint',
          dateFermeture: admin.firestore.FieldValue.serverTimestamp(),
          dateModification: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`✅ [onDevisCreated] Statut changé: → 'quota_atteint'`);

        // 3.2: Récupérer infos client pour notification
        const clientRef = db.collection('users').doc(demandeData.clientId);
        const clientSnap = await clientRef.get();
        const clientData = clientSnap.exists ? clientSnap.data() : null;

        // 3.3: Créer notification client
        await db.collection('notifications').add({
          recipientId: demandeData.clientId,
          type: 'quota_devis_atteint',
          title: '✅ Quota de devis atteint',
          message: `Votre demande "${demandeData.metier}" a reçu 10 devis et a été automatiquement fermée. Vous pouvez maintenant comparer les offres et choisir le meilleur artisan.`,
          relatedId: devisData.demandeId,
          relatedType: 'demande',
          metadata: {
            demandeId: devisData.demandeId,
            metier: demandeData.metier,
            ville: demandeData.location?.city || 'Non spécifiée',
            devisRecus: nouveauCompteur
          },
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          dateCreation: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`✅ [onDevisCreated] Notification client envoyée`);

        // 3.4: Log pour analytics (optionnel - peut servir pour stats)
        console.log(`📈 [ANALYTICS] Demande fermée par quota`);
        console.log(`   Demande ID: ${devisData.demandeId}`);
        console.log(`   Client: ${clientData?.email || 'Inconnu'}`);
        console.log(`   Métier: ${demandeData.metier}`);
        console.log(`   Ville: ${demandeData.location?.city || 'N/A'}`);
        console.log(`   Devis reçus: ${nouveauCompteur}`);

      } else if (nouveauCompteur >= 8) {
        // ========================================
        // ÉTAPE 4: Alerte seuil proche (8-9 devis)
        // ========================================
        console.log(`⚠️  [onDevisCreated] Seuil d'alerte (${nouveauCompteur}/10)`);

        // Optionnel: Notification client "Vous approchez du quota"
        await db.collection('notifications').add({
          recipientId: demandeData.clientId,
          type: 'seuil_devis_proche',
          title: '⚠️ Quota de devis bientôt atteint',
          message: `Votre demande "${demandeData.metier}" a reçu ${nouveauCompteur} devis. La demande sera automatiquement fermée à 10 devis.`,
          relatedId: devisData.demandeId,
          relatedType: 'demande',
          metadata: {
            demandeId: devisData.demandeId,
            devisRecus: nouveauCompteur,
            quotaMax: 10
          },
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          dateCreation: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`✅ [onDevisCreated] Notification seuil envoyée (${nouveauCompteur}/10)`);
      } else {
        console.log(`✅ [onDevisCreated] Compteur mis à jour (${nouveauCompteur}/10) - Continue normalement`);
      }

      // ========================================
      // ÉTAPE 5: Fin traitement
      // ========================================
      console.log(`✅ [onDevisCreated] Traitement terminé avec succès`);

    } catch (error) {
      console.error(`❌ [onDevisCreated] ERREUR:`, error);
      console.error(`   Devis ID: ${devisId}`);
      console.error(`   Demande ID: ${devisData.demandeId}`);
      
      // Ne pas bloquer la création du devis si erreur
      // (Le compteur sera synchronisé manuellement si nécessaire)
    }
  });


/**
 * TRIGGER: Décrémenter compteur si devis supprimé (optionnel)
 * 
 * Use case: Admin supprime devis spam ou frauduleux
 * → Rétablit le quota pour permettre devis légitime
 * 
 * ⚠️ À activer uniquement si nécessaire (peut complexifier debug)
 */
export const onDevisDeleted = functions
  .region('europe-west1')
  .firestore
  .document('devis/{devisId}')
  .onDelete(async (snapshot, context) => {
    const devisId = context.params.devisId;
    const devisData = snapshot.data();

    console.log(`🗑️ [onDevisDeleted] Devis supprimé: ${devisId}`);
    console.log(`   Demande ID: ${devisData.demandeId}`);

    try {
      const demandeRef = db.collection('demandes').doc(devisData.demandeId);
      const demandeSnap = await demandeRef.get();

      if (!demandeSnap.exists) {
        console.log(`⚠️  [onDevisDeleted] Demande inexistante - Fin`);
        return;
      }

      const demandeData = demandeSnap.data()!;

      // Seulement pour demandes publiques
      if (demandeData.type !== 'publique') {
        console.log(`⏭️  [onDevisDeleted] Demande privée - Fin`);
        return;
      }

      // Décrémenter compteur (transaction atomique)
      await db.runTransaction(async (transaction) => {
        const freshDemandeSnap = await transaction.get(demandeRef);
        
        if (!freshDemandeSnap.exists) {
          throw new Error('Demande supprimée');
        }

        const currentCount = freshDemandeSnap.data()!.devisRecus || 0;
        const newCount = Math.max(0, currentCount - 1); // Pas de valeurs négatives

        // Mettre à jour compteur
        const updates: any = {
          devisRecus: newCount,
          dateModification: admin.firestore.FieldValue.serverTimestamp()
        };

        // Si quota était atteint, rouvrir la demande
        if (demandeData.statut === 'quota_atteint' && newCount < 10) {
          updates.statut = 'publiee';
          updates.dateFermeture = admin.firestore.FieldValue.delete(); // Supprimer dateFermeture
          console.log(`🔓 [onDevisDeleted] Quota libéré - Réouverture demande`);
        }

        transaction.update(demandeRef, updates);

        console.log(`✅ [onDevisDeleted] Compteur décrémenté: ${currentCount} → ${newCount}`);
      });

    } catch (error) {
      console.error(`❌ [onDevisDeleted] ERREUR:`, error);
    }
  });


/**
 * TRIGGER: Notifications automatiques sur changement de statut devis
 *
 * DÉCLENCHEUR: Toute mise à jour d'un document devis/
 *
 * Cas gérés (SOURCE UNIQUE DE VÉRITÉ côté serveur) :
 * ┌─────────────────────────────┬──────────────────────────────────────────┐
 * │ Transition statut           │ Action                                   │
 * ├─────────────────────────────┼──────────────────────────────────────────┤
 * │ brouillon → envoye          │ Notification client "Nouveau devis reçu" │
 * │ * → accepte                 │ Notification artisan "Devis accepté !"   │
 * │                             │ + Statut demande → 'attribuee'           │
 * │ * → refuse (typeRefus ≠ revision) │ Notification artisan "Devis refusé"│
 * │ * → refuse (typeRefus = revision) │ Notification artisan "Révision"    │
 * └─────────────────────────────┴──────────────────────────────────────────┘
 *
 * Note: Le frontend appelle aussi les notifications pour fiabilité immédiate.
 * Ce trigger est le filet de sécurité si la fenêtre est fermée.
 * Les doublons sont inoffensifs (l'UI déduplique par dateCreation).
 */
export const onDevisUpdated = functions
  .region('europe-west1')
  .firestore
  .document('devis/{devisId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const devisId = context.params.devisId;

    // Ignorer si statut inchangé
    if (before.statut === after.statut) {
      console.log(`⏭️  [onDevisUpdated] Statut inchangé (${after.statut}) - Fin`);
      return null;
    }

    console.log(`🔄 [onDevisUpdated] ${devisId}: ${before.statut} → ${after.statut}`);

    const clientId: string = after.clientId;
    const artisanId: string = after.artisanId;
    const numeroDevis: string = after.numeroDevis || devisId;

    // Noms d'affichage
    const artisanNom: string =
      after.artisan?.raisonSociale ||
      (after.artisan?.prenom && after.artisan?.nom
        ? `${after.artisan.prenom} ${after.artisan.nom}`
        : 'L\'artisan');
    const clientNom: string =
      after.client?.prenom && after.client?.nom
        ? `${after.client.prenom} ${after.client.nom}`
        : 'Le client';

    // Helper : créer notification dans le format attendu par l'UI (notification-service.ts)
    const createNotif = (userId: string, type: string, titre: string, message: string, lien: string) =>
      db.collection('notifications').add({
        userId,
        type,
        titre,
        message,
        lien,
        lue: false,
        dateCreation: admin.firestore.FieldValue.serverTimestamp(),
        // Champs de compatibilité Cloud Function (pour affichage admin)
        relatedId: devisId,
        relatedType: 'devis',
      });

    try {
      // ================================================================
      // CAS 1 : brouillon → envoye
      // Artisan vient d'envoyer le devis → Notifier le CLIENT
      // ================================================================
      if (before.statut === 'brouillon' && after.statut === 'envoye') {
        console.log(`📨 [onDevisUpdated] CAS 1 : devis envoyé → notification client`);

        await createNotif(
          clientId,
          'devis_recu',
          '📄 Nouveau devis reçu',
          `${artisanNom} vous a envoyé le devis ${numeroDevis}.`,
          `/client/devis/${devisId}`
        );

        console.log(`✅ [onDevisUpdated] Notification devis_recu → client ${clientId}`);
      }

      // ================================================================
      // CAS 2 : * → accepte
      // Client vient d'accepter → Notifier l'ARTISAN + marquer demande
      // ================================================================
      else if (after.statut === 'accepte' && before.statut !== 'accepte') {
        console.log(`✅ [onDevisUpdated] CAS 2 : devis accepté → notification artisan`);

        await createNotif(
          artisanId,
          'devis_accepte',
          '✅ Devis accepté !',
          `${clientNom} a accepté votre devis ${numeroDevis}. Un contrat a été généré.`,
          `/artisan/devis?devisId=${devisId}`
        );

        console.log(`✅ [onDevisUpdated] Notification devis_accepte → artisan ${artisanId}`);

        // Mettre à jour statut demande → 'attribuee' si ce n'est pas déjà fait
        if (after.demandeId) {
          const demandeRef = db.collection('demandes').doc(after.demandeId);
          const demandeSnap = await demandeRef.get();

          if (demandeSnap.exists) {
            const demandeStatut = demandeSnap.data()!.statut;
            const STATUTS_A_PASSER = ['publiee', 'matchee', 'quota_atteint', 'en_attente_devis'];

            if (STATUTS_A_PASSER.includes(demandeStatut)) {
              await demandeRef.update({
                statut: 'attribuee',
                artisanAttribueId: artisanId,
                dateAttribution: admin.firestore.FieldValue.serverTimestamp(),
                dateModification: admin.firestore.FieldValue.serverTimestamp(),
              });
              console.log(`✅ [onDevisUpdated] Demande ${after.demandeId} → 'attribuee'`);
            }
          }
        }
      }

      // ================================================================
      // CAS 3 : * → refuse (typeRefus = revision)
      // Client demande une modification → Notifier l'ARTISAN
      // ================================================================
      else if (after.statut === 'refuse' && before.statut !== 'refuse' && after.typeRefus === 'revision') {
        console.log(`🔄 [onDevisUpdated] CAS 3 : révision demandée → notification artisan`);

        const motif = after.motifRefus || '';
        await createNotif(
          artisanId,
          'devis_revision',
          '🔄 Demande de révision de devis',
          `${clientNom} souhaite une révision du devis ${numeroDevis}.${motif ? ` Motif : ${motif}` : ''}`,
          `/artisan/devis?devisId=${devisId}`
        );

        console.log(`✅ [onDevisUpdated] Notification devis_revision → artisan ${artisanId}`);
      }

      // ================================================================
      // CAS 4 : * → refuse (typeRefus ≠ revision)
      // Client refuse définitivement → Notifier l'ARTISAN
      // ================================================================
      else if (after.statut === 'refuse' && before.statut !== 'refuse') {
        console.log(`❌ [onDevisUpdated] CAS 4 : refus définitif → notification artisan`);

        const motif = after.motifRefus || '';
        const typeLabel = after.typeRefus === 'artisan'
          ? ' (artisan bloqué)'
          : after.typeRefus === 'variante'
            ? ' (variante refusée)'
            : '';

        await createNotif(
          artisanId,
          'devis_refuse',
          '❌ Devis refusé',
          `${clientNom} a refusé votre devis ${numeroDevis}${typeLabel}.${motif ? ` Motif : ${motif}` : ''}`,
          `/artisan/devis?devisId=${devisId}`
        );

        console.log(`✅ [onDevisUpdated] Notification devis_refuse → artisan ${artisanId}`);
      }

      else {
        console.log(`⏭️  [onDevisUpdated] Transition ${before.statut} → ${after.statut} non ciblée`);
      }

      return null;

    } catch (error) {
      console.error(`❌ [onDevisUpdated] ERREUR:`, error);
      console.error(`   Devis ID: ${devisId}`);
      // Ne jamais bloquer la mise à jour du devis
      return null;
    }
  });


/**
 * HTTP Function: Synchroniser manuellement compteur devisRecus
 * 
 * Use case: Compteur désynchronisé (bug, migration, etc.)
 * → Admin peut le recalculer manuellement
 * 
 * Endpoint: POST /syncDevisCounter
 * Body: { demandeId: "string" }
 * 
 * @example
 * curl -X POST https://europe-west1-artisandispo.cloudfunctions.net/syncDevisCounter \
 *   -H "Content-Type: application/json" \
 *   -d '{"demandeId": "dem123"}'
 */
export const syncDevisCounter = functions
  .region('europe-west1')
  .https
  .onRequest(async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Méthode non autorisée' });
      return;
    }

    const { demandeId } = req.body;

    if (!demandeId) {
      res.status(400).json({ error: 'demandeId requis' });
      return;
    }

    try {
      console.log(`🔄 [syncDevisCounter] Synchronisation demande: ${demandeId}`);

      // Compter les devis réels
      const devisSnap = await db.collection('devis')
        .where('demandeId', '==', demandeId)
        .get();

      const realCount = devisSnap.size;

      console.log(`📊 [syncDevisCounter] Nombre réel de devis: ${realCount}`);

      // Mettre à jour demande
      const demandeRef = db.collection('demandes').doc(demandeId);
      const demandeSnap = await demandeRef.get();

      if (!demandeSnap.exists) {
        res.status(404).json({ error: 'Demande introuvable' });
        return;
      }

      const oldCount = demandeSnap.data()!.devisRecus || 0;

      await demandeRef.update({
        devisRecus: realCount,
        dateModification: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`✅ [syncDevisCounter] Compteur synchronisé: ${oldCount} → ${realCount}`);

      res.status(200).json({
        success: true,
        demandeId,
        oldCount,
        newCount: realCount,
        difference: realCount - oldCount
      });

    } catch (error) {
      console.error(`❌ [syncDevisCounter] ERREUR:`, error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });
