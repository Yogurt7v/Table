/// <reference path="../pb_data/types.d.ts" />

// Расширяет select invoice_history.type новыми типами для архива:
//   'invoice_deleted'   — счёт удалён и помещён в архив
//   'invoice_restored'  — счёт восстановлен из архива
//
// Прямое присваивание field.values не отслеживается сервером, поэтому
// поле пересоздаётся (паттерн из 1805000000).

const HISTORY_TYPE_FIELD = {
  'help': '',
  'hidden': false,
  'id': 'select_mark_type_001',
  'maxSelect': 1,
  'name': 'type',
  'presentable': false,
  'required': false,
  'system': false,
  'type': 'select',
  'values': [
    'mark_created',
    'mark_deleted',
    'file_added',
    'file_removed',
    'copy_created',
    'invoice_deleted',
    'invoice_restored',
  ],
}

function recreateSelectField(app, collectionId, fieldConfig) {
  const collection = app.findCollectionByNameOrId(collectionId)
  const existing = collection.fields.getByName(fieldConfig.name)

  if (existing) {
    collection.fields.removeById(existing.id)
  }
  collection.fields.add(new Field(fieldConfig))

  return app.save(collection)
}

migrate((app) => {
  recreateSelectField(app, 'pbc_3140463370', HISTORY_TYPE_FIELD)
}, (app) => {
  recreateSelectField(app, 'pbc_3140463370', {
    ...HISTORY_TYPE_FIELD,
    values: ['mark_created', 'mark_deleted', 'file_added', 'file_removed', 'copy_created'],
  })
})