import type { Ref } from 'react';
import { ActionIcon, Group, Stack, Table, Tooltip } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';

import type { InvoiceColumnId } from '@/shared/types';
import type { InvoiceColumnRenderer } from './useGroupedInvoiceTableColumnRenderers';

const DRAFT_ROW_STYLE = {
  backgroundColor: 'color-mix(in srgb, var(--org-color, #228be6) 15%, transparent)',
  borderTop: '2px solid var(--org-color, #228be6)',
  borderBottom: '2px solid var(--org-color, #228be6)',
  boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--org-color, #228be6) 40%, transparent)',
  animation: 'draft-pulse 1.4s ease-out 1',
} as const;

interface GroupedInvoiceTableDraftRowProps {
  draftRowRef: Ref<HTMLTableRowElement>;
  filteredColumns: InvoiceColumnId[];
  columnRenderers: Record<InvoiceColumnId, InvoiceColumnRenderer>;
  columnSizing: Record<string, number>;
  onSave: () => void;
  onCancel: () => void;
}

/**
 * Строка черновика нового счёта в десктопной таблице.
 * Показывает поля ввода по колонкам и действия сохранения/отмены.
 */
export function GroupedInvoiceTableDraftRow({
  draftRowRef,
  filteredColumns,
  columnRenderers,
  columnSizing,
  onSave,
  onCancel,
}: GroupedInvoiceTableDraftRowProps) {
  return (
    <Table.Tbody>
      <Table.Tr ref={draftRowRef} style={DRAFT_ROW_STYLE}>
        <Table.Td>
          <Stack gap={2} align="center" style={{ overflow: 'hidden', maxWidth: '100%' }}>
            {/* Маркер новой строки оставлен пустым, чтобы не перегружать таблицу */}
          </Stack>
        </Table.Td>
        {filteredColumns.map((colId) => {
          const col = columnRenderers[colId];
          const width = columnSizing[colId] ?? col.width;
          return (
            <Table.Td key={colId} style={{ width }}>
              <div style={{ overflow: 'hidden', maxWidth: '100%' }}>
                {colId === 'actions' ? (
                  <Group gap={4} wrap="nowrap">
                    <Tooltip label="Сохранить">
                      <ActionIcon
                        size="lg"
                        color="green"
                        variant="filled"
                        aria-label="Сохранить счёт"
                        onClick={onSave}
                      >
                        <IconCheck size={14} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Отмена">
                      <ActionIcon
                        size="lg"
                        color="gray"
                        variant="filled"
                        aria-label="Отменить добавление"
                        onClick={onCancel}
                      >
                        <IconX size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                ) : (
                  col.renderDraft()
                )}
              </div>
            </Table.Td>
          );
        })}
      </Table.Tr>
    </Table.Tbody>
  );
}
