/// <reference path="../pb_data/types.d.ts" />

onRecordAfterCreateSuccess((e) => {
  try {
    var lib = require(__hooks + '/lib-documents.js');
    lib.handleInvoice($app, e, e.record, null);
  } catch (err) {
    console.error('[documents:create]', String(err));
  }
}, 'invoices');

onRecordAfterUpdateSuccess((e) => {
  try {
    var old = null;
    try {
      old = e.record.original();
    } catch (_) {
      old = null;
    }
    var oldPaid = old ? old.get('paid') === true : null;
    var lib = require(__hooks + '/lib-documents.js');
    lib.handleInvoice($app, e, e.record, oldPaid);
  } catch (err) {
    console.error('[documents:update]', String(err));
  }
}, 'invoices');
