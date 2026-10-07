/// <reference path="../pb_data/types.d.ts" />

// Creates `mail_files` — attachments of a mail, incoming or outgoing.
//
// `mail_id` is a plain text id plus the `mail_type` discriminator instead of a
// relation on purpose: attachments must survive archival + restore, where
// PocketBase assigns the restored mail a brand new record id and a real
// relation would be cascade-deleted or left dangling by the archive snapshot.
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
        "autogeneratePattern": "",
        "hidden": false,
        "id": "m01",
        "max": 15,
        "min": 0,
        "name": "mail_id",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "m02",
        "maxSelect": 1,
        "name": "mail_type",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "select",
        "values": [
          "incoming",
          "outgoing"
        ]
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_2873630990",
        "hidden": false,
        "id": "m03",
        "maxSelect": 1,
        "name": "organization_id",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "hidden": false,
        "id": "m04",
        "maxSelect": 10,
        "maxSize": 0,
        "mimeTypes": [],
        "name": "file",
        "presentable": false,
        "protected": false,
        "required": true,
        "system": false,
        "thumbs": [],
        "type": "file"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "m05",
        "max": 255,
        "min": 0,
        "name": "name",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
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
    "id": "pbc_6001000003",
    "indexes": [],
    "listRule": "",
    "name": "mail_files",
    "system": false,
    "type": "base",
    "updateRule": "",
    "viewRule": ""
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_6001000003");
  return app.delete(collection);
})