/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_711030668")

  collection.fields.addAt(10, new Field({
    "hidden": false,
    "id": "json3456789012",
    "maxSize": 0,
    "name": "payment_amounts",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  collection.fields.addAt(11, new Field({
    "hidden": false,
    "id": "number3087308939",
    "max": null,
    "min": null,
    "name": "paid_amount",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_711030668")

  collection.fields.removeById("number3087308939")
  collection.fields.removeById("json3456789012")

  return app.save(collection)
})
