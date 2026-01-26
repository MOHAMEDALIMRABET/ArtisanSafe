'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/lib/auth-service';
import { getArtisanByUserId } from '@/lib/firebase/artisan-service';
import { getUserById } from '@/lib/firebase/user-service';
import { uploadAndVerifyKbis, uploadIdCard, uploadKbisDocument, uploadRcPro, uploadDecennale } from '@/lib/firebase/verification-service';
import { artisanDoitDecennale } from '@/lib/decennale-helper';
import type { Artisan } from '@/types/firestore';
import type { KbisParseResult } from '@/lib/firebase/document-parser';

// Fonction pour créer une notification admin
async function createAdminNotification(artisanId: string, notification: {
  type: string;
  message: string;
  artisanName: string;
  priority: 'low' | 'medium' | 'high';
}) {
  try {
    const { getFirestore, collection, addDoc, Timestamp } = await import('firebase/firestore');
    const db = getFirestore();
    
    await addDoc(collection(db, 'admin_notifications'), {
      artisanId,
      type: notification.type,
      message: notification.message,
      artisanName: notification.artisanName,
      priority: notification.priority,
      createdAt: Timestamp.now(),
      read: false,
      resolved: false,
    });
  } catch (error) {
    console.error('Erreur création notification admin:', error);
  }
}

