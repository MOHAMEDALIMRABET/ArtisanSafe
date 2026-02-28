/**
 * PM2 Ecosystem Config — ArtisanDispo Backend
 * 
 * Installation : npm install -g pm2
 * Démarrer     : pm2 start ecosystem.config.js
 * Statut       : pm2 status
 * Logs         : pm2 logs artisandispo-backend
 * Redémarrer   : pm2 restart artisandispo-backend
 * Arrêter      : pm2 stop artisandispo-backend
 * Auto-démarr  : pm2 startup   (puis coller la commande générée)
 * Sauvegarder  : pm2 save
 */
module.exports = {
  apps: [
    {
      name: 'artisandispo-backend',
      script: './src/server.ts',
      interpreter: 'node',
      interpreter_args: '-r ts-node/register',
      cwd: __dirname,

      // ── Redémarrage automatique ──────────────────────
      autorestart: true,          // Redémarre si crash
      max_restarts: 10,           // Max 10 redémarrages consécutifs
      restart_delay: 5000,        // Attendre 5s avant de redémarrer
      min_uptime: '10s',          // Si le process vit moins de 10s → erreur

      // ── Gestion mémoire ──────────────────────────────
      max_memory_restart: '512M', // Redémarre si > 512MB RAM

      // ── Watch (dev uniquement) ────────────────────────
      watch: false,               // Ne pas utiliser watch en prod

      // ── Environnements ───────────────────────────────
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 5000,
      },

      // ── Logs ─────────────────────────────────────────
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,

      // ── Alertes ──────────────────────────────────────
      // pm2-slack ou pm2-slack-notify à configurer séparément
    },
  ],
};
