/**
 * Utilitaires pour l'internationalisation (i18n)
 * Permet de formater les dates, nombres et autres éléments selon la langue active
 */

/**
 * Formate une date selon la langue spécifiée
 * @param date - Date à formater (Date, Timestamp Firestore, ou string)
 * @param language - Langue ('fr' | 'en')
 * @param options - Options de formatage (optionnel)
 * @returns Date formatée selon la langue
 */
export function formatDate(
  date: Date | { toDate: () => Date } | string,
  language: 'fr' | 'en' = 'fr',
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return '';

  let dateObj: Date;

  // Gérer les timestamps Firestore
  if (typeof date === 'object' && 'toDate' in date && typeof date.toDate === 'function') {
    dateObj = date.toDate();
  } else if (typeof date === 'string') {
    dateObj = new Date(date);
  } else if (date instanceof Date) {
    dateObj = date;
  } else {
    return '';
  }

  const locale = language === 'fr' ? 'fr-FR' : 'en-GB';
  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  };

  return dateObj.toLocaleDateString(locale, options || defaultOptions);
}

/**
 * Formate une date avec l'heure selon la langue spécifiée
 */
export function formatDateTime(
  date: Date | { toDate: () => Date } | string,
  language: 'fr' | 'en' = 'fr'
): string {
  if (!date) return '';

  let dateObj: Date;

  if (typeof date === 'object' && 'toDate' in date && typeof date.toDate === 'function') {
    dateObj = date.toDate();
  } else if (typeof date === 'string') {
    dateObj = new Date(date);
  } else if (date instanceof Date) {
    dateObj = date;
  } else {
    return '';
  }

  const locale = language === 'fr' ? 'fr-FR' : 'en-GB';
  return dateObj.toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formate uniquement l'heure selon la langue spécifiée
 */
export function formatTime(
  date: Date | { toDate: () => Date } | string,
  language: 'fr' | 'en' = 'fr'
): string {
  if (!date) return '';

  let dateObj: Date;

  if (typeof date === 'object' && 'toDate' in date && typeof date.toDate === 'function') {
    dateObj = date.toDate();
  } else if (typeof date === 'string') {
    dateObj = new Date(date);
  } else if (date instanceof Date) {
    dateObj = date;
  } else {
    return '';
  }

  const locale = language === 'fr' ? 'fr-FR' : 'en-GB';
  return dateObj.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formate un montant en euros selon la langue
 */
export function formatCurrency(
  amount: number,
  language: 'fr' | 'en' = 'fr'
): string {
  const locale = language === 'fr' ? 'fr-FR' : 'en-GB';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

/**
 * Formate un nombre selon la langue
 */
export function formatNumber(
  number: number,
  language: 'fr' | 'en' = 'fr'
): string {
  const locale = language === 'fr' ? 'fr-FR' : 'en-GB';
  return new Intl.NumberFormat(locale).format(number);
}

/**
 * Retourne le nom du jour de la semaine selon la langue
 */
export function getWeekdayName(
  date: Date | { toDate: () => Date },
  language: 'fr' | 'en' = 'fr',
  format: 'long' | 'short' = 'long'
): string {
  let dateObj: Date;

  if (typeof date === 'object' && 'toDate' in date && typeof date.toDate === 'function') {
    dateObj = date.toDate();
  } else if (date instanceof Date) {
    dateObj = date;
  } else {
    return '';
  }

  const locale = language === 'fr' ? 'fr-FR' : 'en-GB';
  return dateObj.toLocaleDateString(locale, { weekday: format });
}

/**
 * Retourne le nom du mois selon la langue
 */
export function getMonthName(
  date: Date | { toDate: () => Date },
  language: 'fr' | 'en' = 'fr',
  format: 'long' | 'short' = 'long'
): string {
  let dateObj: Date;

  if (typeof date === 'object' && 'toDate' in date && typeof date.toDate === 'function') {
    dateObj = date.toDate();
  } else if (date instanceof Date) {
    dateObj = date;
  } else {
    return '';
  }

  const locale = language === 'fr' ? 'fr-FR' : 'en-GB';
  return dateObj.toLocaleDateString(locale, { month: format });
}
