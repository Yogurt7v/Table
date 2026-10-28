/// <reference path="../pb_data/types.d.ts" />

// Добавить поле document_id в уведомления, чтобы по клику на уведомление о
// документе в колокольчике можно было перейти на карточку документа (/docs).
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_9876543210'); // notifications

    collection.fields.add(
      new Field({
        hidden: false,
        id: 'text_doc_notif_id',
        max: 15,
        min: null,
        name: 'document_id',
        pattern: '',
        presentable: false,
        primaryKey: false,
        required: false,
        system: false,
        type: 'text',
      }),
    );

    return app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_9876543210');
    collection.fields.removeById('text_doc_notif_id');
    return app.save(collection);
  },
);
