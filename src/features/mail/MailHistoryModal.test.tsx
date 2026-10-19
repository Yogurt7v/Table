import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/mocks/test-utils';
import type { IMailHistory } from '@/shared/types';
import { MailHistoryModal } from './MailHistoryModal';

/**
 * История одного письма: лента событий и состояния запроса.
 *
 * Модалка почти не считает — разбор `previous_data` в записи и подписи лежит в
 * `mail-history.ts` (и там же проверяется отдельно). Здесь важна цепочка, которой
 * у чистой функции нет, и именно её здесь и держим:
 *
 *  1. **Что уходит в запрос.** Оба хука реестра вызваны безусловно (иначе
 *     смена типа письма ломала бы порядок хуков), а идентификатор получает
 *     только активный — и то, что для закрытой модалки он пустой. Проверяется
 *     не «сколько раз позвали хук», а кем: пустой `mailId` обязан быть пустым
 *     запросом, а не запросом по «несуществующему» письму.
 *  2. **Запись о создании.** Её нет в истории как таковой — она приходит из
 *     строки таблицы (`created`/`created_by_name`) и обязана встать ПОСЛЕДНЕЙ,
 *     потому что лента читается сверху вниз. Отдельно проверяется перенос: в
 *     истории после восстановления из архива запись `created` возвращается с
 *     новым `changed_at` и в середину ленты попасть не должна.
 *  3. **Состояния запроса.** Загрузка, обрыв и пустой ответ выглядят по-разному;
 *     главное — обрыв и загрузка обязаны **прятать** ленту. Иначе на экране
 *     одновременно окажется «не удалось загрузить» и записи, которых не было.
 *
 * Два решения в замоках, и почему они такие:
 *
 * - **Данные подменены на уровне хуков, а не сети.** `buildMailHistoryEntries`
 *   настоящий: модалка отдаёт ему то, что пришло от сервера, и разбирает
 *   результат так же, как в браузере. Тест управляет письмом, а не HTTP.
 * - **Время записано локальным, без часового пояса.** `formatMailTimestampSeconds`
 *   печатает локальное время, поэтому `'2026-10-09T12:00:03'` читается как
 *   `09.10.2026 12:00:03` в любой таймзоне — иначе проверки подписей падали бы
 *   у разработчика в одном часе и не у другого.
 */

/** Ответ хука истории вместе с журналом обращений: кого и с каким id спрашивали. */
interface HistoryQuery {
  data: IMailHistory[] | undefined;
  isLoading: boolean;
  isError: boolean;
  askedIds: string[];
}

const state = vi.hoisted(() => ({
  incoming: {
    data: undefined as IMailHistory[] | undefined,
    isLoading: false,
    isError: false,
    askedIds: [] as string[],
  },
  outgoing: {
    data: undefined as IMailHistory[] | undefined,
    isLoading: false,
    isError: false,
    askedIds: [] as string[],
  },
}));

vi.mock('@/shared/hooks/useMail', () => {
  const read = (query: HistoryQuery, mailId: string) => {
    query.askedIds.push(mailId);
    return { data: query.data, isLoading: query.isLoading, isError: query.isError };
  };
  return {
    useIncomingMailHistory: (mailId: string) => read(state.incoming, mailId),
    useOutgoingMailHistory: (mailId: string) => read(state.outgoing, mailId),
  };
});

const ORG_ID = 'org01hxyz';
const MAIL_ID = 'mail01hxyz';
const MAIL_LABEL = 'ВХ-77';
const CREATED_BY = 'Иванова А. А.';
const CREATED_AT = '2026-10-09T12:00:03';

// Подписи событий — строкой с исходника: тест, который импортирует их из
// `mail-labels`, проверял бы сам с собой.
const CREATED_LABEL = 'Письмо создано';
const UPDATED_LABEL = 'Изменены поля письма';
const DELETED_LABEL = 'Письмо удалено';
const RESTORED_LABEL = 'Письмо восстановлено из архива';
const LINKED_LABEL = 'Письмо связано с другим';
const UNLINKED_LABEL = 'Связь с письмом снята';

