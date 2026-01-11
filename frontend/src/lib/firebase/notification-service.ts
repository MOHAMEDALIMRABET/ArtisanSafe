import { db } from './config';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, orderBy, limit, Timestamp } from 'firebase/firestore';
import type { Notification } from '@/types/firestore';

/**
 * Crée une notification pour un utilisateur
 * @param userId ID de l'utilisateur destinataire
 * @param notificationData Données de la notification
 * @returns ID de la notification créée
 */
export async function createNotification(
  userId: string,
  notificationData: Omit<Notification, 'id' | 'userId' | 'dateCre ation' | 'lue'>
): Promise<string> {
  const notificationsRef = collection(db, 'notifications');
  const docRef = await addDoc(notificationsRef, {
    userId,
    ...notificationData,
    lue: false,
    dateCreation: Timestamp.now(),
  });

  return docRef.id;
}

/**
 * Récupère les notifications d'un utilisateur
 * @param userId ID de l'utilisateur
 * @param onlyUnread Si true, ne retourne que les non lues
 * @param maxResults Nombre max de résultats (défaut: 20)
 * @returns Liste de notifications
 */
export async function getUserNotifications(
  userId: string,
  onlyUnread: boolean = false,
  maxResults: number = 20
): Promise<Notification[]> {
  const notificationsRef = collection(db, 'notifications');
  
  let q = query(
    notificationsRef,
    where('userId', '==', userId),
    orderBy('dateCreation', 'desc'),
    limit(maxResults)
  );

  if (onlyUnread) {
    q = query(
      notificationsRef,
      where('userId', '==', userId),
      where('lue', '==', false),
      orderBy('dateCreation', 'desc'),
      limit(maxResults)
    );
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Notification[];
}

/**
 * Marque une notification comme lue
 * @param notificationId ID de la notification
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const notifRef = doc(db, 'notifications', notificationId);
  await updateDoc(notifRef, {
    lue: true,
  });
}

/**
 * Marque toutes les notifications d'un utilisateur comme lues
 * @param userId ID de l'utilisateur
 */
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  const notificationsRef = collection(db, 'notifications');
  const q = query(
    notificationsRef,
    where('userId', '==', userId),
    where('lue', '==', false)
  );

  const snapshot = await getDocs(q);
  const updates = snapshot.docs.map(doc =>
    updateDoc(doc.ref, { lue: true })
  );

  await Promise.all(updates);
}

/**
 * Marque les notifications d'un utilisateur par types comme lues
 * @param userId ID de l'utilisateur
 * @param types Types de notifications à marquer comme lues
 */
export async function markNotificationsByTypeAsRead(
  userId: string,
  types: string[]
): Promise<void> {
  const notificationsRef = collection(db, 'notifications');
  const q = query(
    notificationsRef,
    where('userId', '==', userId),
    where('lue', '==', false)
  );

  const snapshot = await getDocs(q);
  
  // Filtrer côté client pour les types spécifiques
  const updates = snapshot.docs
    .filter(doc => types.includes(doc.data().type))
    .map(doc => updateDoc(doc.ref, { lue: true }));

  await Promise.all(updates);
}

/**
 * Compte le nombre de notifications non lues
 * @param userId ID de l'utilisateur
 * @returns Nombre de notifications non lues
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const notificationsRef = collection(db, 'notifications');
  const q = query(
    notificationsRef,
    where('userId', '==', userId),
    where('lue', '==', false)
  );

  const snapshot = await getDocs(q);
  return snapshot.size;
}

/**
 * Envoie une notification à plusieurs utilisateurs
 * @param userIds Liste des IDs utilisateurs
 * @param notificationData Données communes de la notification
 */
export async function sendBulkNotifications(
  userIds: string[],
  notificationData: Omit<Notification, 'id' | 'userId' | 'dateCreation' | 'lue'>
): Promise<void> {
  const promises = userIds.map(userId =>
    createNotification(userId, notificationData)
  );

  await Promise.all(promises);
}

