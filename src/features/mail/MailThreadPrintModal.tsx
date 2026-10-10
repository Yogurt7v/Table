import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Group,
  Loader,
  Modal,
  ScrollArea,
  Stack,
  Text,
} from '@mantine/core';
import { IconPrinter } from '@tabler/icons-react';
import { useOrgMailFiles } from './useOrgMailFiles';
import { MAIL_TREE_INDENT } from './mail-thread-builder';
import type { ThreadLineNode } from './mail-thread-builder';
import {
  buildThreadPrintLetters,
  countPrintFiles,
  groupPrintFilesByLetter,
  printSelectionLabel,
} from './mail-thread-print';
import type { MailPrintFile, MailPrintFileKind, MailPrintLetter } from './mail-thread-print';
import { MAIL_REGISTER_BADGE_LABELS, MAIL_REGISTER_COLORS } from './mail-labels';

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
 */

interface MailThreadPrintModalProps {
  opened: boolean;
  onClose: () => void;
  orgId: string;
  /** Линия писем из конструктора: тот же порядок и те же глубины. */
  nodes: readonly ThreadLineNode[];
  /** Широкий экран: модалка встаёт рядом с конструктором, узкий — во весь экран. */
  wide: boolean;
}

/** Письмо и то, что отмечено под ним к печати. */
interface PrintRow {
  readonly letter: MailPrintLetter;
  readonly files: readonly MailPrintFile[];
}

/** Состояние одного файла: блоб получен или не получен. */
type PrintBlobStatus = 'loading' | 'ready' | 'failed';

interface PrintBlobEntry {
  readonly id: string;
  readonly url: string;
}

/** Что удалось получить по файлу: готовый объектный URL или ничего. */
interface PrintBlobs {
  readonly statuses: ReadonlyMap<string, Exclude<PrintBlobStatus, 'loading'>>;
  readonly urlFor: (id: string) => string | null;
}

/**
 * Блобы отмеченных файлов.
 *
 * Отдельный хук, а не эффект внутри модалки, потому что у него своя жизнь: он
 * переживает перерисовку дерева и умирает вместе с модалкой. «Загружается» не
 * хранится — файла, для которого нет записи об успехе или провале, ещё не
 * разбирали, и состояние выводится из отсутствия записи, а не пишется заранее.
 *
 * Полученный блоб живёт до закрытия модалки и повторно не качается: отпускать
 * его при снятии флажка нельзя, потому что на флажок успевают нажимать руками
 * (снял-поставил), и каждый такой обмен иначе то ли загружал бы файл заново,
 * то ли оставлял бы на экране «готовый» файл, блоба которого уже нет.
 */
function usePrintBlobs(entries: readonly PrintBlobEntry[]): PrintBlobs {
  const [settled, setSettled] = useState<ReadonlyMap<string, Exclude<PrintBlobStatus, 'loading'>>>(
    () => new Map(),
  );
  const urlsRef = useRef(new Map<string, string>());
  const startedRef = useRef(new Set<string>());
  const mountedRef = useRef(true);

  useEffect(() => {
    for (const entry of entries) {
      if (startedRef.current.has(entry.id)) continue;
      startedRef.current.add(entry.id);

      void (async () => {
        try {
          const response = await fetch(entry.url);
          if (!response.ok) throw new Error(String(response.status));
          const blob = await response.blob();
          if (!mountedRef.current) return;
          urlsRef.current.set(entry.id, URL.createObjectURL(blob));
          setSettled((prev) => new Map(prev).set(entry.id, 'ready'));
        } catch {
          if (!mountedRef.current) return;
          setSettled((prev) => new Map(prev).set(entry.id, 'failed'));
        }
      })();
    }
  }, [entries]);

  useEffect(() => {
    // Не в инициализаторе `useRef`: `StrictMode` в разработке прогоняет
    // размонтирование и монтирование снова на том же экземпляре, и рефы при этом
    // сохраняются. Выставленное один раз значение после первого cleanup навсегда
    // осталось бы `false`, и каждый результат загрузки выбрасывался бы молча:
    // файл не дошёл бы до `ready` и не попал бы в печать.
    mountedRef.current = true;
  }, []);

  useEffect(
    () => () => {
      mountedRef.current = false;
      // Отметка «уже качали» снимается ровно для тех файлов, блоб которых
      // сейчас отпускается: держать её после этого нельзя, иначе файл больше не
      // заберут никогда. Загрузки, которые ещё летят, отметку сохраняют — их
      // результат переживает размонтирование и дойдёт до `ready` сам.
      for (const id of urlsRef.current.keys()) startedRef.current.delete(id);
      for (const url of urlsRef.current.values()) URL.revokeObjectURL(url);
      urlsRef.current.clear();
    },
    [],
  );

  const urlFor = (id: string) => urlsRef.current.get(id) ?? null;

  return { statuses: settled, urlFor };
}

/**
 * Печатный документ. Портал в `body` и класс `print-root` — по образцу
 * `PrintableInvoices`: правило `body > *:not(.print-root)` убирает со страницы
 * приложение целиком. Отличие одно: на экране корень скрыт, поэтому модалка с
 * флажками остаётся поверх и не превращается в предпросмотр в полстраницы.
 */
