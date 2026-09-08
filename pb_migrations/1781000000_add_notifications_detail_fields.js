/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_9876543210")

  // Add object_name — text
  collection.fields.addAt(8, new Field({
    "hidden": false,
    "id": "text_obj_name_001",
    "max": 255,
    "min": null,
    "name": "object_name",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // Add amount — number
  collection.fields.addAt(9, new Field({
    "hidden": false,
    "id": "number_amt_001",
    "max": null,
    "min": null,
    "name": "amount",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // Add paid — bool
  collection.fields.addAt(10, new Field({
    "hidden": false,
    "id": "bool_paid_001",
    "name": "paid",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // Add invoice_date — date
  collection.fields.addAt(11, new Field({
    "hidden": false,
    "id": "date_inv_date_001",
    "name": "invoice_date",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "date"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_9876543210")

  // Remove added fields
  collection.fields.removeById("date_inv_date_001")
  collection.fields.removeById("bool_paid_001")
  collection.fields.removeById("number_amt_001")
  collection.fields.removeById("text_obj_name_001")

  return app.save(collection)
})
