/**
 * Tests unitaires pour dateExpirationUtils
 * Vérification cohérence BTP
 */

import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import { calculateExpirationDate, isDemandeExpired, formatExpirationStatus } from '../dateExpirationUtils';

// Figer le temps à la date de référence des tests pour les fonctions dépendant de Date.now()
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-02-19T12:00:00Z'));
});

afterAll(() => {
  vi.useRealTimers();
});

describe('calculateExpirationDate - Logique BTP', () => {
  // Référence : 19 février 2026
  const dateCreation = new Date('2026-02-19');

  describe('Cas 1 : Travaux URGENTS (< 7 jours)', () => {
    test('Travaux demain → Minimum 5 jours d\'expiration (viable)', () => {
      const dateDebutTravaux = new Date('2026-02-20'); // Demain
      const expiration = calculateExpirationDate(dateCreation, dateDebutTravaux);
      
      // Attendu : 24 février (19 + 5 jours)
      expect(expiration.toISOString().split('T')[0]).toBe('2026-02-24');
      
      // Vérification : Pas expirée le jour de création
      expect(expiration > dateCreation).toBe(true);
      
      // Ecart minimum 5 jours
      const diffDays = Math.floor((expiration.getTime() - dateCreation.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBeGreaterThanOrEqual(5);
    });

    test('Travaux dans 3 jours → Minimum 5 jours d\'expiration', () => {
      const dateDebutTravaux = new Date('2026-02-22'); // Dans 3 jours
      const expiration = calculateExpirationDate(dateCreation, dateDebutTravaux);
      
      // Attendu : 24 février (19 + 5 jours minimum)
      expect(expiration.toISOString().split('T')[0]).toBe('2026-02-24');
    });

    test('Travaux dans 6 jours → Expiration 2 jours avant début', () => {
      const dateDebutTravaux = new Date('2026-02-25'); // Dans 6 jours
      const expiration = calculateExpirationDate(dateCreation, dateDebutTravaux);
      
      // Attendu : Maximum entre (24/02 = création+5) et (23/02 = début-2)
      // → 24 février (création + 5 jours)
      expect(expiration.toISOString().split('T')[0]).toBe('2026-02-24');
    });
  });

  describe('Cas 2 : Travaux NORMAUX (7-30 jours)', () => {
    test('Travaux dans 7 jours → Expiration 5 jours avant début', () => {
      const dateDebutTravaux = new Date('2026-02-26'); // Dans 7 jours
      const expiration = calculateExpirationDate(dateCreation, dateDebutTravaux);
      
      // Attendu : 21 février (26 - 5 jours)
      // MAIS minimum est 24/02 (création + 5)
      // → 24 février (minimum appliqué)
      expect(expiration.toISOString().split('T')[0]).toBe('2026-02-24');
    });

    test('Travaux dans 15 jours → Expiration 5 jours avant début', () => {
      const dateDebutTravaux = new Date('2026-03-06'); // Dans 15 jours
      const expiration = calculateExpirationDate(dateCreation, dateDebutTravaux);
      
      // Attendu : 1er mars (6/03 - 5 jours)
      expect(expiration.toISOString().split('T')[0]).toBe('2026-03-01');
      
      // Artisans ont 10 jours pour répondre (19/02 → 1/03)
      const delaiArtisans = Math.floor((expiration.getTime() - dateCreation.getTime()) / (1000 * 60 * 60 * 24));
      expect(delaiArtisans).toBe(10);
    });

    test('Travaux dans 20 jours → Expiration 5 jours avant début', () => {
      const dateDebutTravaux = new Date('2026-03-11'); // Dans 20 jours
      const expiration = calculateExpirationDate(dateCreation, dateDebutTravaux);
      
      // Attendu : 6 mars (11/03 - 5 jours)
      expect(expiration.toISOString().split('T')[0]).toBe('2026-03-06');
      
      // Artisans ont 15 jours pour répondre
      const delaiArtisans = Math.floor((expiration.getTime() - dateCreation.getTime()) / (1000 * 60 * 60 * 24));
      expect(delaiArtisans).toBe(15);
    });
  });

  describe('Cas 3 : Travaux LOINTAINS (>= 30 jours)', () => {
    test('Travaux dans 30 jours → Cap 30 jours appliqué', () => {
      const dateDebutTravaux = new Date('2026-03-21'); // Dans 30 jours
      const expiration = calculateExpirationDate(dateCreation, dateDebutTravaux);
      
      // Attendu : 21 mars (19/02 + 30 jours cap)
      expect(expiration.toISOString().split('T')[0]).toBe('2026-03-21');
    });

    test('Travaux dans 60 jours → Cap 30 jours appliqué', () => {
      const dateDebutTravaux = new Date('2026-04-20'); // Dans 60 jours
      const expiration = calculateExpirationDate(dateCreation, dateDebutTravaux);
      
      // Attendu : 21 mars (19/02 + 30 jours cap)
      expect(expiration.toISOString().split('T')[0]).toBe('2026-03-21');
    });
  });

  describe('Cas 4 : Pas de date précisée', () => {
    test('Pas de date → Expiration 30 jours par défaut', () => {
      const expiration = calculateExpirationDate(dateCreation, null);
      
      // Attendu : 21 mars (19/02 + 30 jours)
      expect(expiration.toISOString().split('T')[0]).toBe('2026-03-21');
    });

    test('Date undefined → Expiration 30 jours par défaut', () => {
      const expiration = calculateExpirationDate(dateCreation, undefined);
      
      // Attendu : 21 mars
      expect(expiration.toISOString().split('T')[0]).toBe('2026-03-21');
    });
  });

  describe('Règles de sécurité minimale', () => {
    test('Minimum absolu : 5 jours entre création et expiration', () => {
      // Tous les cas doivent respecter le minimum de 5 jours
      const cas = [
        new Date('2026-02-20'), // Demain
        new Date('2026-02-21'), // Dans 2 jours
        new Date('2026-02-22'), // Dans 3 jours
      ];

      cas.forEach(dateDebut => {
        const expiration = calculateExpirationDate(dateCreation, dateDebut);
        const diffDays = Math.floor((expiration.getTime() - dateCreation.getTime()) / (1000 * 60 * 60 * 24));
        
        expect(diffDays).toBeGreaterThanOrEqual(5);
      });
    });
  });
});

describe('isDemandeExpired', () => {
  test('Date passée → Expirée', () => {
    const dateExpiration = new Date('2026-02-18'); // Hier
    expect(isDemandeExpired(dateExpiration)).toBe(true);
  });

  test('Date future → Non expirée', () => {
    const dateExpiration = new Date('2026-02-25'); // Future
    expect(isDemandeExpired(dateExpiration)).toBe(false);
  });

  test('Timestamp Firestore passé → Expirée', () => {
    const timestamp = { seconds: 1708300800, nanoseconds: 0 }; // 18 février 2026
    expect(isDemandeExpired(timestamp)).toBe(true);
  });
});

describe('formatExpirationStatus', () => {
  test('Expire dans 5 jours', () => {
    const dateExpiration = new Date('2026-02-24');
    const status = formatExpirationStatus(dateExpiration);
    
    expect(status).toContain('Expire dans');
    expect(status).toContain('jour');
  });

  test('Expirée depuis 2 jours', () => {
    const dateExpiration = new Date('2026-02-17');
    const status = formatExpirationStatus(dateExpiration);
    
    expect(status).toContain('Expirée depuis');
    expect(status).toContain('jour');
  });
});

describe('Scénarios réels BTP', () => {
  const aujourd_hui = new Date('2026-02-19');

  test('Scénario 1 : Fuite d\'eau urgente (travaux aujourd\'hui)', () => {
    const travauxAujourdhui = new Date('2026-02-19');
    const expiration = calculateExpirationDate(aujourd_hui, travauxAujourdhui);
    
    // Doit créer une demande viable (minimum 5 jours)
    const diffDays = Math.floor((expiration.getTime() - aujourd_hui.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBeGreaterThanOrEqual(5);
    
    // La demande ne doit PAS être expirée le jour même
    expect(isDemandeExpired(expiration)).toBe(false);
  });

  test('Scénario 2 : Rénovation cuisine planifiée (dans 2 semaines)', () => {
    const travauxDans14Jours = new Date('2026-03-05');
    const expiration = calculateExpirationDate(aujourd_hui, travauxDans14Jours);
    
    // Attendu : 28 février (5 mars - 5 jours)
    expect(expiration.toISOString().split('T')[0]).toBe('2026-02-28');
    
    // Artisans ont 9 jours pour envoyer devis
    const delaiArtisans = Math.floor((expiration.getTime() - aujourd_hui.getTime()) / (1000 * 60 * 60 * 24));
    expect(delaiArtisans).toBe(9);
  });

  test('Scénario 3 : Extension maison (dans 2 mois)', () => {
    const travauxDans60Jours = new Date('2026-04-20');
    const expiration = calculateExpirationDate(aujourd_hui, travauxDans60Jours);
    
    // Cap 30 jours appliqué
    expect(expiration.toISOString().split('T')[0]).toBe('2026-03-21');
    
    // Empêche demande de rester 60 jours
    const delai = Math.floor((expiration.getTime() - aujourd_hui.getTime()) / (1000 * 60 * 60 * 24));
    expect(delai).toBe(30);
  });
});
