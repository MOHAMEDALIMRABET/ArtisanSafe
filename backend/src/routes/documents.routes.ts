/**
 * Routes pour le parsing de documents (KBIS, pièces d'identité)
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { parseKbisDocument } from '../services/document-parser.service';

const router = Router();

// Configuration multer pour l'upload en mémoire
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format non supporté. Utilisez PDF, JPG ou PNG.'));
    }
  },
});

/**
 * POST /api/v1/documents/parse-kbis
 * Parse un document KBIS et extrait les informations
 */
router.post('/parse-kbis', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Aucun fichier fourni',
      });
    }

    console.log(`📄 Parsing KBIS: ${req.file.originalname} (${req.file.size} bytes)`);

    // Convertir le buffer en File-like object
    const fileBlob = new Blob([new Uint8Array(req.file.buffer)], { type: req.file.mimetype });
    const file = Object.assign(fileBlob, {
      name: req.file.originalname,
      lastModified: Date.now(),
    }) as File;

    // Parser le document
    const parseResult = await parseKbisDocument(file);

    if (parseResult.success) {
      console.log('✅ KBIS parsé avec succès:', {
        siret: parseResult.siret,
        companyName: parseResult.companyName,
        representantLegal: parseResult.representantLegal,
      });
    } else {
      console.warn('⚠️ Échec du parsing KBIS:', parseResult.error);
    }

    return res.json(parseResult);
  } catch (error: any) {
    console.error('❌ Erreur parsing KBIS:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Erreur lors du parsing du document',
    });
  }
});

export default router;
