import { useMemo, useState } from 'react';
import { Modal, Stack, Text } from '@mantine/core';
import { matchesFolded, foldSearchText } from '@/shared/utils/search-text';
import { MailCandidateRow } from './MailCandidateRow';
import { MailSearchInput } from './MailSearchInput';
import type { MailCandidate, MailCandidateLookup } from './mail-parent';

/**
 * Ручной выбор родителя: все письма организации обоих регистров с поиском.
 *
 * Номер контрагента — это подсказка, а не доказательство: почта приходит с
 * опечатками, а контрагент нумерует письма по-своему. Поэтому у пользователя
 * есть выход из круга «номер не совпал» — искать здесь, а не заново гадать.
 *
 * Запросов нет: список приходит из org-wide выборки `useOrgMailThread` вместе с
 * деревом переписки и формой, поэтому открытие подбора не стоит ничего.
 */

interface MailParentPickerProps {
  opened: boolean;
  onClose: () => void;
  onSelect: (candidate: MailCandidate) => void;
  candidates: MailCandidateLookup | undefined;
  /** Ключ редактируемого письма — оно исключается, связать письмо с собой нельзя. */
  selfKey: string | null;
  /** Письмо, ради которого ищем родителя, — подпись в заголовке. */
  childLabel: string;
}

export function MailParentPicker({
  opened,
  onClose,
  onSelect,
  candidates,
  selfKey,
  childLabel,
}: MailParentPickerProps) {
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    const all = candidates?.all ?? [];
    const selectable = selfKey ? all.filter((candidate) => candidate.key !== selfKey) : all;
    const folded = foldSearchText(search);
    if (!folded) return selectable;
    return selectable.filter((candidate) =>
      matchesFolded([candidate.number, candidate.counterparty, candidate.subject], folded),
    );
  }, [candidates, selfKey, search]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Письмо, на которое отвечает: ${childLabel}`}
      size="lg"
    >
      <Stack gap="sm">
        <MailSearchInput
          value={search}
          onChange={setSearch}
          scopeLabel="письмам организации"
          resultCount={rows.length}
          resultTotal={candidates?.all.length ?? 0}
        />

        {rows.length === 0 ? (
          <Text c="dimmed" size="sm">
            Писем не найдено
          </Text>
        ) : (
          <Stack gap={4} mah={360} style={{ overflowY: 'auto' }}>
            {rows.map((candidate) => (
              <MailCandidateRow
                key={candidate.key}
                candidate={candidate}
                onPick={() => {
                  onSelect(candidate);
                  onClose();
                }}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}
