/// <reference path="../pb_data/types.d.ts" />

// Fix access rules for the user_settings collection.
// On some environments the collection was created with null (no-access)
// rules, which made the frontend column-settings save fail with 400
// "Failed to create record." (empty data). This migration idempotently
// restores the intended rules.

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('pbc_4198132680');
    col.createRule = "@request.auth.id != ''";
    col.listRule = "@request.auth.id != '' && user_id = @request.auth.id";
    col.viewRule = "@request.auth.id != '' && user_id = @request.auth.id";
    col.updateRule = "@request.auth.id != '' && user_id = @request.auth.id";
    col.deleteRule = "@request.auth.id != '' && user_id = @request.auth.id";
    app.save(col);
  },
  (app) => {
    const col = app.findCollectionByNameOrId('pbc_4198132680');
    col.createRule = null;
    col.listRule = null;
    col.viewRule = null;
    col.updateRule = null;
    col.deleteRule = null;
    app.save(col);
  },
);
