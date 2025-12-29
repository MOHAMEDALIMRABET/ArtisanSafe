'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { sendEmailVerification } from 'firebase/auth';
import { authService } from '@/lib/auth-service';
import { getArtisanByUserId } from '@/lib/firebase/artisan-service';
import { 
  verifySiret, 
  updateSiretVerification,
  sendPhoneVerificationCode,
  verifyPhoneCode,
  markEmailAsVerified,
  calculateVerificationStatus,
  updateVerificationStatus
} from '@/lib/firebase/verification-service';
import type { Artisan } from '@/types/firestore';

export default function VerificationPage() {
  const router = useRouter();
  const [artisan, setArtisan] = useState<Artisan | null>(null);
  const [loading, setLoading] = useState(true);
  
  // États pour chaque étape
  const [siretStatus, setSiretStatus] = useState<'pending' | 'verifying' | 'success' | 'error'>('pending');
  const [siretError, setSiretError] = useState('');
  
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneSent, setPhoneSent] = useState(false);
  const [phoneVerifying, setPhoneVerifying] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  
  const [emailSending, setEmailSending] = useState(false);

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

  // ============================================
  // 1. VÉRIFICATION SIRET
  // ============================================
  
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

  // ============================================
  // 2. VÉRIFICATION EMAIL
  // ============================================
  
  const handleSendEmailVerification = async () => {
    const user = authService.getCurrentUser();
    if (!user) return;
    
    setEmailSending(true);
    
    try {
      await sendEmailVerification(user);
      alert('📧 Email de vérification envoyé ! Vérifiez votre boîte de réception.');
    } catch (error) {
      console.error('Erreur envoi email:', error);
      alert('Erreur lors de l\'envoi de l\'email');
    } finally {
      setEmailSending(false);
    }
  };

  // ============================================
  // 3. VÉRIFICATION TÉLÉPHONE
  // ============================================
  
  const handleSendPhoneCode = async () => {
    if (!artisan) return;
    
    try {
      const result = await sendPhoneVerificationCode(artisan.userId, artisan.userId);
      
      if (result.success) {
        setPhoneSent(true);
        alert('📱 Code de vérification envoyé par SMS !');
      } else {
        setPhoneError(result.error || 'Erreur envoi SMS');
      }
    } catch (error) {
      console.error('Erreur envoi SMS:', error);
      setPhoneError('Erreur technique');
    }
  };

  const handleVerifyPhoneCode = async () => {
    if (!artisan) return;
    
    setPhoneVerifying(true);
    setPhoneError('');
    
    try {
      const result = await verifyPhoneCode(artisan.userId, phoneCode);
      
      if (result.success) {
        alert('✅ Téléphone vérifié avec succès !');
        await loadArtisan();
      } else {
        setPhoneError(result.error || 'Code incorrect');
      }
    } catch (error) {
      console.error('Erreur vérification code:', error);
      setPhoneError('Erreur technique');
    } finally {
      setPhoneVerifying(false);
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
  const emailVerified = artisan.contactVerification?.email?.verified === true;
  const phoneVerified = artisan.contactVerification?.telephone?.verified === true;

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
            Complétez ces étapes pour recevoir le badge "Profil Vérifié" et accéder à toutes les fonctionnalités
          </p>
        </div>

        {/* Étapes de vérification */}
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
                  <h3 className="font-bold text-lg">1. Vérification SIRET</h3>
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
                  <p className="text-sm text-blue-700">
                    <strong>SIRET actuel :</strong> {artisan.siret}
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    Cliquez sur "Vérifier" pour valider automatiquement votre SIRET
                  </p>
                </div>

                {siretError && (
                  <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                    <p className="text-sm text-red-700">❌ {siretError}</p>
                  </div>
                )}

                <button
                  onClick={handleVerifySiret}
                  disabled={siretStatus === 'verifying'}
                  className="w-full bg-[#FF6B00] text-white py-3 rounded-lg font-semibold hover:bg-[#E56100] disabled:opacity-50"
                >
                  {siretStatus === 'verifying' ? 'Vérification en cours...' : 'Vérifier le SIRET'}
                </button>
              </div>
            )}
          </div>

          {/* 2. EMAIL */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  emailVerified ? 'bg-green-100' : 'bg-orange-100'
                }`}>
                  {emailVerified ? (
                    <span className="text-2xl">✅</span>
                  ) : (
                    <span className="text-2xl">📧</span>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-lg">2. Vérification Email</h3>
                  <p className="text-sm text-gray-600">Confirmez votre adresse email</p>
                </div>
              </div>
              
              {emailVerified && (
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
                  Vérifié
                </span>
              )}
            </div>

            {!emailVerified && (
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  Un email de vérification sera envoyé à votre adresse. Cliquez sur le lien pour confirmer.
                </p>

                <button
                  onClick={handleSendEmailVerification}
                  disabled={emailSending}
                  className="w-full bg-[#FF6B00] text-white py-3 rounded-lg font-semibold hover:bg-[#E56100] disabled:opacity-50"
                >
                  {emailSending ? 'Envoi en cours...' : 'Envoyer l\'email de vérification'}
                </button>
              </div>
            )}
          </div>

          {/* 3. TÉLÉPHONE */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  phoneVerified ? 'bg-green-100' : 'bg-orange-100'
                }`}>
                  {phoneVerified ? (
                    <span className="text-2xl">✅</span>
                  ) : (
                    <span className="text-2xl">📱</span>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-lg">3. Vérification Téléphone</h3>
                  <p className="text-sm text-gray-600">Code SMS de validation</p>
                </div>
              </div>
              
              {phoneVerified && (
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
                  Vérifié
                </span>
              )}
            </div>

            {!phoneVerified && (
              <div>
                {!phoneSent ? (
                  <div>
                    <p className="text-sm text-gray-600 mb-4">
                      Un code de vérification sera envoyé par SMS à votre numéro de téléphone.
                    </p>

                    {phoneError && (
                      <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                        <p className="text-sm text-red-700">❌ {phoneError}</p>
                      </div>
                    )}

                    <button
                      onClick={handleSendPhoneCode}
                      className="w-full bg-[#FF6B00] text-white py-3 rounded-lg font-semibold hover:bg-[#E56100]"
                    >
                      Envoyer le code SMS
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-green-600 mb-4">
                      ✅ Code envoyé ! Consultez vos SMS et entrez le code à 6 chiffres ci-dessous.
                    </p>

                    {phoneError && (
                      <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                        <p className="text-sm text-red-700">❌ {phoneError}</p>
                      </div>
                    )}

                    <input
                      type="text"
                      maxLength={6}
                      value={phoneCode}
                      onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl font-bold tracking-widest mb-4"
                    />

                    <button
                      onClick={handleVerifyPhoneCode}
                      disabled={phoneCode.length !== 6 || phoneVerifying}
                      className="w-full bg-[#FF6B00] text-white py-3 rounded-lg font-semibold hover:bg-[#E56100] disabled:opacity-50"
                    >
                      {phoneVerifying ? 'Vérification...' : 'Vérifier le code'}
                    </button>

                    <button
                      onClick={() => {
                        setPhoneSent(false);
                        setPhoneCode('');
                        setPhoneError('');
                      }}
                      className="w-full mt-2 text-gray-600 hover:text-[#FF6B00] text-sm"
                    >
                      Renvoyer un code
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Étapes suivantes */}
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
            <h4 className="font-bold text-blue-900 mb-2">📄 Prochaines étapes</h4>
            <p className="text-sm text-blue-700 mb-2">
              Une fois ces vérifications complétées, vous devrez fournir :
            </p>
            <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
              <li>Extrait Kbis de moins de 3 mois</li>
              <li>Pièce d'identité en cours de validité</li>
            </ul>
            <p className="text-sm text-blue-700 mt-2">
              Ces documents seront vérifiés par notre équipe sous 24-48h.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
