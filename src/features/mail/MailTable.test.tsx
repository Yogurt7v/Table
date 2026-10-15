import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/mocks/test-utils';
import { MailTable } from './MailTable';
import { DEFAULT_VISIBLE_COLUMNS } from './mail-columns';
import type { MailColumnId } from './mail-columns';
import type { MailPermissions } from './mail-field-access';
import type { MailRow } from './mail-row';

/**
 * Реестр писем: строки, пустое состояние и действия строки.
 *
 * Таблица почти не принимает решений — она раскладывает `MailRow` по колонкам,
 * — поэтому проверяется ровно то, что человек видит: значения ячеек, подсказка
 * пустого реестра (и её отсутствие во время загрузки), вызовы действий с
 * идентификатором письма и нумерация страниц. Расчёт ширин колонок и разбор
 * письма в строку закрыты соответственно в `mail-table-column-sizing.test.ts` и
 * `mail-row`, а вычисление подписей — в `mail-column-visibility.test.ts`.
 *
 * Две особенности jsdom, из-за которых проверки строятся вокруг `table`:
 *
 * - `visibleFrom`/`hiddenFrom` — это CSS-медиазапрос, а не условие рендера, так
 *   что одновременно живут и десктопная таблица, и карточки для телефона. Проверки
 *   ячеек поэтому идут через `within(table)`, а пустое состояние встречается
 *   дважды — по одному разу в каждой ветке.
 * - ширины колонок читаются из `localStorage`, поэтому он чистится перед каждым
 *   тестом: иначе сохранённая доля одной колонки переехала бы в следующий тест.
 */

const ALL_PERMISSIONS: MailPermissions = {
  canView: true,
  canCreateIncoming: true,
  canEditIncoming: true,
  canDeleteIncoming: true,
  canCreateOutgoing: true,
  canEditOutgoing: true,
  canDeleteOutgoing: true,
  canManageFiles: true,
  canViewHistory: true,
  canRestore: true,
  canViewArchive: true,
};

function makeRow(row: Pick<MailRow, 'id'> & Partial<MailRow>): MailRow {
  return {
    seq: undefined,
    number: '',
    dateKey: '2026-10-07',
    counterparty: '',
    counterpartyNumber: '',
    subject: '',
    comment: '',
    responsibleName: '',
    deliveryMethod: undefined,
    accountingObjectId: '',
    created: undefined,
    attachmentCount: 0,
    createdByName: '',
    attachmentNames: [],
    ...row,
  };
}

const ROW_ONE = makeRow({
  id: 'mail01hxyz',
  seq: 7,
  number: 'ВХ-77',
  counterparty: 'ООО «Ромашка»',
  counterpartyNumber: 'ИСХ-12',
  subject: 'Счёт на оплату',
  responsibleName: 'Иванов И. И.',
  deliveryMethod: 'email',
  accountingObjectId: 'obj1',
  created: '2026-10-07 09:30:00.000Z',
  createdByName: 'Иванова А. А.',
  attachmentCount: 2,
  attachmentNames: ['договор.pdf'],
});

const ROW_TWO = makeRow({
  id: 'mail02hxyz',
  seq: 8,
  dateKey: '2026-10-09',
  counterparty: 'ИП Петров',
  subject: 'Ответ по договору',
});

type TableProps = Parameters<typeof MailTable>[0];

function renderTable(overrides: Partial<TableProps> = {}) {
  const handlers = {
    onPageChange: vi.fn(),
    onOpenFiles: vi.fn(),
    onEdit: vi.fn(),
    onCopy: vi.fn(),
    onDelete: vi.fn(),
    onHistory: vi.fn(),
    onRelations: vi.fn(),
    onResetFilters: vi.fn(),
  };

  renderWithProviders(
    <MailTable
      orgId="org01hxyz"
      mailType="incoming"
      rows={[ROW_ONE, ROW_TWO]}
      visibleColumns={DEFAULT_VISIBLE_COLUMNS}
      loading={false}
      objectNames={new Map([['obj1', 'Основной счёт']])}
      permissions={ALL_PERMISSIONS}
      page={1}
      pageCount={1}
      totalItems={2}
      hasFilters={false}
      emptyHint="Писем не найдено"
      {...handlers}
      {...overrides}
    />,
  );

  return handlers;
}

const registerTable = () => screen.getByRole('table');

/** Строка письма по его теме: имя строки — это её ячейки, а идентификатор меню общий. */
const rowBySubject = (subject: string) =>
  within(registerTable()).getByRole('row', { name: new RegExp(subject) });

beforeEach(() => {
  localStorage.clear();
});

