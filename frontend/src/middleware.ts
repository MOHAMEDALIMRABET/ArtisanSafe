/**
 * Middleware Next.js - Protection routes admin
 * Ce fichier s'exécute AVANT toute requête vers /admin/*
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 🔒 PROTECTION ADMIN : Bloquer /admin/* sauf URL sécurisée
  if (pathname.startsWith('/admin') && !pathname.startsWith('/access-')) {
    // TODO: Vérifier le token admin dans les cookies
    // Pour l'instant, on laisse passer (vérification dans layout)
    // Une amélioration serait de vérifier un cookie 'admin-session'
  }

  // 🚨 LOGGER les tentatives d'accès à l'URL admin sécurisée
  if (pathname === '/access-x7k9m2p4w8n3') {
    // Récupérer IP et User-Agent
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    console.log(`[ADMIN LOGIN ATTEMPT] IP: ${ip} | UA: ${userAgent} | Time: ${new Date().toISOString()}`);
    
    // TODO: Envoyer à un service de logging (Firestore, Sentry, etc.)
    // await logAdminAccessAttempt({ ip, userAgent, timestamp: new Date() });
  }

  // 🛡️ SÉCURITÉ : Headers de sécurité renforcés pour /admin/*
  if (pathname.startsWith('/admin')) {
    const response = NextResponse.next();
    
    // Empêcher mise en cache des pages admin
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    
    // Empêcher iframe (protection clickjacking)
    response.headers.set('X-Frame-Options', 'DENY');
    
    // Empêcher sniffing MIME
    response.headers.set('X-Content-Type-Options', 'nosniff');
    
    // Protection XSS
    response.headers.set('X-XSS-Protection', '1; mode=block');
    
    return response;
  }

  return NextResponse.next();
}

// Configuration : appliquer le middleware uniquement sur /admin/*
export const config = {
  matcher: '/admin/:path*',
};
