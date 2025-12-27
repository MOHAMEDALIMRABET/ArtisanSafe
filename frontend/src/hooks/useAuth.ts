import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase/config';
import { onAuthStateChanged, User } from 'firebase/auth';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook personnalisé pour gérer l'authentification Firebase
 * @returns État d'authentification (user, loading, error)
 */
export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Écouter les changements d'état d'authentification
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setUser(user);
        setLoading(false);
      },
      (error) => {
        console.error('Erreur auth:', error);
        setError(error);
        setLoading(false);
      }
    );

    // Cleanup à la destruction du composant
    return () => unsubscribe();
  }, []);

  return { user, loading, error };
}