export default function DocumentsUploadPage() {
  const router = useRouter();
  const [artisan, setArtisan] = useState<Artisan | null>(null);
  const [loading, setLoading] = useState(true);

  // États pour Kbis
  const [kbisFile, setKbisFile] = useState<File | null>(null);
  const [kbisUploading, setKbisUploading] = useState(false);
  const [kbisParseResult, setKbisParseResult] = useState<KbisParseResult | null>(null);
  const [kbisError, setKbisError] = useState('');
  const [kbisSuccess, setKbisSuccess] = useState(false);

  // États pour pièce d'identité
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idUploading, setIdUploading] = useState(false);
  const [idError, setIdError] = useState('');
  const [idSuccess, setIdSuccess] = useState(false);

  // États pour RC Pro
  const [rcProFile, setRcProFile] = useState<File | null>(null);
  const [rcProUploading, setRcProUploading] = useState(false);
  const [rcProError, setRcProError] = useState('');
  const [rcProSuccess, setRcProSuccess] = useState(false);

  // États pour Décennale
  const [decennaleFile, setDecennaleFile] = useState<File | null>(null);
  const [decennaleUploading, setDecennaleUploading] = useState(false);
  const [decennaleError, setDecennaleError] = useState('');
  const [decennaleSuccess, setDecennaleSuccess] = useState(false);

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

      // Cache d'abord
      const cachedData = localStorage.getItem(`artisan_${user.uid}`);
      if (cachedData) {
        try {
          const cached = JSON.parse(cachedData);
          setArtisan(cached);
          setLoading(false);
        } catch (e) {
          console.warn('Cache invalide');
        }
      }

      const artisanData = await getArtisanByUserId(user.uid);
      if (!artisanData) {
        router.push('/artisan/profil');
        return;
      }

      setArtisan(artisanData);
      localStorage.setItem(`artisan_${user.uid}`, JSON.stringify(artisanData));
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // UPLOAD KBIS
  // ============================================

  const handleKbisFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setKbisFile(file);
      setKbisError('');
      setKbisParseResult(null);
      setKbisSuccess(false);
    }
  };

  const handleUploadKbis = async () => {
    if (!kbisFile || !artisan) return;

    setKbisUploading(true);
    setKbisError('');
    setKbisSuccess(false);

    try {
      // Étape 1 : Parser le document via l'API backend
      console.log('📄 Envoi du KBIS au serveur pour parsing...');
      const formData = new FormData();
      formData.append('file', kbisFile);

      let parseResult: any = null;
      try {
        const parseResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/documents/parse-kbis`, {
          method: 'POST',
          body: formData,
        });
        parseResult = await parseResponse.json();
        console.log('📊 Résultat du parsing:', parseResult);
      } catch (parseError) {
        console.warn('⚠️ Parsing échoué, on continue l\'upload:', parseError);
        // On continue même si le parsing échoue
      }

      // Étape 2 : Upload du fichier dans Firebase Storage
      const result = await uploadKbisDocument(artisan.userId, kbisFile);

      if (result.success) {
        // Étape 3 : Sauvegarder les infos parsées dans Firestore pour l'admin
        if (parseResult?.success) {
          try {
            const { getFirestore, doc, updateDoc, arrayUnion, Timestamp } = await import('firebase/firestore');
            const db = getFirestore();
            
            // Créer l'objet parseResult en filtrant les valeurs undefined
            const currentParseResult: any = {
              parsedAt: Timestamp.now(),
              qualityScore: parseResult.qualityScore,
            };

            // Ajouter uniquement les champs définis
            if (parseResult.siret !== undefined) currentParseResult.siret = parseResult.siret;
            if (parseResult.siren !== undefined) currentParseResult.siren = parseResult.siren;
            if (parseResult.companyName !== undefined) currentParseResult.companyName = parseResult.companyName;
            if (parseResult.representantLegal !== undefined) currentParseResult.representantLegal = parseResult.representantLegal;
            if (parseResult.warnings !== undefined) currentParseResult.warnings = parseResult.warnings;
            if (parseResult.metadata?.fileSize !== undefined) currentParseResult.fileSize = parseResult.metadata.fileSize;
            if (parseResult.metadata?.fileName !== undefined) currentParseResult.fileName = parseResult.metadata.fileName;
            if (parseResult.documentQuality !== undefined) currentParseResult.documentQuality = parseResult.documentQuality;

            // Vérifier si le SIRET parsé correspond au SIRET déclaré
            const siretMatched = parseResult.siret ? parseResult.siret === artisan.siret : null;
            
            await updateDoc(doc(db, 'artisans', artisan.userId), {
              'verificationDocuments.kbis.parseResult': currentParseResult,
              'verificationDocuments.kbis.parseHistory': arrayUnion(currentParseResult), // Historique
              ...(siretMatched !== null && { 'verificationDocuments.kbis.siretMatched': siretMatched }),
            });

            // Si SIRET ne correspond pas, créer notification admin
            if (!siretMatched && parseResult.siret) {
              await createAdminNotification(artisan.userId, {
                type: 'siret_mismatch',
                message: `SIRET parsé (${parseResult.siret}) différent du SIRET déclaré (${artisan.siret})`,
                artisanName: `${artisan.nom} ${artisan.prenom}`,
                priority: 'high',
              });
              console.warn('⚠️ SIRET ne correspond pas, notification admin créée');
            }

            // Si score de qualité faible, créer notification admin
            if (parseResult.qualityScore && parseResult.qualityScore < 40) {
              await createAdminNotification(artisan.userId, {
                type: 'quality_score_low',
                message: `Score de qualité très faible (${parseResult.qualityScore}%) - Document potentiellement suspect`,
                artisanName: `${artisan.nom} ${artisan.prenom}`,
                priority: 'high',
              });
              console.warn('⚠️ Score de qualité faible, notification admin créée');
            }

            // Si warnings présents, créer notification admin
            if (parseResult.warnings && parseResult.warnings.length > 0) {
              await createAdminNotification(artisan.userId, {
                type: 'suspicious_document',
                message: `Avertissements détectés: ${parseResult.warnings.join(', ')}`,
                artisanName: `${artisan.nom} ${artisan.prenom}`,
                priority: 'medium',
              });
            }

            console.log('✅ Informations parsées sauvegardées pour l\'admin');
          } catch (firestoreError) {
            console.warn('⚠️ Impossible de sauvegarder les infos parsées:', firestoreError);
          }
        }

        // Invalider le cache
        const user = authService.getCurrentUser();
        if (user) localStorage.removeItem(`artisan_${user.uid}`);
        
        setKbisSuccess(true);
        await loadArtisan();
        // Reset le succès après 3 secondes pour montrer le badge "En cours de vérification"
        setTimeout(() => setKbisSuccess(false), 3000);
      } else {
        setKbisError(result.error || 'Erreur lors de l\'upload');
      }
    } catch (error: any) {
      console.error('Erreur upload Kbis:', error);
      setKbisError(error?.message || 'Erreur technique lors de l\'upload');
    } finally {
      setKbisUploading(false);
    }
  };

  // ============================================
  // UPLOAD PIÈCE D'IDENTITÉ
  // ============================================

  const handleIdFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIdFile(file);
      setIdError('');
      setIdSuccess(false);
    }
  };

  const handleUploadId = async () => {
    if (!idFile || !artisan) return;

    setIdUploading(true);
    setIdError('');
    setIdSuccess(false);

    try {
      const result = await uploadIdCard(artisan.userId, idFile);

      if (result.success) {
        // Invalider le cache
        const user = authService.getCurrentUser();
        if (user) localStorage.removeItem(`artisan_${user.uid}`);
        
        setIdSuccess(true);
        await loadArtisan();
        // Reset le succès après 3 secondes pour montrer le badge "En cours de vérification"
        setTimeout(() => setIdSuccess(false), 3000);
      } else {
        setIdError(result.error || 'Erreur inconnue');
      }
    } catch (error) {
      console.error('Erreur upload pièce d\'identité:', error);
      setIdError('Erreur technique');
    } finally {
      setIdUploading(false);
    }
  };

  // ============================================
  // UPLOAD RC PRO
  // ============================================

  const handleRcProFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRcProFile(file);
      setRcProError('');
      setRcProSuccess(false);
    }
  };

  const handleUploadRcPro = async () => {
    if (!rcProFile || !artisan) return;

    setRcProUploading(true);
    setRcProError('');
    setRcProSuccess(false);

    try {
      const result = await uploadRcPro(artisan.userId, rcProFile);

      if (result.success) {
        // Invalider le cache
        const user = authService.getCurrentUser();
        if (user) localStorage.removeItem(`artisan_${user.uid}`);
        
        setRcProSuccess(true);
        await loadArtisan();
        // Reset le succès après 3 secondes pour montrer le badge "En cours de vérification"
        setTimeout(() => setRcProSuccess(false), 3000);
      } else {
        setRcProError(result.error || 'Erreur inconnue');
      }
    } catch (error) {
      console.error('Erreur upload RC Pro:', error);
      setRcProError('Erreur technique');
    } finally {
      setRcProUploading(false);
    }
  };

  // ============================================
  // UPLOAD DÉCENNALE
  // ============================================

  const handleDecennaleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDecennaleFile(file);
      setDecennaleError('');
      setDecennaleSuccess(false);
    }
  };

  const handleUploadDecennale = async () => {
    if (!decennaleFile || !artisan) return;

    setDecennaleUploading(true);
    setDecennaleError('');
    setDecennaleSuccess(false);

    try {
      const result = await uploadDecennale(artisan.userId, decennaleFile);

      if (result.success) {
        // Créer notification admin pour nouveau document décennale
        await createAdminNotification(artisan.userId, {
          type: 'new_document',
          message: `Nouvelle attestation de garantie décennale uploadée (${(decennaleFile.size / 1024 / 1024).toFixed(2)} MB)`,
          artisanName: `${artisan.nom} ${artisan.prenom}`,
          priority: 'medium',
        });
        
        // Invalider le cache
        const user = authService.getCurrentUser();
        if (user) localStorage.removeItem(`artisan_${user.uid}`);
        
        setDecennaleSuccess(true);
        await loadArtisan();
        // Reset le succès après 3 secondes pour montrer le badge "En cours de vérification"
        setTimeout(() => setDecennaleSuccess(false), 3000);
      } else {
        setDecennaleError(result.error || 'Erreur inconnue');
      }
    } catch (error) {
      console.error('Erreur upload Décennale:', error);
      setDecennaleError('Erreur technique');
    } finally {
      setDecennaleUploading(false);
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

  if (!artisan) return null;

  // Déterminer les statuts des documents
  const kbisVerified = artisan.verificationDocuments?.kbis?.verified === true;
  const kbisRejected = artisan.verificationDocuments?.kbis?.rejected === true;
  const kbisRejectionReason = artisan.verificationDocuments?.kbis?.rejectionReason || '';
  const kbisUploaded = !!(artisan.verificationDocuments?.kbis?.url && !kbisVerified && !kbisRejected);

  const idVerified = artisan.verificationDocuments?.idCard?.verified === true;
  const idRejected = artisan.verificationDocuments?.idCard?.rejected === true;
  const idRejectionReason = artisan.verificationDocuments?.idCard?.rejectionReason || '';
  const idUploaded = !!(artisan.verificationDocuments?.idCard?.url && !idVerified && !idRejected);

  const rcProVerified = artisan.verificationDocuments?.rcPro?.verified === true;
  const rcProRejected = artisan.verificationDocuments?.rcPro?.rejected === true;
  const rcProRejectionReason = artisan.verificationDocuments?.rcPro?.rejectionReason || '';
  const rcProUploaded = !!(artisan.verificationDocuments?.rcPro?.url && !rcProVerified && !rcProRejected);

  const decennaleVerified = artisan.verificationDocuments?.decennale?.verified === true;
  const decennaleRejected = artisan.verificationDocuments?.decennale?.rejected === true;
  const decennaleRejectionReason = artisan.verificationDocuments?.decennale?.rejectionReason || '';
  const decennaleUploaded = !!(artisan.verificationDocuments?.decennale?.url && !decennaleVerified && !decennaleRejected);

  // Vérifier si l'artisan doit fournir la décennale
  const needsDecennale = artisan.metiers && artisan.metiers.length > 0 && artisanDoitDecennale(artisan.metiers);

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

          <h1 className="text-3xl font-bold text-gray-900">Documents Justificatifs</h1>
          <p className="text-gray-600 mt-2">
            Uploadez vos documents pour finaliser la vérification de votre profil
          </p>
        </div>

        {/* Prérequis */}
        {(!artisan.siretVerified) && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex">
              <svg className="h-5 w-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" />
              </svg>
              <div>
                <p className="text-sm text-yellow-700">
                  <strong>Attention :</strong> Complétez d'abord la vérification SIRET avant d'uploader vos documents.
                </p>
                <button
                  onClick={() => router.push('/artisan/verification')}
                  className="text-sm text-yellow-700 underline mt-1"
                >
                  → Aller aux vérifications
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* 1. KBIS */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  kbisVerified ? 'bg-green-100' : kbisRejected ? 'bg-red-100' : kbisUploaded ? 'bg-blue-100' : 'bg-orange-100'
                }`}>
                  {kbisVerified ? (
                    <span className="text-2xl">✅</span>
                  ) : kbisRejected ? (
                    <span className="text-2xl">❌</span>
                  ) : kbisUploaded ? (
                    <span className="text-2xl">⏳</span>
                  ) : (
                    <span className="text-2xl">📄</span>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-lg">Extrait Kbis</h3>
                  <p className="text-sm text-gray-600">Moins de 3 mois</p>
                </div>
              </div>

              {kbisVerified && (
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
                  ✓ Vérifié
                </span>
              )}
              {kbisRejected && (
                <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-semibold">
                  ✗ Rejeté
                </span>
              )}
              {kbisUploaded && !kbisVerified && !kbisSuccess && (
                <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold">
                  En cours de vérification
                </span>
              )}
            </div>

            {kbisSuccess && (
              <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4">
                <p className="text-sm text-green-700 font-semibold">
                  ✅ Document uploadé ! Il sera vérifié par notre équipe sous 24-48h.
                </p>
              </div>
            )}

            {kbisRejected && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">❌</span>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-red-800 mb-2">
                      Document rejeté par notre équipe
                    </p>
                    <p className="text-sm text-red-700 mb-3">
                      <strong>Raison :</strong> {kbisRejectionReason || 'Non spécifiée'}
                    </p>
                    <p className="text-sm text-red-600">
                      📤 Veuillez uploader un nouveau document conforme aux exigences.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {(!kbisVerified && !kbisUploaded && !kbisSuccess) && (
              <div>
                {kbisError && (
                  <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                    <p className="text-sm text-red-700">❌ {kbisError}</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sélectionner le fichier Kbis (PDF, JPG, PNG)
                    </label>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleKbisFileChange}
                      className="block w-full text-sm text-gray-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-lg file:border-0
                        file:text-sm file:font-semibold
                        file:bg-orange-50 file:text-[#FF6B00]
                        hover:file:bg-orange-100
                        cursor-pointer"
                    />
                    {kbisFile && (
                      <p className="text-sm text-gray-600 mt-2">
                        📎 {kbisFile.name} ({(kbisFile.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    )}
                  </div>

                  <button
                    onClick={handleUploadKbis}
                    disabled={!kbisFile || kbisUploading}
                    className="w-full bg-[#FF6B00] text-white py-3 rounded-lg font-semibold hover:bg-[#E56100] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {kbisUploading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Traitement en cours...
                      </span>
                    ) : (
                      '📤 Uploader le Kbis'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 2. PIÈCE D'IDENTITÉ */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  idVerified ? 'bg-green-100' : idRejected ? 'bg-red-100' : idUploaded ? 'bg-blue-100' : 'bg-orange-100'
                }`}>
                  {idVerified ? (
                    <span className="text-2xl">✅</span>
                  ) : idRejected ? (
                    <span className="text-2xl">❌</span>
                  ) : idUploaded ? (
                    <span className="text-2xl">⏳</span>
                  ) : (
                    <span className="text-2xl">🆔</span>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-lg">Pièce d'Identité</h3>
                  <p className="text-sm text-gray-600">CNI ou Passeport en cours de validité</p>
                </div>
              </div>

              {idVerified && (
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
                  ✓ Vérifié
                </span>
              )}
              {idRejected && (
                <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-semibold">
                  ✗ Rejeté
                </span>
              )}
              {idUploaded && !idVerified && !idSuccess && (
                <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold">
                  En cours de vérification
                </span>
              )}
            </div>

            {idSuccess && (
              <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4">
                <p className="text-sm text-green-700">
                  ✅ Document uploadé ! Il sera vérifié par notre équipe sous 24-48h.
                </p>
              </div>
            )}

            {idRejected && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">❌</span>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-red-800 mb-2">
                      Document rejeté par notre équipe
                    </p>
                    <p className="text-sm text-red-700 mb-3">
                      <strong>Raison :</strong> {idRejectionReason || 'Non spécifiée'}
                    </p>
                    <p className="text-sm text-red-600">
                      📤 Veuillez uploader un nouveau document conforme aux exigences.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {(!idVerified && !idUploaded && !idSuccess) && (
              <div>
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
                  <p className="text-sm text-blue-700">
                    <strong>📸 Instructions :</strong>
                  </p>
                  <ul className="text-sm text-blue-700 list-disc list-inside space-y-1 mt-2">
                    <li>Photo ou scan recto-verso de votre CNI/Passeport</li>
                    <li>Image claire et lisible</li>
                    <li>Format : JPG, PNG ou PDF (max 5MB)</li>
                  </ul>
                </div>

                {idError && (
                  <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                    <p className="text-sm text-red-700">❌ {idError}</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sélectionner votre pièce d'identité (JPG, PNG, PDF)
                    </label>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={handleIdFileChange}
                      className="block w-full text-sm text-gray-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-lg file:border-0
                        file:text-sm file:font-semibold
                        file:bg-orange-50 file:text-[#FF6B00]
                        hover:file:bg-orange-100
                        cursor-pointer"
                    />
                    {idFile && (
                      <p className="text-sm text-gray-600 mt-2">
                        📎 {idFile.name} ({(idFile.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    )}
                  </div>

                  <button
                    onClick={handleUploadId}
                    disabled={!idFile || idUploading}
                    className="w-full bg-[#FF6B00] text-white py-3 rounded-lg font-semibold hover:bg-[#E56100] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {idUploading ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Envoi en cours...
                      </>
                    ) : '📤 Uploader la pièce d\'identité'}
                  </button>
                </div>
              </div>
            )}
          </div>

        {/* 3. RC PRO */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                rcProVerified ? 'bg-green-100' : rcProRejected ? 'bg-red-100' : rcProUploaded ? 'bg-blue-100' : 'bg-orange-100'
              }`}>
                {rcProVerified ? (
                  <span className="text-2xl">✅</span>
                ) : rcProRejected ? (
                  <span className="text-2xl">❌</span>
                ) : rcProUploaded ? (
                  <span className="text-2xl">⏳</span>
                ) : (
                  <span className="text-2xl">🛡️</span>
                )}
              </div>
              <div>
                <h3 className="font-bold text-lg">Responsabilité Civile Professionnelle (RC Pro)</h3>
                <p className="text-sm text-gray-600">Attestation RC Pro en cours de validité</p>
              </div>
            </div>

            {rcProVerified && (
              <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
                ✓ Vérifié
              </span>
            )}
            {rcProRejected && (
              <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-semibold">
                ✗ Rejeté
              </span>
            )}
            {rcProUploaded && !rcProVerified && !rcProSuccess && (
              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold">
                En cours de vérification
              </span>
            )}
          </div>

          {rcProSuccess && (
            <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4">
              <p className="text-sm text-green-700">
                ✅ Document uploadé ! Il sera vérifié par notre équipe sous 24-48h.
              </p>
            </div>
          )}

          {rcProRejected && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">❌</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-red-800 mb-2">
                    Document rejeté par notre équipe
                  </p>
                  <p className="text-sm text-red-700 mb-3">
                    <strong>Raison :</strong> {rcProRejectionReason || 'Non spécifiée'}
                  </p>
                  <p className="text-sm text-red-600">
                    📤 Veuillez uploader un nouveau document conforme aux exigences.
                  </p>
                </div>
              </div>
            </div>
          )}

          {(!rcProVerified && !rcProUploaded && !rcProSuccess) && (
            <div>
              <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 mb-4">
                <h4 className="text-blue-900 font-medium mb-2">🛡️ Instructions</h4>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>Attestation RC Pro en cours de validité</li>
                  <li>Document clair et lisible</li>
                  <li>Nom et SIRET visibles</li>
                  <li>Format : PDF, JPG ou PNG</li>
                </ul>
              </div>

              {rcProError && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                  <p className="text-sm text-red-700">❌ {rcProError}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sélectionner votre RC Pro (JPG, PNG, PDF)
                  </label>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={handleRcProFileChange}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-semibold
                      file:bg-orange-50 file:text-[#FF6B00]
                      hover:file:bg-orange-100
                      cursor-pointer"
                  />
                  {rcProFile && (
                    <p className="text-sm text-gray-600 mt-2">
                      📎 {rcProFile.name} ({(rcProFile.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                </div>

                <button
                  onClick={handleUploadRcPro}
                  disabled={!rcProFile || rcProUploading}
                  className="w-full bg-[#FF6B00] text-white py-3 rounded-lg font-semibold hover:bg-[#E56100] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {rcProUploading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Envoi en cours...
                    </>
                  ) : '📤 Uploader l\'attestation RC Pro'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 4. GARANTIE DÉCENNALE (Affichage conditionnel) */}
        {needsDecennale && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  decennaleVerified ? 'bg-green-100' : decennaleRejected ? 'bg-red-100' : decennaleUploaded ? 'bg-blue-100' : 'bg-orange-100'
                }`}>
                  {decennaleVerified ? (
                    <span className="text-2xl">✅</span>
                  ) : decennaleRejected ? (
                    <span className="text-2xl">❌</span>
                  ) : decennaleUploaded ? (
                    <span className="text-2xl">⏳</span>
                  ) : (
                    <span className="text-2xl">🏗️</span>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-lg">Garantie Décennale</h3>
                  <p className="text-sm text-gray-600">Assurance obligatoire pour vos métiers</p>
                </div>
              </div>

              {decennaleVerified && (
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
                  ✓ Vérifié
                </span>
              )}
              {decennaleRejected && (
                <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-semibold">
                  ✗ Rejeté
                </span>
              )}
              {decennaleUploaded && !decennaleVerified && !decennaleSuccess && (
                <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold">
                  En cours de vérification
                </span>
              )}
            </div>

            {decennaleVerified ? (
              null
            ) : decennaleRejected ? (
              <div className="space-y-4">
                <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0">
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-red-900 font-medium mb-1">Document refusé</h4>
                      <p className="text-sm text-red-700">{decennaleRejectionReason}</p>
                      <p className="text-sm text-red-600 mt-2">Veuillez uploader un nouveau document conforme.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sélectionner votre nouvelle attestation (JPG, PNG, PDF)
                  </label>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={handleDecennaleFileChange}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-semibold
                      file:bg-orange-50 file:text-[#FF6B00]
                      hover:file:bg-orange-100
                      cursor-pointer"
                  />
                  {decennaleFile && (
                    <p className="text-sm text-gray-600 mt-2">
                      📎 {decennaleFile.name} ({(decennaleFile.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                </div>

                <button
                  onClick={handleUploadDecennale}
                  disabled={!decennaleFile || decennaleUploading}
                  className="w-full bg-[#FF6B00] text-white py-3 rounded-lg font-semibold hover:bg-[#E56100] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {decennaleUploading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Télécharger
                    </>
                  )}
                </button>

                {decennaleError && (
                  <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-3 text-red-700 text-sm">
                    {decennaleError}
                  </div>
                )}

                {decennaleSuccess && (
                  <div className="bg-green-50 border-l-4 border-green-500 rounded-lg p-3 text-green-700 text-sm">
                    {decennaleSuccess}
                  </div>
                )}
              </div>
            ) : decennaleUploaded && !decennaleSuccess ? null : (
              <div className="space-y-4">
                <div className="bg-yellow-50 border-l-4 border-[#FFC107] rounded-lg p-4">
                  <h4 className="text-yellow-900 font-medium mb-2">⚠️ Document obligatoire</h4>
                  <p className="text-sm text-yellow-800 mb-3">
                    Vos métiers nécessitent une garantie décennale obligatoire. Sans ce document, votre profil ne pourra pas être activé.
                  </p>
                  <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                    <li>Attestation décennale en cours de validité</li>
                    <li>Couvrant vos métiers déclarés</li>
                    <li>Document clair et lisible</li>
                    <li>Format : PDF, JPG ou PNG</li>
                  </ul>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sélectionner votre attestation décennale (JPG, PNG, PDF)
                  </label>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={handleDecennaleFileChange}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-semibold
                      file:bg-orange-50 file:text-[#FF6B00]
                      hover:file:bg-orange-100
                      cursor-pointer"
                  />
                  {decennaleFile && (
                    <p className="text-sm text-gray-600 mt-2">
                      📎 {decennaleFile.name} ({(decennaleFile.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                </div>

                <button
                  onClick={handleUploadDecennale}
                  disabled={!decennaleFile || decennaleUploading}
                  className="w-full bg-[#FF6B00] text-white py-3 rounded-lg font-semibold hover:bg-[#E56100] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {decennaleUploading ? (
                    <>
                      <svg className="animate-spin h-5 h-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Envoi en cours...
                    </>
                  ) : '📤 Uploader l\'attestation décennale'}
                </button>

                {decennaleError && (
                  <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                    <p className="text-sm text-red-700">❌ {decennaleError}</p>
                  </div>
                )}

                {decennaleSuccess && (
                  <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-4">
                    <p className="text-sm text-green-700">✅ {decennaleSuccess}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      </div>
    </div>
  );
}
