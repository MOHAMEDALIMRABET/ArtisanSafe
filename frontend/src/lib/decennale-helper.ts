// Helper pour la gestion de l'obligation décennale
// Utilisable côté artisan (profil/vérification) et côté client (recherche)

import type { Categorie } from '@/types/firestore';

// Liste des métiers soumis à la décennale
export const metiersDecennale: Categorie[] = [
  'maconnerie',
  'toiture',
  'charpente',
  'menuiserie',
  'isolation',
  'plomberie',
  'electricite',
  'carrelage',
  'chauffage',
  'climatisation',
];

// Vérifie si un artisan doit fournir la décennale
export function artisanDoitDecennale(metiers: Categorie[]): boolean {
  return metiers.some(metier => metiersDecennale.includes(metier));
}

// Vérifie si un artisan est "décennale vérifiée" (pour affichage client)
export function isDecennaleVerifiee(artisan: { verificationDocuments?: any; metiers: Categorie[] }): boolean {
  if (!artisanDoitDecennale(artisan.metiers)) return false;
  return artisan.verificationDocuments?.decennale?.verified === true;
}

// Utilisation côté client (recherche)
// Exemple : filtrer les artisans avec décennale vérifiée
// artisans.filter(a => isDecennaleVerifiee(a));
