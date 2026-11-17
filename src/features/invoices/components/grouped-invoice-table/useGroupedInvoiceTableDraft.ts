import {
  useState,
  useCallback,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
} from 'react';
import {
  isDraftDirty,
  validateDraftFields,
  type DraftFieldErrorKey,
  type DraftFieldErrors,
  type DraftInvoiceForm,
} from '@/features/invoices/invoice-field-access';

/** Параметры хука управления черновиком строки счёта. */
export interface UseGroupedInvoiceTableDraftParams {
  draftForm?: DraftInvoiceForm;
  onDraftChange?: (field: keyof DraftInvoiceForm, value: unknown) => void;
  onDraftSave?: () => void;
  onDraftCancel?: () => void;
}

/** Результат хука управления черновиком строки счёта. */
export interface UseGroupedInvoiceTableDraftResult {
  draftErrors: DraftFieldErrors;
  setDraftErrors: Dispatch<SetStateAction<DraftFieldErrors>>;
  discardConfirmOpen: boolean;
  setDiscardConfirmOpen: Dispatch<SetStateAction<boolean>>;
  amountFocused: boolean;
  setAmountFocused: Dispatch<SetStateAction<boolean>>;
  amountDisplay: string;
  setAmountDisplay: Dispatch<SetStateAction<string>>;
  requestDraftCancel: () => void;
  handleDraftSaveClick: () => void;
  handleDraftChange: (field: keyof DraftInvoiceForm, value: unknown) => void;
  handleDraftKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
}

/**
 * Управляет состоянием и действиями черновика новой строки счёта:
 * валидация, ошибки полей, подтверждение отмены и обработка ввода суммы/Enter.
 */
export function useGroupedInvoiceTableDraft({
  draftForm,
  onDraftChange,
  onDraftSave,
  onDraftCancel,
}: UseGroupedInvoiceTableDraftParams): UseGroupedInvoiceTableDraftResult {
  const [draftErrors, setDraftErrors] = useState<DraftFieldErrors>({});
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [amountFocused, setAmountFocused] = useState(false);
  const [amountDisplay, setAmountDisplay] = useState<string>('');

  const requestDraftCancel = useCallback(() => {
    if (draftForm && isDraftDirty(draftForm)) {
      setDiscardConfirmOpen(true);
      return;
    }
    setDraftErrors({});
    onDraftCancel?.();
  }, [draftForm, onDraftCancel]);

  const handleDraftSaveClick = useCallback(() => {
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
  }, [draftForm, onDraftSave]);

  const handleDraftChange = useCallback(
    (field: keyof DraftInvoiceForm, value: unknown) => {
      setDraftErrors((prev) => {
        if (!(field in prev)) return prev;
        const next = { ...prev };
        delete next[field as DraftFieldErrorKey];
        return next;
      });
      onDraftChange?.(field, value);
    },
    [onDraftChange],
  );

  const handleDraftKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter') return;
      if (e.currentTarget.getAttribute('aria-expanded') === 'true') return;
      e.preventDefault();
      handleDraftSaveClick();
    },
    [handleDraftSaveClick],
  );

  return {
    draftErrors,
    setDraftErrors,
    discardConfirmOpen,
    setDiscardConfirmOpen,
    amountFocused,
    setAmountFocused,
    amountDisplay,
    setAmountDisplay,
    requestDraftCancel,
    handleDraftSaveClick,
    handleDraftChange,
    handleDraftKeyDown,
  };
}
