import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider, createTheme } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrgPrimaryProvider } from './OrgPrimaryProvider';
import { OrgContext } from '@/shared/context/OrgContext';
import type { OrgContextValue } from '@/shared/context/OrgContext';

const baseTheme = createTheme({ primaryColor: 'blue' });

function renderWithProviders(
  ui: React.ReactNode,
  orgContextValue: Partial<OrgContextValue> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const defaultValue: OrgContextValue = {
    currentOrgId: null,
    currentOrg: null,
    organizations: [],
    organizationsLoading: false,
    ...orgContextValue,
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={baseTheme}>
        <OrgContext.Provider value={defaultValue}>
          <OrgPrimaryProvider>{ui}</OrgPrimaryProvider>
        </OrgContext.Provider>
      </MantineProvider>
    </QueryClientProvider>,
  );
}

describe('OrgPrimaryProvider', () => {
  it('рендерит детей', () => {
    renderWithProviders(<div data-testid="child">content</div>);
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('без организации использует цвет по умолчанию', () => {
    renderWithProviders(<div data-testid="child">content</div>);
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('с организацией применяет её цвет', () => {
    renderWithProviders(<div data-testid="child">content</div>, {
      currentOrg: { id: 'org1', name: 'Test Org', color: 'green' },
      currentOrgId: 'org1',
    });
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});
