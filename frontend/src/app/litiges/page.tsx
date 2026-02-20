'use client';

/**
 * Page - Mes Litiges (Client/Artisan)
 * Liste tous les litiges de l'utilisateur connecté
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/lib/auth-service';
import { getLitigesByUser } from '@/lib/firebase/litige-service';
import { Litige, LitigeStatut, LITIGE_STATUT_LABELS } from '@/types/litige';
import LitigeCard from '@/components/litige/LitigeCard';

export default function MesLitigesPage() {
  const router = useRouter();
  const [litiges, setLitiges] = useState<Litige[]>([]);
  const [filteredLitiges, setFilteredLitiges] = useState<Litige[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatut, setFilterStatut] = useState<LitigeStatut | 'tous'>('tous');
  const [userRole, setUserRole] = useState<'client' | 'artisan'>('client');

  useEffect(() => {
    const loadLitiges = async () => {
      try {
        setLoading(true);
        const user = authService.getCurrentUser();
        if (!user) {
          router.push('/connexion');
          return;
        }

        // Déterminer le rôle de l'utilisateur
        const userData = await authService.getUserData(user.uid);
        if (!userData) {
          router.push('/connexion');
          return;
        }
        setUserRole(userData.role as 'client' | 'artisan');

        // Charger les litiges
        const data = await getLitigesByUser(user.uid);
        setLitiges(data);
        setFilteredLitiges(data);
      } catch (error) {
        console.error('Erreur chargement litiges:', error);
      } finally {
        setLoading(false);
      }
    };

    loadLitiges();
  }, [router]);

  // Filtrer par statut
  useEffect(() => {
    if (filterStatut === 'tous') {
      setFilteredLitiges(litiges);
    } else {
      setFilteredLitiges(litiges.filter(l => l.statut === filterStatut));
    }
  }, [filterStatut, litiges]);

  // Statistiques
  const stats = {
    total: litiges.length,
    ouverts: litiges.filter(l => l.statut === 'ouvert').length,
    enMediation: litiges.filter(l => l.statut === 'en_mediation').length,
    resolus: litiges.filter(l => 
      l.statut === 'resolu_accord' || 
      l.statut === 'resolu_admin' || 
      l.statut === 'resolu'
    ).length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B00] mx-auto mb-4"></div>
          <p className="text-[#6C757D]">Chargement des litiges...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#2C3E50] mb-2">
            ⚠️ Mes Litiges
          </h1>
          <p className="text-[#6C757D]">
            Suivez l'état de vos litiges et échangez avec notre équipe de médiation
          </p>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-[#E9ECEF]">
            <div className="text-3xl font-bold text-[#2C3E50] mb-1">
              {stats.total}
            </div>
            <div className="text-sm text-[#6C757D]">Total litiges</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 border border-[#E9ECEF]">
            <div className="text-3xl font-bold text-[#FFC107] mb-1">
              {stats.ouverts}
            </div>
            <div className="text-sm text-[#6C757D]">Ouverts</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 border border-[#E9ECEF]">
            <div className="text-3xl font-bold text-[#FF6B00] mb-1">
              {stats.enMediation}
            </div>
            <div className="text-sm text-[#6C757D]">En médiation</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 border border-[#E9ECEF]">
            <div className="text-3xl font-bold text-[#28A745] mb-1">
              {stats.resolus}
            </div>
            <div className="text-sm text-[#6C757D]">Résolus</div>
          </div>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-[#E9ECEF]">
          <div className="flex flex-wrap items-center gap-4">
            <label className="text-sm font-semibold text-[#2C3E50]">
              Filtrer par statut :
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilterStatut('tous')}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                  filterStatut === 'tous'
                    ? 'bg-[#FF6B00] text-white'
                    : 'bg-[#F8F9FA] text-[#6C757D] hover:bg-[#E9ECEF]'
                }`}
              >
                Tous ({stats.total})
              </button>
              <button
                onClick={() => setFilterStatut('ouvert')}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                  filterStatut === 'ouvert'
                    ? 'bg-[#FFC107] text-white'
                    : 'bg-[#F8F9FA] text-[#6C757D] hover:bg-[#E9ECEF]'
                }`}
              >
                Ouverts ({stats.ouverts})
              </button>
              <button
                onClick={() => setFilterStatut('en_mediation')}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                  filterStatut === 'en_mediation'
                    ? 'bg-[#FF6B00] text-white'
                    : 'bg-[#F8F9FA] text-[#6C757D] hover:bg-[#E9ECEF]'
                }`}
              >
                En médiation ({stats.enMediation})
              </button>
              <button
                onClick={() => setFilterStatut('resolu')}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                  filterStatut === 'resolu'
                    ? 'bg-[#28A745] text-white'
                    : 'bg-[#F8F9FA] text-[#6C757D] hover:bg-[#E9ECEF]'
                }`}
              >
                Résolus ({stats.resolus})
              </button>
            </div>
          </div>
        </div>

        {/* Liste des litiges */}
        {filteredLitiges.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-[#E9ECEF]">
            <div className="text-6xl mb-4">🤝</div>
            <h3 className="text-xl font-bold text-[#2C3E50] mb-2">
              {filterStatut === 'tous' 
                ? 'Aucun litige' 
                : `Aucun litige ${LITIGE_STATUT_LABELS[filterStatut as LitigeStatut]?.toLowerCase()}`}
            </h3>
            <p className="text-[#6C757D] mb-6">
              {filterStatut === 'tous'
                ? 'Vous n\'avez aucun litige en cours. C\'est excellent !'
                : 'Essayez un autre filtre pour voir vos litiges'}
            </p>
            {filterStatut !== 'tous' && (
              <button
                onClick={() => setFilterStatut('tous')}
                className="px-6 py-3 bg-[#FF6B00] text-white rounded-lg hover:bg-[#E56100] font-semibold"
              >
                Voir tous les litiges
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredLitiges.map(litige => (
              <LitigeCard key={litige.id} litige={litige} userRole={userRole} />
            ))}
          </div>
        )}

        {/* Info médiation */}
        <div className="mt-8 bg-[#E7F3FF] border-l-4 border-[#17A2B8] rounded-lg p-6">
          <h3 className="font-bold text-[#004085] mb-2">
            💡 Besoin d'aide ?
          </h3>
          <p className="text-sm text-[#004085] mb-4">
            Notre équipe de médiation est à votre disposition pour résoudre tous les litiges de manière
            équitable et rapide. N'hésitez pas à fournir un maximum de détails et de preuves.
          </p>
          <div className="flex items-center gap-4 text-sm text-[#004085]">
            <span>✓ Réponse sous 24h</span>
            <span>✓ Médiation gratuite</span>
            <span>✓ Solution équitable</span>
          </div>
        </div>
      </div>
    </div>
  );
}
