/**
 * Service d'envoi de SMS via Twilio
 * Documentation: https://www.twilio.com/docs/sms/quickstart/node
 * 
 * Prérequis:
 * 1. Créer un compte sur https://www.twilio.com/try-twilio
 * 2. Récupérer Account SID et Auth Token depuis le dashboard
 * 3. Acheter un numéro Twilio (ou utiliser le numéro de test)
 * 4. Ajouter les credentials dans .env
 * 
 * Essai gratuit: $15 de crédit offert (environ 100-150 SMS)
 */

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string; // Numéro Twilio émetteur (format: +15551234567)
}

interface SendSMSParams {
  phoneNumber: string;
  message: string;
}

interface TwilioResponse {
  success: boolean;
  messageSid?: string;
  status?: string;
  error?: string;
}

class TwilioSMSService {
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly phoneNumber: string;
  private readonly baseURL = 'https://api.twilio.com/2010-04-01';

  constructor(config: TwilioConfig) {
    this.accountSid = config.accountSid;
    this.authToken = config.authToken;
    this.phoneNumber = config.phoneNumber;

    if (!this.accountSid || !this.authToken || !this.phoneNumber) {
      console.warn('⚠️ Twilio credentials non configurées');
    }
  }

  /**
   * Envoie un SMS via l'API Twilio
   */
  async sendSMS(params: SendSMSParams): Promise<TwilioResponse> {
    try {
      // Vérification des credentials
      if (!this.accountSid || !this.authToken || !this.phoneNumber) {
        console.error('❌ Twilio non configuré');
        return { 
          success: false, 
          error: 'Credentials Twilio manquants. Vérifiez votre fichier .env' 
        };
      }

      console.log(`📤 Envoi SMS Twilio vers ${params.phoneNumber}...`);

      // Préparer les données du formulaire pour Twilio
      const formData = new URLSearchParams();
      formData.append('To', this.formatPhoneNumber(params.phoneNumber));
      formData.append('From', this.phoneNumber);
      formData.append('Body', params.message);

      // Authentification Basic Auth (AccountSID:AuthToken en base64)
      const authString = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

      // Appel API Twilio
      const response = await fetch(
        `${this.baseURL}/Accounts/${this.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${authString}`
          },
          body: formData.toString()
        }
      );

      const data = await response.json();

      // Vérifier la réponse
      if (response.ok && data.sid) {
        console.log(`✅ SMS Twilio envoyé: ${data.sid} (statut: ${data.status})`);
        return { 
          success: true, 
          messageSid: data.sid,
          status: data.status
        };
      } else {
        console.error('❌ Erreur Twilio:', data);
        return { 
          success: false, 
          error: data.message || 'Erreur lors de l\'envoi du SMS' 
        };
      }

    } catch (error) {
      console.error('❌ Erreur réseau Twilio:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erreur réseau' 
      };
    }
  }

  /**
   * Envoie un code de vérification à 6 chiffres
   */
  async sendVerificationCode(phoneNumber: string, code: string): Promise<TwilioResponse> {
    const message = `ArtisanDispo - Votre code de vérification: ${code}\n\nCe code expire dans 10 minutes.`;
    
    return this.sendSMS({
      phoneNumber,
      message
    });
  }

  /**
   * Formate le numéro de téléphone au format international
   * Exemples:
   * - 0612345678 → +33612345678
   * - +33612345678 → +33612345678
   */
  private formatPhoneNumber(phone: string): string {
    // Retirer les espaces et tirets
    let cleaned = phone.replace(/[\s\-()]/g, '');
    
    // Si commence par 0 (France), remplacer par +33
    if (cleaned.startsWith('0')) {
      cleaned = '+33' + cleaned.slice(1);
    }
    
    // Si ne commence pas par +, ajouter +33 (par défaut France)
    if (!cleaned.startsWith('+')) {
      cleaned = '+33' + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Vérifie que le service SMS Gateway est configuré
   */
  isConfigured(): boolean {
    return !!(this.email && this.password);
  }
}

// Singleton - Initialisation avec les variables d'environnement
export const twilioService = new TwilioSMSService({
  accountSid: process.env.TWILIO_ACCOUNT_SID || '',
  authToken: process.env.TWILIO_AUTH_TOKEN || '',
  phoneNumber: process.env.TWILIO_PHONE_NUMBER || ''
});

export default twilioService;
