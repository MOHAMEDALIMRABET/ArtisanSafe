/**
 * Utilitaires Firestore avec gestion de timeout
 * Évite les blocages lors des appels à Firestore
 */

/**
 * Wrapper pour ajouter un timeout aux opérations Firestore
 * @param promise - La promesse Firestore à exécuter
 * @param timeoutMs - Timeout en millisecondes (par défaut 8000ms)
 * @returns La promesse avec timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 8000
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Firestore timeout après ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

/**
 * Retry logic pour les opérations Firestore
 * @param fn - Fonction à réessayer
 * @param maxRetries - Nombre maximum de tentatives (par défaut 2)
 * @param delayMs - Délai entre les tentatives (par défaut 1000ms)
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      console.warn(`Tentative ${attempt + 1}/${maxRetries + 1} échouée:`, error);
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError || new Error('Échec après plusieurs tentatives');
}

/**
 * Combine timeout et retry pour une opération Firestore
 */
export async function withTimeoutAndRetry<T>(
  fn: () => Promise<T>,
  timeoutMs: number = 8000,
  maxRetries: number = 2
): Promise<T> {
  return withRetry(
    () => withTimeout(fn(), timeoutMs),
    maxRetries
  );
}
