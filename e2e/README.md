# E2E-тесты (Playwright)

## Запуск

```bash
pnpm test:e2e           # все спеки
pnpm test:e2e:ui        # Playwright UI
pnpm test:e2e:headed    # с браузером
```

Playwright стартует PocketBase (8090) и Vite (5173) через `webServer` в
`playwright.config.ts`; dev-база — та же, что для ручной разработки.

## Роли и вход

Пароли всех тестовых ролей заданы единой командой PocketBase (см. AGENTS.md):
`admin`, `moderator`, `user`, `boss`, `guest` — пароль `12345678`.
Вход выполняется через UI (`loginViaUi`) либо через API (`authAs`) для
прямых проверок БД.

## Структура

- `e2e/data.ts` — тестовые пользователи/организации/маркеры.
- `e2e/fixtures.ts` — фикстуры Playwright (клиент PB, org/object id, маркер).
- `e2e/utils/pb.ts` — API-хелперы PocketBase (прямые проверки БД).
- `e2e/utils/ui.ts` — UI-хелперы (вход/выход).
- `e2e/specs/*.spec.ts` — сценарии (auth, счета, оплата, права, поиск,
  объекты, админка, архив, уведомления, файлы).

Создаваемые данные помечаются уникальным маркером (`uniqueMarker`), по которому
их можно найти в БД (например, `findInvoiceByMarker`). Автоматической очистки
нет — тестовые данные накапливаются в dev-базе; при необходимости удаляются
вручную или через `deleteInvoiceSoft`.
