'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/lib/auth-service';
import { getArtisanByUserId } from '@/lib/firebase/artisan-service';
import { verifySiret, updateSiretVerification } from '@/lib/firebase/verification-service';
import type { Artisan } from '@/types/firestore';

export default function VerificationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [artisan, setArtisan] = useState<Artisan | null>(null);
  
  // États pour la vérification SIRET
  const [siretStatus, setSiretStatus] = useState<'pending' | 'verifying' | 'success' | 'error'>('pending');
  const [siretError, setSiretError] = useState('');

  useEffect(() => {
    loadArtisan();
  }, []);

  const loadArtisan = async () => {
    try {
      const user = authService.getCurrentUser();
      if (!user) {
        router.push('/connexion');
        return;
      }

      const artisanData = await getArtisanByUserId(user.uid);
      if (!artisanData) {
        router.push('/artisan/profil');
        return;
      }

      setArtisan(artisanData);
    } catch (error) {
      console.error('Erreur chargement artisan:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySiret = async () => {
    if (!artisan) return;
    
    setSiretStatus('verifying');
    setSiretError('');
    
    try {
      const result = await verifySiret(artisan.siret);
      
      if (result.valid) {
        await updateSiretVerification(artisan.userId, true, {
          companyName: result.companyName || '',
          legalForm: result.legalForm || ''
        });
        setSiretStatus('success');
        await loadArtisan();
      } else {
        setSiretStatus('error');
        setSiretError(result.error || 'SIRET invalide');
      }
    } catch (error) {
      console.error('Erreur vérification SIRET:', error);
      setSiretStatus('error');
      setSiretError('Erreur technique');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B00] mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!artisan) {
    return null;
  }

  const siretVerified = artisan.siretVerified === true;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/artisan/dashboard')}
            className="text-gray-600 hover:text-[#FF6B00] flex items-center gap-2 mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Retour au tableau de bord
          </button>
          
          <h1 className="text-3xl font-bold text-gray-900">Vérification du Profil</h1>
          <p className="text-gray-600 mt-2">
            Complétez ces étapes pour recevoir le badge "Profil Vérifié"
          </p>
        </div>

        {/* Étapes */}
        <div className="space-y-6">
          
          {/* 1. SIRET */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-100">
                {siretVerified ? (
                  <span className="text-2xl">✅</span>
                ) : (
                  <span className="text-2xl">📋</span>
                )}
              </div>
              <div>
                <h3 className="font-bold text-lg">Vérification SIRET</h3>
                {siretVerified ? (
                  <p className="text-sm text-green-600">Validé</p>
                ) : (
                  <p className="text-sm text-gray-600">En attente de validation</p>
                )}
              </div>
            </div>
          </div>

          {/* 2. TÉLÉPHONE */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-100">
                <span className="text-2xl">✅</span>
              </div>
              <div>
                <h3 className="font-bold text-lg">Validation téléphone</h3>
                <p className="text-sm text-green-600">Validé</p>
              </div>
            </div>
          </div>

          {/* 3. KBIS */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-orange-100">
                <span className="text-2xl">⏳</span>
              </div>
              <div>
                <h3 className="font-bold text-lg">KBIS vérifié</h3>
                <p className="text-sm text-gray-600">En cours de développement</p>
              </div>
            </div>
          </div>

          {/* 4. Pièce d'identité */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-orange-100">
                <span className="text-2xl">⏳</span>
              </div>
              <div>
                <h3 className="font-bold text-lg">Pièce d'identité vérifiée</h3>
                <p className="text-sm text-gray-600">En cours de développement</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
