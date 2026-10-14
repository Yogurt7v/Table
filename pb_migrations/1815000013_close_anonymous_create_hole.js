/// <reference path="../pb_data/types.d.ts" />

// Закрывает дыру в авторизации на создание: `createRule = ""` у бизнес-коллекций
// означал «создавать может кто угодно», включая запросы вообще без токена. Такой
// анонимный POST проходил с HTTP 200 и сохранял запись с пустым автором.
//
// Именно это и было причиной «-» в колонке «Инициатор»: анонимно созданный счёт
// навсегда оставался без `created_by`, и резолвер имени актора нечего было
// резолвить. Дыра была тем хуже, что поле `created_by` необязательное — то есть
// пустой автор был не исключительным случаем, а штатным значением схемы.
//
// Миграция делает две вещи на каждой затронутой коллекции:
//   1. `created_by` становится `required` — пустой автор больше не валиден;
//   2. `createRule` становится `@request.auth.id != ''` (идиома уже используется
//      в `user_settings`, см. 1812000000) — анонимный создатель отсекается на
//      уровне правила, а не на уровне валидации.
//
// Кто пишет `created_by` (важно: значение приходит ДО валидации, поэтому
// `required` не ломает штатное создание):
//
//   * `invoices` — серверный хук `onRecordCreateRequest(..., 'invoices')` в
//     `pb_hooks/notify.pb.js` проставляет `created_by = e.auth.id`. Это единственный
//     источник значения, поэтому у `invoices` появляется зависимость от
//     загрузки хуков: сервер, стартовавший с `--hooksDir` без этого файла,
//     перестанет создавать счета вовсе (400 `validation_required`).
//   * `incoming_mails`, `outgoing_mails`, `mail_files`, `mail_relations` —
//     клиент шлёт `created_by: currentActorId()` из `src/api/mail.ts`
//     (у которого есть фолбэк на последнего известного пользователя),
//     а `onRecordCreateRequest` в `pb_hooks/mail-notify.pb.js` дублирует это на
//     сервере. Значение берётся из токена, а не из существующей записи, поэтому
//     эти коллекции от хуков не зависят вовсе — и на случай, если клиент пришлёт
//     пустую строку, хук её перезапишет.
//
// Что НЕ затронуто и почему:
//
//   * `deleted_incoming_mails`, `deleted_outgoing_mails` — архивные копии.
//     Клиент (`mail.ts`) пишет туда `created_by: mail.created_by ?? ''`, а хук
//     `mail-archive.pb.js` копирует `mail.get('created_by')` из исходного письма.
//     Для писем, созданных анонимно ДО этой миграции, там лежит `''`, и
//     `required` превратил бы удаление письма в 400. Тот же пустой автор вернулся
//     бы в реестр при `restoreDeletedIncomingMail`, который переносит
//     `deleted.created_by ?? ''` обратно в `incoming_mails`.
//   * `mail_history`, `deleted_mail_history` — поля `created_by` у них нет вовсе.
//
// Остальные правила (list/view/update/delete) сознательно не тронуты: закрытие
// анонимного создания — самостоятельная задача, ужесточение чтения — отдельное
// решение с отдельными последствиями для существующих записей.
//
// `down` — строгий обратный ход: `createRule` возвращается в `""`, `required` —
// в `false`.
migrate(
  (app) => {
    const collections = [
      'invoices',
      'incoming_mails',
      'outgoing_mails',
      'mail_files',
      'mail_relations',
    ];

    for (const name of collections) {
      const collection = app.findCollectionByNameOrId(name);

      unmarshal(
        {
          createRule: "@request.auth.id != ''",
        },
        collection,
      );

      const createdBy = collection.fields.getByName('created_by');
      if (createdBy) {
        createdBy.required = true;
      }

      app.save(collection);
    }
  },
  (app) => {
    const collections = [
      'invoices',
      'incoming_mails',
      'outgoing_mails',
      'mail_files',
      'mail_relations',
    ];

    for (const name of collections) {
      const collection = app.findCollectionByNameOrId(name);

      unmarshal(
        {
          createRule: '',
        },
        collection,
      );

      const createdBy = collection.fields.getByName('created_by');
      if (createdBy) {
        createdBy.required = false;
      }

      app.save(collection);
    }
  },
);
