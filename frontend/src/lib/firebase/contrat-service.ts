/**
 * @deprecated
 * ⚠️ CE FICHIER EST DÉPRÉCIÉ ⚠️
 * 
 * La collection 'contrats' a été supprimée pour simplifier l'architecture.
 * Juridiquement, un devis signé = contrat. Pas besoin de duplication.
 * 
 * **Migration** :
 * - Toutes les fonctions sont maintenant dans `devis-service.ts`
 * - Nouveaux statuts devis : paye, en_cours, travaux_termines, termine_valide, litige
 * - Gestion escrow intégrée dans le champ `devis.paiement`
 * 
 * **Correspondances** :
 * - createContrat() → createDevis() + statut 'paye'
 * - declarerDebutTravaux() → declarerDebutTravaux() (devis-service)
 * - declarerFinTravaux() → declarerFinTravaux() (devis-service)
 * - validerTravaux() → validerTravaux() (devis-service)
 * - signalerLitige() → signalerLitige() (devis-service)
 * 
 * **Action requise** :
 * - Remplacer les imports `contrat-service` par `devis-service`
 * - Utiliser `Devis` au lieu de `Contrat` dans les types
 * 
 * **Date de dépréciation** : 2026-02-01
 * **À supprimer** : 2026-03-01
 */

/**
 * Service Firestore pour la gestion des contrats avec escrow (séquestre)
 * 
 * Collection: contrats
 * 
 * Fonctionnalités:
 * - Créer contrat après paiement escrow
 * - Déclarer début/fin travaux (artisan)
 * - Valider travaux (client)
 * - Signaler litige (client)
 * - Récupérer contrats client/artisan
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  Timestamp,
  FirebaseError
} from 'firebase/firestore';
import { db } from './config';
import {
  Contrat,
  ContratStatut,
  CreateContratData,
  DeclareFinTravauxData,
  ValiderTravauxData,
  SignalerLitigeData
} from '@/types/contrat';

const CONTRATS_COLLECTION = 'contrats';
const COMMISSION_RATE = 0.10; // 10% commission plateforme


/**
 * Créer un nouveau contrat après paiement escrow
 * Appelé automatiquement après confirmation paiement
 */
export async function createContrat(data: CreateContratData): Promise<Contrat> {
  try {
    const contratData: Omit<Contrat, 'id'> = {
      devisId: data.devisId,
      clientId: data.clientId,
      artisanId: data.artisanId,
      
      statut: 'en_attente_debut', // État initial
      dateCreation: Timestamp.now(),
      
      paiement: {
        montantTotal: data.montantTotal,
        commission: Math.round(data.montantTotal * COMMISSION_RATE * 100) / 100,
        montantArtisan: Math.round(data.montantTotal * (1 - COMMISSION_RATE) * 100) / 100,
        stripe: {
          paymentIntentId: data.paymentIntentId
        },
        statut: 'bloque', // Argent bloqué en escrow
        dateBlocage: Timestamp.now()
      },
      
      historiqueStatuts: [{
        statut: 'en_attente_debut',
        date: Timestamp.now(),
        auteur: data.clientId
      }]
    };

    const docRef = await addDoc(collection(db, CONTRATS_COLLECTION), contratData);
    
    console.log('✅ Contrat créé:', docRef.id);
    
    return {
      id: docRef.id,
      ...contratData
    };
  } catch (error) {
    console.error('❌ Erreur création contrat:', error);
    throw new Error('Impossible de créer le contrat');
  }
}

/**
 * Récupérer un contrat par ID
 */
