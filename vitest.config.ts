import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    // `e2e/**` — это Playwright: спеки запускаются через `pnpm test:e2e` / `pnpm test:e2e:ui`,
    // они никогда не должны попадать в сборку Vitest (иначе коллизия двух копий @playwright/test).
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**', '**/test-results/**', '**/playwright-report/**'],
  },
});
