/// <reference path="../pb_data/types.d.ts" />

// Добавляет все флаги доступа к модулям в `organization_users`:
// - can_view_documents — видеть документы
// - can_view_invoices — видеть счета
// - can_view_mails + 6 флагов действий с почтой (создание/редактирование/удаление входящих и исходящих)
// и проставляет `true` для всех существующих членств, чтобы текущие пользователи
// не потеряли доступ. Администратор может затем сузить права для отдельных
// пользователей через админпанель.
//
// Поля никогда не добавлялись никакой миграцией: они есть в TypeScript-типе,
// фронтенде и API-функциях записи, но отсутствуют в схеме PocketBase. Поэтому
// на базах без этих колонок переключатели доступа молчат: фронт читает undefined,
// для документов/счетов пропускает всех (`!== false`), для почты блокирует всех
// (`=== true`), а попытка сохранить уходит в PATCH по несуществующим колонкам
// и молча откатывается.

const FIELDS = [
  {
    hidden: false,
    id: 'bool_documents_01',
    name: 'can_view_documents',
    presentable: false,
    required: false,
    system: false,
    type: 'bool',
  },
  {
    hidden: false,
    id: 'bool_invoices_01',
    name: 'can_view_invoices',
    presentable: false,
    required: false,
    system: false,
    type: 'bool',
  },
  {
    hidden: false,
    id: 'bool_mail_01',
    name: 'can_create_incoming_mails',
    presentable: false,
    required: false,
    system: false,
    type: 'bool',
  },
  {
    hidden: false,
    id: 'bool_mail_02',
    name: 'can_edit_incoming_mails',
    presentable: false,
    required: false,
    system: false,
    type: 'bool',
  },
  {
    hidden: false,
    id: 'bool_mail_03',
    name: 'can_delete_incoming_mails',
    presentable: false,
    required: false,
    system: false,
    type: 'bool',
  },
  {
    hidden: false,
    id: 'bool_mail_04',
    name: 'can_create_outgoing_mails',
    presentable: false,
    required: false,
    system: false,
    type: 'bool',
  },
  {
    hidden: false,
    id: 'bool_mail_05',
    name: 'can_edit_outgoing_mails',
    presentable: false,
    required: false,
    system: false,
    type: 'bool',
  },
  {
    hidden: false,
    id: 'bool_mail_06',
    name: 'can_delete_outgoing_mails',
    presentable: false,
    required: false,
    system: false,
    type: 'bool',
  },
  {
    hidden: false,
    id: 'bool_mail_07',
    name: 'can_view_mails',
    presentable: false,
    required: false,
    system: false,
    type: 'bool',
  },
];

migrate(
  (app) => {
    const orgUsers = app.findCollectionByNameOrId('organization_users');

    for (const config of FIELDS) {
      if (!orgUsers.fields.getByName(config.name)) {
        orgUsers.fields.add(new Field(config));
      }
    }

    app.save(orgUsers);

    const PAGE_SIZE = 500;
    let offset = 0;

    for (;;) {
      const page = app.findRecordsByFilter('organization_users', '', 'id', PAGE_SIZE, offset);

      if (!page.length) break;

      for (const record of page) {
        for (const config of FIELDS) {
          record.set(config.name, true);
        }
        app.save(record);
      }

      if (page.length < PAGE_SIZE) break;

      offset += page.length;
    }
  },
  (app) => {
    const orgUsers = app.findCollectionByNameOrId('organization_users');

    for (const config of FIELDS) {
      const field = orgUsers.fields.getByName(config.name);
      if (field) orgUsers.fields.removeById(field.id);
    }

    return app.save(orgUsers);
  },
);
