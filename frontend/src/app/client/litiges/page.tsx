/**
 * Page Client - Mes Litiges
 * Liste et gestion des litiges déclarés
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStatus } from '@/hooks/useAuthStatus';
import { useLanguage } from '@/contexts/LanguageContext';
import { getLitigesByUser } from '@/lib/firebase/litige-service';
import { Litige, LitigeType } from '@/types/litige';
import { AlertTriangle, Eye, Plus, Filter } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';

export default function ClientLitigesPage() {
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuthStatus();
  const { t } = useLanguage();
  const [litiges, setLitiges] = useState<Litige[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'tous' | 'ouverts' | 'resolus'>('tous');

  useEffect(() => {
    if (authLoading) return;
    if (!user || role !== 'client') {
      router.push('/login');
      return;
    }

    loadLitiges();
  }, [user, role, authLoading]);

  async function loadLitiges() {
    if (!user) return;

    try {
      setLoading(true);
      const data = await getLitigesByUser(user.uid);
      setLitiges(data);
    } catch (error) {
      console.error('Erreur chargement litiges:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredLitiges = litiges.filter((litige) => {
    if (filter === 'ouverts') {
      return litige.statut === 'ouvert' || litige.statut === 'en_mediation' || litige.statut === 'proposition_resolution';
    }
    if (filter === 'resolus') {
      return litige.statut === 'resolu_accord' || litige.statut === 'resolu_admin';
    }
    return true;
  });

  const getStatusBadge = (statut: string) => {
    const styles: Record<string, { bg: string; text: string }> = {
      ouvert: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
      en_mediation: { bg: 'bg-blue-100', text: 'text-blue-800' },
      proposition_resolution: { bg: 'bg-purple-100', text: 'text-purple-800' },
      resolu_accord: { bg: 'bg-green-100', text: 'text-green-800' },
      resolu_admin: { bg: 'bg-green-100', text: 'text-green-800' },
      abandonne: { bg: 'bg-gray-100', text: 'text-gray-800' },
      escalade: { bg: 'bg-orange-100', text: 'text-orange-800' },
    };

    const style = styles[statut] || styles.ouvert;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
        {t(`clientDisputes.statuses.${statut}`)}
      </span>
    );
  };

  const getTypeBadge = (type: LitigeType) => {
    return (
      <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">
        {t(`clientDisputes.types.${type}`)}
      </span>
    );
  };

  if (authLoading || loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-gray-600">{t('clientDisputes.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-[#2C3E50]">{t('clientDisputes.pageTitle')}</h1>
            <p className="text-gray-600 mt-2">{t('clientDisputes.pageDescription')}</p>
          </div>
          <Link
            href="/client/litiges/nouveau"
            className="flex items-center gap-2 bg-[#FF6B00] text-white px-4 py-2 rounded-lg hover:bg-[#E56100] transition"
          >
            <Plus className="w-5 h-5" />
            {t('clientDisputes.declareDispute')}
          </Link>
        </div>

        {/* Filtres */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('tous')}
            className={`px-4 py-2 rounded-lg transition ${
              filter === 'tous'
                ? 'bg-[#2C3E50] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('clientDisputes.filters.all')} ({litiges.length})
          </button>
          <button
            onClick={() => setFilter('ouverts')}
            className={`px-4 py-2 rounded-lg transition ${
              filter === 'ouverts'
                ? 'bg-[#2C3E50] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('clientDisputes.filters.inProgress')} (
            {
              litiges.filter(
                (l) =>
                  l.statut === 'ouvert' ||
                  l.statut === 'en_mediation' ||
                  l.statut === 'proposition_resolution'
              ).length
            }
            )
          </button>
          <button
            onClick={() => setFilter('resolus')}
            className={`px-4 py-2 rounded-lg transition ${
              filter === 'resolus'
                ? 'bg-[#2C3E50] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('clientDisputes.filters.resolved')} (
            {litiges.filter((l) => l.statut === 'resolu_accord' || l.statut === 'resolu_admin').length}
            )
          </button>
        </div>
      </div>

      {/* Liste des litiges */}
      {filteredLitiges.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">{t('clientDisputes.empty.title')}</p>
          {filter !== 'tous' && (
            <button
              onClick={() => setFilter('tous')}
              className="mt-4 text-[#FF6B00] hover:underline"
            >
              {t('clientDisputes.empty.showAll')}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredLitiges.map((litige) => (
            <div
              key={litige.id}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:border-[#FF6B00] transition"
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusBadge(litige.statut)}
                    {getTypeBadge(litige.type)}
                    {litige.adminAssigne && (
                      <span className="px-2 py-1 rounded text-xs bg-purple-100 text-purple-700">
                        {t('clientDisputes.mediatorAssigned')}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-[#2C3E50] mb-1">{litige.motif}</h3>
                  <p className="text-gray-600 text-sm line-clamp-2">{litige.description}</p>
                </div>
                <Link
                  href={`/client/litiges/${litige.id}`}
                  className="flex items-center gap-2 bg-[#2C3E50] text-white px-4 py-2 rounded-lg hover:bg-[#1A3A5C] transition"
                >
                  <Eye className="w-4 h-4" />
                  {t('clientDisputes.viewButton')}
                </Link>
              </div>

              <div className="flex items-center justify-between text-sm text-gray-500">
                <div className="flex items-center gap-4">
                  <span>
                    {t('clientDisputes.details.opened')}{' '}
                    {litige.dateOuverture
                      ? formatDistanceToNow(litige.dateOuverture.toDate(), {
                          addSuffix: true,
                          locale: fr,
                        })
                      : 'Date inconnue'}
                  </span>
                  {litige.montantConteste && litige.montantConteste > 0 && (
                    <span>{t('clientDisputes.details.contested')} {litige.montantConteste}€</span>
                  )}
                  <span>{t('clientDisputes.details.actions').replace('{count}', String(litige.historique.length))}</span>
                </div>
                {litige.dateResolution && (
                  <span className="text-green-600 font-medium">
                    {t('clientDisputes.details.resolved')}{' '}
                    {formatDistanceToNow(litige.dateResolution.toDate(), {
                      addSuffix: true,
                      locale: fr,
                    })}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
