/// <reference path="../pb_data/types.d.ts" />

// Adds `source_created` (date) to invoices — stores the `created` timestamp of
// the top-level original invoice on its remainder copies (original_invoice_id)
// created on partial payment, so a copy can be positioned at the original's place.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_711030668")

  if (!collection.fields.getByName("source_created")) {
    collection.fields.add(new Field({
      "hidden": false,
      "id": "date9870654321",
      "max": "",
      "min": "",
      "name": "source_created",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "date"
    }))
  }

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_711030668")

  const createdField = collection.fields.getByName("source_created")
  if (createdField) collection.fields.removeById(createdField.id)

  return app.save(collection)
})