/**
 * Composant UserMenu
 * Menu utilisateur avec photo de profil et dropdown (style BlaBlaCar)
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/lib/auth-service';
import { useNotifications } from '@/hooks/useNotifications';
import type { User } from '@/types/firestore';

interface UserMenuProps {
  user: User;
  isArtisan?: boolean;
}

export default function UserMenu({ user, isArtisan = false }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Ne charger les notifications que si l'utilisateur existe
  const shouldLoadNotifications = !!user?.uid;
  const { notifications, markTypeAsRead } = useNotifications(shouldLoadNotifications ? user.uid : undefined);

  // Compter les notifications par catégorie (non lues uniquement)
  const notifDevis = notifications.filter(
    n => !n.lue && (
      n.type === 'devis_accepte' || 
      n.type === 'devis_refuse' || 
      n.type === 'devis_recu' ||        // ✅ Pour les clients
      n.type === 'nouveau_devis' ||     // Ancien type (migration progressive)
      n.type === 'devis_revision'       // ✅ Demandes de révision
    )
  ).length;

  const notifDemandes = notifications.filter(
    n => !n.lue && (n.type === 'nouvelle_demande' || n.type === 'demande_refusee')
  ).length;

  // Nombre total de notifications non lues
  const totalNotifications = notifDevis + notifDemandes;

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

  const handleSignOut = async () => {
    // Fermer le menu immédiatement pour désinscrire les listeners
    setIsOpen(false);
    
    // Attendre un court instant pour que le composant se démonte proprement
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Déconnecter
    await authService.signOut();
    router.push('/');
  };

  const handleNavigation = (path: string) => {
    router.push(path);
    setIsOpen(false);
  };

  const handleNavigationWithMarkRead = async (path: string, notificationTypes: string[]) => {
    // Marquer les notifications du type spécifié comme lues
    await markTypeAsRead(notificationTypes);
    router.push(path);
    setIsOpen(false);
  };

  // Initiales pour l'avatar
  const initials = user.nom && user.prenom
    ? `${user.prenom[0]}${user.nom[0]}`.toUpperCase()
    : user.email[0].toUpperCase();

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bouton avatar */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity relative"
        aria-label="Menu utilisateur"
      >
        {/* Avatar avec icône utilisateur */}
        <div className="w-10 h-10 rounded-full bg-[#FF6B00] text-white flex items-center justify-center font-semibold text-sm border-2 border-[#FF6B00] shadow-md relative">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
          </svg>
          
          {/* Badge notification total */}
          {totalNotifications > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-white">
              {totalNotifications > 9 ? '9+' : totalNotifications}
            </span>
          )}
        </div>

        {/* Flèche */}
        <svg
          className={`w-4 h-4 text-gray-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
          {/* En-tête avec info utilisateur */}
          <div className="bg-gradient-to-r from-[#2C3E50] to-[#34495E] text-white px-4 py-3">
            <div className="flex items-center gap-3">
              {/* Avatar avec icône utilisateur */}
              <div className="w-12 h-12 rounded-full bg-[#FF6B00] text-white flex items-center justify-center font-bold text-lg border-2 border-white shadow-md">
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437.695z" clipRule="evenodd" />
                </svg>
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">
                  {user.prenom} {user.nom}
                </p>
                <p className="text-xs text-gray-300 truncate">
                  {user.email}
                </p>
              </div>
            </div>
          </div>

          {/* Menu items */}
          <div className="py-2">
            {/* Tableau de bord */}
            <button
              onClick={() => handleNavigation(isArtisan ? '/artisan/dashboard' : '/dashboard')}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 transition flex items-center gap-3 text-gray-700"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              <span className="font-medium">Tableau de bord</span>
            </button>

            {/* Mon profil */}
            <button
              onClick={() => handleNavigation(isArtisan ? '/artisan/profil' : '/profil')}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 transition flex items-center gap-3 text-gray-700"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span className="font-medium">Mon profil</span>
            </button>

            {/* Messages */}
            <button
              onClick={() => handleNavigation('/messages')}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 transition flex items-center gap-3 text-gray-700"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <span className="font-medium">Messages</span>
            </button>

            {/* Liens spécifiques client */}
            {!isArtisan && (
              <>
                {/* Mes Devis */}
                <button
                  onClick={() => handleNavigationWithMarkRead('/client/devis', ['devis_accepte', 'devis_refuse', 'devis_recu', 'nouveau_devis', 'devis_revision'])}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition flex items-center gap-3 text-gray-700"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span className="font-medium flex-1">Mes Devis</span>
                  {notifDevis > 0 && (
                    <span className="bg-[#FF6B00] text-white text-xs font-bold px-2 py-1 rounded-full min-w-[20px] text-center">
                      {notifDevis}
                    </span>
                  )}
                </button>

                {/* Mes Demandes */}
                <button
                  onClick={() => handleNavigationWithMarkRead('/client/demandes', ['nouvelle_demande', 'demande_refusee'])}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition flex items-center gap-3 text-gray-700"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                    />
                  </svg>
                  <span className="font-medium flex-1">Mes Demandes</span>
                  {notifDemandes > 0 && (
                    <span className="bg-[#FF6B00] text-white text-xs font-bold px-2 py-1 rounded-full min-w-[20px] text-center">
                      {notifDemandes}
                    </span>
                  )}
                </button>
              </>
            )}

            {/* Liens spécifiques artisan */}
            {isArtisan && (
              <>
                {/* Mes Devis - Mes Factures */}
                <button
                  onClick={() => handleNavigationWithMarkRead('/artisan/devis', ['devis_accepte', 'devis_refuse', 'devis_recu', 'nouveau_devis', 'devis_revision'])}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition flex items-center gap-3 text-gray-700"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span className="font-medium flex-1">Mes Devis - Mes Factures</span>
                  {notifDevis > 0 && (
                    <span className="bg-[#FF6B00] text-white text-xs font-bold px-2 py-1 rounded-full min-w-[20px] text-center">
                      {notifDevis}
                    </span>
                  )}
                </button>

                {/* Mes Demandes Clients */}
                <button
                  onClick={() => handleNavigationWithMarkRead('/artisan/demandes', ['nouvelle_demande', 'demande_refusee'])}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition flex items-center gap-3 text-gray-700"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                    />
                  </svg>
                  <span className="font-medium flex-1">Mes Demandes Clients</span>
                  {notifDemandes > 0 && (
                    <span className="bg-[#FF6B00] text-white text-xs font-bold px-2 py-1 rounded-full min-w-[20px] text-center">
                      {notifDemandes}
                    </span>
                  )}
                </button>
              </>
            )}

            <hr className="my-2 border-gray-200" />

            {/* Déconnexion */}
            <button
              onClick={handleSignOut}
              className="w-full px-4 py-3 text-left hover:bg-red-50 transition flex items-center gap-3 text-red-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span className="font-medium">Déconnexion</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
