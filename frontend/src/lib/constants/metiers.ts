import type { Categorie } from '@/types/firestore';

/**
 * Liste complète des métiers disponibles sur la plateforme
 */
export const METIERS_DISPONIBLES: Categorie[] = [
  'plomberie',
  'electricite',
  'menuiserie',
  'maconnerie',
  'charpente',
  'peinture',
  'placo',
  'carrelage',
  'chauffage',
  'climatisation',
  'toiture',
  'isolation',
  'serrurerie',
  'renovation',
  'autre'
];

/**
 * Mapping métiers : valeur technique -> label d'affichage
 */
export const METIERS_MAP: Record<Categorie, string> = {
  'plomberie': 'Plomberie',
  'electricite': 'Électricité',
  'menuiserie': 'Menuiserie',
  'maconnerie': 'Maçonnerie',
  'charpente': 'Charpente',
  'peinture': 'Peinture',
  'carrelage': 'Carrelage',
  'toiture': 'Toiture',
  'chauffage': 'Chauffage',
  'climatisation': 'Climatisation',
  'placo': 'Placo',
  'isolation': 'Isolation',
  'serrurerie': 'Serrurerie',
  'renovation': 'Rénovation',
  'autre': 'Autre'
};

/**
 * Liste des métiers avec leurs icônes pour l'affichage
 */
export const METIERS_AVEC_ICONES: { value: Categorie; label: string; icon: string }[] = [
  { value: 'plomberie', label: 'Plomberie', icon: '🔧' },
  { value: 'electricite', label: 'Électricité', icon: '⚡' },
  { value: 'menuiserie', label: 'Menuiserie', icon: '🪵' },
  { value: 'maconnerie', label: 'Maçonnerie', icon: '🧱' },
  { value: 'charpente', label: 'Charpente', icon: '🪚' },
  { value: 'peinture', label: 'Peinture', icon: '🎨' },
  { value: 'placo', label: 'Placo', icon: '🔨' },
  { value: 'carrelage', label: 'Carrelage', icon: '⬜' },
  { value: 'chauffage', label: 'Chauffage', icon: '🔥' },
  { value: 'climatisation', label: 'Climatisation', icon: '❄️' },
  { value: 'toiture', label: 'Toiture', icon: '🏠' },
  { value: 'isolation', label: 'Isolation', icon: '🧤' },
  { value: 'serrurerie', label: 'Serrurerie', icon: '🔐' },
  { value: 'renovation', label: 'Rénovation', icon: '🏗️' },
  { value: 'autre', label: 'Autre', icon: '🛠️' },
];
