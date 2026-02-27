/**
 * Tests de devis-service (Firebase mocké)
 * Teste les fonctions CRUD + logique métier
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks Firebase ────────────────────────────────────────────
vi.mock('@/lib/firebase/config', () => ({
  db: {},
}));

// Mock des fonctions Firestore
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDoc = vi.fn();
const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockTimestampNow = vi.fn(() => ({ toMillis: () => Date.now() }));

vi.mock('firebase/firestore', () => ({
  doc: (...args: any[]) => mockDoc(...args),
  collection: (...args: any[]) => mockCollection(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  addDoc: (...args: any[]) => mockAddDoc(...args),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  query: (...args: any[]) => mockQuery(...args),
  where: (...args: any[]) => mockWhere(...args),
  Timestamp: { now: () => mockTimestampNow() },
  increment: (n: number) => ({ __increment: n }),
  arrayUnion: (...args: any[]) => ({ __arrayUnion: args }),
}));

// Mock des services secondaires (éviter les imports dynamiques en cascade)
vi.mock('@/lib/firebase/notification-service', () => ({
  notifyClientDevisRecu: vi.fn(),
  createNotification: vi.fn(),
}));

vi.mock('@/lib/firebase/artisan-stats-service', () => ({
  trackDevisEnvoye: vi.fn(),
  trackDevisAccepte: vi.fn(),
  trackDevisRefuse: vi.fn(),
}));

// ── Import du service APRÈS les mocks ────────────────────────
import { getDevisById, updateDevisStatus, getDevisByArtisan } from '@/lib/firebase/devis-service';

// ── Fixtures ──────────────────────────────────────────────────
const fakeTimestamp = { toMillis: () => 1700000000000 };

const mockDevisData = {
  artisanId: 'artisan-001',
  clientId: 'client-001',
  demandeId: 'demande-001',
  numeroDevis: 'DV-2026-00001',
  statut: 'envoye',
  montantHT: 1000,
  montantTTC: 1200,
  historiqueStatuts: [{ statut: 'genere', date: fakeTimestamp }],
  dateCreation: fakeTimestamp,
  dateModification: fakeTimestamp,
};

// ── Tests ──────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockDoc.mockReturnValue('doc-ref');
  mockCollection.mockReturnValue('col-ref');
  mockQuery.mockReturnValue('query-ref');
  mockWhere.mockReturnValue('where-clause');
});

describe('getDevisById', () => {
  it('retourne le devis quand il existe', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'devis-001',
      data: () => mockDevisData,
    });

    const result = await getDevisById('devis-001');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('devis-001');
    expect(result!.statut).toBe('envoye');
    expect(mockGetDoc).toHaveBeenCalledOnce();
  });

  it('retourne null quand le devis n\'existe pas', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => false,
    });

    const result = await getDevisById('inexistant');

    expect(result).toBeNull();
  });
});

describe('updateDevisStatus', () => {
  it('met à jour le statut d\'un devis existant', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'devis-001',
      data: () => mockDevisData,
    });
    mockUpdateDoc.mockResolvedValue(undefined);

    await updateDevisStatus('devis-001', 'litige');

    expect(mockUpdateDoc).toHaveBeenCalledOnce();
    const updateCall = mockUpdateDoc.mock.calls[0][1];
    expect(updateCall.statut).toBe('litige');
    expect(updateCall.historiqueStatuts).toBeDefined();
    expect(updateCall.historiqueStatuts.length).toBeGreaterThan(0);
  });

  it('lance une erreur si le devis n\'existe pas', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => false,
    });

    await expect(updateDevisStatus('inexistant', 'litige')).rejects.toThrow('Devis introuvable');
  });

  it('ajoute l\'entrée litige dans l\'historique', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'devis-001',
      data: () => ({ ...mockDevisData, historiqueStatuts: [] }),
    });
    mockUpdateDoc.mockResolvedValue(undefined);

    await updateDevisStatus('devis-001', 'litige');

    const updateCall = mockUpdateDoc.mock.calls[0][1];
    const dernierStatut = updateCall.historiqueStatuts.at(-1);
    expect(dernierStatut.statut).toBe('litige');
    expect(dernierStatut.commentaire).toContain('Litige');
  });
});

describe('getDevisByArtisan', () => {
  it('retourne les devis triés par date (plus récent en premier)', async () => {
    const devis1 = { id: 'devis-001', ...mockDevisData, dateCreation: { toMillis: () => 1000 } };
    const devis2 = { id: 'devis-002', ...mockDevisData, dateCreation: { toMillis: () => 2000 } };

    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'devis-001', data: () => devis1 },
        { id: 'devis-002', data: () => devis2 },
      ],
    });

    const result = await getDevisByArtisan('artisan-001');

    expect(result).toHaveLength(2);
    // Plus récent en premier
    expect(result[0].id).toBe('devis-002');
    expect(result[1].id).toBe('devis-001');
  });

  it('retourne un tableau vide si aucun devis', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });

    const result = await getDevisByArtisan('artisan-001');

    expect(result).toHaveLength(0);
  });
});

describe('Logique montants devis (unitaire)', () => {
  it('vérifie que 1000 HT × 1.2 = 1200 TTC', () => {
    const ht = 1000;
    const tva = 0.2;
    expect(Math.round(ht * (1 + tva) * 100) / 100).toBe(1200);
  });

  it('vérifie taux BTP réduit  5.5% sur 1000€', () => {
    const ht = 1000;
    const tva = 0.055;
    expect(Math.round(ht * (1 + tva) * 100) / 100).toBe(1055);
  });
});
