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
  type: 
    | 'account_deletion' 
    | 'account_suspension' 
    | 'deletion_warning' 
    | 'reactivation'
    | 'artisan_approved'
    | 'artisan_rejected'
    | 'devis_received'
    | 'devis_accepted'
    | 'payment_confirmed'
    | 'payment_received_artisan'
    | 'travaux_termines'
    | 'paiement_transfere'
    | 'litige_enregistre_client'
    | 'litige_signale_artisan'
    | 'validation_automatique_client'
    | 'validation_automatique_artisan'
    | 'nouvelle_demande_publique';
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

/**
 * Template email : Profil Artisan Approuvé
 */
function getArtisanApprovedTemplate(artisanName: string, businessName: string): { html: string; text: string } {
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
          <h1>🎉 Profil Approuvé !</h1>
        </div>
        <div class="content">
          <p>Bonjour ${artisanName},</p>
          
          <div class="success-box">
            <strong>Excellente nouvelle ! Votre profil ArtisanDispo vient d'être approuvé par notre équipe.</strong>
          </div>

          <p><strong>✅ Profil vérifié :</strong> ${businessName}</p>
          <p><strong>✅ Documents validés :</strong> KBIS, RC Pro, Garantie décennale</p>
          <p><strong>✅ Statut :</strong> Visible par les clients</p>

          <p><strong>Vous pouvez maintenant :</strong></p>
          <ul>
            <li>Recevoir des demandes de devis clients</li>
            <li>Consulter les demandes publiques dans votre zone</li>
            <li>Créer et envoyer des devis</li>
          </ul>

          <p style="margin-top: 30px;">
            <a href="http://localhost:3000/artisan/dashboard" class="button">Accéder à mon tableau de bord</a>
          </p>

          <p><strong>Prochaines étapes :</strong></p>
          <ol>
            <li>Complétez votre profil (photos, description)</li>
            <li>Définissez vos zones d'intervention</li>
            <li>Commencez à recevoir des demandes !</li>
          </ol>
        </div>
        <div class="footer">
          <p>ArtisanDispo - Plateforme de mise en relation artisans-clients</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
PROFIL APPROUVÉ !

Bonjour ${artisanName},

Excellente nouvelle ! Votre profil ArtisanDispo a été approuvé.

Profil : ${businessName}
Statut : Visible par les clients

Accédez à votre tableau de bord : http://localhost:3000/artisan/dashboard

ArtisanDispo
  `;

  return { html, text };
}

/**
 * Template email : Profil Artisan Rejeté
 */
function getArtisanRejectedTemplate(artisanName: string, rejectionReason: string): { html: string; text: string } {
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
        .warning-box { background-color: #F8D7DA; border-left: 4px solid #DC3545; padding: 15px; margin: 20px 0; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #6C757D; }
        .button { display: inline-block; padding: 12px 24px; background-color: #FF6B00; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⚠️ Documents Non Conformes</h1>
        </div>
        <div class="content">
          <p>Bonjour ${artisanName},</p>
          
          <p>Nous avons examiné votre demande d'inscription sur ArtisanDispo.</p>

          <div class="warning-box">
            <strong>Malheureusement, nous ne pouvons pas approuver votre profil pour la raison suivante :</strong>
            <p style="margin-top: 10px;">❌ ${rejectionReason}</p>
          </div>

          <p><strong>Pour que votre profil soit approuvé, veuillez :</strong></p>
          <ol>
            <li>Vérifier les documents requis</li>
            <li>Corriger les informations signalées</li>
            <li>Soumettre à nouveau vos documents</li>
          </ol>

          <p style="margin-top: 30px;">
            <a href="http://localhost:3000/artisan/documents" class="button">Modifier mes documents</a>
          </p>

          <p><strong>Besoin d'aide ?</strong></p>
          <p>Contactez-nous : support@artisandispo.fr</p>
        </div>
        <div class="footer">
          <p>ArtisanDispo - Plateforme de mise en relation artisans-clients</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
DOCUMENTS NON CONFORMES

Bonjour ${artisanName},

Nous ne pouvons pas approuver votre profil.

Raison : ${rejectionReason}

Modifier mes documents : http://localhost:3000/artisan/documents

Contact : support@artisandispo.fr

ArtisanDispo
  `;

  return { html, text };
}

