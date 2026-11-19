import { Loader, Modal, Text } from '@mantine/core';
import { InvoiceHistoryTimeline } from './components/invoice-history-modal/InvoiceHistoryTimeline';
import { useInvoiceHistory } from './components/invoice-history-modal/useInvoiceHistory';
import type { InvoiceHistoryModalProps } from './components/invoice-history-modal/invoice-history-modal-types';

/**
 * Модалка истории счёта.
 *
 * Запрос и разбор цепочки — в `useInvoiceHistory`, лента записей — в
 * `InvoiceHistoryTimeline`; здесь только каркас: заголовок с признаком
 * «остаток» у копии и три состояния (загрузка, ошибка, пусто/лента).
 */
export function InvoiceHistoryModal({
  invoiceId,
  invoiceLabel,
  opened,
  onClose,
}: InvoiceHistoryModalProps) {
  const { isLoading, isError, error, entries, hasDiff, isCopyInvoice } = useInvoiceHistory(
    invoiceId,
    opened,
  );

  // Состояния: спиннер, ошибка загрузки, пустая история, лента записей.
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`История: ${invoiceLabel}${isCopyInvoice ? ' · остаток' : ''}`}
      size="lg"
    >
      {isLoading && <Loader size="sm" />}

      {!isLoading && isError && (
        <Text c="red" size="sm">
          Не удалось загрузить историю:{' '}
          {error instanceof Error ? error.message : 'неизвестная ошибка'}
        </Text>
      )}

      {!isLoading && !isError && entries.length === 0 && <Text c="dimmed">Изменений пока нет</Text>}

      {!isLoading && !isError && entries.length > 0 && (
        <>
          {hasDiff && (
            <Text size="xs" c="dimmed" mb="sm">
              Старые значения зачёркнуты
            </Text>
          )}
          <InvoiceHistoryTimeline entries={entries} />
        </>
      )}
    </Modal>
  );
}
