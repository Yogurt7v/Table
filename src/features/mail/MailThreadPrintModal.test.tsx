import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/mocks/test-utils';
import type { IMailFile, MailType } from '@/shared/types';
import { MailThreadPrintModal } from './MailThreadPrintModal';
import { mailNodeKey } from './mail-thread';
import type { MailNodeKey } from './mail-thread';
import type { ThreadLineNode } from './mail-thread-builder';
import { mailPrintFileUrl } from './mail-thread-print';

/**
 * Печать вложений переписки — модалка, которая собирает из отмеченного один
 * документ и отдаёт его `window.print()`. Печать уходит мимо экрана, поэтому
 * проверяется не «как это выглядит», а **что именно соберётся на лист**.
 *
 * Разбор линии писем, тип файла, подпись письма и счётчик живут в чистом
 * `mail-thread-print.ts` и закрыты своим тестом. Здесь — только то, что делает
 * сама модалка поверх них:
 *
 *  1. **`printFileNote`.** Единственное место, где читатель узнаёт, что вложение
 *     на бумагу не попало. Файл, который не удалось получить, обязан остаться на
 *     листе с пометкой: исчезнув молча, переписка напечатается полной, а
 *     отсутствующая страница скана обнаружится позже и уже не там, где искали.
 *     Пометка о провале важнее любой другой, поэтому она выбирается первой — в том
 *     числе для файла, который печатать иначе было бы нечем: «нечем» не страшно,
 *     а вот сорванное вложение может означать, что отсканированной страницы,
 *     на которую ссылается письмо, больше нет.
 *  2. **Разбор блобов.** Отмеченный файл качается заранее, и у каждого свой
 *     итог: получен, не получен, ещё не получен. Провал обязан отличаться от
 *     «ещё не получен» и не должен намертво блокировать кнопку печати. Поэтому
 *     запрос, который не ответил никогда, тоже обязан стать провалом — иначе одно
 *     зависшее вложение выключает печать всего документа.
 *  3. **Сборка строк.** На лист идут только отмеченные файлы и только те письма,
 *     у которых что-то отмечено, — в порядке переписки.
 *
 * Два решения в замоках, и почему они именно такие:
 *
 * - **Данные подменены на уровне хуков, а не сети.** `useOrgMailFiles` отдаёт
 *   строки `mail_files`, а цепочку, порядок и подписи по-прежнему считают
 *   настоящие `buildThreadPrintLetters`, `groupPrintFilesByLetter` и
 *   `printLetterHeading`. Тест управляет письмами и вложениями, а не HTTP.
 * - **`fetch` подменён по адресу файла.** Модалка читает `fetch(entry.url)`, и
 *   адрес — ровно тот, что считает `mailPrintFileUrl`. Отдельный сценарий
 *   ответа на каждый способ сорваться: `ok: false`, обрыв сети и нечитаемое
 *   тело обязаны давать одну и ту же пометку, иначе «файл не пришёл» выглядел бы
 *   по-разному в зависимости от того, где именно порвалось.
 */

const ORG_ID = 'org0000000000001';

const inKey = (id: string): MailNodeKey => mailNodeKey('incoming', id);
const outKey = (id: string): MailNodeKey => mailNodeKey('outgoing', id);

type ModalProps = Parameters<typeof MailThreadPrintModal>[0];

/** Что ответит `fetch` на конкретный адрес вложения. */
type FetchOutcome = 'ready' | 'pending' | 'not-ok' | 'network-error' | 'unreadable-body';

const state = vi.hoisted(() => ({
  files: [] as IMailFile[],
  isLoading: false,
  isError: false,
  /** Пустой `orgId` — запроса не будет: модалка спрашивает вложения по факту открытия. */
  lastOrgId: '',
  /** Адрес файла → сценарий ответа. Нет записи — файл приходит. */
  plan: new Map<string, FetchOutcome>(),
}));

vi.mock('./useOrgMailFiles', () => ({
  useOrgMailFiles: (orgId: string) => {
    state.lastOrgId = orgId;
    return { data: state.files, isLoading: state.isLoading, isError: state.isError };
  },
}));

/**
 * Три заметки из `printFileNote` — весь контракт модалки с читателем. Живут
 * здесь строкой, а не импортом: они не экспортированы, и это единственное, что
 * видит человек на листе, когда файл на него не попал.
 *
 * Порядок выбора — часть контракта, а не деталь реализации: `NOTE_FAILED`
 * выигрывает у обеих остальных и у любого типа файла, а вот `NOTE_OTHER` и
 * `NOTE_LOADING` между собой равноправны только для одного типа — для `.docx`
 * «нечем» перебивает «ещё не готово», потому что грузящийся `.docx` всё равно
 * не напечатает содержимое.
 */
const NOTE_OTHER =
  'Содержимое файла на печать не выводится — в документ попадёт только его название.';
