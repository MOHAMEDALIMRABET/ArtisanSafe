/**
 * Service d'envoi d'emails via Nodemailer
 * Surveille la collection Firestore 'email_notifications' et envoie les emails en attente
 */

import nodemailer from 'nodemailer';
import { adminDb } from '../config/firebase-admin';

interface EmailNotification {
  to: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  type: string;
  status: 'pending' | 'sent' | 'failed';
  createdAt: any;
  sentAt?: any;
  error?: string;
}

/**
 * Configuration du transporteur email
 * Utilise les variables d'environnement
 */
const createTransporter = () => {
  const emailConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true pour 465, false pour 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  };

  return nodemailer.createTransport(emailConfig);
};

/**
 * Envoyer un email
 */
export async function sendEmail(emailData: EmailNotification): Promise<boolean> {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"ArtisanSafe" <${process.env.SMTP_USER}>`,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.htmlContent,
      text: emailData.textContent
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email envoyé à ${emailData.to} - ID: ${info.messageId}`);
    
    return true;
  } catch (error) {
    console.error('❌ Erreur envoi email:', error);
    throw error;
  }
}

/**
 * Traiter les emails en attente dans Firestore
 */
export async function processPendingEmails(): Promise<{
  success: number;
  failed: number;
  errors: string[];
}> {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[]
  };

  try {
    // Récupérer les emails en attente
    const emailsRef = adminDb.collection('email_notifications');
    const pendingEmailsSnapshot = await emailsRef
      .where('status', '==', 'pending')
      .limit(50) // Limiter à 50 emails par batch
      .get();

    if (pendingEmailsSnapshot.empty) {
      console.log('✅ Aucun email en attente');
      return results;
    }

    console.log(`📧 ${pendingEmailsSnapshot.size} emails à envoyer`);

    // Envoyer chaque email
    for (const doc of pendingEmailsSnapshot.docs) {
      const emailData = doc.data() as EmailNotification;

      try {
        await sendEmail(emailData);

        // Marquer comme envoyé
        await doc.ref.update({
          status: 'sent',
          sentAt: new Date()
        });

        results.success++;
      } catch (error: any) {
        console.error(`❌ Erreur email ${doc.id}:`, error.message);

        // Marquer comme échoué
        await doc.ref.update({
          status: 'failed',
          error: error.message,
          failedAt: new Date()
        });

        results.failed++;
        results.errors.push(`${emailData.to}: ${error.message}`);
      }
    }

    console.log(`✅ Emails envoyés: ${results.success}, Échecs: ${results.failed}`);
    return results;
  } catch (error: any) {
    console.error('❌ Erreur traitement emails:', error);
    results.errors.push(error.message);
    return results;
  }
}

/**
 * Surveiller et traiter les emails automatiquement
 * Exécuté via cron job (une fois par jour à 2h du matin)
 */
export async function startEmailWatcher(): Promise<void> {
  const cron = require('node-cron');
  
  console.log('📧 Surveillance des emails configurée (quotidienne à 2h00 du matin, timezone Europe/Paris)');

  // Traiter immédiatement au démarrage
  await processPendingEmails();

  // Planifier exécution quotidienne à 2h00 du matin (Europe/Paris)
  cron.schedule('0 2 * * *', async () => {
    console.log('⏰ Exécution planifiée - Traitement des emails en attente...');
    await processPendingEmails();
  }, {
    scheduled: true,
    timezone: 'Europe/Paris'
  });
}
