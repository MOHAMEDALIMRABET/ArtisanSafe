/**
 * Tests de demande-service (Firebase mocké)
 * Teste le filtrage côté client de getDemandesPubliquesForArtisan
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks Firebase ────────────────────────────────────────────
vi.mock('@/lib/firebase/config', () => ({ db: {} }));

const mockGetDocs = vi.fn();
const mockDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: (...args: any[]) => mockDoc(...args),
  collection: (...args: any[]) => mockCollection(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  addDoc: vi.fn(),
  query: (...args: any[]) => mockQuery(...args),
  where: (...args: any[]) => mockWhere(...args),
  orderBy: vi.fn(),
  limit: vi.fn(),
  Timestamp: { now: () => ({ toMillis: () => Date.now() }) },
  increment: (n: number) => ({ __increment: n }),
  arrayUnion: (...args: any[]) => ({ __arrayUnion: args }),
}));

vi.mock('@/lib/firebase/matching-service', () => ({
  calculateDistance: vi.fn(() => 10), // 10 km par défaut
}));

// ── Import du service APRÈS les mocks ────────────────────────
import { getDemandesPubliquesForArtisan, getDemandeById } from '@/lib/firebase/demande-service';

// ── Helpers ──────────────────────────────────────────────────

/** Crée un Timestamp Firestore factice */
function makeTimestamp(date: Date) {
  return {
    toDate: () => date,
    toMillis: () => date.getTime(),
    seconds: Math.floor(date.getTime() / 1000),
  };
}

const NOW = new Date();
const FUTUR = new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 jours
const PASSE = new Date(NOW.getTime() - 1 * 24 * 60 * 60 * 1000); // -1 jour (expirée)

function makeDemande(overrides: Record<string, any> = {}) {
  return {
    id: 'demande-001',
    type: 'publique',
    statut: 'publiee',
    dateCreation: makeTimestamp(new Date(NOW.getTime() - 3600000)),
    dateExpiration: makeTimestamp(FUTUR),
    localisation: { ville: 'paris', coordonneesGPS: null },
    critereRecherche: { metier: 'plomberie', rayon: 50 },
    ...overrides,
  };
}

// ── beforeEach ────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  mockDoc.mockReturnValue('doc-ref');
  mockCollection.mockReturnValue('col-ref');
  mockQuery.mockReturnValue('query-ref');
  mockWhere.mockReturnValue('where-clause');
  mockUpdateDoc.mockResolvedValue(undefined);
});

// ── Tests ──────────────────────────────────────────────────────

const artisanPlombierParis = {
  metiers: ['plomberie'],
  location: { city: 'paris' },
};

describe('getDemandesPubliquesForArtisan — filtrage côté client', () => {
  it('retourne les demandes publiees correspondant au métier de l\'artisan', async () => {
    const demandePlomberie = makeDemande({ id: 'demande-001' });

    mockGetDocs.mockResolvedValue({
      empty: false,
      docs: [{ id: 'demande-001', data: () => demandePlomberie }],
    });

    const result = await getDemandesPubliquesForArtisan(artisanPlombierParis);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('demande-001');
  });

  it('exclut les demandes dont le métier ne correspond pas', async () => {
    const demandeElectricite = makeDemande({
      id: 'demande-002',
      critereRecherche: { metier: 'electricite', rayon: 50 },
    });

    mockGetDocs.mockResolvedValue({
      empty: false,
      docs: [{ id: 'demande-002', data: () => demandeElectricite }],
    });

    const result = await getDemandesPubliquesForArtisan(artisanPlombierParis);
    expect(result).toHaveLength(0);
  });

  it('exclut les demandes expirées (dateExpiration dans le passé)', async () => {
    const demandeExpiree = makeDemande({
      id: 'demande-003',
      dateExpiration: makeTimestamp(PASSE),
    });

    mockGetDocs.mockResolvedValue({
      empty: false,
      docs: [{ id: 'demande-003', data: () => demandeExpiree }],
    });

    const result = await getDemandesPubliquesForArtisan(artisanPlombierParis);
    expect(result).toHaveLength(0);
  });

  it('exclut les demandes avec statut "attribuee"', async () => {
    const demandeAttribuee = makeDemande({ statut: 'attribuee' });

    mockGetDocs.mockResolvedValue({
      empty: false,
      docs: [{ id: 'demande-004', data: () => demandeAttribuee }],
    });

    const result = await getDemandesPubliquesForArtisan(artisanPlombierParis);
    expect(result).toHaveLength(0);
  });

  it('exclut les demandes avec statut "terminee"', async () => {
    const demandeTerminee = makeDemande({ statut: 'terminee' });

    mockGetDocs.mockResolvedValue({
      empty: false,
      docs: [{ id: 'demande-005', data: () => demandeTerminee }],
    });

    const result = await getDemandesPubliquesForArtisan(artisanPlombierParis);
    expect(result).toHaveLength(0);
  });

  it('inclut les demandes avec statut "quota_atteint"', async () => {
    const demandeQuota = makeDemande({ statut: 'quota_atteint' });

    mockGetDocs.mockResolvedValue({
      empty: false,
      docs: [{ id: 'demande-006', data: () => demandeQuota }],
    });

    const result = await getDemandesPubliquesForArtisan(artisanPlombierParis);
    expect(result).toHaveLength(1);
  });

  it('inclut les demandes avec statut "matchee"', async () => {
    const demandeMatchee = makeDemande({ statut: 'matchee' });

    mockGetDocs.mockResolvedValue({
      empty: false,
      docs: [{ id: 'demande-007', data: () => demandeMatchee }],
    });

    const result = await getDemandesPubliquesForArtisan(artisanPlombierParis);
    expect(result).toHaveLength(1);
  });

  it('trie les résultats par date de création (plus récent en premier)', async () => {
    const ancienne = makeDemande({
      id: 'ancienne',
      dateCreation: makeTimestamp(new Date(NOW.getTime() - 7200000)), // -2h
    });
    const recente = makeDemande({
      id: 'recente',
      dateCreation: makeTimestamp(new Date(NOW.getTime() - 1800000)), // -30min
    });

    mockGetDocs.mockResolvedValue({
      empty: false,
      docs: [
        { id: 'ancienne', data: () => ancienne },
        { id: 'recente', data: () => recente },
      ],
    });

    const result = await getDemandesPubliquesForArtisan(artisanPlombierParis);
    expect(result[0].id).toBe('recente');
    expect(result[1].id).toBe('ancienne');
  });

  it('retourne un tableau vide si aucun résultat Firestore', async () => {
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] });

    const result = await getDemandesPubliquesForArtisan(artisanPlombierParis);
    expect(result).toHaveLength(0);
  });

  it('retourne un tableau vide en cas d\'erreur Firestore', async () => {
    mockGetDocs.mockRejectedValue(new Error('Firestore error'));

    const result = await getDemandesPubliquesForArtisan(artisanPlombierParis);
    expect(result).toHaveLength(0);
  });
});

describe('getDemandeById', () => {
  it('retourne la demande quand elle existe', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'demande-001',
      data: () => makeDemande(),
    });

    const result = await getDemandeById('demande-001');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('demande-001');
  });

  it('retourne null quand la demande n\'existe pas', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });

    const result = await getDemandeById('inexistant');
    expect(result).toBeNull();
  });
});
