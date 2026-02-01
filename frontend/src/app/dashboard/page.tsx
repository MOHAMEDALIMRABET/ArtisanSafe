'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authService, resendVerificationEmail } from '@/lib/auth-service';
import { getUserById } from '@/lib/firebase/user-service';
import { getArtisanByUserId } from '@/lib/firebase/artisan-service';
import { getAvisByClientId, getContratsTerminesSansAvis } from '@/lib/firebase/avis-service';
import type { User, Avis } from '@/types/firestore';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [emailVerified, setEmailVerified] = useState(true);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [canResend, setCanResend] = useState(true);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [avisClient, setAvisClient] = useState<Avis[]>([]);
  const [contratsANoter, setContratsANoter] = useState<any[]>([]);

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

      // Vérifier le statut de l'email
      setEmailVerified(currentUser.emailVerified);

      const userData = await getUserById(currentUser.uid);
      if (!userData) {
        await authService.signOut();
        router.push('/connexion');
        return;
      }

      // Si artisan, rediriger vers le dashboard artisan
      if (userData.role === 'artisan') {
        router.push('/artisan/dashboard');
        return;
      }

      setUser(userData);      
      // Charger les avis donnés par le client (3 derniers)
      const avis = await getAvisByClientId(currentUser.uid);
      setAvisClient(avis.slice(0, 3));

      // Charger les contrats terminés sans avis
      const contratsData = await getContratsTerminesSansAvis(currentUser.uid);
      setContratsANoter(contratsData);
      setIsLoading(false);
    } catch (error) {
      console.error('Erreur chargement utilisateur:', error);
      setIsLoading(false);
    }
  }

  async function handleResendEmail() {
    if (!canResend) {
      setResendMessage(`⏳ Veuillez attendre ${cooldownSeconds}s avant de renvoyer un email.`);
      return;
    }

    setResendingEmail(true);
    setResendMessage('');
    
    try {
      await resendVerificationEmail();
      setResendMessage('✅ Email renvoyé ! Consultez votre boîte mail.');
      
      // Activer le cooldown de 60 secondes
      setCanResend(false);
      setCooldownSeconds(60);
      
      const interval = setInterval(() => {
        setCooldownSeconds(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
    } catch (error: any) {
      console.error('Erreur renvoi email:', error);
      
      // Messages d'erreur conviviaux
      if (error.code === 'auth/too-many-requests') {
        setResendMessage('⚠️ Trop de tentatives. Veuillez attendre 15 minutes avant de réessayer.');
        setCanResend(false);
        setCooldownSeconds(900); // 15 minutes
      } else if (error.message?.includes('déjà vérifié')) {
        setResendMessage('✅ Votre email est déjà vérifié ! Rafraîchissez la page.');
      } else {
        setResendMessage('❌ Erreur : Veuillez réessayer dans quelques instants.');
      }
    } finally {
      setResendingEmail(false);
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
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Bannière email non vérifié (Client) */}
        {!emailVerified && (
          <div className="mb-6 bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <h3 className="font-bold text-blue-800 mb-1">
                  📧 Validez votre email pour débloquer toutes les fonctionnalités
                </h3>
                <p className="text-blue-700 text-sm mb-3">
                  Certaines fonctionnalités sont limitées jusqu'à validation de votre email (signature de contrat, paiement sécurisé).
                </p>
                <div className="flex flex-wrap gap-2 items-center">
                  <button
                    onClick={handleResendEmail}
                    disabled={resendingEmail || !canResend}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition"
                  >
                    {resendingEmail ? 'Envoi...' : !canResend && cooldownSeconds > 0 ? `Attendre ${cooldownSeconds}s` : 'Renvoyer l\'email'}
                  </button>
                  {resendMessage && (
                    <span className="text-sm font-medium">{resendMessage}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* En-tête */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h1 className="text-3xl font-bold text-[#2C3E50] mb-3">
            Tableau de bord Client
          </h1>
          <div className="flex items-center gap-2 text-lg">
            <span className="text-2xl">👋</span>
            <p className="text-gray-700">
              Bienvenue <span className="font-semibold text-[#FF6B00]">{user?.prenom} {user?.nom}</span>
            </p>
          </div>
        </div>

        {/* Dashboard Artisan */}
        {user?.role === 'artisan' && (
          <div className="grid md:grid-cols-2 gap-6">
            <Link href="/artisan/profil">
              <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-[#FF6B00]">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-[#FF6B00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">Mon Profil</h2>
                    <p className="text-sm text-gray-600">SIRET, métiers, zones</p>
                  </div>
                </div>
              </div>
            </Link>

            <div className="bg-gray-100 rounded-lg shadow-md p-6 opacity-50">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Agenda</h2>
                  <p className="text-sm text-gray-600">À venir</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-100 rounded-lg shadow-md p-6 opacity-50">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Demandes</h2>
                  <p className="text-sm text-gray-600">À venir</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-100 rounded-lg shadow-md p-6 opacity-50">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Devis</h2>
                  <p className="text-sm text-gray-600">À venir</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Client */}
        {user?.role === 'client' && (
          <>
            <div className="grid md:grid-cols-2 gap-6">
              <Link href="/recherche">
                <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-[#FF6B00]">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-[#FF6B00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-800">Rechercher un artisan</h2>
                      <p className="text-sm text-gray-600">Trouver le bon professionnel</p>
                    </div>
                  </div>
                </div>
              </Link>

              <Link href="/client/demandes">
                <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-[#FF6B00]">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-800">Mes demandes</h2>
                      <p className="text-sm text-gray-600">Suivre vos demandes de devis</p>
                    </div>
                  </div>
                </div>
              </Link>

              <Link href="/client/devis">
                <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-[#FF6B00]">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-[#FF6B00] bg-opacity-10 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-[#FF6B00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-800">Mes devis</h2>
                      <p className="text-sm text-gray-600">Consulter vos devis reçus</p>
                    </div>
                  </div>
                </div>
              </Link>
            </div>

            {/* Section Avis */}
          <div className="mt-8 bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-yellow-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Avis</h3>
                  <p className="text-sm text-gray-600">
                    {avisClient.length > 0 ? (
                      <>{avisClient.length} avis donné{avisClient.length > 1 ? 's' : ''}</>
                    ) : (
                      'Aucun avis pour le moment'
                    )}
                    {contratsANoter.length > 0 && (
                      <span className="ml-2 text-[#FF6B00] font-semibold">
                        • {contratsANoter.length} à noter
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <Link
                href="/client/avis"
                className="text-[#FF6B00] hover:underline text-sm font-medium flex items-center gap-1"
              >
                Voir tout
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            {/* Invitation à noter */}
            {contratsANoter.length > 0 && (
              <div className="mb-6 bg-orange-50 border-l-4 border-[#FF6B00] rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-[#FF6B00] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-800 mb-1">
                      {contratsANoter.length} intervention{contratsANoter.length > 1 ? 's' : ''} à noter
                    </h4>
                    <p className="text-sm text-gray-700 mb-3">
                      Partagez votre expérience pour aider les autres clients à choisir le bon artisan.
                    </p>
                    <Link
                      href="/client/avis?tab=donner-avis"
                      className="inline-flex items-center gap-2 bg-[#FF6B00] text-white px-4 py-2 rounded-lg hover:bg-[#E56100] text-sm font-medium"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                      Donner mon avis
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Liste des avis récents */}
            {avisClient.length === 0 && contratsANoter.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                <p className="text-gray-500 text-sm">
                  Aucun avis donné pour le moment. <br />
                  Vos avis apparaîtront ici après avoir noté des artisans.
                </p>
              </div>
            ) : avisClient.length > 0 && (
              <div className="space-y-4">
                {avisClient.map((avis) => (
                  <div key={avis.id} className="border border-gray-200 rounded-lg p-4 hover:border-[#FF6B00] transition">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <svg
                            key={star}
                            className={`w-5 h-5 ${star <= avis.note ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
                            viewBox="0 0 24 24"
                          >
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        ))}
                      </div>
                      <span className="text-xs text-gray-500">
                        {avis.dateCreation && new Intl.DateTimeFormat('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        }).format(avis.dateCreation.toDate())}
                      </span>
                    </div>
                    
                    {avis.points_forts && avis.points_forts.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {avis.points_forts.map((point, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            {point}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    <p className="text-sm text-gray-700 italic line-clamp-2 mb-2">
                      "{avis.commentaire}"
                    </p>
                    
                    {avis.reponseArtisan && (
                      <div className="bg-blue-50 border-l-2 border-blue-400 pl-3 py-2 mt-2">
                        <p className="text-xs text-blue-700 font-semibold mb-1">Réponse de l'artisan :</p>
                        <p className="text-xs text-gray-700 line-clamp-2">{avis.reponseArtisan.message}</p>
                      </div>
                    )}
                  </div>
                ))}
                
                {avisClient.length >= 3 && (
                  <div className="text-center pt-2">
                    <Link
                      href="/client/avis"
                      className="inline-flex items-center gap-2 text-[#FF6B00] hover:underline text-sm font-medium"
                    >
                      Voir tous mes avis
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </Link>
                  </div>
                )}
              </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
