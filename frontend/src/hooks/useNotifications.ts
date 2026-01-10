/**
 * Hook personnalisé pour gérer les notifications utilisateur
 * Récupère les notifications en temps réel depuis Firestore
 */

import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { markNotificationAsRead, markAllNotificationsAsRead } from '@/lib/firebase/notification-service';
import type { Notification } from '@/types/firestore';

export function useNotifications(userId: string | undefined, maxResults: number = 20) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Écoute en temps réel des notifications
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('userId', '==', userId),
      orderBy('dateCreation', 'desc'),
      limit(maxResults)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notifsList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Notification[];

        setNotifications(notifsList);
        setUnreadCount(notifsList.filter(n => !n.lue).length);
        setLoading(false);
      },
      (error) => {
        console.error('Erreur écoute notifications:', error);
        setLoading(false);
      }
    );

    // Nettoyage à la désinscription
    return () => unsubscribe();
  }, [userId, maxResults]);

  const markAsRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);
    } catch (error) {
      console.error('Erreur marquage notification lue:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!userId) return;
    try {
      await markAllNotificationsAsRead(userId);
    } catch (error) {
      console.error('Erreur marquage toutes lues:', error);
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
  };
}
