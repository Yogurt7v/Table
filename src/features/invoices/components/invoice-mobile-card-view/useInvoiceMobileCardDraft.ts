import { useState, type KeyboardEvent } from 'react';
import { useAutoScrollIntoView } from '@/shared/hooks/useAutoScrollIntoView';
import type {
  DraftFieldErrorKey,
  DraftFieldErrors,
  DraftInvoiceForm,
} from '@/features/invoices/invoice-field-access';
import { isDraftDirty, validateDraftFields } from '@/features/invoices/invoice-field-access';

interface UseInvoiceMobileCardDraftParams {
  isDraftOpen: boolean;
  draftForm?: DraftInvoiceForm;
  onDraftChange?: (field: keyof DraftInvoiceForm, value: unknown) => void;
  onDraftSave?: () => void;
  onDraftCancel?: () => void;
}

/**
 * Состояние и обработчики черновика нового счёта в мобильном виде:
 * валидация, ошибки полей, подтверждение отмены при несохранённых данных
 * и автопрокрутка к карточке черновика.
 */
export function useInvoiceMobileCardDraft({
  isDraftOpen,
  draftForm,
  onDraftChange,
  onDraftSave,
  onDraftCancel,
}: UseInvoiceMobileCardDraftParams) {
  const [draftErrors, setDraftErrors] = useState<DraftFieldErrors>({});
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const draftCardRef = useAutoScrollIntoView<HTMLDivElement>({
    enabled: isDraftOpen && !!draftForm,
  });

  /** Отмена: если черновик изменён — спросить подтверждение, иначе закрыть сразу. */
  const requestDraftCancel = () => {
    if (draftForm && isDraftDirty(draftForm)) {
      setDiscardConfirmOpen(true);
      return;
    }
    setDraftErrors({});
    onDraftCancel?.();
  };

  /** Сохранение: валидирует обязательные поля и отдаёт наверх только при успехе. */
  const handleDraftSaveClick = () => {
    if (!draftForm) {
      onDraftSave?.();
      return;
    }
    const errors = validateDraftFields(draftForm);
    if (Object.keys(errors).length > 0) {
      setDraftErrors(errors);
      return;
    }
    setDraftErrors({});
    onDraftSave?.();
  };

  // Изменение поля черновика: снимаем ошибку этого поля и пробрасываем значение.
  const handleDraftChange = (field: keyof DraftInvoiceForm, value: unknown) => {
    setDraftErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field as DraftFieldErrorKey];
      return next;
    });
    onDraftChange?.(field, value);
  };

  // Enter в поле: сохранить (кроме открытого списка автодополнения).
  const handleDraftKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    if (e.currentTarget.getAttribute('aria-expanded') === 'true') return;
    e.preventDefault();
    handleDraftSaveClick();
  };

  return {
    draftCardRef,
    draftErrors,
    setDraftErrors,
    discardConfirmOpen,
    setDiscardConfirmOpen,
    requestDraftCancel,
    handleDraftSaveClick,
    handleDraftChange,
    handleDraftKeyDown,
  };
}
