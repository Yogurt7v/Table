/// <reference path="../pb_data/types.d.ts" />

// The `event` field of `notifications` was created with max=50, which is too
// short for texts like "Счёт удалён: <counterparty>, <amount> ₽ · <name>".
// PocketBase enforces the max length, so notification creation failed with
// "event: Must be no more than 50 character(s)". Raise it to match `message`.

migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_9876543210")

  const eventField = collection.fields.getByName("event")
  eventField.max = 0

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_9876543210")

  const eventField = collection.fields.getByName("event")
  eventField.max = 50

  return app.save(collection)
})