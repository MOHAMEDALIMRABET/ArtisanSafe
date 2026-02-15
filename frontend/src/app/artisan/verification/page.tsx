'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/lib/auth-service';
import { getArtisanByUserId } from '@/lib/firebase/artisan-service';
import { verifySiret, updateSiretVerification } from '@/lib/firebase/verification-service';
import { artisanDoitDecennale } from '@/lib/decennale-helper';
import type { Artisan } from '@/types/firestore';

export default function VerificationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false); // Changé à false pour affichage immédiat
  const [artisan, setArtisan] = useState<Artisan | null>(null);
  
  // États pour la vérification SIRET
  const [siretStatus, setSiretStatus] = useState<'pending' | 'verifying' | 'success' | 'error'>('pending');
  const [siretError, setSiretError] = useState('');
  const [sireneData, setSireneData] = useState<{
    raisonSociale?: string;
    adresse?: string;
    activite?: string;
    siret?: string;
  } | null>(null);

  // ✅ Protection contre appels multiples
  const isLoadingRef = useRef(false);

  useEffect(() => {
    // ✅ Protection contre double chargement
    if (!isLoadingRef.current) {
      isLoadingRef.current = true;
      loadArtisan();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Exécuter une seule fois au montage

  const loadArtisan = async () => {
    try {
      const user = authService.getCurrentUser();
      if (!user) {
        router.push('/connexion');
        isLoadingRef.current = false;
        return;
      }

      // Charger depuis le cache d'abord pour affichage IMMÉDIAT
      const cachedData = localStorage.getItem(`artisan_${user.uid}`);
      if (cachedData) {
        try {
          const cached = JSON.parse(cachedData);
          setArtisan(cached);
          // Ne pas mettre setLoading(false) ici car déjà à false par défaut
        } catch (e) {
          console.warn('Cache invalide, rechargement depuis Firestore');
        }
      }

      // Si pas de cache, on affiche quand même la page avec un skeleton
      if (!cachedData) {
        setLoading(true); // Seulement si pas de cache
      }

      // Puis recharger depuis Firestore en arrière-plan avec timeout
      const timeoutPromise = new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 10000) // Timeout de 10s
      );
      
      try {
        const artisanData = await Promise.race([
          getArtisanByUserId(user.uid),
          timeoutPromise
        ]);

        if (!artisanData) {
          router.push('/artisan/profil');
          isLoadingRef.current = false;
          return;
        }

        setArtisan(artisanData);
        // Mettre à jour le cache
        localStorage.setItem(`artisan_${user.uid}`, JSON.stringify(artisanData));
      } catch (error: any) {
        if (error.message === 'Timeout') {
          console.warn('Timeout chargement Firestore, utilisation du cache');
          // Si timeout et pas de cache, afficher un message d'erreur
          if (!cachedData) {
            setSiretError('Erreur de chargement. Veuillez rafraîchir la page.');
          }
        } else {
          console.error('Erreur chargement artisan:', error);
        }
      } finally {
        setLoading(false);
        isLoadingRef.current = false;
      }
    } catch (error) {
      console.error('Erreur critique:', error);
      setLoading(false);
      isLoadingRef.current = false;
    }
  };

  const handleVerifySiret = async () => {
    if (!artisan) return;
    
    // Vérifier que la raison sociale est présente
    if (!artisan.raisonSociale || artisan.raisonSociale.trim().length < 2) {
      setSiretStatus('error');
      setSiretError('Raison sociale manquante dans votre profil. Veuillez compléter votre profil.');
      return;
    }
    
    console.log('🔍 [Page] Lancement vérification SIRET:', {
      siret: artisan.siret,
      raisonSociale: artisan.raisonSociale,
      userId: artisan.userId
    });
    
    setSiretStatus('verifying');
    setSiretError('');
    
    try {
      // Vérification complète : SIRET + Raison sociale
      const result = await verifySiret(artisan.siret, artisan.raisonSociale);
      
      console.log('📊 [Page] Résultat vérification:', result);
      
      if (result.valid) {
        console.log('✅ [Page] Mise à jour Firestore avec:', {
          companyName: result.companyName,
          legalForm: result.legalForm
        });
        
        // Stocker les données SIRENE pour affichage
        setSireneData({
          raisonSociale: result.companyName,
          adresse: result.adresse,
          activite: result.legalForm,
          siret: artisan.siret
        });
        
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
        // Mise à jour locale de l'état sans recharger Firestore
        setArtisan(prev => prev ? {
          ...prev,
          siretVerified: true,
          raisonSociale: result.companyName || prev.raisonSociale,
          // formeJuridique est de type FormeJuridique, on doit caster
          formeJuridique: (result.legalForm || prev.formeJuridique) as any
        } as Artisan : null);
      } else {
        console.error('❌ [Page] Vérification échouée:', result.error);
        setSiretStatus('error');
        setSiretError(result.error || 'SIRET invalide');
      }
    } catch (error) {
      console.error('❌ [Page] Erreur vérification SIRET:', error);
      setSiretStatus('error');
      setSiretError('Erreur technique');
    }
  };

  // Afficher un skeleton si chargement ET pas de données en cache
  if (loading && !artisan) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="mb-8 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
          <div className="space-y-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow-md p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Si pas de données après chargement, rediriger ou afficher erreur
  if (!artisan && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Impossible de charger les données</p>
          <button
            onClick={() => router.back()}
            className="bg-[#FF6B00] text-white px-6 py-2 rounded-lg hover:bg-[#E56100]"
          >
            Retour au tableau de bord
          </button>
        </div>
      </div>
    );
  }

  const siretVerified = artisan?.siretVerified === true;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
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

            {!siretVerified && artisan && (
              <div>
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
                  <label className="block text-sm text-blue-700 mb-2 font-semibold">
                    <strong>SIRET actuel :</strong>
                  </label>
                  <input
                    type="text"
                    value={artisan.siret}
                    onChange={async (e) => {
                      // Accepter uniquement les chiffres
                      const value = e.target.value.replace(/\D/g, '');
                      // Limiter à 14 chiffres maximum
                      const newSiret = value.slice(0, 14);
                      setArtisan({ ...artisan, siret: newSiret });
                      setSiretStatus('pending');
                      setSiretError('');
                    }}
                    className="w-full border border-blue-300 rounded px-3 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
                    maxLength={14}
                    disabled={siretStatus === 'verifying'}
                  />
                  <button
                    onClick={async () => {
                      if (!artisan.siret || artisan.siret.length !== 14 || !/^\d{14}$/.test(artisan.siret)) {
                        setSiretError('Vérifiez que votre SIRET est correct et que votre entreprise est active.');
                        return;
                      }
                      setSiretStatus('verifying');
                      setSiretError('');
                      try {
                        // Mettre à jour le SIRET dans Firestore
                        await updateSiretVerification(artisan.userId, artisan.siret);
                        setSiretStatus('pending');
                        setSiretError('SIRET mis à jour. Cliquez sur "Vérifier le SIRET" pour valider.');
                      } catch (err: any) {
                        setSiretError('Erreur lors de la mise à jour du SIRET.');
                      }
                    }}
                    className="bg-[#2C3E50] text-white px-4 py-2 rounded mb-2 hover:bg-[#1A3A5C] disabled:opacity-50"
                    disabled={siretStatus === 'verifying'}
                  >
                    Mettre à jour le SIRET
                  </button>
                  <p className="text-xs text-blue-700 mb-3">
                    <strong>Raison sociale déclarée :</strong> {artisan.raisonSociale}
                  </p>
                  <p className="text-sm text-blue-700 font-semibold mb-2">
                    Vérifications effectuées :
                  </p>
                  <ul className="text-sm text-blue-700 list-disc list-inside ml-2 space-y-1">
                    <li>Format valide (14 chiffres)</li>
                    <li>Statut de l'entreprise</li>
                    <li>Informations légales de l'entreprise</li>
                    <li>Adéquation raison sociale / SIRET</li>
                  </ul>
                </div>

                {siretError && (
                  <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                    <p className="text-sm text-red-700 font-semibold">❌ {siretError}</p>
                  </div>
                )}

                {siretStatus === 'success' && (
                  <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4">
                    <p className="text-sm text-green-700 font-semibold mb-3">✅ SIRET vérifié avec succès !</p>
                    <p className="text-xs text-green-600 mb-3">
                      Votre entreprise est active dans la base SIRENE.
                    </p>
                    {sireneData && (
                      <div className="mt-3 pt-3 border-t border-green-200">
                        <p className="text-xs font-semibold text-green-800 mb-2">📊 Informations retournées par SIRENE :</p>
                        <div className="space-y-1">
                          <p className="text-xs text-green-700">
                            <strong>SIRET :</strong> {sireneData.siret}
                          </p>
                          <p className="text-xs text-green-700">
                            <strong>Raison sociale :</strong> {sireneData.raisonSociale || 'Non renseigné'}
                          </p>
                          <p className="text-xs text-green-700">
                            <strong>Adresse :</strong> {sireneData.adresse || 'Non renseigné'}
                          </p>
                          <p className="text-xs text-green-700">
                            <strong>Activité (APE) :</strong> {sireneData.activite || 'Non renseigné'}
                          </p>
                        </div>
                      </div>
                    )}
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-100">
                  <span className="text-2xl">✅</span>
                </div>
                <div>
                  <h3 className="font-bold text-lg">Validation téléphone</h3>
                  <p className="text-sm text-gray-600">Numéro vérifié par SMS</p>
                </div>
              </div>
              
              <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
                Vérifié
              </span>
            </div>
          </div>

          {/* 3. KBIS */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  artisan?.verificationDocuments?.kbis?.verified 
                    ? 'bg-green-100' 
                    : artisan?.verificationDocuments?.kbis?.rejected 
                      ? 'bg-red-100'
                      : artisan?.verificationDocuments?.kbis?.url 
                        ? 'bg-blue-100' 
                        : 'bg-orange-100'
                }`}>
                  <span className="text-2xl">
                    {artisan?.verificationDocuments?.kbis?.verified 
                      ? '✅' 
                      : artisan?.verificationDocuments?.kbis?.rejected 
                        ? '❌'
                        : artisan?.verificationDocuments?.kbis?.url 
                          ? '⏳' 
                          : '📄'}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-lg">KBIS</h3>
                  <p className="text-sm text-gray-600">
                    {artisan?.verificationDocuments?.kbis?.verified 
                      ? 'Extrait Kbis vérifié' 
                      : artisan?.verificationDocuments?.kbis?.rejected 
                        ? 'Document rejeté'
                        : artisan?.verificationDocuments?.kbis?.url 
                          ? 'Document en cours de vérification' 
                          : 'Document non uploadé'}
                  </p>
                </div>
              </div>
              
              {artisan?.verificationDocuments?.kbis?.verified && (
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
                  Vérifié
                </span>
              )}
              {artisan?.verificationDocuments?.kbis?.rejected && (
                <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-semibold">
                  Rejeté
                </span>
              )}
              {artisan?.verificationDocuments?.kbis?.url && !artisan?.verificationDocuments?.kbis?.verified && !artisan?.verificationDocuments?.kbis?.rejected && (
                <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold">
                  En cours de vérification
                </span>
              )}
            </div>
            
            {artisan?.verificationDocuments?.kbis?.rejected && (
              <div className="bg-red-50 border-l-4 border-red-400 p-3 mb-4">
                <p className="text-sm text-red-700">
                  <strong>Raison du rejet :</strong> {artisan.verificationDocuments.kbis.rejectionReason || 'Non spécifiée'}
                </p>
              </div>
            )}
            
            {!artisan?.verificationDocuments?.kbis?.url && (
              <button
                onClick={() => router.push('/artisan/documents')}
                className="mt-2 w-full bg-[#FF6B00] text-white py-2 rounded-lg hover:bg-[#E56100] font-semibold"
              >
                📤 Uploader le KBIS
              </button>
            )}
            {artisan?.verificationDocuments?.kbis?.rejected && (
              <button
                onClick={() => router.push('/artisan/documents')}
                className="w-full bg-[#FF6B00] text-white py-2 rounded-lg hover:bg-[#E56100] font-semibold"
              >
                📤 Re-uploader le KBIS
              </button>
            )}
          </div>

          {/* 4. Pièce d'identité */}
                    {/* 5. Garantie Responsabilité Civile Professionnelle */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            artisan?.verificationDocuments?.rcPro?.verified 
                              ? 'bg-green-100' 
                              : artisan?.verificationDocuments?.rcPro?.rejected 
                                ? 'bg-red-100'
                                : artisan?.verificationDocuments?.rcPro?.url 
                                  ? 'bg-blue-100' 
                                  : 'bg-orange-100'
                          }`}>
                            <span className="text-2xl">
                              {artisan?.verificationDocuments?.rcPro?.verified 
                                ? '✅' 
                                : artisan?.verificationDocuments?.rcPro?.rejected 
                                  ? '❌'
                                  : artisan?.verificationDocuments?.rcPro?.url 
                                    ? '⏳' 
                                    : '📄'}
                            </span>
                          </div>
                          <div>
                            <h3 className="font-bold text-lg">Garantie Responsabilité Civile Professionnelle</h3>
                            <p className="text-sm text-gray-600">
                              {artisan?.verificationDocuments?.rcPro?.verified 
                                ? 'Attestation vérifiée' 
                                : artisan?.verificationDocuments?.rcPro?.rejected 
                                  ? 'Document rejeté'
                                  : artisan?.verificationDocuments?.rcPro?.url 
                                    ? 'Document en cours de vérification' 
                                    : 'Document non uploadé'}
                            </p>
                          </div>
                        </div>
                        {artisan?.verificationDocuments?.rcPro?.verified && (
                          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
                            Vérifié
                          </span>
                        )}
                        {artisan?.verificationDocuments?.rcPro?.rejected && (
                          <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-semibold">
                            Rejeté
                          </span>
                        )}
                        {artisan?.verificationDocuments?.rcPro?.url && !artisan?.verificationDocuments?.rcPro?.verified && !artisan?.verificationDocuments?.rcPro?.rejected && (
                          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold">
                            En cours de vérification
                          </span>
                        )}
                      </div>
                      {artisan?.verificationDocuments?.rcPro?.rejected && (
                        <div className="bg-red-50 border-l-4 border-red-400 p-3 mb-4">
                          <p className="text-sm text-red-700">
                            <strong>Raison du rejet :</strong> {artisan.verificationDocuments.rcPro.rejectionReason || 'Non spécifiée'}
                          </p>
                        </div>
                      )}
                      {!artisan?.verificationDocuments?.rcPro?.url && (
                        <button
                          onClick={() => router.push('/artisan/documents')}
                          className="mt-2 w-full bg-[#FF6B00] text-white py-2 rounded-lg hover:bg-[#E56100] font-semibold"
                        >
                          📤 Uploader l'attestation RC Pro
                        </button>
                      )}
                      {artisan?.verificationDocuments?.rcPro?.rejected && (
                        <button
                          onClick={() => router.push('/artisan/documents')}
                          className="w-full bg-[#FF6B00] text-white py-2 rounded-lg hover:bg-[#E56100] font-semibold"
                        >
                          📤 Re-uploader l'attestation RC Pro
                        </button>
                      )}
                    </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  artisan?.verificationDocuments?.idCard?.verified 
                    ? 'bg-green-100' 
                    : artisan?.verificationDocuments?.idCard?.rejected 
                      ? 'bg-red-100'
                      : artisan?.verificationDocuments?.idCard?.url 
                        ? 'bg-blue-100' 
                        : 'bg-orange-100'
                }`}>
                  <span className="text-2xl">
                    {artisan?.verificationDocuments?.idCard?.verified 
                      ? '✅' 
                      : artisan?.verificationDocuments?.idCard?.rejected 
                        ? '❌'
                        : artisan?.verificationDocuments?.idCard?.url 
                          ? '⏳' 
                          : '🆔'}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-lg">Pièce d'identité</h3>
                  <p className="text-sm text-gray-600">
                    {artisan?.verificationDocuments?.idCard?.verified 
                      ? 'CNI ou Passeport vérifié' 
                      : artisan?.verificationDocuments?.idCard?.rejected 
                        ? 'Document rejeté'
                        : artisan?.verificationDocuments?.idCard?.url 
                          ? 'Document en cours de vérification' 
                          : 'Document non uploadé'}
                  </p>
                </div>
              </div>
              
              {artisan?.verificationDocuments?.idCard?.verified && (
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
                  Vérifié
                </span>
              )}
              {artisan?.verificationDocuments?.idCard?.rejected && (
                <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-semibold">
                  Rejeté
                </span>
              )}
              {artisan?.verificationDocuments?.idCard?.url && !artisan?.verificationDocuments?.idCard?.verified && !artisan?.verificationDocuments?.idCard?.rejected && (
                <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold">
                  En cours de vérification
                </span>
              )}
            </div>
            
            {artisan?.verificationDocuments?.idCard?.rejected && (
              <div className="bg-red-50 border-l-4 border-red-400 p-3 mb-4">
                <p className="text-sm text-red-700">
                  <strong>Raison du rejet :</strong> {artisan.verificationDocuments.idCard.rejectionReason || 'Non spécifiée'}
                </p>
              </div>
            )}
            
            {!artisan?.verificationDocuments?.idCard?.url && (
              <button
                onClick={() => router.push('/artisan/documents')}
                className="mt-2 w-full bg-[#FF6B00] text-white py-2 rounded-lg hover:bg-[#E56100] font-semibold"
              >
                📤 Uploader la pièce d'identité
              </button>
            )}
            {artisan?.verificationDocuments?.idCard?.rejected && (
              <button
                onClick={() => router.push('/artisan/documents')}
                className="w-full bg-[#FF6B00] text-white py-2 rounded-lg hover:bg-[#E56100] font-semibold"
              >
                📤 Re-uploader la pièce d'identité
              </button>
            )}
          </div>
        </div>


        {/* Section décennale (affichage conditionnel selon métiers) */}
        {artisan && (
          <>
            {/* Cas 1 : Métiers renseignés ET nécessitent décennale → Section obligatoire */}
            {artisan.metiers && artisan.metiers.length > 0 && artisanDoitDecennale(artisan.metiers) && (
              <section className="mt-8 p-6 border-2 border-[#FF6B00] rounded-lg bg-white">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-3xl">🛡️</span>
                  <h3 className="font-bold text-lg text-[#FF6B00]">
                    Attestation d'assurance décennale <span className="text-[#FFC107]">(obligatoire)</span>
                  </h3>
                </div>
                <p className="text-[#6C757D] mb-4">
                  Pour les métiers du gros œuvre et structure (maçonnerie, toiture, charpente, etc.), la loi impose une assurance décennale couvrant les travaux pendant 10 ans après réception. Fournir l'attestation est indispensable pour être vérifié sur la plateforme.
                </p>

                {/* Statut du document */}
                <div className="mb-4">
                  {artisan.verificationDocuments?.decennale?.verified ? (
                    <div className="p-3 bg-[#28A745] bg-opacity-10 border border-[#28A745] rounded">
                      <span className="text-[#28A745] font-semibold">✔️ Décennale validée</span>
                    </div>
                  ) : artisan.verificationDocuments?.decennale?.rejected ? (
                    <div className="p-3 bg-[#DC3545] bg-opacity-10 border border-[#DC3545] rounded">
                      <span className="text-[#DC3545] font-semibold">❌ Décennale rejetée</span>
                      <p className="text-sm mt-2">
                        <strong>Raison :</strong> {artisan.verificationDocuments.decennale.rejectionReason || 'Non spécifiée'}
                      </p>
                    </div>
                  ) : artisan.verificationDocuments?.decennale?.url ? (
                    <div className="p-3 bg-[#FFC107] bg-opacity-10 border border-[#FFC107] rounded">
                      <span className="text-[#FFC107] font-semibold">⏳ Décennale en attente de validation</span>
                    </div>
                  ) : (
                    <div className="p-3 bg-[#FF6B00] bg-opacity-10 border border-[#FF6B00] rounded">
                      <span className="text-[#FF6B00] font-semibold">⚠️ Aucune attestation déposée</span>
                    </div>
                  )}
                </div>

                {/* TODO: Bouton/zone d'upload, historique, etc. */}
              </section>
            )}

            {/* Cas 2 : Métiers non renseignés → Message informatif */}
            {(!artisan.metiers || artisan.metiers.length === 0) && (
              <section className="mt-8 p-6 border border-[#E9ECEF] rounded-lg bg-[#F8F9FA]">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">ℹ️</span>
                  <h3 className="font-bold text-lg text-[#2C3E50]">Assurance décennale</h3>
                </div>
                <p className="text-[#6C757D]">
                  Si votre métier nécessite une assurance décennale (maçonnerie, toiture, charpente, menuiserie, isolation, plomberie, électricité, carrelage, chauffage, climatisation), elle sera demandée après la saisie de votre profil dans la section <strong>Mon Profil</strong>.
                </p>
              </section>
            )}

            {/* Cas 3 : Métiers renseignés mais ne nécessitent PAS décennale → Rien à afficher */}
          </>
        )}
      </div>
    </div>
  );
}
