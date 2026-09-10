/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId('pbc_5001000001');

  const field = new Field({
    autogeneratePattern: '',
    hidden: false,
    id: 'a27',
    max: 255,
    min: null,
    name: 'deleted_by_name',
    pattern: '',
    presentable: false,
    primaryKey: false,
    required: false,
    system: false,
    type: 'text',
  });

  collection.fields.add(field);
  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId('pbc_5001000001');
  const field = collection.fields.get('a27');
  if (field) {
    collection.fields.remove(field);
  }
  return app.save(collection);
});
