import { Component, useState, type ErrorInfo, type ReactNode } from 'react';
import { Button, Code, Collapse, Group, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconAlertCircle, IconChevronDown, IconRotate } from '@tabler/icons-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackRender?: (props: { error: Error; reset: () => void }) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
  resetKeys?: unknown[];
}

interface ErrorBoundaryState {
  error: Error | null;
}

function isEqualKeys(a: unknown[], b: unknown[]): boolean {
  return a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
}

function TechnicalDetails({ stack }: { stack?: string }) {
  const [opened, setOpened] = useState(false);
  return (
    <Stack align="center" gap={4} w="100%">
      <Button
        variant="subtle"
        color="gray"
        size="compact-sm"
        onClick={() => setOpened((o) => !o)}
        rightSection={
          <IconChevronDown
            size={14}
            style={{ transform: opened ? 'rotate(180deg)' : undefined, transition: 'transform 150ms ease' }}
          />
        }
      >
        Технические детали
      </Button>
      <Collapse in={opened} w="100%">
        <Code block style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {stack ?? 'Детали недоступны'}
        </Code>
      </Collapse>
    </Stack>
  );
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
    this.props.onError?.(error, info);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (!this.state.error) return;
    if (!isEqualKeys(prevProps.resetKeys ?? [], this.props.resetKeys ?? [])) {
      this.reset();
    }
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallbackRender) {
      return this.props.fallbackRender({ error, reset: this.reset });
    }

    return (
      <Stack align="center" justify="center" h="100vh" p="xl">
        <Paper withBorder radius="md" p="xl" maw={560} w="100%" bg="var(--mantine-color-body)">
          <Stack align="center" gap="md">
            <ThemeIcon color="red" variant="light" radius="xl" size={56}>
              <IconAlertCircle size={32} />
            </ThemeIcon>
            <Stack align="center" gap={6}>
              <Title order={2} ta="center">
                Произошла ошибка
              </Title>
              <Text c="dimmed" size="sm" ta="center">
                Приложение не смогло продолжить работу. Попробуйте ещё раз или перезагрузите страницу.
              </Text>
            </Stack>
            <TechnicalDetails stack={error.stack} />
            <Group mt="sm">
              <Button color="red" leftSection={<IconRotate size={16} />} onClick={this.reset}>
                Попробовать снова
              </Button>
              <Button variant="default" onClick={() => window.location.reload()}>
                Перезагрузить страницу
              </Button>
            </Group>
          </Stack>
        </Paper>
      </Stack>
    );
  }
}