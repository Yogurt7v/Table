import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/mocks/test-utils';
import { RoleManager } from './RoleManager';
import { org1, org2 } from '@/mocks/seed';
import type { IOrganization, IOrganizationUser } from '@/shared/types';

/**
 * `RoleManager` ничего не знает ни о правах, ни о `paid`/`paid_date` — он только
 * назначает пользователю роль в организации. Поэтому моки тут ровно те зависимости,
 * которые он дёргает сам: три хука `organization_users` и `useOrg`.
 */
const mockUseOrganizationUsers = vi.hoisted(() => vi.fn());
const mockUseCreateOrganizationUser = vi.hoisted(() => vi.fn());
const mockUseDeleteOrganizationUser = vi.hoisted(() => vi.fn());
const mockUseOrg = vi.hoisted(() => vi.fn());

vi.mock('@/shared/hooks/useOrganizationUsers', () => ({
  useOrganizationUsers: mockUseOrganizationUsers,
  useCreateOrganizationUser: mockUseCreateOrganizationUser,
  useDeleteOrganizationUser: mockUseDeleteOrganizationUser,
}));

vi.mock('@/shared/context/OrgContext', () => ({
  useOrg: mockUseOrg,
}));

const ORG_TIERS: IOrganization[] = [
  org1,
  org2,
  { id: 'org3', name: 'ООО "Третья"', color: '#fab005' },
  { id: 'org4', name: 'ООО "Четвёртая"', color: '#e64980' },
  { id: 'org5', name: 'ООО "Пятая"', color: '#20c997' },
];

function assignment(
  id: string,
  organizationId: string,
  role: IOrganizationUser['role'],
  expand?: IOrganizationUser['expand'],
): IOrganizationUser {
  return { id, user_id: 'u1', organization_id: organizationId, role, objects: [], expand };
}

function setAssignments(items: IOrganizationUser[] | undefined) {
  mockUseOrganizationUsers.mockReturnValue({ data: items });
}

let createMutateAsync: ReturnType<typeof vi.fn>;
let deleteMutateAsync: ReturnType<typeof vi.fn>;

function setOrgList(organizations: IOrganization[]) {
  mockUseOrg.mockReturnValue({
    organizations,
    currentOrgId: organizations[0]?.id ?? null,
    currentOrg: organizations[0] ?? null,
    setCurrentOrgId: vi.fn(),
  });
}

function setPendingCreate(isPending: boolean) {
  mockUseCreateOrganizationUser.mockReturnValue({ mutateAsync: createMutateAsync, isPending });
}

function setPendingDelete(isPending: boolean) {
  mockUseDeleteOrganizationUser.mockReturnValue({ mutateAsync: deleteMutateAsync, isPending });
}

/** Поле выбора организации — единственное с плейсхолдером «Организация». */
function orgSelect(): HTMLInputElement {
  return screen.getByPlaceholderText('Организация') as HTMLInputElement;
}

/** Поле выбора роли — второе текстовое поле, без плейсхолдера. */
function roleSelect(): HTMLInputElement {
  const input = screen.getAllByRole('textbox').find((el) => el !== orgSelect());
  if (!input) throw new Error('поле выбора роли не найдено');
  return input as HTMLInputElement;
}

async function pickOption(user: ReturnType<typeof userEvent.setup>, input: HTMLElement, name: string) {
  await user.click(input);
  await user.click(await screen.findByRole('option', { name }));
}

/** Цвет бейджа задаётся инлайновой CSS-переменной `--badge-bg`. */
function badgeBg(label: string): string {
  const badge = screen.getByText(label).closest('.mantine-Badge-root');
  if (!badge) throw new Error(`бейдж «${label}» не найден`);
  return (badge as HTMLElement).style.getPropertyValue('--badge-bg');
}

