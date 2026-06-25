/// <reference path="../pb_data/types.d.ts" />

cronAdd('invoice-rollover', '* * * * *', function () {
  function parseAmounts(inv) {
    var raw = inv.get('payment_amounts');
    var str = '';
    if (typeof raw === 'string') {
      str = raw;
    } else if (raw && typeof raw === 'object' && typeof raw.length === 'number') {
      for (var k = 0; k < raw.length; k++) str = str + String.fromCharCode(raw[k]);
    }
    return str ? JSON.parse(str) : [];
  }

  function dateToStr(d) {
    if (!d) return '';
    if (typeof d === 'string') return d.slice(0, 10);
    return String(d).slice(0, 10);
  }

  function eachDay(fromDate, toDate, fn) {
    var d = new Date(fromDate + 'T00:00:00Z');
    var end = new Date(toDate + 'T00:00:00Z');
    while (d <= end) {
      fn(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
  }

  try {
    var today = new Date().toISOString().slice(0, 10);
    var collection = $app.findCollectionByNameOrId('invoices');
    var invoices = $app.findRecordsByFilter('invoices', 'paid = true && payment_amounts != null', '', 0, 0);

    for (var i = 0; i < invoices.length; i++) {
      try {
        var inv = invoices[i];
        var amounts = parseAmounts(inv);
        if (amounts.length === 0) continue;

        var totalPaid = 0;
        for (var j = 0; j < amounts.length; j++) totalPaid = totalPaid + Number(amounts[j]);
        var remaining = Number(inv.get('amount') || 0) - totalPaid;
        var invDate = dateToStr(inv.get('date'));

        var rollovers = $app.findRecordsByFilter('invoices', 'original_invoice_id = "' + inv.id + '"', '', 0, 0);

        if (remaining <= 0) {
          for (var r = 0; r < rollovers.length; r++) $app.delete(rollovers[r]);
          continue;
        }

        var byDate = {};
        for (var r = 0; r < rollovers.length; r++) {
          byDate[dateToStr(rollovers[r].get('date'))] = rollovers[r];
        }

        eachDay(invDate, today, function (dateStr) {
          try {
            if (dateStr === invDate) return;
            if (byDate[dateStr]) {
              var r = byDate[dateStr];
              if (Number(r.get('amount') || 0) !== remaining) {
                r.set('amount', remaining);
                $app.save(r);
              }
              delete byDate[dateStr];
            } else {
              var r = new Record(collection);
              r.set('organization_id', inv.get('organization_id'));
              r.set('accounting_object_id', inv.get('accounting_object_id'));
              r.set('date', dateStr);
              r.set('counterparty', inv.get('counterparty'));
              r.set('purpose', inv.get('purpose'));
              r.set('contract_no', inv.get('contract_no'));
              r.set('invoice_no', inv.get('invoice_no'));
              r.set('amount', remaining);
              r.set('paid', false);
              r.set('comment', inv.get('comment'));
              r.set('original_invoice_id', inv.id);
              $app.save(r);
            }
          } catch (err) {
            console.log('[rollover] eachDay error', String(err));
          }
        });

        for (var dateKey in byDate) {
          if (byDate.hasOwnProperty(dateKey)) $app.delete(byDate[dateKey]);
        }
      } catch (err) {
        console.log('[rollover] invoice error', String(err));
      }
    }
  } catch (err) {
    console.log('[rollover] fatal', String(err));
  }
});