const NOTE_LOADING = 'Файл ещё не получен — печать начнётся, когда он будет готов.';
const NOTE_FAILED = 'Файл получить не удалось: вложение недоступно или удалено.';

/** Хвост подписи флажка у файла, печатаемого только названием. */
const OTHER_CHECKBOX_SUFFIX = ' — печатается только название';

/**
 * Предел ожидания в модалке, повторённый здесь числом: константа не
 * экспортирована, а тесту нужно знать, на сколько перевести часы. Правка
 * модалки обязана ронять и этот тест — иначе рассинхрон заметят только в
 * браузере.
 */
const BLOB_TIMEOUT_MS = 60_000;

// ─── Сеть и объектные адреса ───

function fakeResponse(ok: boolean, body?: () => Promise<Blob>): Response {
  return {
    ok,
    status: ok ? 200 : 404,
    blob: body ?? (() => Promise.resolve(new Blob(['вложение']))),
  } as unknown as Response;
}

const fetchMock = vi.fn((input: unknown): Promise<Response> => {
  const outcome = state.plan.get(String(input)) ?? 'ready';
  if (outcome === 'pending') return new Promise<Response>(() => undefined);
  if (outcome === 'network-error') return Promise.reject(new Error('сеть недоступна'));
  if (outcome === 'not-ok') return Promise.resolve(fakeResponse(false));
  if (outcome === 'unreadable-body') {
    return Promise.resolve(
      fakeResponse(true, () => Promise.reject(new Error('тело не прочиталось'))),
    );
  }
  return Promise.resolve(fakeResponse(true));
});

let objectUrlSeq = 0;
const createObjectURLMock = vi.fn(() => `blob:mock/${(objectUrlSeq += 1)}`);
const revokeObjectURLMock = vi.fn();
const printMock = vi.fn();

const originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
const originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');

/** Адреса, которые хук действительно создал и отдал в разметку. */
function createdObjectUrls(): string[] {
  return createObjectURLMock.mock.results
    .map((result) => result.value)
    .filter((value): value is string => typeof value === 'string');
}

/** Адреса, по которым модалка действительно ходила за вложениями. */
function fetchedUrls(): string[] {
  return fetchMock.mock.calls.map((call) => String(call[0]));
}

// ─── Данные ───

function nodeOf(key: MailNodeKey, over: Partial<ThreadLineNode> = {}): ThreadLineNode {
  const id = key.slice(key.indexOf(':') + 1);
  const type: MailType = key.startsWith('incoming') ? 'incoming' : 'outgoing';
  return {
    key,
    type,
    id,
    depth: 0,
    parentKey: null,
    letter: {
      key,
      date: '2026-10-07',
      seq: 1,
      number: `№-${id}`,
      counterparty: `ООО «${id}»`,
      subject: 'Счёт',
    },
    index: 0,
    ...over,
  };
}

function mailFile(
  id: string,
  mailId: string,
  over: Partial<IMailFile> & { mail_type?: MailType } = {},
): IMailFile {
  const mailType = over.mail_type ?? 'incoming';
  return {
    id,
    mail_id: mailId,
    mail_type: mailType,
    organization_id: ORG_ID,
    file: [`${id}.pdf`],
    name: `${id}.pdf`,
    ...over,
  };
}

/** Адрес, который модалка скормит `fetch`: тот же, что считает сама печать. */
function urlOf(record: IMailFile, storedName: string): string {
  return mailPrintFileUrl(record, storedName);
}

// ─── Рендер ───

function renderModal(overrides: Partial<ModalProps> = {}) {
  return renderWithProviders(
    <MailThreadPrintModal opened onClose={vi.fn()} orgId={ORG_ID} nodes={[]} wide {...overrides} />,
  );
}

/**
 * Дождаться разбора блобов: хук делает `await fetch`, потом `await blob()`,
 * и только потом пишет статус, поэтому одной микро-задачи мало — ждём границу
 * задач, после которой очередь микро-задач пуста.
 */
async function flushBlobs(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  state.files = [];
  state.isLoading = false;
  state.isError = false;
  state.lastOrgId = '';
  state.plan = new Map();
  objectUrlSeq = 0;
  fetchMock.mockClear();
  createObjectURLMock.mockClear();
  revokeObjectURLMock.mockClear();
  printMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  window.print = printMock;
  user = userEvent.setup();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ─── Запросы к разметке ───

/** Печатный документ: он в портале `body`, рядом с модалкой, а не внутри неё. */
function printRoot(): HTMLElement | null {
  return document.querySelector('.print-root');
}

function printedBlocks(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('.print-root .mail-print-block')];
}

/** Подписи писем на листе, сверху вниз: это и есть порядок напечатанной переписки. */
function printedHeadings(): string[] {
  return printedBlocks().map(
    (block) => block.querySelector('.mail-print-heading')?.textContent ?? '',
  );
}

