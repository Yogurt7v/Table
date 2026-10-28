import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '@/mocks/test-utils';
import { SearchProvider } from '@/shared/context/SearchContext';
import { adminUser, org1, org2, orgUserAdmin } from '@/mocks/seed';
import { AppLayout } from './AppLayout';
import type { IOrganizationUser } from '@/shared/types';

/**
 * `AppLayout` — единственное место, где смонтированы сразу ДВА `NotificationsBell`:
 * мобильный блок (`hiddenFrom="sm"`) и десктопный (`visibleFrom="sm"`). Обе копии
 * остаются в DOM — `hiddenFrom`/`visibleFrom` из Mantine это только CSS, а не
 * размонтирование. Дублирование намеренное и нагруженное смыслом (обе копии
 * шлют запрос за уведомлениями), поэтому тест фиксирует «ровно две», а не «одну».
 */

const mockAuth = vi.hoisted(() => ({
  user: { id: 'admin1', login: 'admin' } as Record<string, unknown> | null,
  logout: vi.fn(),
}));

const mockOrg = vi.hoisted(() => ({
  currentOrgId: 'org1',
  setCurrentOrgId: vi.fn(),
}));

const mockOrgUsers = vi.hoisted(() => ({ data: [] as IOrganizationUser[] | undefined }));

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/shared/context/AuthContext', () => ({
  useAuth: () => ({
    user: mockAuth.user,
    isAuthenticated: !!mockAuth.user,
    isLoading: false,
    login: vi.fn(),
    logout: mockAuth.logout,
  }),
}));

vi.mock('@/shared/context/OrgContext', () => ({
  useOrg: () => ({
    currentOrgId: mockOrg.currentOrgId,
    setCurrentOrgId: mockOrg.setCurrentOrgId,
    currentOrg: [org1, org2].find((o) => o.id === mockOrg.currentOrgId),
    organizations: [org1, org2],
    organizationsLoading: false,
  }),
}));

// `useCurrentUserRole` и `useMailPermissions` остаются настоящими: роль
// вычисляется ими из той же фикстуры `organization_users`, что и в проде.
vi.mock('@/shared/hooks/useOrganizationUsers', () => ({
  useOrganizationUsers: () => ({ data: mockOrgUsers.data }),
}));

vi.mock('@/features/notifications/NotificationsBell', () => ({
  NotificationsBell: () => <div data-testid="notifications-bell" />,
}));

vi.mock('@/features/invoices/InvoiceSearch', () => ({
  InvoiceSearch: () => <div data-testid="invoice-search" />,
}));

vi.mock('@/shared/components/MainDatePicker', () => ({
  MainDatePicker: () => <div data-testid="main-date-picker" />,
}));

function membership(role: IOrganizationUser['role']): IOrganizationUser {
  return { ...orgUserAdmin, role, user_id: adminUser.id, organization_id: org1.id };
}

let scrollY = 0;
const scrollToSpy = vi.fn();

beforeEach(() => {
  mockAuth.user = { ...adminUser };
  mockOrg.currentOrgId = org1.id;
  mockOrgUsers.data = [membership('admin')];
  mockNavigate.mockClear();
  mockOrg.setCurrentOrgId.mockClear();
  mockAuth.logout.mockClear();
  scrollToSpy.mockClear();
  scrollY = 0;
  // jsdom не верстает страницу, поэтому `scrollY` — всегда 0 и не Assignable.
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    get: () => scrollY,
  });
  window.scrollTo = scrollToSpy;
});

afterEach(() => {
  document.body.style.removeProperty('--org-color');
});

function renderLayout(initialPath = '/') {
  return renderWithProviders(
    <SearchProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<div>Контент главной</div>} />
          <Route path="/mail" element={<div>Контент почты</div>} />
          <Route path="/admin" element={<div>Контент админки</div>} />
        </Route>
      </Routes>
    </SearchProvider>,
    { initialEntries: [initialPath] },
  );
}

function scrollTo(offset: number) {
  scrollY = offset;
  fireEvent.scroll(window);
}

