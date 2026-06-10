/// <reference path="../pb_data/types.d.ts" />

cronAdd('invoice-rollover', '0 * * * *', function () {
  var today = new Date().toISOString().slice(0, 10);
  var collection = $app.findCollectionByNameOrId('invoices');
  var invoices = $app.findRecordsByFilter('invoices', 'paid = true && payment_amounts != null', '', 0, 0);
  var created = 0;

  for (var i = 0; i < invoices.length; i++) {
    var inv = invoices[i];

    // payment_amounts is returned as byte array — convert to parseable string
    var raw = inv.get('payment_amounts');
    var str = '';
    if (typeof raw === 'string') {
      str = raw;
    } else if (raw && typeof raw === 'object' && typeof raw.length === 'number') {
      for (var k = 0; k < raw.length; k++) str = str + String.fromCharCode(raw[k]);
    }
    var amounts = str ? JSON.parse(str) : [];
    if (amounts.length === 0) continue;

    var totalPaid = 0;
    for (var j = 0; j < amounts.length; j++) totalPaid = totalPaid + Number(amounts[j]);
    var remaining = Number(inv.get('amount') || 0) - totalPaid;
    if (remaining <= 0) continue;

    var dup = $app.findRecordsByFilter('invoices', 'original_invoice_id = "' + inv.id + '" && date = "' + today + '"', '', 1, 0);
    if (dup.length > 0) continue;

    var r = new Record(collection);
    r.set('organization_id', inv.get('organization_id'));
    r.set('accounting_object_id', inv.get('accounting_object_id'));
    r.set('date', today);
    r.set('counterparty', inv.get('counterparty'));
    r.set('purpose', inv.get('purpose'));
    r.set('contract_no', inv.get('contract_no'));
    r.set('invoice_no', inv.get('invoice_no'));
    r.set('amount', remaining);
    r.set('paid', false);
    r.set('comment', inv.get('comment'));
    r.set('original_invoice_id', inv.id);
    $app.save(r);
    created++;
  }

  console.log('[rollover] Created ' + created + ' rollover invoices for ' + today);
});
