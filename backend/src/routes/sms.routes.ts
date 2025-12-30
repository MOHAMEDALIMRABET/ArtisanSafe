import { Router, Request, Response } from 'express';
import twilioService from '../services/sms-gateway-service';

const router = Router();

/**
 * POST /api/v1/sms/send-verification-code
 * Envoie un code de vérification par SMS
 */
router.post('/send-verification-code', async (req: Request, res: Response) => {
  try {
    const { phoneNumber, code } = req.body;

    // Validation
    if (!phoneNumber || !code) {
      return res.status(400).json({
        error: {
          code: 'MISSING_FIELDS',
          message: 'Le numéro de téléphone et le code sont requis'
        }
      });
    }

    // Vérifier que le code fait 6 chiffres
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_CODE',
          message: 'Le code doit contenir exactement 6 chiffres'
        }
      });
    }

    // Vérifier que le service SMS est configuré
    if (!twilioService.isConfigured()) {
      console.warn('⚠️ Twilio non configuré - Mode simulation activé');
      console.log(`📱 [SIMULATION] Code pour ${phoneNumber}: ${code}`);
      
      return res.json({
        success: true,
        simulation: true,
        message: 'SMS simulé (service non configuré)',
        code: process.env.NODE_ENV === 'development' ? code : undefined
      });
    }

    // Envoyer le SMS
    const result = await twilioService.sendVerificationCode(phoneNumber, code);

    if (result.success) {
      return res.json({
        success: true,
        messageId: result.messageSid,
        message: 'Code de vérification envoyé avec succès'
      });
    } else {
      return res.status(500).json({
        error: {
          code: 'SMS_SEND_FAILED',
          message: result.error || 'Erreur lors de l\'envoi du SMS'
        }
      });
    }

  } catch (error) {
    console.error('❌ Erreur endpoint /send-verification-code:', error);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Erreur serveur lors de l\'envoi du SMS'
      }
    });
  }
});

/**
 * GET /api/v1/sms/status
 * Vérifie si le service SMS est configuré et opérationnel
 */
router.get('/status', (req: Request, res: Response) => {
  const isConfigured = twilioService.isConfigured();
  
  res.json({
    configured: isConfigured,
    provider: 'Twilio',
    status: isConfigured ? 'operational' : 'not_configured',
    message: isConfigured 
      ? 'Service SMS opérationnel (Twilio)' 
      : 'Credentials Twilio manquants dans .env'
  });
});

export default router;
