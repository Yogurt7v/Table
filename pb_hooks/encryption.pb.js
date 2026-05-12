/// <reference path="../pb_modules/types.d.ts" />

const KEY = $os.getenv('ENCRYPTION_KEY', 'change-me-in-production');
const FIELDS = ['counterparty', 'purpose', 'contract_no', 'invoice_no', 'amount', 'paid', 'paid_date', 'comment'];

function xorEncrypt(value) {
  if (value == null) return '';
  const str = String(value);
  let result = '';
  for (let i = 0; i < str.length; i++) {
    result += String.fromCharCode(str.charCodeAt(i) ^ KEY.charCodeAt(i % KEY.length));
  }
  return btoa(result);
}

function xorDecrypt(value) {
  if (!value) return '';
  const decoded = atob(String(value));
  let result = '';
  for (let i = 0; i < decoded.length; i++) {
    result += String.fromCharCode(decoded.charCodeAt(i) ^ KEY.charCodeAt(i % KEY.length));
  }
  return result;
}

function encryptRecord(record) {
  for (const field of FIELDS) {
    const val = record.get(field);
    if (val != null && val !== '') {
      record.set(field, xorEncrypt(val));
    }
  }
}

function decryptRecord(record) {
  for (const field of FIELDS) {
    const val = record.get(field);
    if (val != null && val !== '') {
      record.set(field, xorDecrypt(val));
    }
  }
}

onRecordBeforeCreateRequest((e) => {
  encryptRecord(e.record);
}, 'invoices');

onRecordBeforeUpdateRequest((e) => {
  encryptRecord(e.record);
}, 'invoices');

onRecordEnrich((e) => {
  decryptRecord(e.record);
}, 'invoices');
