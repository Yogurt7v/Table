import type { DeliveryMethod } from '@/shared/types';

/** Способы доставки — порядок пунктов в одноимённой колонке панели. */
export const DELIVERY_METHODS: DeliveryMethod[] = ['email', 'post', 'courier', 'messenger'];

/** Широко, но никогда не шире окна: горизонтальной прокрутки страницы быть не должно. */
export const PANEL_WIDTH = 'min(1100px, 92vw)';

/**
 * Класс на выпадающем окне пикера периода. `DatePickerInput` рендерит его
 * через `Popover.Portal` прямо в `document.body`, то есть вне панели, поэтому
 * клик в нём для любого оверлея — клик снаружи. Пометив окно, панель может
 * отличить «пользователь выбирает дату» от «пользователь ушёл на страницу» и
 * не захлопнуться на середине выбора диапазона.
 */
export const PERIOD_DROPDOWN_CLASS = 'mail-filters-period-dropdown';

export const OPTION_SELECTOR = '[data-mail-filter-option]:not(:disabled)';
export const COLUMN_SELECTOR = '[data-mail-filter-column]';
/** Переключатель порядка — соседняя кнопка панели, клик по ней её не закрывает. */
export const SORT_TOGGLE_SELECTOR = '[data-mail-sort-toggle]';
