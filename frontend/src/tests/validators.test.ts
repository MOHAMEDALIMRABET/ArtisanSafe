/**
 * Tests de validation SIRET et fonctions utilitaires pures
 * Aucune dépendance Firebase — tests 100% synchrones
 */

import { describe, it, expect } from 'vitest';

// ============================================================
// Logique extraite de verification-service / inscription/page.tsx
// On teste la regex directement pour éviter l'import Firebase
// ============================================================

function isValidSiretFormat(siret: string): boolean {
  const clean = siret.replace(/\s/g, '');
  return /^\d{14}$/.test(clean);
}

describe('Validation format SIRET', () => {
  it('accepte un SIRET de 14 chiffres', () => {
    expect(isValidSiretFormat('12345678901234')).toBe(true);
  });

  it('accepte un SIRET avec espaces (normalisé)', () => {
    expect(isValidSiretFormat('123 456 789 01234')).toBe(true);
  });

  it('refuse un SIRET trop court (13 chiffres)', () => {
    expect(isValidSiretFormat('1234567890123')).toBe(false);
  });

  it('refuse un SIRET trop long (15 chiffres)', () => {
    expect(isValidSiretFormat('123456789012345')).toBe(false);
  });

  it('refuse un SIRET contenant des lettres', () => {
    expect(isValidSiretFormat('1234567890123A')).toBe(false);
  });

  it('refuse une chaîne vide', () => {
    expect(isValidSiretFormat('')).toBe(false);
  });

  it('refuse undefined transformé en chaîne', () => {
    expect(isValidSiretFormat('undefined')).toBe(false);
  });

  it('refuse un SIRET avec tirets non nettoyés', () => {
    // Les tirets ne sont pas des espaces — format invalide
    expect(isValidSiretFormat('123-456-789-01234')).toBe(false);
  });
});

// ============================================================
// Tests du format numéro de devis
// ============================================================

function isValidNumeroDevis(numero: string): boolean {
  return /^DV-\d{4}-\d{5}(-[A-Z])?$/.test(numero);
}

describe('Validation format numéro de devis', () => {
  it('accepte DV-2026-00001', () => {
    expect(isValidNumeroDevis('DV-2026-00001')).toBe(true);
  });

  it('accepte DV-2026-00001-A (variante)', () => {
    expect(isValidNumeroDevis('DV-2026-00001-A')).toBe(true);
  });

  it('refuse DV-26-00001 (année sur 2 chiffres)', () => {
    expect(isValidNumeroDevis('DV-26-00001')).toBe(false);
  });

  it('refuse DV-2026-1 (numéro non paddé)', () => {
    expect(isValidNumeroDevis('DV-2026-1')).toBe(false);
  });

  it('refuse un format complètement différent', () => {
    expect(isValidNumeroDevis('DEVIS-00001')).toBe(false);
  });
});

// ============================================================
// Tests calculs montants TTC / HT
// ============================================================

function calculerMontantTTC(montantHT: number, tauxTVA: number): number {
  return Math.round(montantHT * (1 + tauxTVA / 100) * 100) / 100;
}

describe('Calcul montant TTC', () => {
  it('calcule correctement avec TVA 20%', () => {
    expect(calculerMontantTTC(1000, 20)).toBe(1200);
  });

  it('calcule correctement avec TVA 10%', () => {
    expect(calculerMontantTTC(1000, 10)).toBe(1100);
  });

  it('calcule correctement avec TVA 5.5% (BTP rénovation)', () => {
    expect(calculerMontantTTC(1000, 5.5)).toBe(1055);
  });

  it('calcule correctement avec TVA 0%', () => {
    expect(calculerMontantTTC(1000, 0)).toBe(1000);
  });

  it('arrondit à 2 décimales', () => {
    // 100 * 1.055 = 105.5 → 105.50
    expect(calculerMontantTTC(100, 5.5)).toBe(105.5);
  });
});
