import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/mocks/test-utils';
import { DeleteOrgModal } from './DeleteOrgModal';

describe('DeleteOrgModal', () => {
  it('renders real deletion counters', () => {
    renderWithProviders(
      <DeleteOrgModal
        opened
        orgName="ООО Альфа"
        isPending={false}
        stats={{ invoicesCount: 12, objectsCount: 3, accountsCount: 2, membersCount: 5 }}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );

    expect(screen.getByText('12 счетов')).toBeInTheDocument();
    expect(screen.getByText('3 объекта учёта')).toBeInTheDocument();
    expect(screen.getByText('2 банковских счёта')).toBeInTheDocument();
    expect(screen.getByText(/5 участников/)).toBeInTheDocument();
  });

  it('shows singular forms for counts of one', () => {
    renderWithProviders(
      <DeleteOrgModal
        opened
        orgName="ООО Бета"
        isPending={false}
        stats={{ invoicesCount: 1, objectsCount: 1, accountsCount: 1, membersCount: 1 }}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );

    expect(screen.getByText('1 счёт')).toBeInTheDocument();
    expect(screen.getByText('1 объект учёта')).toBeInTheDocument();
    expect(screen.getByText(/1 участник/)).toBeInTheDocument();
  });

  it('requires the confirmation phrase before enabling delete', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    renderWithProviders(
      <DeleteOrgModal opened orgName="ООО" isPending={false} onClose={() => {}} onConfirm={onConfirm} />,
    );

    const deleteButton = screen.getByRole('button', { name: 'Удалить' });
    expect(deleteButton).toBeDisabled();

    await user.type(screen.getByLabelText('Подтверждающая фраза'), 'я осознаю последствия');
    await user.click(deleteButton);

    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
