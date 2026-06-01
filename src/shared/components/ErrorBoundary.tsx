import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Alert, Text, Code, Stack, Button, Group } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <Stack p="xl" align="center" justify="center" h="100vh">
          <Alert color="red" icon={<IconAlertCircle />} title="Произошла ошибка" maw={600}>
            <Text>{this.state.error.message}</Text>
            {this.state.error.stack && (
              <Code block mt="sm" style={{ whiteSpace: 'pre-wrap' }}>
                {this.state.error.stack}
              </Code>
            )}
            <Group mt="md">
              <Button onClick={() => window.location.reload()} color="red">
                Перезагрузить страницу
              </Button>
            </Group>
          </Alert>
        </Stack>
      );
    }

    return this.props.children;
  }
}
