/**
 * Composant NotificationBell
 * Icône de cloche avec badge de compteur de notifications non lues
 */

'use client';

import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Notification } from '@/types/firestore';
import type { Timestamp } from 'firebase/firestore';

export default function NotificationBell() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Ne pas charger les notifications si pas d'utilisateur
  const shouldLoadNotifications = !!user?.uid;
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(
    shouldLoadNotifications ? user.uid : undefined
  );

  // Fermer le dropdown au clic extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = async (notif: Notification) => {
    // Marquer comme lue
    if (!notif.lue) {
      await markAsRead(notif.id);
    }

    // Rediriger vers le lien
    if (notif.lien) {
      router.push(notif.lien);
      setIsOpen(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'nouvelle_demande':
        return '📋';
      case 'demande_refusee':
        return '🚫';
      case 'devis_recu':
      case 'nouveau_devis':
        return '📄';
      case 'devis_accepte':
        return '✅';
      case 'devis_refuse':
        return '❌';
      case 'nouveau_message':
      case 'message':
        return '💬';
      case 'contrat_signe':
        return '📝';
      case 'paiement':
      case 'paiement_libere':
        return '💰';
      case 'avis':
      case 'nouvel_avis':
        return '⭐';
      case 'litige':
      case 'litige_ouvert':
        return '⚠️';
      case 'admin_surveillance':
        return '🚨';
      default:
        return '🔔';
    }
  };

  const formatDate = (timestamp: Timestamp | undefined) => {
    if (!timestamp) return '';
    try {
      const date = timestamp.toDate();
      return formatDistanceToNow(date, { addSuffix: true, locale: fr });
    } catch {
      return '';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bouton cloche */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-[#FF6B00] hover:text-[#E56100] transition-colors"
        aria-label="Notifications"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Badge compteur */}
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown des notifications */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[32rem] overflow-hidden">
          {/* En-tête */}
          <div className="bg-[#2C3E50] text-white px-4 py-3 flex justify-between items-center">
            <h3 className="font-semibold">
              🔔 Notifications {unreadCount > 0 && `(${unreadCount} non lues)`}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-[#FF6B00] hover:underline"
              >
                Tout marquer comme lu
              </button>
            )}
          </div>

          {/* Liste des notifications */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <svg
                  className="w-12 h-12 mx-auto mb-3 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
                <p>Aucune notification</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`relative px-4 py-3 border-b border-gray-100 cursor-pointer transition ${
                    !notif.lue 
                      ? 'bg-white hover:bg-orange-50' 
                      : 'bg-gray-50/50 hover:bg-gray-100 opacity-80'
                  }`}
                >
                  {/* Point orange pour les non lues */}
                  {!notif.lue && (
                    <span className="absolute left-2 top-5 w-2 h-2 bg-[#FF6B00] rounded-full"></span>
                  )}
                  
                  <div className="flex items-start gap-3 pl-2">
                    <span className="text-2xl flex-shrink-0">
                      {getNotificationIcon(notif.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className={`font-semibold text-sm ${
                          !notif.lue ? 'text-[#2C3E50]' : 'text-gray-600'
                        }`}>
                          {notif.titre}
                        </h4>
                      </div>
                      {notif.message && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {notif.message}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDate(notif.dateCreation)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="bg-gray-50 px-4 py-2 text-center">
              <button
                onClick={() => {
                  router.push('/notifications');
                  setIsOpen(false);
                }}
                className="text-sm text-[#FF6B00] hover:underline"
              >
                Voir toutes les notifications →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