describe('AppLayout', () => {
  describe('Колокольчик уведомлений', () => {
    it('монтирует две копии NotificationsBell одновременно — мобильную и десктопную', () => {
      renderLayout();

      expect(screen.getAllByTestId('notifications-bell')).toHaveLength(2);
    });

    it('монтирует обе копии и для роли moderator', () => {
      mockOrgUsers.data = [membership('moderator')];

      renderLayout();

      expect(screen.getAllByTestId('notifications-bell')).toHaveLength(2);
    });

    it('монтирует обе копии и для роли user', () => {
      mockOrgUsers.data = [membership('user')];

      renderLayout();

      expect(screen.getAllByTestId('notifications-bell')).toHaveLength(2);
    });

    it('не монтирует колокольчик, пока не выбрана организация', () => {
      mockOrg.currentOrgId = '';

      renderLayout();

      expect(screen.queryAllByTestId('notifications-bell')).toHaveLength(0);
    });
  });

  describe('Выход из аккаунта', () => {
    it('десктопная ссылка «Выйти» уводит на /login с заменой истории', async () => {
      const user = userEvent.setup();
      renderLayout();

      await user.click(screen.getByText('Выйти'));

      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
    });

    it('мобильная кнопка «Выйти» уводит на /login с заменой истории', async () => {
      const user = userEvent.setup();
      renderLayout();

      await user.click(screen.getByLabelText('Выйти'));

      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
    });

    it('сначала сбрасывает сессию, и только потом уходит на /login', async () => {
      const user = userEvent.setup();
      const order: string[] = [];
      mockAuth.logout.mockImplementation(() => order.push('logout'));
      mockNavigate.mockImplementation(() => order.push('navigate'));

      renderLayout();

      await user.click(screen.getByText('Выйти'));

      expect(order).toEqual(['logout', 'navigate']);
      expect(mockAuth.logout).toHaveBeenCalledOnce();
    });
  });

  describe('Переключение организации', () => {
    it('передаёт выбранную организацию в setCurrentOrgId', async () => {
      const user = userEvent.setup();
      renderLayout();

      await user.click(screen.getAllByPlaceholderText('Выберите организацию')[0]!);
      await user.click(await screen.findByRole('option', { name: org2.name }));

      expect(mockOrg.setCurrentOrgId).toHaveBeenCalledWith(org2.id);
    });

    it('красит рамку шапки в цвет текущей организации через --org-color', async () => {
      renderLayout();

      await waitFor(() => {
        expect(document.body.style.getPropertyValue('--org-color')).toBe(org1.color);
      });
    });

    it('перекрашивает --org-color при смене текущей организации', () => {
      mockOrg.currentOrgId = org2.id;

      renderLayout();

      expect(document.body.style.getPropertyValue('--org-color')).toBe(org2.color);
    });
  });

  describe('Прокрутка страницы', () => {
    it('до 200px подпись кнопки остаётся «На главную»', () => {
      renderLayout();

      scrollTo(120);

      expect(screen.getAllByRole('button', { name: 'На главную' })).toHaveLength(2);
      expect(screen.queryByRole('button', { name: 'Наверх' })).not.toBeInTheDocument();
    });

    it('после 200px кнопка превращается в «Наверх»', () => {
      renderLayout();

      scrollTo(400);

      expect(screen.getAllByRole('button', { name: 'Наверх' })).toHaveLength(2);
      expect(screen.queryByRole('button', { name: 'На главную' })).not.toBeInTheDocument();
    });

    it('возвращает «На главную» при обратной прокрутке к нулю', () => {
      renderLayout();

      scrollTo(400);
      scrollTo(0);

      expect(screen.getAllByRole('button', { name: 'На главную' })).toHaveLength(2);
    });

    it('на /mail подпись не меняется даже после глубокой прокрутки', () => {
      renderLayout('/mail');

      scrollTo(900);

      expect(screen.getAllByRole('button', { name: 'На главную' })).toHaveLength(2);
      expect(screen.queryByRole('button', { name: 'Наверх' })).not.toBeInTheDocument();
    });

    it('клик по «Наверх» на главной прокручивает вверх, а не меняет маршрут', async () => {
      const user = userEvent.setup();
      renderLayout();

      scrollTo(400);
      await user.click(screen.getAllByRole('button', { name: 'Наверх' })[0]!);

      expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('клик по «На главную» вне главной ведёт на /', async () => {
      const user = userEvent.setup();
      renderLayout('/mail');

      await user.click(screen.getAllByRole('button', { name: 'На главную' })[0]!);

      expect(mockNavigate).toHaveBeenCalledWith('/');
      expect(scrollToSpy).not.toHaveBeenCalled();
    });
  });

  describe('Прочие элементы шапки', () => {
    it('показывает оба входа в админку и уводит в /admin', async () => {
      const user = userEvent.setup();
      renderLayout();

      // Мобильная кнопка-иконка и десктопная ссылка рендерятся одновременно.
      expect(screen.getByRole('button', { name: 'Панель администратора' })).toBeInTheDocument();
      await user.click(screen.getByText('Панель администратора'));

      expect(mockNavigate).toHaveBeenCalledWith('/admin');
    });

    it('прячет вход в админку от роли guest', () => {
      mockOrgUsers.data = [membership('guest')];

      renderLayout();

      expect(
        screen.queryByRole('button', { name: 'Панель администратора' }),
      ).not.toBeInTheDocument();
      expect(screen.queryByText('Панель администратора')).not.toBeInTheDocument();
    });

    it('подставляет имя пользователя в шапку', () => {
      renderLayout();

      expect(screen.getAllByText(adminUser.name).length).toBeGreaterThan(0);
    });

    it('показывает поиск на главной и прячет на /mail', () => {
      const { unmount } = renderLayout();

      expect(screen.getAllByTestId('invoice-search')).toHaveLength(2);
      unmount();

      renderLayout('/mail');

      expect(screen.queryAllByTestId('invoice-search')).toHaveLength(0);
    });

    it('рендерит содержимое маршрута из Outlet', () => {
      renderLayout('/admin');

      expect(screen.getByText('Контент админки')).toBeInTheDocument();
    });
  });
});
