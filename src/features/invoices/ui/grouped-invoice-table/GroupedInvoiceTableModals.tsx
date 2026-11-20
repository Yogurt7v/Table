import { ConfirmModal } from '@/shared/components/ConfirmModal';
import { PayModal } from '@/features/invoices/components/PayModal';
import { PartialPaymentModal } from '@/features/invoices/components/PartialPaymentModal';
import type { IInvoice } from '@/shared/types';

/** Данные для модалки частичной оплаты/отметки. */
export interface GroupedInvoiceTablePartialModalState {
  invoice: IInvoice;
  amount: string;
  comment: string;
}

/** Пропсы модальных окон таблицы сгруппированных счетов. */
interface GroupedInvoiceTableModalsProps {
  payModalInvoice: IInvoice | null;
  payModalAmount: string;
  onPayModalClose: () => void;
  onPayModalAmountChange: (value: string) => void;
  onPaySubmit: (invoice: IInvoice, amount: number) => void;
  partialModal: GroupedInvoiceTablePartialModalState | null;
  onPartialModalClose: () => void;
  onPartialAmountChange: (value: string) => void;
  onPartialCommentChange: (value: string) => void;
  onPartialSave?: (invoiceId: string, amount: number | undefined, comment: string) => void;
  clearConfirmInvoiceId: string | null;
  onClearConfirmClose: () => void;
  onClearPayment: (invoiceId: string) => void;
  discardConfirmOpen: boolean;
  onDiscardConfirmClose: () => void;
  onDiscardConfirm: () => void;
}

/**
 * Модальные окна таблицы сгруппированных счетов:
 * оплата, частичная отметка/оплата, подтверждение снятия оплаты и отмены черновика.
 */
export function GroupedInvoiceTableModals({
  payModalInvoice,
  payModalAmount,
  onPayModalClose,
  onPayModalAmountChange,
  onPaySubmit,
  partialModal,
  onPartialModalClose,
  onPartialAmountChange,
  onPartialCommentChange,
  onPartialSave,
  clearConfirmInvoiceId,
  onClearConfirmClose,
  onClearPayment,
  discardConfirmOpen,
  onDiscardConfirmClose,
  onDiscardConfirm,
}: GroupedInvoiceTableModalsProps) {
  return (
    <>
      {/* Оплата счёта */}
      <PayModal
        opened={!!payModalInvoice}
        onClose={onPayModalClose}
        invoice={payModalInvoice}
        amount={payModalAmount}
        onAmountChange={onPayModalAmountChange}
        onPay={onPaySubmit}
      />

      {/* Частичная оплата/отметка */}
      <PartialPaymentModal
        opened={!!partialModal}
        onClose={onPartialModalClose}
        data={partialModal}
        onAmountChange={onPartialAmountChange}
        onCommentChange={onPartialCommentChange}
        onSave={(invoiceId, amount, comment) => {
          onPartialSave?.(invoiceId, amount, comment);
        }}
      />

      {/* Подтверждение снятия оплаты */}
      <ConfirmModal
        opened={!!clearConfirmInvoiceId}
        onClose={onClearConfirmClose}
        onConfirm={() => {
          if (clearConfirmInvoiceId) {
            onClearPayment(clearConfirmInvoiceId);
          }
          onClearConfirmClose();
        }}
        title="Снятие оплаты"
        message="Снять отметку об оплате счёта?"
      />

      {/* Подтверждение отмены несохранённого черновика */}
      <ConfirmModal
        opened={discardConfirmOpen}
        onClose={onDiscardConfirmClose}
        onConfirm={onDiscardConfirm}
        title="Несохранённый счёт"
        message="Отменить добавление счёта? Введённые данные будут потеряны."
        confirmLabel="Отменить без сохранения"
      />
    </>
  );
}
