'use client';

/**
 * Redirection de l'ancienne page /artisan/paiements vers /artisan/wallet
 * 
 * ⚠️ Cette page est obsolète. La configuration Stripe Connect se fait
 * maintenant directement dans Mon Wallet via un formulaire intégré.
 * 
 * Ancienne méthode (supprimée) : Redirection vers lien Stripe hébergé
 * Nouvelle méthode : Formulaire multi-étapes dans ArtisanDispo
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';

export default function ArtisanPaiementsPageRedirect() {
  const router = useRouter();
  const { t } = useLanguage();

  useEffect(() => {
    // Redirection automatique vers Mon Wallet
    router.replace('/artisan/wallet');
  }, [router]);

  // Loading pendant la redirection
  return (
    <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B00] mx-auto mb-4"></div>
          <p className="text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
}
