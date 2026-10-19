import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RecordModel } from 'pocketbase';
import { renderWithProviders } from '@/mocks/test-utils';
import { notifications } from '@mantine/notifications';
import { MailFilesModal } from './MailFilesModal';
import type { IMailFile, MailType } from '@/shared/types';

/**
 * Модалка вложений письма: список, лимит в десять записей, загрузка и удаление.
 *
 * Проверяется модалка целиком, а не хуки: сами `useMailFiles`,
 * `useUploadMailFiles` и `useDeleteMailFile` вместе с инвалидацией запросов
 * закрыты в `useMail.test.ts`, а здесь важна цепочка, которой у хуков нет, —
 * сколько файлов доедет до мутации, каким текстом закончится тост и что
 * происходит, когда половина лимита занята чужими вложениями. Поэтому модуль
 * хуков замокан целиком (приём из `MailSection.delete-reason.test.tsx`), а
 * `getMailFileUrl` и `ConfirmModal` остаются настоящими: ссылка строится из
 * реальной записи PocketBase, а удаление идёт через настоящую вложенную
 * модалку.
 *
 * Четыре особенности, из-за которых тесты строятся так, а не иначе:
 *
 * - `applyAccept: false` у `userEvent`. У компонента `accept` равен «любой
 *   тип», а `userEvent` умеет проверять `accept` только по списку «видео»,
 *   «аудио», «изображение» и расширениям файлов — звезда-звезда не проходит ни
 *   одну из веток, и файлы молча отфильтровались бы в ноль. Это проверка
 *   тестового инструмента, которой нет в самой модалке, поэтому её отключают
 *   явно;
 * - поле выбора файлов у `FileButton` спрятано (`display: none`), но в дереве
 *   всегда: `user.upload` по нему и есть выбор файлов человеком;
 * - вложенная `ConfirmModal`, как и в `MailFormModal.test.tsx`, появляется не
 *   в том же такте, что и клик, поэтому ищется через `findBy*`;
 * - обе ошибки (загрузки и удаления) гасятся пустым `catch`, поэтому «тоста об
 *   успехе нет» — это утверждение об отрицании, и оно доказывается управляемым
 *   отказом: промис отклоняется тестом уже после клика, так что успешной ветке
 *   негде спрятаться.
 */

const MAIL_ID = 'mail01hxyz';
const ORG_ID = 'org01hxyz';
const COLLECTION_ID = 'pbc_mailfiles';
const MAIL_LABEL = 'ВХ-77';

type MailFile = IMailFile & RecordModel;
type UploadVars = { mailId: string; mailType: MailType; files: File[] };

const h = vi.hoisted(() => ({
  files: [] as unknown,
  isLoading: false,
  uploadPending: false,
  removePending: false,
  uploadAsync: vi.fn<(vars: UploadVars) => Promise<unknown>>(),
  removeAsync: vi.fn<(file: IMailFile & RecordModel) => Promise<boolean>>(),
  mailFilesArgs: [] as Array<[string, string]>,
  uploadOrgId: '',
  removeOrgId: '',
}));

vi.mock('@/shared/hooks/useMail', () => ({
  useMailFiles: (mailId: string, mailType: MailType) => {
    h.mailFilesArgs.push([mailId, mailType]);
    return { data: h.files, isLoading: h.isLoading };
  },
  useUploadMailFiles: (orgId: string) => {
    h.uploadOrgId = orgId;
    return { mutateAsync: h.uploadAsync, isPending: h.uploadPending };
  },
  useDeleteMailFile: (orgId: string) => {
    h.removeOrgId = orgId;
    return { mutateAsync: h.removeAsync, isPending: h.removePending };
  },
}));

