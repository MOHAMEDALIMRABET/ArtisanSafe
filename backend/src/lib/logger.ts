import { createLogger, format, transports } from 'winston';
import path from 'path';
import fs from 'fs';

// Créer le dossier logs s'il n'existe pas
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const { combine, timestamp, colorize, printf, json, errors } = format;

// Format lisible pour la console
const consoleFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? `\n  ${JSON.stringify(meta, null, 2)}` : '';
  const stackStr = stack ? `\n${stack}` : '';
  return `${timestamp} [${level}] ${message}${metaStr}${stackStr}`;
});

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    json()
  ),
  transports: [
    // Console colorée pour le dev
    new transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'HH:mm:ss' }),
        consoleFormat
      ),
    }),
    // Fichier pour toutes les erreurs
    new transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5,
      tailable: true,
    }),
    // Fichier pour tous les logs
    new transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
    }),
  ],
});

export default logger;
