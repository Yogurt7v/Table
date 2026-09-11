/// <reference path="../pb_data/types.d.ts" />

// Adds `last_deleted_mark` (json, nullable) to invoices —
// stores the deleted payment mark data so it can be restored
// when a payment is undone.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_711030668")

  if (!collection.fields.getByName("last_deleted_mark")) {
    collection.fields.add(new Field({
      "hidden": false,
      "id": "json1234567890",
      "maxSize": 0,
      "name": "last_deleted_mark",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "json"
    }))
  }

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_711030668")

  const field = collection.fields.getByName("last_deleted_mark")
  if (field) collection.fields.removeById(field.id)

  return app.save(collection)
})
