'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { getVerifiedArtisans } from '@/lib/firebase/artisan-service';
import type { Artisan } from '@/types/firestore';

export default function AnnuairePage() {
  const [artisans, setArtisans] = useState<Artisan[]>([]);
  const [loading, setLoading] = useState(true);
  const [metierFilter, setMetierFilter] = useState<string>('tous');
  const [villeFilter, setVilleFilter] = useState<string>('');

  useEffect(() => {
    loadArtisans();
  }, []);

  async function loadArtisans() {
    try {
      setLoading(true);
      const data = await getVerifiedArtisans();
      setArtisans(data);
    } catch (error) {
      console.error('Erreur chargement artisans:', error);
    } finally {
      setLoading(false);
    }
  }

  // Filtrer les artisans
  const artisansFiltres = artisans.filter((artisan) => {
    const metierMatch = metierFilter === 'tous' || artisan.metiers.includes(metierFilter as any);
    const villeMatch = !villeFilter || artisan.zonesIntervention?.some(zone => 
      zone.ville?.toLowerCase().includes(villeFilter.toLowerCase())
    );
    return metierMatch && villeMatch;
  });

  // Extraire tous les métiers uniques
  const metiersUniques = Array.from(new Set(artisans.flatMap((a) => a.metiers))).sort();

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-[#2C3E50] to-[#3D5A73] text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-5xl font-bold mb-4 text-center">Trouvez des artisans près de chez vous</h1>
          <p className="text-xl text-gray-200 max-w-3xl mx-auto text-center">
            {artisans.length} professionnels vérifiés partout en France
          </p>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white shadow-md py-6 sticky top-16 z-40">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-4">
            {/* Filtre métier */}
            <div>
              <label className="block text-sm font-medium text-[#2C3E50] mb-2">
                Métier
              </label>
              <select
                value={metierFilter}
                onChange={(e) => setMetierFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
              >
                <option value="tous">Tous les métiers</option>
                {metiersUniques.map((metier) => (
                  <option key={metier} value={metier}>
                    {metier.charAt(0).toUpperCase() + metier.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtre ville */}
            <div>
              <label className="block text-sm font-medium text-[#2C3E50] mb-2">
                Ville
              </label>
              <input
                type="text"
                placeholder="Rechercher par ville..."
                value={villeFilter}
                onChange={(e) => setVilleFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
              />
            </div>

            {/* Résultats */}
            <div className="flex items-end">
              <div className="w-full bg-[#FFF3E0] border-l-4 border-[#FF6B00] px-4 py-2 rounded-lg">
                <p className="text-sm text-[#6C757D]">Résultats</p>
                <p className="text-2xl font-bold text-[#2C3E50]">{artisansFiltres.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Liste des artisans */}
      <main className="container mx-auto px-4 py-12">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B00]"></div>
            <p className="mt-4 text-[#6C757D]">Chargement des artisans...</p>
          </div>
        ) : artisansFiltres.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="text-2xl font-bold text-[#2C3E50] mb-2">
              Aucun artisan trouvé
            </h2>
            <p className="text-[#6C757D] mb-6">
              Essayez de modifier vos critères de recherche
            </p>
            <button
              onClick={() => {
                setMetierFilter('tous');
                setVilleFilter('');
              }}
              className="bg-[#FF6B00] text-white px-6 py-2 rounded-lg hover:bg-[#E56100] transition-colors"
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {artisansFiltres.map((artisan) => (
              <Card key={artisan.userId} className="p-6 hover:shadow-xl transition-shadow">
                {/* En-tête */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-[#2C3E50] mb-1">
                      {artisan.raisonSociale}
                    </h3>
                    {artisan.verified && (
                      <span className="inline-flex items-center gap-1 text-green-600 text-sm font-medium">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Vérifié
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    {artisan.notation ? (
                      <div className="flex items-center gap-1">
                        <span className="text-yellow-500">⭐</span>
                        <span className="font-bold text-[#2C3E50]">{artisan.notation.toFixed(1)}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Nouveau</span>
                    )}
                  </div>
                </div>

                {/* Métiers */}
                <div className="mb-4">
                  <div className="flex flex-wrap gap-2">
                    {artisan.metiers.slice(0, 3).map((metier) => (
                      <span
                        key={metier}
                        className="bg-[#FFF3E0] text-[#FF6B00] px-3 py-1 rounded-full text-sm font-medium"
                      >
                        {metier.charAt(0).toUpperCase() + metier.slice(1)}
                      </span>
                    ))}
                    {artisan.metiers.length > 3 && (
                      <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm">
                        +{artisan.metiers.length - 3}
                      </span>
                    )}
                  </div>
                </div>

                {/* Localisation */}
                <div className="mb-4 flex items-start gap-2 text-[#6C757D]">
                  <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-sm">
                    {artisan.zonesIntervention?.[0]?.ville || 'Localisation non renseignée'}
                    {artisan.zonesIntervention?.[0]?.codePostal && ` (${artisan.zonesIntervention[0].codePostal})`}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* CTA Bottom */}
      <div className="bg-gradient-to-r from-[#FF6B00] to-[#E56100] text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-4">Vous ne trouvez pas ce que vous cherchez ?</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Décrivez votre projet et recevez des devis personnalisés d'artisans qualifiés
          </p>
          <Link
            href="/inscription?role=client"
            className="inline-block bg-white text-[#FF6B00] px-8 py-4 rounded-lg font-bold text-lg hover:bg-gray-100 transition-colors shadow-lg"
          >
            Publier ma demande gratuitement
          </Link>
        </div>
      </div>
    </div>
  );
}
