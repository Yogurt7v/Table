import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Group, Text, TextInput } from '@mantine/core';
import { IconSearch, IconX } from '@tabler/icons-react';

/** Задержка перед отправкой запроса — как у реестра счетов, симметрично набору. */
const SEARCH_DEBOUNCE_MS = 280;

interface MailSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Что именно ищется — меняется при переключении вкладки. */
  scopeLabel: string;
  resultCount?: number;
  resultTotal?: number;
  disabled?: boolean;
}

/**
 * Полнотекстовый поиск по письму. Ввод не ходит в сеть на каждую букву: наружу
 * уходит отложенное значение, а выборку делает `src/api/mail.ts` (параметр
 * `search` в `MailListParams`) по шести полям строки.
 *
 * Набор текста живёт здесь, наружу уходит только он — и компонент намеренно
 * НЕ хранит состояние фокуса. Раньше оно было нужно, чтобы прятать счётчик
 * найденного, но `blur` перерисовывал компонент прямо между `mousedown` и
 * `click` по кнопке очистки, и первый клик терялся: пришлось кликать дважды.
 * Счётчик теперь просто показывается, пока есть поисковый запрос, а
 * ререндера на `blur` не происходит вовсе.
 */
export function MailSearchInput({
  value,
  onChange,
  scopeLabel,
  resultCount,
  resultTotal,
  disabled,
}: MailSearchInputProps) {
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  /** Последнее отправленное наружу значение — отличить сброс от набора. */
  const pushedRef = useRef('');

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (text === pushedRef.current) return;
    const timer = window.setTimeout(() => {
      pushedRef.current = text;
      onChangeRef.current(text);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [text]);

  // Внешняя очистка запроса (сброс фильтров): родитель вернул пустое значение,
  // а пользователь уже что-то искал. До первого набора `pushedRef` пуст, и
  // проверка не даёт стереть набираемый текст.
  useEffect(() => {
    if (pushedRef.current === '' || value !== '' || text === '') return;
    setText('');
  }, [value, text]);

  const clear = () => {
    pushedRef.current = '';
    setText('');
    onChange('');
    inputRef.current?.focus();
  };

  const trimmed = value.trim();

  return (
    <Group gap="xs" wrap="nowrap" w="100%" style={{ minWidth: 0 }}>
      <TextInput
        ref={inputRef}
        leftSection={<IconSearch size={16} />}
        // Mantine по умолчанию гасит `pointer-events` у `rightSection`, и без
        // этой строки кнопка очистки видна, но не кликабельна.
        rightSectionPointerEvents="auto"
        // Без Tooltip: его поповер открывается по наведению и перекрывает саму
        // кнопку. Подпись перенесена в aria-label — как в InvoiceSearch.
        rightSection={
          text.length > 0 ? (
            <ActionIcon variant="subtle" size="sm" aria-label="Очистить поиск" onClick={clear}>
              <IconX size={14} />
            </ActionIcon>
          ) : null
        }
        placeholder={`Поиск по ${scopeLabel}...`}
        value={text}
        onChange={(e) => setText(e.currentTarget.value)}
        size="sm"
        // style={{ flex: 1, minWidth: 0 }}
        w="30%"
        disabled={disabled}
        aria-label={`Поиск по ${scopeLabel}`}
      />
      {trimmed.length > 0 && resultCount !== undefined && (
        <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
          {resultCount === resultTotal
            ? `Найдено: ${resultCount}`
            : `Найдено: ${resultCount} из ${resultTotal}`}
        </Text>
      )}
    </Group>
  );
}
