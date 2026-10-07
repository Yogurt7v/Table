/// <reference path="../pb_data/types.d.ts" />

// Adds the six mail-correspondence permission flags to `organization_users`
// and backfills them for every existing membership from its role.
//
// The rules on the mail collections stay `""` (any authenticated user), the
// same as `invoices` — role checks live in the frontend. These flags are the
// per-membership, per-direction override the frontend reads, mirroring the
// existing `can_create_invoices` flag.

const MAIL_PERMISSION_FIELDS = [
  {
    'hidden': false,
    'id': 'bool_mail_01',
    'name': 'can_create_incoming_mails',
    'presentable': false,
    'required': false,
    'system': false,
    'type': 'bool',
  },
  {
    'hidden': false,
    'id': 'bool_mail_02',
    'name': 'can_edit_incoming_mails',
    'presentable': false,
    'required': false,
    'system': false,
    'type': 'bool',
  },
  {
    'hidden': false,
    'id': 'bool_mail_03',
    'name': 'can_delete_incoming_mails',
    'presentable': false,
    'required': false,
    'system': false,
    'type': 'bool',
  },
  {
    'hidden': false,
    'id': 'bool_mail_04',
    'name': 'can_create_outgoing_mails',
    'presentable': false,
    'required': false,
    'system': false,
    'type': 'bool',
  },
  {
    'hidden': false,
    'id': 'bool_mail_05',
    'name': 'can_edit_outgoing_mails',
    'presentable': false,
    'required': false,
    'system': false,
    'type': 'bool',
  },
  {
    'hidden': false,
    'id': 'bool_mail_06',
    'name': 'can_delete_outgoing_mails',
    'presentable': false,
    'required': false,
    'system': false,
    'type': 'bool',
  },
]

// The default matrix applied to existing rows, keyed by `organization_users.role`.
// Roles not listed here (guest) keep every flag at false.
const MAIL_PERMISSIONS_BY_ROLE = {
  'admin': [true, true, true, true, true, true],
  'moderator': [true, true, true, true, true, true],
  'boss': [true, true, true, true, true, true],
  'chief': [true, true, true, true, true, true],
  // A plain user works with letters but never removes them.
  'user': [true, true, false, true, true, false],
  'guest': [false, false, false, false, false, false],
}

migrate((app) => {
  const collection = app.findCollectionByNameOrId('pbc_4029263812')

  for (const config of MAIL_PERMISSION_FIELDS) {
    if (!collection.fields.getByName(config.name)) {
      collection.fields.add(new Field(config))
    }
  }

  app.save(collection)

  // Backfill runs after the save so the columns already exist.
  const records = app.findRecordsByFilter('organization_users', '', '', 0, 0)

  for (const record of records) {
    const permissions = MAIL_PERMISSIONS_BY_ROLE[record.get('role')] || MAIL_PERMISSIONS_BY_ROLE['guest']

    for (let i = 0; i < MAIL_PERMISSION_FIELDS.length; i++) {
      record.set(MAIL_PERMISSION_FIELDS[i].name, permissions[i])
    }

    app.save(record)
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId('pbc_4029263812')

  for (const config of MAIL_PERMISSION_FIELDS) {
    const field = collection.fields.getByName(config.name)
    if (field) collection.fields.removeById(field.id)
  }

  return app.save(collection)
})