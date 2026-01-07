/**
 * Service Firebase Storage pour l'upload de fichiers
 */

import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './config';

/**
 * Upload une photo vers Firebase Storage
 * @param file - Fichier à uploader
 * @param folder - Dossier de destination (ex: 'demandes', 'artisans')
 * @param userId - ID de l'utilisateur (pour organiser les fichiers)
 * @returns URL de téléchargement du fichier
 */
export async function uploadPhoto(
  file: File,
  folder: string,
  userId: string
): Promise<string> {
  try {
    // Générer un nom de fichier unique
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 9);
    const fileExtension = file.name.split('.').pop();
    const fileName = `${timestamp}_${randomId}.${fileExtension}`;
    
    // Créer la référence Storage
    const storageRef = ref(storage, `${folder}/${userId}/${fileName}`);
    
    // Métadonnées avec le nom original
    const metadata = {
      customMetadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
      },
      contentType: file.type,
    };
    
    // Upload le fichier avec métadonnées
    console.log(`📤 Upload de ${file.name} vers ${folder}/${userId}/${fileName}...`);
    await uploadBytes(storageRef, file, metadata);
    
    // Récupérer l'URL de téléchargement
    const downloadURL = await getDownloadURL(storageRef);
    console.log(`✅ Photo uploadée avec succès: ${downloadURL}`);
    
    return downloadURL;
  } catch (error) {
    console.error('❌ Erreur upload photo:', error);
    throw new Error(`Erreur lors de l'upload de la photo: ${file.name}`);
  }
}

/**
 * Upload plusieurs photos en parallèle
 * @param files - Liste de fichiers à uploader
 * @param folder - Dossier de destination
 * @param userId - ID de l'utilisateur
 * @returns Liste des URLs de téléchargement
 */
export async function uploadMultiplePhotos(
  files: File[],
  folder: string,
  userId: string
): Promise<string[]> {
  try {
    console.log(`📤 Upload de ${files.length} photo(s)...`);
    
    // Upload toutes les photos en parallèle
    const uploadPromises = files.map(file => uploadPhoto(file, folder, userId));
    const urls = await Promise.all(uploadPromises);
    
    console.log(`✅ ${urls.length} photo(s) uploadée(s) avec succès`);
    return urls;
  } catch (error) {
    console.error('❌ Erreur upload multiple photos:', error);
    throw error;
  }
}
/**
 * Récupérer les métadonnées d'un fichier (incluant le nom original)
 */
export async function getFileMetadata(url: string): Promise<{ originalName?: string } | null> {
  try {
    // Extraire le chemin du fichier depuis l'URL
    const pathMatch = url.match(/\/o\/(.+?)\?/);
    if (!pathMatch) return null;
    
    const filePath = decodeURIComponent(pathMatch[1]);
    const fileRef = ref(storage, filePath);
    
    const metadata = await import('firebase/storage').then(m => m.getMetadata(fileRef));
    
    return {
      originalName: metadata.customMetadata?.originalName,
    };
  } catch (error) {
    console.error('Erreur récupération métadonnées:', error);
    return null;
  }
}
/**
 * Supprimer une photo de Firebase Storage
 * @param photoUrl - URL de la photo à supprimer
 */
export async function deletePhoto(photoUrl: string): Promise<void> {
  try {
    // Extraire le chemin depuis l'URL Firebase Storage
    const urlParts = photoUrl.split('/o/')[1];
    if (!urlParts) {
      throw new Error('URL Firebase Storage invalide');
    }
    
    const filePath = decodeURIComponent(urlParts.split('?')[0]);
    const storageRef = ref(storage, filePath);
    
    await deleteObject(storageRef);
    console.log(`✅ Photo supprimée: ${filePath}`);
  } catch (error) {
    console.error('❌ Erreur suppression photo:', error);
    throw error;
  }
}

/**
 * Supprimer plusieurs photos
 * @param photoUrls - Liste des URLs à supprimer
 */
export async function deleteMultiplePhotos(photoUrls: string[]): Promise<void> {
  try {
    const deletePromises = photoUrls.map(url => deletePhoto(url));
    await Promise.all(deletePromises);
    console.log(`✅ ${photoUrls.length} photo(s) supprimée(s)`);
  } catch (error) {
    console.error('❌ Erreur suppression multiple photos:', error);
    throw error;
  }
}
