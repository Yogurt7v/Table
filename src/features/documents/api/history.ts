/** Запись истории изменений документа. */

import { pb } from '@/api/client';
import type { DocumentHistoryType, IDocumentHistory } from '@/shared/types';
import { DOCUMENT_HISTORY_COLLECTION } from './constants.ts';
import { normalizeDocumentHistory } from './normalize.ts';
import { currentActorId, currentActorName } from './shared.ts';

/** Создаёт запись истории документа от имени текущего актора. */
export async function createDocumentHistory(
  documentId: string,
  organizationId: string,
  type: DocumentHistoryType,
  previousData: Record<string, unknown>,
): Promise<IDocumentHistory> {
  return normalizeDocumentHistory(
    await pb.collection(DOCUMENT_HISTORY_COLLECTION).create<IDocumentHistory>({
      document_id: documentId,
      organization_id: organizationId,
      author: currentActorId(),
      author_name: currentActorName(),
      changed_at: new Date().toISOString(),
      type,
      previous_data: previousData,
    }),
  );
}
