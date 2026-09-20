/// <reference path="../pb_data/types.d.ts" />

// Имя инициатора денормализуется в самом счёте: `created_by` — это id, который
// перестаёт резолвиться, когда счёт создан суперюзером (его нет в `users`) или
// когда пользователя позже удалили. Имя в счёте сохраняет колонку «Инициатор».

migrate((app) => {
  const invoices = app.findCollectionByNameOrId('pbc_711030668');

  invoices.fields.add(
    new Field({
      autogeneratePattern: '',
      hidden: false,
      id: 'a28',
      max: 255,
      min: null,
      name: 'created_by_name',
      pattern: '',
      presentable: false,
      primaryKey: false,
      required: false,
      system: false,
      type: 'text',
    }),
  );

  invoices.fields.add(
    new Field({
      autogeneratePattern: '',
      hidden: false,
      id: 'a29',
      max: 255,
      min: null,
      name: 'updated_by_name',
      pattern: '',
      presentable: false,
      primaryKey: false,
      required: false,
      system: false,
      type: 'text',
    }),
  );

  const deleted = app.findCollectionByNameOrId('pbc_5001000001');

  deleted.fields.add(
    new Field({
      autogeneratePattern: '',
      hidden: false,
      id: 'a30',
      max: 255,
      min: null,
      name: 'created_by_name',
      pattern: '',
      presentable: false,
      primaryKey: false,
      required: false,
      system: false,
      type: 'text',
    }),
  );

  deleted.fields.add(
    new Field({
      autogeneratePattern: '',
      hidden: false,
      id: 'a31',
      max: 255,
      min: null,
      name: 'updated_by_name',
      pattern: '',
      presentable: false,
      primaryKey: false,
      required: false,
      system: false,
      type: 'text',
    }),
  );

  app.save(invoices);
  return app.save(deleted);
}, (app) => {
  const invoices = app.findCollectionByNameOrId('pbc_711030668');
  for (const id of ['a28', 'a29']) {
    const field = invoices.fields.get(id);
    if (field) invoices.fields.remove(field);
  }

  const deleted = app.findCollectionByNameOrId('pbc_5001000001');
  for (const id of ['a30', 'a31']) {
    const field = deleted.fields.get(id);
    if (field) deleted.fields.remove(field);
  }

  app.save(invoices);
  return app.save(deleted);
});