export async function getContratById(contratId: string): Promise<Contrat | null> {
  try {
    const docRef = doc(db, CONTRATS_COLLECTION, contratId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    return {
      id: docSnap.id,
      ...docSnap.data()
    } as Contrat;
  } catch (error) {
    console.error('❌ Erreur récupération contrat:', error);
    throw new Error('Impossible de récupérer le contrat');
  }
}

/**
 * Récupérer contrat par devisId
 */
export async function getContratByDevisId(devisId: string): Promise<Contrat | null> {
  try {
    const q = query(
      collection(db, CONTRATS_COLLECTION),
      where('devisId', '==', devisId)
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return null;
    }
    
    const docSnap = snapshot.docs[0];
    return {
      id: docSnap.id,
      ...docSnap.data()
    } as Contrat;
  } catch (error) {
    console.error('❌ Erreur récupération contrat par devisId:', error);
    throw new Error('Impossible de récupérer le contrat');
  }
}

/**
 * Récupérer tous les contrats d'un client
 */
export async function getContratsClient(clientId: string): Promise<Contrat[]> {
  try {
    const q = query(
      collection(db, CONTRATS_COLLECTION),
      where('clientId', '==', clientId)
    );
    
    const snapshot = await getDocs(q);
    
    const contrats = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Contrat));
    
    // Tri côté client (éviter index composite)
    return contrats.sort((a, b) => {
      const dateA = a.dateCreation?.toMillis() || 0;
      const dateB = b.dateCreation?.toMillis() || 0;
      return dateB - dateA; // Plus récent d'abord
    });
  } catch (error) {
    console.error('❌ Erreur récupération contrats client:', error);
    throw new Error('Impossible de récupérer les contrats');
  }
}

/**
 * Récupérer tous les contrats d'un artisan
 */
export async function getContratsArtisan(artisanId: string): Promise<Contrat[]> {
  try {
    const q = query(
      collection(db, CONTRATS_COLLECTION),
      where('artisanId', '==', artisanId)
    );
    
    const snapshot = await getDocs(q);
    
    const contrats = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Contrat));
    
    // Tri côté client
    return contrats.sort((a, b) => {
      const dateA = a.dateCreation?.toMillis() || 0;
      const dateB = b.dateCreation?.toMillis() || 0;
      return dateB - dateA;
    });
  } catch (error) {
    console.error('❌ Erreur récupération contrats artisan:', error);
    throw new Error('Impossible de récupérer les contrats');
  }
}

/**
 * Déclarer le début des travaux (artisan)
 */
export async function declarerDebutTravaux(contratId: string, artisanId: string): Promise<void> {
  try {
    const contratRef = doc(db, CONTRATS_COLLECTION, contratId);
    const contratDoc = await getDoc(contratRef);
    
    if (!contratDoc.exists()) {
      throw new Error('Contrat non trouvé');
    }
    
    const contrat = contratDoc.data() as Contrat;
    
    // Vérifications
    if (contrat.artisanId !== artisanId) {
      throw new Error('Vous n\'êtes pas l\'artisan de ce contrat');
    }
    
    if (contrat.statut !== 'en_attente_debut') {
      throw new Error(`Impossible de démarrer les travaux (statut actuel: ${contrat.statut})`);
    }
    
    await updateDoc(contratRef, {
      statut: 'en_cours',
      dateDebut: Timestamp.now(),
      historiqueStatuts: [
        ...(contrat.historiqueStatuts || []),
        {
          statut: 'en_cours',
          date: Timestamp.now(),
          auteur: artisanId
        }
      ]
    });
    
    console.log('✅ Début travaux déclaré:', contratId);
  } catch (error) {
    console.error('❌ Erreur déclaration début travaux:', error);
    throw error;
  }
}

/**
 * Déclarer la fin des travaux (artisan)
 * Lance le délai de validation client (48h)
 */
export async function declarerFinTravaux(data: DeclareFinTravauxData): Promise<void> {
  try {
    const contratRef = doc(db, CONTRATS_COLLECTION, data.contratId);
    const contratDoc = await getDoc(contratRef);
    
    if (!contratDoc.exists()) {
      throw new Error('Contrat non trouvé');
    }
    
    const contrat = contratDoc.data() as Contrat;
    
    // Vérifications
    if (contrat.artisanId !== data.artisanId) {
      throw new Error('Vous n\'êtes pas l\'artisan de ce contrat');
    }
    
    if (contrat.statut !== 'en_cours') {
      throw new Error(`Impossible de déclarer fin travaux (statut actuel: ${contrat.statut})`);
    }
    
    await updateDoc(contratRef, {
      statut: 'travaux_termines',
      dateFinTravaux: Timestamp.now(),
      delaiValidationRestant: 48, // 48 heures pour validation client
      historiqueStatuts: [
        ...(contrat.historiqueStatuts || []),
        {
          statut: 'travaux_termines',
          date: Timestamp.now(),
          auteur: data.artisanId
        }
      ]
    });
    
    console.log('✅ Fin travaux déclarée:', data.contratId);
    
    // TODO: Envoyer notification au client
  } catch (error) {
    console.error('❌ Erreur déclaration fin travaux:', error);
    throw error;
  }
}

