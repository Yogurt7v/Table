import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AccountingObjectManager } from './AccountingObjectManager';
import type { IAccountingObject } from '@/shared/types';

vi.mock('@/api/collections', () => ({
  createAccountingObject: vi
    .fn()
    .mockResolvedValue({ id: 'new1', organization_id: 'org1', name: 'Новый объект' }),
  updateAccountingObject: vi.fn().mockResolvedValue({}),
  deleteAccountingObject: vi.fn().mockResolvedValue({}),
}));

const objects: IAccountingObject[] = [
  { id: 'obj1', organization_id: 'org1', name: 'Объект А' },
  { id: 'obj2', organization_id: 'org1', name: 'Объект Б' },
];

function renderManager(canEdit: boolean, objectsArg?: IAccountingObject[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <AccountingObjectManager
          organizationId="org1"
          objects={objectsArg ?? objects}
          canEdit={canEdit}
        />
      </MantineProvider>
    </QueryClientProvider>,
  );
}

const visibilitySwitch = (name: string) => screen.getByRole('switch', { name: `Показывать в реестре: ${name}` });

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

    await user.click(screen.getByRole('button', { name: 'Редактировать «Объект А»' }));

    await waitFor(() => {
      const inputs = screen.getAllByRole('textbox');
      expect(inputs.length).toBeGreaterThanOrEqual(2);
    });
    expect(screen.getByDisplayValue('Объект А')).toBeInTheDocument();
  });

  it('shows visibility switch checked for objects without is_active flag', () => {
    renderManager(true);

    expect(visibilitySwitch('Объект А')).toBeChecked();
    expect(visibilitySwitch('Объект Б')).toBeChecked();
  });

  it('hides visibility switch for non-editing users', () => {
    renderManager(false);

    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('unchecks the switch for an object hidden from the registry', () => {
    renderManager(true, [
      { id: 'obj1', organization_id: 'org1', name: 'Объект А' },
      { id: 'obj2', organization_id: 'org1', name: 'Скрытый объект', is_active: false },
    ]);

    expect(visibilitySwitch('Объект А')).toBeChecked();
    expect(visibilitySwitch('Скрытый объект')).not.toBeChecked();
  });

  it('hides an object from the registry on switch off', async () => {
    const user = userEvent.setup();
    const { updateAccountingObject } = await import('@/api/collections');
    renderManager(true);

    await user.click(visibilitySwitch('Объект А'));

    await waitFor(() => {
      expect(updateAccountingObject).toHaveBeenCalledWith('obj1', 'Объект А', false);
    });
  });

  it('returns a hidden object to the registry on switch on', async () => {
    const user = userEvent.setup();
    const { updateAccountingObject } = await import('@/api/collections');
    renderManager(true, [
      { id: 'obj1', organization_id: 'org1', name: 'Скрытый объект', is_active: false },
    ]);

    await user.click(visibilitySwitch('Скрытый объект'));

    await waitFor(() => {
      expect(updateAccountingObject).toHaveBeenCalledWith('obj1', 'Скрытый объект', true);
    });
  });
});