/**
 * Notifications spécifiques au métier
 */

// Nouvelle demande pour artisan
export async function notifyArtisanNouvelDemande(
  artisanId: string,
  demandeId: string,
  categorie: string,
  ville: string
): Promise<void> {
  await createNotification(artisanId, {
    type: 'nouvelle_demande',
    titre: `Nouvelle demande: ${categorie}`,
    message: `Un client recherche un artisan à ${ville}. Consultez la demande pour envoyer un devis.`,
    lien: `/artisan/demandes`,
  });
}

// Nouveau devis reçu pour client
export async function notifyClientNouveauDevis(
  clientId: string,
  devisId: string,
  artisanNom: string
): Promise<void> {
  await createNotification(clientId, {
    type: 'nouveau_devis',
    titre: 'Nouveau devis reçu',
    message: `${artisanNom} vous a envoyé un devis. Consultez-le maintenant.`,
    lien: `/client/devis/${devisId}`,
  });
}

// Devis accepté pour artisan
export async function notifyArtisanDevisAccepte(
  artisanId: string,
  devisId: string,
  clientNom: string,
  numeroDevis?: string
): Promise<void> {
  await createNotification(artisanId, {
    type: 'devis_accepte',
    titre: '✅ Devis accepté !',
    message: numeroDevis 
      ? `${clientNom} a accepté votre devis ${numeroDevis}. Un contrat a été généré.`
      : `${clientNom} a accepté votre devis. Un contrat a été généré.`,
    lien: `/artisan/devis/${devisId}`,
  });
}

// Devis refusé pour artisan
export async function notifyArtisanDevisRefuse(
  artisanId: string,
  devisId: string,
  clientNom: string,
  numeroDevis?: string,
  motif?: string
): Promise<void> {
  const message = numeroDevis
    ? `${clientNom} a refusé votre devis ${numeroDevis}.${motif ? ` Motif : ${motif}` : ''}`
    : `${clientNom} a refusé votre devis.${motif ? ` Motif : ${motif}` : ''}`;

  await createNotification(artisanId, {
    type: 'devis_refuse',
    titre: '❌ Devis refusé',
    message,
    lien: `/artisan/devis/${devisId}`,
  });
}

// Devis reçu pour client
export async function notifyClientDevisRecu(
  clientId: string,
  devisId: string,
  artisanNom: string,
  numeroDevis?: string
): Promise<void> {
  await createNotification(clientId, {
    type: 'devis_recu',
    titre: '📄 Nouveau devis reçu',
    message: numeroDevis
      ? `${artisanNom} vous a envoyé le devis ${numeroDevis}.`
      : `${artisanNom} vous a envoyé un nouveau devis.`,
    lien: `/client/devis/${devisId}`,
  });
}


// Contrat signé
export async function notifyContratSigne(
  userId: string,
  contratId: string,
  isArtisan: boolean
): Promise<void> {
  await createNotification(userId, {
    type: 'contrat_signe',
    titre: 'Contrat signé',
    message: isArtisan
      ? 'Le contrat a été signé. Vous pouvez commencer les travaux.'
      : 'Le contrat a été signé. Les travaux vont commencer.',
    lien: isArtisan ? '/artisan/dashboard' : '/dashboard',
  });
}

// Paiement libéré
export async function notifyPaiementLibere(
  artisanId: string,
  contratId: string,
  montant: number
): Promise<void> {
  await createNotification(artisanId, {
    type: 'paiement_libere',
    titre: '💰 Paiement libéré',
    message: `Le paiement de ${montant.toFixed(2)}€ a été libéré sur votre compte.`,
    lien: '/artisan/dashboard',
  });
}

// Nouvel avis
export async function notifyNouvelAvis(
  artisanId: string,
  avisId: string,
  note: number
): Promise<void> {
  await createNotification(artisanId, {
    type: 'nouvel_avis',
    titre: `Nouvel avis : ${note}⭐`,
    message: 'Un client a laissé un avis sur votre profil.',
    lien: '/artisan/profil',
  });
}
