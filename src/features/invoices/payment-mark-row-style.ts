import type { IPaymentMark } from '@/shared/types';
import { getPaymentMarkKind } from './payment-mark-status';

/** Подложка строки/карточки для отметок: согласование — серая, частичная — оранжевая, к оплате — жёлтая. */
export function markRowColor(mark: IPaymentMark, invoiceAmount: number): string {
  switch (getPaymentMarkKind(mark, invoiceAmount)) {
    case 'approval':
      return 'var(--mantine-color-gray-2)';
    case 'partial':
      return 'var(--mantine-color-orange-0)';
    default:
      return 'var(--mantine-color-yellow-1)';
  }
}