/** Имена файлов на листе в порядке печати, включая имена без содержимого. */
function printedFileNames(): string[] {
  return [...document.querySelectorAll<HTMLElement>('.print-root .mail-print-file-name')].map(
    (element) => element.textContent ?? '',
  );
}

function fileBlockOf(displayName: string): HTMLElement {
  const block = [...document.querySelectorAll<HTMLElement>('.print-root .mail-print-file')].find(
    (element) => element.querySelector('.mail-print-file-name')?.textContent === displayName,
  );
  if (!block) throw new Error(`файла «${displayName}» нет в печатном документе`);
  return block;
}

/** Пометка на листе для файла; `null` — напечатано содержимое, замечать нечего. */
function noteOf(displayName: string): string | null {
  return fileBlockOf(displayName).querySelector('.mail-print-note')?.textContent ?? null;
}

/** Чем файл напечатан содержимым: картинкой, рамкой с PDF или ничем. */
function renderedTagOf(displayName: string): 'image' | 'frame' | null {
  const block = fileBlockOf(displayName);
  if (block.querySelector('.mail-print-image')) return 'image';
  if (block.querySelector('.mail-print-frame')) return 'frame';
  return null;
}

function modal(): HTMLElement {
  return screen.getByRole('dialog');
}

/**
 * Подпись флажка. Mantine связывает `<label>` с `<input>` через `htmlFor`, а не
 * вложением, поэтому текст берётся из `labels` — того же самой платформы, по
 * которому доступное имя вычисляет скринридер.
 */
function checkboxLabel(input: HTMLElement): string {
  return (input as HTMLInputElement).labels?.[0]?.textContent ?? '';
}

/** Подписи флажков в порядке показа: то, что человек отмечает руками. */
function pickerLabels(): string[] {
  return screen.getAllByRole('checkbox').map(checkboxLabel);
}

function checkboxFor(displayName: string): HTMLElement {
  const found = screen
    .getAllByRole('checkbox')
    .find((input) => checkboxLabel(input).startsWith(displayName));
  if (!found) throw new Error(`флажка для «${displayName}» нет в дереве выбора`);
  return found;
}

/** Отметить флажок и дождаться, пока блоб-ы дойдут до финального статуса. */
async function tick(displayName: string): Promise<void> {
  await user.click(checkboxFor(displayName));
  await flushBlobs();
}

function printButton(): HTMLElement {
  return screen.getByRole('button', { name: 'Печать' });
}

function preparingButton(): HTMLElement {
  return screen.getByRole('button', { name: 'Готовятся файлы…' });
}

function selectAllButton(): HTMLElement {
  return screen.getByRole('button', { name: 'Отметить все' });
}

function clearAllButton(): HTMLElement {
  return screen.getByRole('button', { name: 'Снять все' });
}

/** Счётчик выбора: оба числа сразу, поэтому сверяется целиком. */
function selectionCounter(): string {
  return within(modal()).getByText(/^Выбрано \d+ из \d+$/).textContent ?? '';
}

/**
 * Одно вложение одного письма, доведённое до нужного статуса блоба, и печатный
 * документ после его отметки. Короткий путь для проверки одного случая
 * `printFileNote`: девять пар «тип × статус» иначе пришлось бы вытаскивать из
 * одного листа и путать, чья это была пометка.
 */
async function printSingle(
  storedName: string,
  displayName: string,
  outcome: FetchOutcome,
): Promise<void> {
  const record = mailFile('rec1', 'a', { file: [storedName], name: displayName });
  state.files = [record];
  state.plan.set(urlOf(record, storedName), outcome);
  renderModal({ nodes: [nodeOf(inKey('a'))] });
  await tick(displayName);
}

// ─── printFileNote: тип файла × статус блоба ───

