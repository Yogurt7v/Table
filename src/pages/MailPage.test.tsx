import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MailPage } from './MailPage';

const mockUseOrg = vi.hoisted(() => vi.fn());
const mockUseMailPermissions = vi.hoisted(() => vi.fn());
const mockUseOrganizationUsers = vi.hoisted(() => vi.fn());

vi.mock('@/shared/context/OrgContext', () => ({
  useOrg: mockUseOrg,
}));

vi.mock('@/shared/hooks/useMailPermissions', () => ({
  useMailPermissions: mockUseMailPermissions,
}));

vi.mock('@/shared/hooks/useOrganizationUsers', () => ({
  useOrganizationUsers: mockUseOrganizationUsers,
}));

vi.mock('@/features/mail/MailSection', () => ({
  MailSection: () => <div data-testid="mail-section" />,
}));

interface SetupOptions {
  currentOrgId?: string | null;
  organizationsLoading?: boolean;
  canView?: boolean;
  orgUsersLoading?: boolean;
}

function setup({
  currentOrgId = 'org1',
  organizationsLoading = false,
  canView = true,
  orgUsersLoading = false,
}: SetupOptions = {}) {
  mockUseOrg.mockReturnValue({
    currentOrgId,
    currentOrg: currentOrgId ? { id: currentOrgId, name: 'Test Org' } : null,
    organizations: [],
    organizationsLoading,
  });
  mockUseMailPermissions.mockReturnValue({
    canView,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    isLoading: false,
  });
  mockUseOrganizationUsers.mockReturnValue({ data: [], isLoading: orgUsersLoading });

  return render(
    <MantineProvider>
      <MailPage />
    </MantineProvider>,
  );
}

describe('MailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('показывает Loader при загрузке организаций', () => {
    setup({ currentOrgId: null, organizationsLoading: true });
    // У Mantine Loader нет роли status — проверяем по классу
    expect(document.querySelector('.mantine-Loader-root')).not.toBeNull();
  });

  it('показывает Loader при загрузке списка пользователей организации', () => {
    setup({ canView: false, orgUsersLoading: true });
    expect(document.querySelector('.mantine-Loader-root')).not.toBeNull();
  });

  it('возвращает null при отсутствии прав', () => {
    setup({ canView: false });
    // MantineProvider вставляет <style> в контейнер, поэтому проверяем отсутствие контента
    expect(screen.queryByTestId('mail-section')).not.toBeInTheDocument();
    expect(document.querySelector('.mantine-Loader-root')).toBeNull();
  });

  it('рендерит MailSection при наличии прав', () => {
    setup();
    expect(screen.getByTestId('mail-section')).toBeInTheDocument();
  });
});
