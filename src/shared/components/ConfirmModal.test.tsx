import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/mocks/test-utils';
import { ConfirmModal } from './ConfirmModal';

describe('ConfirmModal', () => {
  it('renders with title and message', () => {
    renderWithProviders(
      <ConfirmModal
        opened
        onClose={() => {}}
        onConfirm={() => {}}
        title="Удаление"
        message="Вы уверены?"
      />,
    );

    expect(screen.getByText('Удаление')).toBeInTheDocument();
    expect(screen.getByText('Вы уверены?')).toBeInTheDocument();
  });

  it('calls onConfirm when confirm clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    renderWithProviders(
      <ConfirmModal
        opened
        onClose={() => {}}
        onConfirm={onConfirm}
        title="Удаление"
        message="Вы уверены?"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Удалить' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onClose when cancel clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderWithProviders(
      <ConfirmModal
        opened
        onClose={onClose}
        onConfirm={() => {}}
        title="Удаление"
        message="Вы уверены?"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
