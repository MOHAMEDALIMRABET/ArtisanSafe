import { useState, useEffect } from 'react';
import { getContratsTerminesSansAvis } from '@/lib/firebase/avis-service';

/**
 * Hook pour récupérer les contrats terminés sans avis
 * Utilisé pour afficher le badge "X avis en attente" dans la navigation
 */
export function useContratsANoter(userId: string | undefined) {
  const [contratsANoter, setContratsANoter] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setContratsANoter([]);
      setCount(0);
      setLoading(false);
      return;
    }

    loadContratsANoter();
  }, [userId]);

  async function loadContratsANoter() {
    try {
      setLoading(true);
      const contrats = await getContratsTerminesSansAvis(userId!);
      setContratsANoter(contrats);
      setCount(contrats.length);
    } catch (error) {
      console.error('Erreur chargement contrats à noter:', error);
      setContratsANoter([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }

  return {
    contratsANoter,
    count,
    loading,
    refresh: loadContratsANoter,
  };
}
