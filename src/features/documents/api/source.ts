/** Доступ к файлам документа и сведения об исходном счёте. */

import { pb } from '@/api/client';
import { getInvoiceFiles } from '@/api/collections';
import type {
  DocumentSourceInfo,
  IDocument,
  IDocumentFile,
  IDeletedInvoice,
  IDeletedInvoiceFile,
  IInvoice,
  IInvoiceFile,
} from '@/shared/types';
import { qTag } from './shared.ts';

/** Возвращает URL файла документа. */
export function getDocumentFileUrl(file: IDocumentFile): string {
  return pb.files.getURL(file, file.file);
}

/** Возвращает сведения об исходном счёте документа (активном или архивном) с файлами. */
export async function getSourceInvoiceInfo(
  document: IDocument,
): Promise<DocumentSourceInfo | null> {
  if (!document.source_invoice_id) return null;

  try {
    const invoice = await pb.collection('invoices').getOne<IInvoice>(document.source_invoice_id);
    const files = await getInvoiceFiles(invoice.id);
    return {
      invoiceId: invoice.id,
      invoiceNo: invoice.invoice_no || '',
      counterparty: invoice.counterparty || '',
      amount: Number(invoice.amount) || 0,
      deleted: false,
      files: files.map((file: IInvoiceFile) => ({
        id: file.id,
        name: file.name || file.file,
        url: pb.files.getURL(file, file.file),
      })),
    };
  } catch {
    const deleted = await pb.collection('deleted_invoices').getFullList<IDeletedInvoice>({
      filter: `original_id = "${qTag(document.source_invoice_id)}"`,
      sort: '-deleted_at',
    });
    const archived = deleted[0];
    if (!archived) return null;
    const files = await pb.collection('deleted_invoice_files').getFullList<IDeletedInvoiceFile>({
      filter: `deleted_invoice_id = "${qTag(archived.id)}"`,
      sort: 'created',
    });
    return {
      invoiceId: archived.original_id,
      invoiceNo: archived.invoice_no || '',
      counterparty: archived.counterparty || '',
      amount: Number(archived.amount) || 0,
      deleted: true,
      files: files.map((file) => ({
        id: file.id,
        name: file.name || file.file,
        url: pb.files.getURL(file, file.file),
      })),
    };
  }
}
