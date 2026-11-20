/** Константы оформления узла и промежутка линии переписки. */

/** Ширина колонки подписей (дата/номер) и линии. Числа, а не `rem`: колонки узкие и постоянные. */
export const GUTTER_WIDTH = 96;
/** Ширина колонки вертикальной линии переписки. */
export const SPINE_WIDTH = 26;
/** Размер круглой засечки на линии. */
export const TICK_SIZE = 11;
/** Ширина области ручки перетаскивания (или её заглушки). */
export const HANDLE_BOX = 32;

export const SPINE_IDLE = 'var(--mantine-color-gray-4)';
export const SPINE_HOVER = 'var(--mantine-color-blue-5)';
export const SPINE_DROP = 'var(--mantine-color-blue-6)';
export const SPINE_REJECT = 'var(--mantine-color-red-6)';

/** Подпись письма, недоступного в индексе (связь на удалённое письмо). */
export const MISSING_LETTER_LABEL = 'Письмо недоступно — связь ссылается на удалённое письмо';
