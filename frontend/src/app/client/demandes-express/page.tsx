'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { getDemandesExpressByClient } from '@/lib/firebase/demande-express-service';
import { getUserById } from '@/lib/firebase/user-service';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { DemandeExpress, User, DemandeExpressStatut } from '@/types/firestore';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function MesDemandesExpressPage() {
  const router = useRouter();
  const { user: firebaseUser, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const [userData, setUserData] = useState<User | null>(null);
  const [demandes, setDemandes] = useState<DemandeExpress[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtreStatut, setFiltreStatut] = useState<'toutes' | DemandeExpressStatut>('toutes');

  useEffect(() => {
    if (authLoading) return;

    if (!firebaseUser) {
      router.push('/connexion');
      return;
    }

    loadDemandes();
  }, [firebaseUser, authLoading, router]);

  async function loadDemandes() {
    if (!firebaseUser) return;

    try {
      const user = await getUserById(firebaseUser.uid);
      setUserData(user);

      if (user?.role !== 'client') {
        alert('Accès réservé aux clients');
        router.push('/');
        return;
      }

      const demandesList = await getDemandesExpressByClient(firebaseUser.uid);
      setDemandes(demandesList);
    } catch (error) {
      console.error('Erreur chargement demandes:', error);
    } finally {
      setLoading(false);
    }
  }

  const demandesFiltrees = demandes.filter((d) => {
    if (filtreStatut === 'toutes') return true;
    return d.statut === filtreStatut;
  });

  const getStatutBadge = (statut: DemandeExpressStatut) => {
    const classes: Record<DemandeExpressStatut, string> = {
      en_attente_proposition: 'bg-yellow-100 text-yellow-800',
      proposition_recue: 'bg-blue-100 text-blue-800',
      acceptee: 'bg-green-100 text-green-800',
      payee: 'bg-purple-100 text-purple-800',
      en_cours: 'bg-indigo-100 text-indigo-800',
      terminee: 'bg-green-200 text-green-900',
      annulee: 'bg-red-100 text-red-800',
      expiree: 'bg-gray-200 text-gray-700',
    };
    const className = classes[statut] || 'bg-gray-100 text-gray-800';
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${className}`}>
        {t(`clientExpressRequests.statuses.${statut}`)}
      </span>
    );
  };

  const getUrgenceBadge = (urgence: 'normal' | 'rapide' | 'urgent') => {
    const classes = {
      normal: 'bg-gray-100 text-gray-700',
      rapide: 'bg-orange-100 text-orange-700',
      urgent: 'bg-red-100 text-red-700',
    };
    const className = classes[urgence];
    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${className}`}>
        {t(`clientExpressRequests.urgency.${urgence}`)}
      </span>
    );
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#F8F9FA] to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#FF6B00] mx-auto mb-4"></div>
          <p className="text-lg text-[#6C757D]">{t('clientExpressRequests.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F8F9FA] to-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <nav className="text-sm mb-4">
            <Link href="/client/dashboard" className="text-[#2C3E50] hover:text-[#FF6B00]">
              {t('clientExpressRequests.breadcrumb.dashboard')}
            </Link>
            <span className="mx-2 text-[#6C757D]">/</span>
            <span className="text-[#6C757D]">{t('clientExpressRequests.breadcrumb.current')}</span>
          </nav>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-[#2C3E50] mb-2">
                {t('clientExpressRequests.pageTitle')}
              </h1>
              <p className="text-[#6C757D]">
                {t('clientExpressRequests.pageSubtitle')}
              </p>
            </div>

            <Button
              onClick={() => router.push('/petits-travaux-express/recherche')}
              className="whitespace-nowrap"
            >
              {t('clientExpressRequests.newRequest')}
            </Button>
          </div>
        </div>

        {/* Filtres */}
        <div className="mb-6 flex flex-wrap gap-3">
          <button
            onClick={() => setFiltreStatut('toutes')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              filtreStatut === 'toutes'
                ? 'bg-[#FF6B00] text-white'
                : 'bg-white text-[#2C3E50] hover:bg-[#F5F7FA]'
            }`}
          >
            {t('clientExpressRequests.filters.all')} ({demandes.length})
          </button>
          <button
            onClick={() => setFiltreStatut('en_attente_proposition')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              filtreStatut === 'en_attente_proposition'
                ? 'bg-[#FF6B00] text-white'
                : 'bg-white text-[#2C3E50] hover:bg-[#F5F7FA]'
            }`}
          >
            {t('clientExpressRequests.filters.waiting')} ({demandes.filter(d => d.statut === 'en_attente_proposition').length})
          </button>
          <button
            onClick={() => setFiltreStatut('proposition_recue')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              filtreStatut === 'proposition_recue'
                ? 'bg-[#FF6B00] text-white'
                : 'bg-white text-[#2C3E50] hover:bg-[#F5F7FA]'
            }`}
          >
            {t('clientExpressRequests.filters.proposals')} ({demandes.filter(d => d.statut === 'proposition_recue').length})
          </button>
          <button
            onClick={() => setFiltreStatut('en_cours')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              filtreStatut === 'en_cours'
                ? 'bg-[#FF6B00] text-white'
                : 'bg-white text-[#2C3E50] hover:bg-[#F5F7FA]'
            }`}
          >
            {t('clientExpressRequests.filters.inProgress')} ({demandes.filter(d => d.statut === 'en_cours').length})
          </button>
          <button
            onClick={() => setFiltreStatut('terminee')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              filtreStatut === 'terminee'
                ? 'bg-[#FF6B00] text-white'
                : 'bg-white text-[#2C3E50] hover:bg-[#F5F7FA]'
            }`}
          >
            {t('clientExpressRequests.filters.completed')} ({demandes.filter(d => d.statut === 'terminee').length})
          </button>
        </div>

        {/* Liste des demandes */}
        {demandesFiltrees.length === 0 ? (
          <Card className="text-center py-12">
            <p className="text-xl text-[#6C757D] mb-6">
              {filtreStatut === 'toutes'
                ? t('clientExpressRequests.empty.all')
                : `${t('clientExpressRequests.empty.filtered')} "${filtreStatut}"`}
            </p>
            <Button onClick={() => router.push('/petits-travaux-express/recherche')}>
              {t('clientExpressRequests.empty.createFirst')}
            </Button>
          </Card>
        ) : (
          <div className="grid gap-6">
            {demandesFiltrees.map((demande) => (
              <Card key={demande.id} className="hover:shadow-xl transition-shadow">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      {getStatutBadge(demande.statut)}
                      {getUrgenceBadge(demande.urgence)}
                      {demande.budgetPropose && (
                        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                          {t('clientExpressRequests.card.budgetProposed').replace('{amount}', String(demande.budgetPropose))}
                        </span>
                      )}
                    </div>

                    <h3 className="text-xl font-bold text-[#2C3E50] mb-2">
                      {demande.categorie.charAt(0).toUpperCase() + demande.categorie.slice(1)}
                      {demande.sousCategorie && ` - ${demande.sousCategorie}`}
                    </h3>

                    <p className="text-[#6C757D] mb-3 line-clamp-2">
                      {demande.description}
                    </p>

                    <div className="flex flex-wrap gap-4 text-sm text-[#6C757D]">
                      <span>📍 {demande.ville} ({demande.codePostal})</span>
                      <span>📅 {demande.date}</span>
                      <span>{t('clientExpressRequests.card.createdOn')} {format(demande.createdAt.toDate(), 'dd MMMM yyyy', { locale: fr })}</span>
                    </div>

                    {demande.expiresAt && demande.statut === 'en_attente_proposition' && (
                      <div className="mt-3 flex items-center gap-2 text-sm">
                        <span className="text-orange-600 font-semibold">
                          {t('clientExpressRequests.card.expires')} {format(demande.expiresAt.toDate(), 'dd MMMM à HH:mm', { locale: fr })}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={() => router.push(`/client/demandes-express/${demande.id}`)}
                      className="whitespace-nowrap"
                    >
                      {t('clientExpressRequests.card.viewDetails')}
                    </Button>

                    {demande.statut === 'proposition_recue' && (
                      <span className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-center text-sm font-semibold">
                        {t('clientExpressRequests.card.proposalWaiting')}
                      </span>
                    )}

                    {demande.statut === 'en_cours' && (
                      <span className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-center text-sm font-semibold">
                        {t('clientExpressRequests.card.interventionInProgress')}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Aide */}
        <div className="mt-8 bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
          <h3 className="font-bold text-[#2C3E50] mb-3">{t('clientExpressRequests.howItWorks.title')}</h3>
          <ul className="space-y-2 text-sm text-[#6C757D]">
            <li><strong>1.</strong> {t('clientExpressRequests.howItWorks.step1')}</li>
            <li><strong>2.</strong> {t('clientExpressRequests.howItWorks.step2')}</li>
            <li><strong>3.</strong> {t('clientExpressRequests.howItWorks.step3')}</li>
            <li><strong>4.</strong> {t('clientExpressRequests.howItWorks.step4')}</li>
            <li><strong>5.</strong> {t('clientExpressRequests.howItWorks.step5')}</li>
          </ul>
        </div>

        {/* Liens utiles */}
        <div className="mt-6 flex justify-center gap-4">
          <Link
            href="/client/dashboard"
            className="text-[#2C3E50] hover:text-[#FF6B00] font-semibold"
          >
            {t('clientExpressRequests.links.backToDashboard')}
          </Link>
          <Link
            href="/client/demandes"
            className="text-[#2C3E50] hover:text-[#FF6B00] font-semibold"
          >
            {t('clientExpressRequests.links.standardRequests')}
          </Link>
        </div>
      </div>
    </div>
  );
}
