import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/mocks/test-utils';
import { CreateUserModal } from './CreateUserModal';
import { org1, org2 } from '@/mocks/seed';
import type { IOrganization } from '@/shared/types';

/**
 * Создание пользователя: валидация формы и — главное — тела запросов. Пользователь
 * без единой записи в `organization_users` бесправен, поэтому «создали, а роль не
 * записалась» — не пустая ошибка, а молчаливое выдавание прав не тому.
 *
 * Заглушка `pb` пишет тела запросов настоящих функций `createUser` и
 * `createOrganizationUser`, а коллекция из `h.failing` режет запись ошибкой —
 * так проверяется и отказ сервера, например на занятый логин.
 */

type Payload = Record<string, unknown>;

const h = vi.hoisted(() => ({
  orgs: [] as IOrganization[],
  objects: [] as Array<{ id: string; organization_id: string; name: string }>,
  failing: new Map<string, string>(),
  creates: [] as Array<{ collection: string; body: Payload }>,
}));

vi.mock('@/api/client', () => ({
  pb: {
    authStore: { model: null, token: '', isValid: false },
    collection: (name: string) => ({
      getFullList: () => Promise.resolve(h.objects),
      create: (body: Payload) => {
        h.creates.push({ collection: name, body });
        const failure = h.failing.get(name);
        if (failure) return Promise.reject(new Error(failure));
        const count = h.creates.filter((call) => call.collection === name).length;
        return Promise.resolve({ id: `${name}_new_${count}`, ...body });
      },
      update: (id: string, body: Payload) => Promise.resolve({ id, ...body }),
      delete: () => Promise.resolve(true),
    }),
  },
}));

const mockUseOrg = vi.hoisted(() => vi.fn());

vi.mock('@/shared/context/OrgContext', () => ({ useOrg: mockUseOrg }));

type User = ReturnType<typeof userEvent.setup>;

function renderModal(onClose = vi.fn()) {
  mockUseOrg.mockReturnValue({
    currentOrgId: 'org1',
    setCurrentOrgId: vi.fn(),
    currentOrg: org1,
    organizations: h.orgs,
    organizationsLoading: false,
  });

  renderWithProviders(<CreateUserModal opened onClose={onClose} />);
  return { onClose };
}

/* Подписи обязательных полей `Mantine` дополняет звёздочкой, поэтому регулярка. */
const nameField = () => screen.getByLabelText(/^Имя/, { selector: 'input' });
const loginField = () => screen.getByLabelText(/^Логин/, { selector: 'input' });
const passwordField = () => screen.getByLabelText(/^Пароль/, { selector: 'input' });
const submitButton = () => screen.getByRole('button', { name: 'Создать пользователя' });
const orgInputs = () => screen.getAllByLabelText(/^Организация/, { selector: 'input' });
const roleInputs = () => screen.getAllByLabelText(/^Роль/, { selector: 'input' });
const assignmentRows = () => screen.queryAllByLabelText(/^Организация/, { selector: 'input' });

/** Кнопки-иконки в форме не подписаны, поэтому адресуются по иконке внутри. */
function buttonWithIcon(icon: string) {
  const button = Array.from(document.querySelectorAll(`.tabler-icon-${icon}`))
    .map((node) => node.closest('button'))
    .find((node): node is HTMLButtonElement => node instanceof HTMLButtonElement);
  if (!button) throw new Error(`кнопка с иконкой ${icon} не найдена`);
  return button;
}

/** `toHaveValue` не понимает асимметричные матчеры, а длина строки нужна числом. */
function inputValue(field: HTMLElement): string {
  if (field instanceof HTMLInputElement) return field.value;
  throw new Error('ожидалось поле ввода');
}

async function fillIdentity(user: User, password = 'password1') {
  await user.type(nameField(), 'Иван');
  await user.type(loginField(), 'ivan');
  if (password) await user.type(passwordField(), password);
}

async function addAssignment(user: User) {
  await user.click(screen.getByRole('button', { name: 'Добавить организацию' }));
}

async function pickRole(user: User, row: number, label: string) {
  await user.click(roleInputs()[row]!);
  await user.click(await screen.findByRole('option', { name: label }));
}

