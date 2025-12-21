import * as admin from 'firebase-admin';

let app: admin.app.App;

if (!admin.apps.length) {
  // Pour le développement local
  if (process.env.NODE_ENV === 'development') {
    app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } else {
    // Pour la production (utilise les credentials par défaut)
    app = admin.initializeApp();
  }
} else {
  app = admin.app();
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();

export default app;
