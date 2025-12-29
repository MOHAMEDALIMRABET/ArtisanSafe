'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authService } from '@/lib/auth-service';
import { getUserById } from '@/lib/firebase/user-service';
import { getArtisanByUserId } from '@/lib/firebase/artisan-service';
import { Logo } from '@/components/ui';
import type { User, Artisan } from '@/types/firestore';

export default function ArtisanDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [artisan, setArtisan] = useState<Artisan | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  async function loadUserData() {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        router.push('/connexion');
        return;
      }

      const userData = await getUserById(currentUser.uid);
      if (!userData) {
        await authService.signOut();
        router.push('/connexion');
        return;
      }

      // Vérifier que c'est bien un artisan
      if (userData.role !== 'artisan') {
        router.push('/dashboard');
        return;
      }

      setUser(userData);

      // Charger les données artisan
      const artisanData = await getArtisanByUserId(currentUser.uid);
      if (artisanData) {
        setArtisan(artisanData);
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Erreur chargement utilisateur:', error);
      setIsLoading(false);
    }
  }

  async function handleSignOut() {
    await authService.signOut();
    router.push('/');
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B00] mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      {/* Navigation */}
      <nav className="bg-white shadow-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Logo size="md" />
            
            <button
              onClick={handleSignOut}
              className="text-gray-600 hover:text-gray-800 font-medium"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* En-tête */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#2C3E50] mb-2">
            Tableau de bord Artisan
          </h1>
          <p className="text-gray-600">
            Bienvenue {user?.prenom} {user?.nom}
            {artisan?.badgeVerifie && (
              <span className="ml-2 inline-flex items-center gap-1 text-green-600 text-sm font-medium">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Vérifié
              </span>
            )}
          </p>
        </div>

        {/* Dashboard Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Profil */}
          <Link href="/artisan/profil">
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-[#FF6B00]">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-[#FF6B00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-gray-800">Mon Profil</h2>
                    {!artisan?.verified && (
                      <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full font-medium">
                        En attente de vérification
                      </span>
                    )}
                    {artisan?.verified && (
                      <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full font-medium flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/>
                        </svg>
                        Vérifié
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">SIRET, métiers, zones</p>
                </div>
              </div>
              {artisan && (
                <div className="text-sm text-gray-500">
                  <p>📍 {artisan.zonesIntervention?.length || 0} zones d'intervention</p>
                  <p>🔧 {artisan.metiers?.length || 0} métier(s)</p>
                </div>
              )}
            </div>
          </Link>

          {/* Agenda */}
          <Link href="/artisan/agenda">
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-[#FF6B00]">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Mon Agenda</h2>
                  <p className="text-sm text-gray-600">Disponibilités & créneaux</p>
                </div>
              </div>
              {artisan && (
                <div className="text-sm text-gray-500">
                  <p>📅 {artisan.disponibilites?.length || 0} créneau(x) défini(s)</p>
                  <p className="text-green-600 font-medium mt-1">✨ Nouveau !</p>
                </div>
              )}
            </div>
          </Link>

          {/* Vérification du Profil */}
          {!artisan?.verified && (
            <Link href="/artisan/verification">
              <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 border-orange-200 hover:border-[#FF6B00]">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center animate-pulse">
                    <svg className="w-6 h-6 text-[#FF6B00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-xl font-bold text-gray-800">Vérification Profil</h2>
                      <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full font-bold animate-bounce">
                        Action requise
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">Complétez votre vérification pour débloquer toutes les fonctionnalités</p>
                  </div>
                </div>
                <div className="bg-white bg-opacity-70 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className={artisan?.siretVerified ? "text-green-600" : "text-orange-600"}>
                      {artisan?.siretVerified ? "✅" : "⏳"}
                    </span>
                    <span className="text-gray-700">Vérification SIRET</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className={artisan?.contactVerification?.email?.verified ? "text-green-600" : "text-orange-600"}>
                      {artisan?.contactVerification?.email?.verified ? "✅" : "⏳"}
                    </span>
                    <span className="text-gray-700">Validation email</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className={artisan?.contactVerification?.telephone?.verified ? "text-green-600" : "text-orange-600"}>
                      {artisan?.contactVerification?.telephone?.verified ? "✅" : "⏳"}
                    </span>
                    <span className="text-gray-700">Validation téléphone</span>
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* Demandes */}
          <div className="bg-gray-100 rounded-lg shadow-md p-6 opacity-50">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Demandes Clients</h2>
                <p className="text-sm text-gray-600">À venir</p>
              </div>
            </div>
          </div>

          {/* Devis */}
          <div className="bg-gray-100 rounded-lg shadow-md p-6 opacity-50">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Mes Devis</h2>
                <p className="text-sm text-gray-600">À venir</p>
              </div>
            </div>
          </div>
        </div>

        {/* Statistiques (Section future) */}
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Aperçu rapide</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-[#FF6B00]">0</div>
              <div className="text-sm text-gray-600">Demandes en attente</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">0</div>
              <div className="text-sm text-gray-600">Devis envoyés</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">0</div>
              <div className="text-sm text-gray-600">Projets terminés</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600">-</div>
              <div className="text-sm text-gray-600">Note moyenne</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
