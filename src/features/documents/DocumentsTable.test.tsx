import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { DocumentsTable } from './DocumentsTable';
import type { DocumentColumnId, IDocument } from '@/shared/types';

const document: IDocument = {
  id: 'doc-1',
  organization_id: 'org-1',
  accounting_object_id: 'obj-1',
  seq: 1,
  payment_date: '2026-01-01',
  counterparty: 'ООО Ромашка',
  purpose: 'назначение',
  contract_no: '',
  invoice_no: '',
  amount: 1000,
  responsible_id: 'user-1',
  created_by: 'user-1',
  creation_mode: 'manual',
  sync_locked: false,
  provided: false,
  confirmed: false,
  payment_cancelled: false,
  is_deleted: false,
};

function renderTable(visibleColumns: DocumentColumnId[]) {
  return render(
    <MantineProvider>
      <DocumentsTable
      groups={[
        {
          objectId: 'obj-1',
          objectName: 'Объект 1',
          documents: [document],
          total: 1,
          page: 1,
        },
      ]}
      visibleColumns={visibleColumns}
      sizing={{}}
      filesByDocument={{}}
      commentsByDocument={{}}
      pageSize={15}
      collapsedIds={new Set()}
      onToggleCollapse={() => {}}
      onPageChange={() => {}}
      onWidthChange={() => {}}
      onWidthCommit={() => {}}
      onOpenDocument={() => {}}
      />
    </MantineProvider>,
  );
}

describe('DocumentsTable', () => {
  it('рендерит колонки в порядке visibleColumns, а не в каноническом', () => {
    renderTable(['amount', 'seq', 'counterparty']);
    const headers = screen.getAllByRole('columnheader');
    expect(headers.map((header) => header.textContent)).toEqual([
      'Сумма',
      '№',
      'Контрагент',
    ]);
  });

  it('пропускает скрытые колонки', () => {
    renderTable(['counterparty', 'amount']);
    const headers = screen.getAllByRole('columnheader');
    expect(headers.map((header) => header.textContent)).toEqual(['Контрагент', 'Сумма']);
  });
});
