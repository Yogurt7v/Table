/// <reference path="../pb_data/types.d.ts" />

onRecordCreate((e) => {
  const record = e.record;

  // Если seq > 0 — значит был явно указан, не трогаем
  if (record.get('seq') > 0) {
    e.next();
    return;
  }

  const orgId = record.get('organization_id');
  const date = record.get('date');
  if (!orgId || !date) {
    e.next();
    return;
  }

  const records = $app.findRecordsByFilter(
    'invoices',
    `organization_id = "${orgId}" && date = "${date}"`,
    '-seq',
    1,
    0,
  );

  const maxSeq = records.length > 0 ? parseInt(records[0].get('seq') || '0', 10) : 0;
  record.set('seq', maxSeq + 1);

  e.next();
}, 'invoices');
