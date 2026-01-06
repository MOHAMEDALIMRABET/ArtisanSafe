/**
 * Routes pour la gestion des utilisateurs Firebase Authentication
 */

import { Router } from 'express';
import { adminAuth } from '../config/firebase-admin';

const router = Router();

/**
 * DELETE /api/v1/auth/users/:uid
 * Supprimer un utilisateur de Firebase Authentication
 */
router.delete('/users/:uid', async (req, res) => {
  try {
    const { uid } = req.params;

    if (!uid) {
      return res.status(400).json({
        success: false,
        error: 'UID utilisateur requis'
      });
    }

    // Supprimer l'utilisateur de Firebase Auth
    await adminAuth.deleteUser(uid);

    console.log(`✅ Utilisateur ${uid} supprimé de Firebase Auth`);

    res.json({
      success: true,
      message: `Utilisateur ${uid} supprimé avec succès`
    });
  } catch (error: any) {
    console.error('Erreur suppression utilisateur Auth:', error);
    
    // Gérer le cas où l'utilisateur n'existe pas
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé dans Firebase Auth'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la suppression'
    });
  }
});

/**
 * GET /api/v1/auth/users/:uid
 * Vérifier si un utilisateur existe dans Firebase Auth
 */
router.get('/users/:uid', async (req, res) => {
  try {
    const { uid } = req.params;

    const userRecord = await adminAuth.getUser(uid);

    res.json({
      success: true,
      exists: true,
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        disabled: userRecord.disabled,
        emailVerified: userRecord.emailVerified
      }
    });
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      return res.json({
        success: true,
        exists: false
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