describe('MailThreadPrintModal — чем файл напечатан: тип × статус', () => {
  it('PDF получен — печатается содержимым, без всякой пометки', async () => {
    await printSingle('stored.pdf', 'Договор.pdf', 'ready');

    expect(noteOf('Договор.pdf')).toBeNull();
    expect(renderedTagOf('Договор.pdf')).toBe('frame');
  });

  it('картинка получена — печатается содержимым, без всякой пометки', async () => {
    await printSingle('stored.png', 'Скан.png', 'ready');

    expect(noteOf('Скан.png')).toBeNull();
    expect(renderedTagOf('Скан.png')).toBe('image');
  });

  it('PDF ещё не получен — об этом сказано прямо, а не пустым местом', async () => {
    await printSingle('stored.pdf', 'Договор.pdf', 'pending');

    expect(noteOf('Договор.pdf')).toBe(NOTE_LOADING);
    expect(renderedTagOf('Договор.pdf')).toBeNull();
  });

  it('картинка ещё не получена — об этом сказано прямо, а не пустым местом', async () => {
    await printSingle('stored.png', 'Скан.png', 'pending');

    expect(noteOf('Скан.png')).toBe(NOTE_LOADING);
    expect(renderedTagOf('Скан.png')).toBeNull();
  });

  it('PDF получить не удалось — файл остаётся на листе с пометкой о провале', async () => {
    await printSingle('stored.pdf', 'Договор.pdf', 'not-ok');

    expect(noteOf('Договор.pdf')).toBe(NOTE_FAILED);
    expect(renderedTagOf('Договор.pdf')).toBeNull();
  });

  it('картинку получить не удалось — файл остаётся на листе с пометкой о провале', async () => {
    await printSingle('stored.png', 'Скан.png', 'network-error');

    expect(noteOf('Скан.png')).toBe(NOTE_FAILED);
    expect(renderedTagOf('Скан.png')).toBeNull();
  });

  it('полученный .docx печатается только названием — «нечем» это не «не получилось»', async () => {
    await printSingle('stored.docx', 'Договор.docx', 'ready');

    expect(noteOf('Договор.docx')).toBe(NOTE_OTHER);
    expect(renderedTagOf('Договор.docx')).toBeNull();
  });

  it('незагруженный .docx объясняет именно тем, что печатать нечем', async () => {
    await printSingle('stored.docx', 'Договор.docx', 'pending');

    expect(noteOf('Договор.docx')).toBe(NOTE_OTHER);
  });

  it('недоступный .docx — это провал, а не «нечем»: сломан он как вложение, а не как тип', async () => {
    await printSingle('stored.docx', 'Договор.docx', 'not-ok');

    // Тип `.docx` говорит, что печатать нечем, но ничего не говорит о том, что
    // вложение цело. Провал сорванного вложения опаснее отсутствия содержимого:
    // «печатается только название» уверило бы читателя, что документ на месте,
    // и пропавший скан обнаружился бы уже после печати.
    expect(noteOf('Договор.docx')).toBe(NOTE_FAILED);
    expect(renderedTagOf('Договор.docx')).toBeNull();
  });

  it('провал перебивает и «нечем», и «ещё не готово» у каждого типа файла', async () => {
    // Раньше достаточно было проверить `.docx`: ошибочный порядок веток прятался
    // именно за «печатать нечем» и не был виден ни на картинке, ни на PDF, где
    // «нечем» не бывает. Все три типа обязаны называть провал провалом.
    const image = mailFile('f1', 'a', { file: ['one.png'], name: 'Скан.png' });
    const pdf = mailFile('f2', 'a', { file: ['two.pdf'], name: 'Договор.pdf' });
    const docx = mailFile('f3', 'a', { file: ['three.docx'], name: 'Приложение.docx' });
    state.files = [image, pdf, docx];
    state.plan.set(urlOf(image, 'one.png'), 'not-ok');
    state.plan.set(urlOf(pdf, 'two.pdf'), 'network-error');
    state.plan.set(urlOf(docx, 'three.docx'), 'unreadable-body');
    renderModal({ nodes: [nodeOf(inKey('a'))] });

    await user.click(selectAllButton());
    await flushBlobs();

    expect(noteOf('Скан.png')).toBe(NOTE_FAILED);
    expect(noteOf('Договор.pdf')).toBe(NOTE_FAILED);
    expect(noteOf('Приложение.docx')).toBe(NOTE_FAILED);
  });
});

describe('MailThreadPrintModal — неудача видна читателю, а не только модалке', () => {
  it('провал одного вложения не убирает из печати остальные', async () => {
    const broken = mailFile('bad', 'a', { file: ['broken.png'], name: 'Скан.png' });
    const good = mailFile('ok1', 'a', { file: ['contract.pdf'], name: 'Договор.pdf' });
    state.files = [broken, good];
    state.plan.set(urlOf(broken, 'broken.png'), 'network-error');
    renderModal({ nodes: [nodeOf(inKey('a'))] });

    await user.click(selectAllButton());
    await flushBlobs();

    // Провал одного файла не имеет права вычеркнуть из документа второй: иначе
    // читатель потерял бы не только отсутствующую страницу, но и то, что было рядом.
    expect(printedFileNames()).toEqual(['Скан.png', 'Договор.pdf']);
    expect(noteOf('Скан.png')).toBe(NOTE_FAILED);
    expect(noteOf('Договор.pdf')).toBeNull();
    expect(renderedTagOf('Договор.pdf')).toBe('frame');
  });

  it('провал в теле ответа — тот же провал, что и оборванная сеть', async () => {
    const unreadable = mailFile('bad', 'a', { file: ['one.png'], name: 'Скан-1.png' });
    const offline = mailFile('bad2', 'a', { file: ['two.png'], name: 'Скан-2.png' });
    state.files = [unreadable, offline];
    state.plan.set(urlOf(unreadable, 'one.png'), 'unreadable-body');
    state.plan.set(urlOf(offline, 'two.png'), 'network-error');
    renderModal({ nodes: [nodeOf(inKey('a'))] });

    await user.click(selectAllButton());
    await flushBlobs();

    // Разные обстоятельства провала, один и тот же ответ читателю.
    expect(noteOf('Скан-1.png')).toBe(NOTE_FAILED);
    expect(noteOf('Скан-2.png')).toBe(NOTE_FAILED);
  });

  it('помеченный провалом файл остаётся в самом документе, а не выпадает из него', async () => {
    await printSingle('stored.png', 'Скан.png', 'not-ok');

    expect(printedFileNames()).toEqual(['Скан.png']);
    expect(printedBlocks()).toHaveLength(1);
    expect(noteOf('Скан.png')).toBe(NOTE_FAILED);
  });
});

