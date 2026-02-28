/**
 * Sentry — Configuration côté CLIENT (navigateur)
 * Capture les erreurs React, les crashes UI, les erreurs réseau
 */
import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',

    // Taux d'échantillonnage performance (10% en prod, 100% en dev)
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Replay de session pour reproduire les bugs (1% des sessions, 10% si erreur)
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 0.1,

    integrations: [
      Sentry.replayIntegration({
        // Masquer les données sensibles dans les replays
        maskAllText: true,
        blockAllMedia: false,
      }),
    ],

    // Ignorer les erreurs non-critiques connues
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      'ChunkLoadError',
      'Loading chunk',
      'Network request failed',
    ],

    beforeSend(event, hint) {
      // Ne pas envoyer les erreurs des extensions navigateur
      const error = hint?.originalException as Error;
      if (error?.stack?.includes('extension://')) return null;
      return event;
    },
  });
}
