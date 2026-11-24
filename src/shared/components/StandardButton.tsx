import { Button, type ButtonProps } from '@mantine/core';
import { type ReactNode } from 'react';

interface StandardButtonProps extends Omit<ButtonProps, 'size' | 'leftSection'> {
  /** Текст кнопки (обязательный) */
  label: string;
  /** Иконка слева (по умолчанию размер 16) */
  leftIcon?: ReactNode;
  /** Вариант кнопки (по умолчанию 'filled') */
  variant?: ButtonProps['variant'];
  /** Цвет кнопки (по умолчанию 'blue') */
  color?: ButtonProps['color'];
  /** Обработчик клика */
  onClick?: ButtonProps['onClick'];
  /** Состояние загрузки */
  loading?: boolean;
  /** Отключена ли кнопка */
  disabled?: boolean;
}

/**
 * Стандартная кнопка проекта: размер md (дефолт Mantine), иконка 16px слева.
 * Используй вместо прямого <Button> для единообразия.
 *
 * @example
 * <StandardButton label="Добавить документ" leftIcon={<IconPlus size={16} />} onClick={handleAdd} />
 */
export function StandardButton({
  label,
  leftIcon,
  variant = 'filled',
  color = 'blue',
  onClick,
  loading,
  disabled,
  ...rest
}: StandardButtonProps) {
  return (
    <Button
      size="md"
      variant={variant}
      color={color}
      leftSection={leftIcon}
      onClick={onClick}
      loading={loading}
      disabled={disabled}
      {...rest}
    >
      {label}
    </Button>
  );
}