// ─── usePrintBlobs ───

describe('MailThreadPrintModal — разбор блобов отмеченных файлов', () => {
  it('в разметку идёт объектный адрес из createObjectURL, а не ссылка на хранилище', async () => {
    const record = mailFile('rec1', 'a', { file: ['stored.pdf'], name: 'Договор.pdf' });
    state.files = [record];
    renderModal({ nodes: [nodeOf(inKey('a'))] });

    await tick('Договор.pdf');

    expect(fetchedUrls()).toEqual([urlOf(record, 'stored.pdf')]);
    expect(createdObjectUrls()).toHaveLength(1);
    expect(fileBlockOf('Договор.pdf').querySelector('iframe')?.getAttribute('src')).toBe(
      createdObjectUrls()[0],
    );
  });

  it('незагруженный файл держит печать заблокированной и говорит об этом', async () => {
    const record = mailFile('rec1', 'a', { file: ['stored.pdf'], name: 'Договор.pdf' });
    state.files = [record];
    state.plan.set(urlOf(record, 'stored.pdf'), 'pending');
    renderModal({ nodes: [nodeOf(inKey('a'))] });

    await tick('Договор.pdf');

    expect(preparingButton()).toBeDisabled();
    expect(noteOf('Договор.pdf')).toBe(NOTE_LOADING);
  });

  it('запрос, не ответивший никогда, признаётся провалом и печать разблокируется', async () => {
    const record = mailFile('rec1', 'a', { file: ['stored.pdf'], name: 'Договор.pdf' });
    state.files = [record];
    state.plan.set(urlOf(record, 'stored.pdf'), 'pending');
    // Часы подменяются только здесь: подменённый на весь файл `Date.now` ломает
    // `waitFor` и `userEvent` в соседних случаях.
    vi.useFakeTimers();

    renderModal({ nodes: [nodeOf(inKey('a'))] });
    // Подменёнными часами `userEvent` пользоваться нельзя: он встаёт на ожидание
    // собственных таймеров, которые никто не двигает. Отметка флажка — обычный
    // `change`, поэтому её достаточно воспроизвести напрямую.
    fireEvent.click(checkboxFor('Договор.pdf'));

    expect(preparingButton()).toBeDisabled();
    expect(noteOf('Договор.pdf')).toBe(NOTE_LOADING);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(BLOB_TIMEOUT_MS);
    });

    // Ни ответа, ни обрыва не будет никогда: если бы итог не появился, кнопка
    // осталась бы на «Готовятся файлы…» навсегда, и это одно вложение выключило
    // бы печать всего документа — молча и без срока.
    expect(screen.queryByRole('button', { name: 'Готовятся файлы…' })).not.toBeInTheDocument();
    expect(printButton()).toBeEnabled();
    expect(noteOf('Договор.pdf')).toBe(NOTE_FAILED);
    expect(renderedTagOf('Договор.pdf')).toBeNull();
  });

  it('провал не превращается в готовый файл: на листе нет ни картинки, ни рамки', async () => {
    const record = mailFile('rec1', 'a', { file: ['stored.png'], name: 'Скан.png' });
    state.files = [record];
    state.plan.set(urlOf(record, 'stored.png'), 'network-error');
    renderModal({ nodes: [nodeOf(inKey('a'))] });

    await tick('Скан.png');

    // Статус «получен» при отсутствии блоба печатает пустой `<img src="">`:
    // страница выходит, а на ней ничего. Поэтому проверяется именно рамка
    // содержимого, а не только текст пометки.
    expect(renderedTagOf('Скан.png')).toBeNull();
    expect(fileBlockOf('Скан.png').querySelector('img')).toBeNull();
    expect(createdObjectUrls()).toHaveLength(0);
  });

  it('провал не блокирует печать: кнопка возвращается и документ уходит с пометкой', async () => {
    const record = mailFile('rec1', 'a', { file: ['stored.pdf'], name: 'Договор.pdf' });
    state.files = [record];
    state.plan.set(urlOf(record, 'stored.pdf'), 'network-error');
    renderModal({ nodes: [nodeOf(inKey('a'))] });

    await tick('Договор.pdf');

    // Провал — это уже разобранный итог, а не «ещё готовится»: иначе одно
    // недоступное вложение держало бы кнопку печати заблокированной навсегда.
    expect(screen.queryByRole('button', { name: 'Готовятся файлы…' })).not.toBeInTheDocument();
    expect(printButton()).toBeEnabled();
    expect(noteOf('Договор.pdf')).toBe(NOTE_FAILED);
  });

  it('у провалившегося файла объектного адреса не было — отпускать нечего', async () => {
    const record = mailFile('rec1', 'a', { file: ['stored.pdf'], name: 'Договор.pdf' });
    state.files = [record];
    state.plan.set(urlOf(record, 'stored.pdf'), 'not-ok');
    const { unmount } = renderModal({ nodes: [nodeOf(inKey('a'))] });

    await tick('Договор.pdf');
    unmount();

    // Провал не оставил за собой адреса, а значит не оставил и долга по нему.
    expect(createdObjectUrls()).toHaveLength(0);
    expect(revokeObjectURLMock).not.toHaveBeenCalled();
  });

  it('сорванный адрес не размножается: один файл — один запрос', async () => {
    const record = mailFile('rec1', 'a', { file: ['stored.pdf'], name: 'Договор.pdf' });
    state.files = [record];
    renderModal({ nodes: [nodeOf(inKey('a'))] });

    await tick('Договор.pdf');
    await user.click(checkboxFor('Договор.pdf'));
    await flushBlobs();
    await user.click(checkboxFor('Договор.pdf'));
    await flushBlobs();

    // Блоб живёт до закрытия модалки: снятие и возврат флажка руками не должны
    // ни качать файл заново, ни оставлять на экране «готовый» файл без блоба.
    expect(fetchedUrls()).toHaveLength(1);
    expect(createdObjectUrls()).toHaveLength(1);
    expect(noteOf('Договор.pdf')).toBeNull();
    expect(fileBlockOf('Договор.pdf').querySelector('iframe')?.getAttribute('src')).toBe(
      createdObjectUrls()[0],
    );
  });

  it('закрытие модалки отпускает объектные адреса полученных файлов', async () => {
    const record = mailFile('rec1', 'a', { file: ['stored.pdf'], name: 'Договор.pdf' });
    state.files = [record];
    const { unmount } = renderModal({ nodes: [nodeOf(inKey('a'))] });

    await tick('Договор.pdf');
    const created = createdObjectUrls();
    expect(created).toHaveLength(1);

    unmount();

    expect(revokeObjectURLMock.mock.calls.map((call) => String(call[0]))).toEqual(created);
  });

  it('неотмеченные вложения не качаются вовсе', async () => {
    const first = mailFile('f1', 'a', { file: ['one.pdf'], name: 'Договор.pdf' });
    const second = mailFile('f2', 'a', { file: ['two.pdf'], name: 'Приложение.pdf' });
    state.files = [first, second];
    renderModal({ nodes: [nodeOf(inKey('a'))] });

    await tick('Договор.pdf');

    expect(fetchedUrls()).toEqual([urlOf(first, 'one.pdf')]);
    expect(printedFileNames()).toEqual(['Договор.pdf']);
  });
});

