/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3787447598")

  // add field
  collection.fields.addAt(3, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_3787447598",
    "help": "",
    "hidden": false,
    "id": "relation1881555254",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "accounting_object_id",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "relation"
  }))

  // add field
  collection.fields.addAt(4, new Field({
    "help": "",
    "hidden": false,
    "id": "date2862495610",
    "max": "",
    "min": "",
    "name": "date",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "date"
  }))

  // add field
  collection.fields.addAt(5, new Field({
    "help": "",
    "hidden": false,
    "id": "number2524893523",
    "max": null,
    "min": null,
    "name": "seq",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(6, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text2604525468",
    "max": 0,
    "min": 0,
    "name": "counterparty",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(7, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text3095901163",
    "max": 0,
    "min": 0,
    "name": "purpose",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(8, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text4259688370",
    "max": 0,
    "min": 0,
    "name": "contract_no",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(9, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text4045061810",
    "max": 0,
    "min": 0,
    "name": "invoice_no",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(10, new Field({
    "help": "",
    "hidden": false,
    "id": "number2392944706",
    "max": null,
    "min": null,
    "name": "amount",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(11, new Field({
    "help": "",
    "hidden": false,
    "id": "bool4253985592",
    "name": "paid",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(12, new Field({
    "help": "",
    "hidden": false,
    "id": "date3057222488",
    "max": "",
    "min": "",
    "name": "paid_date",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "date"
  }))

  // add field
  collection.fields.addAt(13, new Field({
    "convertURLs": false,
    "help": "",
    "hidden": false,
    "id": "editor2490651244",
    "maxSize": 0,
    "name": "comment",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "editor"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3787447598")

  // remove field
  collection.fields.removeById("relation1881555254")

  // remove field
  collection.fields.removeById("date2862495610")

  // remove field
  collection.fields.removeById("number2524893523")

  // remove field
  collection.fields.removeById("text2604525468")

  // remove field
  collection.fields.removeById("text3095901163")

  // remove field
  collection.fields.removeById("text4259688370")

  // remove field
  collection.fields.removeById("text4045061810")

  // remove field
  collection.fields.removeById("number2392944706")

  // remove field
  collection.fields.removeById("bool4253985592")

  // remove field
  collection.fields.removeById("date3057222488")

  // remove field
  collection.fields.removeById("editor2490651244")

  return app.save(collection)
})
