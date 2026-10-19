import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useOrgMailThread } from './useOrgMailThread';

vi.mock('./mail-thread', () => ({
  buildLetterIndex: vi.fn((incoming: unknown[], outgoing: unknown[]) => ({
    letters: [...incoming, ...outgoing],
  })),
  buildMailThreadGraph: vi.fn(() => ({ nodes: [], edges: [] })),
  detectCyclicNodeKeys: vi.fn(() => new Set()),
  fetchOrgMailRelations: vi.fn().mockResolvedValue([]),
  fetchOrgMailLetters: vi.fn().mockResolvedValue({ incoming: [], outgoing: [] }),
}));

vi.mock('./mail-parent', () => ({
  buildCandidateLookup: vi.fn(() => ({ all: [] })),
  buildParentEdgeIndex: vi.fn(() => ({})),
}));

import { fetchOrgMailRelations, fetchOrgMailLetters } from './mail-thread';

const mockFetchRelations = vi.mocked(fetchOrgMailRelations);
const mockFetchLetters = vi.mocked(fetchOrgMailLetters);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useOrgMailThread', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchRelations.mockResolvedValue([]);
    mockFetchLetters.mockResolvedValue({ incoming: [], outgoing: [] });
  });

  it('успешная загрузка: возвращает данные с ключами', async () => {
    mockFetchRelations.mockResolvedValue([
      { id: 'r1', parent: { type: 'incoming', id: 'm1' }, child: { type: 'outgoing', id: 'm2' } },
    ]);
    mockFetchLetters.mockResolvedValue({
      incoming: [{ id: 'm1', number: '100' }],
      outgoing: [{ id: 'm2', number: '200' }],
    });

    const { result } = renderHook(() => useOrgMailThread('org1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.letters).toBeDefined();
    expect(result.current.graph).toBeDefined();
    expect(result.current.candidates).toBeDefined();
    expect(result.current.parentEdges).toBeDefined();
  });

  it('isLoading=true во время запроса', () => {
    let resolveRelations: (v: unknown) => void = () => {};
    mockFetchRelations.mockImplementationOnce(
      () => new Promise((r) => { resolveRelations = r; }),
    );

    const { result } = renderHook(() => useOrgMailThread('org1'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    resolveRelations([]);
  });

  it('enabled=false при пустом orgId', () => {
    const { result } = renderHook(() => useOrgMailThread(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it('отказ запроса: isError=true', async () => {
    mockFetchRelations.mockRejectedValueOnce(new Error('network'));

    const { result } = renderHook(() => useOrgMailThread('org1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