/**
 * Тосты перехватываются подменой самого метода, а не моком модуля: модуль
 * `@mantine/notifications` в этом файле импортируется напрямую, и такой импорт
 * уводит его из-под `vi.mock` — компонент продолжает звать настоящий
 * `showNotification`, который без смонтированного `<Notifications />` уходит в
 * пустоту, а модульный мок остаётся невызванным. `notifications.show` —
 * обычное свойство объекта, поэтому `vi.spyOn` перехватывает ровно тот вызов,
 * который делает компонент, и не зависит от реестра модулей.
 *
 * Настоящий `show` здесь не нужен: тексты тостов и есть проверяемое
 * поведение, а рендерить сами уведомления тест не проверяет. Сигнатура
 * `showNotification` возвращает идентификатор уведомления (`string`), поэтому
 * заглушка отдаёт строку: компонент её значение не читает, а объявить
 * `undefined` нельзя — так `tsc -b` из `pnpm build` роняет сборку.
 */
const showSpy = vi.spyOn(notifications, 'show').mockImplementation(() => 'test-notification-id');

function file(name: string, over: Partial<MailFile> = {}): MailFile {
  return {
    id: `mf-${name}`,
    collectionId: COLLECTION_ID,
    collectionName: 'mail_files',
    mail_id: MAIL_ID,
    mail_type: 'incoming',
    organization_id: ORG_ID,
    file: [name],
    name,
    ...over,
  };
}

/**
 * Дата создания собрана из локальных чисел: `formatMailTimestamp` печатает
 * локальное время, поэтому `07.10.2026 09:30` не поедет ни в одной таймзоне —
 * `new Date(2026, 9, 7, 9, 30)` это ровно такой момент по местному времени.
 */
const CONTRACT = file('Договор.pdf', {
  id: 'mf01hxyz',
  created: new Date(2026, 9, 7, 9, 30).toISOString(),
});
/** Без `created` — в строке не должно быть ни одной отметки времени. */
const INVOICE = file('Счёт.pdf', { id: 'mf02hxyz' });
/** Запись без файла: `getMailFileUrl` вернёт `null`, и это другая ветка разметки. */
const BROKEN = file('Битый.pdf', { id: 'mf03hxyz', file: [] });

const FIXTURE_FILES = [CONTRACT, INVOICE];
/** Девять записей — остаётся одно свободное место из десяти. */
const NINE_FILES = Array.from({ length: 9 }, (_, i) =>
  file(`Договор-${i + 1}.pdf`, { id: `mf1${i}hxyz` }),
);
const TEN_FILES = Array.from({ length: 10 }, (_, i) =>
  file(`Файл-${i + 1}.pdf`, { id: `mf2${i}hxyz` }),
);

interface ModalOptions {
  files?: MailFile[];
  loading?: boolean;
  mailId?: string | null;
  mailType?: MailType;
  opened?: boolean;
  canManageFiles?: boolean;
  uploadPending?: boolean;
  removePending?: boolean;
}

function renderModal(options: ModalOptions = {}) {
  const {
    loading = false,
    mailId = MAIL_ID,
    mailType = 'incoming',
    opened = true,
    canManageFiles = true,
    uploadPending = false,
    removePending = false,
  } = options;
  /**
   * Явно переданный `files: undefined` — это не пустой список, а «данных ещё
   * нет»: так ведёт себя выключенный запрос `useMailFiles`, и модалка эти два
   * случая различает через `files ?? []`. Поэтому дефолт ставится по наличию
   * ключа, а не значением.
   */
  h.files = 'files' in options ? options.files : [];
  h.isLoading = loading;
  h.uploadPending = uploadPending;
  h.removePending = removePending;

  const props = {
    mailId,
    mailType,
    mailLabel: MAIL_LABEL,
    orgId: ORG_ID,
    opened,
    canManageFiles,
    onClose: vi.fn(),
  };

  const view = renderWithProviders(<MailFilesModal {...props} />);

  /**
   * Перерисовка с новым состоянием хуков. Так выглядит момент, когда письмо
   * успели открыть заново, вложения пришли (или добавились у другого человека),
   * а модалка всё ещё открыта: состояние `FileButton` при этом сохраняется.
   */
  const rerender = (patch: { files?: MailFile[]; uploadPending?: boolean }) => {
    if (patch.files !== undefined) h.files = patch.files;
    if (patch.uploadPending !== undefined) h.uploadPending = patch.uploadPending;
    view.rerender(<MailFilesModal {...props} />);
  };

  return { rerender };
}

