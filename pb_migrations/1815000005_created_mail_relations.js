/// <reference path="../pb_data/types.d.ts" />

// Creates `mail_relations` — parent/child links between mails (e.g. an outgoing
// letter as the answer to an incoming one).
//
// Four relations, one per (direction, mail kind), so a cascade delete cleans up
// the link rows from either end of the link.
migrate((app) => {
  const collection = new Collection({
    "createRule": "",
    "deleteRule": "",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "cascadeDelete": true,
        "collectionId": "pbc_6001000001",
        "hidden": false,
        "id": "m01",
        "maxSelect": 1,
        "name": "parent_incoming_mail_id",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": true,
        "collectionId": "pbc_6001000002",
        "hidden": false,
        "id": "m02",
        "maxSelect": 1,
        "name": "parent_outgoing_mail_id",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": true,
        "collectionId": "pbc_6001000001",
        "hidden": false,
        "id": "m03",
        "maxSelect": 1,
        "name": "child_incoming_mail_id",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": true,
        "collectionId": "pbc_6001000002",
        "hidden": false,
        "id": "m04",
        "maxSelect": 1,
        "name": "child_outgoing_mail_id",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_2873630990",
        "hidden": false,
        "id": "m05",
        "maxSelect": 1,
        "name": "organization_id",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "m06",
        "max": 15,
        "min": 0,
        "name": "created_by",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "m07",
        "max": 200,
        "min": 0,
        "name": "created_by_name",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "m08",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "id": "pbc_6001000005",
    "indexes": [],
    "listRule": "",
    "name": "mail_relations",
    "system": false,
    "type": "base",
    "updateRule": "",
    "viewRule": ""
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_6001000005");
  return app.delete(collection);
})