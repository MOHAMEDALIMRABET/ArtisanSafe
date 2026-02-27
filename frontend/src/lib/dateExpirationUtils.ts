/**
 * Calcul intelligent de la date d'expiration d'une demande publique
 * ⚠️ VERSION CORRIGÉE - Cohérente avec les réalités du BTP
 * 
 * Règles métier BTP :
 * 1. SI pas de date début → expiration = création + 30 jours
 * 2. SI travaux URGENTS (< 7 jours)  → expiration = création + 7 jours
 * 3. SI travaux NORMAUX (7–30 jours) → expiration = dateDebut - 5 jours (min 5j depuis création)
 * 4. SI travaux LOINTAINS (≥ 30 jours) → expiration = création + 30 jours (cap)
 *
 * ⚠️ RÈGLE ABSOLUE : l'expiration ne dépasse JAMAIS la dateDebut souhaitée.
 * → Inutile d'accepter des devis une fois les travaux commencés.
 * 
 * Rationale BTP :
 * - Artisan a besoin de 2-3 jours pour visite sur place + rédaction devis
 * - Client a besoin de 5-7 jours pour recevoir et comparer plusieurs devis
 * - Minimum 5 jours garantit des demandes viables (pas expirées à la création)
 * - Cap 30 jours évite spam et demandes obsolètes
 * 
 * @param dateCreation - Date de création de la demande
 * @param dateDebutTravaux - Date souhaitée pour début des travaux (optionnelle)
 * @returns Date d'expiration calculée
 * 
 * @example
 * // Cas 1 : Travaux urgents demain (< 7 jours)
 * calculateExpirationDate(new Date('2026-02-19'), new Date('2026-02-20'))
 * // → 2026-02-24 (19/02 + 5 jours minimum) ✅ Viable
 * 
 * @example
 * // Cas 1B : Travaux dans 3 jours (< 7 jours)
 * calculateExpirationDate(new Date('2026-02-19'), new Date('2026-02-22'))
 * // → 2026-02-24 (19/02 + 5 jours minimum) ✅ Viable
 * 
 * @example
 * // Cas 2 : Travaux normaux dans 20 jours
 * calculateExpirationDate(new Date('2026-02-19'), new Date('2026-03-11'))
 * // → 2026-03-06 (11/03 - 5 jours) ✅ Artisans ont 15 jours
 * 
 * @example
 * // Cas 3 : Travaux lointains dans 60 jours (cap appliqué)
 * calculateExpirationDate(new Date('2026-02-19'), new Date('2026-04-20'))
 * // → 2026-03-21 (19/02 + 30 jours cap) ✅ Évite demandes qui traînent
 * 
 * @example
 * // Cas 4 : Pas de date précisée
 * calculateExpirationDate(new Date('2026-02-19'), null)
 * // → 2026-03-21 (19/02 + 30 jours) ✅ Défaut raisonnable
 */
export function calculateExpirationDate(
  dateCreation: Date,
  dateDebutTravaux?: Date | null
): Date {
  const now = new Date(dateCreation);
  
  // Cas : Pas de date début travaux → 30 jours par défaut
  if (!dateDebutTravaux) {
    const expiration = new Date(now);
    expiration.setDate(expiration.getDate() + 30);
    return expiration;
  }
  
  // Calculer différence en jours entre création et début travaux
  const diffMs = dateDebutTravaux.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  let expiration: Date;

  if (diffDays >= 30) {
    // Travaux LOINTAINS (>= 30 jours) → cap 30 jours
    expiration = new Date(now);
    expiration.setDate(expiration.getDate() + 30);
  } else if (diffDays >= 7) {
    // Travaux NORMAUX (7–30 jours) → dateDebut - 5 jours
    expiration = new Date(dateDebutTravaux);
    expiration.setDate(expiration.getDate() - 5);
    // Plancher : minimum 5 jours depuis la création
    const minExp = new Date(now);
    minExp.setDate(minExp.getDate() + 5);
    if (expiration < minExp) expiration = minExp;
  } else {
    // Travaux URGENTS (< 7 jours) → création + 7 jours
    expiration = new Date(now);
    expiration.setDate(expiration.getDate() + 7);
  }

  // ⚠️ RÈGLE ABSOLUE : l'expiration ne dépasse JAMAIS la date de début souhaitée
  // → Il est incohérent d'accepter des devis après que les travaux ont commencé
  if (expiration > dateDebutTravaux) {
    expiration = new Date(dateDebutTravaux);
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
