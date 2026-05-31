/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_9876543210")

  // Remove unneeded fields
  collection.fields.removeById("json1928374655") // read_by
  collection.fields.removeById("text6677889900") // object_id
  collection.fields.removeById("json9988776655") // message_fields
  collection.fields.removeById("text9876054321") // actor_id

  // Add user_id — relation to users
  collection.fields.addAt(5, new Field({
    "cascadeDelete": false,
    "collectionId": "_pb_users_auth_",
    "help": "",
    "hidden": false,
    "id": "relation1600000001",
    "maxSelect": 1,
    "minSelect": 1,
    "name": "user_id",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "relation"
  }))

  // Add read — bool
  collection.fields.addAt(9, new Field({
    "help": "",
    "hidden": false,
    "id": "bool1700000001",
    "name": "read",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // Update API rules
  collection.listRule = "@request.auth.id = user_id"
  collection.viewRule = "@request.auth.id = user_id"
  collection.createRule = null
  collection.updateRule = "@request.auth.id = user_id"

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_9876543210")

  // Restore rules
  collection.listRule = "@request.auth.id != null"
  collection.viewRule = "@request.auth.id != null"
  collection.createRule = null
  collection.updateRule = null

  // Remove added fields
  collection.fields.removeById("bool1700000001")
  collection.fields.removeById("relation1600000001")

  // Restore removed fields
  collection.fields.addAt(5, new Field({
    "hidden": false,
    "id": "json9988776655",
    "maxSize": 0,
    "name": "message_fields",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  collection.fields.addAt(8, new Field({
    "hidden": false,
    "id": "text9876054321",
    "max": 255,
    "min": null,
    "name": "actor_id",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  collection.fields.addAt(10, new Field({
    "hidden": false,
    "id": "text6677889900",
    "max": 255,
    "min": null,
    "name": "object_id",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  collection.fields.addAt(12, new Field({
    "hidden": false,
    "id": "json1928374655",
    "maxSize": 0,
    "name": "read_by",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  return app.save(collection)
})
