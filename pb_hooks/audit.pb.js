/// <reference path="../pb_modules/types.d.ts" />

function getAuthor(e) {
  const admin = e.httpContext?.get('admin');
  if (admin) return admin.email || 'admin';
  const user = e.httpContext?.get('authRecord');
  return user ? (user.get('email') || user.getId()) : 'system';
}

onRecordUpdateRequest((e) => {
  const record = e.record;
  const original = record.originalCopy();
  if (!original) return;

  const oldData = {};
  const fields = ['counterparty', 'purpose', 'contract_no', 'invoice_no', 'amount', 'paid', 'paid_date', 'comment', 'seq'];
  for (const field of fields) {
    oldData[field] = original.get(field);
  }

  const author = getAuthor(e);
  const collection = $app.dao().findCollectionByNameOrId('invoice_history');

  const newHistory = $app.dao().createRecord(collection, {
    invoice_id: record.getId(),
    author: author,
    changed_at: new Date().toISOString(),
    previous_data: JSON.stringify(oldData),
  });

  $app.dao().saveRecord(newHistory);
}, 'invoices');
