# Реестры счетов

SPA для ведения реестров счетов организации. Управление счетами, частичная оплата, отметки к оплате, история изменений, печать, расчётные счета с остатками, ролевая модель, уведомления.

---

## Стек

| Слой              | Технологии                                                 |
| ----------------- | ---------------------------------------------------------- |
| **Фреймворк**     | React 19, TypeScript 6, Vite 8                             |
| **UI**            | Mantine UI v7, Mantine React Table v2, @tabler/icons-react |
| **Данные**        | TanStack React Query v5, PocketBase (бэкенд + БД)          |
| **Маршрутизация** | React Router v7                                            |
| **Даты**          | Day.js (локаль `ru`)                                       |
| **Drag & drop**   | @dnd-kit/core, @dnd-kit/sortable                           |
| **Тесты**         | Vitest + jsdom + @testing-library/react                    |

---

## Быстрый старт

```bash
pnpm install
pnpm pb        # запустить PocketBase на http://127.0.0.1:8090
pnpm dev       # запустить Vite на http://localhost:5173
```

---

## Архитектура

```
src/
├── api/              # клиент PocketBase + функции запросов
├── features/
│   ├── accounts/     # расчётные счета, остатки
│   ├── admin/        # управление организациями, пользователями, ролями
│   ├── invoices/     # счета, таблицы, модалки, печать
│   │   ├── components/  # переиспользуемые UI-компоненты
│   │   └── utils/       # утилиты (expand-invoice-rows, build-invoice-delta)
│   └── notifications/   # уведомления
├── layouts/          # AppLayout
├── pages/            # LoginPage, MainPage, AdminPage
└── shared/
    ├── components/   # ConfirmModal, ErrorBoundary, RequireAuth
    ├── context/      # AuthContext, OrgContext, SearchContext
    ├── hooks/        # 20 хуков для запросов к PocketBase
    ├── types/        # TypeScript-интерфейсы
    └── utils/        # format-currency, group-invoices, normalize-invoice

pb_hooks/             # серверные хуки PocketBase (JavaScript)
├── notify.pb.js      # автонумерация seq + уведомления
├── snapshot.pb.js    # cron (ежедневно в полночь) — снятие остатков
├── cleanup.pb.js     # cron — удаление уведомлений старше 30 дней
└── encryption.pb.js  # запланировано (полевое шифрование)

pb_migrations/        # JS-миграции схемы PocketBase (48 файлов)
```

---

## Модели данных

**Коллекции PocketBase:**

| Коллекция            | Назначение                                         |
| -------------------- | -------------------------------------------------- |
| `organizations`      | Организации                                        |
| `bank_accounts`      | Расчётные счета организаций                        |
| `accounting_objects` | Объекты учёта (группировка счетов)                 |
| `invoices`           | Счета                                              |
| `invoice_history`    | Аудит изменений счетов                             |
| `payment_marks`      | Мягкие отметки к оплате (boss → moderator)         |
| `organization_users` | Роли пользователей в организациях                  |
| `users`              | Пользователи (кастомная аутентификация PocketBase) |
| `user_settings`      | Настройки колонок таблицы                          |
| `invoice_files`      | Файлы, прикреплённые к счетам                      |
| `notifications`      | Уведомления о событиях                             |
| `balance_history`    | Дневные остатки по расчётным счетам                |

---

## Ролевая модель

Пять ролей в коллекции `organization_users`:

| Роль          | Создание | Редакт.                      | Удаление | Перенос | История | Оплата (paid) | Отметки к оплате | Файлы |
| ------------- | -------- | ---------------------------- | -------- | ------- | ------- | ------------- | ---------------- | ----- |
| **admin**     | ✓        | ✓                            | ✓        | ✓       | ✓       | ✓             | просмотр         | ✓     |
| **moderator** | ✓        | ✓                            | ✓        | ✓       | ✓       | ✓             | просмотр         | ✓     |
| **user**      | ✓        | ✓ (кроме `paid`/`paid_date`) | ✗        | ✗       | ✗       | ✗             | ✗                | ✓     |
| **boss**      | ✗        | ✗                            | ✗        | ✗       | ✗       | ✗             | **создание**     | ✗     |
| **guest**     | ✗        | ✗                            | ✗        | ✗       | ✗       | ✗             | ✗                | ✗     |

- **boss** не видит колонки `paid`/`paid_date`, но может ставить мягкие отметки к оплате.
- Если счёт уже оплачен модератором, босс видит «Уже оплачено» вместо кнопок отметки.
- **moderator** может фактически проводить оплату (устанавливать `paid = true`).

---

## Функциональность

- **Дата** — выбор дня через DatePickerInput; все счета и остатки привязаны к дате
- **Счета** — группировка по объектам учёта, внутри — по контрагентам
- **Inline-форма** — быстрая inline-форма создания счёта с автодополнением контрагентов
- **Drag & drop** — перетаскивание строк контрагентов для изменения порядка
- **Частичная оплата** — модальное окно с суммой и комментарием
- **Мягкие отметки** — boss помечает счета к оплате, moderator/admin видят и обрабатывают
- **Поиск** — полнотекстовый поиск по всем счетам организации (с автоподсветкой)
- **Скрыть оплаченные** — чекбокс, скрывающий оплаченные счета (доступен admin, moderator, boss)
- **Печать** — CSS Print Preview с группировкой по объектам учёта
- **Файлы** — прикрепление и просмотр файлов к счетам
- **История** — просмотр изменений счёта с предыдущими значениями
- **Перенос** — перемещение счёта между объектами учёта
- **Настройка колонок** — модальное окно выбора видимых колонок таблицы
- **Адаптив** — на узких экранах таблица заменяется карточками
- **Уведомления** — в реальном времени при создании/изменении/оплате счетов
- **Личный кабинет** — смена пароля, настройки
- **Панель администратора** — управление организациями (создание, редактирование, удаление), управление пользователями и ролями

---

## Разработка

### Команды

| Команда              | Описание                      |
| -------------------- | ----------------------------- |
| `pnpm dev`           | Запуск Vite dev-сервера       |
| `pnpm build`         | `tsc -b && vite build`        |
| `pnpm lint`          | Проверка ESLint               |
| `pnpm typecheck`     | `tsc --noEmit`                |
| `pnpm test`          | `vitest run`                  |
| `pnpm test:watch`    | `vitest` (watch)              |
| `pnpm test:coverage` | `vitest run --coverage`       |
| `pnpm format:write`  | `prettier --write .`          |
| `pnpm pb`            | Запуск PocketBase (порт 8090) |

### Соглашения

- **TypeScript strict mode** — `strict: true`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `erasableSyntaxOnly`
- **Путевой алиас** — `@/` → `src/`
- **Импорты** — `import type` для type-only импортов
- **ESLint** — ts recommended + react-hooks + react-refresh
- **Prettier** — semi, singleQuote, trailingCommas all, printWidth 100, tabWidth 2
- **UI-тексты** — на русском
- **Порядок перед коммитом:** `pnpm lint && pnpm typecheck`

### Тестирование

- Файлы тестов рядом с кодом: `*.test.ts`, `*.test.tsx`
- Setup-файл `src/test-setup.ts` импортирует `@testing-library/jest-dom` и мокает `window.matchMedia`
- Запуск: `pnpm test` или `pnpm test:watch`
