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

  try {
    var today = new Date().toISOString().slice(0, 10);
    var collection = $app.findCollectionByNameOrId('invoices');
    var invoices = $app.findRecordsByFilter(
      'invoices',
      'paid = true && payment_amounts != null',
      '',
      0,
      0,
    );

    for (var i = 0; i < invoices.length; i++) {
      try {
        var inv = invoices[i];
        var amounts = parseAmounts(inv);
        if (amounts.length === 0) continue;

        var totalPaid = 0;
        for (var j = 0; j < amounts.length; j++) {
          totalPaid = totalPaid + Number(amounts[j]);
        }
        var remaining = Number(inv.get('amount') || 0) - totalPaid;

        var rollovers = $app.findRecordsByFilter(
          'invoices',
          'original_invoice_id = "' + inv.id + '"',
          '',
          0,
          0,
        );

        if (totalPaid <= 0 || remaining <= 0) {
          for (var r = 0; r < rollovers.length; r++) {
            $app.delete(rollovers[r]);
          }
          continue;
        }

        if (rollovers.length > 0) {
          var r = rollovers[0];
          var needUpdate = false;
          if (Number(r.get('amount') || 0) !== remaining) {
            r.set('amount', remaining);
            needUpdate = true;
          }
          if (r.get('date') !== today) {
            r.set('date', today);
            needUpdate = true;
          }
          if (needUpdate) {
            $app.save(r);
          }
          for (var k = 1; k < rollovers.length; k++) {
            $app.delete(rollovers[k]);
          }

          // Копируем файлы оригинального счёта, если у rollover-записи их ещё нет
          try {
            var existingFiles = $app.findRecordsByFilter(
              'invoice_files',
              'invoice_id = "' + r.id + '"',
              '',
              0,
              0,
            );
            if (existingFiles.length === 0) {
              var origFiles = $app.findRecordsByFilter(
                'invoice_files',
                'invoice_id = "' + inv.id + '"',
                '',
                0,
                0,
              );
              var filesCol = $app.findCollectionByNameOrId('invoice_files');
              for (var f = 0; f < origFiles.length; f++) {
                try {
                  var srcKey = origFiles[f].baseFilesPath() + '/' + origFiles[f].get('file');
                  var sys = $app.newFilesystem();
                  try {
                    var reuploadable = sys.getReuploadableFile(srcKey, true);
                    var fileRec = new Record(filesCol);
                    fileRec.set('invoice_id', r.id);
                    fileRec.set('organization_id', r.get('organization_id'));
                    fileRec.set('name', origFiles[f].get('name'));
                    fileRec.set('file', reuploadable);
                    $app.save(fileRec);
                  } finally {
                    sys.close();
                  }
                } catch (err) {
                  console.log('[rollover] file copy error', String(err));
                }
              }
            }
          } catch (err) {
            console.log('[rollover] file check error', String(err));
          }
        } else {
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
          r.set('created_by', inv.get('created_by') || inv.get('updated_by') || '');
          $app.save(r);

          // Копируем файлы оригинального счёта в rollover-запись
          try {
            var origFiles = $app.findRecordsByFilter(
              'invoice_files',
              'invoice_id = "' + inv.id + '"',
              '',
              0,
              0,
            );
            var filesCol = $app.findCollectionByNameOrId('invoice_files');
            for (var f = 0; f < origFiles.length; f++) {
              try {
                var srcKey = origFiles[f].baseFilesPath() + '/' + origFiles[f].get('file');
                var sys = $app.newFilesystem();
                try {
                  var reuploadable = sys.getReuploadableFile(srcKey, true);
                  var fileRec = new Record(filesCol);
                  fileRec.set('invoice_id', r.id);
                  fileRec.set('organization_id', r.get('organization_id'));
                  fileRec.set('name', origFiles[f].get('name'));
                  fileRec.set('file', reuploadable);
                  $app.save(fileRec);
                } finally {
                  sys.close();
                }
              } catch (err) {
                console.log('[rollover] file copy error', String(err));
              }
            }
          } catch (err) {
            console.log('[rollover] file copy error', String(err));
          }
        }
      } catch (err) {
        console.log('[rollover] invoice error', String(err));
      }
    }
  } catch (err) {
    console.log('[rollover] fatal', String(err));
  }
});
