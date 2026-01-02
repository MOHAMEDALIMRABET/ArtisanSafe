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

      // Charger depuis le cache d'abord pour affichage immédiat
      const cachedData = localStorage.getItem(`artisan_${user.uid}`);
      if (cachedData) {
        try {
          const cached = JSON.parse(cachedData);
          setArtisan(cached);
          setLoading(false); // Afficher immédiatement les données en cache
        } catch (e) {
          console.warn('Cache invalide, rechargement depuis Firestore');
        }
      }

      // Puis recharger depuis Firestore en arrière-plan
      const artisanData = await getArtisanByUserId(user.uid);
      if (!artisanData) {
        router.push('/artisan/profil');
        return;
      }

      setArtisan(artisanData);
      // Mettre à jour le cache
      localStorage.setItem(`artisan_${user.uid}`, JSON.stringify(artisanData));
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
        // Invalider le cache après mise à jour
        const user = authService.getCurrentUser();
        if (user) {
          localStorage.removeItem(`artisan_${user.uid}`);
        }
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
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  siretVerified ? 'bg-green-100' : 'bg-orange-100'
                }`}>
                  {siretVerified ? (
                    <span className="text-2xl">✅</span>
                  ) : (
                    <span className="text-2xl">📋</span>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-lg">Vérification SIRET</h3>
                  <p className="text-sm text-gray-600">Validation automatique via la base SIRENE</p>
                </div>
              </div>
              
              {siretVerified && (
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
                  Vérifié
                </span>
              )}
            </div>

            {!siretVerified && (
              <div>
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
                  <p className="text-sm text-blue-700 mb-2">
                    <strong>SIRET actuel :</strong> {artisan.siret}
                  </p>
                  <p className="text-sm text-blue-700 mb-2">
                    <strong>Vérifications effectuées :</strong>
                  </p>
                  <ul className="text-sm text-blue-700 list-disc list-inside ml-2 space-y-1">
                    <li>Format valide (14 chiffres)</li>
                    <li>Statut de l'entreprise (Active/Inactive)</li>
                    <li>Informations légales de l'entreprise</li>
                  </ul>
                </div>

                {siretError && (
                  <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                    <p className="text-sm text-red-700 font-semibold">❌ {siretError}</p>
                    <p className="text-xs text-red-600 mt-1">
                      Vérifiez que votre SIRET est correct et que votre entreprise est active.
                    </p>
                  </div>
                )}

                {siretStatus === 'success' && (
                  <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4">
                    <p className="text-sm text-green-700 font-semibold">✅ SIRET vérifié avec succès !</p>
                    <p className="text-xs text-green-600 mt-1">
                      Votre entreprise est active dans la base SIRENE.
                    </p>
                  </div>
                )}

                <button
                  onClick={handleVerifySiret}
                  disabled={siretStatus === 'verifying'}
                  className="w-full bg-[#FF6B00] text-white py-3 rounded-lg font-semibold hover:bg-[#E56100] disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {siretStatus === 'verifying' ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Vérification en cours...
                    </span>
                  ) : 'Vérifier le SIRET'}
                </button>
              </div>
            )}
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
