/**
 * Routes pour la gestion des emails
 */

import { Router } from 'express';
import { processPendingEmails } from '../services/email-service';

const router = Router();

/**
 * POST /api/v1/emails/send-pending
 * Envoyer tous les emails en attente
 */
router.post('/send-pending', async (req, res) => {
  try {
    console.log('📧 Déclenchement envoi emails en attente...');
    
    const results = await processPendingEmails();

    res.json({
      success: true,
      message: `${results.success} emails envoyés, ${results.failed} échecs`,
      data: results
    });
  } catch (error: any) {
    console.error('Erreur envoi emails:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/emails/status
 * Vérifier le statut des emails
 */
router.get('/status', async (req, res) => {
  try {
    const { adminDb } = await import('../config/firebase-admin');
    
    const emailsRef = adminDb.collection('email_notifications');
    
    const [pending, sent, failed] = await Promise.all([
      emailsRef.where('status', '==', 'pending').count().get(),
      emailsRef.where('status', '==', 'sent').count().get(),
      emailsRef.where('status', '==', 'failed').count().get()
    ]);

    res.json({
      success: true,
      data: {
        pending: pending.data().count,
        sent: sent.data().count,
        failed: failed.data().count,
        total: pending.data().count + sent.data().count + failed.data().count
      }
    });
  } catch (error: any) {
    console.error('Erreur récupération statut:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
