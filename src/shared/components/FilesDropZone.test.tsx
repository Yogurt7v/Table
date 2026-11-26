import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { notifications } from '@mantine/notifications';
import { renderWithProviders } from '@/mocks/test-utils';
import { FilesDropZone } from './FilesDropZone';
import type { FilesDropZoneProps } from './FilesDropZone';

/**
 * Универсальная зона файлов: выбор, drag&drop, лимит, очередь и загрузка.
 *
 * Компонент управляемый, поэтому в тестах он обёрнут в `Harness` с настоящим
 * `useState`: так проверяется ровно тот контракт, которым пользуются модалки,
 * а не искусственная перерисовка с подставленным списком.
 */

type User = ReturnType<typeof userEvent.setup>;

/** Звёздную маску `accept` `userEvent` не понимает — см. шапку MailFilesDialog.test.tsx. */
const setupUser = () => userEvent.setup({ applyAccept: false });

const showSpy = vi.spyOn(notifications, 'show').mockImplementation(() => 'test-notification-id');

function fileInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('поле выбора файлов не найдено');
  return input;
}

function pdf(name: string): File {
  return new File([name], name, { type: 'application/pdf' });
}

async function pickFiles(user: User, names: string[]) {
  await user.upload(
    fileInput(),
    names.map((name) => pdf(name)),
  );
}

interface HarnessProps extends Partial<FilesDropZoneProps> {
  initialFiles?: File[];
  onFilesChange?: (files: File[]) => void;
}

/** Управляемая обёртка: держит очередь так же, как это делает родитель. */
function Harness({ initialFiles = [], onFilesChange, ...props }: HarnessProps) {
  const [files, setFiles] = useState<File[]>(initialFiles);
  return (
    <FilesDropZone
      {...props}
      files={files}
      onFilesChange={(next) => {
        setFiles(next);
        onFilesChange?.(next);
      }}
    />
  );
}

const chooseButton = () => screen.getByRole('button', { name: 'Выбрать файлы' });
const uploadButton = () => screen.getByRole('button', { name: /^Загрузить/ });

beforeEach(() => {
  showSpy.mockClear();
});

describe('FilesDropZone — выбор файлов', () => {
  it('без выбранных файлов очередь пуста, кнопка загрузки неактивна', () => {
    renderWithProviders(<Harness onUpload={vi.fn()} />);

    expect(screen.queryByText(/^К загрузке/)).not.toBeInTheDocument();
    expect(uploadButton()).toBeDisabled();
  });

  it('выбранные файлы попадают в очередь и отдаются родителю', async () => {
    const user = setupUser();
    const onFilesChange = vi.fn();
    renderWithProviders(<Harness onFilesChange={onFilesChange} />);

    await pickFiles(user, ['договор.pdf', 'счёт.pdf']);

    expect(screen.getByText('К загрузке · 2')).toBeInTheDocument();
    expect(screen.getByText('договор.pdf')).toBeInTheDocument();
    expect(onFilesChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ name: 'договор.pdf' }),
      expect.objectContaining({ name: 'счёт.pdf' }),
    ]);
  });

  it('файл убирается из очереди по одному', async () => {
    const user = setupUser();
    renderWithProviders(<Harness />);
    await pickFiles(user, ['договор.pdf', 'счёт.pdf']);

    await user.click(screen.getAllByLabelText('Убрать файл из списка')[0]!);

    expect(screen.queryByText('договор.pdf')).not.toBeInTheDocument();
    expect(screen.getByText('счёт.pdf')).toBeInTheDocument();
    expect(screen.getByText('К загрузке · 1')).toBeInTheDocument();
  });

  it('«Очистить» освобождает всю очередь', async () => {
    const user = setupUser();
    renderWithProviders(<Harness />);
    await pickFiles(user, ['договор.pdf', 'счёт.pdf']);

    await user.click(screen.getByRole('button', { name: 'Очистить' }));

    expect(screen.queryByText('договор.pdf')).not.toBeInTheDocument();
    expect(screen.queryByText(/^К загрузке/)).not.toBeInTheDocument();
  });

  it('drag&drop добавляет файлы в очередь', () => {
    renderWithProviders(<Harness />);

    const zone = screen.getByRole('button', { name: /Перетащите файлы/ });
    fireEvent.drop(zone, { dataTransfer: { files: [pdf('перетащенный.pdf')] } });

    expect(screen.getByText('перетащенный.pdf')).toBeInTheDocument();
  });
});