function createdIn(collection: string, index = 0): Payload {
  const body = h.creates.filter((call) => call.collection === collection)[index]?.body;
  if (!body) throw new Error(`stub: не было create(${collection})[${index}]`);
  return body;
}

const assignments = () => h.creates.filter((call) => call.collection === 'organization_users');

describe('CreateUserModal', () => {
  beforeEach(() => {
    h.orgs = [org1, org2];
    h.objects = [];
    h.failing = new Map();
    h.creates = [];
  });

  describe('обязательные поля', () => {
    it('не отправляет пустую форму: обязательные поля блокируют отправку', async () => {
      const user = userEvent.setup();
      renderModal();

      await user.click(submitButton());

      expect(h.creates).toHaveLength(0);
    });

    it('требует хотя бы одну организацию', async () => {
      const user = userEvent.setup();
      renderModal();

      await fillIdentity(user);
      await user.click(submitButton());

      expect(screen.getByText('Добавьте хотя бы одну организацию')).toBeInTheDocument();
      expect(h.creates).toHaveLength(0);
    });

    it('требует пароль не короче восьми символов', async () => {
      const user = userEvent.setup();
      renderModal();

      await fillIdentity(user, 'seven7');
      await addAssignment(user);
      await user.click(submitButton());

      expect(screen.getByText('Пароль должен быть не менее 8 символов')).toBeInTheDocument();
      expect(h.creates).toHaveLength(0);
    });

    it('убирает ошибку длины пароля, когда пароль дописан до восьми символов', async () => {
      const user = userEvent.setup();
      renderModal();

      await fillIdentity(user, 'seven7');
      await addAssignment(user);
      await user.click(submitButton());
      await user.type(passwordField(), '77');
      await user.click(submitButton());

      await waitFor(() => expect(h.creates).toHaveLength(2));
      expect(createdIn('users')['password']).toBe('seven777');
    });

    it('подставляет сгенерированный пароль, который проходит проверку длины', async () => {
      const user = userEvent.setup();
      renderModal();

      await fillIdentity(user, '');
      await user.click(screen.getByRole('button', { name: 'Сгенерировать' }));

      expect(inputValue(passwordField()).length).toBeGreaterThanOrEqual(8);
    });

    it('показывает пароль по кнопке глаза и снова прячет его', async () => {
      const user = userEvent.setup();
      renderModal();

      await fillIdentity(user);
      expect(passwordField()).toHaveAttribute('type', 'password');

      await user.click(buttonWithIcon('eye'));
      expect(passwordField()).toHaveAttribute('type', 'text');
    });
  });

  describe('назначение ролей', () => {
    it('предлагает пять ролей в строке назначения', async () => {
      const user = userEvent.setup();
      renderModal();

      await addAssignment(user);
      await user.click(roleInputs()[0]!);

      const labels = (await screen.findAllByRole('option')).map((option) => option.textContent);
      expect(labels).toEqual(['Босс', 'Администратор', 'Модератор', 'Пользователь', 'Гость']);
    });

    it('назначает гостя по умолчанию', async () => {
      const user = userEvent.setup();
      renderModal();

      await addAssignment(user);

      expect(roleInputs()[0]).toHaveValue('Гость');
    });

    it('не даёт занять одну организацию дважды', async () => {
      const user = userEvent.setup();
      renderModal();

      await addAssignment(user);
      await addAssignment(user);
      await user.click(orgInputs()[0]!);
      await user.click(await screen.findByRole('option', { name: 'ООО "Демо"' }));

      expect(orgInputs()[0]).toHaveValue('ООО "Тест"');
    });

    it('убирает строку назначения по кнопке корзины', async () => {
      const user = userEvent.setup();
      renderModal();

      await addAssignment(user);
      await addAssignment(user);
      expect(orgInputs()).toHaveLength(2);

      await user.click(buttonWithIcon('trash'));

      expect(orgInputs()).toHaveLength(1);
    });

    it('прячет добавление, когда организации закончились', async () => {
      const user = userEvent.setup();
      renderModal();

      await addAssignment(user);
      await addAssignment(user);

      expect(
        screen.queryByRole('button', { name: 'Добавить организацию' }),
      ).not.toBeInTheDocument();
    });

    it('не даёт создать пользователя, у которого нет ни одной организации', async () => {
      const user = userEvent.setup();
      h.orgs = [];
      renderModal();

      await fillIdentity(user);

      expect(
        screen.queryByRole('button', { name: 'Добавить организацию' }),
      ).not.toBeInTheDocument();
      expect(assignmentRows()).toHaveLength(0);
    });
  });

  describe('создание', () => {
    it('пишет логин, производную почту, имя и пароль в тело запроса', async () => {
      const user = userEvent.setup();
      renderModal();

      await fillIdentity(user);
      await addAssignment(user);
      await user.click(submitButton());

      await waitFor(() => expect(h.creates).toHaveLength(2));
      expect(createdIn('users')).toEqual({
        login: 'ivan',
        email: 'ivan@local.host',
        password: 'password1',
        passwordConfirm: 'password1',
        name: 'Иван',
        emailVisibility: false,
      });
    });

    it('пишет роль из строки назначения в тело запроса', async () => {
      const user = userEvent.setup();
      renderModal();

      await fillIdentity(user);
      await addAssignment(user);
      await pickRole(user, 0, 'Босс');
      await user.click(submitButton());

      await waitFor(() => expect(assignments()).toHaveLength(1));
      expect(assignments()[0]?.body).toEqual({
        user_id: 'users_new_1',
        organization_id: 'org1',
        role: 'boss',
        objects: [],
      });
    });

    it('выдаёт новому пользователю все объекты организации по умолчанию', async () => {
      const user = userEvent.setup();
      h.objects = [
        { id: 'ao1', organization_id: 'org1', name: 'Основная деятельность' },
        { id: 'ao2', organization_id: 'org1', name: 'Капитальные вложения' },
      ];
      renderModal();

      await fillIdentity(user);
      await addAssignment(user);
      await user.click(submitButton());

      await waitFor(() => expect(assignments()).toHaveLength(1));
      expect(assignments()[0]?.body).toEqual({
        user_id: 'users_new_1',
        organization_id: 'org1',
        role: 'guest',
        objects: ['ao1', 'ao2'],
      });
    });

    it('создаёт по записи на каждое назначение, в порядке строк', async () => {
      const user = userEvent.setup();
      renderModal();

      await fillIdentity(user);
      await addAssignment(user);
      await addAssignment(user);
      await pickRole(user, 0, 'Администратор');
      await pickRole(user, 1, 'Модератор');
      await user.click(submitButton());

      await waitFor(() => expect(assignments()).toHaveLength(2));
      expect(assignments().map((call) => call.body)).toEqual([
        {
          user_id: 'users_new_1',
          organization_id: 'org1',
          role: 'admin',
          objects: undefined,
        },
        {
          user_id: 'users_new_1',
          organization_id: 'org2',
          role: 'moderator',
          objects: [],
        },
      ]);
    });

    it('закрывает модалку и чистит поля после создания', async () => {
      const user = userEvent.setup();
      const { onClose } = renderModal();

      await fillIdentity(user);
      await addAssignment(user);
      await user.click(submitButton());

      await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
      expect(nameField()).toHaveValue('');
      expect(loginField()).toHaveValue('');
      expect(passwordField()).toHaveValue('');
      expect(assignmentRows()).toHaveLength(0);
    });

    it('при отказе сервера не назначает роль несуществующему пользователю', async () => {
      const user = userEvent.setup();
      h.failing = new Map([['users', 'Логин уже занят']]);
      const { onClose } = renderModal();

      await fillIdentity(user);
      await addAssignment(user);
      await user.click(submitButton());

      await waitFor(() => expect(screen.getByText('Логин уже занят')).toBeInTheDocument());
      expect(assignments()).toHaveLength(0);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('оставляет заполненную форму, чтобы ошибку можно было исправить', async () => {
      const user = userEvent.setup();
      h.failing = new Map([['users', 'Логин уже занят']]);
      renderModal();

      await fillIdentity(user);
      await addAssignment(user);
      await user.click(submitButton());

      await waitFor(() => expect(screen.getByText('Логин уже занят')).toBeInTheDocument());
      expect(loginField()).toHaveValue('ivan');
      expect(orgInputs()).toHaveLength(1);
    });
  });
});