const HISTORY_TYPE_LABELS: readonly string[] = [
  CREATED_LABEL,
  UPDATED_LABEL,
  DELETED_LABEL,
  RESTORED_LABEL,
  LINKED_LABEL,
  UNLINKED_LABEL,
];

function historyEntry(
  entry: Pick<IMailHistory, 'id' | 'type' | 'changed_at'> & Partial<IMailHistory>,
): IMailHistory {
  return {
    organization_id: ORG_ID,
    author: 'user1',
    previous_data: {},
    ...entry,
  };
}

/**
 * Письмо, пережившее удаление с восстановлением из архива: `mail_history`
 * при восстановлении переписывается заново, и запись `created` получает свежий
 * `changed_at` — то есть в ленте она оказывается НЕ последней.
 */
const RESTORE_FLOW: IMailHistory[] = [
  historyEntry({
    id: 'h1',
    type: 'deleted',
    changed_at: '2026-10-09T12:00:01',
    author_name: 'Петрова М. М.',
    previous_data: { deleted_by_name: 'Петрова М. М.', deleted_at: '2026-10-08T10:00:00' },
  }),
  historyEntry({
    id: 'h2',
    type: 'updated',
    changed_at: '2026-10-09T12:00:02',
    author_name: 'Иванов И. И.',
    previous_data: { subject: 'Старая тема' },
  }),
  historyEntry({
    id: 'h3',
    type: 'created',
    changed_at: CREATED_AT,
    author_name: CREATED_BY,
  }),
  historyEntry({
    id: 'h4',
    type: 'restored',
    changed_at: '2026-10-09T12:00:04',
    author_name: 'Сидоров С. С.',
  }),
];

/** Две правки подряд: номер не менялся, тема — да. */
const TWO_UPDATES: IMailHistory[] = [
  historyEntry({
    id: 'u1',
    type: 'updated',
    changed_at: '2026-10-09T11:00:00',
    author_name: 'Иванов И. И.',
    previous_data: { subject: 'Старая тема', number: MAIL_LABEL },
  }),
  historyEntry({
    id: 'u2',
    type: 'updated',
    changed_at: '2026-10-09T12:00:00',
    author_name: 'Петрова М. М.',
    previous_data: { subject: 'Новая тема', number: MAIL_LABEL },
  }),
];

type ModalProps = Parameters<typeof MailHistoryModal>[0];

function renderModal(overrides: Partial<ModalProps> = {}) {
  const onClose = vi.fn();

  renderWithProviders(
    <MailHistoryModal
      mailId={MAIL_ID}
      mailType="incoming"
      mailLabel={MAIL_LABEL}
      createdByName={CREATED_BY}
      createdAt={CREATED_AT}
      opened
      onClose={onClose}
      {...overrides}
    />,
  );

  return { onClose };
}

const modal = () => screen.getByRole('dialog');

/**
 * К каким идентификаторам модалка обращалась к хуку.
 *
 * Набор, а не число вызовов: проверять количество — значит ловить лишний рендер
 * вместо своего предмета.
 */
function asked(query: HistoryQuery): string[] {
  return [...new Set(query.askedIds)];
}

/** Подписи событий в порядке показа: сверху вниз по ленте. */
function timeline(): string[] {
  return [...modal().querySelectorAll('p')]
    .map((node) => (node.textContent ?? '').trim())
    .filter((text) => HISTORY_TYPE_LABELS.includes(text));
}

/**
 * Чипы «поле: старое → новое» целиком, в порядке показа.
 *
 * Собираются по подписи поля — тем же текстом, который видит человек, — и
 * отдаются узлами: «старое» и «новое» встречаются в ленте по несколько раз
 * (одно значение бывает и старым в своей правке, и новым в следующей), поэтому
 * проверять зачёркивание нужно внутри своего чипа, а не поиском по значению.
 */
