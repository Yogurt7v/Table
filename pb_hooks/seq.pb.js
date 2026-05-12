/// <reference path="../pb_modules/types.d.ts" />

onRecordBeforeCreateRequest((e) => {
  const record = e.record;
  if (record.get('seq') != null && record.get('seq') !== '') return;

  const orgId = record.get('organization_id');
  const date = record.get('date');
  if (!orgId || !date) return;

  const records = $app.dao().findRecordsByFilter(
    'invoices',
    `organization_id = "${orgId}" && date = "${date}"`,
    '-seq',
    1,
    0,
  );

  const maxSeq = records.length > 0 ? parseInt(records[0].get('seq') || '0', 10) : 0;
  record.set('seq', maxSeq + 1);
}, 'invoices');
