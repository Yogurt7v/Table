import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/mocks/test-utils';
import { InlineRoleCell } from './InlineRoleCell';
import { accObj1, accObj2, org1, org2, orgUserAdmin, orgUserUser } from '@/mocks/seed';
import type { IOrganizationUser, IOrganization } from '@/shared/types';

/**
 * Назначение ролей — единственное место, где живут права, поэтому проверяются
 * тела запросов, а не факт «что-то ушло на сервер». Заглушка стоит на границе
 * `pb`: хуки, `api/collections` и `api/mail` настоящие, и ровно тот объект,
 * который ушёл бы в `organization_users`, попадает в журнал.
 *
 * Заглушка ещё и честно отказывает: коллекция из `h.failing` режет запись
 * ошибкой — так проверяется поведение при отказе сервера, а не только успех.
 *
 * Кнопки-иконки в админке не подписаны, поэтому адресуются по иконке внутри
 * (`.tabler-icon-*`); у «Добавить» подпись есть, поэтому в форме назначения
 * ищется безымянная кнопка «+».
 */

type Payload = Record<string, unknown>;

const h = vi.hoisted(() => ({
  orgs: [] as IOrganization[],
  lists: new Map<string, unknown[]>(),
  failing: new Set<string>(),
  creates: [] as Array<{ collection: string; body: Payload }>,
  updates: [] as Array<{ collection: string; id: string; body: Payload }>,
  deletes: [] as Array<{ collection: string; id: string }>,
}));

vi.mock('@/api/client', () => ({
  pb: {
    authStore: { model: null, token: '', isValid: false },
    collection: (name: string) => ({
      getFullList: () => Promise.resolve(h.lists.get(name) ?? []),
      /* Попытка пишется в журнал до отказа: иначе не видно, что запрос ушёл
         и отклонился сервером, а не был сорван на клиенте. */
      create: (body: Payload) => {
        h.creates.push({ collection: name, body });
        if (h.failing.has(name)) return Promise.reject(new Error('stub: сервер отказал'));
        return Promise.resolve({ id: `${name}_new_${h.creates.length}`, ...body });
      },
      update: (id: string, body: Payload) => {
        h.updates.push({ collection: name, id, body });
        if (h.failing.has(name)) return Promise.reject(new Error('stub: сервер отказал'));
        return Promise.resolve({ id, ...body });
      },
      delete: (id: string) => {
        h.deletes.push({ collection: name, id });
        if (h.failing.has(name)) return Promise.reject(new Error('stub: сервер отказал'));
        return Promise.resolve(true);
      },
    }),
  },
}));

const mockUseOrg = vi.hoisted(() => vi.fn());
const mockNotifyShow = vi.hoisted(() => vi.fn());

vi.mock('@/shared/context/OrgContext', () => ({ useOrg: mockUseOrg }));
vi.mock('@mantine/notifications', () => ({ notifications: { show: mockNotifyShow } }));

/** Назначение с полным набором почтовых прав — как их выдаёт бэкфилл. */
const assignmentWithMail: IOrganizationUser = {
  ...orgUserUser,
  can_view_mails: true,
  can_create_incoming_mails: true,
  can_edit_incoming_mails: true,
  can_delete_incoming_mails: true,
  can_create_outgoing_mails: true,
  can_edit_outgoing_mails: true,
  can_delete_outgoing_mails: false,
};

interface CellProps {
  userId?: string;
  assignments?: IOrganizationUser[];
  canManageMailPermissions?: boolean;
}

function renderCell({
  userId = 'user1',
  assignments = [orgUserUser],
  canManageMailPermissions = true,
}: CellProps = {}) {
  mockUseOrg.mockReturnValue({
    currentOrgId: 'org1',
    setCurrentOrgId: vi.fn(),
    currentOrg: org1,
    organizations: h.orgs,
    organizationsLoading: false,
  });

  return renderWithProviders(
    <InlineRoleCell
      userId={userId}
      assignments={assignments}
      canManageMailPermissions={canManageMailPermissions}
    />,
  );
}

