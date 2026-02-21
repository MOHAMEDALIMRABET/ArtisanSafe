/**
 * Routes pour le système de support tickets
 * Gestion notifications email
 */

import express from 'express';
import nodemailer from 'nodemailer';

const router = express.Router();

// Configuration email (à adapter selon votre provider)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

/**
 * POST /api/v1/support/notify-new-ticket
 * Envoyer email à l'admin quand nouveau ticket créé
 */
router.post('/notify-new-ticket', async (req, res) => {
  try {
    const { ticketId, numero, categorie, sujet, userEmail, userNom } = req.body;

    if (!ticketId || !numero || !sujet) {
      return res.status(400).json({
        success: false,
        error: 'Paramètres manquants',
      });
    }

    const categorieLabels: Record<string, string> = {
      modification_iban: '💳 Modification IBAN',
      compte_restreint: '⚠️ Compte Restreint',
      verification_documents: '📄 Vérification Documents',
      probleme_technique: '🔧 Problème Technique',
      question_generale: '❓ Question Générale',
      autre: '📌 Autre',
    };

    // ⚠️ TODO: Remplacer par le vrai email support@artisandispo.fr après achat domaine
    // En attendant, utiliser ADMIN_EMAIL (email actuel du propriétaire)
    const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER || 'support@artisandispo.fr';

    // Email à l'admin
    // Note: L'expéditeur utilise SMTP_USER (email configuré actuellement)
    // À modifier après achat du domaine artisandispo.fr
    await transporter.sendMail({
      from: `"ArtisanDispo Support" <${process.env.SMTP_USER}>`,
      to: adminEmail,
      subject: `[Support] Nouveau ticket ${numero} - ${categorie}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #2C3E50; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">🎫 Nouveau Ticket Support</h1>
          </div>
          
          <div style="padding: 20px; background-color: #f8f9fa;">
            <h2 style="color: #2C3E50;">Ticket ${numero}</h2>
            
            <table style="width: 100%; border-collapse: collapse; background: white; margin-top: 10px;">
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; width: 30%;">Catégorie</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${categorieLabels[categorie] || categorie}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Sujet</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${sujet}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">De</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${userNom} (${userEmail})</td>
              </tr>
            </table>
            
            <div style="margin-top: 20px; text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/support-tickets" 
                 style="display: inline-block; background-color: #FF6B00; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                📋 Voir le ticket
              </a>
            </div>
          </div>
          
          <div style="padding: 15px; background-color: #e9ecef; text-align: center; font-size: 12px; color: #6c757d;">
            <p>ArtisanDispo - Plateforme de mise en relation artisans/clients</p>
          </div>
        </div>
      `,
    });

    console.log('✅ Email admin envoyé pour ticket', numero);

    res.json({
      success: true,
      message: 'Notification envoyée',
    });
  } catch (error) {
    console.error('❌ Erreur envoi email admin:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur envoi notification',
    });
  }
});

/**
 * POST /api/v1/support/notify-user-response
 * Envoyer email à l'artisan quand admin répond
 */
router.post('/notify-user-response', async (req, res) => {
  try {
    const { ticketId, numero, userEmail, message } = req.body;

    if (!ticketId || !numero || !userEmail || !message) {
      return res.status(400).json({
        success: false,
        error: 'Paramètres manquants',
      });
    }

    // Email à l'artisan
    // Note: L'expéditeur utilise SMTP_USER (email configuré actuellement)
    // À modifier après achat du domaine artisandispo.fr
    await transporter.sendMail({
      from: `"ArtisanDispo Support" <${process.env.SMTP_USER}>`,
      to: userEmail,
      subject: `[ArtisanDispo] Réponse à votre ticket ${numero}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #2C3E50; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">📨 Réponse du Support</h1>
          </div>
          
          <div style="padding: 20px; background-color: #f8f9fa;">
            <p style="color: #2C3E50; font-size: 16px;">
              Bonjour,
            </p>
            
            <p style="color: #2C3E50;">
              Notre équipe a répondu à votre ticket <strong>${numero}</strong> :
            </p>
            
            <div style="background: white; border-left: 4px solid #FF6B00; padding: 15px; margin: 20px 0;">
              <p style="color: #2C3E50; margin: 0; white-space: pre-wrap;">${message}</p>
            </div>
            
            <div style="margin-top: 20px; text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/artisan/contact-support/${ticketId}" 
                 style="display: inline-block; background-color: #FF6B00; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                💬 Voir la conversation
              </a>
            </div>
            
            <p style="color: #6c757d; font-size: 14px; margin-top: 20px;">
              Vous pouvez répondre directement depuis votre espace artisan.
            </p>
          </div>
          
          <div style="padding: 15px; background-color: #e9ecef; text-align: center; font-size: 12px; color: #6c757d;">
            <p>ArtisanDispo - Support Technique</p>
            <p>Besoin d'aide ? Répondez directement à ce ticket ou contactez-nous à support@artisandispo.fr</p>
          </div>
        </div>
      `,
    });

    console.log('✅ Email artisan envoyé pour ticket', numero);

    res.json({
      success: true,
      message: 'Notification envoyée',
    });
  } catch (error) {
    console.error('❌ Erreur envoi email artisan:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur envoi notification',
    });
  }
});

export default router;
