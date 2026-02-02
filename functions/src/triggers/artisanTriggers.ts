import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * CLOUD FUNCTION : Notification automatique des artisans pour demandes publiques
 * 
 * DÉCLENCHEUR : Lorsque le champ verificationStatus d'un artisan passe à 'approved'
 * 
 * WORKFLOW :
 * 1. Récupérer toutes les demandes publiques actives (statut = 'publiee')
 * 2. Pour chaque demande :
 *    - Vérifier si l'artisan correspond aux critères (métier + localisation)
 *    - Calculer la distance entre artisan et demande (formule Haversine)
 *    - Si distance <= rayon demandé ET artisan pas déjà notifié
 *    - Créer notification pour l'artisan
 *    - Ajouter artisanId à demande.artisansNotifiesIds
 * 
 * EXEMPLE :
 * - Artisan plombier à Paris s'inscrit → approuvé
 * - Demandes publiques actives : "Réparation fuite" (Paris, rayon 10km)
 * - Distance Paris-Paris = 0km < 10km ✅
 * - Artisan reçoit notification "Nouvelle demande correspond à votre profil"
 */
export const onArtisanVerified = functions.firestore
  .document('artisans/{artisanId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const artisanId = context.params.artisanId;

    // ✅ CONDITION : Vérifier changement verificationStatus → 'approved'
    if (before.verificationStatus !== 'approved' && after.verificationStatus === 'approved') {
      functions.logger.info(`🎉 Nouvel artisan approuvé: ${artisanId}`, {
        businessName: after.businessName,
        metiers: after.metiers,
        ville: after.location?.city,
      });

      try {
        // 1️⃣ Récupérer toutes les demandes publiques actives
        const demandesSnapshot = await db.collection('demandes')
          .where('type', '==', 'publique')
          .where('statut', '==', 'publiee')
          .get();

        if (demandesSnapshot.empty) {
          functions.logger.info('ℹ️ Aucune demande publique active');
          return null;
        }

        functions.logger.info(`📋 ${demandesSnapshot.size} demande(s) publique(s) active(s) trouvée(s)`);

        let notificationsCreated = 0;
        const batch = db.batch();

        // 2️⃣ Pour chaque demande publique
        for (const demandeDoc of demandesSnapshot.docs) {
          const demande = demandeDoc.data();
          const demandeId = demandeDoc.id;

          // ✅ CHECK 1 : Vérifier si artisan déjà notifié
          const artisansNotifies = demande.artisansNotifiesIds || [];
          if (artisansNotifies.includes(artisanId)) {
            functions.logger.info(`⏭️ Artisan déjà notifié pour demande ${demandeId}, skip`);
            continue;
          }

          // ✅ CHECK 2 : Vérifier correspondance métier
          const critereRecherche = demande.critereRecherche;
          if (!critereRecherche) {
            functions.logger.warn(`⚠️ Demande ${demandeId} sans critereRecherche, skip`);
            continue;
          }

          const artisanMetiers = after.metiers || [];
          if (!artisanMetiers.includes(critereRecherche.metier)) {
            functions.logger.info(`⏭️ Métier artisan (${artisanMetiers.join(', ')}) ne correspond pas à ${critereRecherche.metier}`);
            continue;
          }

          // ✅ CHECK 3 : Vérifier localisation (distance GPS)
          const artisanCoords = after.location?.coordinates;
          const demandeVille = critereRecherche.ville;
          // Note: demandeRayon sera utilisé quand Mapbox Geocoding sera intégré
          // const demandeRayon = critereRecherche.rayon || 50; // Par défaut 50km

          // Si artisan a coordonnées GPS ET demande a critère ville
          if (artisanCoords && artisanCoords._latitude && artisanCoords._longitude && demandeVille) {
            // TODO : Intégrer Mapbox Geocoding API pour obtenir coordonnées ville demande
            // Pour l'instant, vérifier uniquement ville exacte
            const artisanVille = after.location?.city?.toLowerCase().trim();
            const demandeVilleLower = demandeVille?.toLowerCase().trim();
            
            if (artisanVille !== demandeVilleLower) {
              // En production : calculer vraie distance GPS avec coordonnées ville
              // const demandeCoords = await geocodeVille(demandeVille);
              // const distance = calculateDistance(artisanCoords, demandeCoords);
              // if (distance > critereRecherche.rayon) continue;
              
              functions.logger.info(`⏭️ Ville artisan (${artisanVille}) différente de demande (${demandeVilleLower}), skip`);
              continue;
            }
          } else {
            // Pas de coordonnées GPS, vérifier au moins la ville
            const artisanVille = after.location?.city?.toLowerCase().trim();
            const demandeVilleLower = demandeVille?.toLowerCase().trim();
            
            if (artisanVille !== demandeVilleLower) {
              functions.logger.info(`⏭️ Ville artisan (${artisanVille}) différente de demande (${demandeVilleLower}), skip`);
              continue;
            }
          }

          // ✅ MATCH TROUVÉ ! Créer notification + ajouter à artisansNotifiesIds
          functions.logger.info(`✅ Match trouvé pour demande ${demandeId}`, {
            metier: critereRecherche.metier,
            ville: demandeVille,
          });

          // Créer notification
          const notificationRef = db.collection('notifications').doc();
          batch.set(notificationRef, {
            recipientId: artisanId,
            type: 'nouvelle_demande_publique',
            title: '📢 Nouvelle demande correspond à votre profil',
            message: `Une nouvelle demande publique "${demande.titre || critereRecherche.metier}" à ${demandeVille} correspond à vos compétences.`,
            relatedId: demandeId,
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Ajouter artisanId à demande.artisansNotifiesIds
          const demandeRef = db.collection('demandes').doc(demandeId);
          batch.update(demandeRef, {
            artisansNotifiesIds: admin.firestore.FieldValue.arrayUnion(artisanId),
          });

          notificationsCreated++;
        }

        // Commit toutes les notifications en batch
        if (notificationsCreated > 0) {
          await batch.commit();
          functions.logger.info(`✅ ${notificationsCreated} notification(s) créée(s) pour artisan ${artisanId}`);
        } else {
          functions.logger.info(`ℹ️ Aucune demande publique correspondante pour artisan ${artisanId}`);
        }

        return { notificationsCreated };
      } catch (error) {
        functions.logger.error('❌ Erreur lors de la notification artisan approuvé', error);
        throw error;
      }
    }

    // Si changement ne concerne pas verificationStatus, ne rien faire
    return null;
  });

/**
 * HELPER FUNCTION : Calculer distance entre 2 points GPS (formule Haversine)
 * 
 * @param lat1 Latitude point 1 (degrés)
 * @param lon1 Longitude point 1 (degrés)
 * @param lat2 Latitude point 2 (degrés)
 * @param lon2 Longitude point 2 (degrés)
 * @returns Distance en kilomètres
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Rayon de la Terre en kilomètres
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}
