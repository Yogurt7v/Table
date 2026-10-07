import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { createCrossMailRelation, deleteMailRelation } from '@/api/mail';
import type { MailRelationSide } from '@/shared/types';
import type { MailEdge } from './mail-thread';
import type { LinkChangePlan } from './mail-parent';

/**
 * Явная смена связи: человек назвал письму другого родителя или снял связь
 * совсем. Ни один номер при этом не участвует — план приходит от
 * `planLinkChange`, который смотрит только на сохранённые рёбра.
 *
 * Обёртка над `createCrossMailRelation`/`deleteMailRelation` — обе функции в
 * `src/api/mail.ts` уже пишут `linked`/`unlinked` в историю на обоих концах,
 * поэтому история здесь не дублируется. `useCreateMailRelation` из `useMail.ts`
 * не годится: он умеет только связи внутри одного регистра, а входящее письмо
 * отвечает исходящему и наоборот.
 *
 * Порядок «снять старую, создать новую» отражает намерение пользователя, а не
 * техническую возможность. Обратный оставил бы на время операции две связи у
 * письма, и при падении удаления письмо осталось бы с родителем, которого
 * пользователь уже отменил.
 *
 * Откат обязателен: снятые связи восстанавливаются, если новая не создалась,
 * и о неудаче сообщается явно. Молчаливо оставленное письмо без связи
 * читалось бы как «переписку потеряли».
 */

/** Любая запись о связях инвалидирует org-wide граф, обе стороны связей и обе истории. */
function invalidateLinkQueries(queryClient: QueryClient, orgId: string) {
  queryClient.invalidateQueries({ queryKey: ['mailThread', orgId] });
  queryClient.invalidateQueries({ queryKey: ['mailRelations'] });
  queryClient.invalidateQueries({ queryKey: ['incomingMailHistory'] });
  queryClient.invalidateQueries({ queryKey: ['outgoingMailHistory'] });
  queryClient.invalidateQueries({ queryKey: ['incomingMails', orgId] });
  queryClient.invalidateQueries({ queryKey: ['outgoingMails', orgId] });
}

export type LinkChangeArgs = {
  /** Регистр и id письма, у которого меняется родитель. */
  readonly child: MailRelationSide;
  readonly plan: LinkChangePlan;
};

export function useMailLinkChange(orgId: string) {
  const queryClient = useQueryClient();
  const mutation = useMutation<void, Error, LinkChangeArgs>({
    mutationFn: ({ child, plan }) => applyLinkChange(plan, child, orgId),
    onError: (error) => notifications.show({ color: 'red', message: error.message }),
    onSettled: () => invalidateLinkQueries(queryClient, orgId),
  });

  return {
    changeLink: (args: LinkChangeArgs) => mutation.mutateAsync(args),
    isPending: mutation.isPending,
  };
}

async function applyLinkChange(
  plan: LinkChangePlan,
  child: MailRelationSide,
  orgId: string,
): Promise<void> {
  const dropped: MailEdge[] = [];

  try {
    for (const edge of plan.drop) {
      await deleteMailRelation(edge.relationId, orgId);
      dropped.push(edge);
    }
  } catch {
    throw new Error('Не удалось снять прежнюю связь — новый родитель не назначен');
  }

  if (!plan.create) return;

  try {
    await createCrossMailRelation({ id: plan.create.id, type: plan.create.type }, child, orgId);
  } catch {
    await Promise.all(
      dropped.map((edge) =>
        createCrossMailRelation(edge.parent, child, orgId).catch(() => undefined),
      ),
    );
    throw new Error('Не удалось сохранить связь, предыдущая восстановлена');
  }
}
