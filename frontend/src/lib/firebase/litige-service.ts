/**
 * Service de gestion des litiges
 * 
 * Fonctionnalités :
 * - Déclaration litige par client/artisan
 * - Historique complet des actions
 * - Médiation admin
 * - Suivi statuts
 * - Notifications automatiques
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
  orderBy,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';
import {
  Litige,
  LitigeStatus,
  LitigeAction,
  LitigePieceJointe,
  LitigeActionType,
  CreateLitigeData,
  LitigeStatut,
} from '@/types/litige';
import { createNotification } from './notification-service';
import { getDevisById } from './devis-service';

/**
 * Collection Firestore
 */
const LITIGES_COLLECTION = 'litiges';

/**
 * Créer un litige
 */
export async function createLitige(data: CreateLitigeData): Promise<string> {
  try {
    // Vérifier que le devis existe et est accepté
    const devis = await getDevisById(data.devisId);
    if (!devis) {
      throw new Error('Devis introuvable');
    }
    if (devis.statut !== 'accepte') {
      throw new Error('Seuls les devis acceptés peuvent faire l\'objet d\'un litige');
    }

    // Créer le litige
    const litige: Omit<Litige, 'id'> = {
      devisId: data.devisId,
      clientId: data.clientId,
      artisanId: data.artisanId,
      declarantId: data.declarantId,
      declarantRole: data.declarantRole,
      type: data.type,
      statut: 'ouvert',
      motif: data.motif,
      description: data.description,
      montantConteste: data.montantConteste || 0,
      piecesJointes: data.piecesJointes || [],
      historique: [],
      adminAssigne: null,
      dateOuverture: serverTimestamp() as Timestamp,
      dateResolution: null,
      resolution: null,
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
    };

    const docRef = await addDoc(collection(db, LITIGES_COLLECTION), litige);

    // Créer première action d'historique
    await addLitigeAction(docRef.id, {
      type: 'creation',
      auteurId: data.declarantId,
      auteurRole: data.declarantRole,
      description: `Litige créé : ${data.motif}`,
      details: {
        type: data.type,
        montantConteste: data.montantConteste,
      },
    });

    // Mettre à jour le statut du devis
    // Note: updateDevisStatus n'existe pas, on doit utiliser updateDoc directement
    await updateDoc(doc(db, 'devis', data.devisId), {
      statut: 'en_litige' as const,
      updatedAt: serverTimestamp(),
    });

    // Notifier la partie adverse
    const recipientId = data.declarantRole === 'client' ? data.artisanId : data.clientId;
    const recipientRole = data.declarantRole === 'client' ? 'artisan' : 'client';
    
    await createNotification(recipientId, {
      type: 'litige_ouvert',
      titre: 'Litige déclaré',
      message: `Un litige a été ouvert concernant le devis #${data.devisId.slice(0, 8)}`,
      lien: `/litiges/${docRef.id}`,
    });

    // Notifier les admins
    await notifyAdminsNewLitige(docRef.id, data);

    return docRef.id;
  } catch (error) {
    console.error('Erreur lors de la création du litige:', error);
    throw error;
  }
}

/**
 * Récupérer un litige par ID
 */
export async function getLitigeById(litigeId: string): Promise<Litige | null> {
  try {
    const docSnap = await getDoc(doc(db, LITIGES_COLLECTION, litigeId));
    
    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data(),
    } as Litige;
  } catch (error) {
    console.error('Erreur lors de la récupération du litige:', error);
    throw error;
  }
}

/**
 * Récupérer litiges d'un utilisateur (client ou artisan)
 */
