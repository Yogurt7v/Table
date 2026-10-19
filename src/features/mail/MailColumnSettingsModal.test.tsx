import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { renderWithProviders } from '@/mocks/test-utils';
import { MailColumnSettingsModal } from './MailColumnSettingsModal';
import { DEFAULT_VISIBLE_COLUMNS } from './mail-columns';
import type { MailColumnId } from './mail-columns';
import { NO_MAIL_PERMISSIONS } from './mail-field-access';
import type { MailPermissions } from './mail-field-access';
import type { MailType } from '@/shared/types';

/**
 * Настройка видимых колонок реестра писем.
 *
 * Модалка ничего не знает о хранилище: `onChange` — это колбэк родителя, а не
 * запрос, поэтому здесь нет ни запроса, ни отказа сервера, и проверять нечего.
 * Всё, что в этой модалке может тихо сломаться, — это то, ЧТО она отдаёт:
 *
 *  1. **Состав списка.** Строка настройки — это ровно одна колонка, разрешённая
 *     правами: `files` требует `canManageFiles`, `actions` — любого из четырёх
 *     прав на правку/удаление. Ошибка здесь не косметическая: колонка, право на
 *     которую отозвали, вернулась бы в список и сохранилась обратно в настройку,
 *     хотя таблица её всё равно не рисует, — человек снимает галочку, а толку
 *     никакого.
 *  2. **Порядок.** Порядок сохранённых колонок становится порядком строк, а
 *     невыбранные дописываются в конец выключенными. Если бы дописывание шло
 *     первым, то включение колонки в конце списка переставляло бы строку
 *     таблицы не туда, куда её поставили мышкой.
 *  3. **Подписи.** Подпись колонки у входящих и исходящих разная («Отправитель»
 *     против «Получателя»), и список настроек обязан называть её тем же, чем
 *     называет таблица: строку в списке иначе не с чем сопоставить.
 *  4. **Границы.** Пустое сохранённое значение — это «всё выключено», а не
 *     «пустой список строк»; снятие последней галочки сохраняет пустой набор,
 *     потому что защиты здесь нет вовсе.
 *
 * Три решения, которые видно в моках и в подаче тестов.
 *
 * - **`@dnd-kit/core` подменён частично** — той же формы, что и в
 *   `MailThreadNode.test.tsx`: в jsdom у элементов нет геометрии, поэтому
 *   `closestCenter` не выбирает цель, а `PointerSensor` не срабатывает от
 *   синтетических событий. Подменён только `DndContext` — он теперь
 *   отдаёт `children` и запоминает `onDragEnd`, — а `useSensor`, `useSensors`
 *   и весь `@dnd-kit/sortable` остаются настоящими, так что строка честно
 *   регистрируется как sortable и её атрибуты настоящие.
 * - **Реквизиты меняются через `rerender` на том же узле отрисовки, а не
 *   вторым `render`:** два `render` оставили бы в теле документа две модалки,
 *   и `screen` искал бы в первой, то есть уже неактуальной.
 * - **Состояние берётся из ленивого инициализатора `useState`, а не из
 *   пропсов на каждом рендере.** Это проверяется явно и отдельно: смена `value`
 *   при уже смонтированной модалке список НЕ перестраивает.
 */

type DragEndHandler = (event: { active: { id: string }; over: { id: string } | null }) => void;

const dnd = vi.hoisted(() => ({ onDragEnd: null as DragEndHandler | null }));

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>();
  return {
    ...actual,
    DndContext: ((props: { children: ReactNode; onDragEnd?: DragEndHandler }) => {
      dnd.onDragEnd = props.onDragEnd ?? null;
      return props.children;
    }) as unknown as typeof actual.DndContext,
  };
});

// ─── Данные ───

/** Все права включены: открывает и `files`, и `actions`. */
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

/** Подписи входящих в каноническом порядке `ALL_MAIL_COLUMNS`. */
const INCOMING_LABELS = [
  '№',
  'Дата',
  'Номер письма',
  'Отправитель',
  'Номер отправителя',
  'Тема',
  'Ответственный',
  'Способ доставки',
  'Объект учёта',
  'Файлы',
  'Дата создания',
  'Переписка',
  'Действия',
];