const PRINT_CSS = `
  .print-root { display: none; }
  @media print {
    @page { margin: 10mm; }
    html, body { height: auto; overflow: visible; }
    body > *:not(.print-root) { display: none !important; }
    .print-root {
      display: block !important;
      color: #000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 10pt;
      line-height: 1.4;
    }
    .mail-print-block { break-inside: avoid; page-break-inside: avoid; margin-bottom: 10mm; }
    .mail-print-heading {
      font-size: 11pt;
      font-weight: 700;
      margin: 0 0 4mm 0;
      padding-bottom: 1.5mm;
      border-bottom: 1px solid #000;
    }
    .mail-print-file { break-inside: avoid; page-break-inside: avoid; margin-bottom: 8mm; }
    .mail-print-file-name { font-size: 9pt; margin: 0 0 2mm 0; }
    .mail-print-image { display: block; max-width: 100%; max-height: 225mm; object-fit: contain; margin: 0 auto; }
    .mail-print-frame { display: block; width: 100%; height: 235mm; border: 1px solid #999; }
    .mail-print-note {
      border: 1px dashed #666;
      padding: 4mm;
      font-size: 9pt;
      margin: 0;
    }
  }
`;

function MailThreadPrintDocument({
  rows,
  blobs,
}: {
  rows: readonly PrintRow[];
  blobs: PrintBlobs;
}) {
  return createPortal(
    <div className="print-root">
      <style>{PRINT_CSS}</style>
      {rows.map((row) => (
        <section key={row.letter.key} className="mail-print-block">
          <h2 className="mail-print-heading">{row.letter.heading}</h2>
          {row.files.map((file) => (
            <PrintableFile key={file.id} file={file} blobs={blobs} />
          ))}
        </section>
      ))}
    </div>,
    document.body,
  );
}

/**
 * Один файл на печати. Картинка рисуется `<img>`, PDF — рамкой с его же
 * содержимым, всё остальное — рамкой с названием: показать содержимое документа
 * или таблицы без библиотеки нельзя, и делать вид, что можно, нечестно.
 */
function PrintableFile({ file, blobs }: { file: MailPrintFile; blobs: PrintBlobs }) {
  const status = blobs.statuses.get(file.id) ?? 'loading';
  const url = blobs.urlFor(file.id);
  const note = printFileNote(file.kind, status);

  return (
    <div className="mail-print-file">
      <p className="mail-print-file-name">{file.displayName}</p>
      {note !== null ? (
        <p className="mail-print-note">{note}</p>
      ) : file.kind === 'image' ? (
        <img className="mail-print-image" src={url ?? ''} alt={file.displayName} />
      ) : (
        <iframe className="mail-print-frame" title={file.displayName} src={url ?? ''} />
      )}
    </div>
  );
}

/**
 * Чем заменить содержимое файла, который печатать нечем. Три случая различаются
 * намеренно: «нечем», «не получилось» и «ещё не готово» — это разные вещи, и
 * свалить их в одно сообщение значит соврать о том, что произошло.
 */
function printFileNote(kind: MailPrintFileKind, status: PrintBlobStatus): string | null {
  if (kind === 'other') {
    return 'Содержимое файла на печать не выводится — в документ попадёт только его название.';
  }
  if (status === 'loading') return 'Файл ещё не получен — печать начнётся, когда он будет готов.';
  if (status === 'failed') return 'Файл получить не удалось: вложение недоступно или удалено.';
  return null;
}

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

          {!isLoading && !isError && letters.length > 0 && (
            <ScrollArea.Autosize mah="min(56vh, 30rem)">
              <Stack gap="xs" pr={4}>
                {letters.map((letter) => (
                  <Box key={letter.key} pl={letter.depth * MAIL_TREE_INDENT}>
                    <Group gap={6} wrap="wrap">
                      <Badge size="xs" variant="light" color={MAIL_REGISTER_COLORS[letter.type]}>
                        {MAIL_REGISTER_BADGE_LABELS[letter.type]}
                      </Badge>
                      <Text size="sm" fw={600} style={{ overflowWrap: 'anywhere' }}>
                        {letter.heading}
                      </Text>
                    </Group>

                    {letter.files.length === 0 ? (
                      <Text size="xs" c="dimmed" pl={MAIL_TREE_INDENT}>
                        Вложений нет
                      </Text>
                    ) : (
                      <Stack gap={4} pl={MAIL_TREE_INDENT}>
                        {letter.files.map((file) => (
                          <Checkbox
                            key={file.id}
                            size="xs"
                            checked={checked.has(file.id)}
                            onChange={() => toggle(file.id)}
                            label={
                              <Text
                                size="xs"
                                style={{
                                  overflowWrap: 'anywhere',
                                  color:
                                    file.kind === 'other'
                                      ? 'var(--mantine-color-dimmed)'
                                      : undefined,
                                }}
                              >
                                {file.displayName}
                                {file.kind === 'other' && ' — печатается только название'}
                              </Text>
                            }
                          />
                        ))}
                      </Stack>
                    )}
                  </Box>
                ))}
              </Stack>
            </ScrollArea.Autosize>
          )}

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

      {opened && rows.length > 0 && <MailThreadPrintDocument rows={rows} blobs={blobs} />}
    </>
  );
}
