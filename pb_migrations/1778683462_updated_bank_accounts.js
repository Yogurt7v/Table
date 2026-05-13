/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_314358106")

  // remove field
  collection.fields.removeById("number2901680126")

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_314358106")

  // add field
  collection.fields.addAt(5, new Field({
    "help": "",
    "hidden": false,
    "id": "number2901680126",
    "max": null,
    "min": 0,
    "name": "balance",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
})
