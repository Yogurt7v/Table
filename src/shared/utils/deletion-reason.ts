/** Prefix written before the deletion reason inside a comment field. */
export const DELETION_REASON_PREFIX = 'причина удаления: ';

/**
 * Appends a deletion reason as a new trailing line of a comment.
 *
 * The reason is never appended when it is blank — an empty reason must leave
 * the comment untouched rather than add a dangling prefix.
 */
export function appendDeletionReason(comment: string | undefined | null, reason: string): string {
  const base = (comment ?? '').trimEnd();
  const trimmedReason = reason.trim();
  if (!trimmedReason) return base;
  const line = `${DELETION_REASON_PREFIX}${trimmedReason}`;
  return base ? `${base}\n${line}` : line;
}

/**
 * Removes a deletion reason previously added by `appendDeletionReason`.
 *
 * Only the TRAILING line is removed. A user who typed "причина удаления: ..."
 * into the middle of their own comment keeps it after a restore.
 */
export function stripDeletionReason(comment: string | undefined | null): string {
  const lines = (comment ?? '').split('\n');

  while (lines.length > 1 && (lines[lines.length - 1] ?? '').trim() === '') {
    lines.pop();
  }

  const lastLine = lines[lines.length - 1];
  if (lastLine !== undefined && lastLine.trimStart().startsWith(DELETION_REASON_PREFIX)) {
    lines.pop();
  }

  return lines.join('\n');
}