function diffChipNodes(): HTMLElement[] {
  return [...modal().querySelectorAll('span')]
    .filter((node) => node.textContent?.endsWith(': ') ?? false)
    .map((node) => node.parentElement)
    .filter((node): node is HTMLElement => node !== null);
}

function diffChips(): string[] {
  return diffChipNodes().map((node) => node.textContent ?? '');
}

/** Линии между записями: у всех, кроме последней. */
function connectors(): HTMLElement[] {
  return [...modal().querySelectorAll<HTMLElement>('div')].filter(
    (node) => node.style.minHeight === '28px',
  );
}

/**
 * Иконки событий по порядку ленты: у каждого типа своя.
 *
 * `class` читается по токенам, а не вырезается подстрокой: `@tabler/icons-react`
 * склеивает класс как `[...].join(' ')`, и без переданного `className` там
 * остаётся хвостовой пробел — подстрока вернула бы `pencil ` вместо `pencil`.
 */
function iconNames(): string[] {
  return [...modal().querySelectorAll('svg.tabler-icon')].map((icon) => {
    const tokens = (icon.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
    const name = tokens.find((token) => token.startsWith('tabler-icon-'));
    return name ? name.slice('tabler-icon-'.length) : '';
  });
}

const loader = () => modal().querySelector('.mantine-Loader-root');

/** Единственная кнопка внутри модалки — крестик в шапке. */
function closeButton(): HTMLElement {
  const [close] = within(modal()).getAllByRole('button');
  if (!close) throw new Error('у модалки истории нет ни одной кнопки');
  return close;
}

function overlay(): HTMLElement {
  const node = document.querySelector<HTMLElement>('.mantine-Overlay-root');
  if (!node) throw new Error('подложка модалки не отрисована');
  return node;
}

beforeEach(() => {
  state.incoming.data = undefined;
  state.incoming.isLoading = false;
  state.incoming.isError = false;
  state.incoming.askedIds = [];
  state.outgoing.data = undefined;
  state.outgoing.isLoading = false;
  state.outgoing.isError = false;
  state.outgoing.askedIds = [];
});

describe('MailHistoryModal — заголовок и запрос', () => {
  it('заголовок называет письмо, историю которого открыли', () => {
    state.incoming.data = RESTORE_FLOW;
    renderModal();

    expect(within(modal()).getByText(`История: ${MAIL_LABEL}`)).toBeInTheDocument();
  });

  it('открытая модалка спрашивает историю по идентификатору письма', () => {
    state.incoming.data = RESTORE_FLOW;
    renderModal();

    expect(asked(state.incoming)).toEqual([MAIL_ID]);
    expect(asked(state.outgoing)).toEqual(['']);
  });

  it('исходящий регистр читается своим хуком, а не чужими данными', () => {
    state.incoming.data = [
      historyEntry({
        id: 'in1',
        type: 'deleted',
        changed_at: '2026-10-09T09:00:00',
        author_name: 'Входящий автор',
      }),
    ];
    state.outgoing.data = TWO_UPDATES;
    renderModal({ mailType: 'outgoing' });

    expect(asked(state.outgoing)).toEqual([MAIL_ID]);
    expect(asked(state.incoming)).toEqual(['']);
    // Лента собрана из исходящего хука, и подпись записи — единый узел
    // «время · автор»: искать по одному автору нельзя.
    expect(screen.getByText('09.10.2026 12:00:00 · Петрова М. М.')).toBeInTheDocument();
    expect(screen.queryByText('09.10.2026 09:00:00 · Входящий автор')).not.toBeInTheDocument();
  });

  it('закрытая модалка не спрашивает историю вовсе', () => {
    state.incoming.data = RESTORE_FLOW;
    renderModal({ opened: false });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(asked(state.incoming)).toEqual(['']);
    expect(asked(state.outgoing)).toEqual(['']);
  });

  it('без выбранного письма запрос не уходит, а не уходит «в никуда»', () => {
    renderModal({ mailId: null });

    expect(asked(state.incoming)).toEqual(['']);
    expect(asked(state.outgoing)).toEqual(['']);
  });
});

describe('MailHistoryModal — состояния запроса', () => {
  it('пока история грузится, виден индикатор и ничего кроме него', () => {
    state.incoming.isLoading = true;
    renderModal();

    expect(loader()).not.toBeNull();
    expect(timeline()).toEqual([]);
    expect(screen.queryByText('Изменений пока нет')).not.toBeInTheDocument();
  });

  it('незавершённая загрузка не показывает ошибку даже вместе с обрывом', () => {
    state.incoming.isLoading = true;
    state.incoming.isError = true;
    renderModal();

    expect(loader()).not.toBeNull();
    expect(screen.queryByText('Не удалось загрузить историю письма')).not.toBeInTheDocument();
  });

  it('обрыв загрузки назван прямо и не прячется за лентой', () => {
    state.incoming.isError = true;
    state.incoming.data = RESTORE_FLOW;
    renderModal();

    expect(screen.getByText('Не удалось загрузить историю письма')).toBeInTheDocument();
    expect(loader()).toBeNull();
    // Ошибка читается как «истории нет», а не как «письмо никогда не менялось»:
    // записи под ней принадлежали бы данным, которых не пришло.
    expect(timeline()).toEqual([]);
  });

  it('пустой ответ не остаётся пустым: лента получает запись о создании', () => {
    state.incoming.data = [];
    renderModal();

    // Запись о создании дописывается всегда, поэтому подпись «Изменений пока
    // нет» недостижима: пустой ответ выглядит как «письмо только что создали» —
    // что для истории одного письма и есть правда.
    expect(screen.queryByText('Изменений пока нет')).not.toBeInTheDocument();
    expect(timeline()).toEqual([CREATED_LABEL]);
    expect(screen.getByText(`09.10.2026 12:00:03 · ${CREATED_BY}`)).toBeInTheDocument();
    expect(connectors()).toHaveLength(0);
  });
});

describe('MailHistoryModal — лента событий', () => {
  it('свежее сверху, а создание — в самом конце, даже если оно было в середине', () => {
    state.incoming.data = RESTORE_FLOW;
    renderModal();

    // После восстановления из архива запись `created` приходит переписанной и
    // в середине ленты; «создано раньше всего» обязано быть истиной на экране,
    // иначе письмо выглядит созданным после того, как его восстановили.
    expect(timeline()).toEqual([RESTORED_LABEL, UPDATED_LABEL, DELETED_LABEL, CREATED_LABEL]);
    expect(connectors()).toHaveLength(3);
  });

  it('у каждого типа события своя иконка', () => {
    state.incoming.data = [
      historyEntry({ id: 'h1', type: 'created', changed_at: '2026-10-09T10:00:00' }),
      historyEntry({ id: 'h2', type: 'updated', changed_at: '2026-10-09T10:00:01' }),
      historyEntry({ id: 'h3', type: 'deleted', changed_at: '2026-10-09T10:00:02' }),
      historyEntry({ id: 'h4', type: 'restored', changed_at: '2026-10-09T10:00:03' }),
      historyEntry({ id: 'h5', type: 'linked', changed_at: '2026-10-09T10:00:04' }),
      historyEntry({ id: 'h6', type: 'unlinked', changed_at: '2026-10-09T10:00:05' }),
    ];
    renderModal();

    expect(timeline()).toEqual([
      UNLINKED_LABEL,
      LINKED_LABEL,
      RESTORED_LABEL,
      DELETED_LABEL,
      UPDATED_LABEL,
      CREATED_LABEL,
    ]);
    expect(iconNames()).toEqual(['link-off', 'link', 'restore', 'trash', 'pencil', 'plus']);
  });

  it('подпись записи — время с секундами и автор', () => {
    state.incoming.data = RESTORE_FLOW;
    renderModal();

    expect(screen.getByText('09.10.2026 12:00:04 · Сидоров С. С.')).toBeInTheDocument();
    expect(screen.getByText('09.10.2026 12:00:02 · Иванов И. И.')).toBeInTheDocument();
    expect(screen.getByText(`09.10.2026 12:00:03 · ${CREATED_BY}`)).toBeInTheDocument();
  });

  it('запись без имени автора подписывается прочерком', () => {
    state.incoming.data = [
      historyEntry({
        id: 'h1',
        type: 'deleted',
        changed_at: '2026-10-09T12:00:01',
        author: '',
        author_name: '',
      }),
    ];
    renderModal();

    expect(screen.getByText('09.10.2026 12:00:01 · —')).toBeInTheDocument();
  });

  it('запись об удалении называет, кто удалил', () => {
    state.incoming.data = RESTORE_FLOW;
    renderModal();

    expect(screen.getByText('Удалён: Петрова М. М.')).toBeInTheDocument();
  });

  it('без снимка строки запись о создании берёт время самой свежей записи', () => {
    state.incoming.data = [
      historyEntry({
        id: 'h1',
        type: 'updated',
        changed_at: '2026-10-09T12:00:02',
        author_name: 'Иванов И. И.',
      }),
      historyEntry({
        id: 'h2',
        type: 'restored',
        changed_at: '2026-10-09T12:00:04',
        author_name: 'Сидоров С. С.',
      }),
    ];
    renderModal({ createdAt: undefined, createdByName: undefined });

    // Записи `created` в истории нет — она собирается из строки таблицы, а
    // снимка строки тоже нет. Время берётся у самой свежей записи, а не у
    // текущего момента: иначе создание встало бы выше восстановления.
    expect(timeline()).toEqual([RESTORED_LABEL, UPDATED_LABEL, CREATED_LABEL]);
    expect(screen.getByText('09.10.2026 12:00:04 · —')).toBeInTheDocument();
  });
});

describe('MailHistoryModal — изменения полей', () => {
  it('изменённое поле показывается чипом «старое → новое», старое зачёркнуто', () => {
    state.incoming.data = TWO_UPDATES;
    renderModal();

    expect(screen.getByText('Старые значения зачёркнуты')).toBeInTheDocument();
    expect(diffChips()).toEqual([
      'Тема: Новая тема → —',
      'Номер письма: ВХ-77 → —',
      'Тема: Старая тема → Новая тема',
    ]);
    const changed = diffChipNodes().find(
      (node) => node.textContent === 'Тема: Старая тема → Новая тема',
    );
    if (!changed) throw new Error('чипа правки темы нет в ленте');
    expect(within(changed).getByText('Старая тема')).toHaveStyle({
      textDecoration: 'line-through',
    });
    expect(within(changed).getByText('Новая тема')).not.toHaveStyle({
      textDecoration: 'line-through',
    });
  });

  it('неизменённое поле чипом не помечается', () => {
    state.incoming.data = TWO_UPDATES;
    renderModal();

    // `number` в обеих правках один и тот же: пара «ВХ-77 → ВХ-77» ничего не
    // сообщает читателю и в ленте занимала бы место.
    expect(diffChips().filter((chip) => chip.startsWith('Номер письма: ВХ-77 → ВХ-77'))).toEqual(
      [],
    );
  });

  it('без изменений подсказка про зачёркнутые значения не появляется', () => {
    state.incoming.data = [historyEntry({ id: 'h1', type: 'deleted', changed_at: CREATED_AT })];
    renderModal();

    expect(diffChips()).toEqual([]);
    expect(screen.queryByText('Старые значения зачёркнуты')).not.toBeInTheDocument();
  });
});

describe('MailHistoryModal — закрытие', () => {
  it('крестик в шапке зовёт onClose', async () => {
    const user = userEvent.setup();
    state.incoming.data = RESTORE_FLOW;
    const { onClose } = renderModal();

    await user.click(closeButton());

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('клик по подложке зовёт onClose', async () => {
    const user = userEvent.setup();
    state.incoming.data = RESTORE_FLOW;
    const { onClose } = renderModal();

    await user.click(overlay());

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
