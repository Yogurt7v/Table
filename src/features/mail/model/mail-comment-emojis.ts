/** Иконки важности для комментариев к письмам.
 *
 * Перечень вынесен сюда, чтобы его можно было менять без правки компонентов:
 * добавьте/удалите элементы массива — пикер в форме письма подхватит их
 * автоматически. `emoji` — сам символ, `label` — подпись для aria/tooltip
 * (эмодзи рендерятся с role="img", чтобы строго распознавались как картинки).
 */
export interface MailCommentEmoji {
  emoji: string;
  label: string;
}

/** Размер эмодзи в поле комментария (и в таблице, и в кнопках формы) — отдельно от текста. */
export const COMMENT_EMOJI_FONT_SIZE = '1.5rem';

export const MAIL_COMMENT_EMOJIS: MailCommentEmoji[] = [
  { emoji: '❗', label: 'Внимание' },
  { emoji: '❓', label: 'Вопрос' },
  { emoji: '✅', label: 'Сделано' },
  { emoji: 'ℹ️', label: 'Инфо' },
  { emoji: '🚫', label: 'Неважно' },
  // { emoji: '🔴', label: 'Срочно' },
  { emoji: '📌', label: 'Важно' },
];
