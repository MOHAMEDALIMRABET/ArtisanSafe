/**
 * Service de gestion des utilisateurs
 * CRUD operations pour la collection 'users'
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from './config';
import type { User, CreateDocument, UpdateDocument } from '@/types/firestore';

const COLLECTION_NAME = 'users';

/**
 * Créer un nouvel utilisateur
 */
export async function createUser(
  userId: string,
  userData: CreateDocument<User>
): Promise<User> {
  const userRef = doc(db, COLLECTION_NAME, userId);
  
  const newUser: User = {
    ...userData,
    uid: userId,
    dateCreation: Timestamp.now(),
  };

  await setDoc(userRef, newUser);
  return newUser;
}

/**
 * Récupérer un utilisateur par son ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  const userRef = doc(db, COLLECTION_NAME, userId);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    return null;
  }

  return userSnap.data() as User;
}

/**
 * Récupérer un utilisateur par email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const usersRef = collection(db, COLLECTION_NAME);
  const q = query(usersRef, where('email', '==', email));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    return null;
  }

  return querySnapshot.docs[0].data() as User;
}

/**
 * Mettre à jour un utilisateur
 */
export async function updateUser(
  userId: string,
  updates: UpdateDocument<User>
): Promise<void> {
  const userRef = doc(db, COLLECTION_NAME, userId);
  const { id, ...updateData } = updates;
  
  await updateDoc(userRef, updateData);
}

/**
 * Mettre à jour le statut d'un utilisateur
 */
export async function updateUserStatut(
  userId: string,
  statut: User['statut']
): Promise<void> {
  const userRef = doc(db, COLLECTION_NAME, userId);
  await updateDoc(userRef, { statut });
}

/**
 * Mettre à jour les préférences de notifications
 */
export async function updateNotificationPreferences(
  userId: string,
  preferences: User['preferencesNotifications']
): Promise<void> {
  const userRef = doc(db, COLLECTION_NAME, userId);
  await updateDoc(userRef, { preferencesNotifications: preferences });
}

/**
 * Supprimer un utilisateur (admin uniquement)
 */
export async function deleteUser(userId: string): Promise<void> {
  const userRef = doc(db, COLLECTION_NAME, userId);
  await deleteDoc(userRef);
}

/**
 * Vérifier si un utilisateur existe
 */
export async function userExists(userId: string): Promise<boolean> {
  const userRef = doc(db, COLLECTION_NAME, userId);
  const userSnap = await getDoc(userRef);
  return userSnap.exists();
}

/**
 * Récupérer tous les utilisateurs (admin uniquement)
 */
export async function getAllUsers(): Promise<User[]> {
  const usersRef = collection(db, COLLECTION_NAME);
  const querySnapshot = await getDocs(usersRef);
  
  return querySnapshot.docs.map(doc => doc.data() as User);
}

/**
 * Récupérer les utilisateurs par rôle
 */
export async function getUsersByRole(role: User['role']): Promise<User[]> {
  const usersRef = collection(db, COLLECTION_NAME);
  const q = query(usersRef, where('role', '==', role));
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => doc.data() as User);
}
