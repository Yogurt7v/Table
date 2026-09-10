/// <reference path="../pb_data/types.d.ts" />

// Allow authenticated users to delete archive records so the
// frontend restore flow can clean up the archive after restoring.

migrate((app) => {
  const collections = ['pbc_5001000001', 'pbc_5001000002', 'pbc_5001000003'];
  for (const id of collections) {
    const col = app.findCollectionByNameOrId(id);
    col.deleteRule = '';
    app.save(col);
  }
}, (app) => {
  const collections = ['pbc_5001000001', 'pbc_5001000002', 'pbc_5001000003'];
  for (const id of collections) {
    const col = app.findCollectionByNameOrId(id);
    col.deleteRule = null;
    app.save(col);
  }
});