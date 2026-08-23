import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Paper, TextInput, PasswordInput, Button, Title, Text } from '@mantine/core';
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
  return 'Ошибка входа. Попробуйте ещё раз';
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(loginValue, password);
      navigate('/', { replace: true });
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
