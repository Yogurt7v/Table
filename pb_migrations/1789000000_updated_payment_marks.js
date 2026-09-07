/// <reference path="../pb_data/types.d.ts" />

// Adds `status` select field to payment_marks (proposed = «на согласование»,
// approved = оплачено целиком, partial = оплачено частично). If the field
// already exists (leftover from a removed migration) it is made non-required —
// otherwise creating a payment mark without `status` fails validation.
let hadStatus = false;
migrate((app) => {
  const collection = app.findCollectionByNameOrId('pbc_4198132678')
  hadStatus = !!collection.fields.getByName('status')
  if (hadStatus) {
    const field = collection.fields.getByName('status')
    field.required = false
    field.values = ['proposed', 'approved', 'partial']
  } else {
    collection.fields.add(new Field({
      'help': '',
      'hidden': false,
      'id': 'select9876543210',
      'maxSelect': 1,
      'name': 'status',
      'presentable': false,
      'required': false,
      'system': false,
      'type': 'select',
      'values': ['proposed', 'approved', 'partial'],
    }))
  }
  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId('pbc_4198132678')
  const field = collection.fields.getByName('status')
  if (field) {
    if (hadStatus) {
      field.required = true
    } else {
      collection.fields.removeById(field.id)
    }
  }
  return app.save(collection)
})