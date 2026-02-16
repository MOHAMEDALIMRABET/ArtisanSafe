/**
 * Service de gestion des demandes de rappel
 * Gestion des notifications email et statistiques
 */

import { 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  doc, 
  query, 
  orderBy, 
  where,
  Timestamp 
} from 'firebase/firestore';
import { db } from './config';

export interface Rappel {
  id?: string;
  nom: string;
  prenom: string;
  telephone: string;
  email?: string;
  horairePrefere: 'matin' | 'apres-midi' | 'soir' | 'indifferent';
  message?: string;
  statut: 'en_attente' | 'traite' | 'annule';
  createdAt: Timestamp;
  traitePar?: string;
  dateTraitement?: Timestamp;
}

export interface RappelStats {
  total: number;
  enAttente: number;
  traites: number;
  annules: number;
  tempsMoyenTraitement: number; // en minutes
  tauxTraitement: number; // pourcentage
  rappelsAujourdhui: number;
  rappelsSemaine: number;
}

/**
 * Créer une nouvelle demande de rappel avec notification email admin
 */
export async function createRappel(data: Omit<Rappel, 'id' | 'statut' | 'createdAt' | 'traitePar' | 'dateTraitement'>): Promise<string> {
  try {
    const rappelData = {
      ...data,
      statut: 'en_attente' as const,
      createdAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, 'rappels'), rappelData);

    // Envoyer email de notification à l'admin
    await sendAdminNotification({
      ...rappelData,
      id: docRef.id
    });

    return docRef.id;
  } catch (error) {
    console.error('Erreur création rappel:', error);
    throw error;
  }
}

/**
 * Marquer un rappel comme traité avec notification client
 */
export async function markRappelAsTraite(rappelId: string, adminUid: string, rappelData: Rappel): Promise<void> {
  try {
    await updateDoc(doc(db, 'rappels', rappelId), {
      statut: 'traite',
      traitePar: adminUid,
      dateTraitement: Timestamp.now(),
    });

    // Envoyer email de confirmation au client (si email fourni)
    if (rappelData.email) {
      await sendClientConfirmation(rappelData);
    }
  } catch (error) {
    console.error('Erreur mise à jour rappel:', error);
    throw error;
  }
}

/**
 * Marquer un rappel comme annulé
 */
export async function markRappelAsAnnule(rappelId: string, adminUid: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'rappels', rappelId), {
      statut: 'annule',
      traitePar: adminUid,
      dateTraitement: Timestamp.now(),
    });
  } catch (error) {
    console.error('Erreur annulation rappel:', error);
    throw error;
  }
}

/**
 * Récupérer toutes les demandes de rappel
 */
export async function getAllRappels(): Promise<Rappel[]> {
  try {
    const q = query(collection(db, 'rappels'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Rappel[];
  } catch (error) {
    console.error('Erreur récupération rappels:', error);
    throw error;
  }
}

/**
 * Calculer les statistiques avancées des rappels
 */
export async function getRappelStats(): Promise<RappelStats> {
  try {
    const rappels = await getAllRappels();
    
    const total = rappels.length;
    const enAttente = rappels.filter(r => r.statut === 'en_attente').length;
    const traites = rappels.filter(r => r.statut === 'traite').length;
    const annules = rappels.filter(r => r.statut === 'annule').length;

    // Calcul temps moyen de traitement (en minutes)
    const rappelsTraites = rappels.filter(r => r.statut === 'traite' && r.dateTraitement);
    let tempsMoyenTraitement = 0;
    
    if (rappelsTraites.length > 0) {
      const totalMinutes = rappelsTraites.reduce((sum, r) => {
        if (r.dateTraitement) {
          const createdMs = r.createdAt.toMillis();
          const treatedMs = r.dateTraitement.toMillis();
          const diffMinutes = (treatedMs - createdMs) / (1000 * 60);
          return sum + diffMinutes;
        }
        return sum;
      }, 0);
      
      tempsMoyenTraitement = Math.round(totalMinutes / rappelsTraites.length);
    }

    // Taux de traitement
    const tauxTraitement = total > 0 ? Math.round((traites / total) * 100) : 0;

    // Rappels aujourd'hui
    const aujourdhui = new Date();
    aujourdhui.setHours(0, 0, 0, 0);
    const rappelsAujourdhui = rappels.filter(r => {
      const createdDate = r.createdAt.toDate();
      return createdDate >= aujourdhui;
    }).length;

    // Rappels cette semaine (7 derniers jours)
    const uneSemaineAgo = new Date();
    uneSemaineAgo.setDate(uneSemaineAgo.getDate() - 7);
    const rappelsSemaine = rappels.filter(r => {
      const createdDate = r.createdAt.toDate();
      return createdDate >= uneSemaineAgo;
    }).length;

    return {
      total,
      enAttente,
      traites,
      annules,
      tempsMoyenTraitement,
      tauxTraitement,
      rappelsAujourdhui,
      rappelsSemaine,
    };
  } catch (error) {
    console.error('Erreur calcul stats rappels:', error);
    throw error;
  }
}

/**
 * Envoyer notification email à l'admin (nouvelle demande)
 */
async function sendAdminNotification(rappel: Rappel): Promise<void> {
  try {
    // Appel à l'API backend pour envoyer l'email
    const response = await fetch('/api/v1/emails/rappel-admin-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nom: rappel.nom,
        prenom: rappel.prenom,
        telephone: rappel.telephone,
        email: rappel.email || 'Non fourni',
        horairePrefere: rappel.horairePrefere,
        message: rappel.message || 'Aucun message',
        rappelId: rappel.id,
      }),
    });

    if (!response.ok) {
      console.error('Erreur envoi email admin:', await response.text());
    }
  } catch (error) {
    console.error('Erreur envoi notification admin:', error);
    // Ne pas bloquer la création du rappel si l'email échoue
  }
}

/**
 * Envoyer email de confirmation au client (après traitement)
 */
async function sendClientConfirmation(rappel: Rappel): Promise<void> {
  try {
    if (!rappel.email) return;

    const response = await fetch('/api/v1/emails/rappel-client-confirmation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nom: rappel.nom,
        prenom: rappel.prenom,
        email: rappel.email,
        telephone: rappel.telephone,
      }),
    });

    if (!response.ok) {
      console.error('Erreur envoi email client:', await response.text());
    }
  } catch (error) {
    console.error('Erreur envoi confirmation client:', error);
  }
}

/**
 * Formater le temps de traitement en texte lisible
 */
export function formatTempsTraitement(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
  
  const heures = Math.floor(minutes / 60);
  const minutesRestantes = minutes % 60;
  
  if (minutesRestantes === 0) {
    return `${heures} heure${heures > 1 ? 's' : ''}`;
  }
  
  return `${heures}h ${minutesRestantes}min`;
}
