/**
 * Service de gestion des devis
 * CRUD operations pour la collection 'devis'
 * Modèle Qonto-style avec prévisualisation temps réel
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  increment,
} from 'firebase/firestore';
import { db } from './config';
import type { 
  Devis, 
  CreateDevis, 
  UpdateDevis,
  DevisStatut,
} from '@/types/devis';
import { notifyClientDevisRecu } from './notification-service';

const COLLECTION_NAME = 'devis';

/**
 * Génère le prochain numéro de devis pour l'artisan
 */
export async function genererProchainNumeroDevis(artisanId: string): Promise<string> {
  const anneeEnCours = new Date().getFullYear();
  
  // Récupérer tous les devis de l'artisan pour l'année en cours
  const q = query(
    collection(db, COLLECTION_NAME),
    where('artisanId', '==', artisanId)
  );
  
  const querySnapshot = await getDocs(q);
  const devisAnneeEnCours = querySnapshot.docs.filter(doc => {
    const numero = doc.data().numeroDevis as string;
    return numero?.startsWith(`DV-${anneeEnCours}-`);
  });
  
  const dernierNumero = devisAnneeEnCours.length;
  
  return `DV-${anneeEnCours}-${String(dernierNumero + 1).padStart(5, '0')}`;
}

/**
 * Créer un nouveau devis
 */
export async function createDevis(
  devisData: CreateDevis
): Promise<Devis> {
  const devisRef = collection(db, COLLECTION_NAME);
  
  // Générer le numéro de devis
  const numeroDevis = await genererProchainNumeroDevis(devisData.artisanId);
  
  const maintenant = Timestamp.now();
  
  const newDevis = {
    ...devisData,
    numeroDevis,
    statut: devisData.statut || 'brouillon' as DevisStatut,
    dateCreation: maintenant,
    dateModification: maintenant,
    historiqueStatuts: [
      {
        statut: devisData.statut || 'brouillon' as DevisStatut,
        date: maintenant,
        commentaire: 'Création du devis',
      }
    ],
  };

  const docRef = await addDoc(devisRef, newDevis);
  
  const devisId = docRef.id;
  
  // Mettre à jour le compteur devisRecus UNIQUEMENT si le devis est envoyé (pas brouillon)
  if (devisData.demandeId && newDevis.statut === 'envoye') {
    try {
      const demandeRef = doc(db, 'demandes', devisData.demandeId);
      await updateDoc(demandeRef, {
        devisRecus: increment(1)
      });
    } catch (error) {
      console.error('Erreur mise à jour compteur devisRecus:', error);
      // Ne pas bloquer la création du devis si la mise à jour échoue
    }
  }
  
  // Notifier le client si le devis est envoyé (pas un brouillon)
  if (newDevis.statut === 'envoye') {
    try {
      console.log('🔔 Tentative d\'envoi notification au client:', devisData.clientId);
      const artisanNom = `${devisData.artisan.prenom} ${devisData.artisan.nom}`;
      await notifyClientDevisRecu(
        devisData.clientId,
        devisId,
        artisanNom,
        numeroDevis
      );
      console.log('✅ Notification envoyée au client:', devisData.clientId, 'pour devis:', numeroDevis);
    } catch (error) {
      console.error('❌ Erreur envoi notification client:', error);
      // Ne pas bloquer la création si la notification échoue
    }
  }
  
  return {
    ...newDevis,
    id: devisId,
  } as Devis;
}

/**
 * Mettre à jour un devis existant
 */
export async function updateDevis(
  devisId: string,
  updates: UpdateDevis
): Promise<void> {
  const devisRef = doc(db, COLLECTION_NAME, devisId);
  
  // Récupérer le devis actuel pour vérifier le changement de statut
  const devisDoc = await getDoc(devisRef);
  const devisActuel = devisDoc.data() as Devis;
  
  const updateData: any = {
    ...updates,
    dateModification: Timestamp.now(),
  };
  
  // Si le statut change, ajouter à l'historique
  if (updates.statut) {
    updateData.historiqueStatuts = [
      ...(devisActuel.historiqueStatuts || []),
      {
        statut: updates.statut,
        date: Timestamp.now(),
        commentaire: updates.statut === 'envoye' ? 'Devis envoyé au client' :
                     updates.statut === 'accepte' ? 'Devis accepté par le client' :
                     updates.statut === 'refuse' ? 'Devis refusé par le client' :
                     updates.statut === 'expire' ? 'Devis expiré' : undefined,
      }
    ];
    
    // Ajouter la date selon le statut
    if (updates.statut === 'envoye') {
      updateData.dateEnvoi = Timestamp.now();
      
      // Incrémenter devisRecus si le devis passe de brouillon à envoyé
      if (devisActuel.statut === 'brouillon' && devisActuel.demandeId) {
        try {
          const demandeRef = doc(db, 'demandes', devisActuel.demandeId);
          await updateDoc(demandeRef, {
            devisRecus: increment(1)
          });
          console.log('✅ Compteur devisRecus incrémenté pour demande:', devisActuel.demandeId);
        } catch (error) {
          console.error('Erreur mise à jour compteur devisRecus:', error);
        }
      }
    } else if (updates.statut === 'accepte') {
      updateData.dateAcceptation = Timestamp.now();
    } else if (updates.statut === 'refuse') {
      updateData.dateRefus = Timestamp.now();
      // Le motifRefus doit être passé dans updates si fourni
    }
  }
  
  await updateDoc(devisRef, updateData);
}

