import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider, useMantineTheme } from '@mantine/core';
import { OrgPrimaryProvider } from './OrgPrimaryProvider';

const mockUseOrg = vi.hoisted(() => vi.fn());

vi.mock('@/shared/context/OrgContext', () => ({
  useOrg: mockUseOrg,
}));

function ThemeProbe() {
  const theme = useMantineTheme();
  return <div data-testid="primary-color">{theme.primaryColor}</div>;
}

function renderWithOrg(org: { id: string; name: string; color: string } | null) {
  mockUseOrg.mockReturnValue({
    currentOrg: org,
    currentOrgId: org?.id ?? null,
    organizations: [],
    organizationsLoading: false,
  });

  return render(
    <MantineProvider>
      <OrgPrimaryProvider>
        <div data-testid="child">content</div>
        <ThemeProbe />
      </OrgPrimaryProvider>
    </MantineProvider>,
  );
}

describe('OrgPrimaryProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('рендерит детей', () => {
    renderWithOrg(null);
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('без организации primaryColor — синий по умолчанию', () => {
    renderWithOrg(null);
    expect(screen.getByTestId('primary-color')).toHaveTextContent('blue');
  });

  it('цвет организации поднимается до primaryColor темы', () => {
    renderWithOrg({ id: 'org1', name: 'Test Org', color: '#40c057' });
    expect(screen.getByTestId('primary-color')).toHaveTextContent('green');
  });

  it('неизвестный hex откатывается к синему', () => {
    renderWithOrg({ id: 'org1', name: 'Test Org', color: '#ffffff' });
    expect(screen.getByTestId('primary-color')).toHaveTextContent('blue');
  });
});
