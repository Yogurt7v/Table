/// <reference path="../pb_data/types.d.ts" />

// `organization_users.objects` was created with maxSelect: 10, but one
// organization can have more than 10 accounting objects. PocketBase validates
// maxSelect on save, so granting a user access to the 11th object was rejected
// and the administrator could not open all objects for the user.
//
// Raise the cap to 100. Zero (or 1) is not an option: for multi-value fields
// PocketBase falls back to single-select when maxSelect <= 1.

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('organization_users');
    const objectsField = collection.fields.getByName('objects');

    if (!objectsField) {
      throw new Error('organization_users.objects field not found');
    }

    objectsField.maxSelect = 100;

    return app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('organization_users');
    const objectsField = collection.fields.getByName('objects');

    if (!objectsField) {
      throw new Error('organization_users.objects field not found');
    }

    objectsField.maxSelect = 10;

    return app.save(collection);
  },
);
