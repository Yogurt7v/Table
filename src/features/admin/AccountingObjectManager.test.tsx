import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AccountingObjectManager } from './AccountingObjectManager';
import type { IAccountingObject } from '@/shared/types';

vi.mock('@/api/collections', () => ({
  createAccountingObject: vi.fn(),
  updateAccountingObject: vi.fn(),
  deleteAccountingObject: vi.fn(),
}));

const objects: IAccountingObject[] = [
  { id: 'obj1', organization_id: 'org1', name: 'Объект А' },
  { id: 'obj2', organization_id: 'org1', name: 'Объект Б' },
];

function renderManager(canEdit: boolean) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <AccountingObjectManager organizationId="org1" objects={objects} canEdit={canEdit} />
      </MantineProvider>
    </QueryClientProvider>,
  );
}

describe('AccountingObjectManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows object names in read-only mode', () => {
    renderManager(false);
    expect(screen.getByText('Объект А')).toBeInTheDocument();
    expect(screen.getByText('Объект Б')).toBeInTheDocument();
  });

  it('hides CRUD controls when canEdit is false', () => {
    renderManager(false);
    expect(screen.queryByPlaceholderText('Название объекта')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Добавить' })).not.toBeInTheDocument();
    expect(screen.queryAllByLabelText(/edit|pencil/i)).toHaveLength(0);
  });

  it('shows add form when canEdit is true', () => {
    renderManager(true);
    expect(screen.getByPlaceholderText('Название объекта')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Добавить' })).toBeInTheDocument();
  });
});