/**
 * Récupérer un devis par son ID
 */
export async function getDevisById(devisId: string): Promise<Devis | null> {
  const devisRef = doc(db, COLLECTION_NAME, devisId);
  const devisDoc = await getDoc(devisRef);
  
  if (!devisDoc.exists()) {
    return null;
  }
  
  return {
    id: devisDoc.id,
    ...devisDoc.data(),
  } as Devis;
}

/**
 * Récupérer tous les devis d'un artisan
 */
export async function getDevisByArtisan(
  artisanId: string,
  statut?: DevisStatut
): Promise<Devis[]> {
  let q = query(
    collection(db, COLLECTION_NAME),
    where('artisanId', '==', artisanId)
  );
  
  if (statut) {
    q = query(q, where('statut', '==', statut));
  }
  
  const querySnapshot = await getDocs(q);
  const devis = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as Devis));
  
  // Tri côté client pour éviter index composite
  return devis.sort((a, b) => {
    const dateA = a.dateCreation?.toMillis() || 0;
    const dateB = b.dateCreation?.toMillis() || 0;
    return dateB - dateA; // Plus récent en premier
  });
}

/**
 * Récupérer tous les devis d'un client
 */
export async function getDevisByClient(
  clientId: string,
  statut?: DevisStatut
): Promise<Devis[]> {
  let q = query(
    collection(db, COLLECTION_NAME),
    where('clientId', '==', clientId)
  );
  
  if (statut) {
    q = query(q, where('statut', '==', statut));
  }
  
  const querySnapshot = await getDocs(q);
  const devis = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as Devis));
  
  // Tri côté client
  return devis.sort((a, b) => {
    const dateA = a.dateCreation?.toMillis() || 0;
    const dateB = b.dateCreation?.toMillis() || 0;
    return dateB - dateA;
  });
}

/**
 * Récupérer tous les devis associés à une demande
 */
export async function getDevisByDemande(demandeId: string): Promise<Devis[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('demandeId', '==', demandeId)
  );
  
  const querySnapshot = await getDocs(q);
  const devis = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as Devis));
  
  // Tri côté client
  return devis.sort((a, b) => {
    const dateA = a.dateCreation?.toMillis() || 0;
    const dateB = b.dateCreation?.toMillis() || 0;
    return dateB - dateA;
  });
}

/**
 * Supprimer un devis (seulement si brouillon)
 */
export async function deleteDevis(devisId: string): Promise<void> {
  const devisRef = doc(db, COLLECTION_NAME, devisId);
  const devisDoc = await getDoc(devisRef);
  
  if (!devisDoc.exists()) {
    throw new Error('Devis introuvable');
  }
  
  const devis = devisDoc.data() as Devis;
  
  if (devis.statut !== 'brouillon') {
    throw new Error('Seuls les devis brouillons peuvent être supprimés');
  }
  
  await deleteDoc(devisRef);
}

/**
 * Vérifier si un devis est expiré
 */
export function isDevisExpire(devis: Devis): boolean {
  if (devis.statut === 'accepte' || devis.statut === 'refuse') {
    return false; // Devis finalisé
  }
  
  const maintenant = new Date();
  const dateValidite = devis.dateValidite.toDate();
  
  return maintenant > dateValidite;
}

/**
 * Marquer automatiquement les devis expirés
 */
export async function marquerDevisExpires(artisanId: string): Promise<number> {
  const devisEnvoyes = await getDevisByArtisan(artisanId, 'envoye');
  let compteur = 0;
  
  for (const devis of devisEnvoyes) {
    if (isDevisExpire(devis)) {
      await updateDevis(devis.id, { statut: 'expire' });
      compteur++;
    }
  }
  
  return compteur;
}

/**
 * Dupliquer un devis existant en mode brouillon
 * Utile pour créer une nouvelle version après refus
 */
export async function dupliquerDevis(devisId: string): Promise<string> {
  const devisOriginal = await getDevisById(devisId);
  
  if (!devisOriginal) {
    throw new Error('Devis introuvable');
  }
  
  // Créer un nouveau devis basé sur l'original
  const nouveauDevis: CreateDevis = {
    demandeId: devisOriginal.demandeId,
    clientId: devisOriginal.clientId,
    artisanId: devisOriginal.artisanId,
    statut: 'brouillon',
    dateValidite: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)), // +30 jours
    client: { ...devisOriginal.client },
    artisan: { ...devisOriginal.artisan },
    titre: `${devisOriginal.titre} (Révision)`,
    description: devisOriginal.description,
    lignes: devisOriginal.lignes.map(ligne => ({ ...ligne })),
    totaux: { ...devisOriginal.totaux },
    delaiRealisation: devisOriginal.delaiRealisation,
    ...(devisOriginal.dateDebutPrevue && { dateDebutPrevue: devisOriginal.dateDebutPrevue }),
    conditions: devisOriginal.conditions,
    notes: `Révision du devis ${devisOriginal.numeroDevis}${devisOriginal.motifRefus ? ` - Motif refus précédent: ${devisOriginal.motifRefus}` : ''}`,
    numeroDevis: '', // Sera généré automatiquement
  };
  
  const devis = await createDevis(nouveauDevis);
  
  return devis.id;
}