type User = ReturnType<typeof userEvent.setup>;

function iconButtons(icon: string): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll(`.tabler-icon-${icon}`))
    .map((node) => node.closest('button'))
    .filter((node): node is HTMLButtonElement => node instanceof HTMLButtonElement);
}

const objectButtons = () => iconButtons('adjustments');
const trashButtons = () => iconButtons('trash');

/** Безымянная кнопка «+» формы назначения: у кнопки «Добавить» есть подпись. */
function addAssignmentButton(): HTMLButtonElement {
  const button = iconButtons('plus')
    .filter((node) => node.textContent === '')
    .at(-1);
  if (!button) throw new Error('кнопка добавления назначения не найдена');
  return button;
}

const orgSelect = () => screen.getByPlaceholderText('Организация');
/* Mantine Select вешает aria-label и на input, и на combobox-обёртку. */
function labeledInput(label: string): HTMLInputElement {
  const input = screen
    .getAllByLabelText(label)
    .find((node): node is HTMLInputElement => node instanceof HTMLInputElement);
  if (!input) throw new Error(`поле «${label}» не найдено`);
  return input;
}

const roleSelect = () => labeledInput('Новая роль');
const mailButton = () => screen.getByRole('button', { name: 'Почтовые права: ООО "Тест"' });

async function pickOrg(user: User, label: string) {
  await user.click(orgSelect());
  await user.click(await screen.findByRole('option', { name: label }));
}

async function pickRole(user: User, label: string) {
  await user.click(roleSelect());
  await user.click(await screen.findByRole('option', { name: label }));
}

async function openAddForm(user: User) {
  await user.click(screen.getByRole('button', { name: 'Добавить' }));
}

function createdIn(collection: string, index = 0): Payload {
  const body = h.creates.filter((call) => call.collection === collection)[index]?.body;
  if (!body) throw new Error(`stub: не было create(${collection})[${index}]`);
  return body;
}

function updatedIn(collection: string, index = 0): { id: string; body: Payload } {
  const call = h.updates.filter((entry) => entry.collection === collection)[index];
  if (!call) throw new Error(`stub: не было update(${collection})[${index}]`);
  return call;
}

const MAIL_FLAG_KEYS = [
  'can_view_mails',
  'can_create_incoming_mails',
  'can_edit_incoming_mails',
  'can_delete_incoming_mails',
  'can_create_outgoing_mails',
  'can_edit_outgoing_mails',
  'can_delete_outgoing_mails',
];

