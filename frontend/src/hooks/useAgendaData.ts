/**
 * Hook personnalisé pour charger les disponibilités avec cache
 * Optimise les performances de la page Agenda
 */

import { useState, useEffect } from 'react';
import { disponibiliteService } from '@/lib/firebase/disponibilite-service';
import { getDevisByArtisan } from '@/lib/firebase/devis-service';
import type { DisponibiliteSlot, Devis } from '@/types/firestore';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const cache = new Map<string, CacheEntry<any>>();

export function useAgendaData(artisanId: string | null) {
  const [disponibilites, setDisponibilites] = useState<DisponibiliteSlot[]>([]);
  const [contrats, setContrats] = useState<Devis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!artisanId) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        const startTime = Date.now();

        // Vérifier le cache pour les disponibilités
        const dispoCacheKey = `dispo_${artisanId}`;
        const cachedDispo = cache.get(dispoCacheKey);
        
        let dispoData: DisponibiliteSlot[];
        
        if (cachedDispo && Date.now() - cachedDispo.timestamp < CACHE_DURATION) {
          console.log('✅ Disponibilités chargées depuis le cache');
          dispoData = cachedDispo.data;
        } else {
          console.log('⏳ Chargement des disponibilités depuis Firestore...');
          dispoData = await disponibiliteService.getDisponibilites(artisanId);
          cache.set(dispoCacheKey, { data: dispoData, timestamp: Date.now() });
          console.log(`✅ Disponibilités chargées en ${Date.now() - startTime}ms`);
        }

        // Vérifier le cache pour les contrats (devis signés)
        const contratCacheKey = `contrats_${artisanId}`;
        const cachedContrats = cache.get(contratCacheKey);
        
        let contratsData: Devis[];
        
        if (cachedContrats && Date.now() - cachedContrats.timestamp < CACHE_DURATION) {
          console.log('✅ Contrats chargés depuis le cache');
          contratsData = cachedContrats.data;
        } else {
          console.log('⏳ Chargement des contrats depuis Firestore...');
          const contratsStartTime = Date.now();
          // Un devis signé = un contrat juridique
          // Récupérer tous les devis avec statuts contractuels
          const allDevis = await getDevisByArtisan(artisanId);
          contratsData = allDevis.filter(d => 
            ['en_attente_paiement', 'paye', 'en_cours', 'travaux_termines', 'termine_valide', 'termine_auto_valide', 'litige'].includes(d.statut)
          );
          cache.set(contratCacheKey, { data: contratsData, timestamp: Date.now() });
          console.log(`✅ Contrats chargés en ${Date.now() - contratsStartTime}ms`);
        }

        if (isMounted) {
          setDisponibilites(dispoData);
          setContrats(contratsData);
          setError(null);
          console.log(`⏱️  Temps total: ${Date.now() - startTime}ms`);
        }
      } catch (err) {
        console.error('❌ Erreur chargement données agenda:', err);
        if (isMounted) {
          setError('Erreur lors du chargement des données');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [artisanId]);

  return { disponibilites, contrats, loading, error };
}

/**
 * Fonction pour invalider le cache (après création/modification)
 */
export function invalidateAgendaCache(artisanId: string) {
  cache.delete(`dispo_${artisanId}`);
  cache.delete(`contrats_${artisanId}`);
  console.log('🗑️  Cache agenda invalidé');
}
