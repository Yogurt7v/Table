import { useState } from 'react';
import { Button, Group, Modal, PasswordInput, TextInput, Text } from '@mantine/core';
import { useAuth } from '@/shared/context/AuthContext';

interface SessionExpiredModalProps {
  opened: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
}

export function SessionExpiredModal({ opened, onClose, onAuthenticated }: SessionExpiredModalProps) {
  const { reauthenticate } = useAuth();
  const [loginValue, setLoginValue] = useState('');
  const [passwordValue, setPasswordValue] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await reauthenticate(loginValue, passwordValue);
      setLoginValue('');
      setPasswordValue('');
      onAuthenticated();
    } catch {
      setError('Неверный логин или пароль');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Сессия истекла" size="md">
      <Text>Ваша сессия истекла. Войдите заново, чтобы продолжить работу.</Text>
      <form onSubmit={handleSubmit}>
        <TextInput label="Логин" value={loginValue} onChange={(e) => setLoginValue(e.currentTarget.value)} required />
        <PasswordInput label="Пароль" value={passwordValue} onChange={(e) => setPasswordValue(e.currentTarget.value)} required />
        {error && <Text color="red">{error}</Text>}
        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose} disabled={loading}>
            Выйти
          </Button>
          <Button type="submit" color="blue" loading={loading} disabled={loading}>
            Войти и продолжить
          </Button>
        </Group>
      </form>
    </Modal>
  );
}