/** Подписи исходящих: у трёх колонок слово зависит от регистра. */
const OUTGOING_LABELS = INCOMING_LABELS.map((label) =>
  label === 'Отправитель'
    ? 'Получатель'
    : label === 'Номер отправителя'
      ? 'Номер контрагента'
      : label === 'Номер письма'
        ? 'Исходящий номер'
        : label,
);

/** Те же подписи без колонок, которые открываются отдельным правом. */
const WITHOUT_FILES_AND_ACTIONS = INCOMING_LABELS.filter(
  (label) => label !== 'Файлы' && label !== 'Действия',
);

/** Порядок строк при `value={['seq', 'subject']}`: сохранённые первыми. */
const SEQ_THEN_SUBJECT = [
  '№',
  'Тема',
  ...INCOMING_LABELS.filter((label) => label !== '№' && label !== 'Тема'),
];

// ─── Рендер ───

type ModalProps = Parameters<typeof MailColumnSettingsModal>[0];

function renderModal(overrides: Partial<ModalProps> = {}) {
  return renderWithProviders(
    <MailColumnSettingsModal
      opened
      value={DEFAULT_VISIBLE_COLUMNS}
      onChange={vi.fn()}
      onClose={vi.fn()}
      permissions={ALL_PERMISSIONS}
      mailType="incoming"
      {...overrides}
    />,
  );
}

/**
 * Mantine открывает тело модалки через переход, поэтому после `rerender` оно
 * появляется не в том же тике: без `findByRole` проверка читала бы пустой
 * документ и проходила бы на любом коде.
 */
async function openModal(overrides: Partial<ModalProps> = {}) {
  const view = renderModal(overrides);
  await screen.findByRole('dialog', { name: 'Настройка колонок' });
  return view;
}

/** Mantine связывает `<label>` с `<input>` через `htmlFor`, а не вложением. */
function labelOf(input: HTMLElement): string {
  return (input as HTMLInputElement).labels?.[0]?.textContent?.trim() ?? '';
}

/** Подписи строк в том порядке, в каком они нарисованы. */
function columnOrder(): string[] {
  return screen.getAllByRole('checkbox').map(labelOf);
}

function checkedLabels(): string[] {
  return screen
    .getAllByRole('checkbox')
    .filter((box) => (box as HTMLInputElement).checked)
    .map(labelOf);
}

function column(label: string): HTMLElement {
  return screen.getByRole('checkbox', { name: label });
}

/** Завершить перетаскивание так, как это сделал бы dnd-kit. */
function dragOver(activeId: MailColumnId, overId: MailColumnId | null): void {
  expect(dnd.onDragEnd).toBeTypeOf('function');
  act(() => {
    dnd.onDragEnd?.({ active: { id: activeId }, over: overId === null ? null : { id: overId } });
  });
}

let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  dnd.onDragEnd = null;
  user = userEvent.setup();
});

// ─── Закрытое состояние ───

