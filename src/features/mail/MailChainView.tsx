import { useMemo, type ReactNode } from 'react';
import { Alert, Badge, Box, Group, Paper, Stack, Text, ThemeIcon } from '@mantine/core';
import {
  IconAlertTriangle,
  IconArrowDownRight,
  IconArrowUpRight,
  IconMail,
} from '@tabler/icons-react';
import { buildMailThread, THREAD_MAX_DEPTH } from './mail-thread';
import type {
  MailEdgeEnd,
  MailLetter,
  MailLetterIndex,
  MailNodeKey,
  MailThreadGraph,
  MailThreadNode,
} from './mail-thread';
import { MAIL_TREE_INDENT } from './mail-thread-builder';
import { MAIL_CHAIN_CYCLE_NOTE, MAIL_CHAIN_TRUNCATION_NOTE } from './mail-thread-labels';
import { formatMailDate } from './mail-date';
import {
  MAIL_COUNTERPARTY_FIELD_LABELS,
  MAIL_EMPTY_CELL,
  MAIL_NUMBER_FIELD_LABELS,
  MAIL_REGISTER_BADGE_LABELS,
  MAIL_REGISTER_COLORS,
} from './mail-labels';

/**
 * Вся цепочка письма: корень, ветка вверх, ветка вниз и объяснения, почему
 * ветка показана не вся. Один компонент на оба места — предпросмотр внутри формы
 * письма и (раньше) дерево переписки, — потому что «вся цепочка» это одно и то же
 * обещание, и разные реализации разошлись бы и в маркерах направления, и в
 * срабатывании предела глубины.
 *
 * Примитивы письма живут здесь же, а не в отдельном файле: после замены дерева
 * на конструктор (`MailThreadBuilder`) второй потребитель у них один, и файл ради
 * двух строк с отступом — только лишняя точка правки.
 *
 * Границы не задаёт ни один из вызывающих: предел глубины общий с `mail-thread`
 * и назван здесь же, в тексте заметки, чтобы обе поверхности показывали одну и
 * ту же цифру.
 */

/** Направление шага от корня. Исчерпывающий список — подписи и маркеры на нём. */
type ChainDirection = 'root' | 'ancestor' | 'descendant';

const DIRECTION_ICONS: Record<ChainDirection, ReactNode> = {
  root: <IconMail size={14} />,
  ancestor: <IconArrowUpRight size={14} />,
  descendant: <IconArrowDownRight size={14} />,
};

/** «Ответ на» вверх, «ответ» вниз: слова направления, а не стрелки. */
const DIRECTION_LABELS: Record<ChainDirection, string> = {
  root: 'текущее письмо',
  ancestor: 'ответ на',
  descendant: 'ответ',
};

const MISSING_LETTER_LABEL = 'Письмо недоступно — связь ссылается на удалённое письмо';

const ROOT_BACKGROUND = 'var(--mantine-color-blue-0)';
const ROOT_BOX_SHADOW = 'var(--mantine-shadow-sm)';
const BRANCH_LINE = '1px solid var(--mantine-color-gray-3)';
/** Цикл помечается по краю рамки — самый широкий носитель предупреждения. */
const CYCLIC_BORDER = '1px solid var(--mantine-color-yellow-5)';

interface ChainRowProps {
  node: MailThreadNode;
  letter: MailLetter | undefined;
  direction: ChainDirection;
  /** Письмо замыкает цепочку на само себя или через кого-то; помечается рамкой. */
  cyclic?: boolean;
}

/**
 * Письмо в цепочке. Черта слева и отступ `MAIL_TREE_INDENT * depth` — единственный
 * носитель структуры: без них список из плоских строк читался бы как лестница
 * без веток. Письмо, чьи подписи не пришли (связь пережила удаление письма),
 * остаётся на месте как заглушка — убрать его значило бы выкинуть ветку молча.
 */