/**
 * Template email : Nouveau Devis Reçu (Client)
 */
function getDevisReceivedTemplate(clientName: string, artisanName: string, montantTTC: number, expirationDate: string): { html: string; text: string } {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2C3E50; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; color: white; font-size: 24px; }
        .content { background-color: #fff; padding: 30px; border: 1px solid #E9ECEF; }
        .info-box { background-color: #E7F3FF; border-left: 4px solid #2C3E50; padding: 15px; margin: 20px 0; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #6C757D; }
        .button { display: inline-block; padding: 12px 24px; background-color: #FF6B00; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .price { font-size: 32px; color: #FF6B00; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📄 Nouveau Devis Reçu</h1>
        </div>
        <div class="content">
          <p>Bonjour ${clientName},</p>
          
          <p>Vous avez reçu un nouveau devis sur ArtisanDispo !</p>

          <div class="info-box">
            <p><strong>🏢 Artisan :</strong> ${artisanName}</p>
            <p><strong>💰 Montant :</strong> <span class="price">${montantTTC}€ TTC</span></p>
            <p><strong>📅 Validité :</strong> Jusqu'au ${expirationDate}</p>
          </div>

          <p><strong>Actions disponibles :</strong></p>
          <ul>
            <li>✅ Accepter le devis (signature + paiement)</li>
            <li>❌ Refuser le devis</li>
            <li>💬 Poser des questions à l'artisan</li>
          </ul>

          <p style="margin-top: 30px; text-align: center;">
            <a href="http://localhost:3000/client/devis" class="button">Consulter le devis</a>
          </p>

          <p style="margin-top: 20px;">⚠️ <strong>Ce devis expire le ${expirationDate}</strong></p>
        </div>
        <div class="footer">
          <p>ArtisanDispo - Plateforme de mise en relation artisans-clients</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
NOUVEAU DEVIS REÇU

Bonjour ${clientName},

Artisan : ${artisanName}
Montant : ${montantTTC}€ TTC
Validité : ${expirationDate}

Consulter : http://localhost:3000/client/devis

ArtisanDispo
  `;

  return { html, text };
}

/**
 * Template email : Devis Accepté (Artisan)
 */
function getDevisAcceptedTemplate(artisanName: string, clientName: string, montantTTC: number): { html: string; text: string } {
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
          <h1>🎉 Devis Accepté !</h1>
        </div>
        <div class="content">
          <p>Bonjour ${artisanName},</p>
          
          <div class="success-box">
            <strong>Excellente nouvelle ! Votre devis vient d'être accepté.</strong>
          </div>

          <p><strong>👤 Client :</strong> ${clientName}</p>
          <p><strong>💰 Montant :</strong> ${montantTTC}€ TTC</p>

          <p><strong>Prochaines étapes :</strong></p>
          <ol>
            <li>✅ Client signe électroniquement</li>
            <li>✅ Client paie (${montantTTC}€ en séquestre)</li>
            <li>🚀 Vous pouvez démarrer les travaux</li>
          </ol>

          <p style="margin-top: 30px; text-align: center;">
            <a href="http://localhost:3000/artisan/devis" class="button">Voir détails du devis</a>
          </p>

          <p style="margin-top: 20px;">💡 Le paiement sera retenu en sécurité jusqu'à validation des travaux par le client.</p>
        </div>
        <div class="footer">
          <p>ArtisanDispo - Plateforme de mise en relation artisans-clients</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
DEVIS ACCEPTÉ !

Bonjour ${artisanName},

Votre devis a été accepté !

Client : ${clientName}
Montant : ${montantTTC}€ TTC

Voir détails : http://localhost:3000/artisan/devis

ArtisanDispo
  `;

  return { html, text };
}

/**
 * Template email : Paiement Confirmé (Client)
 */
function getPaymentConfirmedTemplate(clientName: string, artisanName: string, montantTTC: number): { html: string; text: string } {
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
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Paiement Confirmé</h1>
        </div>
        <div class="content">
          <p>Bonjour ${clientName},</p>
          
          <div class="success-box">
            <strong>Votre paiement a été confirmé avec succès.</strong>
          </div>

          <p><strong>💳 Montant payé :</strong> ${montantTTC}€ TTC</p>
          <p><strong>🏢 Artisan :</strong> ${artisanName}</p>
          <p><strong>🔒 Statut :</strong> En séquestre (sécurisé)</p>

          <p style="margin-top: 20px;"><strong>⚠️ IMPORTANT :</strong></p>
          <p>Votre paiement est retenu en SÉCURITÉ sur notre plateforme. L'artisan recevra le montant UNIQUEMENT après que vous ayez validé les travaux.</p>

          <p><strong>Protection ArtisanDispo :</strong></p>
          <ul>
            <li>✅ Paiement sécurisé Stripe</li>
            <li>✅ Séquestre jusqu'à validation travaux</li>
            <li>✅ Médiation en cas de litige</li>
            <li>✅ Garantie remboursement si non conforme</li>
          </ul>
        </div>
        <div class="footer">
          <p>ArtisanDispo - Plateforme de mise en relation artisans-clients</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
PAIEMENT CONFIRMÉ

Bonjour ${clientName},

Montant : ${montantTTC}€ TTC
Artisan : ${artisanName}
Statut : En séquestre (sécurisé)

ArtisanDispo
  `;

  return { html, text };
}

/**
 * Template email : Paiement Reçu (Artisan)
 */
function getPaymentReceivedArtisanTemplate(artisanName: string, clientName: string, montantTTC: number): { html: string; text: string } {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2C3E50; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; color: white; font-size: 24px; }
        .content { background-color: #fff; padding: 30px; border: 1px solid #E9ECEF; }
        .info-box { background-color: #E7F3FF; border-left: 4px solid #2C3E50; padding: 15px; margin: 20px 0; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #6C757D; }
        .button { display: inline-block; padding: 12px 24px; background-color: #FF6B00; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>💰 Paiement Reçu (En Séquestre)</h1>
        </div>
        <div class="content">
          <p>Bonjour ${artisanName},</p>
          
          <p>Le client a effectué le paiement pour votre devis.</p>

          <div class="info-box">
            <p><strong>💰 Montant :</strong> ${montantTTC}€ TTC</p>
            <p><strong>👤 Client :</strong> ${clientName}</p>
            <p><strong>⚠️ Statut :</strong> En séquestre</p>
          </div>

          <p><strong>⚠️ PAIEMENT EN SÉQUESTRE :</strong></p>
          <p>Le montant est actuellement retenu en sécurité sur notre plateforme. Vous le recevrez APRÈS validation des travaux par le client.</p>

          <p><strong>🚀 Vous pouvez maintenant DÉMARRER LES TRAVAUX</strong></p>

          <p style="margin-top: 30px; text-align: center;">
            <a href="http://localhost:3000/artisan/devis" class="button">Démarrer les travaux</a>
          </p>

          <p><strong>Chronologie paiement :</strong></p>
          <ol>
            <li>✅ Client a payé → En séquestre</li>
            <li>🚀 Vous réalisez les travaux</li>
            <li>✅ Client valide (ou validation auto 7j)</li>
            <li>💰 Transfert sur votre compte (2-5 jours)</li>
          </ol>
        </div>
        <div class="footer">
          <p>ArtisanDispo - Plateforme de mise en relation artisans-clients</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
PAIEMENT REÇU (EN SÉQUESTRE)

Bonjour ${artisanName},

Montant : ${montantTTC}€ TTC
Client : ${clientName}

Vous pouvez démarrer les travaux.

ArtisanDispo
  `;

  return { html, text };
}

/**
 * Template email : Travaux Terminés - Validation Requise (Client)
 */
function getTravauxTerminesTemplate(clientName: string, artisanName: string, dateValidationAuto: string): { html: string; text: string } {
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
        .warning-box { background-color: #FFF3CD; border-left: 4px solid #FFC107; padding: 15px; margin: 20px 0; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #6C757D; }
        .button { display: inline-block; padding: 12px 24px; background-color: #FF6B00; color: white; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
        .button-secondary { background-color: #6C757D; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Travaux Terminés</h1>
        </div>
        <div class="content">
          <p>Bonjour ${clientName},</p>
          
          <p>L'artisan <strong>${artisanName}</strong> vient de déclarer avoir terminé les travaux.</p>

          <div class="warning-box">
            <strong>⚠️ ACTION REQUISE DANS LES 7 JOURS</strong>
            <p style="margin-top: 10px;">Vous avez jusqu'au <strong>${dateValidationAuto}</strong> pour valider ou signaler un problème.</p>
          </div>

          <p><strong>Vos options :</strong></p>
          <ul>
            <li>✅ <strong>VALIDER</strong> les travaux → Le paiement sera transféré à l'artisan sous 48h</li>
            <li>⚠️ <strong>SIGNALER un problème</strong> → Le paiement reste bloqué, notre équipe intervient</li>
          </ul>

          <p style="margin-top: 30px; text-align: center;">
            <a href="http://localhost:3000/client/devis" class="button">Valider les travaux</a>
            <a href="http://localhost:3000/client/devis" class="button button-secondary">Signaler un problème</a>
          </p>

          <p style="margin-top: 20px;">🕒 <strong>Si aucune action :</strong> Validation AUTOMATIQUE le ${dateValidationAuto}</p>
        </div>
        <div class="footer">
          <p>ArtisanDispo - Plateforme de mise en relation artisans-clients</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
TRAVAUX TERMINÉS

Bonjour ${clientName},

L'artisan ${artisanName} a terminé les travaux.

ACTION REQUISE : Validez ou signalez un problème avant le ${dateValidationAuto}

Consulter : http://localhost:3000/client/devis

ArtisanDispo
  `;

  return { html, text };
}

/**
 * Template email : Paiement Transféré (Artisan)
 */
function getPaiementTransfereTemplate(artisanName: string, montantTTC: number): { html: string; text: string } {
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
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>💰 Paiement Transféré</h1>
        </div>
        <div class="content">
          <p>Bonjour ${artisanName},</p>
          
          <div class="success-box">
            <strong>Bonne nouvelle ! Le paiement vient d'être transféré sur votre compte.</strong>
          </div>

          <p><strong>💰 Montant :</strong> ${montantTTC}€</p>
          <p><strong>📅 Disponibilité :</strong> 2-5 jours ouvrés</p>

          <p>Le client a validé les travaux, le paiement est en cours de transfert vers votre compte bancaire.</p>

          <p style="margin-top: 20px;">⭐ Le client peut maintenant vous laisser un avis !</p>
        </div>
        <div class="footer">
          <p>ArtisanDispo - Plateforme de mise en relation artisans-clients</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
PAIEMENT TRANSFÉRÉ

Bonjour ${artisanName},

Montant : ${montantTTC}€
Disponibilité : 2-5 jours ouvrés

ArtisanDispo
  `;

  return { html, text };
}

/**
 * Template email : Litige Enregistré (Client)
 */
function getLitigeEnregistreClientTemplate(clientName: string, artisanName: string): { html: string; text: string } {
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
        .warning-box { background-color: #F8D7DA; border-left: 4px solid #DC3545; padding: 15px; margin: 20px 0; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #6C757D; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⚠️ Litige Enregistré</h1>
        </div>
        <div class="content">
          <p>Bonjour ${clientName},</p>
          
          <div class="warning-box">
            <strong>Votre signalement de problème a bien été enregistré.</strong>
          </div>

          <p><strong>🏢 Artisan :</strong> ${artisanName}</p>

          <p><strong>🛡️ PROTECTION ARTISANDISPO ACTIVÉE :</strong></p>
          <ul>
            <li>✅ Paiement BLOQUÉ (reste en séquestre)</li>
            <li>✅ Équipe médiation contactée</li>
            <li>✅ Résolution garantie</li>
          </ul>

          <p>Notre équipe examine votre signalement sous 24-48h maximum.</p>

          <p><strong>📞 Besoin urgent ?</strong></p>
          <p>Contactez notre support : support@artisandispo.fr</p>
        </div>
        <div class="footer">
          <p>ArtisanDispo - Plateforme de mise en relation artisans-clients</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
LITIGE ENREGISTRÉ

Bonjour ${clientName},

Votre signalement a été enregistré.
Paiement bloqué en sécurité.

Notre équipe vous contactera sous 24-48h.

ArtisanDispo
  `;

  return { html, text };
}

/**
 * Template email : Litige Signalé (Artisan)
 */
function getLitigeSignaleArtisanTemplate(artisanName: string, clientName: string): { html: string; text: string } {
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
        .warning-box { background-color: #FFF3CD; border-left: 4px solid #FFC107; padding: 15px; margin: 20px 0; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #6C757D; }
        .button { display: inline-block; padding: 12px 24px; background-color: #FF6B00; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⚠️ Problème Signalé</h1>
        </div>
        <div class="content">
          <p>Bonjour ${artisanName},</p>
          
          <div class="warning-box">
            <strong>Le client ${clientName} a signalé un problème concernant vos travaux.</strong>
          </div>

          <p><strong>⚠️ Le paiement reste BLOQUÉ jusqu'à résolution.</strong></p>

          <p><strong>Vos options :</strong></p>
          <ol>
            <li>Proposer une nouvelle intervention GRATUITE</li>
            <li>Contester le signalement avec preuves</li>
            <li>Proposition arrangement amiable</li>
          </ol>

          <p style="margin-top: 30px; text-align: center;">
            <a href="http://localhost:3000/artisan/litiges" class="button">Répondre au litige</a>
          </p>

          <p><strong>⏰ ACTION REQUISE SOUS 48H</strong></p>

          <p>Notre équipe médiation vous contactera pour faciliter la résolution.</p>
        </div>
        <div class="footer">
          <p>ArtisanDispo - Plateforme de mise en relation artisans-clients</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
PROBLÈME SIGNALÉ

Bonjour ${artisanName},

Le client ${clientName} a signalé un problème.
Paiement bloqué.

ACTION REQUISE SOUS 48H

Répondre : http://localhost:3000/artisan/litiges

ArtisanDispo
  `;

  return { html, text };
}

/**
 * Template email : Validation Automatique (Client)
 */
function getValidationAutomatiqueClientTemplate(clientName: string, artisanName: string): { html: string; text: string } {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2C3E50; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; color: white; font-size: 24px; }
        .content { background-color: #fff; padding: 30px; border: 1px solid #E9ECEF; }
        .info-box { background-color: #E7F3FF; border-left: 4px solid #2C3E50; padding: 15px; margin: 20px 0; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #6C757D; }
        .button { display: inline-block; padding: 12px 24px; background-color: #FF6B00; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Travaux Validés Automatiquement</h1>
        </div>
        <div class="content">
          <p>Bonjour ${clientName},</p>
          
          <div class="info-box">
            <strong>Les travaux de ${artisanName} ont été VALIDÉS AUTOMATIQUEMENT après 7 jours sans réponse de votre part.</strong>
          </div>

          <p>Le paiement a été transféré à l'artisan.</p>

          <p><strong>⭐ DONNEZ VOTRE AVIS !</strong></p>
          <p>Votre avis aide d'autres clients à choisir le bon artisan. Vous avez 30 jours pour partager votre expérience.</p>

          <p style="margin-top: 30px; text-align: center;">
            <a href="http://localhost:3000/client/avis/nouveau" class="button">Donner mon avis</a>
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
TRAVAUX VALIDÉS AUTOMATIQUEMENT

Bonjour ${clientName},

Les travaux de ${artisanName} ont été validés automatiquement.
Paiement transféré.

Donnez votre avis : http://localhost:3000/client/avis/nouveau

ArtisanDispo
  `;

  return { html, text };
}

/**
 * Template email : Validation Automatique (Artisan)
 */
function getValidationAutomatiqueArtisanTemplate(artisanName: string, montantTTC: number): { html: string; text: string } {
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
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>💰 Validation Automatique - Paiement Transféré</h1>
        </div>
        <div class="content">
          <p>Bonjour ${artisanName},</p>
          
          <div class="success-box">
            <strong>Les travaux ont été validés automatiquement. Le paiement (${montantTTC}€) a été transféré.</strong>
          </div>

          <p><strong>💰 Montant :</strong> ${montantTTC}€</p>
          <p><strong>📅 Disponibilité :</strong> 2-5 jours ouvrés</p>

          <p>Le délai de 7 jours est écoulé sans action du client, la validation automatique s'est déclenchée.</p>
        </div>
        <div class="footer">
          <p>ArtisanDispo - Plateforme de mise en relation artisans-clients</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
VALIDATION AUTOMATIQUE

Bonjour ${artisanName},

Paiement transféré : ${montantTTC}€
Disponibilité : 2-5 jours

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

/**
 * Envoyer notification profil artisan approuvé
 */
export async function sendArtisanApprovedEmail(
  email: string,
  artisanName: string,
  businessName: string
): Promise<{ success: boolean; error?: string }> {
  const template = getArtisanApprovedTemplate(artisanName, businessName);
  
  return sendEmailNotification(
    email,
    '🎉 Votre profil artisan est approuvé !',
    template.html,
    template.text,
    'artisan_approved',
    { artisanName, businessName }
  );
}

/**
 * Envoyer notification profil artisan rejeté
 */
export async function sendArtisanRejectedEmail(
  email: string,
  artisanName: string,
  rejectionReason: string
): Promise<{ success: boolean; error?: string }> {
  const template = getArtisanRejectedTemplate(artisanName, rejectionReason);
  
  return sendEmailNotification(
    email,
    '⚠️ Documents non conformes - Action requise',
    template.html,
    template.text,
    'artisan_rejected',
    { artisanName, rejectionReason }
  );
}

/**
 * Envoyer notification nouveau devis reçu (client)
 */
export async function sendDevisReceivedEmail(
  email: string,
  clientName: string,
  artisanName: string,
  montantTTC: number,
  expirationDate: string
): Promise<{ success: boolean; error?: string }> {
  const template = getDevisReceivedTemplate(clientName, artisanName, montantTTC, expirationDate);
  
  return sendEmailNotification(
    email,
    `📄 Nouveau devis reçu - ${artisanName}`,
    template.html,
    template.text,
    'devis_received',
    { clientName, artisanName, montantTTC, expirationDate }
  );
}

/**
 * Envoyer notification devis accepté (artisan)
 */
export async function sendDevisAcceptedEmail(
  email: string,
  artisanName: string,
  clientName: string,
  montantTTC: number
): Promise<{ success: boolean; error?: string }> {
  const template = getDevisAcceptedTemplate(artisanName, clientName, montantTTC);
  
  return sendEmailNotification(
    email,
    `🎉 Devis accepté - ${clientName}`,
    template.html,
    template.text,
    'devis_accepted',
    { artisanName, clientName, montantTTC }
  );
}

/**
 * Envoyer notification paiement confirmé (client)
 */
export async function sendPaymentConfirmedEmail(
  email: string,
  clientName: string,
  artisanName: string,
  montantTTC: number
): Promise<{ success: boolean; error?: string }> {
  const template = getPaymentConfirmedTemplate(clientName, artisanName, montantTTC);
  
  return sendEmailNotification(
    email,
    `✅ Paiement confirmé - Devis ${artisanName}`,
    template.html,
    template.text,
    'payment_confirmed',
    { clientName, artisanName, montantTTC }
  );
}

/**
 * Envoyer notification paiement reçu (artisan)
 */
export async function sendPaymentReceivedArtisanEmail(
  email: string,
  artisanName: string,
  clientName: string,
  montantTTC: number
): Promise<{ success: boolean; error?: string }> {
  const template = getPaymentReceivedArtisanTemplate(artisanName, clientName, montantTTC);
  
  return sendEmailNotification(
    email,
    `💰 Paiement reçu (en séquestre) - ${clientName}`,
    template.html,
    template.text,
    'payment_received_artisan',
    { artisanName, clientName, montantTTC }
  );
}

/**
 * Envoyer notification travaux terminés (client)
 */
export async function sendTravauxTerminesEmail(
  email: string,
  clientName: string,
  artisanName: string,
  dateValidationAuto: string
): Promise<{ success: boolean; error?: string }> {
  const template = getTravauxTerminesTemplate(clientName, artisanName, dateValidationAuto);
  
  return sendEmailNotification(
    email,
    `✅ Travaux terminés - Validez sous 7 jours`,
    template.html,
    template.text,
    'travaux_termines',
    { clientName, artisanName, dateValidationAuto }
  );
}

/**
 * Envoyer notification paiement transféré (artisan)
 */
export async function sendPaiementTransfereEmail(
  email: string,
  artisanName: string,
  montantTTC: number
): Promise<{ success: boolean; error?: string }> {
  const template = getPaiementTransfereTemplate(artisanName, montantTTC);
  
  return sendEmailNotification(
    email,
    `💰 Paiement transféré - ${montantTTC}€ disponible sous 2-5 jours`,
    template.html,
    template.text,
    'paiement_transfere',
    { artisanName, montantTTC }
  );
}

/**
 * Envoyer notification litige enregistré (client)
 */
export async function sendLitigeEnregistreClientEmail(
  email: string,
  clientName: string,
  artisanName: string
): Promise<{ success: boolean; error?: string }> {
  const template = getLitigeEnregistreClientTemplate(clientName, artisanName);
  
  return sendEmailNotification(
    email,
    '⚠️ Litige enregistré - Nous intervenons',
    template.html,
    template.text,
    'litige_enregistre_client',
    { clientName, artisanName }
  );
}

/**
 * Envoyer notification litige signalé (artisan)
 */
export async function sendLitigeSignaleArtisanEmail(
  email: string,
  artisanName: string,
  clientName: string
): Promise<{ success: boolean; error?: string }> {
  const template = getLitigeSignaleArtisanTemplate(artisanName, clientName);
  
  return sendEmailNotification(
    email,
    `⚠️ Problème signalé par ${clientName} - Action requise`,
    template.html,
    template.text,
    'litige_signale_artisan',
    { artisanName, clientName }
  );
}

/**
 * Envoyer notification validation automatique (client)
 */
export async function sendValidationAutomatiqueClientEmail(
  email: string,
  clientName: string,
  artisanName: string
): Promise<{ success: boolean; error?: string }> {
  const template = getValidationAutomatiqueClientTemplate(clientName, artisanName);
  
  return sendEmailNotification(
    email,
    `✅ Travaux validés automatiquement - Paiement transféré`,
    template.html,
    template.text,
    'validation_automatique_client',
    { clientName, artisanName }
  );
}

/**
 * Envoyer notification validation automatique (artisan)
 */
export async function sendValidationAutomatiqueArtisanEmail(
  email: string,
  artisanName: string,
  montantTTC: number
): Promise<{ success: boolean; error?: string }> {
  const template = getValidationAutomatiqueArtisanTemplate(artisanName, montantTTC);
  
  return sendEmailNotification(
    email,
    `💰 Validation automatique - Paiement transféré (${montantTTC}€)`,
    template.html,
    template.text,
    'validation_automatique_artisan',
    { artisanName, montantTTC }
  );
}

// ============================================
// TEMPLATE : Nouvelle demande publique
// ============================================

function getNouvelleDemandePubliqueTemplate(
  artisanPrenom: string,
  metier: string,
  ville: string,
  description: string,
  demandeId: string
): { html: string; text: string } {
  const metierFormate = metier.charAt(0).toUpperCase() + metier.slice(1);
  const lien = `${process.env.NEXT_PUBLIC_APP_URL || 'https://artisandispo.fr'}/artisan/demandes`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #FF6B00; padding: 24px 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; color: white; font-size: 22px; }
        .header p { margin: 6px 0 0; color: rgba(255,255,255,0.9); font-size: 14px; }
        .content { background-color: #fff; padding: 30px; border: 1px solid #E9ECEF; }
        .demand-box { background-color: #FFF8F0; border-left: 4px solid #FF6B00; padding: 18px; margin: 20px 0; border-radius: 0 8px 8px 0; }
        .demand-box p { margin: 6px 0; }
        .demand-box strong { color: #2C3E50; }
        .cta-btn { display: block; width: fit-content; margin: 24px auto; background-color: #FF6B00; color: white !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 16px; text-align: center; }
        .footer { background-color: #F8F9FA; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #6C757D; }
        .badge { display: inline-block; background: #FF6B00; color: white; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: bold; margin-left: 6px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔔 Nouvelle demande dans votre zone</h1>
          <p>Un client recherche un professionnel en <strong>${metierFormate}</strong></p>
        </div>
        <div class="content">
          <p>Bonjour ${artisanPrenom},</p>
          <p>Une nouvelle demande correspond à votre profil et à votre zone d'intervention !</p>

          <div class="demand-box">
            <p><strong>🔧 Métier :</strong> ${metierFormate}</p>
            <p><strong>📍 Ville :</strong> ${ville}</p>
            <p><strong>📝 Description :</strong> ${description || 'Aucune description fournie'}</p>
          </div>

          <p>Soyez le premier à répondre pour maximiser vos chances d'obtenir ce chantier.</p>

          <a href="${lien}" class="cta-btn">👀 Voir la demande</a>

          <p style="color: #6C757D; font-size: 13px; margin-top: 20px;">
            Cette demande est visible par d'autres artisans de votre secteur. Répondez rapidement !
          </p>
        </div>
        <div class="footer">
          <p>© ArtisanDispo — Vous recevez cet email car votre profil correspond à cette demande.</p>
          <p>Pour gérer vos notifications, rendez-vous dans vos paramètres de compte.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `Bonjour ${artisanPrenom},\n\nUne nouvelle demande correspond à votre profil !\n\nMétier : ${metierFormate}\nVille : ${ville}\nDescription : ${description || 'Aucune description'}\n\nVoir la demande : ${lien}\n\n— ArtisanDispo`;

  return { html, text };
}

/**
 * Envoyer notification nouvelle demande publique à un artisan
 */
export async function sendNouvelleDemandePubliqueEmail(
  email: string,
  artisanPrenom: string,
  metier: string,
  ville: string,
  description: string,
  demandeId: string
): Promise<{ success: boolean; error?: string }> {
  const template = getNouvelleDemandePubliqueTemplate(artisanPrenom, metier, ville, description, demandeId);

  return sendEmailNotification(
    email,
    `🔔 Nouvelle demande ${metier} à ${ville} — ArtisanDispo`,
    template.html,
    template.text,
    'nouvelle_demande_publique',
    { artisanPrenom, metier, ville, demandeId }
  );
}
