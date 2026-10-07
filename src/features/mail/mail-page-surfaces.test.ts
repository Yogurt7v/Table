import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

/**
 * Сторожевой тест на состав поверхностей страницы писем.
 *
 * Три задачи подряд «возвращали» на `/mail` кнопку периода и архив удалённых
 * писем: параллельная правка `MailSection.tsx` из устаревшей копии файла
 * возвращала и сами компоненты, и их вызовы. Каждая из тех правок была
 * логически верной по отдельности и проходила CI, потому что визуальной
 * регрессии на `/mail` нет вообще — сравнить не с чем.
 *
 * Поэтому здесь сравнивать нечего: тест читает исходники и проверяет, что
 * удалённое осталось удалённым, а Period/Архив остались достижимы оттуда, где
 * им и место. Ни одна существующая проверка этого не ловила — ни рендер
 * `MailSection` (слишком много хуков вокруг), ни тесты `MailFilters`
 * (меню фильтров в них не открывается).
 *
 * Это НЕ замена поведенческим тестам: он не знает, что меню действительно
 * открывается. Он знает ровно одно — куда эти контролы переехали и что
 * страница писем обратно их не тащит.
 */

const read = (relativePath: string): string =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

const MAIL_SECTION = read('./MailSection.tsx');
const MAIL_FILTERS = read('./MailFilters.tsx');
const ADMIN_PAGE = read('../../pages/AdminPage.tsx');

const pathFromSrc = (relativePath: string): string =>
  fileURLToPath(new URL(relativePath, import.meta.url));

describe('страница писем не содержит удалённых контролов', () => {
  it('MailPeriodControl удалён с диска вместе с файлом', () => {
    expect(existsSync(pathFromSrc('./MailPeriodControl.tsx'))).toBe(false);
  });

  it('MailArchiveModal удалён с диска вместе с файлом', () => {
    expect(existsSync(pathFromSrc('./MailArchiveModal.tsx'))).toBe(false);
  });

  it('MailSection не импортирует и не рендерит ни того, ни другого', () => {
    expect(MAIL_SECTION).not.toMatch(/MailPeriodControl/);
    expect(MAIL_SECTION).not.toMatch(/MailArchiveModal/);
  });

  it('MailSection не держит состояние архива и не гейтит его canViewArchive', () => {
    // `canViewArchive` остаётся флагом в `mail-field-access`, но читать его
    // на `/mail` больше незачем: там нет ни кнопки, ни модалки архива.
    expect(MAIL_SECTION).not.toMatch(/archiveOpen|setArchiveOpen/);
    expect(MAIL_SECTION).not.toMatch(/canViewArchive/);
    expect(MAIL_SECTION).not.toMatch(/IconArchive/);
  });

  it('MailSection не остался с пустой обёрткой на месте кнопок периода', () => {
    // Обёртка, из которой вынули единственного ребёнка, — это тот самый
    // «невидимый» мусор, который ни typecheck, ни lint не замечают.
    expect(MAIL_SECTION).not.toMatch(/<Group[^>]*>\s*<\/Group>/);
  });

  it('поиск на странице писем остался со всеми пятью пропсами', () => {
    expect(MAIL_SECTION).toMatch(/<MailSearchInput/);
    for (const prop of ['value=', 'onChange=', 'scopeLabel=', 'resultCount=', 'resultTotal=']) {
      expect(MAIL_SECTION).toMatch(new RegExp(`<MailSearchInput[\\s\\S]*?${prop}`));
    }
  });

  it('настройка колонок и создание письма в шапке остались на месте', () => {
    expect(MAIL_SECTION).toMatch(/Настройка колонок/);
    expect(MAIL_SECTION).toMatch(/Создать письмо/);
  });
});

describe('период по-прежнему достижим целиком', () => {
  it('все четыре предустановки лежат пунктами меню «Фильтр»', () => {
    const items = MAIL_FILTERS.match(/const PERIOD_ITEMS = \[[^\]]*\]/)?.[0] ?? '';
    for (const preset of ['today', 'week', 'month', 'all']) {
      expect(items).toContain(`'${preset}'`);
    }
    // Пункты, а не отдельная строка кнопок: точка входа одна — меню фильтров.
    expect(MAIL_FILTERS).toMatch(/PERIOD_ITEMS\.map/);
    expect(MAIL_FILTERS).toMatch(/filters\.setPeriod/);
  });

  it('произвольный диапазон остался двумя пикерами рядом с меню', () => {
    expect(MAIL_FILTERS).toMatch(/Период с/);
    expect(MAIL_FILTERS).toMatch(/Период по/);
    expect(MAIL_FILTERS).toMatch(/setCustomRange/);
  });
});

describe('архив удалённых писем остался достижим из админки', () => {
  it('вкладка «Архив сообщений» на месте и рендерит DeletedMailsSection', () => {
    expect(ADMIN_PAGE).toMatch(/value="mail-archive"[^]*Архив сообщений/);
    expect(ADMIN_PAGE).toMatch(/<DeletedMailsSection orgId=\{currentOrgId\} \/>/);
  });

  it('секция архива не потеряла модалку истории при переезде', () => {
    expect(read('../../features/admin/DeletedMailsSection.tsx')).toMatch(
      /MailArchiveHistoryModal/,
    );
  });
});
