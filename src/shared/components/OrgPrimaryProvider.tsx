import type { ReactNode } from 'react';
import { MantineProvider, mergeMantineTheme, useMantineTheme } from '@mantine/core';
import { useOrg } from '@/shared/context/OrgContext';
import { orgToMantineColor } from '@/shared/utils/org-colors';

/**
 * Поднимает цвет организации до primaryColor Mantine: кнопки, выделения
 * и фокус-колца следуют за брендом организации. Семантические цвета
 * (оплачено/ошибка/ожидание) в компонентах заданы явно и не меняются.
 */
export function OrgPrimaryProvider({ children }: { children: ReactNode }) {
  const { currentOrg } = useOrg();
  const baseTheme = useMantineTheme();
  const primaryColor = orgToMantineColor(currentOrg?.color);

  return (
    <MantineProvider theme={mergeMantineTheme(baseTheme, { primaryColor })}>
      {children}
    </MantineProvider>
  );
}