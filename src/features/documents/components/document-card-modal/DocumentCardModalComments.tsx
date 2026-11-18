import {
  ActionIcon,
  Button,
  Center,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
} from '@mantine/core';
import { IconMessageCircle, IconTrash, IconUser } from '@tabler/icons-react';
import dayjs from 'dayjs';
import type { IDocumentComment } from '@/shared/types';

/** Пропсы вкладки «Комментарии». */
export interface DocumentCardModalCommentsProps {
  comments: IDocumentComment[];
  loading: boolean;
  canComment: boolean;
  canDeleteComment: boolean;
  commentText: string;
  adding: boolean;
  onCommentTextChange: (value: string) => void;
  onAdd: () => void;
  onRequestDelete: (comment: IDocumentComment) => void;
}

/**
 * Вкладка «Комментарии»: форма добавления, список комментариев
 * с автором и датой, удаление для админа.
 */
export function DocumentCardModalComments({
  comments,
  loading,
  canComment,
  canDeleteComment,
  commentText,
  adding,
  onCommentTextChange,
  onAdd,
  onRequestDelete,
}: DocumentCardModalCommentsProps) {
  return (
    <Stack gap="md">
      {/* Форма добавления комментария */}
      {canComment && (
        <Paper withBorder p="md" radius="md">
          <Stack gap="xs">
            <Textarea
              label="Новый комментарий"
              value={commentText}
              onChange={(event) => onCommentTextChange(event.currentTarget.value)}
              autosize
              minRows={2}
              maxRows={5}
            />
            <Button onClick={onAdd} loading={adding} disabled={!commentText.trim()}>
              Добавить комментарий
            </Button>
          </Stack>
        </Paper>
      )}

      {/* Список комментариев или пустое состояние */}
      {loading ? (
        <Loader size="sm" />
      ) : comments.length === 0 ? (
        <Center py="xl">
          <Stack align="center" gap="xs">
            <ThemeIcon size="xl" variant="light" color="gray" radius="xl">
              <IconMessageCircle size={24} />
            </ThemeIcon>
            <Text c="dimmed" size="sm">
              Комментариев нет
            </Text>
          </Stack>
        </Center>
      ) : (
        comments.map((comment) => (
          <Paper key={comment.id} withBorder p="sm" radius="md">
            <Group justify="space-between" mb="xs" align="flex-start" wrap="nowrap">
              <Group gap="sm" wrap="nowrap">
                <ThemeIcon variant="light" radius="xl" size="md" color="blue">
                  <IconUser size={14} />
                </ThemeIcon>
                <Stack gap={0}>
                  <Text size="sm" fw={500}>
                    {comment.author_name || 'Пользователь'}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {comment.created ? dayjs(comment.created).format('DD.MM.YYYY HH:mm') : ''}
                  </Text>
                </Stack>
              </Group>
              {canDeleteComment && (
                <ActionIcon
                  color="red"
                  variant="subtle"
                  aria-label="Удалить комментарий"
                  onClick={() => onRequestDelete(comment)}
                >
                  <IconTrash size={14} />
                </ActionIcon>
              )}
            </Group>
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
              {comment.text}
            </Text>
          </Paper>
        ))
      )}
    </Stack>
  );
}
