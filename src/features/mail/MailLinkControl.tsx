import { useState } from 'react';
import { Button, Group, Menu } from '@mantine/core';
import { IconChevronDown, IconLink, IconLinkOff, IconListSearch } from '@tabler/icons-react';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import { formatMailDate } from './mail-date';
import { MAIL_EMPTY_CELL, MAIL_REGISTER_BADGE_LABELS } from './mail-labels';
import type { MailCandidate } from './mail-parent';

/**
 * Кнопка «Связь» — вход в ручную расстановку связей рядом с полосой
 * предложения.
 *
 * Связь живёт в `mail_relations`, и её нельзя задать номером: номер — текст, а
 * не доказательство. Поэтому точка входа всегда видима, а не появляется только
 * при совпадении по номеру, — иначе письмо, чей номер никому не отвечает, не
 * получилось бы связать вовсе.
 *
 * Снятие связи спрятано в меню и спрашивает подтверждения: это меняет структуру
 * переписки, а не одно поле письма, и отменить её одним «Отмена» нельзя.
 */

interface MailLinkControlProps {
  /** Родитель, записанный в `mail_relations`; `null` — письмо стоит в корне. */
  parent: MailCandidate | null;
  canLink: boolean;
  /** Открыть подбор письма во всех регистрах. */
  onPick: () => void;
  /** Снять связь: вернуть письмо в начало цепочки. */
  onRemove: () => void;
}

export function MailLinkControl({ parent, canLink, onPick, onRemove }: MailLinkControlProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!canLink) return null;

  if (!parent) {
    return (
      <Button
        size="compact-sm"
        variant="light"
        leftSection={<IconLink size={16} />}
        onClick={onPick}
      >
        Связь
      </Button>
    );
  }

  return (
    <Group gap="xs" align="center">
      <Menu position="bottom-start" shadow="md" width={260} withinPortal>
        <Menu.Target>
          <Button
            size="compact-sm"
            variant="light"
            color="teal"
            leftSection={<IconLink size={16} />}
            rightSection={<IconChevronDown size={14} />}
          >
            Связь
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>
            {`Сейчас: ${MAIL_REGISTER_BADGE_LABELS[parent.type]} № ${parent.number || MAIL_EMPTY_CELL} от ${formatMailDate(parent.dateKey)}`}
          </Menu.Label>
          <Menu.Item leftSection={<IconListSearch size={16} />} onClick={onPick}>
            Указать другое письмо
          </Menu.Item>
          <Menu.Item
            color="red"
            leftSection={<IconLinkOff size={16} />}
            onClick={() => setConfirmOpen(true)}
          >
            Убрать связь
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <ConfirmModal
        opened={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          onRemove();
        }}
        title="Убрать связь"
        message={`Письмо перестанет отвечать на «${MAIL_REGISTER_BADGE_LABELS[parent.type]} № ${parent.number || MAIL_EMPTY_CELL}» и станет началом цепочки. Потомки этого письма останутся в переписке без корня.`}
        confirmLabel="Убрать связь"
      />
    </Group>
  );
}
