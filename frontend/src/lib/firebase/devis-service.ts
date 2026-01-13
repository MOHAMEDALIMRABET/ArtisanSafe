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
 * Supporte les variantes (A, B, C) pour les devis alternatifs
 * NORME BTP : Les variantes d'un même projet partagent le même numéro de base
 */
export async function genererProchainNumeroDevis(
  artisanId: string, 
  varianteLettreReference?: string,
  varianteGroupe?: string
): Promise<string> {
  const anneeEnCours = new Date().getFullYear();
  
  let numeroBase: string;
  
  // Si c'est une variante d'un groupe existant, réutiliser le numéro de base du groupe
  if (varianteGroupe) {
    const qGroupe = query(
      collection(db, COLLECTION_NAME),
      where('artisanId', '==', artisanId),
      where('varianteGroupe', '==', varianteGroupe)
    );
    
    const groupeSnapshot = await getDocs(qGroupe);
    if (!groupeSnapshot.empty) {
      // Récupérer le numéro de base du premier devis du groupe
      const premierDevisGroupe = groupeSnapshot.docs[0].data().numeroDevis as string;
      // Extraire la partie avant le tiret de variante (ex: "DV-2026-00014-A" -> "DV-2026-00014")
      numeroBase = premierDevisGroupe.split('-').slice(0, 3).join('-');
      console.log('♻️ Réutilisation numéro base groupe:', numeroBase);
    } else {
      // Groupe introuvable (cas inhabituel), générer nouveau numéro
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
      numeroBase = `DV-${anneeEnCours}-${String(dernierNumero + 1).padStart(5, '0')}`;
    }
  } else {
    // Nouveau projet : incrémenter le numéro
    const q = query(
      collection(db, COLLECTION_NAME),
      where('artisanId', '==', artisanId)
    );
    
    const querySnapshot = await getDocs(q);
    const devisAnneeEnCours = querySnapshot.docs.filter(doc => {
      const numero = doc.data().numeroDevis as string;
      return numero?.startsWith(`DV-${anneeEnCours}-`);
    });
    
    // Compter uniquement les numéros de base uniques (pas les variantes)
    const numerosBaseUniques = new Set(
      devisAnneeEnCours.map(doc => {
        const numero = doc.data().numeroDevis as string;
        // Extraire le numéro de base (DV-2026-00014)
        return numero.split('-').slice(0, 3).join('-');
      })
    );
    
    const dernierNumero = numerosBaseUniques.size;
    numeroBase = `DV-${anneeEnCours}-${String(dernierNumero + 1).padStart(5, '0')}`;
  }
  
  // Si c'est une variante, ajouter la lettre de référence
  if (varianteLettreReference) {
    return `${numeroBase}-${varianteLettreReference}`;
  }
  
  return numeroBase;
}

/**
 * Créer un nouveau devis
 */
