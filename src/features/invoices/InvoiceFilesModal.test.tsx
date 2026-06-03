import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/mocks/test-utils';
import { InvoiceFilesModal } from './InvoiceFilesModal';
import { resetAuth, setAuthUser } from '@/mocks/mock-pb';
import { adminUser } from '@/mocks/seed';

vi.mock('@/api/client');

describe('InvoiceFilesModal', () => {
  beforeEach(() => {
    resetAuth();
    setAuthUser(adminUser as unknown as Record<string, unknown>);
  });

  it('shows empty state when no files', async () => {
    renderWithProviders(
      <InvoiceFilesModal
        opened
        invoiceId="inv3"
        invoiceLabel="Счёт №3"
        orgId="org1"
        canManageFiles={false}
        onClose={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Файлов нет')).toBeInTheDocument();
    });
  });

  it('shows file upload when canManageFiles is true', () => {
    renderWithProviders(
      <InvoiceFilesModal
        opened
        invoiceId="inv3"
        invoiceLabel="Счёт №3"
        orgId="org1"
        canManageFiles
        onClose={() => {}}
      />,
    );

    expect(screen.getByText('Выберите файл')).toBeInTheDocument();
    expect(screen.getByText('Добавить')).toBeInTheDocument();
  });
});
