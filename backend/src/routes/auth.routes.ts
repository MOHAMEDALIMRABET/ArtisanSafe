/**
 * Routes pour la gestion des utilisateurs Firebase Authentication
 */

import { Router, Request, Response, NextFunction } from 'express';
import { adminAuth, adminDb } from '../config/firebase-admin';

const router = Router();

/**
 * Middleware : vérifie que l'appelant est authentifié ET a le rôle 'admin' dans Firestore
 */
async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Token manquant' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decoded = await adminAuth.verifyIdToken(idToken);

    // Vérifier le rôle dans Firestore
    const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Accès réservé aux administrateurs' });
    }

    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Token invalide ou expiré' });
  }
}

/**
 * DELETE /api/v1/auth/users/:uid
 * Supprimer un utilisateur de Firebase Authentication (admin uniquement)
 */
router.delete('/users/:uid', requireAdmin, async (req, res) => {
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
    
    // Gérer le cas où l'utilisateur n'existe pas (considéré comme succès)
    if (error.code === 'auth/user-not-found') {
      return res.json({
        success: true,
        message: 'Utilisateur déjà absent de Firebase Auth'
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
