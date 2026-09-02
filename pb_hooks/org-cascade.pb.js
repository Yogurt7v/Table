/// <reference path="../pb_data/types.d.ts" />

// ── Cascade delete organization data ──
// Удаляет все данные организации перед удалением самой записи.
// Порядок важен: сначала дочерние коллекции, потом счета, объекты и участники.

onRecordDelete((e) => {
  var orgId = e.record.id;

  function deleteByFilter(collection, filter) {
    var records;
    try {
      records = $app.findRecordsByFilter(collection, filter, '', 0, 0);
    } catch (err) {
      console.log('[org-cascade] find ' + collection + ' error: ' + String(err));
      return;
    }
    for (var i = 0; i < records.length; i++) {
      try {
        $app.delete(records[i]);
      } catch (err) {
        console.log('[org-cascade] delete ' + collection + ' error: ' + String(err));
      }
    }
  }

  // История изменений по каждому счету (связь только через invoice_id)
  var invoices = $app.findRecordsByFilter('invoices', 'organization_id = "' + orgId + '"', '', 0, 0);
  for (var i = 0; i < invoices.length; i++) {
    deleteByFilter('invoice_history', 'invoice_id = "' + invoices[i].getId() + '"');
  }

  // Отметки к оплате и файлы счетов
  deleteByFilter('payment_marks', 'organization_id = "' + orgId + '"');
  deleteByFilter('invoice_files', 'organization_id = "' + orgId + '"');

  // Счета
  deleteByFilter('invoices', 'organization_id = "' + orgId + '"');

  // Балансы и банковские счета
  var accounts = $app.findRecordsByFilter('bank_accounts', 'organization_id = "' + orgId + '"', '', 0, 0);
  for (var j = 0; j < accounts.length; j++) {
    deleteByFilter('balance_history', 'account_id = "' + accounts[j].getId() + '"');
  }
  deleteByFilter('bank_accounts', 'organization_id = "' + orgId + '"');

  // Объекты учёта
  deleteByFilter('accounting_objects', 'organization_id = "' + orgId + '"');

  // Уведомления и участники
  deleteByFilter('notifications', 'organization_id = "' + orgId + '"');
  deleteByFilter('organization_users', 'organization_id = "' + orgId + '"');

  e.next();
}, 'organizations');
