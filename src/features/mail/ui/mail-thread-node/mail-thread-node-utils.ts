/** Вспомогательные функции для отображения узлов линии переписки. */

import type { MailLetter } from '@/features/mail/model/mail-thread';

/** Подпись письма для `aria-label` ручки: пустое письмо назвать нечем. */
export function letterLabel(letter: MailLetter | undefined): string {
  if (!letter) return 'письмо без подписей';
  return letter.number || letter.subject || 'письмо без номера';
}
