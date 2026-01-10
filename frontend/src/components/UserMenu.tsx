/**
 * Composant UserMenu
 * Menu utilisateur avec photo de profil et dropdown (style BlaBlaCar)
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/lib/auth-service';
import type { User } from '@/types/firestore';

interface UserMenuProps {
  user: User;
  isArtisan?: boolean;
}

export default function UserMenu({ user, isArtisan = false }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

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
    await authService.signOut();
    router.push('/');
  };

  const handleNavigation = (path: string) => {
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
        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        aria-label="Menu utilisateur"
      >
        {/* Avatar avec initiales */}
        <div className="w-10 h-10 rounded-full bg-[#FF6B00] text-white flex items-center justify-center font-semibold text-sm border-2 border-[#FF6B00] shadow-md">
          {initials}
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
              {/* Avatar avec initiales */}
              <div className="w-12 h-12 rounded-full bg-[#FF6B00] text-white flex items-center justify-center font-bold text-lg border-2 border-white shadow-md">
                {initials}
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
