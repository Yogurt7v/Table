/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // `created` serves the nightly cleanup filter in cleanup.pb.js:9-15 and the
  // notifications list `-created` sort plus its `created <` cursor; `user_id`
  // serves listRule = "@request.auth.id = user_id" and every user-scoped filter;
  // `organization_id` serves the org-cascade delete in org-cascade.pb.js:59.
  // The table is append-only and duplicate rows are legal, so none of the three
  // is constrained to distinct values.
  const collection = app.findCollectionByNameOrId("pbc_9876543210")

  collection.indexes.push(
    "CREATE INDEX IF NOT EXISTS `idx_notifications_created` ON `notifications` (`created`)",
    "CREATE INDEX IF NOT EXISTS `idx_notifications_user_id` ON `notifications` (`user_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_notifications_organization_id` ON `notifications` (`organization_id`)",
  )

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_9876543210")

  // Matched on the index-name prefix so the rollback does not depend on the
  // exact DDL text PocketBase persisted for each statement.
  collection.indexes = collection.indexes.filter((i) => !i.includes("`idx_notifications_"))

  return app.save(collection)
})