describe('InlineRoleCell', () => {
  beforeEach(() => {
    h.orgs = [org1, org2];
    h.lists = new Map([['accounting_objects', [accObj1, accObj2]]]);
    h.failing = new Set();
    h.creates = [];
    h.updates = [];
    h.deletes = [];
    mockNotifyShow.mockReset();
  });

  describe('отображение ролей', () => {
    it('подписывает роль каждого назначения по-русски', () => {
      renderCell({
        assignments: [
          orgUserAdmin,
          orgUserUser,
          { ...orgUserUser, id: 'ou3', role: 'guest' },
          { ...orgUserUser, id: 'ou4', role: 'boss' },
          { ...orgUserUser, id: 'ou5', role: 'moderator', organization_id: 'org2' },
        ],
      });

      expect(screen.getByDisplayValue('Администратор')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Пользователь')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Гость')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Босс')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Модератор')).toBeInTheDocument();
    });

    it('подставляет название организации, а для неизвестной — её идентификатор', () => {
      renderCell({
        assignments: [orgUserUser, { ...orgUserUser, id: 'ou9', organization_id: 'org-removed' }],
      });

      expect(screen.getByText('ООО "Тест"')).toBeInTheDocument();
      expect(screen.getByText('org-removed')).toBeInTheDocument();
    });

    it('показывает «Нет ролей», когда назначений нет и добавлять некуда', () => {
      h.orgs = [];
      renderCell({ assignments: [] });

      expect(screen.getByText('Нет ролей')).toBeInTheDocument();
    });

    it('скрывает выбор объектов у администратора и оставляет остальным ролям', () => {
      renderCell({ assignments: [orgUserAdmin, orgUserUser] });

      // Одна строка — «Пользователь»; у «Администратора» объекты не ограничиваются.
      expect(objectButtons()).toHaveLength(1);
    });

    it('показывает количество объектов участника', async () => {
      renderCell({ assignments: [{ ...orgUserUser, objects: ['ao1', 'ao2'] }] });

      expect(await screen.findByRole('button', { name: 'Объекты: 2' })).toBeInTheDocument();
    });

    it('не предлагает добавить роль, когда пользователь уже состоит во всех организациях', () => {
      renderCell({
        assignments: [orgUserUser, { ...orgUserUser, id: 'ou3', organization_id: 'org2' }],
      });

      expect(screen.queryByRole('button', { name: 'Добавить' })).not.toBeInTheDocument();
    });
  });

  describe('назначение роли', () => {
    it('пишет выбранную роль в тело запроса', async () => {
      const user = userEvent.setup();
      renderCell();

      await openAddForm(user);
      await pickOrg(user, 'ООО "Демо"');
      await pickRole(user, 'Босс');
      await user.click(addAssignmentButton());

      await waitFor(() => expect(createdIn('organization_users')).toBeDefined());
      expect(createdIn('organization_users')).toEqual({
        user_id: 'user1',
        organization_id: 'org2',
        role: 'boss',
        objects: ['ao1', 'ao2'],
      });
    });

    it('назначает гостя, если роль не выбрали явно', async () => {
      const user = userEvent.setup();
      renderCell();

      await openAddForm(user);
      await pickOrg(user, 'ООО "Демо"');
      await user.click(addAssignmentButton());

      await waitFor(() => expect(createdIn('organization_users')).toBeDefined());
      expect(createdIn('organization_users')['role']).toBe('guest');
    });

    it('блокирует добавление, пока не выбрана организация', async () => {
      const user = userEvent.setup();
      renderCell();

      await openAddForm(user);
      expect(addAssignmentButton()).toBeDisabled();

      await user.click(addAssignmentButton());
      expect(h.creates).toHaveLength(0);
    });

    it('предлагает в форме только те организации, где пользователя ещё нет', async () => {
      const user = userEvent.setup();
      renderCell({ assignments: [orgUserUser] });

      await openAddForm(user);
      await user.click(orgSelect());

      expect(await screen.findByRole('option', { name: 'ООО "Демо"' })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'ООО "Тест"' })).not.toBeInTheDocument();
    });

    it('предлагает пять ролей и не сужает их для модератора — роль admin остаётся доступна', async () => {
      const user = userEvent.setup();
      renderCell({ canManageMailPermissions: false });

      await openAddForm(user);
      await user.click(roleSelect());

      const labels = (await screen.findAllByRole('option')).map((option) => option.textContent);
      expect(labels).toEqual(['Администратор', 'Модератор', 'Пользователь', 'Босс', 'Гость']);
    });

    it('не применяет роль до ответа сервера и сообщает об отказе', async () => {
      const user = userEvent.setup();
      h.failing = new Set(['organization_users']);
      renderCell();

      await openAddForm(user);
      await pickOrg(user, 'ООО "Демо"');
      await pickRole(user, 'Босс');
      await user.click(addAssignmentButton());

      await waitFor(() =>
        expect(mockNotifyShow).toHaveBeenCalledWith(
          expect.objectContaining({ color: 'red', message: 'Не удалось назначить роль' }),
        ),
      );
      expect(createdIn('organization_users')['role']).toBe('boss');
      expect(screen.queryByDisplayValue('Босс')).not.toBeInTheDocument();
      expect(screen.getByDisplayValue('Пользователь')).toBeInTheDocument();
    });

    it('закрывает форму после неудачного назначения', async () => {
      const user = userEvent.setup();
      h.failing = new Set(['organization_users']);
      renderCell();

      await openAddForm(user);
      await pickOrg(user, 'ООО "Демо"');
      await user.click(addAssignmentButton());

      await waitFor(() => expect(screen.getByRole('button', { name: 'Добавить' })).toBeVisible());
      expect(screen.queryByPlaceholderText('Организация')).not.toBeInTheDocument();
    });

    it('не ограничивает снятие собственной роли администратора', () => {
      renderCell({ userId: 'admin1', assignments: [orgUserAdmin] });

      expect(trashButtons()).toHaveLength(1);
    });
  });

  describe('объекты участника', () => {
    it('пишет выбранные объекты в тело запроса и не трогает роль', async () => {
      const user = userEvent.setup();
      renderCell({ assignments: [{ ...orgUserUser, objects: ['ao1', 'ao2'] }] });

      await user.click(objectButtons()[0]!);
      await user.click(await screen.findByLabelText('Капитальные вложения'));
      await user.click(screen.getByRole('button', { name: 'Сохранить' }));

      await waitFor(() => expect(updatedIn('organization_users')).toBeDefined());
      expect(updatedIn('organization_users')).toEqual({
        collection: 'organization_users',
        id: 'ou2',
        body: { objects: ['ao1'] },
      });
    });

    it('объясняет, что у организации нет объектов', async () => {
      const user = userEvent.setup();
      h.lists = new Map([['accounting_objects', []]]);
      renderCell();

      await user.click(objectButtons()[0]!);

      expect(await screen.findByText('У организации нет объектов')).toBeInTheDocument();
    });

    it('фильтрует список объектов по поиску', async () => {
      const user = userEvent.setup();
      renderCell();

      await user.click(objectButtons()[0]!);
      expect(await screen.findByLabelText('Основная деятельность')).toBeInTheDocument();

      await user.type(screen.getByLabelText('Поиск объекта'), 'капитал');

      expect(screen.queryByLabelText('Основная деятельность')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Капитальные вложения')).toBeInTheDocument();
    });

    it('выбирает все объекты по кнопке и показывает счётчик', async () => {
      const user = userEvent.setup();
      renderCell({ assignments: [{ ...orgUserUser, objects: [] }] });

      await user.click(objectButtons()[0]!);
      expect(await screen.findByText('Выбрано 0 из 2')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Выбрать все' }));
      expect(screen.getByText('Выбрано 2 из 2')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Сохранить' }));

      await waitFor(() => expect(updatedIn('organization_users')).toBeDefined());
      expect(updatedIn('organization_users')).toEqual({
        collection: 'organization_users',
        id: 'ou2',
        body: { objects: ['ao1', 'ao2'] },
      });
    });
  });

  describe('почтовые права', () => {
    it('показывает почтовые права администратору и модератору', () => {
      renderCell({ canManageMailPermissions: true });

      expect(mailButton()).toBeInTheDocument();
      expect(objectButtons()).toHaveLength(1);
    });

    it('скрывает почтовые права, когда управление ими запрещено', () => {
      renderCell({ canManageMailPermissions: false });

      expect(screen.queryByRole('button', { name: 'Почтовые права: ООО "Тест"' })).toBeNull();
      expect(objectButtons()).toHaveLength(1);
    });

    it('открывает администратору матрицу прав участника', async () => {
      const user = userEvent.setup();
      renderCell({ assignments: [assignmentWithMail] });

      await user.click(mailButton());

      expect(await screen.findByLabelText('Видеть почту')).toBeChecked();
      expect(screen.getByLabelText('Исходящие: удаление')).not.toBeChecked();
    });

    it('пишет отозванное право булевым false, остальные шесть — булевыми значениями', async () => {
      const user = userEvent.setup();
      renderCell({ assignments: [assignmentWithMail] });

      await user.click(mailButton());
      await user.click(await screen.findByLabelText('Видеть почту'));
      await user.click(screen.getByRole('button', { name: 'Сохранить' }));

      await waitFor(() => expect(updatedIn('organization_users')).toBeDefined());
      expect(updatedIn('organization_users')).toEqual({
        collection: 'organization_users',
        id: 'ou2',
        body: {
          can_view_mails: false,
          can_create_incoming_mails: true,
          can_edit_incoming_mails: true,
          can_delete_incoming_mails: true,
          can_create_outgoing_mails: true,
          can_edit_outgoing_mails: true,
          can_delete_outgoing_mails: false,
        },
      });
    });

    it('выдаёт выключенное право булевым true, а не строкой', async () => {
      const user = userEvent.setup();
      renderCell({ assignments: [assignmentWithMail] });

      await user.click(mailButton());
      await user.click(await screen.findByLabelText('Исходящие: удаление'));
      await user.click(screen.getByRole('button', { name: 'Сохранить' }));

      await waitFor(() => expect(updatedIn('organization_users')).toBeDefined());
      const { body } = updatedIn('organization_users');
      expect(body['can_delete_outgoing_mails']).toBe(true);
      expect(Object.keys(body)).toEqual(MAIL_FLAG_KEYS);
      for (const value of Object.values(body)) expect(typeof value).toBe('boolean');
      expect(body).not.toHaveProperty('role');
    });

    it('не пишет роль в тело запроса при выдаче почтовых прав', async () => {
      const user = userEvent.setup();
      renderCell({ assignments: [assignmentWithMail] });

      await user.click(mailButton());
      await user.click(await screen.findByLabelText('Входящие: создание'));
      await user.click(screen.getByRole('button', { name: 'Сохранить' }));

      await waitFor(() => expect(updatedIn('organization_users')).toBeDefined());
      expect(updatedIn('organization_users').body).not.toHaveProperty('role');
    });
  });

  describe('изменение роли', () => {
    it('пишет только новую роль в тело запроса', async () => {
      const user = userEvent.setup();
      renderCell();

      await user.click(labeledInput('Роль: ООО "Тест"'));
      await user.click(await screen.findByRole('option', { name: 'Модератор' }));

      await waitFor(() => expect(updatedIn('organization_users')).toBeDefined());
      expect(updatedIn('organization_users')).toEqual({
        collection: 'organization_users',
        id: 'ou2',
        body: { role: 'moderator' },
      });
    });
  });

  describe('снятие роли', () => {
    it('требует подтверждения с названием организации', async () => {
      const user = userEvent.setup();
      renderCell();

      await user.click(trashButtons()[0]!);

      expect(await screen.findByText('Удаление роли')).toBeInTheDocument();
      expect(screen.getByText('Убрать доступ «ООО "Тест"»?')).toBeInTheDocument();
    });

    it('удаляет назначение по его идентификатору', async () => {
      const user = userEvent.setup();
      renderCell();

      await user.click(trashButtons()[0]!);
      await user.click(await screen.findByRole('button', { name: 'Удалить' }));

      await waitFor(() => expect(h.deletes).toHaveLength(1));
      expect(h.deletes[0]).toEqual({ collection: 'organization_users', id: 'ou2' });
    });

    it('отмена в модалке оставляет роль на месте', async () => {
      const user = userEvent.setup();
      renderCell();

      await user.click(trashButtons()[0]!);
      await user.click(await screen.findByRole('button', { name: 'Отмена' }));

      await waitFor(() => expect(screen.queryByText('Удаление роли')).not.toBeInTheDocument());
      expect(h.deletes).toHaveLength(0);
    });
  });
});
