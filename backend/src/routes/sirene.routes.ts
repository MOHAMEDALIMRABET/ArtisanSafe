/**
 * Routes pour la vérification SIRET via API SIRENE publique
 */

import { Router } from 'express';
import { verifySiretWithRaisonSociale } from '../services/sirene-api.service';

const router = Router();

/**
 * POST /api/v1/sirene/verify
 * Vérifier l'adéquation SIRET + Raison Sociale
 * 
 * Body: {
 *   siret: string (14 chiffres),
 *   raisonSociale: string
 * }
 */
router.post('/verify', async (req, res) => {
  try {
    console.log('📥 Requête reçue - Headers:', req.headers);
    console.log('📥 Requête reçue - Body:', req.body);
    console.log('📥 Type de body:', typeof req.body);
    
    const { siret, raisonSociale } = req.body;

    // Validation des champs
    if (!siret || !raisonSociale) {
      console.error('❌ Paramètres manquants - siret:', siret, '- raisonSociale:', raisonSociale);
      return res.status(400).json({
        success: false,
        error: 'SIRET et raison sociale requis'
      });
    }

    // ⚠️ VALIDATION STRICTE : SIRET doit avoir EXACTEMENT 14 chiffres
    const cleanSiret = siret.replace(/\s/g, '');
    if (!/^\d{14}$/.test(cleanSiret)) {
      console.error('❌ SIRET invalide - Longueur:', cleanSiret.length, '- Valeur:', cleanSiret);
      return res.status(400).json({
        success: false,
        error: 'Le numéro SIRET doit contenir exactement 14 chiffres (ni plus, ni moins)'
      });
    }

    console.log(`🔍 Vérification SIRET: ${siret} - Raison sociale: ${raisonSociale}`);

    // Vérification via API SIRENE publique (entreprise.data.gouv.fr)
    const result = await verifySiretWithRaisonSociale(siret, raisonSociale);

    if (!result.valid) {
      return res.status(400).json({
        success: false,
        error: result.message,
        details: result.details
      });
    }

    // Succès
    console.log(`✅ SIRET vérifié: ${siret} - ${result.details?.raisonSociale}`);
    
    res.json({
      success: true,
      message: result.message,
      data: result.details
    });

  } catch (error: any) {
    console.error('Erreur vérification SIRENE:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la vérification SIRET'
    });
  }
});

export default router;