describe('FilesDropZone — лимит', () => {
  it('лишние файлы отбрасываются с жёлтым тостом', async () => {
    const user = setupUser();
    renderWithProviders(<Harness maxFiles={2} />);
    await pickFiles(user, ['первый.pdf']);

    await pickFiles(user, ['второй.pdf', 'третий.pdf', 'четвёртый.pdf']);

    expect(screen.getByText('К загрузке · 2')).toBeInTheDocument();
    expect(screen.queryByText('третий.pdf')).not.toBeInTheDocument();
    expect(showSpy).toHaveBeenCalledWith({
      color: 'yellow',
      title: 'Часть файлов не добавлена',
      message: 'Можно добавить ещё 1 файл(ов), остальные 2 пропущены.',
    });
  });

  it('на исчерпанном лимите зона и выбор заблокированы', () => {
    renderWithProviders(<Harness maxFiles={1} initialFiles={[pdf('единственный.pdf')]} />);

    expect(screen.getByText('Лимит файлов исчерпан')).toBeInTheDocument();
    expect(chooseButton()).toBeDisabled();
    expect(fileInput()).toBeDisabled();
  });

  it('без maxFiles очередь не ограничена', async () => {
    const user = setupUser();
    renderWithProviders(<Harness />);
    await pickFiles(user, ['1.pdf', '2.pdf', '3.pdf', '4.pdf']);

    expect(screen.getByText('К загрузке · 4')).toBeInTheDocument();
    expect(showSpy).not.toHaveBeenCalled();
  });
});

describe('FilesDropZone — загрузка', () => {
  it('без onUpload кнопки загрузки нет', () => {
    renderWithProviders(<Harness />);

    expect(screen.queryByRole('button', { name: /^Загрузить/ })).not.toBeInTheDocument();
  });

  it('кнопка загрузки отдаёт родителю всю очередь', async () => {
    const user = setupUser();
    const onUpload = vi.fn();
    renderWithProviders(<Harness onUpload={onUpload} />);
    await pickFiles(user, ['договор.pdf', 'счёт.pdf']);

    expect(screen.getByRole('button', { name: 'Загрузить (2)' })).toBeInTheDocument();
    await user.click(uploadButton());

    expect(onUpload).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'договор.pdf' }),
      expect.objectContaining({ name: 'счёт.pdf' }),
    ]);
  });

  it('во время загрузки выбор, очередь и кнопка заблокированы', () => {
    renderWithProviders(
      <FilesDropZone
        files={[pdf('договор.pdf')]}
        onFilesChange={vi.fn()}
        onUpload={vi.fn()}
        uploading
      />,
    );

    expect(chooseButton()).toBeDisabled();
    expect(uploadButton()).toBeDisabled();
    expect(screen.getByLabelText('Убрать файл из списка')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Очистить' })).toBeDisabled();
    expect(fileInput()).toBeDisabled();
  });

  it('disabled блокирует выбор и загрузку, но очередь видна', () => {
    renderWithProviders(
      <FilesDropZone
        files={[pdf('договор.pdf')]}
        onFilesChange={vi.fn()}
        onUpload={vi.fn()}
        disabled
      />,
    );

    expect(screen.getByText('договор.pdf')).toBeInTheDocument();
    expect(chooseButton()).toBeDisabled();
    expect(uploadButton()).toBeDisabled();
  });
});

describe('FilesDropZone — подсказка', () => {
  it('hint печатается над зоной', () => {
    renderWithProviders(<Harness hint="Файлы будут загружены после создания документа" />);

    expect(screen.getByText('Файлы будут загружены после создания документа')).toBeInTheDocument();
  });
});
