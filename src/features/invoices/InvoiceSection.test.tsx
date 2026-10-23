import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { renderWithProviders } from '@/mocks/test-utils';
import { server } from '@/mocks/server';
import {
  accObj1,
  accObj2,
  adminUser,
  bossUser,
  guestUser,
  invoice1,
  invoice2,
  invoice3,
  orgUserAdmin,
  orgUserBoss,
  orgUserGuest,
  orgUserUser,
  paymentMark1,
  userUser,
} from '@/mocks/seed';
import { DatePinnedProvider } from '@/shared/context/DatePinnedContext';
import { InvoiceSection } from './InvoiceSection';
import type {
  IAccountingObject,
  IInvoice,
  IOrganizationUser,
  IPaymentMark,
  IUser,
} from '@/shared/types';

const state = vi.hoisted(() => ({
  user: null as IUser | null,
  searchText: '',
  searchAll: false,
}));

vi.mock('@/api/client', async () => {
  const { createMockApiModule } = await import('@/mocks/test-utils');
  const { pb: mockPb } = createMockApiModule();
  const baseCollection = mockPb.collection.bind(mockPb);
  // SDK отдаёт из `subscribe()` промис с `unsubscribe`, а общий хелпер — функцию;
  // без обёртки `usePaymentMarks`/`useSearchInvoices` падают на `sub.then` при размонтировании.
  return {
    pb: {
      ...mockPb,
      collection: (name: string) => ({
        ...baseCollection(name),
        subscribe: () => Promise.resolve(() => {}),
      }),
    },
  };
});

vi.mock('@/shared/context/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/context/AuthContext')>();
  return {
    ...actual,
    useAuth: () => ({
      user: state.user,
      isAuthenticated: !!state.user,
      isLoading: false,
      login: async () => {},
      logout: () => {},
    }),
  };
});

vi.mock('@/shared/context/OrgContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/context/OrgContext')>();
  return {
    ...actual,
    useOrg: () => ({
      currentOrgId: 'org1',
      setCurrentOrgId: () => {},
      currentOrg: { id: 'org1', name: 'ООО "Тест"', color: '#228be6' },
      organizations: [],
      organizationsLoading: false,
    }),
  };
});

vi.mock('@/shared/context/SearchContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/context/SearchContext')>();
  return {
    ...actual,
    useSearch: () => ({
      searchText: state.searchText,
      setSearchText: () => {},
      debouncedSearchText: state.searchText,
      searchAll: state.searchAll,
      setSearchAll: () => {},
    }),
  };
});

vi.mock('@/shared/context/InvoiceNavigationContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/context/InvoiceNavigationContext')>();
  return {
    ...actual,
    useInvoiceNavigation: () => ({
      selectedDate: new Date('2026-06-01'),
      setSelectedDate: () => {},
      highlightedInvoiceId: null,
      highlightRequestId: 0,
      requestHighlight: () => {},
      clearHighlight: () => {},
    }),
  };
});

interface HandlerOptions {
  objects?: IAccountingObject[];
  invoices?: IInvoice[];
  paymentMarks?: IPaymentMark[];
  orgUsers?: IOrganizationUser[];
  savedColumns?: unknown;
}

function recordsUrl(collection: string) {
  return `http://127.0.0.1:8090/api/collections/${collection}/records`;
}

function setupHandlers({
  objects = [accObj1, accObj2],
  invoices = [invoice1, invoice3],
  paymentMarks = [],
  orgUsers = [orgUserAdmin],
  savedColumns,
}: HandlerOptions = {}) {
  server.use(
    http.get(recordsUrl('accounting_objects'), () => HttpResponse.json({ items: objects })),
    http.get(recordsUrl('invoices'), () => HttpResponse.json({ items: invoices })),
    http.get(recordsUrl('payment_marks'), () => HttpResponse.json({ items: paymentMarks })),
    http.get(recordsUrl('invoice_files'), () => HttpResponse.json({ items: [] })),
    http.get(recordsUrl('users'), () => HttpResponse.json({ items: [] })),
    http.get(recordsUrl('organization_users'), () => HttpResponse.json({ items: orgUsers })),
    http.get(recordsUrl('user_settings'), () =>
      HttpResponse.json({
        items:
          savedColumns === undefined
            ? []
            : [{ id: 'us1', user_id: 'x', key: 'invoice_columns', value: savedColumns }],
      }),
    ),
  );
}

