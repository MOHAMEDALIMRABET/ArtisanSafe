/**
 * Page Artisan - Mes Litiges
 * Liste et gestion des litiges concernant l'artisan
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStatus } from '@/hooks/useAuthStatus';
import { getLitigesByUser } from '@/lib/firebase/litige-service';
import { Litige, LitigeType } from '@/types/litige';
import { AlertTriangle, Eye, Filter } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';

export default function ArtisanLitigesPage() {
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuthStatus();
  const [litiges, setLitiges] = useState<Litige[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'tous' | 'ouverts' | 'resolus'>('tous');

  useEffect(() => {
    if (authLoading) return;
    if (!user || role !== 'artisan') {
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
    const styles: Record<string, { bg: string; text: string; label: string }> = {
      ouvert: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Ouvert' },
      en_mediation: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'En médiation' },
      proposition_resolution: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Proposition' },
      resolu_accord: { bg: 'bg-green-100', text: 'text-green-800', label: 'Résolu (accord)' },
      resolu_admin: { bg: 'bg-green-100', text: 'text-green-800', label: 'Résolu (admin)' },
      abandonne: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Abandonné' },
      escalade: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Escaladé' },
    };

    const style = styles[statut] || styles.ouvert;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
        {style.label}
      </span>
    );
  };

  const getTypeBadge = (type: LitigeType) => {
    const labels: Record<LitigeType, string> = {
      non_conformite: 'Non-conformité',
      retard: 'Retard',
      abandon_chantier: 'Abandon chantier',
      facture_excessive: 'Facture excessive',
      malfacon: 'Malfaçon',
      non_respect_delais: 'Non-respect délais',
      autre: 'Autre',
    };

    return (
      <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">
        {labels[type]}
      </span>
    );
  };

  const getPrioriteBadge = (priorite?: string) => {
    if (!priorite) return null;

    const styles: Record<string, { bg: string; text: string; label: string }> = {
      basse: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Basse' },
      moyenne: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Moyenne' },
      haute: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Haute' },
      urgente: { bg: 'bg-red-100', text: 'text-red-800', label: 'Urgente' },
    };

    const style = styles[priorite] || styles.moyenne;
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${style.bg} ${style.text}`}>
        🔥 {style.label}
      </span>
    );
  };

  if (authLoading || loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-gray-600">Chargement...</p>
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
            <h1 className="text-3xl font-bold text-[#2C3E50]">Litiges</h1>
            <p className="text-gray-600 mt-2">Gérez les litiges concernant vos prestations</p>
          </div>
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
            Tous ({litiges.length})
          </button>
          <button
            onClick={() => setFilter('ouverts')}
            className={`px-4 py-2 rounded-lg transition ${
              filter === 'ouverts'
                ? 'bg-[#2C3E50] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            En cours (
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
            Résolus (
            {litiges.filter((l) => l.statut === 'resolu_accord' || l.statut === 'resolu_admin').length}
            )
          </button>
        </div>
      </div>

      {/* Liste des litiges */}
      {filteredLitiges.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Aucun litige trouvé</p>
          {filter !== 'tous' && (
            <button
              onClick={() => setFilter('tous')}
              className="mt-4 text-[#FF6B00] hover:underline"
            >
              Voir tous les litiges
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
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {getStatusBadge(litige.statut)}
                    {getTypeBadge(litige.type)}
                    {getPrioriteBadge(litige.priorite)}
                    {litige.adminAssigne && (
                      <span className="px-2 py-1 rounded text-xs bg-purple-100 text-purple-700">
                        👤 Médiateur assigné
                      </span>
                    )}
                    {litige.declarantRole === 'artisan' && (
                      <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-700">
                        📢 Vous avez déclaré ce litige
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-[#2C3E50] mb-1">{litige.motif}</h3>
                  <p className="text-gray-600 text-sm line-clamp-2">{litige.description}</p>
                </div>
                <Link
                  href={`/artisan/litiges/${litige.id}`}
                  className="flex items-center gap-2 px-4 py-2 bg-[#FF6B00] text-white rounded-lg hover:bg-[#E56100] transition whitespace-nowrap"
                >
                  <Eye className="w-4 h-4" />
                  Voir
                </Link>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border-t pt-4">
                <div>
                  <p className="text-gray-500">Ouvert le</p>
                  <p className="font-medium text-[#2C3E50]">
                    {litige.dateOuverture
                      ? formatDistanceToNow(litige.dateOuverture.toDate(), {
                          addSuffix: true,
                          locale: fr,
                        })
                      : 'Date inconnue'}
                  </p>
                </div>
                {litige.montantConteste && litige.montantConteste > 0 && (
                  <div>
                    <p className="text-gray-500">Montant contesté</p>
                    <p className="font-medium text-[#2C3E50]">{litige.montantConteste}€</p>
                  </div>
                )}
                <div>
                  <p className="text-gray-500">Actions</p>
                  <p className="font-medium text-[#2C3E50]">{litige.historique.length}</p>
                </div>
                {litige.dateResolution && (
                  <div>
                    <p className="text-gray-500">Résolu le</p>
                    <p className="font-medium text-green-600">
                      {formatDistanceToNow(litige.dateResolution.toDate(), {
                        addSuffix: true,
                        locale: fr,
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
