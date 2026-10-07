/// <reference path="../pb_data/types.d.ts" />

// Adds the query indexes for the mail subsystem (почтовые отправления).
//
// Every index is non-unique on purpose: the mail `seq` autoincrement hook
// reads MAX(seq) and writes MAX+1, so a unique constraint could reject a
// legitimate concurrent write instead of just letting the next write win.

const MAIL_INDEXES = [
  // Consumer: the incoming register list, which is always scoped by
  // `organization_id` and sorted by `date`; the counterparty filter inside the
  // same org scope; and the `seq` column ordering plus the MAX(seq) read done by
  // the mail seq autoincrement hook.
  {
    collectionId: 'pbc_6001000001',
    prefix: 'idx_incoming_mails_',
    indexes: [
      "CREATE INDEX IF NOT EXISTS `idx_incoming_mails_organization_id_date` ON `incoming_mails` (`organization_id`, `date`)",
      "CREATE INDEX IF NOT EXISTS `idx_incoming_mails_organization_id_sender` ON `incoming_mails` (`organization_id`, `sender`)",
      "CREATE INDEX IF NOT EXISTS `idx_incoming_mails_organization_id_seq` ON `incoming_mails` (`organization_id`, `seq`)",
    ],
  },

  // Consumer: the outgoing register list (org-scoped, sorted by `date`), the
  // recipient filter of the full-text search, and the `seq` MAX(seq) read done
  // by the mail seq autoincrement hook.
  {
    collectionId: 'pbc_6001000002',
    prefix: 'idx_outgoing_mails_',
    indexes: [
      "CREATE INDEX IF NOT EXISTS `idx_outgoing_mails_organization_id_date` ON `outgoing_mails` (`organization_id`, `date`)",
      "CREATE INDEX IF NOT EXISTS `idx_outgoing_mails_organization_id_recipient` ON `outgoing_mails` (`organization_id`, `recipient`)",
      "CREATE INDEX IF NOT EXISTS `idx_outgoing_mails_organization_id_seq` ON `outgoing_mails` (`organization_id`, `seq`)",
    ],
  },

  // Consumer: the attachments panel, which filters by the (mail_id, mail_type)
  // pair to survive archival + restore, and the org-cascade delete that drops
  // an organization's files.
  {
    collectionId: 'pbc_6001000003',
    prefix: 'idx_mail_files_',
    indexes: [
      "CREATE INDEX IF NOT EXISTS `idx_mail_files_mail_id_mail_type` ON `mail_files` (`mail_id`, `mail_type`)",
      "CREATE INDEX IF NOT EXISTS `idx_mail_files_organization_id` ON `mail_files` (`organization_id`)",
    ],
  },

  // Consumer: the per-mail history drawer (filter by incoming_mail_id /
//  outgoing_mail_id, sorted by changed_at) and the organization-wide history
  // timeline. `organization_id` also serves the org-cascade delete.
  {
    collectionId: 'pbc_6001000004',
    prefix: 'idx_mail_history_',
    indexes: [
      "CREATE INDEX IF NOT EXISTS `idx_mail_history_organization_id_changed_at` ON `mail_history` (`organization_id`, `changed_at`)",
      "CREATE INDEX IF NOT EXISTS `idx_mail_history_incoming_mail_id` ON `mail_history` (`incoming_mail_id`)",
      "CREATE INDEX IF NOT EXISTS `idx_mail_history_outgoing_mail_id` ON `mail_history` (`outgoing_mail_id`)",
    ],
  },

  // Consumer: the parent/child link queries in both directions ("show the
  // letters attached to this one" and the reverse graph walk), and the cascade
  // cleanup that removes link rows when either end of the link is deleted.
  {
    collectionId: 'pbc_6001000005',
    prefix: 'idx_mail_relations_',
    indexes: [
      "CREATE INDEX IF NOT EXISTS `idx_mail_relations_parent_incoming_mail_id` ON `mail_relations` (`parent_incoming_mail_id`)",
      "CREATE INDEX IF NOT EXISTS `idx_mail_relations_parent_outgoing_mail_id` ON `mail_relations` (`parent_outgoing_mail_id`)",
      "CREATE INDEX IF NOT EXISTS `idx_mail_relations_child_incoming_mail_id` ON `mail_relations` (`child_incoming_mail_id`)",
      "CREATE INDEX IF NOT EXISTS `idx_mail_relations_child_outgoing_mail_id` ON `mail_relations` (`child_outgoing_mail_id`)",
      "CREATE INDEX IF NOT EXISTS `idx_mail_relations_organization_id` ON `mail_relations` (`organization_id`)",
    ],
  },

  // Consumer: the archive list (org-scoped, sorted by `deleted_at`), the restore
  // lookup by `original_id`, and the org-cascade delete.
  {
    collectionId: 'pbc_6001000006',
    prefix: 'idx_deleted_incoming_mails_',
    indexes: [
      "CREATE INDEX IF NOT EXISTS `idx_deleted_incoming_mails_organization_id_deleted_at` ON `deleted_incoming_mails` (`organization_id`, `deleted_at`)",
      "CREATE INDEX IF NOT EXISTS `idx_deleted_incoming_mails_original_id` ON `deleted_incoming_mails` (`original_id`)",
    ],
  },

  // Consumer: the outgoing archive list (org-scoped, sorted by `deleted_at`),
  // the restore lookup by `original_id`, and the org-cascade delete.
  {
    collectionId: 'pbc_6001000007',
    prefix: 'idx_deleted_outgoing_mails_',
    indexes: [
      "CREATE INDEX IF NOT EXISTS `idx_deleted_outgoing_mails_organization_id_deleted_at` ON `deleted_outgoing_mails` (`organization_id`, `deleted_at`)",
      "CREATE INDEX IF NOT EXISTS `idx_deleted_outgoing_mails_original_id` ON `deleted_outgoing_mails` (`original_id`)",
    ],
  },

  // Consumer: the archive history timeline (org-scoped, sorted by `changed_at`)
  // and the per-archive-letter history drawer.
  {
    collectionId: 'pbc_6001000008',
    prefix: 'idx_deleted_mail_history_',
    indexes: [
      "CREATE INDEX IF NOT EXISTS `idx_deleted_mail_history_organization_id_changed_at` ON `deleted_mail_history` (`organization_id`, `changed_at`)",
      "CREATE INDEX IF NOT EXISTS `idx_deleted_mail_history_deleted_incoming_mail_id` ON `deleted_mail_history` (`deleted_incoming_mail_id`)",
      "CREATE INDEX IF NOT EXISTS `idx_deleted_mail_history_deleted_outgoing_mail_id` ON `deleted_mail_history` (`deleted_outgoing_mail_id`)",
    ],
  },
]

migrate((app) => {
  for (const group of MAIL_INDEXES) {
    const collection = app.findCollectionByNameOrId(group.collectionId)

    collection.indexes.push(...group.indexes)

    app.save(collection)
  }
}, (app) => {
  for (const group of MAIL_INDEXES) {
    const collection = app.findCollectionByNameOrId(group.collectionId)

    // Matched on the index-name prefix so the rollback does not depend on the
    // exact DDL text PocketBase persisted for each statement.
    collection.indexes = collection.indexes.filter((i) => !i.includes('`' + group.prefix))

    app.save(collection)
  }
})