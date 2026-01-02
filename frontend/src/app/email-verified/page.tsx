'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase/config';
import { Logo } from '@/components/ui';
import Link from 'next/link';

export default function EmailVerifiedPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Vérification de votre email en cours...');

  useEffect(() => {
    const checkEmailVerification = async () => {
      try {
        const user = auth.currentUser;

        if (!user) {
          // L'utilisateur n'est pas connecté après avoir cliqué sur le lien
          setStatus('success');
          setMessage('Votre email a été vérifié avec succès ! Veuillez vous reconnecter pour accéder à votre compte.');
          return;
        }

        // Recharger les données utilisateur pour obtenir le statut à jour
        await user.reload();

        if (user.emailVerified) {
          setStatus('success');
          setMessage('Votre email a été vérifié avec succès !');

          // Redirection automatique après 3 secondes
          setTimeout(() => {
            router.push('/dashboard');
          }, 3000);
        } else {
          setStatus('error');
          setMessage('Email non encore vérifié. Veuillez cliquer sur le lien dans votre email.');
        }
      } catch (error) {
        console.error('Erreur vérification email:', error);
        setStatus('error');
        setMessage('Une erreur est survenue. Veuillez réessayer.');
      }
    };

    checkEmailVerification();
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2C3E50] to-[#1A3A5C] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <Logo size="lg" />
        </div>

        {/* Icône de statut */}
        <div className="mb-6">
          {status === 'loading' && (
            <div className="w-20 h-20 mx-auto border-4 border-[#FF6B00] border-t-transparent rounded-full animate-spin"></div>
          )}
          {status === 'success' && (
            <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          {status === 'error' && (
            <div className="w-20 h-20 mx-auto bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-12 h-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}
        </div>

        {/* Message */}
        <h1 className={`text-2xl font-bold mb-3 ${
          status === 'success' ? 'text-green-600' : 
          status === 'error' ? 'text-red-600' : 
          'text-[#2C3E50]'
        }`}>
          {status === 'loading' && 'Vérification en cours'}
          {status === 'success' && '✅ Email vérifié !'}
          {status === 'error' && '❌ Échec de vérification'}
        </h1>

        <p className="text-gray-600 mb-6">
          {message}
        </p>

        {/* Actions */}
        <div className="space-y-3">
          {status === 'success' && (
            <p className="text-sm text-gray-500">
              Redirection automatique vers votre dashboard dans 3 secondes...
            </p>
          )}

          {status === 'error' && (
            <>
              <Link href="/dashboard">
                <button className="w-full bg-[#FF6B00] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#E56100] transition">
                  Retour au dashboard
                </button>
              </Link>
              <Link href="/connexion">
                <button className="w-full border-2 border-[#2C3E50] text-[#2C3E50] px-6 py-3 rounded-lg font-medium hover:bg-[#2C3E50] hover:text-white transition">
                  Se reconnecter
                </button>
              </Link>
            </>
          )}

          {status === 'success' && !auth.currentUser && (
            <Link href="/connexion">
              <button className="w-full bg-[#FF6B00] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#E56100] transition">
                Se connecter
              </button>
            </Link>
          )}

          {status === 'loading' && (
            <Link href="/dashboard">
              <button className="w-full border-2 border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-100 transition">
                Retour au dashboard
              </button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
