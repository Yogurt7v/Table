import { Alert, Button, Text } from '@mantine/core';
import { IconLinkPlus } from '@tabler/icons-react';
import { MAIL_THREAD_UNBUILT_TITLE } from '@/features/mail/mail-thread-labels';

/** Пропсы вводного блока конструктора. */
export interface MailThreadBuilderIntroProps {
  canDragSomething: boolean;
  unbuilt: boolean;
  canMoveRoot: boolean;
  onPickParent: () => void;
}

/**
 * Вводный блок над линией писем.
 * Рендерит подсказку о перетаскивании и предложение начать цепочку для письма,
 * у которого связей нет.
 */
export function MailThreadBuilderIntro({
  canDragSomething,
  unbuilt,
  canMoveRoot,
  onPickParent,
}: MailThreadBuilderIntroProps) {
  return (
    <>
      {/* Подсказка о перетаскивании — только тем, кто вправе двигать */}
      {canDragSomething && (
        <Text size="xs" c="dimmed">
          Перетащите письмо на другое — оно станет ответом на него; в промежуток между письмами —
          встанет рядом с соседом; над первым или под последним — начнёт цепочку.
        </Text>
      )}

      {/* Письмо без связей: предлагаем начать цепочку */}
      {unbuilt && (
        <Alert
          color="blue"
          variant="light"
          icon={<IconLinkPlus size={16} />}
          title={MAIL_THREAD_UNBUILT_TITLE}
        >
          <Text size="xs">
            У письма нет связей: начните цепочку, назвав его ответом на другое письмо или перетащив
            сюда другое письмо из этого же списка.
          </Text>
          {canMoveRoot && (
            <Button size="xs" variant="light" mt="xs" onClick={onPickParent}>
              Выбрать, на что оно отвечает
            </Button>
          )}
        </Alert>
      )}
    </>
  );
}
