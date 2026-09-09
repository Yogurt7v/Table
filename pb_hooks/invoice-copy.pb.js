/// <reference path="../pb_data/types.d.ts" />

// ── Files inheritance for remainder copies ──
// Копия (original_invoice_id != '') наследует invoice_files оригинала
// без дублирования файлов: тот же файл, новая запись.
//
// Копирование выполняется в onRecordAfterCreateSuccess (после того как
// копия-счёт уже сохранена в БД). Создание записей-потомков из before-хука
// (onRecordCreate) не срабатывает корректно.
//
// ВАЖНО: в этом окружении JSVM нельзя вызывать функцию, объявленную на
// верхнем уровне, из колбэка хука — поэтому логика продублирована внутри
// каждого обработчика (см. notify.pb.js).

// ── Копия счёта создаётся → наследуем файлы оригинала ──
onRecordAfterCreateSuccess((e) => {
  try {
    var copy = e.record;
    var origId = copy.get('original_invoice_id');
    if (!origId) { return; }

    var invOrgId = copy.get('organization_id');
    var fCol = $app.findCollectionByNameOrId('invoice_files');
    var srcFiles = $app.findRecordsByFilter(
      'invoice_files',
      'invoice_id = "' + origId + '"',
      '',
      0,
      0,
    );

    // Имена уже прикреплённых файлов копии (чтобы не дублировать).
    var existing = {};
    var current = $app.findRecordsByFilter(
      'invoice_files',
      'invoice_id = "' + copy.id + '"',
      '',
      0,
      0,
    );
    for (var ci = 0; ci < current.length; ci++) {
      existing[current[ci].get('name')] = true;
    }

    for (var i = 0; i < srcFiles.length; i++) {
      try {
        var src = srcFiles[i];
        var filename = src.get('file');
        if (!filename) continue;
        if (existing[src.get('name')]) continue;

        var fs = $app.newFilesystem();
        try {
          var fileKey = fCol.id + '/' + src.id + '/' + filename;
          var reuploadableFile = fs.getReuploadableFile(fileKey, true);

          var newFile = new Record(fCol);
          newFile.set('invoice_id', copy.id);
          newFile.set('organization_id', invOrgId);
          newFile.set('name', src.get('name'));
          newFile.set('file', reuploadableFile);
          $app.save(newFile);
        } finally {
          fs.close();
        }
      } catch (err) {
        console.error('[invoices:file-copy] copy ' + copy.id + ' from ' + srcFiles[i].id + ': ' + String(err));
      }
    }
  } catch (err) {
    console.error('[invoices:file-copy] ' + String(err));
  }
}, 'invoices');

// ── Файл прикреплён к оригиналу → синхронизируем существующим копиям ──
onRecordAfterCreateSuccess((e) => {
  try {
    var fileRec = e.record;
    var invId = fileRec.get('invoice_id');
    if (!invId) { return; }

    var invoice = $app.findRecordById('invoices', invId);
    if (!invoice || invoice.get('original_invoice_id')) { return; } // сам счёт — копия

    var copies = $app.findRecordsByFilter(
      'invoices',
      'original_invoice_id = "' + invId + '"',
      '',
      0,
      0,
    );

    var fCol = $app.findCollectionByNameOrId('invoice_files');
    var filename = fileRec.get('file');

    for (var i = 0; i < copies.length; i++) {
      var copy = copies[i];
      var copyOrg = copy.get('organization_id');

      // Имена уже прикреплённых файлов копии.
      var existing = {};
      var curFiles = $app.findRecordsByFilter(
        'invoice_files',
        'invoice_id = "' + copy.id + '"',
        '',
        0,
        0,
      );
      for (var ci = 0; ci < curFiles.length; ci++) {
        existing[curFiles[ci].get('name')] = true;
      }
      if (existing[fileRec.get('name')]) continue;

      try {
        if (!filename) continue;
        var fs = $app.newFilesystem();
        try {
          var fileKey = fCol.id + '/' + fileRec.id + '/' + filename;
          var reuploadableFile = fs.getReuploadableFile(fileKey, true);

          var newFile = new Record(fCol);
          newFile.set('invoice_id', copy.id);
          newFile.set('organization_id', copyOrg);
          newFile.set('name', fileRec.get('name'));
          newFile.set('file', reuploadableFile);
          $app.save(newFile);
        } finally {
          fs.close();
        }
      } catch (err) {
        console.error('[invoices:file-copy] sync to ' + copy.id + ': ' + String(err));
      }
    }
  } catch (err) {
    console.error('[invoices:file-copy] sync ' + String(err));
  }
}, 'invoice_files');

onRecordAfterUpdateSuccess((e) => {
  try {
    var fileRec = e.record;
    var invId = fileRec.get('invoice_id');
    if (!invId) { return; }

    var invoice = $app.findRecordById('invoices', invId);
    if (!invoice || invoice.get('original_invoice_id')) { return; }

    var copies = $app.findRecordsByFilter(
      'invoices',
      'original_invoice_id = "' + invId + '"',
      '',
      0,
      0,
    );

    var fCol = $app.findCollectionByNameOrId('invoice_files');
    var filename = fileRec.get('file');

    for (var i = 0; i < copies.length; i++) {
      var copy = copies[i];
      var copyOrg = copy.get('organization_id');

      var existing = {};
      var curFiles = $app.findRecordsByFilter(
        'invoice_files',
        'invoice_id = "' + copy.id + '"',
        '',
        0,
        0,
      );
      for (var ci = 0; ci < curFiles.length; ci++) {
        existing[curFiles[ci].get('name')] = true;
      }
      if (existing[fileRec.get('name')]) continue;

      try {
        if (!filename) continue;
        var fs = $app.newFilesystem();
        try {
          var fileKey = fCol.id + '/' + fileRec.id + '/' + filename;
          var reuploadableFile = fs.getReuploadableFile(fileKey, true);

          var newFile = new Record(fCol);
          newFile.set('invoice_id', copy.id);
          newFile.set('organization_id', copyOrg);
          newFile.set('name', fileRec.get('name'));
          newFile.set('file', reuploadableFile);
          $app.save(newFile);
        } finally {
          fs.close();
        }
      } catch (err) {
        console.error('[invoices:file-copy] sync-upd to ' + copy.id + ': ' + String(err));
      }
    }
  } catch (err) {
    console.error('[invoices:file-copy] sync-upd ' + String(err));
  }
}, 'invoice_files');
