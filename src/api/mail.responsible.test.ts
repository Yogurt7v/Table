import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * Сторожевой тест на ширину `responsible` в коллекциях писем.
 *
 * Контракт хранения — список id через запятую, а не один id: `MailFormModal`
 * это Mantine `MultiSelect` с `maxValues={6}`, а `MailSection.handleSave`
 * сохраняет выбор как `values.join(',')`. Но `responsible` создали как
 * `type: "text", max: 15`, а id пользователя PocketBase — ровно
 * `[a-z0-9]{15}`. То есть колонка вмещала ровно одного человека, а второй уже
 * ломал запись: живая проверка на org `yvyg08lk9b61me0`, коллекция
 * `incoming_mails`, дала 400 с
 * `validation_max_text_constraint` («Must be no more than 15 character(s).»).
 *
 * Проверить это поведением нельзя: нужен живой PocketBase и запись в БД, а
 * ловить надо сам факт возврата колонки к одному человеку — в том числе если
 * коллекцию кто-то пересоздаст из миграции с узким `max`. Поэтому читаем
 * исходник миграции, как это уже делают `client.test.ts` и
 * `mail-page-surfaces.test.ts`.
 *
 * Порог 95 — это 6 id худшего случая (6 * 15 + 5 разделителей), а не
 * произвольное число: `RESPONSIBLE_MAX` вытаскивается из исходника, чтобы
 * тест следил за миграцией, а не за продублированным литералом.
 */

const MIGRATIONS_DIR = resolve(import.meta.dirname, '../../pb_migrations');
const MIGRATION_FILE = '1815000011_widen_mail_responsible.js';
const MIGRATION_PATH = resolve(MIGRATIONS_DIR, MIGRATION_FILE);

const MAIL_COLLECTIONS = [
  'incoming_mails',
  'outgoing_mails',
  'deleted_incoming_mails',
  'deleted_outgoing_mails',
] as const;

// 6 ответственных — предел `MultiSelect maxValues={6}`.
const SIX_IDS_WORST_CASE = 6 * 15 + 5;

// Значение `responsible_name` до миграции: настолько же хватало одному имени.
const RESPONSIBLE_NAME_PREV_MAX = 200;

const readMigration = (): string => readFileSync(MIGRATION_PATH, 'utf8');

const readMaxConstant = (source: string, constant: string): number => {
  const match = source.match(new RegExp(`const ${constant} = (\\d+)`));
  if (!match?.[1]) {
    throw new Error(`миграция не объявляет числовую константу ${constant}`);
  }
  return Number(match[1]);
};

describe('миграция расширения responsible существует и покрывает все письма', () => {
  it('файл миграции лежит в pb_migrations под ожидаемым именем', () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
  });

  it('перечисляет все четыре почтовые коллекции, включая архивы', () => {
    const source = readMigration();
    for (const name of MAIL_COLLECTIONS) {
      expect(source).toContain(`'${name}'`);
    }
  });

  it('правит и responsible, и responsible_name в каждой коллекции', () => {
    const source = readMigration();
    for (const field of ['responsible', 'responsible_name']) {
      expect(source).toContain(`getByName('${field}')`);
    }
  });
});

describe('responsible стал шире, чем один человек', () => {
  it('RESPONSIBLE_MAX покрывает 6 ответственных в худшем случае', () => {
    const max = readMaxConstant(readMigration(), 'RESPONSIBLE_MAX');
    expect(max).toBeGreaterThanOrEqual(SIX_IDS_WORST_CASE);
  });

  it('RESPONSIBLE_NAME_MAX больше прежних 200 символов', () => {
    const max = readMaxConstant(readMigration(), 'RESPONSIBLE_NAME_MAX');
    expect(max).toBeGreaterThan(RESPONSIBLE_NAME_PREV_MAX);
  });

  it('константы ширины реально применяются к полям, а не объявлены вхолостую', () => {
    const source = readMigration();
    expect(source).toMatch(/\.max = RESPONSIBLE_MAX\b/);
    expect(source).toMatch(/\.max = RESPONSIBLE_NAME_MAX\b/);
  });
});

describe('миграция обратима', () => {
  it('down возвращает прежние 15 и 200', () => {
    const source = readMigration();
    expect(readMaxConstant(source, 'RESPONSIBLE_MAX_PREV')).toBe(15);
    expect(readMaxConstant(source, 'RESPONSIBLE_NAME_MAX_PREV')).toBe(RESPONSIBLE_NAME_PREV_MAX);
    expect(source).toMatch(/\.max = RESPONSIBLE_MAX_PREV\b/);
    expect(source).toMatch(/\.max = RESPONSIBLE_NAME_MAX_PREV\b/);
  });

  it('down проходит по тем же четырём коллекциям, что и up', () => {
    // Коллекции перечислены один раз в MAIL_COLLECTIONS, поэтому обе половины
    // migrate() обязаны идти по этому же массиву — иначе откат был бы частичным.
    const source = readMigration();
    const up = source.slice(source.indexOf('(app) => {'));
    const down = source.slice(source.lastIndexOf('(app) => {'));
    expect(up).toContain('for (const name of MAIL_COLLECTIONS)');
    expect(down).toContain('for (const name of MAIL_COLLECTIONS)');
  });
});
