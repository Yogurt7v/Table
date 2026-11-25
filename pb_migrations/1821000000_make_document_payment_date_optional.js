/// <reference path="../pb_data/types.d.ts" />

// Делает дату оплаты документа необязательной: ручной документ можно создать
// без даты оплаты, а существующие записи сохраняются без изменений.
migrate(
  (app) => {
    const documents = app.findCollectionByNameOrId('documents');
    const field = documents.fields.getByName('payment_date');
    if (field) {
      field.required = false;
      app.save(documents);
    }
  },
  (app) => {
    const documents = app.findCollectionByNameOrId('documents');
    const field = documents.fields.getByName('payment_date');
    if (field) {
      field.required = true;
      app.save(documents);
    }
  },
);
