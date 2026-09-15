import { describe, it, expect, vi, afterEach } from 'vitest';
import { useState, type ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { ErrorBoundary } from './ErrorBoundary';

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('boom');
  return <div data-testid="ok">ok</div>;
}

function renderBoundary(ui: ReactNode) {
  return render(<MantineProvider defaultColorScheme="light">{ui}</MantineProvider>);
}

describe('ErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when no error occurs', () => {
    renderBoundary(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId('ok')).toBeInTheDocument();
  });

  it('shows fallback when a child throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    renderBoundary(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Произошла ошибка')).toBeInTheDocument();
    expect(screen.getByText('Попробовать снова')).toBeInTheDocument();
    expect(screen.getByText('Перезагрузить страницу')).toBeInTheDocument();
  });

  it('resets and re-renders children via button', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    function Resettable() {
      const [broken, setBroken] = useState(true);
      return (
        <>
          <ErrorBoundary>
            <Bomb shouldThrow={broken} />
          </ErrorBoundary>
          <button onClick={() => setBroken(false)}>fix</button>
        </>
      );
    }

    renderBoundary(<Resettable />);
    expect(screen.getByText('Произошла ошибка')).toBeInTheDocument();

    fireEvent.click(screen.getByText('fix'));
    fireEvent.click(screen.getByText('Попробовать снова'));

    expect(screen.getByTestId('ok')).toBeInTheDocument();
  });

  it('auto resets when resetKeys change', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    function KeyedBoundary() {
      const [key, setKey] = useState(0);
      return (
        <>
          <ErrorBoundary resetKeys={[key]}>
            <Bomb shouldThrow={key === 0} />
          </ErrorBoundary>
          <button onClick={() => setKey(1)}>advance</button>
        </>
      );
    }

    renderBoundary(<KeyedBoundary />);
    expect(screen.getByText('Произошла ошибка')).toBeInTheDocument();

    fireEvent.click(screen.getByText('advance'));

    await waitFor(() => {
      expect(screen.getByTestId('ok')).toBeInTheDocument();
    });
  });

  it('calls onError with the caught error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onError = vi.fn();

    renderBoundary(
      <ErrorBoundary onError={onError}>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Произошла ошибка')).toBeInTheDocument();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  it('renders custom fallback when fallbackRender is provided', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    renderBoundary(
      <ErrorBoundary fallbackRender={({ error }) => <div data-testid="custom-fallback">{error.message}</div>}>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId('custom-fallback')).toHaveTextContent('boom');
  });
});