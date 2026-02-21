/**
 * Service de gestion du wallet artisan
 * 
 * ⚠️ IMPORTANT : Le wallet est un SUIVI UNIQUEMENT
 * Les paiements sont gérés automatiquement par Stripe Connect :
 * 
 * 1. Client paie → Argent en séquestre Stripe
 * 2. Travaux terminés → Argent libéré automatiquement
 * 3. Stripe transfère vers compte bancaire artisan (automatique)
 * 
 * Le wallet affiche :
 * - Historique des transactions
 * - Montants en attente (séquestre)
 * - Montants transférés
 * - Statistiques globales
 */

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs,
  setDoc, 
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { db } from './config';
import type { 
  Wallet, 
  WalletTransaction, 
  WalletTransactionType,
  WalletTransactionStatut
} from '@/types/firestore';

// ============================================
// GESTION WALLET
// ============================================

/**
 * Créer un wallet pour un artisan
 */
export async function createWallet(artisanId: string): Promise<Wallet> {
  const walletRef = doc(db, 'wallets', artisanId);
  
  const walletData: Wallet = {
    id: artisanId,
    artisanId,
    soldeDisponible: 0,
    soldeEnAttente: 0, // Montant en séquestre Stripe
    soldeTotal: 0,
    totalEncaisse: 0,  // Total reçu depuis le début
    totalRetire: 0,    // Total transféré par Stripe vers compte bancaire
    stripeOnboardingStatus: 'not_started', // Onboarding pas encore commencé
    ibanVerified: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  await setDoc(walletRef, walletData);
  return walletData;
}

/**
 * Récupérer le wallet d'un artisan
 */
export async function getWalletByArtisanId(artisanId: string): Promise<Wallet | null> {
  try {
    const walletRef = doc(db, 'wallets', artisanId);
    const walletSnap = await getDoc(walletRef);
    
    if (!walletSnap.exists()) {
      // Créer un wallet si n'existe pas
      console.log('Wallet inexistant, création automatique pour:', artisanId);
      return await createWallet(artisanId);
    }
    
    return {
      id: walletSnap.id,
      ...walletSnap.data()
    } as Wallet;
  } catch (error) {
    console.error('Erreur récupération wallet:', error);
    return null;
  }
}

/**
 * Mettre à jour le Stripe Connect Account ID
 */
export async function updateWalletStripeAccount(
  artisanId: string, 
  stripeAccountId: string
): Promise<void> {
  const walletRef = doc(db, 'wallets', artisanId);
  await updateDoc(walletRef, {
    stripeAccountId,
    updatedAt: Timestamp.now()
  });
}

// ============================================
// TRANSACTIONS (Suivi uniquement)
// ============================================

/**
 * Enregistrer une transaction de paiement client
 * Appelé quand un client paie un devis (argent en séquestre)
 */
export async function recordPaiementClient(
  artisanId: string,
  contratId: string,
  devisId: string,
  montant: number,
  stripePaymentIntentId: string
): Promise<WalletTransaction> {
  const walletRef = doc(db, 'wallets', artisanId);
  const wallet = await getWalletByArtisanId(artisanId);
  
  if (!wallet) {
    throw new Error('Wallet introuvable');
  }
  
  // Mettre à jour le wallet : montant en attente (séquestre)
  await updateDoc(walletRef, {
    soldeEnAttente: wallet.soldeEnAttente + montant,
    soldeTotal: wallet.soldeTotal + montant,
    updatedAt: Timestamp.now(),
    lastTransaction: Timestamp.now()
  });
  
  // Créer la transaction
  const transactionData: Omit<WalletTransaction, 'id'> = {
    artisanId,
    type: 'credit',
    montant,
    statut: 'pending', // En attente de validation travaux
    description: `Paiement client reçu (en séquestre)`,
    contratId,
    devisId,
    stripePaymentIntentId,
    createdAt: Timestamp.now(),
    metadata: {
      phase: 'sequestre'
    }
  };
  
  const transactionRef = await addDoc(collection(db, 'walletTransactions'), transactionData);
  
  return {
    id: transactionRef.id,
    ...transactionData
  } as WalletTransaction;
}

/**
 * Enregistrer la libération d'un paiement
 * Appelé quand les travaux sont validés (Stripe transfère automatiquement)
 */
export async function recordPaiementLibere(
  artisanId: string,
  contratId: string,
  montant: number,
  stripeTransferId: string
): Promise<WalletTransaction> {
  const walletRef = doc(db, 'wallets', artisanId);
  const wallet = await getWalletByArtisanId(artisanId);
  
  if (!wallet) {
    throw new Error('Wallet introuvable');
  }
  
  // Mettre à jour le wallet : retirer de l'attente, ajouter au disponible et au total encaissé
  await updateDoc(walletRef, {
    soldeEnAttente: Math.max(0, wallet.soldeEnAttente - montant),
    soldeDisponible: wallet.soldeDisponible + montant,
    totalEncaisse: wallet.totalEncaisse + montant,
    updatedAt: Timestamp.now(),
    lastTransaction: Timestamp.now()
  });
  
  // Créer la transaction
  const transactionData: Omit<WalletTransaction, 'id'> = {
    artisanId,
    type: 'credit',
    montant,
    statut: 'completed',
    description: `Paiement libéré et en cours de transfert`,
    contratId,
    stripeTransferId,
    createdAt: Timestamp.now(),
    completedAt: Timestamp.now(),
    metadata: {
      phase: 'libere',
      transferAutoStripe: true
    }
  };
  
  const transactionRef = await addDoc(collection(db, 'walletTransactions'), transactionData);
  
  return {
    id: transactionRef.id,
    ...transactionData
  } as WalletTransaction;
}

/**
 * Enregistrer un transfert Stripe vers compte bancaire
 * Appelé automatiquement par webhook Stripe quand le virement est effectué
 */
export async function recordTransfertStripe(
  artisanId: string,
  montant: number,
  stripeTransferId: string
): Promise<WalletTransaction> {
  const walletRef = doc(db, 'wallets', artisanId);
  const wallet = await getWalletByArtisanId(artisanId);
  
  if (!wallet) {
    throw new Error('Wallet introuvable');
  }
  
  // Mettre à jour le wallet : retirer du disponible, ajouter au total retiré
  await updateDoc(walletRef, {
    soldeDisponible: Math.max(0, wallet.soldeDisponible - montant),
    totalRetire: wallet.totalRetire + montant,
    soldeTotal: Math.max(0, wallet.soldeTotal - montant),
    updatedAt: Timestamp.now(),
    lastTransaction: Timestamp.now()
  });
  
  // Créer la transaction
  const transactionData: Omit<WalletTransaction, 'id'> = {
    artisanId,
    type: 'debit',
    montant,
    statut: 'completed',
    description: `Virement Stripe vers compte bancaire`,
    stripeTransferId,
    createdAt: Timestamp.now(),
    completedAt: Timestamp.now(),
    metadata: {
      automatic: true,
      transferStripe: true
    }
  };
  
  const transactionRef = await addDoc(collection(db, 'walletTransactions'), transactionData);
  
  return {
    id: transactionRef.id,
    ...transactionData
  } as WalletTransaction;
}

/**
 * Enregistrer un remboursement (litige)
 */
export async function recordRemboursement(
  artisanId: string,
  contratId: string,
  montant: number,
  stripeRefundId: string,
  raison: string
): Promise<WalletTransaction> {
  const walletRef = doc(db, 'wallets', artisanId);
  const wallet = await getWalletByArtisanId(artisanId);
  
  if (!wallet) {
    throw new Error('Wallet introuvable');
  }
  
  // Mettre à jour le wallet : retirer de l'attente ou du disponible
  const newSoldeEnAttente = Math.max(0, wallet.soldeEnAttente - montant);
  const resteARembourser = montant - (wallet.soldeEnAttente - newSoldeEnAttente);
  const newSoldeDisponible = Math.max(0, wallet.soldeDisponible - resteARembourser);
  
  await updateDoc(walletRef, {
    soldeEnAttente: newSoldeEnAttente,
    soldeDisponible: newSoldeDisponible,
    soldeTotal: wallet.soldeTotal - montant,
    updatedAt: Timestamp.now(),
    lastTransaction: Timestamp.now()
  });
  
  // Créer la transaction
  const transactionData: Omit<WalletTransaction, 'id'> = {
    artisanId,
    type: 'remboursement',
    montant,
    statut: 'completed',
    description: `Remboursement client : ${raison}`,
    contratId,
    stripePaymentIntentId: stripeRefundId,
    createdAt: Timestamp.now(),
    completedAt: Timestamp.now(),
    metadata: {
      raison
    }
  };
  
  const transactionRef = await addDoc(collection(db, 'walletTransactions'), transactionData);
  
  return {
    id: transactionRef.id,
    ...transactionData
  } as WalletTransaction;
}

/**
 * Récupérer les transactions d'un artisan
 */
export async function getWalletTransactions(
  artisanId: string,
  limitCount: number = 50
): Promise<WalletTransaction[]> {
  try {
    const q = query(
      collection(db, 'walletTransactions'),
      where('artisanId', '==', artisanId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as WalletTransaction));
  } catch (error) {
    console.error('Erreur récupération transactions:', error);
    return [];
  }
}

/**
 * Récupérer une transaction spécifique
 */
export async function getWalletTransactionById(transactionId: string): Promise<WalletTransaction | null> {
  try {
    const transactionRef = doc(db, 'walletTransactions', transactionId);
    const transactionSnap = await getDoc(transactionRef);
    
    if (!transactionSnap.exists()) {
      return null;
    }
    
    return {
      id: transactionSnap.id,
      ...transactionSnap.data()
    } as WalletTransaction;
  } catch (error) {
    console.error('Erreur récupération transaction:', error);
    return null;
  }
}

// ============================================
// STATISTIQUES & UTILITAIRES
// ============================================

/**
 * Calculer les statistiques du wallet
 */
export async function getWalletStats(artisanId: string): Promise<{
  soldeDisponible: number;
  soldeEnAttente: number;
  totalEncaisse: number;
  totalRetire: number;
  nombreTransactions: number;
}> {
  const wallet = await getWalletByArtisanId(artisanId);
  
  if (!wallet) {
    return {
      soldeDisponible: 0,
      soldeEnAttente: 0,
      totalEncaisse: 0,
      totalRetire: 0,
      nombreTransactions: 0
    };
  }
  
  // Compter les transactions
  const q = query(
    collection(db, 'walletTransactions'),
    where('artisanId', '==', artisanId)
  );
  const snapshot = await getDocs(q);
  
  return {
    soldeDisponible: wallet.soldeDisponible,
    soldeEnAttente: wallet.soldeEnAttente,
    totalEncaisse: wallet.totalEncaisse,
    totalRetire: wallet.totalRetire,
    nombreTransactions: snapshot.size
  };
}

/**
 * Obtenir un résumé du wallet pour affichage
 */
export async function getWalletSummary(artisanId: string): Promise<{
  wallet: Wallet | null;
  stats: {
    soldeDisponible: number;
    soldeEnAttente: number;
    totalEncaisse: number;
    totalRetire: number;
    nombreTransactions: number;
  };
  recentTransactions: WalletTransaction[];
}> {
  const wallet = await getWalletByArtisanId(artisanId);
  const stats = await getWalletStats(artisanId);
  const recentTransactions = await getWalletTransactions(artisanId, 10);
  
  return {
    wallet,
    stats,
    recentTransactions
  };
}
