import { useEffect, useRef, useState } from 'react';
import type { PrintBlobEntry, PrintBlobStatus, PrintBlobs } from './mail-thread-print-types';

/**
 * Сколько ждать один файл, прежде чем признать его недоступным.
 *
 * `fetch` без предела ждать нельзя. Ответ, который не пришёл никогда, не
 * оставляет в состоянии ни успеха, ни провала, — а «загружается» здесь выводится
 * из отсутствия записи, поэтому `preparing` не доходит до нуля, кнопка печати
 * остаётся на «Готовятся файлы…», и одно зависшее вложение выключает печать
 * всего документа. Никто при этом ничего не говорит: выглядит как аккуратная
 * очередь, которой почему-то не кончается.
 *
 * Минута — не «сколько обычно», а граница между двумя плохими исходами. Здесь
 * лежат в основном сканы документов: несколько мегабайт по обычному мобильному
 * каналу докачиваются за секунды, и настоящая медленная передача укладывается в
 * этот запас. Всё, что не уложилось, почти наверняка уже не придёт, а ждать его
 * дальше — значит оставлять печать заблокированной без причины и без срока. Что
 * бы ни случилось, к исходу минуты на листе появляется честная пометка о провале,
 * а не вечное ожидание.
 */
const PRINT_BLOB_TIMEOUT_MS = 60_000;

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
export function usePrintBlobs(entries: readonly PrintBlobEntry[]): PrintBlobs {
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
        const controller = new AbortController();
        // Таймер и прерывает запрос, и сам становится ответом. Одной отмены
        // мало: `AbortController` — обещание браузера, а не гарантия (прокси
        // в середине может её и не выполнить), а итог обязан появиться в
        // состоянии независимо от того, послушался ли запрос отмене. Иначе
        // зависшее вложение снова оставит «готовится» навсегда.
        let timer: ReturnType<typeof setTimeout> | undefined;
        const expired = new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error(`вложение ${entry.id} не дождалось ответа`));
          }, PRINT_BLOB_TIMEOUT_MS);
        });
        try {
          const response = await Promise.race([
            fetch(entry.url, { signal: controller.signal }),
            expired,
          ]);
          if (!response.ok) throw new Error(String(response.status));
          const blob = await response.blob();
          if (!mountedRef.current) return;
          urlsRef.current.set(entry.id, URL.createObjectURL(blob));
          setSettled((prev) => new Map(prev).set(entry.id, 'ready'));
        } catch {
          // Сорванный по таймауту запрос попадает сюда же и уходит в провал, а не
          // в «получен»: готовый файл без блоба печатается пустым местом.
          if (!mountedRef.current) return;
          setSettled((prev) => new Map(prev).set(entry.id, 'failed'));
        } finally {
          clearTimeout(timer);
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
