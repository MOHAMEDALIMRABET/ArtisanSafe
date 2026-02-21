'use client';

/**
 * Page de configuration du compte bancaire Stripe Connect
 * 
 * Formulaire multi-étapes :
 * 1. Informations personnelles
 * 2. Coordonnées bancaires (IBAN/BIC)
 * 3. Documents de vérification (optionnel)
 * 
 * ⚠️ SÉCURITÉ :
 * - IBAN/BIC envoyés directement à Stripe via backend
 * - JAMAIS stockés dans Firestore
 * - Transmission HTTPS uniquement
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getUserById } from '@/lib/firebase/user-service';
import { getArtisanByUserId } from '@/lib/firebase/artisan-service';
import { getWalletSummary } from '@/lib/firebase/wallet-service';
import type { User, Artisan, StripeBankAccountData } from '@/types/firestore';

export default function StripeOnboardingPage() {
  const router = useRouter();
  const { user: firebaseUser, loading: authLoading } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [artisan, setArtisan] = useState<Artisan | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);

  // Données du formulaire
  const [formData, setFormData] = useState<Partial<StripeBankAccountData>>({
    address: {
      line1: '',
      city: '',
      postalCode: '',
      country: 'FR',
    },
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Charger données utilisateur
  useEffect(() => {
    if (authLoading) return;

    if (!firebaseUser) {
      router.push('/connexion');
      return;
    }

    const loadUserData = async () => {
      try {
        const userData = await getUserById(firebaseUser.uid);
        if (!userData || userData.role !== 'artisan') {
          router.push('/');
          return;
        }

        setUser(userData);

        const artisanData = await getArtisanByUserId(firebaseUser.uid);
        if (!artisanData) {
          router.push('/artisan/dashboard');
          return;
        }

        setArtisan(artisanData);

        // ⚠️ VÉRIFICATION CRITIQUE : Bloquer si compte déjà configuré
        // Sauf si compte rejeté (permettre reconfiguration)
        const walletData = await getWalletSummary(firebaseUser.uid);
        
        if (walletData && walletData.wallet) {
          const stripeStatus = walletData.wallet.stripeOnboardingStatus;
          
          // Statuts qui bloquent la reconfiguration
          const blockedStatuses = ['pending', 'documents_required', 'under_review', 'active', 'restricted'];
          
          if (blockedStatuses.includes(stripeStatus)) {
            console.warn(`⚠️ Compte déjà configuré (statut: ${stripeStatus}). Redirection vers wallet.`);
            
            // Rediriger vers wallet avec message informatif
            router.push('/artisan/wallet?error=already_configured');
            return;
          }
          
          // Si compte rejeté (rejected) ou pas encore commencé (not_started), autoriser la configuration
          console.log(`✅ Configuration autorisée (statut: ${stripeStatus})`);
        }

        // Pré-remplir avec les données existantes
        setFormData((prev) => ({
          ...prev,
          firstName: artisanData.prenom || '',
          lastName: artisanData.nom || '',
          address: {
            ...prev.address!,
            line1: artisanData.adresse || '',
          },
        }));
      } catch (error) {
        console.error('Erreur chargement données:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, [firebaseUser, authLoading, router]);

  // Validation IBAN français
  const validateIBAN = (iban: string): boolean => {
    const cleanIban = iban.replace(/\s/g, '');
    return /^FR\d{2}[A-Z0-9]{23}$/.test(cleanIban);
  };

  // Validation étape 1
  const validateStep1 = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.firstName) errors.firstName = 'Prénom requis';
    if (!formData.lastName) errors.lastName = 'Nom requis';
    if (!formData.dateOfBirth) errors.dateOfBirth = 'Date de naissance requise';
    if (!formData.address?.line1) errors.addressLine1 = 'Adresse requise';
    if (!formData.address?.city) errors.city = 'Ville requise';
    if (!formData.address?.postalCode) errors.postalCode = 'Code postal requis';

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Validation étape 2
  const validateStep2 = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.iban) {
      errors.iban = 'IBAN requis';
    } else if (!validateIBAN(formData.iban)) {
      errors.iban = 'Format IBAN invalide (FR76 + 23 caractères)';
    }

    if (!formData.accountHolderName) {
      errors.accountHolderName = 'Nom du titulaire requis';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Soumission du formulaire
  const handleSubmit = async () => {
    if (!validateStep2()) return;

    setSubmitting(true);
    setError(null);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

      const response = await fetch(`${API_URL}/stripe/onboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          artisanId: artisan!.userId,
          email: user!.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          dateOfBirth: formData.dateOfBirth,
          address: formData.address,
          iban: formData.iban,
          bic: formData.bic,
          accountHolderName: formData.accountHolderName,
          businessProfile: artisan!.siret
            ? {
                name: artisan!.raisonSociale,
                siret: artisan!.siret,
              }
            : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la configuration du compte');
      }

      // Succès ! Rediriger vers le wallet
      router.push('/artisan/wallet?onboarding=success');
    } catch (err: any) {
      console.error('Erreur onboarding:', err);
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B00] mx-auto"></div>
          <p className="mt-4 text-[#6C757D]">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2C3E50] to-[#34495E] text-white py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => router.back()}
            className="mb-4 text-white hover:text-gray-300 transition flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Retour
          </button>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
            Configuration du compte bancaire
          </h1>
          <p className="text-gray-300 mt-2">
            Ajoutez vos coordonnées bancaires pour recevoir vos paiements
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center mb-8">
          {/* Étape 1 */}
          <div className="flex items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                currentStep >= 1
                  ? 'bg-[#FF6B00] text-white'
                  : 'bg-gray-300 text-gray-600'
              }`}
            >
              1
            </div>
            <span className="ml-2 text-sm font-medium text-[#2C3E50]">
              Informations
            </span>
          </div>

          {/* Ligne */}
          <div
            className={`w-24 h-1 mx-4 ${
              currentStep >= 2 ? 'bg-[#FF6B00]' : 'bg-gray-300'
            }`}
          ></div>

          {/* Étape 2 */}
          <div className="flex items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                currentStep >= 2
                  ? 'bg-[#FF6B00] text-white'
                  : 'bg-gray-300 text-gray-600'
              }`}
            >
              2
            </div>
            <span className="ml-2 text-sm font-medium text-[#2C3E50]">
              Coordonnées bancaires
            </span>
          </div>
        </div>

        {/* Formulaire */}
        <div className="bg-white rounded-lg shadow-md p-8">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Étape 1 : Informations personnelles */}
          {currentStep === 1 && (
            <div>
              <h2 className="text-2xl font-bold text-[#2C3E50] mb-6">
                Informations personnelles
              </h2>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#2C3E50] mb-2">
                      Prénom *
                    </label>
                    <input
                      type="text"
                      value={formData.firstName || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, firstName: e.target.value })
                      }
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent ${
                        validationErrors.firstName
                          ? 'border-red-500'
                          : 'border-gray-300'
                      }`}
                    />
                    {validationErrors.firstName && (
                      <p className="text-sm text-red-600 mt-1">
                        {validationErrors.firstName}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#2C3E50] mb-2">
                      Nom *
                    </label>
                    <input
                      type="text"
                      value={formData.lastName || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, lastName: e.target.value })
                      }
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent ${
                        validationErrors.lastName
                          ? 'border-red-500'
                          : 'border-gray-300'
                      }`}
                    />
                    {validationErrors.lastName && (
                      <p className="text-sm text-red-600 mt-1">
                        {validationErrors.lastName}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#2C3E50] mb-2">
                    Date de naissance *
                  </label>
                  <input
                    type="date"
                    value={formData.dateOfBirth || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, dateOfBirth: e.target.value })
                    }
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent ${
                      validationErrors.dateOfBirth
                        ? 'border-red-500'
                        : 'border-gray-300'
                    }`}
                  />
                  {validationErrors.dateOfBirth && (
                    <p className="text-sm text-red-600 mt-1">
                      {validationErrors.dateOfBirth}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#2C3E50] mb-2">
                    Adresse *
                  </label>
                  <input
                    type="text"
                    value={formData.address?.line1 || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address: { ...formData.address!, line1: e.target.value },
                      })
                    }
                    placeholder="Numéro et nom de rue"
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent ${
                      validationErrors.addressLine1
                        ? 'border-red-500'
                        : 'border-gray-300'
                    }`}
                  />
                  {validationErrors.addressLine1 && (
                    <p className="text-sm text-red-600 mt-1">
                      {validationErrors.addressLine1}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#2C3E50] mb-2">
                      Code postal *
                    </label>
                    <input
                      type="text"
                      value={formData.address?.postalCode || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          address: {
                            ...formData.address!,
                            postalCode: e.target.value,
                          },
                        })
                      }
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent ${
                        validationErrors.postalCode
                          ? 'border-red-500'
                          : 'border-gray-300'
                      }`}
                    />
                    {validationErrors.postalCode && (
                      <p className="text-sm text-red-600 mt-1">
                        {validationErrors.postalCode}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#2C3E50] mb-2">
                      Ville *
                    </label>
                    <input
                      type="text"
                      value={formData.address?.city || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          address: { ...formData.address!, city: e.target.value },
                        })
                      }
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent ${
                        validationErrors.city
                          ? 'border-red-500'
                          : 'border-gray-300'
                      }`}
                    />
                    {validationErrors.city && (
                      <p className="text-sm text-red-600 mt-1">
                        {validationErrors.city}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (validateStep1()) setCurrentStep(2);
                  }}
                  className="w-full bg-[#FF6B00] text-white py-4 rounded-lg font-semibold hover:bg-[#E56100] transition"
                >
                  Continuer →
                </button>
              </div>
            </div>
          )}

          {/* Étape 2 : Coordonnées bancaires */}
          {currentStep === 2 && (
            <div>
              <h2 className="text-2xl font-bold text-[#2C3E50] mb-6">
                Coordonnées bancaires
              </h2>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex gap-3">
                  <svg
                    className="w-6 h-6 text-blue-600 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  <div>
                    <h4 className="font-semibold text-blue-900">
                      🔒 Sécurité maximale
                    </h4>
                    <p className="text-sm text-blue-800 mt-1">
                      Vos coordonnées bancaires sont transmises directement à
                      Stripe (PCI-DSS Level 1) et ne sont jamais stockées dans
                      notre base de données.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-[#2C3E50] mb-2">
                    IBAN *
                  </label>
                  <input
                    type="text"
                    value={formData.iban || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, iban: e.target.value })
                    }
                    placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent font-mono ${
                      validationErrors.iban ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {validationErrors.iban && (
                    <p className="text-sm text-red-600 mt-1">
                      {validationErrors.iban}
                    </p>
                  )}
                  <p className="text-xs text-[#6C757D] mt-1">
                    IBAN français (27 caractères)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#2C3E50] mb-2">
                    BIC (optionnel)
                  </label>
                  <input
                    type="text"
                    value={formData.bic || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, bic: e.target.value })
                    }
                    placeholder="BNPAFRPPXXX"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#2C3E50] mb-2">
                    Nom du titulaire du compte *
                  </label>
                  <input
                    type="text"
                    value={formData.accountHolderName || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        accountHolderName: e.target.value,
                      })
                    }
                    placeholder="Prénom Nom ou Raison sociale"
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent ${
                      validationErrors.accountHolderName
                        ? 'border-red-500'
                        : 'border-gray-300'
                    }`}
                  />
                  {validationErrors.accountHolderName && (
                    <p className="text-sm text-red-600 mt-1">
                      {validationErrors.accountHolderName}
                    </p>
                  )}
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="flex-1 border-2 border-[#2C3E50] text-[#2C3E50] py-4 rounded-lg font-semibold hover:bg-gray-50 transition"
                  >
                    ← Retour
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 bg-[#FF6B00] text-white py-4 rounded-lg font-semibold hover:bg-[#E56100] transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Configuration en cours...
                      </span>
                    ) : (
                      'Finaliser la configuration'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
