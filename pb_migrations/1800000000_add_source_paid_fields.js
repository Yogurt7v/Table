/// <reference path="../pb_data/types.d.ts" />

// Adds `source_paid_amount` (number) and `source_paid_date` (text) to invoices —
// stores the payment info of the original invoice on its remainder copies
// (original_invoice_id) created on partial payment.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_711030668")

  if (!collection.fields.getByName("source_paid_amount")) {
    collection.fields.add(new Field({
      "hidden": false,
      "id": "number1234567890",
      "max": null,
      "min": null,
      "name": "source_paid_amount",
      "onlyInt": false,
      "presentable": false,
      "required": false,
      "system": false,
      "type": "number"
    }))
  }

  if (!collection.fields.getByName("source_paid_date")) {
    collection.fields.add(new Field({
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text1234567890",
      "max": 10,
      "min": 0,
      "name": "source_paid_date",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    }))
  }

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_711030668")

  const amountField = collection.fields.getByName("source_paid_amount")
  if (amountField) collection.fields.removeById(amountField.id)

  const dateField = collection.fields.getByName("source_paid_date")
  if (dateField) collection.fields.removeById(dateField.id)

  return app.save(collection)
})
