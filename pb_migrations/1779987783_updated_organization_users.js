/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_4029263812")

  // add field
  collection.fields.addAt(4, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_3787447598",
    "help": "",
    "hidden": false,
    "id": "relation2988100851",
    "maxSelect": 10,
    "minSelect": 0,
    "name": "objects",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_4029263812")

  // remove field
  collection.fields.removeById("relation2988100851")

  return app.save(collection)
})
