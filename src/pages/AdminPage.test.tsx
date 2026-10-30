import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import { renderWithProviders } from '@/mocks/test-utils';
import { defaultSeed, adminUser, userUser, bossUser, org1, org2 } from '@/mocks/seed';
import { AdminPage } from './AdminPage';
import type { IOrganization, IOrganizationUser } from '@/shared/types';

/**
 * `AdminPage` решает три вещи, и ошибка в любой из них бьёт по правам:
 * какая вкладка открыта (из `?tab=`), кому вообще показывать панель
 * (`currentOrgId` + роль из `useCurrentUserRole`) и какие вкладки почтового
 * архива доступны (`useMailPermissions`, а не строка роли).
 *
 * `@/api/collections` и все хуки остаются настоящими — заглушка стоит ровно на
 * границе `pb`, поэтому проверяются настоящие тела запросов и коллекции.
 * `useCurrentUserRole`/`useMailPermissions` тоже настоящие: они читают ту же
 * фикстуру `organization_users`, что и проде, — иначе гейт был бы проверен на
 * подменённом входе.
 */

type Payload = Record<string, unknown>;

interface PbCall {
  collection: string;
  method: string;
  args: unknown[];
}

const pbState = vi.hoisted(() => ({
  data: {} as Record<string, unknown[]>,
  calls: [] as PbCall[],
  failing: new Set<string>(),
  gate: undefined as undefined | { promise: Promise<void>; release: () => void },
}));

vi.mock('@/api/client', () => ({
  pb: {
    authStore: {
      model: null,
      token: '',
      isValid: true,
      onChange: () => () => {},
      clear: () => {},
      save: () => {},
    },
    files: { getUrl: () => '/mock-file.pdf' },
    collection: (name: string) => ({
      getFullList: async (options?: { filter?: string }) => {
        pbState.calls.push({ collection: name, method: 'getFullList', args: [options] });
        if (pbState.failing.has(name)) throw new Error(`Коллекция ${name} недоступна`);
        if (pbState.gate && name === 'organization_users') await pbState.gate.promise;
        const rows = pbState.data[name] ?? [];
        const orgFilter = /organization_id\s*=\s*"([^"]+)"/.exec(options?.filter ?? '');
        return orgFilter
          ? rows.filter(
              (row) => (row as { organization_id?: string }).organization_id === orgFilter[1],
            )
          : rows;
      },
      getList: async (page = 1, perPage = 50, options?: { filter?: string }) => {
        pbState.calls.push({ collection: name, method: 'getList', args: [page, perPage, options] });
        if (pbState.failing.has(name)) throw new Error(`Коллекция ${name} недоступна`);
        const rows = pbState.data[name] ?? [];
        const orgFilter = /organization_id\s*=\s*"([^"]+)"/.exec(options?.filter ?? '');
        const items = orgFilter
          ? rows.filter(
              (row) => (row as { organization_id?: string }).organization_id === orgFilter[1],
            )
          : rows;
        return { page, perPage, items, totalItems: items.length, totalPages: 1 };
      },
      getOne: async (id: string) => ({ id }),
      getFirstListItem: async () => null,
      create: async (body: Payload) => {
        pbState.calls.push({ collection: name, method: 'create', args: [body] });
        const sameCollection = pbState.calls.filter(
          (call) => call.collection === name && call.method === 'create',
        ).length;
        return { id: `${name}_new_${sameCollection}`, ...body };
      },
      update: async (id: string, body: Payload) => {
        pbState.calls.push({ collection: name, method: 'update', args: [id, body] });
        return { id, ...body };
      },
      delete: async (id: string) => {
        pbState.calls.push({ collection: name, method: 'delete', args: [id] });
        return true;
      },
      subscribe: () => Promise.resolve(() => {}),
      unsubscribe: () => {},
      authRefresh: () => Promise.resolve({}),
    }),
  },
}));

const mockUseOrg = vi.hoisted(() => vi.fn());
const mockUseAuth = vi.hoisted(() => vi.fn());

vi.mock('@/shared/context/OrgContext', () => ({ useOrg: mockUseOrg }));
vi.mock('@/shared/context/AuthContext', () => ({ useAuth: mockUseAuth }));

