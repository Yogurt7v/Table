/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId('pbc_3787447598')

  collection.fields.addAt(4, new Field({
    "hidden": false,
    "id": "json7493015821",
    "maxSize": 0,
    "name": "counterparty_order",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId('pbc_3787447598')

  collection.fields.removeById('json7493015821')

  return app.save(collection)
})