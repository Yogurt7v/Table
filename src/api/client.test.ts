import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

/**
 * Сторожевой тест на отключённую автоотмену запросов.
 *
 * В SDK поле `enableAutoCancellation` приватное (проверено в
 * `node_modules/pocketbase/dist/pocketbase.es.d.ts`), поэтому проверить его на
 * живом клиенте нельзя — читаем исходник, как это уже делает
 * `mail-page-surfaces.test.ts`.
 *
 * Причина теста: ключ отмены — `(метод) + путь коллекции` без query-параметров,
 * поэтому любой следующий GET в ту же коллекцию глушил предыдущий. На `/mail`
 * три GET в `incoming_mails` стартовали за один тик, реестр уходил в ошибку, а
 * таблица показывала «Писем пока нет». Проверка поведения здесь невозможна: нужен
 * браузер и живой PocketBase, а ловить надо сам факт включения флага обратно.
 */

// Путь берём из `import.meta.dirname`, а не из `new URL(..., import.meta.url)`:
// vitest с jsdom подставляет в `import.meta.url` `http://localhost:3000/...`,
// и `fileURLToPath` на таком URL падает с «The URL must be of scheme file».
const CLIENT_SOURCE = readFileSync(`${import.meta.dirname}/client.ts`, 'utf8');

describe('клиент PocketBase', () => {
  it('автоотмена выключена: ключ отмены не различает query-параметры', () => {
    expect(CLIENT_SOURCE).toContain('pb.autoCancellation(false);');
  });

  it('автоотмена не включается обратно ниже по файлу', () => {
    expect(CLIENT_SOURCE).not.toContain('autoCancellation(true)');
  });
});
