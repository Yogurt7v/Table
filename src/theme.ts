import { createTheme } from '@mantine/core';

/**
 * Базовая тема приложения. Дизайн-токены описаны в
 * design-system/reestry-schetov/MASTER.md.
 *
 * primaryColor по умолчанию — 'blue'; для залогиненного пользователя он
 * динамически переопределяется цветом организации (см. OrgPrimaryProvider),
 * поэтому семантические цвета (green/red/orange/yellow) стоит задавать
 * явно, а не через primary.
 */
export const theme = createTheme({
  primaryColor: 'blue',
  defaultRadius: 'md',
  fontFamily:
    'Inter Variable, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  fontFamilyMonospace:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  headings: {
    fontWeight: '700',
  },
});