// Обе панели архива утапливаются в заглушки: у них четыре `useMail`-хука и
// realtime-подписка PocketBase, и к логике `AdminPage` они отношения не имеют.
// Заглушка прозрачна — она печатает ровно те пропсы, которые страница передала.
vi.mock('@/features/admin/DeletedInvoicesSection', () => ({
  DeletedInvoicesSection: ({
    orgId,
    highlightInvoiceId,
    onHighlightConsumed,
  }: {
    orgId: string;
    highlightInvoiceId?: string | null;
    onHighlightConsumed?: () => void;
  }) => (
    <div data-testid="deleted-invoices-section">
      <span data-testid="archive-org-id">{orgId}</span>
      <span data-testid="archive-highlight">{highlightInvoiceId ?? 'нет'}</span>
      {onHighlightConsumed && (
        <button type="button" onClick={onHighlightConsumed}>
          Снять подсветку
        </button>
      )}
    </div>
  ),
}));

vi.mock('@/features/admin/DeletedMailsSection', () => ({
  DeletedMailsSection: ({ orgId }: { orgId: string }) => (
    <div data-testid="deleted-mails-section">
      <span data-testid="mail-archive-org-id">{orgId}</span>
    </div>
  ),
}));

function callArgs(collection: string, method: string) {
  return pbState.calls.filter((c) => c.collection === collection && c.method === method);
}

function countReads(collection: string) {
  return callArgs(collection, 'getFullList').length;
}

/** Админ с правом почтового архива: `can_delete_incoming_mails` включает `canViewArchive`. */
const adminWithMailArchive: IOrganizationUser = {
  id: 'ou1',
  user_id: adminUser.id,
  organization_id: org1.id,
  role: 'admin',
  can_delete_incoming_mails: true,
};

const adminWithoutMailRights: IOrganizationUser = {
  id: 'ou1',
  user_id: adminUser.id,
  organization_id: org1.id,
  role: 'admin',
};

const plainUser: IOrganizationUser = {
  id: 'ou2',
  user_id: userUser.id,
  organization_id: org1.id,
  role: 'user',
};

function member(
  overrides: Partial<IOrganizationUser> & Pick<IOrganizationUser, 'id' | 'user_id' | 'role'>,
): IOrganizationUser {
  return { organization_id: org1.id, ...overrides };
}

function LocationProbe() {
  const { search } = useLocation();
  return <div data-testid="location-search">{search}</div>;
}

const ORGANIZATIONS = defaultSeed.organizations as IOrganization[];

function renderPage(initialEntry = '/admin') {
  renderWithProviders(
    <>
      <AdminPage />
      <LocationProbe />
    </>,
    { initialEntries: [initialEntry] },
  );
}

function search() {
  return screen.getByTestId('location-search').textContent;
}

beforeEach(() => {
  pbState.calls = [];
  pbState.failing = new Set();
  pbState.gate = undefined;
  pbState.data = {
    organizations: ORGANIZATIONS,
    bank_accounts: defaultSeed.bank_accounts,
    accounting_objects: defaultSeed.accounting_objects,
    invoices: [...defaultSeed.invoices, { id: 'inv9', organization_id: org2.id }],
    users: defaultSeed.users,
    organization_users: [adminWithMailArchive, plainUser],
  };

  mockUseOrg.mockReturnValue({
    currentOrgId: org1.id,
    setCurrentOrgId: vi.fn(),
    currentOrg: org1,
    organizations: ORGANIZATIONS,
    organizationsLoading: false,
  });
  mockUseAuth.mockReturnValue({
    user: adminUser,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  });
});

