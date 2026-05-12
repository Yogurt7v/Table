/// <reference path="../pb_modules/types.d.ts" />

// ════════════════════════════════════════════════════════════════
// TODO: включить шифрование перед деплоем (Phase 15: Docker)
// ════════════════════════════════════════════════════════════════
// 
// const KEY = $os.getenv('ENCRYPTION_KEY', 'change-me-in-production');
// const FIELDS = ['counterparty', 'purpose', 'contract_no', 'invoice_no', 'comment', 'paid_date'];
// 
// function xorEncrypt(value) { ... }
// function xorDecrypt(value) { ... }
// function encryptRecord(record) { ... }
// function decryptRecord(record) { ... }
// 
// onRecordBeforeCreateRequest((e) => { encryptRecord(e.record); }, 'invoices');
// onRecordBeforeUpdateRequest((e) => { encryptRecord(e.record); }, 'invoices');
// onRecordEnrich((e) => { decryptRecord(e.record); }, 'invoices');
