/**
 * Composant Header global
 * Navigation présente sur toutes les pages avec menu utilisateur
 */

'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/ui';
import UserMenu from '@/components/UserMenu';
import GuestMenu from '@/components/GuestMenu';
import { authService } from '@/lib/auth-service';
import { getUserById } from '@/lib/firebase/user-service';
import { getArtisanByUserId } from '@/lib/firebase/artisan-service';
import type { User, Artisan } from '@/types/firestore';

export default function Header() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [artisan, setArtisan] = useState<Artisan | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Pages où le header ne doit PAS s'afficher
  const hiddenRoutes = ['/admin', '/connexion'];
  const shouldHideHeader = hiddenRoutes.some(route => pathname?.startsWith(route));

  useEffect(() => {
    loadUser();

    // Écouter les changements d'authentification
    const unsubscribe = authService.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        const userData = await getUserById(firebaseUser.uid);
        setUser(userData);
        
        // Charger les données artisan si c'est un artisan
        if (userData?.role === 'artisan') {
          const artisanData = await getArtisanByUserId(firebaseUser.uid);
          setArtisan(artisanData);
        } else {
          setArtisan(null);
        }
      } else {
        setUser(null);
        setArtisan(null);
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
        
        // Charger les données artisan si c'est un artisan
        if (userData?.role === 'artisan') {
          const artisanData = await getArtisanByUserId(currentUser.uid);
          setArtisan(artisanData);
        }
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
    <nav className="no-print bg-white shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Logo 
            size="md" 
            href={user ? (user.role === 'artisan' ? '/artisan/dashboard' : '/dashboard') : '/'}
          />

          {/* Menu navigation */}
          <div className="flex items-center gap-6">
            {/* Liens de navigation (affichés uniquement pour visiteurs non connectés) */}
            {!isLoading && !user && (
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
              </>
            )}

            {/* Menu utilisateur ou invité */}
            <div className="flex items-center gap-4">
              {!isLoading && (
                <>
                  {user ? (
                    <>
                      {/* Badge Profil Vérifié pour artisans */}
                      {user.role === 'artisan' && artisan?.verified && (
                        <span className="flex items-center gap-1 text-green-600 font-medium text-sm">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Profil Vérifié
                        </span>
                      )}
                      
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
