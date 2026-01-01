import dotenv from 'dotenv';

// Charger les variables d'environnement EN PREMIER
dotenv.config();

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import smsRoutes from './routes/sms.routes';

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

// Gestion des erreurs 404
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Route non trouvée'
    }
  });
});

app.listen(port, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${port}`);
  console.log(`📍 API disponible sur http://localhost:${port}/api/v1`);
});

export default app;
