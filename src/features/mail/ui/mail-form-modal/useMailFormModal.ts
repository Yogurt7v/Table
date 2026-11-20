import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import type { MailType } from '@/shared/types';
import { useBeforeUnloadGuard } from '@/shared/hooks/useBeforeUnloadGuard';
import { mailNodeKey } from '../../mail-thread';
import { toMailForm, validateMailForm, carryOverForRegisterSwitch } from '../../mail-form';
import type { MailFormErrors, MailFormState } from '../../mail-form';
import {
  candidateByKey,
  intendedParentKey,
  parentSelectOptions,
  suggestParent,
} from '../../mail-parent';
import type { MailCandidate, ParentIntent } from '../../mail-parent';
import { RESOLVE_DEBOUNCE_MS, WIDE_QUERY } from './mail-form-modal-constants';
import { initialIntent, savedParentKey } from './mail-form-modal-utils';
import type { MailFormModalProps } from './mail-form-modal-types';

/**
 * Логика модалки письма: состояние формы, валидация, связь с родителем,
 * защита от ухода, переключение регистра и обработчики клавиш.
 */
export function useMailFormModal({
  opened,
  onClose,
  mailType,
  mail,
  copying,
  candidates,
  parentEdges,
  onTypeChange,
  onSave,
}: MailFormModalProps) {
  const [form, setForm] = useState<MailFormState>(() =>
    toMailForm(mailType, mail, { clearNumber: copying }),
  );
  const [initialForm, setInitialForm] = useState<MailFormState>(() =>
    toMailForm(mailType, mail, { clearNumber: copying }),
  );
  const [errors, setErrors] = useState<MailFormErrors>({});
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [intent, setIntent] = useState<ParentIntent>(() =>
    initialIntent(parentEdges, mailType, mail),
  );
  const [debouncedNumber, setDebouncedNumber] = useState(form.counterpartyNumber);
  const isEditMode = mail !== null;

  /**
   * Регистр переключён переключателем во время копирования. Отдельный флаг, а не
   * сравнение с источником: `mail` при смене регистра меняется сам — письмо
   * прежнего типа уже не лежит в коллекции нового — и по нему смена регистра
   * неотличима от открытия другой копии.
   */
  const registerSwitchedRef = useRef(false);

  const wide = useMediaQuery(WIDE_QUERY, true, { getInitialValueInEffect: true }) !== false;

  useEffect(() => {
    if (!opened) {
      registerSwitchedRef.current = false;
      return;
    }
    // Форма уже перенесена обработчиком переключателя, заново наполнять её
    // письмом прежнего регистра нельзя.
    if (registerSwitchedRef.current) {
      registerSwitchedRef.current = false;
      return;
    }
    const next = toMailForm(mailType, mail, { clearNumber: copying });
    setForm(next);
    setInitialForm(next);
    setErrors({});
    // Копия письма не должна наследовать его родителя, поэтому источник связей
    // для неё намеренно пуст, иначе форма сразу предложит чужую цепочку.
    setIntent(initialIntent(parentEdges, mailType, copying ? null : mail));
    setDebouncedNumber(next.counterpartyNumber);
  }, [opened, mailType, mail, copying, parentEdges]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedNumber(form.counterpartyNumber),
      RESOLVE_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [form.counterpartyNumber]);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm],
  );

  useBeforeUnloadGuard(opened && isDirty);

  const patch = (next: Partial<MailFormState>) => {
    setForm((prev) => ({ ...prev, ...next }));
    setErrors((prev) => {
      const cleared = { ...prev };
      for (const key of Object.keys(next) as (keyof MailFormState)[]) {
        delete cleared[key as keyof MailFormErrors];
      }
      return cleared;
    });
  };

  const selfKey = isEditMode ? mailNodeKey(mailType, mail.id) : null;
  const savedKey = useMemo(
    () => savedParentKey(parentEdges, mailType, mail),
    [parentEdges, mailType, mail],
  );
  const suggestion = useMemo(
    () => suggestParent(candidates, mailType, debouncedNumber, selfKey),
    [candidates, mailType, debouncedNumber, selfKey],
  );
  const namedParent = candidateByKey(candidates, intendedParentKey(intent, savedKey));

  /**
   * Опции поля «Ответ на» — те же письма, что показывает ручной подбор, только
   * свежие сверху и без самого письма среди них.
   */
  const parentOptions = useMemo(
    () => parentSelectOptions(candidates, selfKey),
    [candidates, selfKey],
  );

  const pickParent = (candidate: MailCandidate) => {
    setIntent({ kind: 'picked', key: candidate.key });
  };

  /**
   * Очистка поля — это тот же отказ от связи, а не отдельное состояние: и то и
   * другое оставляет письмо в начале цепочки, и `intendedParentKey` отдаёт по
   * нему `null`, который `MailSection` превращает в план снятия связи.
   */
  const declineParent = () => {
    setIntent({ kind: 'declined' });
  };

  const submit = () => {
    const fieldErrors = validateMailForm(form, mailType);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    onSave(mailType, form, namedParent?.key ?? null);
  };

  const close = () => {
    setErrors({});
    onClose();
  };

  /**
   * Смена регистра переключателем. При копии письмо ещё не сохранено, поэтому
   * введённое переносится в новый регистр целиком — кроме номера, который в
   * другом реестре означает другое поле. При правке переключателя нет вовсе:
   * `updateIncoming` и `updateOutgoing` пишут в разные коллекции, и смена
   * регистра у сохранённого письма порвала бы его связи и историю.
   */
  const switchRegister = (next: MailType) => {
    if (copying && next !== mailType) {
      const carried = carryOverForRegisterSwitch(form);
      setForm(carried);
      setInitialForm(carried);
      setErrors({});
      setDebouncedNumber(carried.counterpartyNumber);
      registerSwitchedRef.current = true;
    }
    onTypeChange(next);
  };

  const requestClose = () => {
    if (isDirty) {
      setConfirmCloseOpen(true);
      return;
    }
    close();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter') return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA') return;
    // Enter в списке с подсвеченной опцией принадлежит списку, а не форме: и
    // `Autocomplete`, и `MultiSelect` вешают `aria-activedescendant` только при
    // реальной подсветке (после `ArrowDown`) — проверено на Mantine 7.17.8.
    if (target.dataset.expanded === 'true' && target.getAttribute('aria-activedescendant')) return;
    e.preventDefault();
    submit();
  };

  return {
    form,
    errors,
    intent,
    debouncedNumber,
    wide,
    isEditMode,
    isDirty,
    suggestion,
    namedParent,
    parentOptions,
    confirmCloseOpen,
    setConfirmCloseOpen,
    patch,
    pickParent,
    declineParent,
    submit,
    close,
    requestClose,
    handleKeyDown,
    switchRegister,
  };
}