export async function getLitigesByUser(userId: string): Promise<Litige[]> {
  try {
    // Chercher où l'utilisateur est client OU artisan
    const qClient = query(
      collection(db, LITIGES_COLLECTION),
      where('clientId', '==', userId)
    );
    const qArtisan = query(
      collection(db, LITIGES_COLLECTION),
      where('artisanId', '==', userId)
    );

    const [clientSnap, artisanSnap] = await Promise.all([
      getDocs(qClient),
      getDocs(qArtisan),
    ]);

    const litiges: Litige[] = [];
    
    clientSnap.forEach((doc) => {
      litiges.push({ id: doc.id, ...doc.data() } as Litige);
    });
    
    artisanSnap.forEach((doc) => {
      litiges.push({ id: doc.id, ...doc.data() } as Litige);
    });

    // Dédupliquer et trier par date (plus récent d'abord)
    const uniqueLitiges = Array.from(
      new Map(litiges.map((l) => [l.id, l])).values()
    );

    return uniqueLitiges.sort((a, b) => {
      const dateA = a.dateOuverture?.toMillis() || 0;
      const dateB = b.dateOuverture?.toMillis() || 0;
      return dateB - dateA;
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des litiges:', error);
    throw error;
  }
}

/**
 * Récupérer litiges pour admin (avec filtres)
 */
export async function getAdminLitiges(filters?: {
  statut?: LitigeStatut;
  adminAssigne?: string;
}): Promise<Litige[]> {
  try {
    let q = query(collection(db, LITIGES_COLLECTION));

    if (filters?.statut) {
      q = query(q, where('statut', '==', filters.statut));
    }
    if (filters?.adminAssigne) {
      q = query(q, where('adminAssigne', '==', filters.adminAssigne));
    }

    const snapshot = await getDocs(q);
    const litiges = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Litige[];

    // Tri côté client (éviter index composite)
    return litiges.sort((a, b) => {
      const dateA = a.dateOuverture?.toMillis() || 0;
      const dateB = b.dateOuverture?.toMillis() || 0;
      return dateB - dateA;
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des litiges admin:', error);
    throw error;
  }
}

/**
 * Ajouter une action à l'historique
 */
export async function addLitigeAction(
  litigeId: string,
  actionData: {
    type: LitigeActionType;
    auteurId: string;
    auteurRole: 'client' | 'artisan' | 'admin';
    description: string;
    details?: Record<string, any>;
    piecesJointes?: LitigePieceJointe[];
  }
): Promise<void> {
  try {
    const litige = await getLitigeById(litigeId);
    if (!litige) {
      throw new Error('Litige introuvable');
    }

    // Convertir au format HistoriqueAction pour cohérence
    const action: any = {
      id: crypto.randomUUID ? crypto.randomUUID() : `action_${Date.now()}`,
      timestamp: serverTimestamp(),
      acteur: actionData.auteurId,
      acteurRole: actionData.auteurRole,
      acteurNom: '', // À enrichir plus tard si besoin
      type: actionData.type,
      description: actionData.description,
      metadata: actionData.details,
      // Garder aussi auteurId/auteurRole pour compatibilité
      auteurId: actionData.auteurId,
      auteurRole: actionData.auteurRole,
      details: actionData.details,
      piecesJointes: actionData.piecesJointes || [],
      date: serverTimestamp(),
    };

    await updateDoc(doc(db, LITIGES_COLLECTION, litigeId), {
      historique: [...litige.historique, action],
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Erreur lors de l\'ajout de l\'action:', error);
    throw error;
  }
}

/**
 * Ajouter un commentaire
 */
export async function addLitigeComment(
  litigeId: string,
  userId: string,
  userRole: 'client' | 'artisan' | 'admin',
  commentaire: string,
  piecesJointes?: LitigePieceJointe[]
): Promise<void> {
  try {
    await addLitigeAction(litigeId, {
      type: 'commentaire',
      auteurId: userId,
      auteurRole: userRole,
      description: commentaire,
      piecesJointes,
    });

    // Notifier les autres parties
    const litige = await getLitigeById(litigeId);
    if (!litige) return;

    const recipients: string[] = [];
    if (userId !== litige.clientId) recipients.push(litige.clientId);
    if (userId !== litige.artisanId) recipients.push(litige.artisanId);
    if (litige.adminAssigne && userId !== litige.adminAssigne) {
      recipients.push(litige.adminAssigne);
    }

    for (const recipientId of recipients) {
      await createNotification(recipientId, {
        type: 'litige_commentaire',
        titre: 'Nouveau commentaire sur le litige',
        message: commentaire.substring(0, 100),
        lien: `/litiges/${litigeId}`,
      });
    }
  } catch (error) {
    console.error('Erreur lors de l\'ajout du commentaire:', error);
    throw error;
  }
}

/**
 * Assigner un admin au litige
 */
export async function assignLitigeToAdmin(
  litigeId: string,
  adminId: string
): Promise<void> {
  try {
    await updateDoc(doc(db, LITIGES_COLLECTION, litigeId), {
      adminAssigne: adminId,
      statut: 'en_mediation',
      updatedAt: serverTimestamp(),
    });

    await addLitigeAction(litigeId, {
      type: 'assignation',
      auteurId: adminId,
      auteurRole: 'admin',
      description: 'Litige pris en charge par l\'équipe de médiation',
    });

    // Notifier client et artisan
    const litige = await getLitigeById(litigeId);
    if (!litige) return;

    for (const recipientId of [litige.clientId, litige.artisanId]) {
      await createNotification(recipientId, {
        type: 'litige_pris_en_charge',
        titre: 'Litige pris en charge',
        message: 'Un médiateur a été assigné à votre litige',
        lien: `/litiges/${litigeId}`,
      });
    }
  } catch (error) {
    console.error('Erreur lors de l\'assignation du litige:', error);
    throw error;
  }
}

/**
 * Proposer une résolution
 */
export async function proposeLitigeResolution(
  litigeId: string,
  adminId: string,
  proposition: string,
  montantClient?: number,
  montantArtisan?: number,
  piecesJointes?: LitigePieceJointe[]
): Promise<void> {
  try {
    await updateDoc(doc(db, LITIGES_COLLECTION, litigeId), {
      statut: 'proposition_resolution',
      updatedAt: serverTimestamp(),
    });

    await addLitigeAction(litigeId, {
      type: 'proposition_resolution',
      auteurId: adminId,
      auteurRole: 'admin',
      description: proposition,
      details: {
        montantClient,
        montantArtisan,
      },
      piecesJointes,
    });

    // Notifier client et artisan
    const litige = await getLitigeById(litigeId);
    if (!litige) return;

    for (const recipientId of [litige.clientId, litige.artisanId]) {
      await createNotification(recipientId, {
        type: 'litige_proposition',
        titre: 'Proposition de résolution',
        message: 'Le médiateur a proposé une solution pour résoudre le litige',
        lien: `/litiges/${litigeId}`,
      });
    }
  } catch (error) {
    console.error('Erreur lors de la proposition de résolution:', error);
    throw error;
  }
}

/**
 * Accepter la proposition de résolution
 */
export async function acceptLitigeResolution(
  litigeId: string,
  userId: string,
  userRole: 'client' | 'artisan'
): Promise<void> {
  try {
    const litige = await getLitigeById(litigeId);
    if (!litige) {
      throw new Error('Litige introuvable');
    }

    await addLitigeAction(litigeId, {
      type: 'acceptation_resolution',
      auteurId: userId,
      auteurRole: userRole,
      description: `${userRole === 'client' ? 'Le client' : 'L\'artisan'} a accepté la proposition de résolution`,
    });

    // Vérifier si l'autre partie a déjà accepté
    const autrePartieAccepte = litige.historique.some(
      (action) =>
        action.type === 'acceptation_resolution' &&
        action.acteurRole !== userRole
    );

    if (autrePartieAccepte) {
      // Les deux parties ont accepté → Résoudre le litige
      await resolveLitige(litigeId, 'resolu_accord');
    } else {
      // Notifier l'autre partie
      const recipientId = userRole === 'client' ? litige.artisanId : litige.clientId;
      await createNotification(recipientId, {
        type: 'litige_acceptation_partielle',
        titre: 'Acceptation de la proposition',
        message: `${userRole === 'client' ? 'Le client' : 'L\'artisan'} a accepté la proposition de résolution`,
        lien: `/litiges/${litigeId}`,
      });
    }
  } catch (error) {
    console.error('Erreur lors de l\'acceptation de la résolution:', error);
    throw error;
  }
}

/**
 * Refuser la proposition de résolution
 */
export async function rejectLitigeResolution(
  litigeId: string,
  userId: string,
  userRole: 'client' | 'artisan',
  motif: string
): Promise<void> {
  try {
    await addLitigeAction(litigeId, {
      type: 'refus_resolution',
      auteurId: userId,
      auteurRole: userRole,
      description: `${userRole === 'client' ? 'Le client' : 'L\'artisan'} a refusé la proposition`,
      details: { motif },
    });

    await updateDoc(doc(db, LITIGES_COLLECTION, litigeId), {
      statut: 'en_mediation',
      updatedAt: serverTimestamp(),
    });

    // Notifier l'admin et l'autre partie
    const litige = await getLitigeById(litigeId);
    if (!litige) return;

    const recipients = [litige.adminAssigne, userRole === 'client' ? litige.artisanId : litige.clientId].filter(Boolean) as string[];

    for (const recipientId of recipients) {
      await createNotification(recipientId, {
        type: 'litige_refus',
        titre: 'Proposition refusée',
        message: `${userRole === 'client' ? 'Le client' : 'L\'artisan'} a refusé la proposition de résolution`,
        lien: `/litiges/${litigeId}`,
      });
    }
  } catch (error) {
    console.error('Erreur lors du refus de la résolution:', error);
    throw error;
  }
}

/**
 * Résoudre un litige
 */
export async function resolveLitige(
  litigeId: string,
  statut: 'resolu_accord' | 'resolu_admin' | 'abandonne',
  resolution?: string
): Promise<void> {
  try {
    await updateDoc(doc(db, LITIGES_COLLECTION, litigeId), {
      statut,
      dateResolution: serverTimestamp(),
      resolution: resolution || null,
      updatedAt: serverTimestamp(),
    });

    await addLitigeAction(litigeId, {
      type: 'resolution',
      auteurId: 'system',
      auteurRole: 'admin',
      description: getResolutionMessage(statut),
      details: { resolution },
    });

    // Mettre à jour le statut du devis
    const litige = await getLitigeById(litigeId);
    if (!litige) return;

    await updateDoc(doc(db, 'devis', litige.devisId), {
      statut: 'termine' as const,
      updatedAt: serverTimestamp(),
    });

    // Notifier les parties
    for (const recipientId of [litige.clientId, litige.artisanId]) {
      await createNotification(recipientId, {
        type: 'litige_resolu',
        titre: 'Litige résolu',
        message: getResolutionMessage(statut),
        lien: `/litiges/${litigeId}`,
      });
    }
  } catch (error) {
    console.error('Erreur lors de la résolution du litige:', error);
    throw error;
  }
}

/**
 * Escalader un litige (niveau supérieur de médiation)
 */
export async function escalateLitige(
  litigeId: string,
  adminId: string,
  raison: string
): Promise<void> {
  try {
    await updateDoc(doc(db, LITIGES_COLLECTION, litigeId), {
      statut: 'escalade',
      updatedAt: serverTimestamp(),
    });

    await addLitigeAction(litigeId, {
      type: 'escalade',
      auteurId: adminId,
      auteurRole: 'admin',
      description: `Litige escaladé au niveau supérieur`,
      details: { raison },
    });

    // Notifier les parties
    const litige = await getLitigeById(litigeId);
    if (!litige) return;

    for (const recipientId of [litige.clientId, litige.artisanId]) {
      await createNotification(recipientId, {
        type: 'litige_escalade',
        titre: 'Litige escaladé',
        message: 'Votre litige a été transmis à un niveau supérieur de médiation',
        lien: `/litiges/${litigeId}`,
      });
    }
  } catch (error) {
    console.error('Erreur lors de l\'escalade du litige:', error);
    throw error;
  }
}

/**
 * Obtenir statistiques litiges (admin)
 */
export async function getLitigesStats(): Promise<{
  total: number;
  ouverts: number;
  enMediation: number;
  resolus: number;
  abandonnes: number;
  delaiMoyenResolution: number;
}> {
  try {
    const snapshot = await getDocs(collection(db, LITIGES_COLLECTION));
    const litiges = snapshot.docs.map((doc) => doc.data() as Litige);

    const stats = {
      total: litiges.length,
      ouverts: litiges.filter((l) => l.statut === 'ouvert').length,
      enMediation: litiges.filter((l) => l.statut === 'en_mediation').length,
      resolus: litiges.filter((l) => l.statut === 'resolu_accord' || l.statut === 'resolu_admin').length,
      abandonnes: litiges.filter((l) => l.statut === 'abandonne').length,
      delaiMoyenResolution: 0,
    };

    // Calculer délai moyen de résolution
    const litigesResolus = litiges.filter(
      (l) => (l.statut === 'resolu_accord' || l.statut === 'resolu_admin') && l.dateResolution
    );

    if (litigesResolus.length > 0) {
      const delaisTotal = litigesResolus.reduce((sum, l) => {
        const ouverture = l.dateOuverture?.toMillis() || 0;
        const resolution = l.dateResolution?.toMillis() || 0;
        return sum + (resolution - ouverture);
      }, 0);

      // Délai moyen en jours
      stats.delaiMoyenResolution = Math.round(
        delaisTotal / litigesResolus.length / (1000 * 60 * 60 * 24)
      );
    }

    return stats;
  } catch (error) {
    console.error('Erreur lors du calcul des statistiques:', error);
    throw error;
  }
}

/**
 * Helper - Notifier les admins d'un nouveau litige
 */
async function notifyAdminsNewLitige(
  litigeId: string,
  data: CreateLitigeData
): Promise<void> {
  // TODO: Récupérer liste des admins depuis Firestore
  // Pour l'instant, log console
  console.log('🚨 Nouveau litige créé:', {
    litigeId,
    type: data.type,
    declarant: data.declarantRole,
  });
}

/**
 * Helper - Message de résolution selon le statut
 */
function getResolutionMessage(statut: string): string {
  switch (statut) {
    case 'resolu_accord':
      return 'Litige résolu par accord mutuel des parties';
    case 'resolu_admin':
      return 'Litige résolu par décision administrative';
    case 'abandonne':
      return 'Litige abandonné';
    default:
      return 'Litige résolu';
  }
}
