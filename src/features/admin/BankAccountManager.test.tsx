import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';

import { renderWithProviders } from '@/mocks/test-utils';
import { BankAccountManager } from './BankAccountManager';
import { bankAcc1, bankAcc2 } from '@/mocks/seed';

vi.mock('@/api/client');

describe('BankAccountManager', () => {
  it('renders account list', () => {
    renderWithProviders(
      <BankAccountManager organizationId="org1" accounts={[bankAcc1, bankAcc2]} />,
    );

    expect(screen.getByText('Расчётные счета')).toBeInTheDocument();
    expect(screen.getByText('4070281012345')).toBeInTheDocument();
    expect(screen.getByText('4070281098765')).toBeInTheDocument();
  });

  it('shows add input for new accounts', () => {
    renderWithProviders(
      <BankAccountManager organizationId="org1" accounts={[bankAcc1]} />,
    );

    expect(screen.getByPlaceholderText('Название счёта')).toBeInTheDocument();
    expect(screen.getByText('Добавить')).toBeInTheDocument();
  });
});
