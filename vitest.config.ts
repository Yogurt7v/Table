import { defineConfig, coverageConfigDefaults } from 'vitest/config';
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
    coverage: {
      // Считаем покрытие только продуктового кода src/, чтобы pb_migrations/builds/e2e utils
      // не раздували отчёт. main.tsx — только сборка провайдеров и createRoot.render, логики нет.
      include: ['src/**/*.{ts,tsx}'],
      exclude: [...coverageConfigDefaults.exclude, 'src/main.tsx', 'src/test-setup.ts', 'src/vite-env.d.ts'],
    },
    // `e2e/**` — это Playwright: спеки запускаются через `pnpm test:e2e` / `pnpm test:e2e:ui`,
    // они никогда не должны попадать в сборку Vitest (иначе коллизия двух копий @playwright/test).
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'e2e/**',
      '**/test-results/**',
      '**/playwright-report/**',
      '**/*.integration.test.ts',
    ],
  },
});
