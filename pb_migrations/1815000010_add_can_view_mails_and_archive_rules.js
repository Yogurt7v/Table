/// <reference path="../pb_data/types.d.ts" />

// Two mail-subsystem schema fixes that had to ship as one ALTER migration:
//
// 1. `organization_users.can_view_mails` — the 7th mail permission flag, added
//    after the six from `1815000000_extend_organization_users_mail_permissions`.
//    A PocketBase bool defaults to `false`, so without an explicit backfill every
//    existing membership would silently lose the mail page. We backfill `true`
//    for all current rows and let admins tighten it afterwards.
//
// 2. Final access rules for the three mail archive collections. They were created
//    with `null` rules, which is the exact bug the invoice subsystem already hit
//    and fixed twice: `1810000006_fix_archive_create_rules.js` (create 403 in the
//    invoice subsystem) and `1810000005_fix_archive_delete_rules.js` (delete 403 in
//    the invoice subsystem). We set the finished matrix in one go instead of
//    discovering it in production.
//
// Note on roles: PocketBase rules can only read fields of the request's own auth
// record plus direct relation fields of the queried collection, so the per-org
// `organization_users.role` CANNOT be expressed here. Rules stay authenticated-only
// and role enforcement happens in the frontend.

const ORG_USERS_FIELD = {
  'hidden': false,
  'id': 'bool_mail_07',
  'name': 'can_view_mails',
  'presentable': false,
  'required': false,
  'system': false,
  'type': 'bool',
}

// Mail archives: create on delete, delete on restore, never update.
const ARCHIVE_COLLECTIONS = [
  'deleted_incoming_mails',
  'deleted_outgoing_mails',
  'deleted_mail_history',
]

migrate(
  (app) => {
    // ---------------------------------------------------------------- field ---
    const orgUsers = app.findCollectionByNameOrId('organization_users')

    if (!orgUsers.fields.getByName(ORG_USERS_FIELD.name)) {
      orgUsers.fields.add(new Field(ORG_USERS_FIELD))
    }

    app.save(orgUsers)

    // Backfill after the save so the column exists. Paginated on purpose:
    // `organization_users` can grow past any fixed page size, and a capped
    // single pass would leave rows below the cap stale.
    const PAGE_SIZE = 500
    let offset = 0

    for (;;) {
      const page = app.findRecordsByFilter(
        'organization_users',
        '',
        'id',
        PAGE_SIZE,
        offset,
      )

      if (!page.length) break

      for (const record of page) {
        record.set(ORG_USERS_FIELD.name, true)
        app.save(record)
      }

      if (page.length < PAGE_SIZE) break

      offset += page.length
    }

    // ---------------------------------------------------------------- rules ---
    // "" means "any authenticated user", null means "superusers only".
    //
    // list/view/create = ""  the archive page is readable and the frontend writes
    //   a row while archiving a letter — null broke the invoice subsystem once
    //   already (1810000006_fix_archive_create_rules.js).
    // updateRule = null      archive rows are immutable; nothing ever edits them.
    //   Letters are only ever archived and restored, never patched.
    // deleteRule = ""        REQUIRED. The restore flow recreates the original
    //   letter and then deletes its archive row; null broke the invoice
    //   subsystem once already (1810000005_fix_archive_delete_rules.js).
    //
    // So `updateRule = null` next to `deleteRule = ""` is deliberate, not a typo:
    // immutable-to-edit, but removable by the restore flow.
    for (const name of ARCHIVE_COLLECTIONS) {
      const col = app.findCollectionByNameOrId(name)

      col.listRule = ''
      col.viewRule = ''
      col.createRule = ''
      col.updateRule = null
      col.deleteRule = ''

      app.save(col)
    }
  },
  (app) => {
    const orgUsers = app.findCollectionByNameOrId('organization_users')
    const field = orgUsers.fields.getByName(ORG_USERS_FIELD.name)

    if (field) orgUsers.fields.removeById(field.id)

    app.save(orgUsers)

    for (const name of ARCHIVE_COLLECTIONS) {
      const col = app.findCollectionByNameOrId(name)

      col.listRule = null
      col.viewRule = null
      col.createRule = null
      col.updateRule = null
      col.deleteRule = null

      app.save(col)
    }
  },
)