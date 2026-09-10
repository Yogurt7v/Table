/// <reference path="../pb_data/types.d.ts" />

// Расширяет select-поле `type` в invoice_history значениями для файлов:
//   'file_added'   — к счёту прикреплён файл
//   'file_removed' — файл мягко удалён (soft-delete)
// Новая миграция нужна, потому что ранее применённая 1790000000 записана в _migrations
// и не будет перезапущена при изменении её содержимого.
migrate((app) => {
  const collection = app.findCollectionByNameOrId('pbc_3140463370')
  const field = collection.fields.getByName('type')

  if (field && field.type === 'select') {
    const values = field.values || []
    for (const value of ['file_added', 'file_removed']) {
      if (!values.includes(value)) {
        values.push(value)
      }
    }
    field.values = values
  }

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId('pbc_3140463370')
  const field = collection.fields.getByName('type')

  if (field && field.type === 'select') {
    field.values = (field.values || []).filter((v) => v !== 'file_added' && v !== 'file_removed')
  }

  return app.save(collection)
})