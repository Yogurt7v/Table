import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import {
  COLUMN_SELECTOR,
  OPTION_SELECTOR,
  PERIOD_DROPDOWN_CLASS,
  SORT_TOGGLE_SELECTOR,
} from './mail-filters-constants';

/**
 * Открытое состояние панели фильтров, закрытие по клику вне и навигация стрелками.
 *
 * Открытое состояние держит хук, а не `Popover`: у `Menu` за это отвечал
 * `closeOnItemClick={false}`, у `Popover` такого пропса нет, и без явного
 * состояния панель закрывалась бы на каждом клике — то есть множественный
 * выбор стал бы невозможным.
 *
 * Ловушка портала. Пикеры периода живут в строке рядом с кнопкой, а не внутри
 * панели: `DatePickerInput` рендерит своё окно через `Popover.Portal` в
 * `document.body`, то есть вне ссылок панели, и клик в нём срабатывает как
 * клик снаружи. Штатный `closeOnClickOutside` из-за этого закрыл бы панель, не
 * успев выбрать дату, поэтому он выключен, а закрытие по клику вне ведёт
 * обработчик ниже: он исключает и панель, и кнопку, и помеченное окно пикера.
 *
 * Переключатель порядка исключён из закрытия по той же логике, что и сама
 * кнопка «Фильтр»: это соседний элемент той же строки панели управления, а не
 * место снаружи, и захлопывать по нему открытую панель означало бы наказать
 * пользователя за перестановку порядка на середине работы с отбором.
 */
export function useMailFiltersPanel() {
  const [opened, setOpened] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Закрытие по клику вне панели: все исключения — ссылки самой панели
  // управления (триггер, порядок, период и его портал).
  useEffect(() => {
    if (!opened) return;
    const closeOnOutside = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (panelRef.current?.contains(target)) return;
      if (target.closest('[data-mail-filter-trigger]')) return;
      if (target.closest(SORT_TOGGLE_SELECTOR)) return;
      if (target.closest('[data-mail-filter-period]')) return;
      if (target.closest(`.${PERIOD_DROPDOWN_CLASS}`)) return;
      setOpened(false);
    };
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('touchstart', closeOnOutside);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('touchstart', closeOnOutside);
    };
  }, [opened]);

  /** Стрелки/Home/End внутри колонки: фокус прыгает по пунктам её сетки. */
  const handlePanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const { key } = event;
    if (key !== 'ArrowDown' && key !== 'ArrowUp' && key !== 'Home' && key !== 'End') return;
    const target = event.target;
    const column = target instanceof Element ? target.closest<HTMLElement>(COLUMN_SELECTOR) : null;
    const options = column ? Array.from(column.querySelectorAll<HTMLElement>(OPTION_SELECTOR)) : [];
    if (options.length === 0) return;
    event.preventDefault();
    const current = target instanceof HTMLElement ? options.indexOf(target) : -1;
    const next =
      key === 'Home'
        ? 0
        : key === 'End'
          ? options.length - 1
          : key === 'ArrowDown'
            ? Math.min(current + 1, options.length - 1)
            : Math.max(current - 1, 0);
    options[next]?.focus();
  };

  const close = () => setOpened(false);

  return { opened, setOpened, panelRef, handlePanelKeyDown, close };
}