export async function createDevis(
  devisData: CreateDevis
): Promise<Devis> {
  // ⛔ VALIDATION : Bloquer la création si un devis a déjà été refusé définitivement pour cette demande
  if (devisData.demandeId) {
    const devisExistants = await getDocs(
      query(
        collection(db, COLLECTION_NAME),
        where('demandeId', '==', devisData.demandeId),
        where('artisanId', '==', devisData.artisanId),
        where('statut', '==', 'refuse'),
        where('typeRefus', '==', 'definitif')
      )
    );

    if (!devisExistants.empty) {
      const refusDevis = devisExistants.docs[0].data();
      throw new Error(
        `⛔ Impossible de créer un nouveau devis.\n\n` +
        `Le client a refusé définitivement votre proposition (${refusDevis.numeroDevis}).\n` +
        `Motif : "${refusDevis.motifRefus || 'Non précisé'}"\n\n` +
        `Cette décision est finale. Vous ne pouvez pas renvoyer de devis pour cette demande.`
      );
    }
  }

  const devisRef = collection(db, COLLECTION_NAME);
  
  // Générer le numéro de devis (avec lettre de variante si applicable)
  const numeroDevis = await genererProchainNumeroDevis(
    devisData.artisanId,
    devisData.varianteLettreReference,
    devisData.varianteGroupe
  );
  
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
  
  // Si c'est une révision, marquer l'ancien devis comme remplacé
  if (devisData.devisOriginalId) {
    try {
      const ancienDevisRef = doc(db, COLLECTION_NAME, devisData.devisOriginalId);
      await updateDoc(ancienDevisRef, {
        statut: 'remplace' as DevisStatut,
        devisRevisionId: devisId,
        dateModification: maintenant,
      });
      console.log(`✅ Ancien devis ${devisData.devisOriginalId} marqué comme remplacé par ${devisId}`);
    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour de l\'ancien devis:', error);
      // Ne pas bloquer la création si la mise à jour échoue
    }
  }
  
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
      console.log('📋 Données artisan:', devisData.artisan);
      
      // Construire le nom de l'artisan avec fallback
      let artisanNom = 'Un artisan';
      if (devisData.artisan.prenom && devisData.artisan.nom) {
        artisanNom = `${devisData.artisan.prenom} ${devisData.artisan.nom}`;
      } else if (devisData.artisan.raisonSociale) {
        artisanNom = devisData.artisan.raisonSociale;
      }
      
      console.log('👤 Nom artisan utilisé:', artisanNom);
      
      await notifyClientDevisRecu(
        devisData.clientId,
        devisId,
        artisanNom,
        numeroDevis
      );
      console.log('✅ Notification envoyée au client:', devisData.clientId, 'pour devis:', numeroDevis);
    } catch (error) {
      console.error('❌ Erreur envoi notification client:', error);
      console.error('Stack:', error instanceof Error ? error.stack : 'Pas de stack');
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
      updateData.dateDerniereNotification = Timestamp.now(); // Notifier l'artisan
      
      // Si c'est un devis avec variantes, annuler automatiquement les autres variantes
      if (devisActuel.varianteGroupe) {
        await annulerAutresVariantes(devisId, devisActuel.varianteGroupe);
      }
    } else if (updates.statut === 'refuse') {
      updateData.dateRefus = Timestamp.now();
      updateData.dateDerniereNotification = Timestamp.now(); // Notifier l'artisan
      // Le motifRefus doit être passé dans updates si fourni
    }
  }
  
  await updateDoc(devisRef, updateData);
}

/**
 * Marquer un devis avec une notification (pour affichage badge "NOUVEAU")
 * À appeler quand un événement important se produit (acceptation, refus, etc.)
 */
export async function marquerDevisAvecNotification(devisId: string): Promise<void> {
  const devisRef = doc(db, COLLECTION_NAME, devisId);
  await updateDoc(devisRef, {
    dateDerniereNotification: Timestamp.now(),
    dateModification: Timestamp.now(),
  });
}

/**
 * Annuler toutes les autres variantes d'un groupe quand une est acceptée
 */
async function annulerAutresVariantes(
  devisAccepteId: string, 
  varianteGroupe: string
): Promise<void> {
  try {
    // Récupérer tous les devis du même groupe de variantes
    const q = query(
      collection(db, COLLECTION_NAME),
      where('varianteGroupe', '==', varianteGroupe)
    );
    
    const querySnapshot = await getDocs(q);
    const maintenant = Timestamp.now();
    
    // Annuler tous les devis sauf celui qui est accepté
    const updatePromises = querySnapshot.docs
      .filter(doc => doc.id !== devisAccepteId && doc.data().statut !== 'accepte')
      .map(doc => 
        updateDoc(doc.ref, {
          statut: 'annule' as DevisStatut,
          dateModification: maintenant,
          historiqueStatuts: [
            ...(doc.data().historiqueStatuts || []),
            {
              statut: 'annule' as DevisStatut,
              date: maintenant,
              commentaire: 'Annulé automatiquement (autre variante acceptée)',
            }
          ]
        })
      );
    
    await Promise.all(updatePromises);
    console.log(`✅ ${updatePromises.length} variante(s) alternative(s) annulée(s) automatiquement`);
  } catch (error) {
    console.error('❌ Erreur lors de l\'annulation des autres variantes:', error);
    // Ne pas bloquer l'acceptation du devis si l'annulation échoue
  }
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
 * Récupérer toutes les variantes d'un groupe de devis alternatifs
 */
export async function getVariantesDevis(varianteGroupe: string): Promise<Devis[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('varianteGroupe', '==', varianteGroupe)
  );
  
  const querySnapshot = await getDocs(q);
  const devis = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as Devis));
  
  // Trier par lettre de référence (A, B, C...)
  return devis.sort((a, b) => {
    const lettreA = a.varianteLettreReference || '';
    const lettreB = b.varianteLettreReference || '';
    return lettreA.localeCompare(lettreB);
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
