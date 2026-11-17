import { useMemo, useState } from 'react';
import { Button, Group, Loader, Modal, ScrollArea, Stack, Text } from '@mantine/core';
import { IconPrinter } from '@tabler/icons-react';
import { useOrgMailFiles } from './useOrgMailFiles';
import {
  buildThreadPrintLetters,
  countPrintFiles,
  groupPrintFilesByLetter,
  printSelectionLabel,
} from './mail-thread-print';
import { MailThreadPrintDocument } from './components/mail-thread-print/MailThreadPrintDocument';
import { MailThreadPrintLetterList } from './components/mail-thread-print/MailThreadPrintLetterList';
import { usePrintBlobs } from './components/mail-thread-print/usePrintBlobs';
import type {
  MailThreadPrintModalProps,
  PrintBlobEntry,
  PrintRow,
} from './components/mail-thread-print/mail-thread-print-types';

/**
 * Печать вложений переписки: та же линия писем деревом, под каждым письмом —
 * его файлы, у каждого файла флажок. На печать уходит один документ из
 * отмеченных файлов в порядке цепочки, без всего остального на экране.
 *
 * Файлы читаются блобами заранее, а не подставляются ссылкой прямо в разметку:
 * `window.print()` не ждёт загрузки, и картинка, начавшая грузиться в момент
 * нажатия, печаталась бы пустой. Объектный URL создаётся один раз на файл и
 * отпускается, когда модалка закрывается.
 *
 * Чего модалка не делает: она не выводит содержимое файлов, которые браузер
 * показать не может. Для `.docx`, `.xlsx` и прочего на печать попадает блок с
 * названием и письмом — выдумывать содержимое нечестно.
 *
 * Дерево писем живёт в `MailThreadPrintLetterList`, печатный документ — в
 * `MailThreadPrintDocument`, загрузка блобов — в `usePrintBlobs`.
 */
export function MailThreadPrintModal({
  opened,
  onClose,
  orgId,
  nodes,
  wide,
}: MailThreadPrintModalProps) {
  // Отметок нет ни у кого: печать — это подтверждение, а не отправка «всё, что
  // нашлось». Выбор живёт только здесь и умирает вместе с модалкой.
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set());
  const { data: files, isLoading, isError } = useOrgMailFiles(opened ? orgId : '');

  const letters = useMemo(
    () => buildThreadPrintLetters(nodes, groupPrintFilesByLetter(files ?? [])),
    [nodes, files],
  );
  const total = useMemo(() => countPrintFiles(letters), [letters]);

  const rows = useMemo<PrintRow[]>(
    () =>
      letters
        .map((letter) => ({ letter, files: letter.files.filter((file) => checked.has(file.id)) }))
        .filter((row) => row.files.length > 0),
    [letters, checked],
  );

  const entries = useMemo<PrintBlobEntry[]>(
    () => rows.flatMap((row) => row.files.map((file) => ({ id: file.id, url: file.url }))),
    [rows],
  );
  const blobs = usePrintBlobs(entries);

  const selected = rows.reduce((sum, row) => sum + row.files.length, 0);
  const preparing = entries.filter((entry) => !blobs.statuses.has(entry.id)).length;

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  };

  const selectAll = () =>
    setChecked(new Set(letters.flatMap((letter) => letter.files.map((file) => file.id))));
  const clearAll = () => setChecked(new Set());

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        title="Печать вложений переписки"
        size="xl"
        fullScreen={!wide}
      >
        <Stack gap="sm">
          {/* Пояснение и счётчик выбранного */}
          <Group justify="space-between" gap="xs" wrap="wrap">
            <Text size="xs" c="dimmed">
              Отметьте файлы, которые должны попасть в печать: на принтер уйдёт один документ из
              отмеченных файлов.
            </Text>
            <Group gap="xs">
              <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                {printSelectionLabel(selected, total)}
              </Text>
              <Button
                size="compact-xs"
                variant="subtle"
                color="gray"
                disabled={total === 0}
                onClick={selectAll}
              >
                Отметить все
              </Button>
              <Button
                size="compact-xs"
                variant="subtle"
                color="gray"
                disabled={selected === 0}
                onClick={clearAll}
              >
                Снять все
              </Button>
            </Group>
          </Group>

          {/* Загрузка, ошибка и отсутствие писем */}
          {isLoading && <Loader size="sm" />}

          {!isLoading && isError && (
            <Text size="sm" c="red">
              Не удалось загрузить вложения переписки
            </Text>
          )}

          {!isLoading && !isError && letters.length === 0 && (
            <Text size="sm" c="dimmed">
              В переписке нет писем
            </Text>
          )}

          {/* Дерево писем с флажками файлов */}
          {!isLoading && !isError && letters.length > 0 && (
            <ScrollArea.Autosize mah="min(56vh, 30rem)">
              <MailThreadPrintLetterList letters={letters} checked={checked} onToggle={toggle} />
            </ScrollArea.Autosize>
          )}

          {/* Кнопки закрытия и печати */}
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={onClose}>
              Закрыть
            </Button>
            <Button
              leftSection={<IconPrinter size={16} />}
              disabled={selected === 0 || preparing > 0}
              onClick={() => window.print()}
            >
              {preparing > 0 ? 'Готовятся файлы…' : 'Печать'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Печатный документ: только при открытой модалке с выбранными файлами */}
      {opened && rows.length > 0 && <MailThreadPrintDocument rows={rows} blobs={blobs} />}
    </>
  );
}
