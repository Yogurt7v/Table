import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Paper, TextInput, PasswordInput, Button, Title, Text } from '@mantine/core';
import { useAuth } from '@/shared/context/AuthContext';

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
      setError(err instanceof Error ? err.message : 'Ошибка входа');
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
            <Text c="red" size="sm" mb="sm">
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
