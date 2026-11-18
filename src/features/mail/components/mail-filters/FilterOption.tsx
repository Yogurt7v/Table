import type { ReactNode } from 'react';
import { Box, Text, UnstyledButton } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import type { FilterOptionProps } from './mail-filters-types';

const CHECK_MARK = <IconCheck size={16} color="var(--mantine-color-blue-filled)" />;
const CHECK_PLACEHOLDER = <Box w={16} />;

/** Маркер выбранного пункта — тот же `IconCheck`/`Box w={16}`, что в реестре счетов. */
export function CheckMarker({ active }: { active: boolean }) {
  return active ? CHECK_MARK : CHECK_PLACEHOLDER;
}

/**
 * Пункт панели. Раньше это был `Menu.Item`; здесь та же строка вручную, потому
 * что `Menu` — это вертикальный список, а панель — сетка колонок. Внешний вид
 * (`mail-filters-option` в `src/index.css`) повторяет `Menu.Item` до пикселя,
 * включая серый hover, синий выбранный и приглушённый disabled.
 *
 * `aria-pressed`, а не `role="menuitem"`: в `Menu` роль была вынужденной, а
 * здесь это набор переключателей, и «нажато/не нажато» — точное объявление.
 */
export function FilterOption({
  active,
  children,
  danger = false,
  disabled = false,
  marker,
  onSelect,
  closeOnSelect = false,
  onClose,
}: FilterOptionProps) {
  const vars = danger
    ? {
        '--mail-filter-option-color': 'var(--mantine-color-red-6)',
        '--mail-filter-option-hover': 'var(--mantine-color-red-light-hover)',
      }
    : active
      ? {
          '--mail-filter-option-color': 'var(--mantine-color-blue-6)',
          '--mail-filter-option-hover': 'var(--mantine-color-blue-light-hover)',
        }
      : undefined;

  // Строка пункта: маркер слева, подпись справа — раскладка `Menu.Item`.
  return (
    <UnstyledButton
      className="mail-filters-option"
      data-mail-filter-option
      __vars={vars}
      aria-pressed={active}
      disabled={disabled}
      onClick={() => {
        onSelect();
        if (closeOnSelect) onClose();
      }}
    >
      <span className="mail-filters-option__marker">{marker}</span>
      <span className="mail-filters-option__label">{children}</span>
    </UnstyledButton>
  );
}

/** Столбец сетки панели: подпись сверху, тело с пунктами под ней. */
export function FilterColumn({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box className="mail-filters-column" data-mail-filter-column>
      <Text className="mail-filters-column__label">{label}</Text>
      {children}
    </Box>
  );
}
