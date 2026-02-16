/**
 * Configuration sécurité admin
 * Centralise l'URL admin obscurcie
 */

// 🔒 URL admin sécurisée (depuis .env.local)
export const ADMIN_SECRET_PATH = process.env.NEXT_PUBLIC_ADMIN_SECRET_PATH || 'access-x7k9m2p4w8n3';

// URLs admin complètes
export const ADMIN_URLS = {
  login: `/${ADMIN_SECRET_PATH}`,
  dashboard: '/admin/dashboard',
  verifications: '/admin/verifications',
  comptes: '/admin/comptes',
  logs: '/admin/logs',
} as const;

// Helper pour vérifier si on est sur une page admin
export function isAdminPath(pathname: string): boolean {
  return pathname.startsWith('/admin') || pathname.startsWith(`/${ADMIN_SECRET_PATH}`);
}

// Helper pour générer URL admin
export function getAdminLoginUrl(): string {
  return `/${ADMIN_SECRET_PATH}`;
}
