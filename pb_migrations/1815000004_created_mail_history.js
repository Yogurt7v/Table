/// <reference path="../pb_data/types.d.ts" />

// Creates `mail_history` — append-only audit trail of mail changes.
//
// Two real relations (unlike the polymorphic pair on `mail_files`) so history
// rows are cascade-deleted together with their mail and can be `expand`-ed by
// the frontend. update/delete are `null`: history rows are immutable.
migrate((app) => {
  const collection = new Collection({
    "createRule": "",
    "deleteRule": null,
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
        "name": "incoming_mail_id",
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
        "name": "outgoing_mail_id",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
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
        "autogeneratePattern": "",
        "hidden": false,
        "id": "m04",
        "max": 15,
        "min": 0,
        "name": "author",
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
        "id": "m05",
        "max": 200,
        "min": 0,
        "name": "author_name",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "m06",
        "max": "",
        "min": "",
        "name": "changed_at",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "date"
      },
      {
        "hidden": false,
        "id": "m07",
        "maxSelect": 1,
        "name": "type",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "select",
        "values": [
          "created",
          "updated",
          "deleted",
          "restored",
          "linked",
          "unlinked"
        ]
      },
      {
        "hidden": false,
        "id": "m08",
        "maxSize": 0,
        "name": "previous_data",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "json"
      },
      {
        "hidden": false,
        "id": "m09",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "m10",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "id": "pbc_6001000004",
    "indexes": [],
    "listRule": "",
    "name": "mail_history",
    "system": false,
    "type": "base",
    "updateRule": null,
    "viewRule": ""
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_6001000004");
  return app.delete(collection);
})