// ─── Сборка строк ───

describe('MailThreadPrintModal — что собирается в документ', () => {
  it('порядок на листе совпадает с порядком переписки, а не с порядком вложений', async () => {
    state.files = [
      mailFile('f3', 'c', { file: ['act.pdf'], name: 'Акт.pdf' }),
      mailFile('f1', 'a', { file: ['first.png'], name: 'Счёт.png' }),
      mailFile('f2', 'b', { file: ['out.pdf'], name: 'Письмо.pdf', mail_type: 'outgoing' }),
    ];
    renderModal({
      nodes: [
        nodeOf(inKey('a'), { index: 0 }),
        nodeOf(outKey('b'), { index: 1, depth: 1, parentKey: inKey('a') }),
        nodeOf(inKey('c'), { index: 2, depth: 1, parentKey: outKey('b') }),
      ],
    });

    await user.click(selectAllButton());
    await flushBlobs();

    // Ответ пришёл вразнобой; на лист обязано попасть в порядке цепочки.
    expect(printedHeadings()).toEqual([
      expect.stringContaining('ООО «a»'),
      expect.stringContaining('ООО «b»'),
      expect.stringContaining('ООО «c»'),
    ]);
    expect(printedFileNames()).toEqual(['Счёт.png', 'Письмо.pdf', 'Акт.pdf']);
  });

  it('дерево выбора показывает ровно то и в том же порядке, что уйдёт на лист', async () => {
    state.files = [
      mailFile('f3', 'c', { file: ['act.pdf'], name: 'Акт.pdf' }),
      mailFile('f1', 'a', { file: ['first.png'], name: 'Счёт.png' }),
      mailFile('f2', 'b', { file: ['out.pdf'], name: 'Письмо.pdf', mail_type: 'outgoing' }),
    ];
    renderModal({
      nodes: [
        nodeOf(inKey('a'), { index: 0 }),
        nodeOf(outKey('b'), { index: 1, depth: 1, parentKey: inKey('a') }),
        nodeOf(inKey('c'), { index: 2, depth: 1, parentKey: outKey('b') }),
      ],
    });

    expect(pickerLabels()).toEqual(['Счёт.png', 'Письмо.pdf', 'Акт.pdf']);

    await user.click(selectAllButton());
    await flushBlobs();

    // Требуемое от человека и напечатанное обязаны совпадать: иначе цепочку
    // собирают в одну последовательность, а показывают в другой.
    expect(printedFileNames()).toEqual(pickerLabels());
  });

  it('письмо без вложений остаётся в дереве, но на лист не попадает', async () => {
    state.files = [
      mailFile('f1', 'a', { file: ['first.png'], name: 'Счёт.png' }),
      mailFile('f3', 'c', { file: ['act.pdf'], name: 'Акт.pdf' }),
    ];
    renderModal({
      nodes: [
        nodeOf(inKey('a'), { index: 0 }),
        nodeOf(inKey('b'), { index: 1, depth: 1, parentKey: inKey('a') }),
        nodeOf(inKey('c'), { index: 2, depth: 1, parentKey: inKey('b') }),
      ],
    });

    await user.click(selectAllButton());
    await flushBlobs();

    expect(within(modal()).getByText('Вложений нет')).toBeInTheDocument();
    // Пустое письмо не занимает места на листе: заголовок без единого файла —
    // это разрыв в напечатанной переписке.
    expect(printedHeadings()).toEqual([
      expect.stringContaining('ООО «a»'),
      expect.stringContaining('ООО «c»'),
    ]);
  });

  it('неотмеченное письмо не печатается, но остаётся видимым в дереве', async () => {
    state.files = [
      mailFile('f1', 'a', { file: ['first.png'], name: 'Счёт.png' }),
      mailFile('f3', 'c', { file: ['act.pdf'], name: 'Акт.pdf' }),
    ];
    renderModal({
      nodes: [
        nodeOf(inKey('a'), { index: 0 }),
        nodeOf(inKey('c'), { index: 1, depth: 1, parentKey: inKey('a') }),
      ],
    });

    await tick('Счёт.png');

    expect(pickerLabels()).toEqual(['Счёт.png', 'Акт.pdf']);
    expect(checkboxFor('Акт.pdf')).not.toBeChecked();
    expect(printedHeadings()).toEqual([expect.stringContaining('ООО «a»')]);
  });

  it('счётчик считает все файлы цепочки, а не только отмеченные', async () => {
    state.files = [
      mailFile('f1', 'a', { file: ['first.png'], name: 'Счёт.png' }),
      mailFile('f2', 'a', { file: ['two.pdf'], name: 'Договор.pdf' }),
      mailFile('f3', 'c', { file: ['act.pdf'], name: 'Акт.pdf' }),
    ];
    renderModal({
      nodes: [nodeOf(inKey('a'), { index: 0 }), nodeOf(inKey('c'), { index: 1 })],
    });

    expect(selectionCounter()).toBe('Выбрано 0 из 3');

    await tick('Счёт.png');

    expect(selectionCounter()).toBe('Выбрано 1 из 3');
  });

  it('счётчик обещает файл, которого на бумаге не будет — это заложено в подсчёт', async () => {
    const record = mailFile('bad', 'a', { file: ['stored.pdf'], name: 'Договор.pdf' });
    state.files = [record];
    state.plan.set(urlOf(record, 'stored.pdf'), 'network-error');
    renderModal({ nodes: [nodeOf(inKey('a'))] });

    await tick('Договор.pdf');

    // `total` считает вложения по линии, а не выданные на руки блобы, поэтому
    // недоступный файл в нём остаётся. Показываем это здесь явно, чтобы
    // расхождение «обещано 1 — напечатано только название с пометкой» было
    // зафиксировано тестом, а не обнаружено при печати.
    expect(selectionCounter()).toBe('Выбрано 1 из 1');
    expect(printedFileNames()).toEqual(['Договор.pdf']);
    expect(noteOf('Договор.pdf')).toBe(NOTE_FAILED);
  });

  it('пакетная запись даёт отдельный флажок каждому файлу и печатается целиком', async () => {
    const batch = mailFile('batch', 'a', {
      file: ['one.png', 'two.png', 'three.png'],
      name: 'Комплект',
    });
    state.files = [batch];
    renderModal({ nodes: [nodeOf(inKey('a'))] });

    expect(pickerLabels()).toEqual([
      'Комплект · one.png',
      'Комплект · two.png',
      'Комплект · three.png',
    ]);

    await user.click(selectAllButton());
    await flushBlobs();

    expect(selectionCounter()).toBe('Выбрано 3 из 3');
    expect(printedFileNames()).toEqual([
      'Комплект · one.png',
      'Комплект · two.png',
      'Комплект · three.png',
    ]);
    expect(fetchedUrls()).toEqual([
      urlOf(batch, 'one.png'),
      urlOf(batch, 'two.png'),
      urlOf(batch, 'three.png'),
    ]);
  });

  it('снять все убирает печатный документ целиком', async () => {
    state.files = [
      mailFile('f1', 'a', { file: ['first.png'], name: 'Счёт.png' }),
      mailFile('f2', 'a', { file: ['two.pdf'], name: 'Договор.pdf' }),
    ];
    renderModal({ nodes: [nodeOf(inKey('a'))] });

    await user.click(selectAllButton());
    await flushBlobs();
    expect(printRoot()).not.toBeNull();

    await user.click(clearAllButton());
    await flushBlobs();

    expect(selectionCounter()).toBe('Выбрано 0 из 2');
    expect(printRoot()).toBeNull();
  });

  it('ничего не отмечено — печатать нечего, и кнопка это показывает', async () => {
    state.files = [mailFile('f1', 'a', { file: ['first.png'], name: 'Счёт.png' })];
    renderModal({ nodes: [nodeOf(inKey('a'))] });

    expect(printButton()).toBeDisabled();
    expect(printRoot()).toBeNull();
  });

  it('печать уходит в принтер, даже когда одно вложение получить не удалось', async () => {
    const broken = mailFile('bad', 'a', { file: ['broken.png'], name: 'Скан.png' });
    const good = mailFile('ok1', 'a', { file: ['contract.pdf'], name: 'Договор.pdf' });
    state.files = [broken, good];
    state.plan.set(urlOf(broken, 'broken.png'), 'not-ok');
    renderModal({ nodes: [nodeOf(inKey('a'))] });

    await user.click(selectAllButton());
    await flushBlobs();
    await user.click(printButton());

    expect(printMock).toHaveBeenCalledTimes(1);
  });

  it('отметка файла, печатаемого только названием, подписана честно', async () => {
    state.files = [mailFile('f1', 'a', { file: ['stored.docx'], name: 'Договор.docx' })];
    renderModal({ nodes: [nodeOf(inKey('a'))] });

    expect(pickerLabels()).toEqual([`Договор.docx${OTHER_CHECKBOX_SUFFIX}`]);

    await tick('Договор.docx');

    expect(noteOf('Договор.docx')).toBe(NOTE_OTHER);
    expect(printedFileNames()).toEqual(['Договор.docx']);
  });
});

