import { db } from '../config/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Service backend pour les paiements express
 * Gère les transactions Stripe et la collection paiements_express
 */

// ====================================
// Types
// ====================================

interface CreatePaiementExpressData {
  demandeId: string;
  propositionId: string;
  clientId: string;
  artisanId: string;
  stripePaymentIntentId: string;
  montant: number;
  commission: number;
  montantArtisan: number;
  statut: 'paye';
}

// ====================================
// Création paiement
// ====================================

export async function createPaiementExpress(data: CreatePaiementExpressData) {
  try {
    const docRef = await db.collection('paiements_express').add({
      ...data,
      createdAt: FieldValue.serverTimestamp(),
      paidAt: FieldValue.serverTimestamp(),
    });
    
    console.log(`💳 Paiement express créé: ${docRef.id}`);
    console.log(`   - Montant total: ${data.montant}€`);
    console.log(`   - Commission (10%): ${data.commission}€`);
    console.log(`   - Montant artisan: ${data.montantArtisan}€`);
    
    return docRef.id;
  } catch (error) {
    console.error('Erreur createPaiementExpress:', error);
    throw error;
  }
}

// ====================================
// Récupération paiement
// ====================================

export async function getPaiementByDemandeId(demandeId: string) {
  try {
    const snapshot = await db.collection('paiements_express')
      .where('demandeId', '==', demandeId)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error('Erreur getPaiementByDemandeId:', error);
    throw error;
  }
}

export async function getPaiementByPropositionId(propositionId: string) {
  try {
    const snapshot = await db.collection('paiements_express')
      .where('propositionId', '==', propositionId)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error('Erreur getPaiementByPropositionId:', error);
    throw error;
  }
}

// ====================================
// Mise à jour statut paiement
// ====================================

export async function updatePaiementStatut(
  paiementId: string,
  statut: 'libere' | 'rembourse',
  additionalData?: any
) {
  try {
    const updateData: any = {
      statut,
      updatedAt: FieldValue.serverTimestamp(),
      ...additionalData,
    };

    await db.collection('paiements_express').doc(paiementId).update(updateData);
    
    console.log(`✅ Paiement ${paiementId} → statut: ${statut}`);
    
    return true;
  } catch (error) {
    console.error('Erreur updatePaiementStatut:', error);
    throw error;
  }
}

// ====================================
// Capture paiement (libérer escrow)
// ====================================

export async function markPaiementLibere(paiementId: string, stripeChargeId: string) {
  try {
    await db.collection('paiements_express').doc(paiementId).update({
      statut: 'libere',
      stripeChargeId,
      releasedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    console.log(`💰 Paiement ${paiementId} libéré (charge: ${stripeChargeId})`);
  } catch (error) {
    console.error('Erreur markPaiementLibere:', error);
    throw error;
  }
}

// ====================================
// Remboursement
// ====================================

export async function markPaiementRembourse(paiementId: string) {
  try {
    await db.collection('paiements_express').doc(paiementId).update({
      statut: 'rembourse',
      refundedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    console.log(`💸 Paiement ${paiementId} remboursé`);
  } catch (error) {
    console.error('Erreur markPaiementRembourse:', error);
    throw error;
  }
}
