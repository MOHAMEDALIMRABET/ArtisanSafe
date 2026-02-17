import { db } from '../config/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Service backend pour les demandes express
 * Utilisé par les routes Stripe et Cloud Functions
 */

// ====================================
// Récupération données
// ====================================

export async function getPropositionExpressById(id: string) {
  try {
    const doc = await db.collection('propositions_express').doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error('Erreur getPropositionExpressById:', error);
    throw error;
  }
}

export async function getDemandeExpressById(id: string) {
  try {
    const doc = await db.collection('demandes_express').doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error('Erreur getDemandeExpressById:', error);
    throw error;
  }
}

// ====================================
// Mise à jour statuts
// ====================================

export async function markDemandePaid(demandeId: string) {
  try {
    await db.collection('demandes_express').doc(demandeId).update({
      statut: 'payee',
      updatedAt: Timestamp.now(),
    });
    console.log(`✅ Demande ${demandeId} marquée comme payée`);
  } catch (error) {
    console.error('Erreur markDemandePaid:', error);
    throw error;
  }
}

export async function updateDemandeStatut(demandeId: string, statut: string) {
  try {
    await db.collection('demandes_express').doc(demandeId).update({
      statut,
      updatedAt: Timestamp.now(),
    });
    console.log(`✅ Demande ${demandeId} → statut: ${statut}`);
  } catch (error) {
    console.error('Erreur updateDemandeStatut:', error);
    throw error;
  }
}
