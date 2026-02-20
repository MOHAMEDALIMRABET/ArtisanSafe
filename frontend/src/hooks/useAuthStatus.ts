import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase/config';
import { onAuthStateChanged, User } from 'firebase/auth';
import { getUserById } from '@/lib/firebase/user-service';

interface AuthStatusState {
  user: User | null;
  role: 'client' | 'artisan' | 'admin' | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook personnalisé pour gérer l'authentification Firebase avec récupération du rôle
 * @returns État d'authentification (user, role, loading, error)
 */
export function useAuthStatus(): AuthStatusState {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'client' | 'artisan' | 'admin' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Écouter les changements d'état d'authentification
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        setUser(firebaseUser);
        
        if (firebaseUser) {
          try {
            // Récupérer le document utilisateur pour obtenir le rôle
            const userData = await getUserById(firebaseUser.uid);
            if (userData) {
              setRole(userData.role as 'client' | 'artisan' | 'admin');
            } else {
              setRole(null);
            }
          } catch (err) {
            console.error('Erreur récupération rôle:', err);
            setError(err as Error);
            setRole(null);
          }
        } else {
          setRole(null);
        }
        
        setLoading(false);
      },
      (err) => {
        console.error('Erreur auth:', err);
        setError(err);
        setLoading(false);
      }
    );

    // Cleanup à la destruction du composant
    return () => unsubscribe();
  }, []);

  return { user, role, loading, error };
}