describe('AdminPage', () => {
  describe('Вкладка открывается из адреса', () => {
    it('без параметра tab открывает вкладку «Организации»', async () => {
      renderPage();

      await screen.findByRole('heading', { name: 'Администрирование', level: 3 });
      expect(screen.getByRole('tab', { name: 'Организации' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(search()).toBe('');
    });

    it('?tab=users открывает вкладку «Пользователи»', async () => {
      renderPage('/admin?tab=users');

      await screen.findByRole('heading', { name: 'Администрирование', level: 3 });
      expect(screen.getByRole('tab', { name: 'Пользователи' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(screen.getByRole('tab', { name: 'Организации' })).toHaveAttribute(
        'aria-selected',
        'false',
      );
    });

    it('?tab=archive открывает вкладку «Архив счетов» и передаёт туда highlight', async () => {
      renderPage('/admin?tab=archive&highlight=del-1');

      await screen.findByRole('heading', { name: 'Администрирование', level: 3 });
      expect(screen.getByRole('tab', { name: 'Архив счетов' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(screen.getByTestId('archive-org-id')).toHaveTextContent(org1.id);
      expect(screen.getByTestId('archive-highlight')).toHaveTextContent('del-1');
    });

    it('без highlight подсветка не передаётся в архив счетов', async () => {
      renderPage('/admin?tab=archive');

      await screen.findByRole('heading', { name: 'Администрирование', level: 3 });
      expect(screen.getByTestId('archive-highlight')).toHaveTextContent('нет');
    });

    it('переключение вкладки пишет tab в адрес, а не просто перерисовывает панель', async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByRole('heading', { name: 'Администрирование', level: 3 });
      await user.click(screen.getByRole('tab', { name: 'Пользователи' }));

      await waitFor(() => expect(search()).toBe('?tab=users'));

      await user.click(screen.getByRole('tab', { name: 'Архив счетов' }));
      await waitFor(() => expect(search()).toBe('?tab=archive'));

      await user.click(screen.getByRole('tab', { name: 'Организации' }));
      await waitFor(() => expect(search()).toBe('?tab=organizations'));
    });

    it('переключение вкладки не теряет параметр highlight', async () => {
      const user = userEvent.setup();
      renderPage('/admin?tab=archive&highlight=del-9');

      await screen.findByRole('heading', { name: 'Администрирование', level: 3 });
      await user.click(screen.getByRole('tab', { name: 'Организации' }));

      await waitFor(() => expect(search()).toBe('?tab=organizations&highlight=del-9'));
    });

    it('ПОСЛЕ: неизвестный tab оставляет все панели скрытыми — страница без содержимого', async () => {
      renderPage('/admin?tab=bogus');

      await screen.findByRole('heading', { name: 'Администрирование', level: 3 });
      const tabs = screen.getAllByRole('tab');
      expect(tabs.every((tab) => tab.getAttribute('aria-selected') === 'false')).toBe(true);
      expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();
    });
  });

  describe('Гейт по роли', () => {
    it('admin видит панель администрирования', async () => {
      renderPage();

      expect(await screen.findByRole('heading', { name: 'Администрирование', level: 3 })).toBeInTheDocument();
      expect(screen.queryByText('Доступ запрещён')).not.toBeInTheDocument();
    });

    it('moderator тоже проходит гейт — порог это admin или moderator', async () => {
      pbState.data.organization_users = [
        member({ id: 'ou1', user_id: adminUser.id, role: 'moderator' }),
      ];

      renderPage();

      expect(await screen.findByRole('heading', { name: 'Администрирование', level: 3 })).toBeInTheDocument();
    });

    it('boss не проходит гейт', async () => {
      pbState.data.organization_users = [
        member({ id: 'ou1', user_id: adminUser.id, role: 'boss' }),
      ];

      renderPage();

      expect(await screen.findByText('Доступ запрещён')).toBeInTheDocument();
      expect(screen.getByText('У вас нет прав для просмотра этой страницы.')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Администрирование', level: 3 })).not.toBeInTheDocument();
      expect(screen.queryAllByRole('tab')).toHaveLength(0);
    });

    it('guest не проходит гейт', async () => {
      pbState.data.organization_users = [
        member({ id: 'ou1', user_id: adminUser.id, role: 'guest' }),
      ];

      renderPage();

      expect(await screen.findByText('Доступ запрещён')).toBeInTheDocument();
    });

    it('пользователь без членства в организации не проходит гейт', async () => {
      pbState.data.organization_users = [plainUser];

      renderPage();

      expect(await screen.findByText('Доступ запрещён')).toBeInTheDocument();
    });

    it('если организация не выбрана, гейт не применяется и страница открывается', async () => {
      mockUseOrg.mockReturnValue({
        currentOrgId: '',
        setCurrentOrgId: vi.fn(),
        currentOrg: undefined,
        organizations: ORGANIZATIONS,
        organizationsLoading: false,
      });

      renderPage();

      expect(await screen.findByRole('heading', { name: 'Администрирование', level: 3 })).toBeInTheDocument();
      expect(screen.queryByTestId('deleted-invoices-section')).not.toBeInTheDocument();
    });
  });

  describe('Неизвестные права: загрузка и сбой', () => {
    it('ПОКА СПИСОК УЧАСТНИКОВ НЕ ПРИШЁЛ — страница показывает отказ, а не пустую панель', async () => {
      let release!: () => void;
      const promise = new Promise<void>((resolve) => {
        release = resolve;
      });
      pbState.gate = { promise, release };

      renderPage();

      expect(await screen.findByText('Доступ запрещён')).toBeInTheDocument();

      release();

      expect(await screen.findByRole('heading', { name: 'Администрирование', level: 3 })).toBeInTheDocument();
      expect(screen.queryByText('Доступ запрещён')).not.toBeInTheDocument();
    });

    it('ПОСЛЕ: если список участников не загрузился, admin тоже видит отказ', async () => {
      pbState.failing = new Set(['organization_users']);

      renderPage();

      expect(await screen.findByText('Доступ запрещён')).toBeInTheDocument();
      await waitFor(() =>
        expect(callArgs('organization_users', 'getFullList').length).toBeGreaterThan(0),
      );
    });

    it('пока права неизвестны, вкладки «Архив писем» нет — и появляется вместе с правами', async () => {
      let release!: () => void;
      const promise = new Promise<void>((resolve) => {
        release = resolve;
      });
      pbState.gate = { promise, release };

      renderPage();

      expect(await screen.findByText('Доступ запрещён')).toBeInTheDocument();

      release();

      await screen.findByRole('heading', { name: 'Администрирование', level: 3 });
      expect(screen.getByRole('tab', { name: 'Архив писем' })).toBeInTheDocument();
    });
  });

  describe('Вкладка почтового архива', () => {
    it('без canViewArchive вкладки «Архив писем» нет в списке', async () => {
      pbState.data.organization_users = [adminWithoutMailRights];

      renderPage();

      await screen.findByRole('heading', { name: 'Администрирование', level: 3 });
      expect(screen.queryByRole('tab', { name: 'Архив писем' })).not.toBeInTheDocument();
    });

    it('?tab=mail-archive без прав откатывается на «Организации»', async () => {
      pbState.data.organization_users = [adminWithoutMailRights];

      renderPage('/admin?tab=mail-archive');

      await screen.findByRole('heading', { name: 'Администрирование', level: 3 });
      expect(screen.getByRole('tab', { name: 'Организации' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });

    it('с canViewArchive вкладка открывается и получает текущую организацию', async () => {
      renderPage('/admin?tab=mail-archive');

      await screen.findByRole('heading', { name: 'Администрирование', level: 3 });
      expect(screen.getByRole('tab', { name: 'Архив писем' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(screen.getByTestId('mail-archive-org-id')).toHaveTextContent(org1.id);
    });

    it('гейт вкладки берёт флаг, а не роль: admin без can_delete_incoming_mails её не видит', async () => {
      pbState.data.organization_users = [adminWithoutMailRights];

      renderPage();

      await screen.findByRole('heading', { name: 'Администрирование', level: 3 });
      expect(screen.getByRole('tab', { name: 'Архив счетов' })).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: 'Архив писем' })).not.toBeInTheDocument();
    });
  });

  describe('Удаление пользователя', () => {
    async function openDeleteDialog(user: typeof userUser | typeof bossUser) {
      const actor = userEvent.setup();
      renderPage('/admin?tab=users');
      await screen.findByRole('heading', { name: 'Администрирование', level: 3 });
      await actor.click(screen.getByRole('button', { name: `Удалить пользователя ${user.name}` }));
      return actor;
    }

    it('вызывает удаление с id пользователя в коллекции users', async () => {
      const actor = await openDeleteDialog(userUser);

      const dialog = await screen.findByRole('dialog', { name: 'Удаление пользователя' });
      expect(
        within(dialog).getByText(/Вы уверены, что хотите удалить пользователя/),
      ).toHaveTextContent('«Пользователь»');

      await actor.click(within(dialog).getByRole('button', { name: 'Удалить' }));

      await waitFor(() =>
        expect(pbState.calls).toContainEqual({
          collection: 'users',
          method: 'delete',
          args: [userUser.id],
        }),
      );
    });

    it('после успешного удаления перезапрашивает список пользователей', async () => {
      const actor = await openDeleteDialog(userUser);
      const before = countReads('users');
      expect(before).toBeGreaterThan(0);

      const dialog = await screen.findByRole('dialog', { name: 'Удаление пользователя' });
      await actor.click(within(dialog).getByRole('button', { name: 'Удалить' }));

      await waitFor(() => expect(countReads('users')).toBeGreaterThan(before));
    });

    it('перечисляет организации, из которых исключают пользователя', async () => {
      await openDeleteDialog(userUser);

      const dialog = await screen.findByRole('dialog', { name: 'Удаление пользователя' });
      expect(dialog).toHaveTextContent(`Будет исключён из организаций: «${org1.name}»`);
      expect(dialog).toHaveTextContent('(пользователь)');
    });

    it('предупреждает, что пользователь — единственный администратор другой организации', async () => {
      pbState.data.organization_users = [
        adminWithMailArchive,
        plainUser,
        member({
          id: 'ou5',
          user_id: userUser.id,
          organization_id: org2.id,
          role: 'admin',
        }),
      ];

      await openDeleteDialog(userUser);

      const dialog = await screen.findByRole('dialog', { name: 'Удаление пользователя' });
      expect(dialog).toHaveTextContent(
        `Внимание: он единственный администратор организации «${org2.name}»`,
      );
    });

    it('для пользователя без членства пишет, что он нигде не состоит', async () => {
      await openDeleteDialog(bossUser);

      const dialog = await screen.findByRole('dialog', { name: 'Удаление пользователя' });
      expect(dialog).toHaveTextContent('Не состоит ни в одной организации.');
    });

    it('admin не может удалить самого себя — кнопки нет', async () => {
      renderPage('/admin?tab=users');

      await screen.findByRole('heading', { name: 'Администрирование', level: 3 });
      expect(
        screen.queryByRole('button', { name: `Удалить пользователя ${adminUser.name}` }),
      ).not.toBeInTheDocument();
    });

    it('moderator не может удалять пользователей — может только редактировать', async () => {
      pbState.data.organization_users = [
        member({ id: 'ou1', user_id: adminUser.id, role: 'moderator' }),
      ];

      renderPage('/admin?tab=users');

      await screen.findByRole('heading', { name: 'Администрирование', level: 3 });
      expect(
        screen.getByRole('button', { name: `Редактировать пользователя ${userUser.name}` }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: `Удалить пользователя ${userUser.name}` }),
      ).not.toBeInTheDocument();
    });

    it('кнопка «Добавить пользователя» открывает модалку создания', async () => {
      const actor = userEvent.setup();
      renderPage('/admin?tab=users');

      await screen.findByRole('heading', { name: 'Администрирование', level: 3 });
      await actor.click(screen.getByRole('button', { name: 'Добавить пользователя' }));

      expect(
        await screen.findByRole('dialog', { name: 'Добавить пользователя' }),
      ).toBeInTheDocument();
    });

    it('редактирование пользователя открывает модалку с его именем', async () => {
      const actor = userEvent.setup();
      renderPage('/admin?tab=users');

      await screen.findByRole('heading', { name: 'Администрирование', level: 3 });
      await actor.click(
        screen.getByRole('button', { name: `Редактировать пользователя ${userUser.name}` }),
      );

      expect(
        await screen.findByRole('dialog', { name: `Редактировать пользователя ${userUser.name}` }),
      ).toBeInTheDocument();
    });
  });

  describe('Создание организации', () => {
    it('создаёт организацию и её расчётные счета с правильными телами запросов', async () => {
      const actor = userEvent.setup();
      renderPage();

      await screen.findByRole('heading', { name: 'Администрирование', level: 3 });
      await actor.click(screen.getByRole('button', { name: 'Добавить организацию' }));

      const dialog = await screen.findByRole('dialog', { name: 'Добавить организацию' });
      await actor.type(
        within(dialog).getByLabelText(/^Название/, { selector: 'input' }),
        'ООО Новая',
      );
      await actor.click(within(dialog).getByLabelText('Цвет', { selector: 'input' }));
      await actor.click(await screen.findByRole('option', { name: 'Красный' }));

      await actor.type(within(dialog).getByPlaceholderText('Название счёта'), '4070281055555');
      await actor.click(within(dialog).getByRole('button', { name: 'Добавить' }));

      await actor.click(within(dialog).getByRole('button', { name: 'Создать' }));

      await waitFor(() =>
        expect(pbState.calls).toContainEqual({
          collection: 'organizations',
          method: 'create',
          args: [{ name: 'ООО Новая', color: '#fa5252' }],
        }),
      );
      await waitFor(() =>
        expect(pbState.calls).toContainEqual({
          collection: 'bank_accounts',
          method: 'create',
          args: [{ organization_id: 'organizations_new_1', account_number: '4070281055555' }],
        }),
      );
    });

    it('пустое название не отправляет запрос', async () => {
      const actor = userEvent.setup();
      renderPage();

      await screen.findByRole('heading', { name: 'Администрирование', level: 3 });
      await actor.click(screen.getByRole('button', { name: 'Добавить организацию' }));

      const dialog = await screen.findByRole('dialog', { name: 'Добавить организацию' });
      expect(within(dialog).getByRole('button', { name: 'Создать' })).toBeDisabled();

      expect(callArgs('organizations', 'create')).toHaveLength(0);
    });
  });

  describe('Редактирование организации', () => {
    async function openEditDialog(orgName: string) {
      const actor = userEvent.setup();
      renderPage();

      await screen.findByRole('heading', { name: 'Администрирование', level: 3 });
      await actor.click(screen.getByRole('button', { name: `Редактировать «${orgName}»` }));
      const dialog = await screen.findByRole('dialog', { name: `Редактирование: ${orgName}` });
      return { actor, dialog };
    }

    it('подставляет счета и объекты именно этой организации', async () => {
      const { dialog } = await openEditDialog(org1.name);

      await waitFor(() => expect(dialog).toHaveTextContent('4070281012345'));
      expect(dialog).toHaveTextContent('4070281098765');
      expect(dialog).not.toHaveTextContent('4070281000001');
      expect(dialog).toHaveTextContent('Основная деятельность');
      expect(dialog).not.toHaveTextContent('Операционная деятельность');
    });

    it('сохраняет переименование и цвет в коллекции organizations', async () => {
      const { actor, dialog } = await openEditDialog(org1.name);

      const nameField = await within(dialog).findByLabelText(/^Название/, { selector: 'input' });
      await actor.clear(nameField);
      await actor.type(nameField, 'ООО Переименовано');

      await actor.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

      await waitFor(() =>
        expect(pbState.calls).toContainEqual({
          collection: 'organizations',
          method: 'update',
          args: [org1.id, { name: 'ООО Переименовано', color: org1.color }],
        }),
      );
    });

    it('не сохраняет имя из одних пробелов', async () => {
      const { actor, dialog } = await openEditDialog(org1.name);

      const nameField = await within(dialog).findByLabelText(/^Название/, { selector: 'input' });
      await actor.clear(nameField);
      await actor.type(nameField, '   ');

      expect(within(dialog).getByRole('button', { name: 'Сохранить' })).toBeDisabled();
      expect(callArgs('organizations', 'update')).toHaveLength(0);
    });

    it('админ своей организации управляет объектами учёта', async () => {
      const { dialog } = await openEditDialog(org1.name);

      await waitFor(() => expect(dialog).toHaveTextContent('4070281012345'));
      expect(
        within(dialog).getByRole('button', { name: 'Редактировать «Основная деятельность»' }),
      ).toBeInTheDocument();
    });

    it('в организации, где у него нет роли, объектами учёта управлять нельзя', async () => {
      // Право берётся из роли в РЕДАКТИРУЕМОЙ организации, а не из текущей.
      const { dialog } = await openEditDialog(org2.name);

      await waitFor(() => expect(dialog).toHaveTextContent('4070281000001'));
      expect(
        within(dialog).queryByRole('button', { name: 'Редактировать «Операционная деятельность»' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('Удаление организации', () => {
    it('показывает счётчики только удаляемой организации', async () => {
      const actor = userEvent.setup();
      renderPage();

      await screen.findByRole('heading', { name: 'Администрирование', level: 3 });
      await actor.click(screen.getByRole('button', { name: `Удалить организацию «${org2.name}»` }));

      const dialog = await screen.findByRole('dialog', {
        name: `Удаление организации «${org2.name}»`,
      });
      await waitFor(() => expect(dialog).toHaveTextContent('1 счёт'));
      expect(dialog).toHaveTextContent('1 объект учёта');
      expect(dialog).toHaveTextContent('1 банковский счёт');
      expect(dialog).toHaveTextContent('0 участников');
    });

    it('счётчик счетов считает счета именно этой организации', async () => {
      const actor = userEvent.setup();
      renderPage();

      await screen.findByRole('heading', { name: 'Администрирование', level: 3 });
      await actor.click(screen.getByRole('button', { name: `Удалить организацию «${org1.name}»` }));

      const dialog = await screen.findByRole('dialog', {
        name: `Удаление организации «${org1.name}»`,
      });
      await waitFor(() => expect(dialog).toHaveTextContent('3 счёта'));
      expect(dialog).toHaveTextContent('2 банковских счёта');
      expect(dialog).toHaveTextContent('2 объекта учёта');
      expect(dialog).toHaveTextContent('2 участника');
    });

    it('удаляет организацию только после подтверждающей фразы', async () => {
      const actor = userEvent.setup();
      renderPage();

      await screen.findByRole('heading', { name: 'Администрирование', level: 3 });
      await actor.click(screen.getByRole('button', { name: `Удалить организацию «${org2.name}»` }));

      const dialog = await screen.findByRole('dialog', {
        name: `Удаление организации «${org2.name}»`,
      });
      const confirmButton = within(dialog).getByRole('button', { name: 'Удалить' });
      expect(confirmButton).toBeDisabled();

      await actor.type(
        within(dialog).getByLabelText('Подтверждающая фраза'),
        'я осознаю последствия',
      );
      await actor.click(confirmButton);

      await waitFor(() =>
        expect(pbState.calls).toContainEqual({
          collection: 'organizations',
          method: 'delete',
          args: [org2.id],
        }),
      );
    });

    it('moderator не видит кнопку удаления организации', async () => {
      pbState.data.organization_users = [
        member({ id: 'ou1', user_id: adminUser.id, role: 'moderator' }),
      ];

      renderPage();

      await screen.findByRole('heading', { name: 'Администрирование', level: 3 });
      expect(
        screen.queryByRole('button', { name: `Удалить организацию «${org2.name}»` }),
      ).not.toBeInTheDocument();
    });
  });

  describe('Параметр highlight', () => {
    it('после обработки подсветки убирает highlight из адреса, сохраняя tab', async () => {
      const actor = userEvent.setup();
      renderPage('/admin?tab=archive&highlight=del-1');

      await screen.findByRole('heading', { name: 'Администрирование', level: 3 });
      expect(search()).toBe('?tab=archive&highlight=del-1');

      await actor.click(screen.getByRole('button', { name: 'Снять подсветку' }));

      await waitFor(() => expect(search()).toBe('?tab=archive'));
    });

    it('не добавляет highlight, которого не было', async () => {
      const actor = userEvent.setup();
      renderPage('/admin?tab=archive');

      await screen.findByRole('heading', { name: 'Администрирование', level: 3 });
      await actor.click(screen.getByRole('tab', { name: 'Пользователи' }));

      await waitFor(() => expect(search()).toBe('?tab=users'));
    });
  });
});
