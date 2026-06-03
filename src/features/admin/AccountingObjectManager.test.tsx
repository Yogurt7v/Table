import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AccountingObjectManager } from './AccountingObjectManager';
import type { IAccountingObject } from '@/shared/types';

vi.mock('@/api/collections', () => ({
  createAccountingObject: vi.fn().mockResolvedValue({ id: 'new1', organization_id: 'org1', name: 'Новый объект' }),
  updateAccountingObject: vi.fn().mockResolvedValue({}),
  deleteAccountingObject: vi.fn().mockResolvedValue({}),
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
  });

  it('shows add form when canEdit is true', () => {
    renderManager(true);
    expect(screen.getByPlaceholderText('Название объекта')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Добавить' })).toBeInTheDocument();
  });

  it('opens edit mode on pencil click', async () => {
    const user = userEvent.setup();
    renderManager(true);

    const pencilButtons = screen.getAllByRole('button');
    const pencilBtn = pencilButtons.find(
      (btn) => btn.querySelector('svg'),
    );
    if (pencilBtn) await user.click(pencilBtn);

    await waitFor(() => {
      const inputs = screen.getAllByRole('textbox');
      expect(inputs.length).toBeGreaterThanOrEqual(2);
    });
  });
});