describe('MailColumnSettingsModal — закрытое состояние', () => {
  it('при opened=false тело модалки не рисуется вовсе', () => {
    renderModal({ opened: false });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Настройка колонок')).not.toBeInTheDocument();
    expect(screen.queryByText('Сбросить')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('смена opened на том же узле отрисовки открывает список без переустановки', async () => {
    const view = renderModal({ opened: false, value: ['seq', 'subject'] });

    view.rerender(
      <MailColumnSettingsModal
        opened
        value={['seq', 'subject']}
        onChange={vi.fn()}
        onClose={vi.fn()}
        permissions={ALL_PERMISSIONS}
        mailType="incoming"
      />,
    );

    expect(await screen.findByRole('dialog', { name: 'Настройка колонок' })).toBeInTheDocument();
    expect(columnOrder()).toEqual([
      '№',
      'Тема',
      'Дата',
      'Номер письма',
      'Отправитель',
      'Номер отправителя',
      'Ответственный',
      'Способ доставки',
      'Объект учёта',
      'Файлы',
      'Дата создания',
      'Переписка',
      'Действия',
    ]);
  });
});

// ─── Список колонок ───

describe('MailColumnSettingsModal — список колонок', () => {
  it('заголовок и подсказка называют то, что делает модалка', async () => {
    await openModal();

    expect(screen.getByRole('dialog', { name: 'Настройка колонок' })).toBeInTheDocument();
    expect(
      screen.getByText('Перетащите колонки для изменения порядка, отметьте видимые'),
    ).toBeInTheDocument();
  });

  it('все разрешённые колонки показаны в каноническом порядке и отмечены', async () => {
    await openModal();

    expect(columnOrder()).toEqual(INCOMING_LABELS);
    expect(checkedLabels()).toEqual(INCOMING_LABELS);
  });

  it('у исходящих три подписи называют регистр, а не «контрагента»', async () => {
    await openModal({ mailType: 'outgoing' });

    expect(columnOrder()).toEqual(OUTGOING_LABELS);
    expect(column('Получатель')).toBeChecked();
    expect(column('Исходящий номер')).toBeChecked();
    expect(column('Номер контрагента')).toBeChecked();
    expect(screen.queryByLabelText('Отправитель')).not.toBeInTheDocument();
  });
});

// ─── Права ───

describe('MailColumnSettingsModal — права открывают строки', () => {
  it('без прав на вложения и действия в списке одиннадцать строк', async () => {
    await openModal({ permissions: NO_MAIL_PERMISSIONS });

    expect(columnOrder()).toEqual(WITHOUT_FILES_AND_ACTIONS);
    expect(screen.queryByLabelText('Файлы')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Действия')).not.toBeInTheDocument();
  });

  it('canManageFiles открывает «Файлы», но не открывает «Действия»', async () => {
    await openModal({ permissions: { ...NO_MAIL_PERMISSIONS, canManageFiles: true } });

    expect(column('Файлы')).toBeInTheDocument();
    expect(screen.queryByLabelText('Действия')).not.toBeInTheDocument();
  });

  it('любое из четырёх прав на правку или удаление открывает «Действия»', async () => {
    await openModal({ permissions: { ...NO_MAIL_PERMISSIONS, canDeleteOutgoing: true } });

    expect(column('Действия')).toBeInTheDocument();
    expect(screen.queryByLabelText('Файлы')).not.toBeInTheDocument();
  });

  it('колонка, право на которую отозвали, из списка исчезает даже из настройки', async () => {
    const onChange = vi.fn();
    await openModal({
      permissions: { ...NO_MAIL_PERMISSIONS, canDeleteIncoming: true },
      value: ['files', 'seq', 'actions'],
      onChange,
    });

    // «Файлы» не только не показана — её нет и среди отмеченных, иначе сохранение
    // вернуло бы в настройку колонку, которую таблица всё равно не рисует.
    expect(columnOrder()).toEqual(['№', 'Действия', ...WITHOUT_FILES_AND_ACTIONS.slice(1)]);
    expect(checkedLabels()).toEqual(['№', 'Действия']);
  });
});

// ─── Выбранные колонки ───

describe('MailColumnSettingsModal — что отмечено на входе', () => {
  it('сохранённые идут первыми в сохранённом порядке, остальные дописываются выключенными', async () => {
    await openModal({ value: ['subject', 'seq', 'number'] });

    expect(columnOrder()).toEqual([
      'Тема',
      '№',
      'Номер письма',
      'Дата',
      'Отправитель',
      'Номер отправителя',
      'Ответственный',
      'Способ доставки',
      'Объект учёта',
      'Файлы',
      'Дата создания',
      'Переписка',
      'Действия',
    ]);
    expect(checkedLabels()).toEqual(['Тема', '№', 'Номер письма']);
  });

  it('пустое значение — это «всё выключено», а не «пустой список строк»', async () => {
    await openModal({ value: [] });

    expect(columnOrder()).toEqual(INCOMING_LABELS);
    expect(checkedLabels()).toEqual([]);
  });

  it('уже смонтированная модалка не перечитывает value: список строится один раз', async () => {
    const view = await openModal({ value: ['seq'] });

    view.rerender(
      <MailColumnSettingsModal
        opened
        value={['subject', 'date']}
        onChange={vi.fn()}
        onClose={vi.fn()}
        permissions={ALL_PERMISSIONS}
        mailType="incoming"
      />,
    );

    // Инициализатор `useState` отработал при монтировании; новый `value` — это
    // уже другое письмо, а не переключение права.
    expect(checkedLabels()).toEqual(['№']);
    expect(columnOrder()).toEqual(['№', ...INCOMING_LABELS.slice(1)]);
  });
});

// ─── Переключение ───

describe('MailColumnSettingsModal — переключение колонки', () => {
  it('снятие галочки гасит только свою строку', async () => {
    await openModal({ value: ['seq', 'subject'] });

    await user.click(column('Тема'));

    expect(column('Тема')).not.toBeChecked();
    expect(column('№')).toBeChecked();
    expect(checkedLabels()).toEqual(['№']);
  });

  it('повторный клик возвращает галочку', async () => {
    await openModal({ value: ['seq'] });

    await user.click(column('№'));
    await user.click(column('№'));

    expect(column('№')).toBeChecked();
    expect(checkedLabels()).toEqual(['№']);
  });

  it('клик по строке не тащит её указателем: галочка меняется, а перетаскивание — нет', async () => {
    await openModal({ value: ['seq', 'subject'] });

    await user.click(column('Дата'));

    expect(column('Дата')).toBeChecked();
    expect(columnOrder()).toEqual(SEQ_THEN_SUBJECT);
  });
});

// ─── Сброс ───

describe('MailColumnSettingsModal — сброс', () => {
  it('возвращает полный набор по умолчанию в каноническом порядке и ничего не сохраняет', async () => {
    const onChange = vi.fn();
    await openModal({ permissions: NO_MAIL_PERMISSIONS, value: ['subject'], onChange });

    await user.click(column('Тема'));
    await user.click(screen.getByRole('button', { name: 'Сбросить' }));

    expect(checkedLabels()).toEqual(WITHOUT_FILES_AND_ACTIONS);
    expect(columnOrder()).toEqual(WITHOUT_FILES_AND_ACTIONS);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('сброс переставляет строки в канонический порядок, а не возвращает их как были', async () => {
    await openModal({ value: ['subject', 'seq', 'number'] });

    await user.click(screen.getByRole('button', { name: 'Сбросить' }));

    expect(columnOrder()).toEqual(INCOMING_LABELS);
    expect(checkedLabels()).toEqual(INCOMING_LABELS);
  });
});

// ─── Сохранение ───

describe('MailColumnSettingsModal — сохранение', () => {
  it('отдаёт новый набор колонок и только потом закрывается', async () => {
    const calls: string[] = [];
    const onChange = vi.fn(() => {
      calls.push('change');
    });
    const onClose = vi.fn(() => {
      calls.push('close');
    });
    await openModal({ value: ['seq', 'subject'], onChange, onClose });

    await user.click(column('Тема'));
    await user.click(column('Действия'));
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(['seq', 'actions']);
    expect(calls).toEqual(['change', 'close']);
  });

  it('порядок строк — это порядок аргумента, а не порядок value', async () => {
    const onChange = vi.fn();
    await openModal({ value: ['seq', 'subject'], onChange });

    dragOver('subject', 'seq');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(columnOrder().slice(0, 2)).toEqual(['Тема', '№']);
    expect(onChange).toHaveBeenCalledWith(['subject', 'seq']);
  });

  it('снятие последней галочки сохраняет пустой набор — защиты здесь нет', async () => {
    const onChange = vi.fn();
    await openModal({ permissions: NO_MAIL_PERMISSIONS, value: ['seq'], onChange });

    await user.click(column('№'));
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    // Явно фиксируем фактическое поведение: модалка не мешает скрыть всё.
    // Если защита появится, этот тест упадёт и скажет, что контракт поменялся.
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('отказ onChange уходит наружу: модалка не закрывается и отказа не показывает', async () => {
    const failure = new Error('сохранение отклонено');
    const uncaught: unknown[] = [];
    const swallow = (event: ErrorEvent) => {
      if (event.error !== failure) return;
      uncaught.push(event.error);
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    window.addEventListener('error', swallow);
    try {
      const onChange = vi.fn(() => {
        throw failure;
      });
      const onClose = vi.fn();
      await openModal({ value: ['seq'], onChange, onClose });

      await user.click(screen.getByRole('button', { name: 'Сохранить' }));

      // Своего пути отказа у модалки нет: ни `catch`, ни текста об ошибке. Ошибка
      // родителя уходит наружу, и `onClose` после неё уже не вызывается.
      expect(uncaught).toEqual([failure]);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog', { name: 'Настройка колонок' })).toBeInTheDocument();
    } finally {
      window.removeEventListener('error', swallow);
    }
  });
});

// ─── Отмена ───

describe('MailColumnSettingsModal — закрытие без сохранения', () => {
  it('«Отмена» закрывает модалку и не отдаёт новый набор', async () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    await openModal({ value: ['seq', 'subject'], onChange, onClose });

    await user.click(column('Тема'));
    await user.click(screen.getByRole('button', { name: 'Отмена' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('Escape закрывает модалку тем же onClose', async () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    await openModal({ value: ['seq'], onChange, onClose });

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });
});

// ─── Перетаскивание ───

describe('MailColumnSettingsModal — перетаскивание', () => {
  it('сброс без цели ничего не двигает', async () => {
    await openModal({ value: ['seq', 'subject'] });

    dragOver('seq', null);

    expect(columnOrder()).toEqual(SEQ_THEN_SUBJECT);
  });

  it('брошенная на себя строка ничего не двигает', async () => {
    await openModal({ value: ['seq', 'subject'] });

    dragOver('seq', 'seq');

    expect(columnOrder()).toEqual(SEQ_THEN_SUBJECT);
  });

  it('строка, брошенная на другую, встаёт на её место', async () => {
    const onChange = vi.fn();
    await openModal({ value: ['seq', 'subject'], onChange });

    dragOver('seq', 'subject');

    expect(columnOrder().slice(0, 2)).toEqual(['Тема', '№']);

    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(onChange).toHaveBeenCalledWith(['subject', 'seq']);
  });

  it('перестановка выключенной строки не выдаёт её за выбранную', async () => {
    const onChange = vi.fn();
    await openModal({ value: ['seq'], onChange });

    dragOver('files', 'seq');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(onChange).toHaveBeenCalledWith(['seq']);
  });

  it('после перестановки сброс всё равно возвращает канонический порядок', async () => {
    await openModal({ value: ['seq', 'subject'] });

    dragOver('seq', 'subject');
    await user.click(screen.getByRole('button', { name: 'Сбросить' }));

    expect(columnOrder()).toEqual(INCOMING_LABELS);
  });
});

// ─── Тип регистра ───

describe('MailColumnSettingsModal — регистр письма', () => {
  it.each<[MailType, string[]]>([
    ['incoming', ['Отправитель', 'Номер отправителя', 'Номер письма']],
    ['outgoing', ['Получатель', 'Номер контрагента', 'Исходящий номер']],
  ])('у %s три подписи контрагента свои, чужих в списке нет', async (mailType, own) => {
    const onChange = vi.fn();
    await openModal({
      mailType,
      value: ['counterparty', 'counterparty_number', 'number'],
      onChange,
    });

    expect(columnOrder().slice(0, 3)).toEqual(own);
    expect(checkedLabels()).toEqual(own);

    const чужое = own[0] === 'Отправитель' ? 'Получатель' : 'Отправитель';
    expect(screen.queryByLabelText(чужое)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(onChange).toHaveBeenCalledWith(['counterparty', 'counterparty_number', 'number']);
  });
});
