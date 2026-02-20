'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authService, resendVerificationEmail } from '@/lib/auth-service';
import { getUserById } from '@/lib/firebase/user-service';
import { getArtisanByUserId } from '@/lib/firebase/artisan-service';
import { getDemandesForArtisan } from '@/lib/firebase/demande-service';
import { getAvisByArtisanId, calculateAverageRating } from '@/lib/firebase/avis-service';
import { useNotifications } from '@/hooks/useNotifications';
import { artisanDoitDecennale } from '@/lib/decennale-helper';
import { db } from '@/lib/firebase/config';
import { collection, query, where, or, onSnapshot } from 'firebase/firestore';
import type { User, Artisan, Avis } from '@/types/firestore';

export default function ArtisanDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [artisan, setArtisan] = useState<Artisan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [emailVerified, setEmailVerified] = useState(true);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [canResend, setCanResend] = useState(true);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [nouvellesDemandes, setNouvellesDemandes] = useState(0);
  const [avisRecents, setAvisRecents] = useState<Avis[]>([]);
  const [statsAvis, setStatsAvis] = useState({ moyenne: 0, total: 0 });
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  // Hook pour les notifications
  const { notifications, unreadCount } = useNotifications(user?.uid);

  // Compter les notifications de devis acceptés/refusés NON LUES
  const devisNotifications = notifications.filter(
    n => (n.type === 'devis_accepte' || n.type === 'devis_refuse') && !n.lue
  ).length;

  // Calculer si le profil est complètement vérifié (SANS la décennale)
  // La décennale est un document additionnel qui ne bloque pas l'accès au profil
  const isFullyVerified = 
    artisan?.siretVerified && 
    artisan?.verificationDocuments?.kbis?.verified && 
    artisan?.verificationDocuments?.idCard?.verified && 
    artisan?.verificationDocuments?.rcPro?.verified;

  useEffect(() => {
    loadUserData();
  }, []);

  // Compter les messages non lus en temps réel
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, 'conversations'),
      or(where('participants', 'array-contains', user.uid))
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let totalUnread = 0;
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const unreadForUser = data.unreadCount?.[user.uid] || 0;
        totalUnread += unreadForUser;
      });
      setUnreadMessagesCount(totalUnread);
    });

    return () => unsubscribe();
  }, [user?.uid]);

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

      // Vérifier que c'est bien un artisan
      if (userData.role !== 'artisan') {
        router.push('/dashboard');
        return;
      }

      setUser(userData);

      // Charger depuis le cache d'abord
      const cachedData = localStorage.getItem(`artisan_${currentUser.uid}`);
      if (cachedData) {
        try {
          const cached = JSON.parse(cachedData);
          setArtisan(cached);
          setIsLoading(false); // Afficher immédiatement
        } catch (e) {
          console.warn('Cache invalide');
        }
      }

      // Charger les données artisan depuis Firestore
      const artisanData = await getArtisanByUserId(currentUser.uid);
      if (artisanData) {
        setArtisan(artisanData);
        // Mettre à jour le cache
        localStorage.setItem(`artisan_${currentUser.uid}`, JSON.stringify(artisanData));
      }

      // Charger les demandes pour compter les nouvelles
      try {
        const demandes = await getDemandesForArtisan(currentUser.uid);
        // Compter seulement les demandes nouvelles (publiées ET sans devis envoyé)
        const nouvellesCount = demandes.filter(d => 
          d.statut === 'publiee' && (!d.devisRecus || d.devisRecus === 0)
        ).length;
        setNouvellesDemandes(nouvellesCount);
      } catch (error) {
        console.error('Erreur chargement demandes:', error);
      }

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
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B00] mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Bannière email non vérifié (Artisan - OBLIGATOIRE) */}
        {!emailVerified && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <h3 className="font-bold text-red-800 mb-1">
                  ⚠️ Validation de votre email OBLIGATOIRE
                </h3>
                <p className="text-red-700 text-sm mb-3">
                  <strong>Votre profil est invisible</strong> tant que votre email n'est pas validé. Les clients ne peuvent pas vous trouver.
                  Consultez votre boîte mail et cliquez sur le lien de validation.
                </p>
                <p className="text-red-600 text-sm mb-3 bg-red-50 p-2 rounded border-l-4 border-red-400">
                  📧 <strong>Astuce :</strong> Vérifiez aussi votre dossier <strong>Spam/Courrier indésirable</strong> si vous ne trouvez pas l'email dans votre boîte de réception.
                </p>
                <div className="flex flex-wrap gap-2 items-center">
                  <button
                    onClick={handleResendEmail}
                    disabled={resendingEmail || !canResend}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed transition"
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
            Tableau de bord Artisan
          </h1>
          <div className="flex items-center gap-2 text-lg">
            <span className="text-2xl">👋</span>
            <p className="text-gray-700">
              Bienvenue <span className="font-semibold text-[#FF6B00]">{user?.prenom} {user?.nom}</span>
              {artisan?.verified && (
                <span className="ml-2 inline-flex items-center gap-1 text-green-600 text-sm font-medium">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Vérifié
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Alerte : Profil invisible car décennale manquante */}
        {artisan?.metiers && artisanDoitDecennale(artisan.metiers) && !artisan?.verificationDocuments?.decennale?.verified && (
          <div className="mb-6 bg-orange-50 border-l-4 border-[#FF6B00] rounded-lg p-5 shadow-md">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <span className="text-3xl">🔒</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-[#FF6B00] mb-2">
                  🚫 Votre profil n'est PAS VISIBLE dans les recherches
                </h3>
                <p className="text-sm text-gray-700 mb-3">
                  Vos métiers (<strong>{artisan.metiers.join(', ')}</strong>) nécessitent une <strong>garantie décennale obligatoire</strong>. 
                  Tant que ce document n'est pas validé par notre équipe, <strong>votre profil reste invisible</strong> pour les clients.
                </p>
                
                {!artisan?.verificationDocuments?.decennale?.url ? (
                  <div className="bg-white rounded-lg p-3 mb-3">
                    <p className="text-sm font-semibold text-red-700 mb-1">
                      ❌ Attestation décennale non uploadée
                    </p>
                    <p className="text-xs text-gray-600">
                      Vous devez uploader votre attestation de garantie décennale pour que votre profil soit activé.
                    </p>
                  </div>
                ) : artisan?.verificationDocuments?.decennale?.rejected ? (
                  <div className="bg-white rounded-lg p-3 mb-3">
                    <p className="text-sm font-semibold text-red-700 mb-1">
                      ❌ Attestation décennale rejetée
                    </p>
                    <p className="text-xs text-gray-600">
                      <strong>Raison :</strong> {artisan.verificationDocuments.decennale.rejectionReason || 'Non spécifiée'}
                    </p>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg p-3 mb-3">
                    <p className="text-sm font-semibold text-purple-700 mb-1">
                      ⏳ Attestation décennale en cours de vérification
                    </p>
                    <p className="text-xs text-gray-600">
                      Notre équipe examine votre document. Vous serez visible dès validation (sous 24-48h).
                    </p>
                  </div>
                )}

                <button
                  onClick={() => router.push('/artisan/documents')}
                  className="bg-[#FF6B00] hover:bg-[#E56100] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                  {!artisan?.verificationDocuments?.decennale?.url || artisan?.verificationDocuments?.decennale?.rejected 
                    ? '📤 Uploader ma garantie décennale' 
                    : '📄 Voir mes documents'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Alerte : Documents rejetés */}
        {(artisan?.verificationDocuments?.kbis?.rejected || artisan?.verificationDocuments?.idCard?.rejected) && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 rounded-lg p-5 shadow-md">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-red-800 mb-2">
                  ⚠️ Document(s) rejeté(s) - Action requise
                </h3>
                {artisan?.verificationDocuments?.kbis?.rejected && (
                  <div className="mb-3 bg-white bg-opacity-60 rounded p-3">
                    <p className="text-sm font-semibold text-red-700">
                      📄 KBIS rejeté
                    </p>
                    <p className="text-sm text-red-600 mt-1">
                      <strong>Raison :</strong> {artisan.verificationDocuments.kbis.rejectionReason || 'Non spécifiée'}
                    </p>
                  </div>
                )}
                {artisan?.verificationDocuments?.idCard?.rejected && (
                  <div className="mb-3 bg-white bg-opacity-60 rounded p-3">
                    <p className="text-sm font-semibold text-red-700">
                      🆔 Pièce d'identité rejetée
                    </p>
                    <p className="text-sm text-red-600 mt-1">
                      <strong>Raison :</strong> {artisan.verificationDocuments.idCard.rejectionReason || 'Non spécifiée'}
                    </p>
                  </div>
                )}
                <button
                  onClick={() => router.push('/artisan/documents')}
                  className="mt-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                  📤 Uploader un nouveau document
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Vérification du Profil - Position 1 */}
          {!isFullyVerified && (
            <Link href="/artisan/verification" prefetch={false}>
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
                    <span className="text-gray-700">SIRET de l'entreprise</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-green-600">
                      ✅
                    </span>
                    <span className="text-gray-700">Validation téléphone</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className={
                      artisan?.verificationDocuments?.kbis?.verified 
                        ? "text-green-600" 
                        : artisan?.verificationDocuments?.kbis?.rejected 
                          ? "text-red-600" 
                          : "text-orange-600"
                    }>
                      {artisan?.verificationDocuments?.kbis?.verified 
                        ? "✅" 
                        : artisan?.verificationDocuments?.kbis?.rejected 
                          ? "❌" 
                          : "⏳"}
                    </span>
                    <span className="text-gray-700">
                      Vérification KBIS {artisan?.verificationDocuments?.kbis?.rejected ? "rejeté" : "vérifié"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className={
                      artisan?.verificationDocuments?.idCard?.verified 
                        ? "text-green-600" 
                        : artisan?.verificationDocuments?.idCard?.rejected 
                          ? "text-red-600" 
                          : "text-orange-600"
                    }>
                      {artisan?.verificationDocuments?.idCard?.verified 
                        ? "✅" 
                        : artisan?.verificationDocuments?.idCard?.rejected 
                          ? "❌" 
                          : "⏳"}
                    </span>
                    <span className="text-gray-700">
                      Vérification pièce d'identité {artisan?.verificationDocuments?.idCard?.rejected ? "rejetée" : "vérifiée"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className={
                      artisan?.verificationDocuments?.rcPro?.verified 
                        ? "text-green-600" 
                        : artisan?.verificationDocuments?.rcPro?.rejected 
                          ? "text-red-600" 
                          : "text-orange-600"
                    }>
                      {artisan?.verificationDocuments?.rcPro?.verified 
                        ? "✅" 
                        : artisan?.verificationDocuments?.rcPro?.rejected 
                          ? "❌" 
                          : "⏳"}
                    </span>
                    <span className="text-gray-700">
                      Vérification assurance resp civile Pro {artisan?.verificationDocuments?.rcPro?.rejected ? "rejetée" : "vérifiée"}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* Profil - Position 2 */}
          {isFullyVerified ? (
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
                      <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full font-medium flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/>
                        </svg>
                        Vérifié
                      </span>
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
          ) : (
            <div className="bg-gray-100 rounded-lg shadow-md p-6 border-2 border-gray-300 opacity-60 cursor-not-allowed">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-gray-500">Mon Profil</h2>
                    <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full font-medium">
                      🔒 Bloqué
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">Débloqué après vérification</p>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                Pour compléter votre profil, vous devez d'abord vérifier votre identité (SIRET, téléphone) et uploader le KBIS, la pièce d'identité et responsabilité civile professionnelle dans "Mes Documents".
              </div>
            </div>
          )}

          {/* Agenda - Position 3 */}
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

          {/* Documents KBIS et Pièce d'identité - Position 4 */}
          <Link href="/artisan/documents">
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-[#FF6B00]">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-gray-800">Mes Documents</h2>
                    {(() => {
                      const kbisVerified = artisan?.verificationDocuments?.kbis?.verified === true;
                      const idVerified = artisan?.verificationDocuments?.idCard?.verified === true;
                      const rcProVerified = artisan?.verificationDocuments?.rcPro?.verified === true;
                      const decennaleVerified = artisan?.verificationDocuments?.decennale?.verified === true;
                      const kbisUploaded = !!artisan?.verificationDocuments?.kbis?.url;
                      const idUploaded = !!artisan?.verificationDocuments?.idCard?.url;
                      const rcProUploaded = !!artisan?.verificationDocuments?.rcPro?.url;
                      const decennaleUploaded = !!artisan?.verificationDocuments?.decennale?.url;
                      const kbisRejected = artisan?.verificationDocuments?.kbis?.rejected === true;
                      const idRejected = artisan?.verificationDocuments?.idCard?.rejected === true;
                      const rcProRejected = artisan?.verificationDocuments?.rcPro?.rejected === true;
                      const decennaleRejected = artisan?.verificationDocuments?.decennale?.rejected === true;
                      
                      // Vérifier si la décennale est requise
                      const needsDecennale = artisan?.metiers && artisanDoitDecennale(artisan.metiers);
                      
                      // Tous vérifiés (incluant décennale si requise) : pas de badge
                      const allVerified = kbisVerified && idVerified && rcProVerified && (!needsDecennale || decennaleVerified);
                      if (allVerified) {
                        return null;
                      }
                      
                      // Au moins un document rejeté : badge "À compléter"
                      const hasRejected = kbisRejected || idRejected || rcProRejected || (needsDecennale && decennaleRejected);
                      if (hasRejected) {
                        return (
                          <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full font-medium">
                            À compléter
                          </span>
                        );
                      }
                      
                      // Au moins un document uploadé et en attente de vérification : badge "En cours de vérification"
                      const kbisEnCours = kbisUploaded && !kbisVerified && !kbisRejected;
                      const idEnCours = idUploaded && !idVerified && !idRejected;
                      const rcProEnCours = rcProUploaded && !rcProVerified && !rcProRejected;
                      const decennaleEnCours = needsDecennale && decennaleUploaded && !decennaleVerified && !decennaleRejected;
                      
                      if (kbisEnCours || idEnCours || rcProEnCours || decennaleEnCours) {
                        return (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                            En cours de vérification
                          </span>
                        );
                      }
                      
                      // Sinon : badge "À compléter"
                      return (
                        <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full font-medium">
                          À compléter
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-sm text-gray-600">
                    KBIS, Pièce d'identité, RC Pro{artisan?.metiers && artisanDoitDecennale(artisan.metiers) ? ' & Garantie Décennale' : ''}
                  </p>
                </div>
              </div>
                {artisan && (
                  <div className="text-sm space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={artisan.verificationDocuments?.kbis?.verified ? "text-green-600" : "text-orange-600"}>
                        {artisan.verificationDocuments?.kbis?.verified ? "✅" : "📄"}
                      </span>
                      <span className="text-gray-700">
                        KBIS {artisan.verificationDocuments?.kbis?.verified ? "vérifié" : "requis"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={artisan.verificationDocuments?.idCard?.verified ? "text-green-600" : "text-orange-600"}>
                        {artisan.verificationDocuments?.idCard?.verified ? "✅" : "🪪"}
                      </span>
                      <span className="text-gray-700">
                        Pièce d'identité {artisan.verificationDocuments?.idCard?.verified ? "vérifiée" : "requise"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={artisan.verificationDocuments?.rcPro?.verified ? "text-green-600" : "text-orange-600"}>
                        {artisan.verificationDocuments?.rcPro?.verified ? "✅" : "🛡️"}
                      </span>
                      <span className="text-gray-700">
                        Responsabilité Civile Pro {artisan.verificationDocuments?.rcPro?.verified ? "vérifiée" : "requise"}
                      </span>
                    </div>
                    {/* Décennale conditionnelle */}
                    {artisan.metiers && artisanDoitDecennale(artisan.metiers) && (
                      <div className="flex items-center gap-2">
                        <span className={artisan.verificationDocuments?.decennale?.verified ? "text-green-600" : "text-orange-600"}>
                          {artisan.verificationDocuments?.decennale?.verified ? "✅" : "🏗️"}
                        </span>
                        <span className="text-gray-700">
                          Garantie Décennale {artisan.verificationDocuments?.decennale?.verified ? "vérifiée" : "requise"}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Link>

          {/* Demandes */}
          <Link href="/artisan/demandes">
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-[#FF6B00] relative">
              {/* Badge notification */}
              {nouvellesDemandes > 0 && (
                <div className="absolute -top-2 -right-2 bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-lg animate-pulse">
                  {nouvellesDemandes}
                </div>
              )}
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-gray-800">Demandes Clients</h2>
                    {nouvellesDemandes > 0 && (
                      <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-bold">
                        {nouvellesDemandes} nouvelle{nouvellesDemandes > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">Nouvelles demandes de devis</p>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                {nouvellesDemandes > 0 ? (
                  <p className="text-green-600 font-medium">🔔 {nouvellesDemandes} demande{nouvellesDemandes > 1 ? 's' : ''} en attente</p>
                ) : (
                  <p className="text-gray-500">📬 Aucune nouvelle demande</p>
                )}
              </div>
            </div>
          </Link>

          {/* Devis */}
          <Link href="/artisan/devis">
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-[#FF6B00]">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center relative">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {devisNotifications > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[#FF6B00] text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {devisNotifications}
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-gray-800">Mes Devis</h2>
                    {devisNotifications > 0 && (
                      <span className="bg-[#FF6B00] text-white text-xs px-2 py-1 rounded-full font-semibold">
                        {devisNotifications} nouvelle(s)
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">Gérer vos devis</p>
                </div>
              </div>
            </div>
          </Link>

          {/* Messages */}
          <Link href="/messages">
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-[#FF6B00] relative">
              {/* Badge notification */}
              {unreadMessagesCount > 0 && (
                <div className="absolute -top-2 -right-2 bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-lg animate-pulse">
                  {unreadMessagesCount}
                </div>
              )}
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center relative">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  {unreadMessagesCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {unreadMessagesCount}
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-gray-800">Messages</h2>
                    {unreadMessagesCount > 0 && (
                      <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-bold">
                        {unreadMessagesCount} non lu{unreadMessagesCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">Conversations avec vos clients</p>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                {unreadMessagesCount > 0 ? (
                  <p className="text-red-600 font-medium">💬 {unreadMessagesCount} message{unreadMessagesCount > 1 ? 's' : ''} non lu{unreadMessagesCount > 1 ? 's' : ''}</p>
                ) : (
                  <p className="text-gray-500">📭 Aucun nouveau message</p>
                )}
              </div>
            </div>
          </Link>

          {/* Avis */}
          <Link href="/artisan/avis">
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-[#FF6B00]">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-yellow-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Avis</h2>
                  <p className="text-sm text-gray-600">
                    {statsAvis.total > 0 ? (
                      <>
                        <span className="font-semibold text-[#FF6B00]">{statsAvis.moyenne.toFixed(1)}/5</span>
                        {' '}• {statsAvis.total} avis
                      </>
                    ) : (
                      'Aucun avis pour le moment'
                    )}
                  </p>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