type User = ReturnType<typeof userEvent.setup>;

/** Звёздную-звёздную маску `accept` `userEvent` не понимает — см. шапку файла. */
const setupUser = () => userEvent.setup({ applyAccept: false });

/** `FileButton` держит скрытое поле выбора всегда, а не по клику. */
function fileInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('поле выбора файлов не найдено');
  return input;
}

async function pickFiles(user: User, names: string[]) {
  await user.upload(
    fileInput(),
    names.map((name) => new File([name], name, { type: 'application/pdf' })),
  );
}

const chooseButton = () => screen.getByRole('button', { name: 'Выбрать файлы' });
const uploadButton = () => screen.getByRole('button', { name: 'Загрузить' });

/** Кнопка удаления в строке вложения: строки идут в порядке переданных `files`. */
function trashFor(name: string): HTMLElement {
  const index = FIXTURE_FILES.findIndex((item) => item.name === name);
  const button = screen.getAllByLabelText('Удалить вложение')[index];
  if (!button) throw new Error(`у вложения «${name}» нет кнопки удаления`);
  return button;
}

/** Подтверждение открывается переходом, поэтому ищется после клика. */
const confirmButton = () => screen.findByRole('button', { name: 'Удалить' });

function lastUpload(): UploadVars {
  const vars = h.uploadAsync.mock.calls.at(-1)?.[0];
  if (!vars) throw new Error('загрузка не вызывалась');
  return vars;
}

function lastRemoved(): MailFile {
  const file = h.removeAsync.mock.calls.at(-1)?.[0];
  if (!file) throw new Error('удаление не вызывалось');
  return file;
}

beforeEach(() => {
  h.files = [];
  h.isLoading = false;
  h.uploadPending = false;
  h.removePending = false;
  h.mailFilesArgs = [];
  h.uploadOrgId = '';
  h.removeOrgId = '';
  h.uploadAsync.mockReset();
  h.removeAsync.mockReset();
  showSpy.mockClear();
});

describe('MailFilesModal — что и когда запрашивается', () => {
  it('открытая модалка спрашивает вложения письма и организации', () => {
    renderModal({ files: FIXTURE_FILES });

    expect(h.mailFilesArgs.at(-1)).toEqual([MAIL_ID, 'incoming']);
    expect(h.uploadOrgId).toBe(ORG_ID);
    expect(h.removeOrgId).toBe(ORG_ID);
    expect(screen.getByText(`Вложения: ${MAIL_LABEL}`)).toBeInTheDocument();
  });

  it('регистр исходящего письма уходит в запрос без превращения', () => {
    renderModal({ mailType: 'outgoing' });

    expect(h.mailFilesArgs.at(-1)).toEqual([MAIL_ID, 'outgoing']);
  });

  it('закрытая модалка спрашивает по пустому идентификатору — письма ещё нет', () => {
    renderModal({ opened: false, files: FIXTURE_FILES });

    // `const id = opened && mailId ? mailId : ''` — пустой ключ выключает запрос.
    expect(h.mailFilesArgs.length).toBeGreaterThan(0);
    expect(h.mailFilesArgs.every(([id]) => id === '')).toBe(true);
    expect(screen.queryByText(`Вложения: ${MAIL_LABEL}`)).not.toBeInTheDocument();
  });

  it('без идентификатора письма запрос тоже пустой, и список пуст', () => {
    renderModal({ mailId: null, files: undefined });

    expect(h.mailFilesArgs.at(-1)).toEqual(['', 'incoming']);
    // Запрос у `useMailFiles` выключен, `data` остаётся `undefined` — значит
    // модалка показывает пустое состояние, а не крутит индикатор.
    expect(screen.getByText('Вложений нет')).toBeInTheDocument();
  });
});