// ─── Состояния запроса ───

describe('MailThreadPrintModal — состояния загрузки вложений', () => {
  it('пустая переписка объясняет себя, а не выглядит как сбой', () => {
    renderModal({ nodes: [] });

    expect(within(modal()).getByText('В переписке нет писем')).toBeInTheDocument();
    expect(selectAllButton()).toBeDisabled();
  });

  it('пока вложения грузятся, дерево не показывается — вспышки пустоты не будет', () => {
    state.files = [mailFile('f1', 'a', { file: ['first.png'], name: 'Счёт.png' })];
    state.isLoading = true;
    renderModal({ nodes: [nodeOf(inKey('a'))] });

    expect(within(modal()).queryByText('В переписке нет писем')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(printRoot()).toBeNull();
  });

  it('обрыв загрузки назван прямо, а не выглядит как переписка без вложений', () => {
    state.isError = true;
    renderModal({ nodes: [nodeOf(inKey('a'))] });

    expect(
      within(modal()).getByText('Не удалось загрузить вложения переписки'),
    ).toBeInTheDocument();
    expect(within(modal()).queryByText('В переписке нет писем')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('закрытая модалка не печатает и не спрашивает вложения', () => {
    state.files = [mailFile('f1', 'a', { file: ['first.png'], name: 'Счёт.png' })];
    renderModal({ nodes: [nodeOf(inKey('a'))], opened: false });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(printRoot()).toBeNull();
    expect(fetchedUrls()).toHaveLength(0);
    expect(state.lastOrgId).toBe('');
  });
});

// jsdom не умеет объектные адреса, а хук их и создаёт, и отпускает.
beforeAll(() => {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: createObjectURLMock,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: revokeObjectURLMock,
  });
});

afterAll(() => {
  if (originalCreateObjectURL) {
    Object.defineProperty(URL, 'createObjectURL', originalCreateObjectURL);
  } else {
    Reflect.deleteProperty(URL, 'createObjectURL');
  }
  if (originalRevokeObjectURL) {
    Object.defineProperty(URL, 'revokeObjectURL', originalRevokeObjectURL);
  } else {
    Reflect.deleteProperty(URL, 'revokeObjectURL');
  }
});