function renderSection({ bankTotal = 0 }: { bankTotal?: number } = {}) {
  return renderWithProviders(
    <DatePinnedProvider>
      <InvoiceSection
        orgId="org1"
        date="2026-06-01"
        searchAll={state.searchAll}
        onBackToDate={() => {}}
        bankTotal={bankTotal}
      />
    </DatePinnedProvider>,
  );
}

async function renderLoaded(options?: Parameters<typeof renderSection>[0]) {
  const view = renderSection(options);
  await screen.findAllByRole('button', { name: /Фильтр/ });
  return view;
}

const columnSettingsButton = () => screen.getAllByLabelText('Настройка колонок')[0]!;

const globalCollapseButton = (name: 'Свернуть' | 'Развернуть') =>
  screen.getAllByRole('button', { name })[0]!;

/** Неразрывный пробел, который `toLocaleString('ru-RU')` ставит между разрядами. */
const NBSP = '\u00a0';

/**
 * Текст узла-итога по текстовому якорю. `getByText` схлопывает пробелы, поэтому
 * U+00A0 в разрядах неотличим от обычного пробела — посимвольную сверку (в том числе
 * разделителя разрядов) делаем по `textContent`.
 */
function totalText(anchor: RegExp): string | null {
  return screen.queryByText(anchor)?.textContent ?? null;
}

function expectAllText(text: string, visible: boolean) {
  const nodes = screen.getAllByText(text);
  expect(nodes.length).toBeGreaterThan(0);
  for (const node of nodes) {
    if (visible) expect(node).toBeVisible();
    else expect(node).not.toBeVisible();
  }
}

