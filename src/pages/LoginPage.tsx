import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Container, Paper, TextInput, PasswordInput, Button, Title, Text, Alert } from '@mantine/core';
import { ClientResponseError } from 'pocketbase';
import { useAuth } from '@/shared/context/AuthContext';

function getLoginErrorMessage(err: unknown): string {
  if (err instanceof ClientResponseError) {
    if (err.status === 400 || err.status === 401) return 'Неверный логин или пароль';
    if (err.status === 0) return 'Не удалось связаться с сервером. Проверьте подключение';
    if (err.status >= 500) return 'Сервер временно недоступен. Попробуйте позже';
  }
  if (err instanceof Error) {
    const message = err.message.toLowerCase();
    if (message.includes('authenticate') || message.includes('credentials')) {
      return 'Неверный логин или пароль';
    }
    if (
      message.includes('failed to fetch') ||
      message.includes('networkerror') ||
      message.includes('load failed')
    ) {
      return 'Не удалось связаться с сервером. Проверьте подключение';
    }
  }
  if (err instanceof Error) return `Ошибка входа: ${err.message}`;
  return 'Ошибка входа. Попробуйте ещё раз';
}

export function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const sessionExpired = location.state?.reason === 'expired';
  const from = (location.state?.from as { pathname: string })?.pathname || '/';

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(loginValue, password);
    } catch (err) {
      setError(getLoginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size={420} py={100}>
      <Title ta="center" mb="lg">
        Реестры счетов
      </Title>
      {sessionExpired && (
        <Alert color="red" mb="sm">
          Сессия истекла. Войдите заново, чтобы продолжить работу.
        </Alert>
      )}
      <Paper withBorder p="lg" radius="md">
        <form onSubmit={handleSubmit}>
          <TextInput
            label="Логин"
            placeholder="Ваш логин"
            value={loginValue}
            onChange={(e) => setLoginValue(e.currentTarget.value)}
            required
            mb="sm"
          />
          <PasswordInput
            label="Пароль"
            placeholder="Ваш пароль"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            required
            mb="md"
          />
          {error && (
            <Text c="red" size="sm" mb="sm" role="alert">
              {error}
            </Text>
          )}
          <Button type="submit" fullWidth loading={loading}>
            Войти
          </Button>
        </form>
      </Paper>
    </Container>
  );
}
