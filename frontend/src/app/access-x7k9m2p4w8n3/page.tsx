'use client';

/**
 * Page de connexion Admin - URL SÉCURISÉE
 * Route: /access-x7k9m2p4w8n3
 * ⚠️ URL confidentielle - Ne pas partager publiquement
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { isAdmin } from '@/lib/firebase/admin-service';
import { logAdminAccess, detectBruteForce, blockIP, isIPBlocked } from '@/lib/firebase/admin-access-log';
import { isWhitelistedAdmin } from '@/lib/auth-service';

export default function SecureAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isBlocked, setIsBlocked] = useState(false);

  // Vérifier si IP bloquée au chargement
  useEffect(() => {
    checkIfBlocked();
  }, []);

  const checkIfBlocked = async () => {
    // Simuler récupération IP (en production, utiliser un service comme ipify)
    const ipAddress = 'unknown'; // TODO: Récupérer vraie IP
    const blocked = await isIPBlocked(ipAddress);
    setIsBlocked(blocked);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Récupérer IP et User-Agent
    const ipAddress = 'unknown'; // TODO: Utiliser API comme ipify.org
    const userAgent = navigator.userAgent;

    // Vérifier si IP bloquée
    if (await isIPBlocked(ipAddress)) {
      setError('Votre accès a été temporairement bloqué suite à plusieurs tentatives échouées. Réessayez dans 30 minutes.');
      setLoading(false);
      return;
    }

    // Détecter brute force AVANT la tentative
    if (await detectBruteForce(ipAddress)) {
      // Bloquer l'IP
      await blockIP(ipAddress, 'Trop de tentatives échouées', 30);
      setError('Trop de tentatives échouées. Votre accès est bloqué pour 30 minutes.');
      setLoading(false);
      return;
    }

    try {
      // � SÉCURITÉ NIVEAU 0 : Vérifier whitelist AVANT toute tentative de connexion
      if (!isWhitelistedAdmin(email)) {
        // Logger la tentative d'accès non autorisé
        await logAdminAccess({
          action: 'whitelist_blocked',
          adminEmail: email,
          ipAddress,
          userAgent,
          details: 'Email non autorisé dans la whitelist admin',
        });

        setError('Accès refusé. Cet email n\'est pas autorisé à accéder à l\'interface administrateur.');
        setLoading(false);
        return;
      }

      // �📝 Logger la tentative
      await logAdminAccess({
        action: 'login_attempt',
        adminEmail: email,
        ipAddress,
        userAgent,
        details: 'Tentative de connexion admin (URL sécurisée)',
      });

      // Connexion Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Vérifier si l'utilisateur est admin
      const adminStatus = await isAdmin(user.uid);

      if (!adminStatus) {
        // 📝 Logger l'accès non autorisé
        await logAdminAccess({
          action: 'unauthorized_access',
          adminId: user.uid,
          adminEmail: email,
          ipAddress,
          userAgent,
          details: 'Utilisateur non-admin a tenté de se connecter',
        });

        // Déconnecter si pas admin
        await auth.signOut();
        setError('Accès refusé. Vous devez être administrateur pour accéder à cette page.');
        setLoading(false);
        return;
      }

      // 📝 Logger le succès
      await logAdminAccess({
        action: 'login_success',
        adminId: user.uid,
        adminEmail: email,
        ipAddress,
        userAgent,
        details: 'Connexion admin réussie (URL sécurisée)',
      });

      // Redirection vers dashboard admin
      router.push('/admin/dashboard');
    } catch (err: any) {
      console.error('Erreur connexion admin:', err);

      // 📝 Logger l'échec
      await logAdminAccess({
        action: 'login_failed',
        adminEmail: email,
        ipAddress,
        userAgent,
        details: `Erreur: ${err.code || 'unknown'}`,
      });

      // Messages d'erreur en français
      switch (err.code) {
        case 'auth/invalid-email':
          setError('Adresse email invalide');
          break;
        case 'auth/user-disabled':
          setError('Ce compte a été désactivé');
          break;
        case 'auth/user-not-found':
          setError('Aucun compte trouvé avec cet email');
          break;
        case 'auth/wrong-password':
          setError('Mot de passe incorrect');
          break;
        case 'auth/invalid-credential':
          setError('Email ou mot de passe incorrect');
          break;
        default:
          setError('Erreur de connexion. Veuillez réessayer.');
      }

      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2C3E50] to-[#1A3A5C] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
        {/* Logo et titre */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-[#FF6B00] rounded-full mx-auto mb-4 flex items-center justify-center">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-[#2C3E50]">Espace Sécurisé</h1>
          <p className="text-gray-600 mt-2">ArtisanDispo - Administration</p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleLogin} className="space-y-6">
          {/* Message d'erreur */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email administrateur
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
              placeholder="admin@artisandispo.fr"
              disabled={loading}
            />
          </div>

          {/* Mot de passe */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          {/* Bouton de connexion */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#FF6B00] text-white py-3 rounded-lg hover:bg-[#E56100] transition font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Connexion...
              </span>
            ) : (
              'Accéder'
            )}
          </button>
        </form>

        {/* Avertissement sécurité */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <p className="text-sm font-medium text-yellow-800">Accès restreint</p>
                <p className="text-xs text-yellow-700 mt-1">
                  Espace réservé aux administrateurs ArtisanDispo.
                  Toute tentative d'accès non autorisée est tracée et enregistrée.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Retour à l'accueil */}
        <div className="mt-6 text-center space-y-2">
          <button
            onClick={() => router.push('/')}
            className="text-[#FF6B00] hover:underline text-sm block w-full"
          >
            ← Retour à l'accueil
          </button>
          <button
            onClick={() => router.push('/connexion')}
            className="text-gray-400 hover:text-gray-600 text-xs block w-full transition-colors"
          >
            Connexion utilisateur
          </button>
        </div>
      </div>
    </div>
  );
}
