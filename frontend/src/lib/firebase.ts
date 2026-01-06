import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentSingleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Firebase services
export const auth = getAuth(app);

// Initialize Firestore with offline persistence (nouvelle API)
let db: ReturnType<typeof getFirestore>;

// ⚠️ TEMPORAIRE : Désactivation de la persistence pour éviter les erreurs IndexedDB
// Réactiver après avoir nettoyé le cache ou en production
const DISABLE_PERSISTENCE = true; // ← Mettre à false après debug

if (DISABLE_PERSISTENCE) {
  // Persistence désactivée en mode debug
  db = getFirestore(app);
} else {
  try {
    // Utilisation de persistentSingleTabManager() pour éviter les conflits de "primary lease"
    // ✅ Corrige l'erreur "Failed to obtain primary lease for action 'Collect garbage'"
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentSingleTabManager(), // Mode mono-onglet plus stable
      }),
    });
  } catch (error) {
    // Fallback si déjà initialisé
    console.warn('Firestore déjà initialisé, utilisation instance existante');
    db = getFirestore(app);
  }
}

export { db };
export const storage = getStorage(app);

export default app;