describe('MailTable — строки реестра', () => {
  it('строка письма попадает в таблицу со своими значениями', () => {
    renderTable();
    const table = registerTable();

    // Шапка плюс две строки: лишних `<tr>` от пустого состояния быть не должно.
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByText('Счёт на оплату')).toBeInTheDocument();
    expect(within(table).getByText('ООО «Ромашка»')).toBeInTheDocument();
    expect(within(table).getByText('ВХ-77')).toBeInTheDocument();
    expect(within(table).getByText('ИСХ-12')).toBeInTheDocument();
    expect(within(table).getByText('Иванов И. И.')).toBeInTheDocument();
    expect(within(table).getByText('Основной счёт')).toBeInTheDocument();
    expect(within(table).getByText('07.10.2026')).toBeInTheDocument();
    expect(within(table).getByLabelText('Email')).toBeInTheDocument();
  });

  it('каждая строка помечена своим идентификатором — по нему MailSection находит письмо', () => {
    renderTable();
    const table = registerTable();

    expect(within(table).getByText('Ответ по договору').closest('tr')).toHaveAttribute(
      'data-highlight-id',
      ROW_TWO.id,
    );
  });

  it('спрятанная колонка не рисуется, а видимая рисуется', () => {
    renderTable({
      visibleColumns: DEFAULT_VISIBLE_COLUMNS.filter(
        (id: MailColumnId) => id !== 'subject' && id !== 'thread',
      ),
    });
    const table = registerTable();

    expect(within(table).queryByText('Счёт на оплату')).not.toBeInTheDocument();
    expect(within(table).queryByRole('columnheader', { name: 'Тема' })).not.toBeInTheDocument();
    expect(within(table).queryByRole('button', { name: 'Переписка письма ВХ-77' })).toBeNull();
  });
});

describe('MailTable — пустое состояние', () => {
  it('без писем показывается подсказка, а не строки', () => {
    renderTable({ rows: [], totalItems: 0 });

    // По одному разу в десктопной таблице и в карточках: обе ветки в jsdom живы.
    expect(screen.getAllByText('Писем не найдено')).toHaveLength(2);
    expect(screen.queryByText('Счёт на оплату')).not.toBeInTheDocument();
  });

  it('при активных фильтрах пустое состояние предлагает их сбросить', async () => {
    const user = userEvent.setup();
    const { onResetFilters } = renderTable({ rows: [], hasFilters: true });

    for (const button of screen.getAllByRole('button', { name: 'Сбросить фильтры' })) {
      await user.click(button);
    }

    expect(onResetFilters).toHaveBeenCalledTimes(2);
  });

  it('без фильтров кнопка сброса не появляется', () => {
    renderTable({ rows: [], hasFilters: false });

    expect(screen.queryByRole('button', { name: 'Сбросить фильтры' })).not.toBeInTheDocument();
  });

  it('во время загрузки показывается индикатор, а не пустое состояние', () => {
    renderTable({ rows: [], loading: true });

    expect(screen.getAllByText('Загрузка писем…')).toHaveLength(2);
    expect(screen.queryByText('Писем не найдено')).not.toBeInTheDocument();
  });
});

describe('MailTable — действия строки', () => {
  it('иконка переписки открывает связи именно этого письма', async () => {
    const user = userEvent.setup();
    const { onRelations } = renderTable();

    await user.click(within(registerTable()).getByLabelText('Переписка письма ВХ-77'));

    expect(onRelations).toHaveBeenCalledWith(ROW_ONE.id);
  });

  it('скрепка открывает вложения именно этого письма', async () => {
    const user = userEvent.setup();
    const { onOpenFiles } = renderTable();

    await user.click(within(registerTable()).getByLabelText('Вложения письма ВХ-77'));

    expect(onOpenFiles).toHaveBeenCalledWith(ROW_ONE.id);
  });

  it('меню действий вызывает удаление выбранного письма', async () => {
    const user = userEvent.setup();
    const { onDelete, onEdit } = renderTable();

    await user.click(within(rowBySubject('Счёт на оплату')).getByLabelText('Действия с письмом'));
    await user.click(await screen.findByRole('menuitem', { name: 'Удалить' }));

    expect(onDelete).toHaveBeenCalledWith(ROW_ONE.id);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('запрещённое действие в меню не появляется вовсе, а не гасится', async () => {
    const user = userEvent.setup();
    renderTable({
      permissions: { ...ALL_PERMISSIONS, canEditIncoming: false, canDeleteIncoming: false },
    });

    await user.click(within(rowBySubject('Счёт на оплату')).getByLabelText('Действия с письмом'));
    const menu = await screen.findByRole('menu');

    expect(within(menu).queryByRole('menuitem', { name: 'Редактировать' })).not.toBeInTheDocument();
    expect(within(menu).queryByRole('menuitem', { name: 'Удалить' })).not.toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'История' })).toBeInTheDocument();
  });
});

describe('MailTable — пагинация', () => {
  it('на нескольких страницах видно общее число, и переход уходит наверх', async () => {
    const user = userEvent.setup();
    const { onPageChange } = renderTable({ page: 1, pageCount: 3, totalItems: 42 });

    expect(screen.getByText('Всего: 42')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '2' }));

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('на единственной странице нумерации нет', () => {
    renderTable({ page: 1, pageCount: 1, totalItems: 2 });

    expect(screen.queryByText('Всего: 2')).not.toBeInTheDocument();
  });
});
