/// <reference path="../pb_data/types.d.ts" />

// Добавляет поля soft-delete в invoice_files:
//   is_deleted — boolean (default false)
//   deleted_at — date (optional)
migrate((app) => {
  const collection = app.findCollectionByNameOrId('pbc_4198132679')

  if (!collection.fields.getByName('is_deleted')) {
    collection.fields.add(new Field({
      'help': '',
      'hidden': false,
      'id': 'bool_is_deleted_001',
      'name': 'is_deleted',
      'presentable': false,
      'required': false,
      'system': false,
      'type': 'bool',
    }))
  }

  if (!collection.fields.getByName('deleted_at')) {
    collection.fields.add(new Field({
      'help': '',
      'hidden': false,
      'id': 'date_deleted_at_001',
      'name': 'deleted_at',
      'presentable': false,
      'required': false,
      'system': false,
      'type': 'date',
    }))
  }

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId('pbc_4198132679')
  const f1 = collection.fields.getByName('is_deleted')
  if (f1) collection.fields.removeById(f1.id)
  const f2 = collection.fields.getByName('deleted_at')
  if (f2) collection.fields.removeById(f2.id)
  return app.save(collection)
})
