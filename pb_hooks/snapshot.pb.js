/// <reference path="../pb_data/types.d.ts" />

cronAdd('balance-snapshot', '0 0 * * *', () => {
  const today = new Date().toISOString().slice(0, 10);
  const collection = $app.findCollectionByNameOrId('balance_history');
  const accounts = $app.findRecordsByFilter('bank_accounts', '', '', 0, 0);

  for (const acc of accounts) {
    const existing = $app.findRecordsByFilter(
      'balance_history',
      `account_id = "${acc.getId()}" && date = "${today}"`,
      '',
      1,
      0,
    );
    if (existing.length > 0) continue;

    const lastRecord = $app.findRecordsByFilter('balance_history', `account_id = "${acc.getId()}"`, '-date', 1, 0);
    const lastBalance = lastRecord.length > 0 ? lastRecord[0].get('balance') : 0;

    const record = $app.createRecord(collection, {
      account_id: acc.getId(),
      date: today,
      balance: lastBalance,
    });
    $app.saveRecord(record);
  }
});