describe('RoleManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createMutateAsync = vi.fn().mockResolvedValue({});
    deleteMutateAsync = vi.fn().mockResolvedValue(true);
    setPendingCreate(false);
    setPendingDelete(false);
    setOrgList(ORG_TIERS);
  });

  it('показывает русские подписи всех пяти ролей и их цвета', () => {
    setAssignments([
      assignment('a1', 'org1', 'admin'),
      assignment('a2', 'org2', 'moderator'),
      assignment('a3', 'org3', 'user'),
      assignment('a4', 'org4', 'guest'),
      assignment('a5', 'org5', 'boss'),
    ]);

    renderWithProviders(<RoleManager userId="u1" />);

    expect(screen.getByText('Администратор')).toBeInTheDocument();
    expect(screen.getByText('Модератор')).toBeInTheDocument();
    expect(screen.getByText('Пользователь')).toBeInTheDocument();
    expect(screen.getByText('Гость')).toBeInTheDocument();
    expect(screen.getByText('Босс')).toBeInTheDocument();

    expect(badgeBg('Администратор')).toBe('var(--mantine-color-red-filled)');
    expect(badgeBg('Модератор')).toBe('var(--mantine-color-blue-filled)');
    expect(badgeBg('Пользователь')).toBe('var(--mantine-color-green-filled)');
    expect(badgeBg('Гость')).toBe('var(--mantine-color-gray-filled)');
    expect(badgeBg('Босс')).toBe('var(--mantine-color-orange-filled)');
  });

  it('берёт название организации из expand, из списка организаций, а иначе — из id', () => {
    setAssignments([
      assignment('a1', 'org1', 'admin', { organization_id: org1 }),
      assignment('a2', 'org2', 'moderator'),
      assignment('a3', 'org-unknown', 'guest'),
    ]);

    renderWithProviders(<RoleManager userId="u1" />);

    expect(screen.getByText('ООО "Тест"')).toBeInTheDocument();
    expect(screen.getByText('ООО "Демо"')).toBeInTheDocument();
    expect(screen.getByText('org-unknown')).toBeInTheDocument();
  });

  it('показывает только назначения выбранного пользователя', () => {
    setAssignments([
      { id: 'a1', user_id: 'u-other', organization_id: 'org1', role: 'admin' },
      assignment('a2', 'org2', 'moderator'),
    ]);

    renderWithProviders(<RoleManager userId="u1" />);

    // Опции Select ролей всегда присутствуют в DOM, поэтому проверяем бейджи, а не текст.
    const badges = Array.from(document.querySelectorAll('.mantine-Badge-root'));
    expect(badges.map((b) => b.textContent)).toEqual(['Модератор']);

    expect(screen.queryByText('Нет назначений')).not.toBeInTheDocument();
    // org1 свободна для назначения — форма добавления на месте.
    expect(screen.getByText('Добавить')).toBeInTheDocument();
  });

  it('показывает «Нет назначений», когда у пользователя нет ролей', () => {
    setAssignments([]);

    renderWithProviders(<RoleManager userId="u1" />);

    expect(screen.getByText('Нет назначений')).toBeInTheDocument();
    expect(screen.getByText('Добавить')).toBeInTheDocument();
  });

  it('считает пустым и отсутствие данных хука (orgUsers === undefined)', () => {
    setAssignments(undefined);

    renderWithProviders(<RoleManager userId="u1" />);

    expect(screen.getByText('Нет назначений')).toBeInTheDocument();
  });

  it('прячет форму добавления, когда все организации уже заняты', () => {
    setAssignments([assignment('a1', 'org1', 'admin')]);
    setOrgList([org1]);

    renderWithProviders(<RoleManager userId="u1" />);

    expect(screen.queryByText('Нет назначений')).not.toBeInTheDocument();
    expect(screen.getByText('Администратор')).toBeInTheDocument();
    expect(screen.queryByText('Добавить')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Организация')).not.toBeInTheDocument();
  });

  it('предлагает в выпадающих списках только свободные организации', async () => {
    const user = userEvent.setup();
    setAssignments([assignment('a1', 'org1', 'admin')]);

    renderWithProviders(<RoleManager userId="u1" />);

    await user.click(orgSelect());
    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      'ООО "Демо"',
      'ООО "Третья"',
      'ООО "Четвёртая"',
      'ООО "Пятая"',
    ]);
  });

  it('не даёт назначить роль boss: в списке только admin/moderator/user/guest', async () => {
    const user = userEvent.setup();
    setAssignments([]);

    renderWithProviders(<RoleManager userId="u1" />);

    await user.click(roleSelect());
    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      'Администратор',
      'Модератор',
      'Пользователь',
      'Гость',
    ]);
    expect(screen.queryByRole('option', { name: 'Босс' })).not.toBeInTheDocument();
  });

  it('по умолчанию стоит роль «Пользователь», а кнопка «Добавить» заблокирована', () => {
    setAssignments([]);

    renderWithProviders(<RoleManager userId="u1" />);

    expect(roleSelect()).toHaveValue('Пользователь');
    expect(screen.getByText('Добавить').closest('button')).toBeDisabled();
  });

  it('назначает выбранную роль в выбранную организацию и сбрасывает форму', async () => {
    const user = userEvent.setup();
    setAssignments([]);

    renderWithProviders(<RoleManager userId="u1" />);

    await pickOption(user, orgSelect(), 'ООО "Демо"');
    expect(screen.getByText('Добавить').closest('button')).not.toBeDisabled();

    await pickOption(user, roleSelect(), 'Модератор');
    await user.click(screen.getByText('Добавить'));

    expect(createMutateAsync).toHaveBeenCalledWith({
      userId: 'u1',
      organizationId: 'org2',
      role: 'moderator',
    });
    expect(orgSelect()).toHaveValue('');
    expect(roleSelect()).toHaveValue('Пользователь');
  });

  it('меняет роль по умолчанию на guest, если её выбрали вручную', async () => {
    const user = userEvent.setup();
    setAssignments([]);

    renderWithProviders(<RoleManager userId="u1" />);

    await pickOption(user, orgSelect(), 'ООО "Третья"');
    await pickOption(user, roleSelect(), 'Гость');
    await user.click(screen.getByText('Добавить'));

    expect(createMutateAsync).toHaveBeenCalledWith({
      userId: 'u1',
      organizationId: 'org3',
      role: 'guest',
    });
  });

  it('не вызывает мутацию, пока организация не выбрана', async () => {
    const user = userEvent.setup();
    setAssignments([]);

    renderWithProviders(<RoleManager userId="u1" />);

    await pickOption(user, roleSelect(), 'Администратор');
    await user.click(screen.getByText('Добавить'));

    expect(createMutateAsync).not.toHaveBeenCalled();
  });

  it('удаляет назначение по id записи', async () => {
    const user = userEvent.setup();
    setAssignments([assignment('a1', 'org1', 'admin')]);
    setOrgList([org1]);

    renderWithProviders(<RoleManager userId="u1" />);

    await user.click(screen.getByRole('button'));

    expect(deleteMutateAsync).toHaveBeenCalledWith('a1');
    expect(createMutateAsync).not.toHaveBeenCalled();
  });

  it('блокирует кнопку удаления, пока мутация висит', () => {
    setAssignments([assignment('a1', 'org1', 'admin')]);
    setOrgList([org1]);
    setPendingDelete(true);

    renderWithProviders(<RoleManager userId="u1" />);

    const removeButton = screen.getByRole('button');
    expect(removeButton).toHaveAttribute('data-loading', 'true');
    expect(removeButton).toBeDisabled();
  });

  it('показывает загрузку на кнопке «Добавить» во время мутации', () => {
    setAssignments([]);
    setPendingCreate(true);

    renderWithProviders(<RoleManager userId="u1" />);

    expect(screen.getByText('Добавить').closest('button')).toHaveAttribute('data-loading', 'true');
  });
});