/** Метки оплаты счетов: чтение, создание, удаление и подтверждение. */

import { pb } from '@/api/client';
import type { IPaymentMark, PaymentMarkStatus } from '@/shared/types';
import { createPaymentMarkHistory } from './invoice-history.ts';
import { getCurrentActorId } from '@/api/collections/shared';

/** Возвращает все метки оплаты организации. */
export function getPaymentMarks(orgId: string) {
  return pb.collection('payment_marks').getFullList<IPaymentMark>({
    filter: `organization_id = "${orgId}"`,
    sort: '-created',
  });
}

/** Создаёт метку оплаты и записывает событие в историю счёта. */
export async function createPaymentMark(data: {
  invoice_id: string;
  organization_id: string;
  amount?: number | null;
  comment?: string;
  status?: PaymentMarkStatus;
}) {
  const mark = await pb.collection('payment_marks').create<IPaymentMark>({
    invoice_id: data.invoice_id,
    organization_id: data.organization_id,
    amount: data.amount ?? null,
    comment: data.comment ?? '',
    status: data.status,
    created_by: getCurrentActorId(),
  });

  await createPaymentMarkHistory(data.invoice_id, 'mark_created', {
    status: mark.status ?? null,
    amount: mark.amount,
    comment: mark.comment,
  });

  return mark;
}

/** Удаляет метку оплаты и записывает событие в историю счёта. */
export async function deletePaymentMark(id: string) {
  const mark = await pb.collection('payment_marks').getOne<IPaymentMark>(id);

  await createPaymentMarkHistory(mark.invoice_id, 'mark_deleted', {
    status: mark.status ?? null,
    amount: mark.amount,
    comment: mark.comment,
  });

  return pb.collection('payment_marks').delete(id);
}

/** Подтверждает метку оплаты: пересоздаёт её со статусом approved с записью истории. */
export async function approvePaymentMark(id: string) {
  const mark = await pb.collection('payment_marks').getOne<IPaymentMark>(id);

  await createPaymentMarkHistory(mark.invoice_id, 'mark_deleted', {
    status: mark.status ?? null,
    amount: mark.amount,
    comment: mark.comment,
  });

  await pb.collection('payment_marks').delete(id);

  const created = await pb.collection('payment_marks').create<IPaymentMark>({
    invoice_id: mark.invoice_id,
    organization_id: mark.organization_id,
    amount: mark.amount,
    comment: mark.comment,
    status: 'approved',
    created_by: getCurrentActorId(),
  });

  await createPaymentMarkHistory(mark.invoice_id, 'mark_created', {
    status: created.status ?? null,
    amount: created.amount,
    comment: created.comment,
  });

  return created;
}
