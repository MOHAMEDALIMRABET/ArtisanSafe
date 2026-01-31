import dotenv from 'dotenv';

// Charger les variables d'environnement EN PREMIER
dotenv.config();

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import smsRoutes from './routes/sms.routes';
import documentsRoutes from './routes/documents.routes';
import emailRoutes from './routes/email.routes';
import authRoutes from './routes/auth.routes';
import sireneRoutes from './routes/sirene.routes';
import { startEmailWatcher } from './services/email-service';

const app: Express = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes de base
app.get('/api/v1/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'success', 
    message: 'Artisan Dispo API fonctionne correctement',
    timestamp: new Date().toISOString()
  });
});

// Routes SMS
app.use('/api/v1/sms', smsRoutes);

// Routes Documents
app.use('/api/v1/documents', documentsRoutes);

// Routes Emails
app.use('/api/v1/emails', emailRoutes);

// Routes Auth (gestion utilisateurs Firebase)
app.use('/api/v1/auth', authRoutes);

// Routes SIRENE (vérification SIRET)
app.use('/api/v1/sirene', sireneRoutes);

// Gestion des erreurs 404
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Route non trouvée'
    }
  });
});

// Démarrer le serveur
app.listen(port, async () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${port}`);
  console.log(`📍 API disponible sur http://localhost:${port}/api/v1`);
  console.log(`🔧 MODE BYPASS SIRENE: ${process.env.SIRENE_BYPASS_VERIFICATION === 'true' ? '✅ ACTIVÉ' : '❌ DÉSACTIVÉ'}`);
  
  // Démarrer la surveillance des emails APRÈS l'initialisation complète
  if (process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
    // Attendre 2 secondes pour s'assurer que Firebase est initialisé
    setTimeout(() => {
      startEmailWatcher().catch(console.error);
      console.log('✅ Service email configuré - Surveillance active (toutes les 5 minutes)');
    }, 2000);
  } else {
    console.log('⚠️ Configuration SMTP manquante - Envoi d\'emails désactivé');
  }
});

export default app;