function ChainRow({ node, letter, direction, cyclic = false }: ChainRowProps) {
  const isRoot = direction === 'root';
  const depth = isRoot ? 0 : node.depth;

  return (
    <Box
      ml={depth > 0 ? (depth - 1) * MAIL_TREE_INDENT : 0}
      pl={depth > 0 ? MAIL_TREE_INDENT : 0}
      style={depth > 0 ? { borderLeft: BRANCH_LINE } : undefined}
    >
      <Paper
        withBorder
        p={8}
        radius="sm"
        style={
          isRoot
            ? { background: ROOT_BACKGROUND, boxShadow: ROOT_BOX_SHADOW }
            : cyclic
              ? { border: CYCLIC_BORDER }
              : undefined
        }
      >
        <Group gap={8} wrap="nowrap" align="flex-start">
          <ThemeIcon size={20} radius="xl" variant="light" color={isRoot ? 'blue' : 'gray'}>
            {DIRECTION_ICONS[direction]}
          </ThemeIcon>
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Group gap={6} wrap="wrap">
              <Text size="xs" c="dimmed">
                {DIRECTION_LABELS[direction]}
              </Text>
              <Badge size="xs" variant="light" color={MAIL_REGISTER_COLORS[node.type]}>
                {MAIL_REGISTER_BADGE_LABELS[node.type]}
              </Badge>
              {letter ? (
                <>
                  <Text size="xs" c="dimmed" inline>
                    {`${MAIL_NUMBER_FIELD_LABELS[node.type]}: `}
                  </Text>
                  <Text size="sm" fw={600} inline>
                    {letter.number || MAIL_EMPTY_CELL}
                  </Text>
                  <Text size="xs" c="dimmed" inline>
                    {` · ${MAIL_COUNTERPARTY_FIELD_LABELS[node.type]}: ${letter.counterparty || MAIL_EMPTY_CELL} · ${formatMailDate(letter.date)}`}
                  </Text>
                </>
              ) : (
                <Text size="xs" c="dimmed">
                  {MISSING_LETTER_LABEL}
                </Text>
              )}
            </Group>
            <Text size="sm" lineClamp={2} mt={2}>
              {letter?.subject || MAIL_EMPTY_CELL}
            </Text>
          </Box>
        </Group>
      </Paper>
    </Box>
  );
}

interface ChainBranchProps {
  title: string;
  direction: Exclude<ChainDirection, 'root'>;
  nodes: readonly MailThreadNode[];
  letters: MailLetterIndex | undefined;
  cyclicKeys: ReadonlySet<MailNodeKey> | undefined;
}

/** Одна сторона переписки. Узлы уже в порядке обхода — `depth` даёт отступ. */
function ChainBranch({ title, direction, nodes, letters, cyclicKeys }: ChainBranchProps) {
  return (
    <Box>
      <Text size="xs" c="dimmed" mb={6}>
        {title}
      </Text>
      <Box
        style={
          cyclicKeys && nodes.some((node) => cyclicKeys.has(node.key))
            ? {
                borderLeft: '2px solid var(--mantine-color-yellow-5)',
                paddingLeft: 8,
                borderRadius: 'var(--mantine-radius-default)',
              }
            : undefined
        }
      >
        <Stack gap={4}>
          {nodes.map((node) => (
            <ChainRow
              key={node.key}
              node={node}
              letter={letters?.get(node.key)}
              direction={direction}
              cyclic={cyclicKeys?.has(node.key) ?? false}
            />
          ))}
        </Stack>
      </Box>
    </Box>
  );
}

interface MailChainViewProps {
  graph: MailThreadGraph;
  letters: MailLetterIndex | undefined;
  root: MailEdgeEnd;
  cyclicKeys: ReadonlySet<MailNodeKey> | undefined;
}

export function MailChainView({ graph, letters, root, cyclicKeys }: MailChainViewProps) {
  const thread = useMemo(() => buildMailThread(graph, root, THREAD_MAX_DEPTH), [graph, root]);

  const hasCyclicBranch = [...thread.ancestors, ...thread.descendants].some((node) =>
    cyclicKeys?.has(node.key),
  );

  return (
    <Stack gap="sm">
      <ChainRow node={thread.root} letter={letters?.get(thread.root.key)} direction="root" />

      {thread.ancestors.length > 0 && (
        <ChainBranch
          title="Вверх по переписке — на что это письмо отвечает"
          direction="ancestor"
          nodes={thread.ancestors}
          letters={letters}
          cyclicKeys={cyclicKeys}
        />
      )}

      {thread.descendants.length > 0 && (
        <ChainBranch
          title="Вниз по переписке — ответы на это письмо"
          direction="descendant"
          nodes={thread.descendants}
          letters={letters}
          cyclicKeys={cyclicKeys}
        />
      )}

      {hasCyclicBranch && (
        <Alert
          color="yellow"
          variant="light"
          icon={<IconAlertTriangle size={16} />}
          title="Цепочка замыкается в кольцо"
        >
          <Text size="xs">{MAIL_CHAIN_CYCLE_NOTE}</Text>
        </Alert>
      )}

      {thread.skipped > 0 && (
        <Text size="xs" c="dimmed">
          {MAIL_CHAIN_TRUNCATION_NOTE(THREAD_MAX_DEPTH)}
        </Text>
      )}
    </Stack>
  );
}
