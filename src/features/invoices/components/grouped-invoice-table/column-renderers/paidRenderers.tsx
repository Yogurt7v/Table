import dayjs from 'dayjs';
import { ActionIcon, Badge, Button, Group, Tooltip } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { formatAmountRub } from '@/shared/utils/format-currency';
import type { GroupedInvoiceTableColumnRenderersParams, InvoiceColumnRenderer } from './types';

/** Рендереры колонок оплаты и даты оплаты. */
export function createPaidColumnRenderers(
  params: Pick<
    GroupedInvoiceTableColumnRenderersParams,
    'permissions' | 'setClearConfirmInvoiceId' | 'setPayModalInvoice' | 'setPayModalAmount'
  >,
): { paid: InvoiceColumnRenderer; paid_date: InvoiceColumnRenderer } {
  const { permissions, setClearConfirmInvoiceId, setPayModalInvoice, setPayModalAmount } = params;

  return {
    paid: {
      width: 130,
      header: 'Оплачено',
      renderCell: (invoice) => {
        const amounts = invoice.payment_amounts;
        if (permissions.canPay) {
          if (amounts.length > 0) {
            const isLast = amounts.length === 1;
            return (
              <Group gap={2} wrap="nowrap">
                <Badge color="green" variant="light">
                  {formatAmountRub(amounts[0]!)}
                </Badge>
                {isLast && (
                  <Tooltip label="Снять оплату">
                    <ActionIcon
                      size="md"
                      color="red"
                      variant="filled"
                      aria-label="Снять оплату"
                      onClick={() => setClearConfirmInvoiceId(invoice.id)}
                    >
                      <IconX size={14} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            );
          }
          if (invoice.paid) {
            return (
              <Badge color="green" variant="light">
                {formatAmountRub(
                  invoice.payment_amounts?.reduce((s, a) => s + a, 0) ?? invoice.amount,
                )}
              </Badge>
            );
          }
          return (
            <Button
              size="compact-xs"
              variant="light"
              color="orange"
              onClick={() => {
                setPayModalInvoice(invoice);
                setPayModalAmount(String(invoice.amount));
              }}
            >
              Оплатить
            </Button>
          );
        }
        if (amounts.length > 0) {
          return (
            <Badge color="green" variant="light">
              {formatAmountRub(amounts[0]!)}
            </Badge>
          );
        }
        if (invoice.paid) {
          return (
            <Badge color="green" variant="light">
              {formatAmountRub(invoice.paid_amount ?? invoice.amount)}
            </Badge>
          );
        }
        return (
          <Badge color="orange" variant="light">
            Не оплачено
          </Badge>
        );
      },
      renderDraft: () => null,
    },
    paid_date: {
      width: 120,
      header: 'Дата оплаты',
      renderCell: (invoice) => (
        <>{invoice.paid_date ? dayjs(invoice.paid_date).format('DD.MM.YYYY') : '—'}</>
      ),
      renderDraft: () => null,
    },
  };
}
