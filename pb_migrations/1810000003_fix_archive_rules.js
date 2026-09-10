/// <reference path="../pb_data/types.d.ts" />

// Fix access rules for archive collections.
// The initial migrations applied with null (no-access) rules.
// This migration sets proper rules so the frontend can read/write.

migrate((app) => {
  const collections = [
    { id: 'pbc_5001000001', name: 'deleted_invoices' },
    { id: 'pbc_5001000002', name: 'deleted_invoice_history' },
    { id: 'pbc_5001000003', name: 'deleted_invoice_files' },
  ];

  for (const c of collections) {
    const col = app.findCollectionByNameOrId(c.id);
    col.listRule = '';
    col.viewRule = '';
    col.updateRule = null;
    col.deleteRule = null;
    app.save(col);
  }

  // Frontend needs to create file records during archival
  const filesCol = app.findCollectionByNameOrId('pbc_5001000003');
  filesCol.createRule = '';
  app.save(filesCol);
}, (app) => {
  const collections = ['pbc_5001000001', 'pbc_5001000002', 'pbc_5001000003'];
  for (const id of collections) {
    const col = app.findCollectionByNameOrId(id);
    col.listRule = null;
    col.viewRule = null;
    col.createRule = null;
    app.save(col);
  }
});
