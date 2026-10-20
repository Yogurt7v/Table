import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMailLinkChange } from './useMailLinkChange';
import { notifications } from '@mantine/notifications';
import type { LinkChangePlan } from './mail-parent';
import type { IMailRelation, MailRelationSide } from '@/shared/types';

vi.mock('@/api/mail', () => ({
  createCrossMailRelation: vi.fn().mockResolvedValue(undefined),
  deleteMailRelation: vi.fn().mockResolvedValue(undefined),
}));

import { createCrossMailRelation, deleteMailRelation } from '@/api/mail';

const mockCreate = vi.mocked(createCrossMailRelation);
const mockDelete = vi.mocked(deleteMailRelation);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useMailLinkChange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(notifications, 'show').mockImplementation(() => 'test-id');
  });

  it('успешная смена связи: снимает старую, создаёт новую', async () => {
    const { result } = renderHook(() => useMailLinkChange('org1'), {
      wrapper: createWrapper(),
    });

    const child: MailRelationSide = { type: 'incoming', id: 'mail1' };
    const plan: LinkChangePlan = {
      drop: [
        {
          relationId: 'rel1',
          parent: { key: 'outgoing:mail2', type: 'outgoing', id: 'mail2' },
          child: { key: 'incoming:mail1', type: 'incoming', id: 'mail1' },
        },
      ],
      create: {
        key: 'outgoing:mail3',
        type: 'outgoing',
        id: 'mail3',
        number: '300',
        counterparty: 'ООО Ромашка',
        dateKey: '2024-01-17',
        subject: 'Тема 3',
        seq: 3,
      },
    };

    await result.current.changeLink({ child, plan });

    expect(mockDelete).toHaveBeenCalledWith('rel1', 'org1');
    expect(mockCreate).toHaveBeenCalledWith(
      { id: 'mail3', type: 'outgoing' },
      child,
      'org1',
    );
  });

  it('без plan.create — только снимает связь', async () => {
    const { result } = renderHook(() => useMailLinkChange('org1'), {
      wrapper: createWrapper(),
    });

    const child: MailRelationSide = { type: 'incoming', id: 'mail1' };
    const plan: LinkChangePlan = {
      drop: [
        {
          relationId: 'rel1',
          parent: { key: 'outgoing:mail2', type: 'outgoing', id: 'mail2' },
          child: { key: 'incoming:mail1', type: 'incoming', id: 'mail1' },
        },
      ],
      create: null,
    };

    await result.current.changeLink({ child, plan });

    expect(mockDelete).toHaveBeenCalledWith('rel1', 'org1');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('при ошибке создания восстанавливает снятые связи', async () => {
    mockCreate.mockRejectedValueOnce(new Error('network'));

    const { result } = renderHook(() => useMailLinkChange('org1'), {
      wrapper: createWrapper(),
    });

    const child: MailRelationSide = { type: 'incoming', id: 'mail1' };
    const plan: LinkChangePlan = {
      drop: [
        {
          relationId: 'rel1',
          parent: { key: 'outgoing:mail2', type: 'outgoing', id: 'mail2' },
          child: { key: 'incoming:mail1', type: 'incoming', id: 'mail1' },
        },
      ],
      create: {
        key: 'outgoing:mail3',
        type: 'outgoing',
        id: 'mail3',
        number: '300',
        counterparty: 'ООО Ромашка',
        dateKey: '2024-01-17',
        subject: 'Тема 3',
        seq: 3,
      },
    };

    await expect(result.current.changeLink({ child, plan })).rejects.toThrow(
      'Не удалось сохранить связь, предыдущая восстановлена',
    );

    expect(mockCreate).toHaveBeenCalledWith(
      { key: 'outgoing:mail2', type: 'outgoing', id: 'mail2' },
      child,
      'org1',
    );
  });

  it('при ошибке снятия показывает уведомление', async () => {
    mockDelete.mockRejectedValueOnce(new Error('network'));

    const { result } = renderHook(() => useMailLinkChange('org1'), {
      wrapper: createWrapper(),
    });

    const child: MailRelationSide = { type: 'incoming', id: 'mail1' };
    const plan: LinkChangePlan = {
      drop: [
        {
          relationId: 'rel1',
          parent: { key: 'outgoing:mail2', type: 'outgoing', id: 'mail2' },
          child: { key: 'incoming:mail1', type: 'incoming', id: 'mail1' },
        },
      ],
      create: {
        key: 'outgoing:mail3',
        type: 'outgoing',
        id: 'mail3',
        number: '300',
        counterparty: 'ООО Ромашка',
        dateKey: '2024-01-17',
        subject: 'Тема 3',
        seq: 3,
      },
    };

    await expect(result.current.changeLink({ child, plan })).rejects.toThrow(
      'Не удалось снять прежнюю связь — новый родитель не назначен',
    );

    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'red' }),
    );
  });

  it('isPending=true во время выполнения', async () => {
    let resolveCreate: (v: IMailRelation) => void = () => {};
    mockCreate.mockImplementationOnce(
      () => new Promise((r) => { resolveCreate = r; }),
    );

    const { result } = renderHook(() => useMailLinkChange('org1'), {
      wrapper: createWrapper(),
    });

    const child: MailRelationSide = { type: 'incoming', id: 'mail1' };
    const plan: LinkChangePlan = {
      drop: [],
      create: {
        key: 'outgoing:mail3',
        type: 'outgoing',
        id: 'mail3',
        number: '300',
        counterparty: 'ООО Ромашка',
        dateKey: '2024-01-17',
        subject: 'Тема 3',
        seq: 3,
      },
    };

    const promise = result.current.changeLink({ child, plan });
    await waitFor(() => expect(result.current.isPending).toBe(true));

    resolveCreate({ id: 'new1', organization_id: 'org1' });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    await promise;
  });
});
