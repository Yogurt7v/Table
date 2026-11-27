/** Запись истории изменений документа. */

import { pb } from '@/api/client';
import type {
  DocumentHistoryChange,
  DocumentHistoryPayloadV2,
  DocumentHistorySource,
  DocumentHistoryType,
  IDocumentHistory,
} from '@/shared/types';
import { DOCUMENT_HISTORY_COLLECTION } from './constants.ts';
import { normalizeDocumentHistory } from './normalize.ts';
import { currentActorId, currentActorName } from './shared.ts';

interface CreateDocumentHistoryOptions {
  source?: DocumentHistorySource;
  changes?: DocumentHistoryChange[];
  meta?: Record<string, unknown>;
}

/** Собирает payload истории v2 для хранения в previous_data. */
export function buildDocumentHistoryPayload(
  options: CreateDocumentHistoryOptions = {},
): DocumentHistoryPayloadV2 {
  return {
    v: 2,
    source: options.source ?? 'ui',
    changes: options.changes ?? [],
    meta: options.meta ?? {},
  };
}

/** Создаёт запись истории документа от имени текущего актора. */
export async function createDocumentHistory(
  documentId: string,
  organizationId: string,
  type: DocumentHistoryType,
  previousData: Record<string, unknown> | DocumentHistoryPayloadV2,
  options: CreateDocumentHistoryOptions = {},
): Promise<IDocumentHistory> {
  const payload =
    'v' in previousData && previousData.v === 2
      ? previousData
      : buildDocumentHistoryPayload({
          source: options.source,
          changes: options.changes,
          meta:
            options.meta ??
            (Object.keys(previousData).length > 0 ? { legacy: previousData } : {}),
        });

  return normalizeDocumentHistory(
    await pb.collection(DOCUMENT_HISTORY_COLLECTION).create<IDocumentHistory>({
      document_id: documentId,
      organization_id: organizationId,
      author: currentActorId(),
      author_name: currentActorName(),
      changed_at: new Date().toISOString(),
      type,
      previous_data: payload,
    }),
  );
}