/**
 * Valider les travaux (client)
 * Appelle l'API backend pour libérer le paiement escrow
 */
export async function validerTravaux(data: ValiderTravauxData): Promise<void> {
  try {
    const contratRef = doc(db, CONTRATS_COLLECTION, data.contratId);
    const contratDoc = await getDoc(contratRef);
    
    if (!contratDoc.exists()) {
      throw new Error('Contrat non trouvé');
    }
    
    const contrat = contratDoc.data() as Contrat;
    
    // Vérifications
    if (contrat.clientId !== data.clientId) {
      throw new Error('Vous n\'êtes pas le client de ce contrat');
    }
    
    if (contrat.statut !== 'travaux_termines') {
      throw new Error(`Impossible de valider (statut actuel: ${contrat.statut})`);
    }
    
    // Appeler l'API backend pour libérer le paiement escrow
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/payments/release-escrow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contratId: data.contratId,
        validePar: 'client',
        commentaire: data.commentaire || '',
        note: data.note
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erreur lors de la validation');
    }
    
    const result = await response.json();
    
    console.log('✅ Travaux validés:', data.contratId, result);
    
    // TODO: Envoyer notification à l'artisan
  } catch (error) {
    console.error('❌ Erreur validation travaux:', error);
    throw error;
  }
}

/**
 * Signaler un litige (client)
 * Bloque la libération du paiement
 */
export async function signalerLitige(data: SignalerLitigeData): Promise<void> {
  try {
    const contratRef = doc(db, CONTRATS_COLLECTION, data.contratId);
    const contratDoc = await getDoc(contratRef);
    
    if (!contratDoc.exists()) {
      throw new Error('Contrat non trouvé');
    }
    
    const contrat = contratDoc.data() as Contrat;
    
    // Vérifications
    if (contrat.clientId !== data.clientId) {
      throw new Error('Vous n\'êtes pas le client de ce contrat');
    }
    
    if (!['travaux_termines', 'en_cours'].includes(contrat.statut)) {
      throw new Error(`Impossible de signaler un litige (statut actuel: ${contrat.statut})`);
    }
    
    // TODO: Upload preuves (photos/documents) vers Firebase Storage
    const preuvesUrls: string[] = [];
    
    await updateDoc(contratRef, {
      statut: 'litige',
      litige: {
        dateOuverture: Timestamp.now(),
        motif: data.motif,
        preuves: preuvesUrls,
        statutLitige: 'ouvert'
      },
      historiqueStatuts: [
        ...(contrat.historiqueStatuts || []),
        {
          statut: 'litige',
          date: Timestamp.now(),
          auteur: data.clientId
        }
      ]
    });
    
    console.log('⚠️ Litige signalé:', data.contratId);
    
    // TODO: Notification admin pour médiation
  } catch (error) {
    console.error('❌ Erreur signalement litige:', error);
    throw error;
  }
}

/**
 * Récupérer les contrats nécessitant auto-validation (> 48h depuis fin travaux)
 * Utilisé par Cloud Function autoValiderTravaux
 */
export async function getContratsAutoValidation(): Promise<Contrat[]> {
  try {
    const q = query(
      collection(db, CONTRATS_COLLECTION),
      where('statut', '==', 'travaux_termines')
    );
    
    const snapshot = await getDocs(q);
    
    const now = Date.now();
    const DELAY_48H = 48 * 60 * 60 * 1000; // 48 heures en millisecondes
    
    const contrats = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Contrat))
      .filter(contrat => {
        const dateFinTravaux = contrat.dateFinTravaux?.toMillis() || 0;
        return (now - dateFinTravaux) >= DELAY_48H;
      });
    
    return contrats;
  } catch (error) {
    console.error('❌ Erreur récupération contrats auto-validation:', error);
    throw new Error('Impossible de récupérer les contrats');
  }
}
