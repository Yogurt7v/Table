import { isOptionsGroup } from '@mantine/core';
import type { ComboboxItem, ComboboxLikeProps } from '@mantine/core';
import { MAIL_DELIVERY_METHOD_NAMES, type DeliveryMethod } from '@/shared/types';
import { rankCounterpartyMatches } from '../../mail-counterparty-match';

/** Граница `sm` — тот же порог, по которому `MailThreadBuilder` меняет раскладку. */
export const WIDE_QUERY = '(min-width: 48em)';

/**
 * Ширина колонки полей. Форма — это письмо, а не таблица: растянутая на
 * весь экран строка читается хуже, чем та же строка в 880 пикселей, поэтому
 * колонка ограничена и центрирована независимо от ширины окна.
 */
export const FORM_CONTENT_MAX_WIDTH = 880;

/**
 * Задержка пересчёта подсказки по номеру. Ровно как в `MailSearchInput`: тот же
 * набор текста должен ощущаться одинаково во всём реестре, иначе один и тот же
 * жест в строке поиска и в поле формы ведёт себя по-разному.
 */
export const RESOLVE_DEBOUNCE_MS = 280;

/**
 * Потолок выпадающих списков. Восемь строк `limit` однострочными подписями в
 * него укладываются, а длинные названия с переносом второй строки — уже нет,
 * и список обязан остаться прокручиваемым блоком, а не растягивать форму.
 */
export const DROPDOWN_MAX_HEIGHT = 300;

type CounterpartyFilter = NonNullable<ComboboxLikeProps['filter']>;

/**
 * Переходник от `filter` Mantine к `rankCounterpartyMatches`, который про Mantine
 * ничего не знает.
 *
 * Свой `filter` вместо штатного `defaultOptionsFilter` обязателен по двум
 * причинам, проверенным по исходникам Mantine 7.17.8: тот сохраняет порядок
 * `options` и режет его по `limit` (а словарь отсортирован по алфавиту целиком,
 * поэтому совпадение из середины слова не доходило до выпадающего списка), и он
 * делает только `trim()`, тогда как ранжирование сравнивает через
 * `foldSearchText` — из-за неразрывных пробелов в названиях.
 *
 * Групп в `data` быть не может — он собран из строк, — но тип `filter` допускает
 * `ComboboxParsedItemGroup`, поэтому группы отсекаются штатным `isOptionsGroup`,
 * а не приведением типа. Возвращаем те же опции, что пришли: `label` у них равен
 * `value`, и пересобирать его здесь означало бы дублировать формат Mantine.
 */
export const rankCounterpartyOptions: CounterpartyFilter = ({ options, search, limit }) => {
  const items = options.filter((option): option is ComboboxItem => !isOptionsGroup(option));
  const byValue = new Map(items.map((option) => [option.value, option]));
  return rankCounterpartyMatches([...byValue.keys()], search, limit)
    .map((value) => byValue.get(value))
    .filter((option): option is ComboboxItem => option !== undefined);
};

export const DELIVERY_OPTIONS = (Object.keys(MAIL_DELIVERY_METHOD_NAMES) as DeliveryMethod[]).map(
  (value) => ({ value, label: MAIL_DELIVERY_METHOD_NAMES[value] }),
);
