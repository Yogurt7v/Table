/// <reference path="../pb_data/types.d.ts" />

// Пересоздаёт select-поля, значения которых ранее не были сохранены из-за
// того, что прямое присваивание `field.values = [...]` не отслеживается
// сервером PocketBase (prod: 0.38.2). Поля удаляются и добавляются заново
// с полным списком значений.

// invoice_history.type:
//   'mark_created'  — отметка добавлена
//   'mark_deleted'  — отметка снята/удалена
//   'file_added'    — к счёту прикреплён файл
//   'file_removed'  — файл мягко удалён (soft-delete)
//   'copy_created'  — создан счёт-копия

// payment_marks.status:
//   'proposed'  — направлено на согласование
//   'approved'  — оплачено
//   'partial'   — оплачено частично

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
  'values': ['mark_created', 'mark_deleted', 'file_added', 'file_removed', 'copy_created'],
}

const PAYMENT_STATUS_FIELD = {
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
  recreateSelectField(app, 'pbc_4198132678', PAYMENT_STATUS_FIELD)
}, (app) => {
  recreateSelectField(app, 'pbc_3140463370', {
    ...HISTORY_TYPE_FIELD,
    values: ['mark_created', 'mark_deleted'],
  })
  recreateSelectField(app, 'pbc_4198132678', {
    ...PAYMENT_STATUS_FIELD,
    values: ['proposed', 'approved'],
  })
})