describe('MailFilesModal — список вложений', () => {
  it('пока грузятся вложения, не показывается ни список, ни пустое состояние', () => {
    renderModal({ loading: true, files: FIXTURE_FILES });

    // Три ветки разметки различимы тем, что каждая печатает своё: у загрузки
    // нет собственного текста, поэтому ветка опознаётся отсутствием обоих.
    expect(screen.queryByText('Договор.pdf')).not.toBeInTheDocument();
    expect(screen.queryByText('Вложений нет')).not.toBeInTheDocument();
    // Остальная часть модалки на месте — она не исчезла вместе со списком.
    expect(screen.getByText('Можно прикрепить ещё 8 из 10')).toBeInTheDocument();
  });

  it('без вложений показывается подсказка', () => {
    renderModal({ files: [] });

    expect(screen.getByText('Вложений нет')).toBeInTheDocument();
    expect(screen.queryByLabelText('Удалить вложение')).not.toBeInTheDocument();
  });

  it('имя вложения ведёт на файл записи', () => {
    renderModal({ files: FIXTURE_FILES });

    const link = screen.getByRole('link', { name: 'Договор.pdf' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    // Ссылка собирается настоящим `getMailFileUrl` из id коллекции и записи.
    expect(link.getAttribute('href')).toContain(`/api/files/${COLLECTION_ID}/${CONTRACT.id}/`);
    expect(link.getAttribute('href')).toContain(encodeURIComponent('Договор.pdf'));
  });

  it('у вложения с датой создания отметка времени есть, у второго — нет', () => {
    renderModal({ files: FIXTURE_FILES });

    expect(screen.getByText('07.10.2026 09:30')).toBeInTheDocument();
    expect(screen.getAllByText(/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/)).toHaveLength(1);
  });

  it('вложение без файла показывается текстом, а не ссылкой', () => {
    renderModal({ files: [BROKEN] });

    expect(screen.getByText('Битый.pdf (файл недоступен)')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Договор.pdf' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('MailFilesModal — лимит вложений', () => {
  it('оставшиеся места считаются от десяти', () => {
    renderModal({ files: FIXTURE_FILES });

    expect(screen.getByText('Можно прикрепить ещё 8 из 10')).toBeInTheDocument();
    expect(chooseButton()).toBeEnabled();
  });

  it('на десяти вложениях выбор новых заблокирован', () => {
    renderModal({ files: TEN_FILES });

    expect(screen.getByText('Можно прикрепить ещё 0 из 10')).toBeInTheDocument();
    expect(chooseButton()).toBeDisabled();
    expect(uploadButton()).toBeDisabled();
  });

  it('идущая загрузка блокирует и выбор файлов, и кнопку загрузки', async () => {
    const user = setupUser();
    const { rerender } = renderModal({ files: FIXTURE_FILES });
    await pickFiles(user, ['новый-1.pdf']);
    expect(uploadButton()).toBeEnabled();

    rerender({ uploadPending: true });

    expect(chooseButton()).toBeDisabled();
    expect(uploadButton()).toBeDisabled();
  });
});

describe('MailFilesModal — выбор файлов', () => {
  it('без выбора кнопка загрузки неактивна', () => {
    renderModal();

    expect(screen.queryByRole('button', { name: 'Очистить выбор' })).not.toBeInTheDocument();
    expect(uploadButton()).toBeDisabled();
  });

  it('выбранные файлы видны и разблокируют загрузку', async () => {
    const user = setupUser();
    renderModal();
    await pickFiles(user, ['новый-1.pdf', 'новый-2.pdf']);

    expect(screen.getByText('новый-1.pdf')).toBeInTheDocument();
    expect(screen.getByText('новый-2.pdf')).toBeInTheDocument();
    expect(uploadButton()).toBeEnabled();
  });

  it('очистка выбора возвращает блокировку', async () => {
    const user = setupUser();
    renderModal();
    await pickFiles(user, ['новый-1.pdf']);

    await user.click(screen.getByRole('button', { name: 'Очистить выбор' }));

    expect(screen.queryByText('новый-1.pdf')).not.toBeInTheDocument();
    expect(uploadButton()).toBeDisabled();
  });

  it('выбор обрезается до свободных мест', async () => {
    const user = setupUser();
    // Свободно одно место из десяти, а выбрано три файла.
    renderModal({ files: NINE_FILES });
    expect(screen.getByText('Можно прикрепить ещё 1 из 10')).toBeInTheDocument();

    await pickFiles(user, ['новый-1.pdf', 'новый-2.pdf', 'новый-3.pdf']);

    expect(screen.getByText('новый-1.pdf')).toBeInTheDocument();
    expect(screen.queryByText('новый-2.pdf')).not.toBeInTheDocument();
    expect(screen.queryByText('новый-3.pdf')).not.toBeInTheDocument();
  });
});

describe('MailFilesModal — загрузка', () => {
  it('один файл уходит с письмом и регистром, тост одиночный', async () => {
    const user = setupUser();
    renderModal();
    await pickFiles(user, ['новый-1.pdf']);

    await user.click(uploadButton());

    await waitFor(() => {
      expect(showSpy).toHaveBeenCalledWith({
        color: 'green',
        message: 'Вложение загружено',
      });
    });
    expect(lastUpload()).toMatchObject({ mailId: MAIL_ID, mailType: 'incoming' });
    expect(lastUpload().files.map((item) => item.name)).toEqual(['новый-1.pdf']);
  });

  it('несколько файлов едут одним батчем, тост с их числом', async () => {
    const user = setupUser();
    renderModal();
    await pickFiles(user, ['новый-1.pdf', 'новый-2.pdf', 'новый-3.pdf']);

    await user.click(uploadButton());

    await waitFor(() => {
      expect(showSpy).toHaveBeenCalledWith({
        color: 'green',
        message: 'Загружено вложений: 3',
      });
    });
    expect(lastUpload().files.map((item) => item.name)).toEqual([
      'новый-1.pdf',
      'новый-2.pdf',
      'новый-3.pdf',
    ]);
  });

  it('после успеха выбор очищается', async () => {
    const user = setupUser();
    renderModal();
    await pickFiles(user, ['новый-1.pdf']);

    await user.click(uploadButton());

    await waitFor(() => expect(uploadButton()).toBeDisabled());
    expect(screen.queryByText('новый-1.pdf')).not.toBeInTheDocument();
  });

  it('успешная загрузка обрезает батч до мест, свободных к моменту отправки', async () => {
    const user = setupUser();
    const { rerender } = renderModal();
    await pickFiles(user, ['новый-1.pdf', 'новый-2.pdf', 'новый-3.pdf']);

    // Пока модалка открыта, письмо заняли ещё девятью вложениями: осталось одно
    // место. `FileButton` обрезал выбор по `remaining` в момент клика, поэтому
    // обрезку отправки видно только здесь — при отправке свежих трёх.
    rerender({ files: NINE_FILES });
    expect(screen.getByText('Можно прикрепить ещё 1 из 10')).toBeInTheDocument();

    await user.click(uploadButton());

    await waitFor(() => {
      expect(showSpy).toHaveBeenCalledWith({ color: 'green', message: 'Вложение загружено' });
    });
    expect(lastUpload().files.map((item) => item.name)).toEqual(['новый-1.pdf']);
  });

  it('ошибка загрузки не показывает тост об успехе и не мешает выбрать снова', async () => {
    const user = setupUser();
    renderModal();
    let failUpload: () => void = () => {};
    h.uploadAsync.mockImplementation(
      () =>
        new Promise<unknown>((_, reject) => {
          failUpload = () => reject(new Error('сервер отказал'));
        }),
    );
    await pickFiles(user, ['новый-1.pdf']);

    await user.click(uploadButton());
    await act(async () => {
      failUpload();
    });

    // `catch` пустой: тоста об успехе быть не должно, а сам выбор — есть.
    expect(showSpy).not.toHaveBeenCalled();
    expect(screen.getByText('новый-1.pdf')).toBeInTheDocument();
  });

  it('без идентификатора письма загрузка не уходит', async () => {
    const user = setupUser();
    renderModal({ mailId: null });
    await pickFiles(user, ['новый-1.pdf']);

    await user.click(uploadButton());

    // Отправка выходит по `if (!mailId || picked.length === 0) return`: выбор
    // остаётся на месте, кнопка — активной, но мутация не уходит.
    expect(h.uploadAsync).not.toHaveBeenCalled();
    expect(showSpy).not.toHaveBeenCalled();
    expect(screen.getByText('новый-1.pdf')).toBeInTheDocument();
    expect(uploadButton()).toBeEnabled();
  });
});

describe('MailFilesModal — удаление', () => {
  it('кнопка удаления спрашивает подтверждение с именем файла', async () => {
    const user = setupUser();
    renderModal({ files: FIXTURE_FILES });

    await user.click(trashFor('Договор.pdf'));

    expect(await screen.findByText('Удаление вложения')).toBeInTheDocument();
    expect(screen.getByText('Удалить вложение «Договор.pdf»?')).toBeInTheDocument();
    expect(h.removeAsync).not.toHaveBeenCalled();
  });

  it('отмена подтверждения ничего не удаляет', async () => {
    const user = setupUser();
    renderModal({ files: FIXTURE_FILES });
    await user.click(trashFor('Договор.pdf'));

    await user.click(await screen.findByRole('button', { name: 'Отмена' }));

    await waitFor(() => {
      expect(screen.queryByText('Удаление вложения')).not.toBeInTheDocument();
    });
    expect(h.removeAsync).not.toHaveBeenCalled();
    expect(showSpy).not.toHaveBeenCalled();
  });

  it('подтверждение удаляет выбранное вложение', async () => {
    const user = setupUser();
    renderModal({ files: FIXTURE_FILES });
    await user.click(trashFor('Счёт.pdf'));

    await user.click(await confirmButton());

    await waitFor(() => {
      expect(showSpy).toHaveBeenCalledWith({ color: 'green', message: 'Вложение удалено' });
    });
    expect(lastRemoved().name).toBe('Счёт.pdf');
    expect(lastRemoved().id).toBe(INVOICE.id);
  });

  it('ошибка удаления не показывает тост об успехе', async () => {
    const user = setupUser();
    renderModal({ files: FIXTURE_FILES });
    let failRemove: () => void = () => {};
    h.removeAsync.mockImplementation(
      () =>
        new Promise<boolean>((_, reject) => {
          failRemove = () => reject(new Error('сервер отказал'));
        }),
    );
    await user.click(trashFor('Договор.pdf'));

    await user.click(await confirmButton());
    await act(async () => {
      failRemove();
    });

    expect(h.removeAsync).toHaveBeenCalledTimes(1);
    expect(showSpy).not.toHaveBeenCalled();
  });
});

describe('MailFilesModal — без права на вложения', () => {
  it('управления нет, а просмотр остаётся', () => {
    renderModal({ files: FIXTURE_FILES, canManageFiles: false });

    expect(screen.getByRole('link', { name: 'Договор.pdf' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Удалить вложение')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Выбрать файлы' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Загрузить' })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Можно прикрепить ещё/)).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'Просмотр вложений доступен, изменение — только тем, кто может редактировать письма.',
      ),
    ).toBeInTheDocument();
  });

  it('подсказка о просмотре не появляется, когда вложений нет', () => {
    renderModal({ files: [], canManageFiles: false });

    expect(screen.getByText('Вложений нет')).toBeInTheDocument();
    expect(screen.queryByText(/^Просмотр вложений доступен/)).not.toBeInTheDocument();
  });
});
