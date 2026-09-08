/// <reference path="../pb_data/types.d.ts" />

// Добавляет select-поле `type` в invoice_history.
//   ''           — обычное изменение счёта (по умолчанию, legacy записи)
//   'mark_created' — босс поставил отметку на счёт
//   'mark_deleted' — отметка снята/удалена
// Поле необязательное, чтобы не сломать существующие записи.
migrate((app) => {
  const collection = app.findCollectionByNameOrId('pbc_3140463370')

  if (!collection.fields.getByName('type')) {
    collection.fields.add(new Field({
      'help': '',
      'hidden': false,
      'id': 'select_mark_type_001',
      'maxSelect': 1,
      'name': 'type',
      'presentable': false,
      'required': false,
      'system': false,
      'type': 'select',
      'values': ['mark_created', 'mark_deleted'],
    }))
  }

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId('pbc_3140463370')
  const field = collection.fields.getByName('type')
  if (field) {
    collection.fields.removeById(field.id)
  }
  return app.save(collection)
})
