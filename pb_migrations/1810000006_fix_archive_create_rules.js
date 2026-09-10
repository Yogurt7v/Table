/// <reference path="../pb_data/types.d.ts" />

// Allow the frontend to create archive records while deleting/restoring
// invoices. The deleted_invoices and deleted_invoice_history collections
// had createRule = null which broke the frontend archiving flow (403).

migrate((app) => {
  const collections = ['pbc_5001000001', 'pbc_5001000002'];
  for (const id of collections) {
    const col = app.findCollectionByNameOrId(id);
    col.createRule = '';
    app.save(col);
  }
}, (app) => {
  const collections = ['pbc_5001000001', 'pbc_5001000002'];
  for (const id of collections) {
    const col = app.findCollectionByNameOrId(id);
    col.createRule = null;
    app.save(col);
  }
});