'use client';

/**
 * Page Mon Wallet - Gestion financière artisan
 * 
 * Fonctionnalités :
 * - Visualisation du solde disponible
 * - Historique des transactions
 * - Suivi des paiements en séquestre
 * - Statistiques financières
 * 
 * ⚠️ IMPORTANT : Le wallet est un système de SUIVI uniquement.
 * Les transferts vers le compte bancaire sont gérés AUTOMATIQUEMENT par Stripe Connect.
 */

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { getUserById } from '@/lib/firebase/user-service';
import { getArtisanByUserId } from '@/lib/firebase/artisan-service';
import { getWalletSummary } from '@/lib/firebase/wallet-service';
import type { User, Artisan, WalletTransaction, StripeOnboardingStatus } from '@/types/firestore';

export default function WalletPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const { user: firebaseUser, loading: authLoading } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [artisan, setArtisan] = useState<Artisan | null>(null);
  const [loading, setLoading] = useState(true);
  const [walletLoading, setWalletLoading] = useState(true);

  // Données du wallet
  const [soldeDisponible, setSoldeDisponible] = useState(0);
  const [soldeEnAttente, setSoldeEnAttente] = useState(0);
  const [totalEncaisse, setTotalEncaisse] = useState(0);
  const [totalRetire, setTotalRetire] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  
  // Stripe Connect
  const [stripeOnboardingStatus, setStripeOnboardingStatus] = useState<StripeOnboardingStatus>('not_started');
  const [ibanLast4, setIbanLast4] = useState<string | undefined>(undefined);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  
  // UI states
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showConfigProcess, setShowConfigProcess] = useState(false);
  const [showAlreadyConfiguredError, setShowAlreadyConfiguredError] = useState(false);

  // Charger les infos artisan
  useEffect(() => {
    if (authLoading) return;

    if (!firebaseUser) {
      router.push('/connexion');
      return;
    }

    const loadUserData = async () => {
      try {
        const userData = await getUserById(firebaseUser.uid);
        if (!userData) {
          router.push('/connexion');
          return;
        }

        if (userData.role !== 'artisan') {
          router.push('/');
          return;
        }

        setUser(userData);

        const artisanData = await getArtisanByUserId(firebaseUser.uid);
        if (!artisanData) {
          console.error('Profil artisan introuvable');
          router.push('/artisan/dashboard');
          return;
        }
        setArtisan(artisanData);
      } catch (error) {
        console.error('Erreur chargement données:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, [firebaseUser, authLoading, router]);

  // Vérifier si onboarding vient d'être complété ou si erreur
  useEffect(() => {
    if (searchParams.get('onboarding') === 'success') {
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 5000);
    }
    
    if (searchParams.get('error') === 'already_configured') {
      setShowAlreadyConfiguredError(true);
      setTimeout(() => setShowAlreadyConfiguredError(false), 8000);
    }
  }, [searchParams]);

  // Charger les données du wallet
  useEffect(() => {
    if (!artisan) return;

    const loadWalletData = async () => {
      try {
        setWalletLoading(true);
        const summary = await getWalletSummary(artisan.userId);

        // Mettre à jour les états
        if (summary.wallet) {
          setSoldeDisponible(summary.wallet.soldeDisponible);
          setSoldeEnAttente(summary.wallet.soldeEnAttente);
          setStripeOnboardingStatus(summary.wallet.stripeOnboardingStatus);
          setIbanLast4(summary.wallet.ibanLast4);
        }
        setTotalEncaisse(summary.stats.totalEncaisse);
        setTotalRetire(summary.stats.totalRetire);
        setTransactions(summary.recentTransactions);
      } catch (error) {
        console.error('Erreur chargement wallet:', error);
      } finally {
        setWalletLoading(false);
      }
    };

    loadWalletData();
  }, [artisan]);

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

  if (!artisan) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2C3E50] to-[#34495E] text-white py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => router.back()}
            className="mb-4 text-white hover:text-gray-300 transition flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Retour au tableau de bord
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
            Mon Wallet
          </h1>
          <p className="text-gray-300 mt-2">Gérez vos revenus et transactions</p>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Message d'erreur : compte déjà configuré */}
        {showAlreadyConfiguredError && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <h4 className="font-semibold text-orange-900 mb-1">⚠️ Compte bancaire déjà configuré</h4>
                <p className="text-sm text-orange-800">
                  Votre compte Stripe est déjà configuré. Pour des raisons de sécurité, vous ne pouvez pas créer un nouveau compte bancaire.
                </p>
                <p className="text-sm text-orange-700 mt-2">
                  <strong>Pour modifier vos informations bancaires :</strong> Contactez le support à <a href="mailto:support@artisandispo.fr" className="underline hover:text-orange-900">support@artisandispo.fr</a>
                </p>
              </div>
              <button
                onClick={() => setShowAlreadyConfiguredError(false)}
                className="text-orange-600 hover:text-orange-800 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Message de succès onboarding */}
        {showSuccessMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <h4 className="font-semibold text-green-900">{t('artisanWallet.onboarding.successTitle')}</h4>
                <p className="text-sm text-green-800">
                  {t('artisanWallet.onboarding.successMessage')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Solde disponible */}
        <div className="bg-gradient-to-br from-[#FF6B00] to-[#E56100] rounded-xl shadow-lg p-8 text-white mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90 mb-2">{t('artisanWallet.balance.available')}</p>
              {walletLoading ? (
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                  <p className="text-2xl">{t('artisanWallet.loading')}</p>
                </div>
              ) : (
                <>
                  <p className="text-5xl font-bold">
                    {soldeDisponible.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  </p>
                  <p className="text-sm opacity-75 mt-2">
                    {transactions.length === 0
                      ? t('artisanWallet.balance.noTransactions')
                      : t('artisanWallet.balance.transactionsCount')
                          .replace('{count}', String(transactions.length))
                          .replace('{plural}', transactions.length > 1 ? t('artisanWallet.balance.transactionPlural') : t('artisanWallet.balance.transactionSingular'))}
                  </p>
                </>
              )}
            </div>
            <div className="text-right">
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 px-6 py-3 rounded-lg">
                <p className="text-xs opacity-75 mb-1">{t('artisanWallet.balance.autoTransfer')}</p>
                <p className="text-sm font-semibold">{t('artisanWallet.balance.managedByStripe')}</p>
              </div>
              <p className="text-xs opacity-75 mt-2">{t('artisanWallet.balance.fundsTransferredAuto')}</p>
            </div>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Total encaissé */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-[#28A745]">
            <div className="flex items-center gap-3 mb-2">
              <svg className="w-6 h-6 text-[#28A745]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-[#6C757D] font-medium">{t('artisanWallet.stats.totalEarned')}</h3>
            </div>
            {walletLoading ? (
              <div className="animate-pulse h-10 bg-gray-200 rounded w-32"></div>
            ) : (
              <p className="text-3xl font-bold text-[#2C3E50]">
                {totalEncaisse.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </p>
            )}
            <p className="text-sm text-[#6C757D] mt-1">{t('artisanWallet.stats.sinceStart')}</p>
          </div>

          {/* En attente */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-[#FFC107]">
            <div className="flex items-center gap-3 mb-2">
              <svg className="w-6 h-6 text-[#FFC107]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-[#6C757D] font-medium">{t('artisanWallet.stats.inEscrow')}</h3>
            </div>
            {walletLoading ? (
              <div className="animate-pulse h-10 bg-gray-200 rounded w-32"></div>
            ) : (
              <p className="text-3xl font-bold text-[#2C3E50]">
                {soldeEnAttente.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </p>
            )}
            <p className="text-sm text-[#6C757D] mt-1">{t('artisanWallet.stats.workInProgress')}</p>
          </div>

          {/* Transféré */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-[#17A2B8]">
            <div className="flex items-center gap-3 mb-2">
              <svg className="w-6 h-6 text-[#17A2B8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <h3 className="text-[#6C757D] font-medium">{t('artisanWallet.stats.transferred')}</h3>
            </div>
            {walletLoading ? (
              <div className="animate-pulse h-10 bg-gray-200 rounded w-32"></div>
            ) : (
              <p className="text-3xl font-bold text-[#2C3E50]">
                {totalRetire.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </p>
            )}
            <p className="text-sm text-[#6C757D] mt-1">{t('artisanWallet.stats.toYourBank')}</p>
          </div>
        </div>

        {/* Historique des transactions */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-gradient-to-r from-[#2C3E50] to-[#34495E] text-white px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                {t('artisanWallet.transactions.title')}
              </h2>
              
              <button
                onClick={() => setShowHowItWorks(!showHowItWorks)}
                className="flex items-center gap-2 bg-[#FF6B00] hover:bg-[#E56100] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('artisanWallet.bankConfig.howItWorks')}
              </button>
            </div>
          </div>

          {/* Message explicatif (toggle) */}
          {showHowItWorks && (
            <div className="bg-blue-50 border-b border-blue-200 px-6 py-4">
              <div className="flex gap-3 max-w-4xl">
                <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h4 className="font-semibold text-blue-900 mb-2">💡 Comment ça marche ?</h4>
                  <ul className="text-sm text-blue-800 space-y-1.5">
                    <li>• Recevez des paiements sécurisés de vos clients via Stripe</li>
                    <li>• Les fonds restent en séquestre jusqu'à validation des travaux</li>
                    <li>• Une fois validés, les fonds sont transférés automatiquement vers votre compte bancaire</li>
                    <li>• Suivez l'historique complet de vos transactions ici</li>
                  </ul>
                  <p className="text-xs text-blue-700 mt-3 bg-blue-100 rounded px-3 py-2 inline-block">
                    ⚠️ <strong>Fonctionnalité en développement</strong> - L'intégration Stripe sera disponible prochainement
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="p-8">
            {walletLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B00] mx-auto"></div>
                <p className="mt-4 text-[#6C757D]">Chargement des transactions...</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center">
                <div className="inline-block bg-[#F8F9FA] rounded-full p-6 mb-4">
                  <svg className="w-16 h-16 text-[#95A5A6] mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-[#2C3E50] mb-2">{t('artisanWallet.transactions.empty')}</h3>
                <p className="text-[#6C757D] max-w-md mx-auto">
                  {t('artisanWallet.transactions.emptyMessage')}
                </p>
                <p className="text-sm text-[#95A5A6] mt-4">
                  💡 Cliquez sur <span className="font-semibold text-[#FF6B00]">"Comment ça marche ?"</span> pour en savoir plus
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {transactions.map((transaction) => {
                  const isCredit = transaction.type === 'credit' || transaction.type === 'bonus';
                  const isDebit = transaction.type === 'debit' || transaction.type === 'commission';
                  const isRefund = transaction.type === 'remboursement';

                  let bgColor = 'bg-gray-50';
                  let iconColor = 'text-gray-500';
                  let amountColor = 'text-[#2C3E50]';
                  let icon = '💰';

                  if (isCredit) {
                    bgColor = 'bg-green-50';
                    iconColor = 'text-green-600';
                    amountColor = 'text-green-600';
                    icon = '💰';
                  } else if (isDebit) {
                    bgColor = 'bg-orange-50';
                    iconColor = 'text-orange-600';
                    amountColor = 'text-orange-600';
                    icon = '📤';
                  } else if (isRefund) {
                    bgColor = 'bg-red-50';
                    iconColor = 'text-red-600';
                    amountColor = 'text-red-600';
                    icon = '↩️';
                  }

                  const statusLabel = {
                    pending: t('artisanWallet.transactions.statuses.pending'),
                    completed: t('artisanWallet.transactions.statuses.completed'),
                    failed: t('artisanWallet.transactions.statuses.failed'),
                    cancelled: t('artisanWallet.transactions.statuses.cancelled'),
                  }[transaction.statut];

                  const statusColor = {
                    pending: 'text-yellow-600 bg-yellow-100',
                    completed: 'text-green-600 bg-green-100',
                    failed: 'text-red-600 bg-red-100',
                    cancelled: 'text-gray-600 bg-gray-100',
                  }[transaction.statut];

                  return (
                    <div key={transaction.id} className={`p-4 hover:bg-gray-50 transition`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div className={`${bgColor} rounded-full p-3`}>
                            <span className="text-2xl">{icon}</span>
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-[#2C3E50] mb-1">
                              {transaction.description}
                            </h4>
                            <div className="flex items-center gap-3 text-sm text-[#6C757D]">
                              <span>
                                {new Date(transaction.createdAt.toDate()).toLocaleDateString('fr-FR', {
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
                                {statusLabel}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-2xl font-bold ${amountColor}`}>
                            {isDebit || isRefund ? '-' : '+'}
                            {transaction.montant.toLocaleString('fr-FR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{' '}
                            €
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Section Configuration compte bancaire */}
        <div className="mt-8 bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-gradient-to-r from-[#2C3E50] to-[#34495E] text-white px-6 py-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                {t('artisanWallet.bankConfig.title')}
              </h3>
              
              <button
                onClick={() => setShowConfigProcess(!showConfigProcess)}
                className="flex items-center gap-2 bg-[#FF6B00] hover:bg-[#E56100] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('artisanWallet.bankConfig.configProcessButton')}
              </button>
            </div>
          </div>

          {/* Message explicatif (toggle) */}
          {showConfigProcess && (
            <div className="bg-blue-50 border-b border-blue-200 px-6 py-4">
              <div className="flex gap-3 max-w-4xl">
                <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h4 className="font-semibold text-blue-900 mb-2">{t('artisanWallet.bankConfig.processTitle')}</h4>
                  <ul className="text-sm text-blue-800 space-y-1.5">
                    <li>{t('artisanWallet.bankConfig.processStep1')}</li>
                    <li>{t('artisanWallet.bankConfig.processStep2')}</li>
                    <li>{t('artisanWallet.bankConfig.processStep3')}</li>
                    <li>{t('artisanWallet.bankConfig.processStep4')}</li>
                  </ul>
                  <p className="text-xs text-blue-700 mt-3 bg-blue-100 rounded px-3 py-2 inline-block">
                    {t('artisanWallet.bankConfig.securityNote')}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="p-6">
            {walletLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B00] mx-auto"></div>
                <p className="mt-4 text-[#6C757D]">{t('artisanWallet.loading')}</p>
              </div>
            ) : stripeOnboardingStatus === 'not_started' || stripeOnboardingStatus === 'pending' ? (
              /* Compte pas encore configuré */
              <div className="text-center py-8">
                <div className="inline-block bg-[#F8F9FA] rounded-full p-6 mb-4">
                  <svg className="w-16 h-16 text-[#FF6B00] mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>

                <h3 className="text-xl font-semibold text-[#2C3E50] mb-2">
                  {t('artisanWallet.bankConfig.notConfigured.title')}
                </h3>
                <p className="text-[#6C757D] mb-4 max-w-md mx-auto">
                  {t('artisanWallet.bankConfig.notConfigured.description')}
                </p>
                <p className="text-sm text-[#95A5A6] mb-6">
                  {t('artisanWallet.bankConfig.notConfigured.hint')}
                </p>

                <button
                  onClick={() => router.push('/artisan/stripe-onboarding')}
                  className="bg-[#FF6B00] text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-[#E56100] transition shadow-lg inline-flex items-center gap-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  {t('artisanWallet.bankConfig.notConfigured.button')}
                </button>
              </div>
            ) : stripeOnboardingStatus === 'documents_required' || stripeOnboardingStatus === 'under_review' ? (
              /* Documents en attente ou en cours de vérification */
              <div className="text-center py-8">
                <div className="inline-block bg-yellow-50 rounded-full p-6 mb-4">
                  <svg className="w-16 h-16 text-yellow-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>

                <h3 className="text-xl font-semibold text-[#2C3E50] mb-2">
                  {t('artisanWallet.bankConfig.pending.title')}
                </h3>
                <p className="text-[#6C757D] mb-6 max-w-md mx-auto">
                  {t('artisanWallet.bankConfig.pending.description')}
                </p>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md mx-auto">
                  <p className="text-yellow-800 text-sm">
                    {t('artisanWallet.bankConfig.pending.emailNotice')}
                  </p>
                </div>
              </div>
            ) : stripeOnboardingStatus === 'active' ? (
              /* Compte activé */
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <div className="flex items-start gap-4">
                  <div className="bg-green-100 rounded-full p-4">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-green-900 mb-2">
                      {t('artisanWallet.bankConfig.active.title')}
                    </h3>
                    <p className="text-green-800 mb-4">
                      {t('artisanWallet.bankConfig.active.description')}
                    </p>

                    {ibanLast4 && (
                      <div className="bg-white rounded-lg p-4 border border-green-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-[#6C757D] mb-1">{t('artisanWallet.bankConfig.active.ibanLabel')}</p>
                            <p className="font-mono text-[#2C3E50] font-semibold">
                              FR** **** **** **** **** **** {ibanLast4}
                            </p>
                          </div>
                          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-800">
                        {t('artisanWallet.bankConfig.active.autoTransferInfo')}
                      </p>
                    </div>
                    
                    <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <p className="text-sm text-[#6C757D] mb-2">
                        {t('artisanWallet.bankConfig.active.modifyIban')}
                      </p>
                      <button
                        onClick={() => router.push('/artisan/contact-support?sujet=modification_iban')}
                        className="text-[#FF6B00] hover:underline font-semibold text-sm flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                        {t('artisanWallet.bankConfig.active.contactSupport')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : stripeOnboardingStatus === 'rejected' ? (
              /* Compte rejeté */
              <div className="text-center py-8">`
                <div className="inline-block bg-red-50 rounded-full p-6 mb-4">
                  <svg className="w-16 h-16 text-red-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>

                <h3 className="text-xl font-semibold text-[#2C3E50] mb-2">
                  {t('artisanWallet.bankConfig.rejected.title')}
                </h3>
                <p className="text-[#6C757D] mb-6 max-w-md mx-auto">
                  {t('artisanWallet.bankConfig.rejected.description')}
                </p>

                <button
                  onClick={() => router.push('/artisan/stripe-onboarding')}
                  className="bg-[#FF6B00] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#E56100] transition inline-flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {t('artisanWallet.bankConfig.rejected.button')}
                </button>
                
                <p className="text-xs text-[#95A5A6] mt-4">
                  {t('artisanWallet.bankConfig.rejected.note')}
                </p>
              </div>
            ) : stripeOnboardingStatus === 'restricted' ? (
              /* Compte restreint */
              <div className="text-center py-8">
                <div className="inline-block bg-orange-50 rounded-full p-6 mb-4">
                  <svg className="w-16 h-16 text-orange-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>

                <h3 className="text-xl font-semibold text-[#2C3E50] mb-2">
                  {t('artisanWallet.bankConfig.restricted.title')}
                </h3>
                <p className="text-[#6C757D] mb-6 max-w-md mx-auto">
                  {t('artisanWallet.bankConfig.restricted.description')}
                </p>

                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 max-w-md mx-auto">
                  <p className="text-orange-800 text-sm">
                    {t('artisanWallet.bankConfig.restricted.contactMessage')}
                  </p>
                </div>
              </div>
            ) : (
              /* Compte restreint */
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
                <div className="flex items-start gap-4">
                  <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-orange-900 mb-2">
                      {t('artisanWallet.bankConfig.limited.title')}
                    </h3>
                    <p className="text-orange-800">
                      {t('artisanWallet.bankConfig.limited.description')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
