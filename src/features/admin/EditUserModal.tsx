import { useEffect, useState } from 'react';
import { Modal, TextInput, PasswordInput, Button, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useUpdateUser } from '@/shared/hooks/useUsers';
import { useAuth } from '@/shared/context/AuthContext';
import { generatePassword } from '@/shared/utils/generate-password';
import type { IUser } from '@/shared/types';

interface EditUserModalProps {
  opened: boolean;
  user: IUser | null;
  onClose: () => void;
}

export function EditUserModal({ opened, user, onClose }: EditUserModalProps) {
  const [name, setName] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const updateUser = useUpdateUser();
  const { user: currentUser } = useAuth();

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (opened && user) {
      setName(user.name ?? '');
      setLogin(user.login);
      setPassword('');
      setPasswordConfirm('');
      setError('');
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [opened, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Укажите имя');
      return;
    }
    if (login.trim().length < 2) {
      setError('Логин должен быть не менее 2 символов');
      return;
    }
    if (password && password.length < 8) {
      setError('Пароль должен быть не менее 8 символов');
      return;
    }
    if (password && password !== passwordConfirm) {
      setError('Пароли не совпадают');
      return;
    }
    if (!user) return;

    const loginChanged = login.trim() !== user.login;
    const isSelf = currentUser?.id === user.id;

    try {
      await updateUser.mutateAsync({
        id: user.id,
        name: name.trim(),
        login: login.trim(),
        password: password || undefined,
      });
      if (loginChanged && !isSelf) {
        notifications.show({
          color: 'yellow',
          title: 'Логин изменён',
          message: 'Пользователю потребуется войти с новым логином.',
          autoClose: 8000,
        });
      }
      onClose();
    } catch {
      /* тост об ошибке показывает onError в useUpdateUser */
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Редактировать пользователя ${user?.name || ''}`}
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label="Имя"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            autoFocus
          />
          <TextInput
            label="Логин"
            value={login}
            onChange={(e) => setLogin(e.currentTarget.value)}
          />
          <PasswordInput
            label="Новый пароль"
            placeholder={password ? undefined : 'Оставьте пустым, чтобы не менять'}
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
          />
          {password && (
            <PasswordInput
              label="Повтор пароля"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.currentTarget.value)}
            />
          )}
          <Button
            size="compact-xs"
            variant="subtle"
            onClick={() => setPassword(generatePassword())}
            px={0}
          >
            Сгенерировать
          </Button>

          {error && (
            <Text c="red" size="sm">
              {error}
            </Text>
          )}

          <Button type="submit" loading={updateUser.isPending} fullWidth>
            Сохранить
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
