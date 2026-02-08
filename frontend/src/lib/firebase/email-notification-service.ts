/**
 * Service de notification email
 * ArtisanDispo - Envoi d'emails pour événements importants
 */

import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from './config';

// ============================================
// TYPES
// ============================================

export interface EmailNotification {
  to: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  type: 'account_deletion' | 'account_suspension' | 'deletion_warning' | 'reactivation';
  metadata?: Record<string, any>;
  createdAt: Timestamp;
  status: 'pending' | 'sent' | 'failed';
}

// ============================================
// TEMPLATES EMAIL
// ============================================

/**
 * Template email : Avertissement suppression (15 jours avant)
 */
function getDeletionWarningTemplate(userName: string, reason: string, deletionDate: Date): { html: string; text: string } {
  const formattedDate = deletionDate.toLocaleDateString('fr-FR', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #FFC107; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; color: #2C3E50; font-size: 24px; }
        .content { background-color: #fff; padding: 30px; border: 1px solid #E9ECEF; }
        .warning-box { background-color: #FFF3CD; border-left: 4px solid #FFC107; padding: 15px; margin: 20px 0; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #6C757D; }
        .button { display: inline-block; padding: 12px 24px; background-color: #FF6B00; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⚠️ Avertissement de Suppression</h1>
        </div>
        <div class="content">
          <p>Bonjour ${userName},</p>
          
          <div class="warning-box">
            <strong>Votre compte ArtisanDispo sera supprimé définitivement le ${formattedDate}.</strong>
          </div>

          <p><strong>Raison de la suppression :</strong></p>
          <p>${reason}</p>

          <p><strong>Ce qui sera supprimé :</strong></p>
          <ul>
            <li>Votre profil complet (informations personnelles, photos)</li>
            <li>Vos documents vérifiés (KBIS, assurance, etc.)</li>
            <li>Votre agenda et disponibilités</li>
            <li>Vos messages et conversations</li>
          </ul>

          <p><strong>Ce qui sera conservé (obligations légales) :</strong></p>
          <ul>
            <li>Vos avis publiés (anonymisés)</li>
            <li>Vos contrats signés (archives comptables)</li>
            <li>Votre historique de transactions (10 ans)</li>
          </ul>

          <p><strong>Vous avez jusqu'au ${formattedDate} pour :</strong></p>
          <ul>
            <li>Contester cette décision en contactant notre support</li>
            <li>Télécharger vos données personnelles (RGPD)</li>
            <li>Récupérer vos documents importants</li>
          </ul>

          <p style="margin-top: 30px;">
            Si vous pensez qu'il s'agit d'une erreur ou souhaitez contester cette suppression, 
            veuillez nous contacter immédiatement à <strong>support@artisandispo.fr</strong>
          </p>

          <p style="margin-top: 20px; font-size: 12px; color: #6C757D;">
            Cette action fait suite à une décision administrative. Après la date indiquée, 
            la suppression sera définitive et irréversible.
          </p>
        </div>
        <div class="footer">
          <p>ArtisanDispo - Plateforme de mise en relation artisans-clients</p>
          <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
AVERTISSEMENT DE SUPPRESSION

Bonjour ${userName},

Votre compte ArtisanDispo sera supprimé définitivement le ${formattedDate}.

Raison : ${reason}

Données supprimées :
- Profil complet, documents, agenda, messages

Données conservées (loi) :
- Avis (anonymisés), contrats, transactions

Vous avez jusqu'au ${formattedDate} pour contester.
Contact : support@artisandispo.fr

ArtisanDispo
  `;

  return { html, text };
}

/**
 * Template email : Confirmation suppression définitive
 */
function getDeletionConfirmationTemplate(userName: string, reason: string): { html: string; text: string } {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #DC3545; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; color: white; font-size: 24px; }
        .content { background-color: #fff; padding: 30px; border: 1px solid #E9ECEF; }
        .info-box { background-color: #F8F9FA; border-left: 4px solid #2C3E50; padding: 15px; margin: 20px 0; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #6C757D; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🗑️ Compte Supprimé</h1>
        </div>
        <div class="content">
          <p>Bonjour ${userName},</p>
          
          <p><strong>Votre compte ArtisanDispo a été supprimé définitivement.</strong></p>

          <div class="info-box">
            <p><strong>Raison :</strong> ${reason}</p>
            <p><strong>Date :</strong> ${new Date().toLocaleDateString('fr-FR', { 
              day: 'numeric', 
              month: 'long', 
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
          </div>

          <p><strong>Données supprimées :</strong></p>
          <ul>
            <li>✓ Profil et informations personnelles</li>
            <li>✓ Documents vérifiés et photos</li>
            <li>✓ Agenda et disponibilités</li>
            <li>✓ Messages et conversations</li>
          </ul>

          <p><strong>Données conservées (RGPD - obligations légales) :</strong></p>
          <ul>
            <li>Avis publiés (anonymisés - "Compte supprimé")</li>
            <li>Contrats signés (archives - 10 ans)</li>
            <li>Historique transactions (comptabilité - 10 ans)</li>
          </ul>

          <p style="margin-top: 30px;">
            <strong>Conséquences :</strong>
          </p>
          <ul>
            <li>Vous ne pouvez plus vous connecter à ArtisanDispo</li>
            <li>Votre profil est invisible sur la plateforme</li>
            <li>Cette action est <strong>définitive et irréversible</strong></li>
          </ul>

          <p style="margin-top: 30px;">
            Vous pouvez créer un nouveau compte avec la même adresse email si vous le souhaitez.
          </p>

          <p style="margin-top: 20px;">
            Pour toute question concernant vos données personnelles : <strong>rgpd@artisandispo.fr</strong>
          </p>
        </div>
        <div class="footer">
          <p>ArtisanDispo - Plateforme de mise en relation artisans-clients</p>
          <p>Pour plus d'informations sur vos droits RGPD : www.cnil.fr</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
COMPTE SUPPRIMÉ

Bonjour ${userName},

Votre compte ArtisanDispo a été supprimé définitivement.

Raison : ${reason}
Date : ${new Date().toLocaleString('fr-FR')}

Données supprimées : Profil, documents, messages
Données conservées : Avis (anonymisés), contrats, transactions

Cette action est irréversible.

Contact RGPD : rgpd@artisandispo.fr

ArtisanDispo
  `;

  return { html, text };
}

/**
 * Template email : Notification suspension
 */
function getSuspensionTemplate(userName: string, reason: string): { html: string; text: string } {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #FF6B00; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; color: white; font-size: 24px; }
        .content { background-color: #fff; padding: 30px; border: 1px solid #E9ECEF; }
        .warning-box { background-color: #FFF3CD; border-left: 4px solid #FF6B00; padding: 15px; margin: 20px 0; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #6C757D; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔒 Compte Suspendu</h1>
        </div>
        <div class="content">
          <p>Bonjour ${userName},</p>
          
          <div class="warning-box">
            <strong>Votre compte ArtisanDispo a été temporairement suspendu.</strong>
          </div>

          <p><strong>Raison de la suspension :</strong></p>
          <p>${reason}</p>

          <p><strong>Conséquences :</strong></p>
          <ul>
            <li>Vous ne pouvez plus vous connecter</li>
            <li>Votre profil est invisible sur la plateforme</li>
            <li>Vos données sont conservées intactes</li>
          </ul>

          <p><strong>Cette suspension est temporaire et réversible.</strong></p>

          <p style="margin-top: 30px;">
            Pour contester cette décision ou obtenir plus d'informations, 
            contactez notre support : <strong>support@artisandispo.fr</strong>
          </p>
        </div>
        <div class="footer">
          <p>ArtisanDispo - Plateforme de mise en relation artisans-clients</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
COMPTE SUSPENDU

Bonjour ${userName},

Votre compte ArtisanDispo a été temporairement suspendu.

Raison : ${reason}

Vous ne pouvez plus vous connecter. Vos données sont conservées.
Cette suspension est temporaire et réversible.

Contact : support@artisandispo.fr

ArtisanDispo
  `;

  return { html, text };
}

/**
 * Template email : Réactivation du compte
 */
function getReactivationTemplate(userName: string): { html: string; text: string } {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #28A745; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; color: white; font-size: 24px; }
        .content { background-color: #fff; padding: 30px; border: 1px solid #E9ECEF; }
        .success-box { background-color: #D4EDDA; border-left: 4px solid #28A745; padding: 15px; margin: 20px 0; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #6C757D; }
        .button { display: inline-block; padding: 12px 24px; background-color: #FF6B00; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Compte Réactivé</h1>
        </div>
        <div class="content">
          <p>Bonjour ${userName},</p>
          
          <div class="success-box">
            <strong>Bonne nouvelle ! Votre compte ArtisanDispo a été réactivé.</strong>
          </div>

          <p>Vous pouvez à nouveau :</p>
          <ul>
            <li>✓ Vous connecter à votre compte</li>
            <li>✓ Accéder à votre profil et vos données</li>
            <li>✓ Recevoir des demandes de devis</li>
            <li>✓ Communiquer avec vos clients</li>
          </ul>

          <p style="margin-top: 30px;">
            <a href="http://localhost:3000/connexion" class="button">Se connecter à ArtisanDispo</a>
          </p>

          <p style="margin-top: 30px;">
            Nous vous rappelons l'importance de respecter nos conditions d'utilisation 
            pour maintenir votre compte actif.
          </p>
        </div>
        <div class="footer">
          <p>ArtisanDispo - Plateforme de mise en relation artisans-clients</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
COMPTE RÉACTIVÉ

Bonjour ${userName},

Bonne nouvelle ! Votre compte ArtisanDispo a été réactivé.

Vous pouvez à nouveau vous connecter et utiliser la plateforme.

Se connecter : http://localhost:3000/connexion

ArtisanDispo
  `;

  return { html, text };
}

// ============================================
// FONCTIONS D'ENVOI
// ============================================

/**
 * Envoyer une notification email (stockée dans Firestore pour Cloud Function)
 */
async function sendEmailNotification(
  email: string,
  subject: string,
  htmlContent: string,
  textContent: string,
  type: EmailNotification['type'],
  metadata?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  try {
    const emailData: EmailNotification = {
      to: email,
      subject,
      htmlContent,
      textContent,
      type,
      metadata: metadata || {},
      createdAt: Timestamp.now(),
      status: 'pending'
    };

    await addDoc(collection(db, 'email_notifications'), emailData);
    
    console.log(`✅ Email ${type} programmé pour ${email}`);
    return { success: true };
  } catch (error) {
    console.error('Erreur envoi email:', error);
    return { success: false, error: 'Erreur lors de la programmation de l\'email' };
  }
}

/**
 * Envoyer avertissement de suppression (15 jours avant)
 */
export async function sendDeletionWarningEmail(
  email: string,
  userName: string,
  reason: string,
  deletionDate: Date
): Promise<{ success: boolean; error?: string }> {
  const template = getDeletionWarningTemplate(userName, reason, deletionDate);
  
  return sendEmailNotification(
    email,
    '⚠️ Avertissement : Suppression de votre compte ArtisanDispo',
    template.html,
    template.text,
    'deletion_warning',
    { userName, reason, deletionDate: deletionDate.toISOString() }
  );
}

/**
 * Envoyer confirmation de suppression définitive
 */
export async function sendDeletionConfirmationEmail(
  email: string,
  userName: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const template = getDeletionConfirmationTemplate(userName, reason);
  
  return sendEmailNotification(
    email,
    '🗑️ Confirmation : Votre compte ArtisanDispo a été supprimé',
    template.html,
    template.text,
    'account_deletion',
    { userName, reason }
  );
}

/**
 * Envoyer notification de suspension
 */
export async function sendSuspensionEmail(
  email: string,
  userName: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const template = getSuspensionTemplate(userName, reason);
  
  return sendEmailNotification(
    email,
    '🔒 Suspension de votre compte ArtisanDispo',
    template.html,
    template.text,
    'account_suspension',
    { userName, reason }
  );
}

/**
 * Envoyer notification de réactivation
 */
export async function sendReactivationEmail(
  email: string,
  userName: string
): Promise<{ success: boolean; error?: string }> {
  const template = getReactivationTemplate(userName);
  
  return sendEmailNotification(
    email,
    '✅ Réactivation de votre compte ArtisanDispo',
    template.html,
    template.text,
    'reactivation',
    { userName }
  );
}