describe('InvoiceSection', () => {
  beforeEach(() => {
    state.user = adminUser;
    state.searchText = '';
    state.searchAll = false;
    localStorage.clear();
  });

  describe('состояние загрузки', () => {
    it('показывает скелетоны вместо реестра, пока объекты не загрузились', () => {
      setupHandlers();

      const { container } = renderSection();

      expect(container.querySelectorAll('.mantine-Skeleton-root')).toHaveLength(3);
      expect(screen.queryByLabelText('Настройка колонок')).not.toBeInTheDocument();
      expect(screen.queryByText('Нет счетов на эту дату')).not.toBeInTheDocument();
    });

    it('не показывает ни пустой реестр, ни таблицу во время загрузки', async () => {
      server.use(
        http.get(recordsUrl('accounting_objects'), () => HttpResponse.json({ items: [accObj1] })),
        http.get(recordsUrl('invoices'), async () => {
          await delay('infinite');
          return HttpResponse.json({ items: [] });
        }),
        http.get(recordsUrl('payment_marks'), () => HttpResponse.json({ items: [] })),
        http.get(recordsUrl('invoice_files'), () => HttpResponse.json({ items: [] })),
        http.get(recordsUrl('users'), () => HttpResponse.json({ items: [] })),
        http.get(recordsUrl('organization_users'), () =>
          HttpResponse.json({ items: [orgUserAdmin] }),
        ),
        http.get(recordsUrl('user_settings'), () => HttpResponse.json({ items: [] })),
      );
      state.searchAll = true;
      state.searchText = 'контрагент';

      renderSection();

      await waitFor(() => {
        expect(document.querySelector('.mantine-Loader-root')).toBeInTheDocument();
      });
      expect(screen.queryByLabelText('Настройка колонок')).not.toBeInTheDocument();
      expect(screen.queryByText('Нет счетов на эту дату')).not.toBeInTheDocument();
    });
  });

  describe('пустой и заполненный реестр', () => {
    it('показывает пустое состояние, когда на дату нет счетов', async () => {
      setupHandlers({ objects: [accObj1], invoices: [] });

      await renderLoaded();

      expect(screen.getByText('Нет счетов на эту дату')).toBeInTheDocument();
      expect(screen.queryByText(/ИТОГО:/)).not.toBeInTheDocument();
    });

    it('показывает строки счетов, итог по объекту и общий итог', async () => {
      setupHandlers();

      await renderLoaded();

      expect(screen.getAllByText('ООО "Контрагент А"').length).toBeGreaterThan(0);
      expect(screen.getAllByText('ООО "Поставщик Б"').length).toBeGreaterThan(0);
      expect(screen.getByText(/Итого по "Основная деятельность": 50 000,00 ₽/)).toBeInTheDocument();
      expect(screen.getByText('ИТОГО: 170 000,00 ₽')).toBeInTheDocument();
    });
  });

  describe('граничные значения сумм', () => {
    it('показывает нулевой итог по каждому объекту, когда все счета на ноль', async () => {
      setupHandlers({
        invoices: [
          { ...invoice1, amount: 0 },
          { ...invoice3, amount: 0 },
        ],
      });

      await renderLoaded();

      expect(screen.getAllByText('ООО "Контрагент А"').length).toBeGreaterThan(0);
      expect(screen.getAllByText('ООО "Поставщик Б"').length).toBeGreaterThan(0);
      expect(totalText(/Итого по "Основная деятельность"/)).toBe(
        'Итого по "Основная деятельность": 0,00 ₽',
      );
      expect(totalText(/Итого по "Капитальные вложения"/)).toBe(
        'Итого по "Капитальные вложения": 0,00 ₽',
      );
      // Общая строка «ИТОГО» скрыта: InvoiceSection рендерит её только при grandTotal > 0.
      expect(totalText(/ИТОГО:/)).toBeNull();
    });

    it('отличает пустой реестр от реестра из счетов с нулевой суммой', async () => {
      setupHandlers({ objects: [accObj1], invoices: [] });
      const { unmount } = await renderLoaded();

      expect(screen.getByText('Нет счетов на эту дату')).toBeInTheDocument();
      expect(totalText(/Итого по "Основная деятельность"/)).toBeNull();

      unmount();

      setupHandlers({ objects: [accObj1], invoices: [{ ...invoice1, amount: 0 }] });
      await renderLoaded();

      expect(screen.queryByText('Нет счетов на эту дату')).not.toBeInTheDocument();
      expect(screen.getAllByText('ООО "Контрагент А"').length).toBeGreaterThan(0);
      expect(totalText(/Итого по "Основная деятельность"/)).toBe(
        'Итого по "Основная деятельность": 0,00 ₽',
      );
    });

    it('сохраняет копейки в итогах, не округляя сумму до целых рублей', async () => {
      setupHandlers({ objects: [accObj1], invoices: [{ ...invoice1, amount: 1234.56 }] });

      await renderLoaded();

      expect(totalText(/Итого по "Основная деятельность"/)).toBe(
        `Итого по "Основная деятельность": 1${NBSP}234,56 ₽`,
      );
      expect(totalText(/ИТОГО:/)).toBe(`ИТОГО: 1${NBSP}234,56 ₽`);
      expect(screen.queryByText('1 235,00 ₽')).not.toBeInTheDocument();
      expect(screen.queryByText('1 234,00 ₽')).not.toBeInTheDocument();
    });

    it('группирует разряды в очень большой сумме без NaN и Infinity', async () => {
      setupHandlers({ objects: [accObj1], invoices: [{ ...invoice1, amount: 999999999.99 }] });

      await renderLoaded();

      expect(totalText(/Итого по "Основная деятельность"/)).toBe(
        `Итого по "Основная деятельность": 999${NBSP}999${NBSP}999,99 ₽`,
      );
      expect(totalText(/ИТОГО:/)).toBe(`ИТОГО: 999${NBSP}999${NBSP}999,99 ₽`);
      expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument();
    });
  });

  describe('разрешения ролей', () => {
    it('admin: показывает кнопку создания счёта', async () => {
      setupHandlers({ objects: [accObj1], orgUsers: [orgUserAdmin] });

      await renderLoaded();

      expect(screen.getAllByRole('button', { name: 'Добавить счёт' }).length).toBeGreaterThan(0);
    });

    it('guest: скрывает кнопку создания счёта', async () => {
      state.user = guestUser;
      setupHandlers({
        objects: [accObj1],
        orgUsers: [{ ...orgUserGuest, objects: [accObj1.id] }],
      });

      await renderLoaded();

      expect(screen.getAllByText('Основная деятельность').length).toBeGreaterThan(0);
      expect(screen.queryByRole('button', { name: 'Добавить счёт' })).not.toBeInTheDocument();
    });

    it('boss: скрывает кнопку создания счёта, но видит все объекты учёта', async () => {
      state.user = bossUser;
      setupHandlers({ orgUsers: [{ ...orgUserBoss, objects: [accObj1.id, accObj2.id] }] });

      await renderLoaded();

      expect(screen.getAllByText('Основная деятельность').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Капитальные вложения').length).toBeGreaterThan(0);
      expect(screen.queryByRole('button', { name: 'Добавить счёт' })).not.toBeInTheDocument();
    });

    it('user: ограничивает список объектов учёта своей ролью', async () => {
      state.user = userUser;
      setupHandlers({ orgUsers: [orgUserUser] });

      await renderLoaded();

      expect(screen.getAllByText('Основная деятельность').length).toBeGreaterThan(0);
      expect(screen.queryByText('Капитальные вложения')).not.toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: 'Добавить счёт' }).length).toBeGreaterThan(0);
    });

    it('admin: показывает «Итого к оплате» по отметкам', async () => {
      setupHandlers({ invoices: [invoice1, invoice2], paymentMarks: [paymentMark1] });

      await renderLoaded({ bankTotal: 100000 });

      expect(screen.getByText('Итого к оплате: 30 000,00 ₽')).toBeInTheDocument();
    });

    it('покрасневает «Итого к оплате», когда отметки превышают остаток', async () => {
      setupHandlers({ invoices: [invoice1, invoice2], paymentMarks: [paymentMark1] });

      await renderLoaded({ bankTotal: 0 });

      const total = screen.getByText('Итого к оплате: 30 000,00 ₽');
      expect(total.getAttribute('style')).toContain('var(--mantine-color-red-text)');
    });

    it('user: не показывает «Итого к оплате», потому что не видит отметки', async () => {
      state.user = userUser;
      setupHandlers({
        orgUsers: [orgUserUser],
        invoices: [invoice1, invoice2],
        paymentMarks: [paymentMark1],
      });

      await renderLoaded({ bankTotal: 100000 });

      expect(screen.queryByText(/Итого к оплате/)).not.toBeInTheDocument();
    });

    it('boss: показывает полный набор фильтров по статусу счёта', async () => {
      const user = userEvent.setup();
      state.user = bossUser;
      setupHandlers({ orgUsers: [{ ...orgUserBoss, objects: [accObj1.id] }] });

      await renderLoaded();
      await user.click(screen.getAllByRole('button', { name: /Фильтр/ })[0]!);

      expect(await screen.findByText('К оплате')).toBeInTheDocument();
      expect(screen.getByText('На согласовании')).toBeInTheDocument();
      expect(screen.getByText('Частично оплаченные')).toBeInTheDocument();
    });

    it('user: показывает сокращённый набор фильтров по статусу счёта', async () => {
      const user = userEvent.setup();
      state.user = userUser;
      setupHandlers({ orgUsers: [orgUserUser] });

      await renderLoaded();
      await user.click(screen.getAllByRole('button', { name: /Фильтр/ })[0]!);

      expect(await screen.findByText('Частично оплаченные')).toBeInTheDocument();
      expect(screen.queryByText('К оплате')).not.toBeInTheDocument();
      expect(screen.queryByText('На согласовании')).not.toBeInTheDocument();
    });
  });

  describe('настройка колонок', () => {
    it('открывает модалку настройки колонок и закрывает её по «Отмена»', async () => {
      const user = userEvent.setup();
      setupHandlers({ objects: [accObj1] });

      await renderLoaded();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      await user.click(columnSettingsButton());

      const dialog = await screen.findByRole('dialog');
      expect(
        within(dialog).getByText('Перетащите колонки для изменения порядка, отметьте видимые'),
      ).toBeInTheDocument();
      expect(within(dialog).getByLabelText('Контрагент')).toBeChecked();

      await user.click(within(dialog).getByRole('button', { name: 'Отмена' }));

      await waitFor(() => {
        expect(
          screen.queryByText('Перетащите колонки для изменения порядка, отметьте видимые'),
        ).not.toBeInTheDocument();
      });
    });

    it('убирает колонку из набора и сохраняет новый набор в настройки пользователя', async () => {
      const user = userEvent.setup();
      let savedValue: unknown = 'не вызвано';
      server.use(
        http.get(recordsUrl('accounting_objects'), () => HttpResponse.json({ items: [accObj1] })),
        http.get(recordsUrl('invoices'), () => HttpResponse.json({ items: [invoice1] })),
        http.get(recordsUrl('payment_marks'), () => HttpResponse.json({ items: [] })),
        http.get(recordsUrl('invoice_files'), () => HttpResponse.json({ items: [] })),
        http.get(recordsUrl('users'), () => HttpResponse.json({ items: [] })),
        http.get(recordsUrl('organization_users'), () =>
          HttpResponse.json({ items: [orgUserAdmin] }),
        ),
        http.get(recordsUrl('user_settings'), () => HttpResponse.json({ items: [] })),
        http.post(recordsUrl('user_settings'), async ({ request }) => {
          savedValue = ((await request.json()) as { value: unknown }).value;
          return HttpResponse.json({ id: 'us_new' }, { status: 201 });
        }),
      );

      await renderLoaded();
      await user.click(columnSettingsButton());

      const dialog = await screen.findByRole('dialog');
      await user.click(within(dialog).getByLabelText('Назначение платежа'));
      await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

      await waitFor(() => {
        expect(Array.isArray(savedValue)).toBe(true);
      });
      expect(savedValue).toContain('counterparty');
      expect(savedValue).not.toContain('purpose');
    });

    it('подставляет сохранённый набор колонок в модалку', async () => {
      const user = userEvent.setup();
      setupHandlers({
        objects: [accObj1],
        savedColumns: ['counterparty', 'amount'],
      });

      await renderLoaded();
      await user.click(columnSettingsButton());

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByLabelText('Контрагент')).toBeChecked();
      expect(within(dialog).getByLabelText('Сумма')).toBeChecked();
      expect(within(dialog).getByLabelText('Назначение платежа')).not.toBeChecked();
    });

    it('скрывает в модалке колонки, недоступные гостю', async () => {
      const user = userEvent.setup();
      state.user = guestUser;
      setupHandlers({
        objects: [accObj1],
        orgUsers: [{ ...orgUserGuest, objects: [accObj1.id] }],
      });

      await renderLoaded();
      await user.click(columnSettingsButton());

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByLabelText('Контрагент')).toBeInTheDocument();
      expect(within(dialog).queryByLabelText('Отметка')).not.toBeInTheDocument();
      expect(within(dialog).queryByLabelText('Действия')).not.toBeInTheDocument();
    });
  });

  describe('скрытые объекты', () => {
    const hiddenAccObj1: IAccountingObject = { ...accObj1, is_active: false };
    const hiddenAccObj2: IAccountingObject = { ...accObj2, is_active: false };

    it('не показывает скрытый объект в основном списке, но показывает свёрнутую секцию', async () => {
      setupHandlers({ objects: [accObj1, hiddenAccObj2] });

      await renderLoaded();

      expect(screen.getAllByText('Основная деятельность').length).toBeGreaterThan(0);
      expect(screen.getByLabelText('Развернуть объекты без счетов')).toHaveAttribute(
        'aria-expanded',
        'false',
      );
      // Mantine Collapse держит содержимое смонтированным (opacity: 0): имя остаётся
      // в дереве DOM, но не видно — проверяем видимость, а не отсутствие.
      expect(screen.getByText('Капитальные вложения')).not.toBeVisible();
    });

    it('по умолчанию показывает объект без флага is_active в основном списке', async () => {
      setupHandlers({ objects: [accObj1, { ...accObj2, is_active: true }] });

      await renderLoaded();

      expect(screen.getAllByText('Основная деятельность').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Капитальные вложения').length).toBeGreaterThan(0);
      expect(screen.queryByText('Объекты без счетов')).not.toBeInTheDocument();
    });

    it('разворачивает секцию и даёт добавить счёт в скрытый объект', async () => {
      const user = userEvent.setup();
      setupHandlers({ objects: [accObj1, hiddenAccObj2] });

      await renderLoaded();

      const trigger = screen.getByRole('button', { name: 'Развернуть объекты без счетов' });
      await user.click(trigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await waitFor(() => {
        expect(screen.getByText('Капитальные вложения')).toBeVisible();
      });
      const hiddenBlockSection = trigger.parentElement!;
      expect(
        within(hiddenBlockSection).getAllByRole('button', { name: 'Добавить счёт' }).length,
      ).toBeGreaterThan(0);
    });

    it('показывает одну секцию, когда скрыты все объекты', async () => {
      setupHandlers({ objects: [hiddenAccObj1, hiddenAccObj2] });

      await renderLoaded();

      // Оба блока смонтированы внутри свёрнутой секции — видим, что названий из
      // основного списка на экране нет (collapse-содержимое opacity: 0).
      expect(screen.getByText('Основная деятельность')).not.toBeVisible();
      expect(screen.getByText('Капитальные вложения')).not.toBeVisible();
      expect(screen.getByText('Объекты без счетов (2)')).toBeInTheDocument();
      // Счета скрытых объектов не попадают в общий итог реестра.
      expect(totalText(/ИТОГО:/)).toBeNull();
    });

    it('Свернуть сворачивает видимые объекты и закрывает секцию скрытых', async () => {
      const user = userEvent.setup();
      setupHandlers({ objects: [accObj1, hiddenAccObj2] });

      await renderLoaded();

      await user.click(screen.getByRole('button', { name: 'Развернуть объекты без счетов' }));
      expectAllText('ООО "Поставщик Б"', true);

      await user.click(globalCollapseButton('Свернуть'));

      expect(screen.getByRole('button', { name: 'Развернуть объекты без счетов' })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
      expectAllText('ООО "Контрагент А"', false);
      expectAllText('ООО "Поставщик Б"', false);
      expect(globalCollapseButton('Развернуть')).toBeInTheDocument();
    });

    it('Развернуть разворачивает видимые объекты, но не открывает секцию скрытых', async () => {
      const user = userEvent.setup();
      setupHandlers({ objects: [accObj1, hiddenAccObj2] });

      await renderLoaded();

      await user.click(globalCollapseButton('Свернуть'));
      expect(screen.getByRole('button', { name: 'Развернуть объекты без счетов' })).toHaveAttribute(
        'aria-expanded',
        'false',
      );

      await user.click(globalCollapseButton('Развернуть'));

      expect(screen.getByRole('button', { name: 'Развернуть объекты без счетов' })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
      expectAllText('ООО "Контрагент А"', true);
      expectAllText('ООО "Поставщик Б"', false);
    });

    it('при активном поиске принудительно разворачивает все, включая скрытые объекты', async () => {
      state.searchText = 'ООО';
      setupHandlers({ objects: [accObj1, hiddenAccObj2] });

      await renderLoaded();

      expect(screen.getByRole('button', { name: 'Свернуть объекты без счетов' })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      expectAllText('ООО "Поставщик Б"', true);
      expectAllText('ООО "Контрагент А"', true);
    });
  });
});
