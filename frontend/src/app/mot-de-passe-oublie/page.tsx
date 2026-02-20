'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { resetPassword } from '@/lib/auth-service';

export default function MotDePasseOubliePage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await resetPassword(email);
      
      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error || 'Une erreur est survenue');
      }
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-lg">
          {/* Icône de succès */}
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto animate-pulse">
            <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          {/* Titre */}
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              ✅ Email envoyé !
            </h2>
            <p className="text-lg text-gray-700">
              Nous vous avons envoyé un email à :
            </p>
            <p className="text-lg font-semibold text-[#FF6B00] mt-2">
              {email}
            </p>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border-l-4 border-[#FF6B00] p-4">
            <p className="text-sm text-gray-700 font-semibold mb-2">
              Prochaines étapes :
            </p>
            <ol className="text-sm text-gray-600 space-y-2 ml-4 list-decimal">
              <li>Consultez votre boîte mail (et vos spams)</li>
              <li>Cliquez sur le lien de réinitialisation</li>
              <li>Choisissez un nouveau mot de passe</li>
            </ol>
          </div>

          {/* Avertissement */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <span className="text-2xl mr-3">⏰</span>
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">
                  Le lien expire dans 1 heure
                </p>
                <p className="text-xs text-gray-600">
                  Si vous ne recevez pas l'email, vérifiez vos spams ou réessayez.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={() => router.push('/connexion')}
              className="w-full bg-[#FF6B00] text-white px-6 py-3 rounded-lg hover:bg-[#E56100] transition-colors font-semibold"
            >
              Retour à la connexion
            </button>
            
            <button
              onClick={() => {
                setSuccess(false);
                setEmail('');
              }}
              className="w-full border-2 border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Renvoyer l'email
            </button>
          </div>

          {/* Support */}
          <div className="text-center text-sm text-gray-500">
            Besoin d'aide ?{' '}
            <a href="mailto:support@artisansafe.fr" className="text-[#FF6B00] hover:underline">
              Contactez le support
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-[#FF6B00] rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">
            Mot de passe oublié ?
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Pas de souci ! Nous allons vous envoyer un lien pour réinitialiser votre mot de passe.
          </p>
        </div>

        {/* Formulaire */}
        <form className="mt-8 space-y-6 bg-white p-8 rounded-lg shadow-lg" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Adresse email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="appearance-none relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
              placeholder="votre@email.com"
            />
            <p className="mt-2 text-xs text-gray-500">
              Saisissez l'adresse email associée à votre compte
            </p>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-[#FF6B00] hover:bg-[#E56100] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FF6B00] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Envoi en cours...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Envoyer le lien de réinitialisation
                </>
              )}
            </button>
          </div>

          {/* Informations de sécurité */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-start">
              <span className="text-2xl mr-3">🔒</span>
              <div>
                <p className="text-xs font-semibold text-gray-900 mb-1">
                  Sécurité de votre compte
                </p>
                <ul className="text-xs text-gray-600 space-y-1 ml-4 list-disc">
                  <li>Le lien est valable 1 heure</li>
                  <li>Le lien ne peut être utilisé qu'une seule fois</li>
                  <li>Votre mot de passe actuel reste actif jusqu'à la réinitialisation</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Retour connexion */}
          <div className="text-center">
            <Link 
              href="/connexion" 
              className="text-sm text-[#FF6B00] hover:underline flex items-center justify-center"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Retour à la connexion
            </Link>
          </div>
        </form>

        {/* Pas encore de compte */}
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Pas encore de compte ?{' '}
            <Link href="/inscription" className="font-medium text-[#FF6B00] hover:underline">
              Inscrivez-vous gratuitement
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
