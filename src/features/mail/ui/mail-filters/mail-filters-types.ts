import type { ReactNode } from 'react';
import type { MailFilterChip, UseMailFiltersResult } from '@/features/mail/useMailFilters';

/** Пропсы панели фильтров реестра писем. */
export interface MailFiltersProps {
  filters: UseMailFiltersResult;
  mailType: 'incoming' | 'outgoing';
  accountingObjects: { id: string; name: string }[];
  responsibleOptions: { id: string; name: string }[];
  chips: MailFilterChip[];
}

export interface FilterOptionProps {
  active: boolean;
  children: ReactNode;
  /** Красный сброс последним пунктом — как в меню. */
  danger?: boolean;
  disabled?: boolean;
  marker: ReactNode;
  onSelect: () => void;
  /** Сброс закрывает панель: у `Menu.Item` это было `closeMenuOnClick`. */
  closeOnSelect?: boolean;
  onClose: () => void;
}
