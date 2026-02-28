/**
 * Sentry — Configuration côté SERVEUR (Next.js SSR / API Routes)
 * Capture les erreurs serveur, les crashes API routes
 */
import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    beforeSend(event) {
      // Ne pas envoyer erreurs attendues
      if (event.exception?.values?.[0]?.value?.includes('NEXT_NOT_FOUND')) {
        return null;
      }
      return event;
    },
  });
}
