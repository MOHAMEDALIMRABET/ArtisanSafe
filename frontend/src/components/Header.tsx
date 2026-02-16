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
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Logo 
            size="sm" 
            href={user ? (user.role === 'artisan' ? '/artisan/dashboard' : '/dashboard') : '/'}
          />

          {/* Bouton Être rappelé - juste à droite du logo */}
          {!isLoading && !user && (
            <Link href="/etre-rappele" className="ml-4">
              <button className="hidden lg:flex items-center gap-2 bg-white border-2 border-[#FF6B00] text-[#FF6B00] hover:bg-[#FF6B00] hover:text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md text-sm group">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span className="whitespace-nowrap">Être rappelé</span>
              </button>
            </Link>
          )}

          {/* Menu navigation */}
          <div className="flex items-center gap-4 ml-auto">
            {/* Navigation principale pour visiteurs non connectés */}
            {!isLoading && !user && (
              <>
                {/* Liens de navigation */}
                <nav className="hidden lg:flex items-center gap-6 mr-4">
                  <Link
                    href="/annuaire"
                    className="flex items-center gap-1 text-gray-700 hover:text-[#FF6B00] font-medium transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Nos artisans
                  </Link>
                  
                  <Link
                    href="/guides-prix"
                    className="flex items-center gap-1 text-gray-700 hover:text-[#FF6B00] font-medium transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Guide des prix
                  </Link>
                  
                  <Link
                    href="/confiance/verification-artisans"
                    className="flex items-center gap-1 text-gray-700 hover:text-[#FF6B00] font-medium transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Confiance
                  </Link>
                  
                  <Link
                    href="/comment-ca-marche"
                    className="text-gray-700 hover:text-[#FF6B00] font-medium transition-colors"
                  >
                    Comment ça marche
                  </Link>
                </nav>
                
                {/* Bouton Particulier */}
                <Link href="/inscription?role=client">
                  <button className="hidden md:flex items-center gap-2 bg-gradient-to-r from-[#2C3E50] to-[#3D5A73] hover:from-[#1A3A5C] hover:to-[#2C3E50] text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg text-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="whitespace-nowrap">Particulier</span>
                  </button>
                </Link>
                
                {/* Bouton Artisan */}
                <Link href="/inscription?role=artisan">
                  <button className="hidden md:flex items-center gap-2 bg-gradient-to-r from-[#FF6B00] to-[#E56100] hover:from-[#E56100] hover:to-[#D55000] text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg text-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span className="whitespace-nowrap">Artisan</span>
                  </button>
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
