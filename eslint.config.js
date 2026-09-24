import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'pb_data', 'pb_data_test']),
  {
    files: ['pb_migrations/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: {
        app: 'readonly',
        Field: 'readonly',
        migrate: 'readonly',
        Collection: 'readonly',
        unmarshal: 'readonly',
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // Playwright-фикстуры и e2e-спеки: паттерн `use` не является React-хуком,
    // неиспользуемые параметры хелперов помечаются префиксом `_`.
    files: ['e2e/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'no-empty-pattern': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
])
