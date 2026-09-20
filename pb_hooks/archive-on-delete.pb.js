/// <reference path="../pb_data/types.d.ts" />

// ── Archive invoice on delete (safety net) ──
// The frontend handles archiving for normal deletions.
// This hook is a fallback for API calls or cascade deletes.

onRecordDeleteRequest((e) => {
  var invoice = e.record;

  if (invoice.get('original_invoice_id')) {
    e.next();
    return;
  }

  try {
    var existing = $app.findRecordsByFilter(
      'deleted_invoices',
      'original_id = "' + invoice.id + '"',
      '',
      1,
      0,
    );
    if (existing.length > 0) {
      e.next();
      return;
    }

    var authId = e.auth ? e.auth.id : '';

    var fields = [
      'organization_id', 'accounting_object_id', 'date', 'seq',
      'counterparty', 'purpose', 'contract_no', 'invoice_no',
      'amount', 'paid', 'paid_date', 'paid_amount', 'payment_amounts',
      'comment', 'copy_comments', 'created_by', 'updated_by',
      'created_by_name', 'updated_by_name',
      'original_invoice_id', 'source_paid_amount', 'source_paid_date',
      'source_created',
    ];

    var deletedCol = $app.findCollectionByNameOrId('deleted_invoices');
    var deletedRec = new Record(deletedCol);

    for (var i = 0; i < fields.length; i++) {
      var val = invoice.get(fields[i]);
      if (val !== undefined && val !== null) {
        deletedRec.set(fields[i], val);
      }
    }

    deletedRec.set('original_id', invoice.id);
    deletedRec.set('deleted_by', authId);
    var deletedByName = '';
    if (e.auth) {
      deletedByName = e.auth.get('name') || e.auth.get('email') || '';
    }
    deletedRec.set('deleted_by_name', deletedByName);
    deletedRec.set('deleted_at', new Date().toISOString());
    $app.save(deletedRec);
  } catch (err) {
    console.error('[archive-on-delete]', String(err));
  }

  e.next();
}, 'invoices');
