/**
 * Composant Header global
 * Navigation présente sur toutes les pages avec menu utilisateur
 */

'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/ui';
import NotificationBell from '@/components/NotificationBell';
import UserMenu from '@/components/UserMenu';
import GuestMenu from '@/components/GuestMenu';
import { authService } from '@/lib/auth-service';
import { getUserById } from '@/lib/firebase/user-service';
import type { User } from '@/types/firestore';

export default function Header() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Pages où le header ne doit PAS s'afficher
  const hiddenRoutes = ['/admin', '/connexion', '/inscription'];
  const shouldHideHeader = hiddenRoutes.some(route => pathname?.startsWith(route));

  useEffect(() => {
    loadUser();

    // Écouter les changements d'authentification
    const unsubscribe = authService.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        const userData = await getUserById(firebaseUser.uid);
        setUser(userData);
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  async function loadUser() {
    try {
      const currentUser = authService.getCurrentUser();
      if (currentUser) {
        const userData = await getUserById(currentUser.uid);
        setUser(userData);
      }
    } catch (error) {
      console.error('Erreur chargement utilisateur:', error);
    } finally {
      setIsLoading(false);
    }
  }

  // Ne pas afficher le header sur certaines routes
  if (shouldHideHeader) {
    return null;
  }

  return (
    <nav className="bg-white shadow-md sticky top-0 z-40">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href={user ? (user.role === 'artisan' ? '/artisan/dashboard' : '/dashboard') : '/'}>
            <Logo size="md" />
          </Link>

          {/* Menu navigation */}
          <div className="flex items-center gap-6">
            {/* Liens de navigation (affichés pour tous) */}
            {!isLoading && (
              <>
                <Link
                  href="/inscription?role=client"
                  className="text-gray-700 hover:text-[#FF6B00] font-medium transition-colors hidden md:block"
                >
                  Je suis particulier
                </Link>
                
                <Link
                  href="/inscription?role=artisan"
                  className="text-gray-700 hover:text-[#FF6B00] font-medium transition-colors hidden md:block"
                >
                  Devenir artisan
                </Link>
                
                <Link
                  href="/comment-ca-marche"
                  className="text-gray-700 hover:text-[#FF6B00] font-medium transition-colors hidden md:block"
                >
                  Comment ça marche
                </Link>
                
                <Link
                  href="/recherche"
                  className="text-gray-700 hover:text-[#FF6B00] font-medium transition-colors"
                >
                  Trouver un artisan
                </Link>
                
                {user?.role === 'artisan' && (
                  <Link
                    href="/artisan/demandes"
                    className="text-gray-700 hover:text-[#FF6B00] font-medium transition-colors"
                  >
                    Mes demandes
                  </Link>
                )}
              </>
            )}

            {/* Menu utilisateur ou invité */}
            <div className="flex items-center gap-4">
              {!isLoading && (
                <>
                  {user ? (
                    <>
                      {/* Cloche notifications (uniquement si connecté) */}
                      <NotificationBell />
                      
                      {/* Menu utilisateur connecté */}
                      <UserMenu user={user} isArtisan={user.role === 'artisan'} />
                    </>
                  ) : (
                    <>
                      {/* Menu invité (non connecté) */}
                      <GuestMenu />
                    </>
                  )}
                </>
              )}

              {isLoading && (
                <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse"></div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
