/**
 * Routes pour la gestion des emails
 */

import { Router } from 'express';
import { processPendingEmails } from '../services/email-service';
import nodemailer from 'nodemailer';

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

/**
 * POST /api/v1/emails/rappel-admin-notification
 * Envoyer email à l'admin lors d'une nouvelle demande de rappel
 */
router.post('/rappel-admin-notification', async (req, res) => {
  try {
    const { nom, prenom, telephone, email, horairePrefere, message, createdAt } = req.body;

    if (!nom || !prenom || !telephone) {
      return res.status(400).json({ error: 'Données incomplètes' });
    }

    // Configuration du transporteur (vérifier si SMTP configuré)
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.log('⚠️ SMTP non configuré - Email admin non envoyé (dev mode)');
      return res.json({ success: true, message: 'Email désactivé en mode dev' });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    const horaireLabels: Record<string, string> = {
      'matin': 'Matin (9h - 12h)',
      'apres-midi': 'Après-midi (14h - 18h)',
      'soir': 'Soir (18h - 20h)',
      'indifferent': 'Indifférent',
    };

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa; }
          .card { background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #FF6B00 0%, #E56100 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; margin: -30px -30px 20px -30px; }
          .info-row { padding: 12px 0; border-bottom: 1px solid #e9ecef; }
          .info-label { font-weight: bold; color: #2C3E50; display: inline-block; width: 150px; }
          .info-value { color: #495057; }
          .message-box { background: #fff3e0; border-left: 4px solid #FF6B00; padding: 15px; margin: 15px 0; border-radius: 4px; }
          .btn { display: inline-block; padding: 12px 24px; background: #FF6B00; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <h1 style="margin: 0; font-size: 24px;">📞 Nouvelle demande de rappel</h1>
              <p style="margin: 5px 0 0 0; opacity: 0.9;">ArtisanDispo - Dashboard Admin</p>
            </div>
            <p style="font-size: 16px; color: #495057;">Une nouvelle demande de rappel vient d'être soumise sur la plateforme.</p>
            <div class="info-row">
              <span class="info-label">👤 Contact :</span>
              <span class="info-value">${prenom} ${nom}</span>
            </div>
            <div class="info-row">
              <span class="info-label">📱 Téléphone :</span>
              <span class="info-value"><a href="tel:${telephone}" style="color: #FF6B00; text-decoration: none; font-weight: bold;">${telephone}</a></span>
            </div>
            <div class="info-row">
              <span class="info-label">📧 Email :</span>
              <span class="info-value">${email !== 'Non fourni' ? `<a href="mailto:${email}" style="color: #FF6B00; text-decoration: none;">${email}</a>` : 'Non fourni'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">⏰ Horaire préféré :</span>
              <span class="info-value">${horaireLabels[horairePrefere] || horairePrefere}</span>
            </div>
            <div class="info-row">
              <span class="info-label">📅 Demandé le :</span>
              <span class="info-value">${createdAt}</span>
            </div>
            ${message !== 'Aucun message' ? `
            <div class="message-box">
              <strong style="color: #2C3E50;">💬 Message :</strong><br/>
              <p style="margin: 8px 0 0 0; color: #495057;">${message}</p>
            </div>
            ` : ''}
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #e9ecef;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/rappels" class="btn">Voir dans le dashboard</a>
            </div>
            <p style="margin-top: 30px; font-size: 12px; color: #6c757d; text-align: center;">
              Cet email a été envoyé automatiquement par la plateforme ArtisanDispo.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `"ArtisanDispo" <${process.env.SMTP_USER}>`,
      to: process.env.ADMIN_EMAIL || process.env.SMTP_USER,
      subject: `📞 Nouvelle demande de rappel - ${prenom} ${nom}`,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Email admin envoyé' });
  } catch (error: any) {
    console.error('Erreur envoi email admin:', error);
    res.status(500).json({ error: 'Erreur envoi email' });
  }
});

/**
 * POST /api/v1/emails/rappel-client-confirmation
 * Envoyer email de confirmation au client après traitement
 */
router.post('/rappel-client-confirmation', async (req, res) => {
  try {
    const { nom, prenom, email, telephone } = req.body;

    if (!nom || !prenom || !email) {
      return res.status(400).json({ error: 'Données incomplètes' });
    }

    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.log('⚠️ SMTP non configuré - Email client non envoyé (dev mode)');
      return res.json({ success: true, message: 'Email désactivé en mode dev' });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa; }
          .card { background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #28A745 0%, #20873A 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; margin: -30px -30px 20px -30px; text-align: center; }
          .check-icon { font-size: 48px; margin-bottom: 10px; }
          .highlight-box { background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .btn { display: inline-block; padding: 12px 24px; background: #FF6B00; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <div class="check-icon">✅</div>
              <h1 style="margin: 0; font-size: 24px;">Votre demande a été traitée</h1>
              <p style="margin: 5px 0 0 0; opacity: 0.9;">ArtisanDispo</p>
            </div>
            <p style="font-size: 16px; color: #495057;">Bonjour <strong>${prenom} ${nom}</strong>,</p>
            <div class="highlight-box">
              <p style="margin: 0; color: #155724; font-size: 15px;">✅ Votre demande de rappel a bien été traitée par notre équipe.</p>
            </div>
            <p style="color: #495057;">Nous vous avons contacté au <strong>${telephone}</strong> comme demandé.</p>
            <p style="color: #495057;">Si nous n'avons pas réussi à vous joindre, nous réessayerons prochainement.</p>
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #e9ecef;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" class="btn">Revenir sur ArtisanDispo</a>
            </div>
            <p style="margin-top: 30px; font-size: 12px; color: #6c757d; text-align: center;">
              Cet email a été envoyé automatiquement par ArtisanDispo.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `"ArtisanDispo" <${process.env.SMTP_USER}>`,
      to: email,
      subject: '✅ Votre demande de rappel a été traitée - ArtisanDispo',
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Email client envoyé' });
  } catch (error: any) {
    console.error('Erreur envoi email client:', error);
    res.status(500).json({ error: 'Erreur envoi email' });
  }
});

export default router;
