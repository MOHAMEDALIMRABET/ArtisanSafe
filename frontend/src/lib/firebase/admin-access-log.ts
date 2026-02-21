/**
 * Service de logging des accès admin
 * Enregistre toutes les tentatives de connexion admin (succès/échecs)
 */

import { db } from '@/lib/firebase/config';
import { collection, addDoc, query, where, getDocs, Timestamp, orderBy, limit } from 'firebase/firestore';

export interface AdminAccessLog {
  timestamp: Timestamp;
  adminId?: string;
  adminEmail?: string;
  action: 'login_attempt' | 'login_success' | 'login_failed' | 'logout' | 'unauthorized_access' | 'whitelist_blocked';
  ipAddress: string;
  userAgent: string;
  details?: string;
}

/**
 * Logger une tentative d'accès admin
 */
export async function logAdminAccess(log: Omit<AdminAccessLog, 'timestamp'>) {
  try {
    await addDoc(collection(db, 'admin_access_logs'), {
      ...log,
      timestamp: Timestamp.now(),
    });
  } catch (error) {
    console.error('Erreur logging admin access:', error);
    // Ne pas bloquer l'application si le logging échoue
  }
}

/**
 * Récupérer les logs d'accès admin
 */
export async function getAdminAccessLogs(adminId?: string, limitCount: number = 50) {
  try {
    let q;
    
    if (adminId) {
      q = query(
        collection(db, 'admin_access_logs'),
        where('adminId', '==', adminId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
    } else {
      q = query(
        collection(db, 'admin_access_logs'),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as (AdminAccessLog & { id: string })[];
  } catch (error) {
    console.error('Erreur récupération logs:', error);
    return [];
  }
}

/**
 * Détecter les tentatives de brute force
 * Retourne true si plus de 5 tentatives échouées en 10 minutes
 */
export async function detectBruteForce(ipAddress: string): Promise<boolean> {
  try {
    const tenMinutesAgo = Timestamp.fromDate(
      new Date(Date.now() - 10 * 60 * 1000)
    );

    const q = query(
      collection(db, 'admin_access_logs'),
      where('ipAddress', '==', ipAddress),
      where('action', '==', 'login_failed'),
      where('timestamp', '>=', tenMinutesAgo)
    );

    const snapshot = await getDocs(q);
    return snapshot.size >= 5; // 5 tentatives échouées = brute force
  } catch (error) {
    console.error('Erreur détection brute force:', error);
    return false;
  }
}

/**
 * Bloquer une IP temporairement (à implémenter avec une collection séparée)
 */
export async function blockIP(ipAddress: string, reason: string, durationMinutes: number = 30) {
  try {
    await addDoc(collection(db, 'blocked_ips'), {
      ipAddress,
      reason,
      blockedAt: Timestamp.now(),
      expiresAt: Timestamp.fromDate(
        new Date(Date.now() + durationMinutes * 60 * 1000)
      ),
    });
  } catch (error) {
    console.error('Erreur blocage IP:', error);
  }
}

/**
 * Vérifier si une IP est bloquée
 */
export async function isIPBlocked(ipAddress: string): Promise<boolean> {
  try {
    const now = Timestamp.now();
    const q = query(
      collection(db, 'blocked_ips'),
      where('ipAddress', '==', ipAddress),
      where('expiresAt', '>', now)
    );

    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    console.error('Erreur vérification IP bloquée:', error);
    return false;
  }
}
