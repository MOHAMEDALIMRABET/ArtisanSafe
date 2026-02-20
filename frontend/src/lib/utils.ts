/**
 * Utilitaires généraux pour le frontend
 */

/**
 * Formate une date en format lisible français
 * @param date - Date JavaScript à formater
 * @returns Chaîne formatée (ex: "15 janvier 2025")
 */
export function formatDate(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return 'Date invalide';
  }
  
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/**
 * Formate une date en format court (ex: "15/01/2025")
 * @param date - Date JavaScript à formater
 * @returns Chaîne formatée
 */
export function formatDateShort(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return 'Date invalide';
  }
  
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/**
 * Formate une date avec l'heure (ex: "15 janvier 2025 à 14:30")
 * @param date - Date JavaScript à formater
 * @returns Chaîne formatée
 */
export function formatDateTime(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return 'Date invalide';
  }
  
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Combine les classes CSS conditionnellement
 * @param classes - Liste de classes (peuvent être undefined/null)
 * @returns Chaîne de classes combinées
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
