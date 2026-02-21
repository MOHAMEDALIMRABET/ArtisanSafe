/**
 * Service de gestion des tickets de support
 * 
 * Fonctionnalités :
 * - Création tickets par artisans/clients
 * - Gestion admin (réponse, clôture)
 * - Notifications automatiques
 * - Historique complet
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
  arrayUnion,
} from 'firebase/firestore';
import { db } from './config';

/**
 * Types
 */
export type SupportTicketCategorie = 
  | 'modification_iban' 
  | 'compte_restreint' 
  | 'verification_documents'
  | 'probleme_technique'
  | 'question_generale'
  | 'autre';

export type SupportTicketStatut = 'ouvert' | 'en_cours' | 'resolu' | 'ferme';

export type SupportTicketPriorite = 'basse' | 'normale' | 'haute' | 'urgente';

export interface SupportTicketReponse {
  auteurId: string;
  auteurNom: string;
  auteurRole: 'artisan' | 'client' | 'admin';
  message: string;
  dateReponse: Timestamp;
  pieceJointe?: string; // URL Firebase Storage
}

export interface SupportTicket {
  id: string;
  numero: string; // Format: #2026-001
  
  // Demandeur
  userId: string;
  userEmail: string;
  userNom: string;
  userRole: 'artisan' | 'client';
  
  // Contenu
  categorie: SupportTicketCategorie;
  sujet: string;
  message: string;
  
  // Statut
  statut: SupportTicketStatut;
  priorite: SupportTicketPriorite;
  
  // Réponses
  reponses: SupportTicketReponse[];
  dernierMessagePar?: 'user' | 'admin';
  dernierMessageDate?: Timestamp;
  
  // Admin assigné
  assigneA?: string; // UID admin
  assigneNom?: string;
  
  // Dates
  createdAt: Timestamp;
  updatedAt: Timestamp;
  resoluAt?: Timestamp;
  fermeAt?: Timestamp;
  
  // Métadonnées
  vueParAdmin: boolean;
  nonLuParUser: boolean; // True si admin a répondu et user n'a pas vu
}

const TICKETS_COLLECTION = 'support_tickets';

/**
 * Générer numéro de ticket unique
 * Format: #2026-001, #2026-002, etc.
 */
async function genererNumeroTicket(): Promise<string> {
  const annee = new Date().getFullYear();
  
  // Compter tickets de l'année en cours
  const q = query(
    collection(db, TICKETS_COLLECTION),
    where('numero', '>=', `#${annee}-000`),
    where('numero', '<=', `#${annee}-999`)
  );
  
  const snapshot = await getDocs(q);
  const count = snapshot.size + 1;
  
  // Format: #2026-001
  return `#${annee}-${count.toString().padStart(3, '0')}`;
}

/**
 * Créer un ticket de support
 */
export async function createSupportTicket(data: {
  userId: string;
  userEmail: string;
  userNom: string;
  userRole: 'artisan' | 'client';
  categorie: SupportTicketCategorie;
  sujet: string;
  message: string;
  priorite?: SupportTicketPriorite;
}): Promise<string> {
  try {
    const numero = await genererNumeroTicket();
    
    const ticketData: Omit<SupportTicket, 'id'> = {
      numero,
      userId: data.userId,
      userEmail: data.userEmail,
      userNom: data.userNom,
      userRole: data.userRole,
      categorie: data.categorie,
      sujet: data.sujet,
      message: data.message,
      statut: 'ouvert',
      priorite: data.priorite || 'normale',
      reponses: [],
      dernierMessagePar: 'user',
      dernierMessageDate: Timestamp.now(),
      vueParAdmin: false,
      nonLuParUser: false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    
    const docRef = await addDoc(collection(db, TICKETS_COLLECTION), ticketData);
    
    console.log('✅ Ticket créé:', numero, docRef.id);
    
    // Envoyer notification email admin (via backend)
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/support/notify-new-ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: docRef.id,
          numero,
          categorie: data.categorie,
          sujet: data.sujet,
          userEmail: data.userEmail,
          userNom: data.userNom,
        }),
      });
    } catch (emailError) {
      console.warn('⚠️ Notification email admin échouée:', emailError);
      // Ne pas bloquer la création du ticket
    }
    
    return docRef.id;
  } catch (error) {
    console.error('❌ Erreur création ticket:', error);
    throw error;
  }
}

/**
 * Récupérer un ticket par ID
 */
