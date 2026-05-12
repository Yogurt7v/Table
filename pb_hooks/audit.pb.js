/// <reference path="../pb_modules/types.d.ts" />

const KEY = $os.getenv('ENCRYPTION_KEY', 'change-me-in-production');
const FIELDS = ['counterparty', 'purpose', 'contract_no', 'invoice_no', 'amount', 'paid', 'paid_date', 'comment'];

function xorDecrypt(value) {
  if (!value) return '';
  const decoded = atob(String(value));
  let result = '';
  for (let i = 0; i < decoded.length; i++) {
    result += String.fromCharCode(decoded.charCodeAt(i) ^ KEY.charCodeAt(i % KEY.length));
  }
  return result;
}

function decryptRecord(record) {
  const decrypted = {};
  for (const field of FIELDS) {
    const val = record.get(field);
    decrypted[field] = val != null && val !== '' ? xorDecrypt(val) : val;
  }
  decrypted.seq = record.get('seq');
  return decrypted;
}

function getAuthor(e) {
  const admin = e.httpContext?.get('admin');
  if (admin) return admin.email || 'admin';
  const user = e.httpContext?.get('authRecord');
  return user ? (user.get('email') || user.getId()) : 'system';
}

onRecordBeforeUpdateRequest((e) => {
  const record = e.record;
  const original = record.originalCopy();
  if (!original) return;

  const oldData = decryptRecord(original);
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
