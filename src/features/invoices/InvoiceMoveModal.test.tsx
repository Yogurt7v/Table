import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/mocks/test-utils';
import { InvoiceMoveModal } from './InvoiceMoveModal';
import type { IAccountingObject } from '@/shared/types';

vi.mock('@/api/client');

const objects: IAccountingObject[] = [
  { id: 'ao1', organization_id: 'org1', name: 'Основная деятельность' },
  { id: 'ao2', organization_id: 'org1', name: 'Капитальные вложения' },
];

describe('InvoiceMoveModal', () => {
  it('renders with object options excluding current', () => {
    renderWithProviders(
      <InvoiceMoveModal
        opened
        onClose={() => {}}
        objects={objects}
        currentObjectId="ao1"
        onConfirm={() => {}}
      />,
    );

    expect(screen.getByText('Перенести в другой объект')).toBeInTheDocument();
    expect(screen.getByText('Капитальные вложения')).toBeInTheDocument();
  });

  it('confirm button is disabled when no target selected', () => {
    renderWithProviders(
      <InvoiceMoveModal
        opened
        onClose={() => {}}
        objects={objects}
        currentObjectId="ao1"
        onConfirm={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Перенести' })).toBeDisabled();
  });
});
