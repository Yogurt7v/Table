/// <reference path="../pb_data/types.d.ts" />

// Visibility flag for accounting objects (`accounting_objects.is_active`).
//
// Purpose: an admin can hide objects that have no invoices yet from the invoice
// registry while they stay fully usable in the mail subsystem (mail form and
// filters ignore this flag). Hidden objects remain reachable through the
// collapsed "Скрытые объекты" section, where invoices can still be created.
//
// A PocketBase bool defaults to `false`, so without an explicit backfill every
// existing object would vanish from the registry the moment the migration
// ships. We backfill `true` for all current rows — the flag is opt-out, not
// opt-in. Pattern follows `1815000010_add_can_view_mails_and_archive_rules.js`.

const FIELD = {
  hidden: false,
  id: 'bool_obj_active',
  name: 'is_active',
  presentable: false,
  required: false,
  system: false,
  type: 'bool',
};

migrate(
  (app) => {
    const objects = app.findCollectionByNameOrId('accounting_objects');

    if (!objects.fields.getByName(FIELD.name)) {
      objects.fields.add(new Field(FIELD));
    }

    app.save(objects);

    // Backfill after the save so the column exists. Paginated on purpose:
    // `accounting_objects` can grow past any fixed page size, and a capped
    // single pass would leave rows below the cap stale.
    const PAGE_SIZE = 500;
    let offset = 0;

    for (;;) {
      const page = app.findRecordsByFilter('accounting_objects', '', 'id', PAGE_SIZE, offset);

      if (!page.length) break;

      for (const record of page) {
        record.set(FIELD.name, true);
        app.save(record);
      }

      if (page.length < PAGE_SIZE) break;

      offset += page.length;
    }
  },
  (app) => {
    const objects = app.findCollectionByNameOrId('accounting_objects');
    const field = objects.fields.getByName(FIELD.name);

    if (field) objects.fields.removeById(field.id);

    app.save(objects);
  },
);
