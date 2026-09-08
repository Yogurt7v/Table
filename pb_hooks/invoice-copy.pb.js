/// <reference path="../pb_data/types.d.ts" />

// ── Clone files from the original invoice to its remainder copy ──
// Копия (original_invoice_id != '') наследует invoice_files оригинала
// без дублирования файлов: тот же файл, новая запись.

onRecordCreate((e) => {
  try {
    var copy = e.record;
    var origId = copy.get('original_invoice_id');
    if (!origId) { e.next(); return; }

    var fCol = $app.findCollectionByNameOrId('invoice_files');
    var srcFiles = $app.findRecordsByFilter(
      'invoice_files',
      'invoice_id = "' + origId + '"',
      '',
      0,
      0,
    );

    for (var i = 0; i < srcFiles.length; i++) {
      try {
        var src = srcFiles[i];
        var filename = src.get('file');
        if (!filename) continue;

        var fs = $app.newFilesystem();
        var fileKey = fCol.id + '/' + src.id + '/' + filename;
        var reuploadableFile = fs.getReuploadableFile(fileKey, true);

        var newFile = new Record(fCol);
        newFile.set('invoice_id', copy.id);
        newFile.set('organization_id', copy.get('organization_id'));
        newFile.set('name', src.get('name'));
        newFile.set('file', reuploadableFile);
        $app.save(newFile);
        fs.close();
      } catch (err) {
        console.error('[invoices:file-copy] invoice ' + copy.id + ': ' + String(err));
      }
    }
  } catch (err) {
    console.error('[invoices:file-copy] ' + String(err));
  }

  e.next();
}, 'invoices');