export async function getSupportTicketById(ticketId: string): Promise<SupportTicket | null> {
  try {
    const docSnap = await getDoc(doc(db, TICKETS_COLLECTION, ticketId));
    
    if (!docSnap.exists()) {
      return null;
    }
    
    return {
      id: docSnap.id,
      ...docSnap.data(),
    } as SupportTicket;
  } catch (error) {
    console.error('❌ Erreur récupération ticket:', error);
    throw error;
  }
}

/**
 * Récupérer tous les tickets d'un utilisateur
 */
export async function getUserSupportTickets(userId: string): Promise<SupportTicket[]> {
  try {
    const q = query(
      collection(db, TICKETS_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as SupportTicket[];
  } catch (error) {
    console.error('❌ Erreur récupération tickets utilisateur:', error);
    throw error;
  }
}

/**
 * Récupérer tous les tickets (Admin)
 */
export async function getAllSupportTickets(filters?: {
  statut?: SupportTicketStatut;
  categorie?: SupportTicketCategorie;
  priorite?: SupportTicketPriorite;
  nonVus?: boolean;
}): Promise<SupportTicket[]> {
  try {
    let q = query(
      collection(db, TICKETS_COLLECTION),
      orderBy('createdAt', 'desc')
    );
    
    // Appliquer filtres (note: nécessite index composite si multiples where)
    // Pour éviter les index, on filtre côté client
    
    const snapshot = await getDocs(q);
    let tickets = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as SupportTicket[];
    
    // Filtres côté client
    if (filters?.statut) {
      tickets = tickets.filter(t => t.statut === filters.statut);
    }
    
    if (filters?.categorie) {
      tickets = tickets.filter(t => t.categorie === filters.categorie);
    }
    
    if (filters?.priorite) {
      tickets = tickets.filter(t => t.priorite === filters.priorite);
    }
    
    if (filters?.nonVus) {
      tickets = tickets.filter(t => !t.vueParAdmin);
    }
    
    return tickets;
  } catch (error) {
    console.error('❌ Erreur récupération tous tickets:', error);
    throw error;
  }
}

/**
 * Ajouter une réponse à un ticket
 */
export async function addTicketResponse(
  ticketId: string,
  reponse: {
    auteurId: string;
    auteurNom: string;
    auteurRole: 'artisan' | 'client' | 'admin';
    message: string;
  }
): Promise<void> {
  try {
    const ticket = await getSupportTicketById(ticketId);
    
    if (!ticket) {
      throw new Error('Ticket introuvable');
    }
    
    const nouvelleReponse: SupportTicketReponse = {
      ...reponse,
      dateReponse: Timestamp.now(),
    };
    
    await updateDoc(doc(db, TICKETS_COLLECTION, ticketId), {
      reponses: arrayUnion(nouvelleReponse),
      dernierMessagePar: reponse.auteurRole === 'admin' ? 'admin' : 'user',
      dernierMessageDate: Timestamp.now(),
      updatedAt: Timestamp.now(),
      // Marquer comme non lu par l'autre partie
      ...(reponse.auteurRole === 'admin' 
        ? { nonLuParUser: true } 
        : { vueParAdmin: false }
      ),
      // Changer statut si c'était ouvert
      ...(ticket.statut === 'ouvert' && reponse.auteurRole === 'admin' 
        ? { statut: 'en_cours' } 
        : {}
      ),
    });
    
    console.log('✅ Réponse ajoutée au ticket', ticketId);
    
    // Notifier par email (si admin répond → email user, si user répond → email admin)
    if (reponse.auteurRole === 'admin') {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/support/notify-user-response`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticketId,
            numero: ticket.numero,
            userEmail: ticket.userEmail,
            message: reponse.message,
          }),
        });
      } catch (emailError) {
        console.warn('⚠️ Email notification échouée:', emailError);
      }
    }
  } catch (error) {
    console.error('❌ Erreur ajout réponse:', error);
    throw error;
  }
}

/**
 * Marquer un ticket comme vu par admin
 */
export async function markTicketAsViewed(ticketId: string): Promise<void> {
  try {
    await updateDoc(doc(db, TICKETS_COLLECTION, ticketId), {
      vueParAdmin: true,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('❌ Erreur marquage ticket vu:', error);
    throw error;
  }
}

/**
 * Marquer les réponses admin comme lues par user
 */
export async function markTicketResponsesAsRead(ticketId: string): Promise<void> {
  try {
    await updateDoc(doc(db, TICKETS_COLLECTION, ticketId), {
      nonLuParUser: false,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('❌ Erreur marquage réponses lues:', error);
    throw error;
  }
}

/**
 * Changer le statut d'un ticket (Admin)
 */
export async function updateTicketStatus(
  ticketId: string,
  statut: SupportTicketStatut
): Promise<void> {
  try {
    const updateData: any = {
      statut,
      updatedAt: Timestamp.now(),
    };
    
    if (statut === 'resolu') {
      updateData.resoluAt = Timestamp.now();
    } else if (statut === 'ferme') {
      updateData.fermeAt = Timestamp.now();
    }
    
    await updateDoc(doc(db, TICKETS_COLLECTION, ticketId), updateData);
    
    console.log('✅ Statut ticket mis à jour:', ticketId, statut);
  } catch (error) {
    console.error('❌ Erreur mise à jour statut:', error);
    throw error;
  }
}

/**
 * Changer la priorité d'un ticket (Admin)
 */
export async function updateTicketPriority(
  ticketId: string,
  priorite: SupportTicketPriorite
): Promise<void> {
  try {
    await updateDoc(doc(db, TICKETS_COLLECTION, ticketId), {
      priorite,
      updatedAt: Timestamp.now(),
    });
    
    console.log('✅ Priorité ticket mise à jour:', ticketId, priorite);
  } catch (error) {
    console.error('❌ Erreur mise à jour priorité:', error);
    throw error;
  }
}

/**
 * Assigner un ticket à un admin (Admin)
 */
export async function assignTicket(
  ticketId: string,
  adminId: string,
  adminNom: string
): Promise<void> {
  try {
    await updateDoc(doc(db, TICKETS_COLLECTION, ticketId), {
      assigneA: adminId,
      assigneNom: adminNom,
      statut: 'en_cours',
      updatedAt: Timestamp.now(),
    });
    
    console.log('✅ Ticket assigné à:', adminNom);
  } catch (error) {
    console.error('❌ Erreur assignation ticket:', error);
    throw error;
  }
}

/**
 * Helper : Obtenir le label d'une catégorie
 */
export function getCategorieLabel(categorie: SupportTicketCategorie): string {
  const labels: Record<SupportTicketCategorie, string> = {
    modification_iban: '💳 Modification IBAN',
    compte_restreint: '⚠️ Compte Restreint',
    verification_documents: '📄 Vérification Documents',
    probleme_technique: '🔧 Problème Technique',
    question_generale: '❓ Question Générale',
    autre: '📌 Autre',
  };
  
  return labels[categorie] || categorie;
}

/**
 * Helper : Obtenir la couleur d'un statut
 */
export function getStatutColor(statut: SupportTicketStatut): string {
  const colors: Record<SupportTicketStatut, string> = {
    ouvert: 'bg-blue-100 text-blue-800',
    en_cours: 'bg-yellow-100 text-yellow-800',
    resolu: 'bg-green-100 text-green-800',
    ferme: 'bg-gray-100 text-gray-800',
  };
  
  return colors[statut] || 'bg-gray-100 text-gray-800';
}

/**
 * Helper : Obtenir la couleur d'une priorité
 */
export function getPrioriteColor(priorite: SupportTicketPriorite): string {
  const colors: Record<SupportTicketPriorite, string> = {
    basse: 'text-gray-600',
    normale: 'text-blue-600',
    haute: 'text-orange-600',
    urgente: 'text-red-600',
  };
  
  return colors[priorite] || 'text-gray-600';
}

/**
 * Helper : Calculer temps de réponse moyen (Admin stats)
 */
export async function getAverageResponseTime(): Promise<number> {
  try {
    const tickets = await getAllSupportTickets({ statut: 'resolu' });
    
    let totalMinutes = 0;
    let count = 0;
    
    tickets.forEach(ticket => {
      if (ticket.reponses.length > 0 && ticket.createdAt) {
        const premiereReponse = ticket.reponses[0];
        const diff = premiereReponse.dateReponse.toMillis() - ticket.createdAt.toMillis();
        totalMinutes += diff / (1000 * 60); // Convertir en minutes
        count++;
      }
    });
    
    return count > 0 ? totalMinutes / count : 0;
  } catch (error) {
    console.error('❌ Erreur calcul temps réponse:', error);
    return 0;
  }
}
