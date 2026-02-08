/**
 * Calcul intelligent de la date d'expiration d'une demande publique
 * 
 * Règles métier :
 * 1. SI date début travaux < 30 jours : expiration = dateDebut - 3 jours
 * 2. SI date début travaux >= 30 jours : expiration = création + 30 jours (cap)
 * 3. SI pas de date début : expiration = création + 30 jours (par défaut)
 * 
 * Rationale :
 * - Client a besoin de 3 jours minimum pour recevoir et comparer les devis
 * - Cap de 30 jours évite demandes qui traînent trop longtemps
 * - Expiration toujours AVANT date début travaux (cohérence métier)
 * 
 * @param dateCreation - Date de création de la demande
 * @param dateDebutTravaux - Date souhaitée pour début des travaux (optionnelle)
 * @returns Date d'expiration calculée
 * 
 * @example
 * // Cas 1 : Travaux urgents dans 5 jours
 * calculateExpirationDate(new Date('2026-02-08'), new Date('2026-02-13'))
 * // → 2026-02-10 (13/02 - 3 jours)
 * 
 * @example
 * // Cas 2 : Travaux dans 20 jours
 * calculateExpirationDate(new Date('2026-02-08'), new Date('2026-02-28'))
 * // → 2026-02-25 (28/02 - 3 jours)
 * 
 * @example
 * // Cas 3 : Travaux dans 60 jours (cap de 30 jours appliqué)
 * calculateExpirationDate(new Date('2026-02-08'), new Date('2026-04-10'))
 * // → 2026-03-10 (08/02 + 30 jours)
 * 
 * @example
 * // Cas 4 : Pas de date précisée
 * calculateExpirationDate(new Date('2026-02-08'), null)
 * // → 2026-03-10 (08/02 + 30 jours)
 */
export function calculateExpirationDate(
  dateCreation: Date,
  dateDebutTravaux?: Date | null
): Date {
  const now = new Date(dateCreation);
  
  // Cas 4 : Pas de date début travaux → 30 jours par défaut
  if (!dateDebutTravaux) {
    const expiration = new Date(now);
    expiration.setDate(expiration.getDate() + 30);
    return expiration;
  }
  
  // Calculer différence en jours
  const diffMs = dateDebutTravaux.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  // Cas 3 : Date début >= 30 jours → Cap de 30 jours
  if (diffDays >= 30) {
    const expiration = new Date(now);
    expiration.setDate(expiration.getDate() + 30);
    return expiration;
  }
  
  // Cas 1 & 2 : Date début < 30 jours → Expiration = dateDebut - 3 jours
  const expiration = new Date(dateDebutTravaux);
  expiration.setDate(expiration.getDate() - 3);
  
  // Sécurité : Minimum 1 jour entre création et expiration
  const minExpiration = new Date(now);
  minExpiration.setDate(minExpiration.getDate() + 1);
  
  if (expiration < minExpiration) {
    return minExpiration;
  }
  
  return expiration;
}

/**
 * Convertit une date JavaScript en Timestamp Firestore
 * Utilitaire pour compatibilité Cloud Functions
 */
export function dateToFirestoreTimestamp(date: Date): { seconds: number; nanoseconds: number } {
  return {
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: (date.getTime() % 1000) * 1000000
  };
}

/**
 * Vérifie si une demande est expirée
 */
export function isDemandeExpired(dateExpiration: Date | { seconds: number; nanoseconds: number }): boolean {
  const now = new Date();
  
  // Si c'est un Timestamp Firestore
  if (typeof dateExpiration === 'object' && 'seconds' in dateExpiration) {
    const expirationDate = new Date(dateExpiration.seconds * 1000);
    return expirationDate < now;
  }
  
  // Si c'est une Date JavaScript
  return dateExpiration < now;
}

/**
 * Formate les jours restants avant expiration
 * @returns "Expire dans 5 jours" ou "Expirée depuis 2 jours"
 */
export function formatExpirationStatus(dateExpiration: Date | { seconds: number; nanoseconds: number }): string {
  const now = new Date();
  
  // Convertir Timestamp Firestore en Date
  let expirationDate: Date;
  if (typeof dateExpiration === 'object' && 'seconds' in dateExpiration) {
    expirationDate = new Date(dateExpiration.seconds * 1000);
  } else {
    expirationDate = dateExpiration;
  }
  
  const diffMs = expirationDate.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays > 0) {
    return `Expire dans ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
  } else if (diffDays === 0) {
    return `Expire aujourd'hui`;
  } else {
    const daysSince = Math.abs(diffDays);
    return `Expirée depuis ${daysSince} jour${daysSince > 1 ? 's' : ''}`;
  }
}
