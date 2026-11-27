/// <reference path="../pb_data/types.d.ts" />

// ── Files inheritance for remainder copies ──
// Копия (original_invoice_id != '') наследует invoice_files оригинала
// без дублирования файлов: тот же файл, новая запись.
//
// Копирование выполняется в onRecordAfterCreateSuccess (после того как
// копия-счёт уже сохранена в БД). Создание записей-потомков из before-хука
// (onRecordCreate) не срабатывает корректно.
//
// Надёжность: H1+H2+H4 — повторы копирования, сбор ошибок, уведомление
// пользователю после исчерпания попыток; дедуп по name+size.
//
// ВАЖНО: в этом окружении JSVM нельзя вызывать функцию, объявленную на
// верхнем уровне, из колбэка хука — поэтому логика продублирована внутри
// каждого обработчика (см. notify.pb.js).

// ── Копия счёта создаётся → наследуем файлы оригинала ──
onRecordAfterCreateSuccess((e) => {
  try {
    var copy = e.record;
    var origId = copy.get('original_invoice_id');
    if (!origId) {
      return;
    }

    var invOrgId = copy.get('organization_id');
    var fCol = $app.findCollectionByNameOrId('invoice_files');
    var srcFiles = $app.findRecordsByFilter(
      'invoice_files',
      'invoice_id = "' + origId + '" && is_deleted != true',
      '',
      0,
      0,
    );

    function fileDedupKey(name, size) {
      return String(name || '') + '::' + String(size == null ? '' : size);
    }

    function getFileSize(fileCollectionId, recordId, filename) {
      var fs = $app.newFilesystem();
      try {
        var attrs = fs.attributes(fileCollectionId + '/' + recordId + '/' + filename);
        return attrs && typeof attrs.size === 'number' ? attrs.size : -1;
      } catch (_) {
        return -1;
      } finally {
        fs.close();
      }
    }

    function buildExistingMap(invoiceId) {
      var existing = {};
      var current = $app.findRecordsByFilter(
        'invoice_files',
        'invoice_id = "' + invoiceId + '" && is_deleted != true',
        '',
        0,
        0,
      );
      for (var ci = 0; ci < current.length; ci++) {
        var cur = current[ci];
        var curName = cur.get('name');
        var curFile = cur.get('file');
        if (!curFile) continue;
        var curSize = getFileSize(fCol.id, cur.id, curFile);
        existing[fileDedupKey(curName, curSize)] = true;
        // Фолбэк по имени, если размер не удалось получить.
        if (curSize < 0) existing[fileDedupKey(curName, -1)] = true;
      }
      return existing;
    }

    function copyOneFile(src, targetInvoiceId, targetOrgId, existingMap) {
      var filename = src.get('file');
      var srcName = src.get('name') || filename || 'файл';
      if (!filename) return { ok: false, name: srcName, error: 'empty filename' };

      var srcSize = getFileSize(fCol.id, src.id, filename);
      var key = fileDedupKey(srcName, srcSize);
      var nameOnlyKey = fileDedupKey(srcName, -1);
      if (existingMap[key] || (srcSize < 0 && existingMap[nameOnlyKey])) {
        return { ok: true, skipped: true, name: srcName };
      }

      var maxAttempts = 3;
      var lastErr = null;
      for (var attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          var fs = $app.newFilesystem();
          try {
            var fileKey = fCol.id + '/' + src.id + '/' + filename;
            var reuploadableFile = fs.getReuploadableFile(fileKey, true);
            var newFile = new Record(fCol);
            newFile.set('invoice_id', targetInvoiceId);
            newFile.set('organization_id', targetOrgId);
            newFile.set('name', srcName);
            newFile.set('file', reuploadableFile);
            $app.save(newFile);
            existingMap[key] = true;
            existingMap[nameOnlyKey] = true;
            return { ok: true, name: srcName };
          } finally {
            fs.close();
          }
        } catch (err) {
          lastErr = err;
          console.error(
            '[invoices:file-copy] attempt ' +
              attempt +
              '/' +
              maxAttempts +
              ' copy=' +
              targetInvoiceId +
              ' src=' +
              src.id +
              ' name=' +
              srcName +
              ': ' +
              String(err),
          );
        }
      }
      return { ok: false, name: srcName, error: String(lastErr) };
    }

    function notifyCopyFailure(targetInvoice, failedNames, context) {
      var actorId = String(
        targetInvoice.get('created_by') || targetInvoice.get('updated_by') || '',
      );
      var orgId = String(targetInvoice.get('organization_id') || '');
      if (!actorId || !orgId) {
        console.error(
          '[invoices:file-copy][LOUD] cannot notify: missing actor/org ' +
            context +
            ' actor=' +
            actorId +
            ' org=' +
            orgId +
            ' failed=' +
            failedNames.join(', '),
        );
        return;
      }

      var actorName = 'Пользователь';
      try {
        actorName =
          require(__hooks + '/lib-actor.js').resolveActorName($app, [actorId]) || actorName;
      } catch (_) {}

      var uniqueNames = [];
      var seenNames = {};
      for (var ni = 0; ni < failedNames.length; ni++) {
        var n = String(failedNames[ni] || 'файл');
        if (seenNames[n]) continue;
        seenNames[n] = true;
        uniqueNames.push(n);
      }
      var eventText =
        'Не удалось скопировать файлы в копию счёта: ' +
        uniqueNames.join(', ') +
        '. Прикрепите их вручную.';
      var messageText = eventText;

      var maxAttempts = 3;
      var lastErr = null;
      for (var attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          var notifCol = $app.findCollectionByNameOrId('notifications');
          var notifRec = new Record(notifCol);
          notifRec.set('organization_id', orgId);
          notifRec.set('user_id', actorId);
          notifRec.set('invoice_id', targetInvoice.id);
          notifRec.set('type', 'invoice_file_copy_failed');
          notifRec.set('event', eventText);
          notifRec.set('message', messageText);
          notifRec.set('actor_name', actorName);
          notifRec.set('read', false);
          $app.save(notifRec);
          console.error(
            '[invoices:file-copy][NOTIFIED] ' + context + ' failed=' + uniqueNames.join(', '),
          );
          return;
        } catch (err) {
          lastErr = err;
          console.error(
            '[invoices:file-copy] notify attempt ' +
              attempt +
              '/' +
              maxAttempts +
              ' ' +
              context +
              ': ' +
              String(err),
          );
        }
      }
      console.error(
        '[invoices:file-copy][LOUD] NOTIFICATION FAILED after ' +
          maxAttempts +
          ' attempts. ' +
          context +
          ' actor=' +
          actorId +
          ' org=' +
          orgId +
          ' failed=' +
          uniqueNames.join(', ') +
          ' lastError=' +
          String(lastErr),
      );
    }

    var existing = buildExistingMap(copy.id);
    var failed = [];
    for (var i = 0; i < srcFiles.length; i++) {
      var result = copyOneFile(srcFiles[i], copy.id, invOrgId, existing);
      if (!result.ok) failed.push(result.name);
    }

    if (failed.length > 0) {
      notifyCopyFailure(copy, failed, 'copy=' + copy.id + ' source=' + origId);
    }
  } catch (err) {
    console.error('[invoices:file-copy][LOUD] ' + String(err));
  }
}, 'invoices');

// ── Файл прикреплён к оригиналу → синхронизируем существующим копиям ──
onRecordAfterCreateSuccess((e) => {
  try {
    var fileRec = e.record;
    var invId = fileRec.get('invoice_id');
    if (!invId) {
      return;
    }

    var invoice = $app.findRecordById('invoices', invId);
    if (!invoice || invoice.get('original_invoice_id')) {
      return;
    } // сам счёт — копия

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

    function fileDedupKey(name, size) {
      return String(name || '') + '::' + String(size == null ? '' : size);
    }
    function getFileSize(fileCollectionId, recordId, fname) {
      var sfs = $app.newFilesystem();
      try {
        var attrs = sfs.attributes(fileCollectionId + '/' + recordId + '/' + fname);
        return attrs && typeof attrs.size === 'number' ? attrs.size : -1;
      } catch (_) {
        return -1;
      } finally {
        sfs.close();
      }
    }
    var existing = {};
    var curFiles = $app.findRecordsByFilter(
      'invoice_files',
      'invoice_id = "' + copy.id + '" && is_deleted != true',
      '',
      0,
      0,
    );
    for (var ci = 0; ci < curFiles.length; ci++) {
      var cur = curFiles[ci];
      var curFile = cur.get('file');
      if (!curFile) continue;
      var curSize = getFileSize(fCol.id, cur.id, curFile);
      existing[fileDedupKey(cur.get('name'), curSize)] = true;
      if (curSize < 0) existing[fileDedupKey(cur.get('name'), -1)] = true;
    }
    var srcName = fileRec.get('name') || filename || 'файл';
    var srcSize = getFileSize(fCol.id, fileRec.id, filename);
    var key = fileDedupKey(srcName, srcSize);
    if (existing[key] || (srcSize < 0 && existing[fileDedupKey(srcName, -1)])) continue;

    var copied = false;
    var lastErr = null;
    for (var attempt = 1; attempt <= 3; attempt++) {
      try {
        var fs = $app.newFilesystem();
        try {
          var fileKey = fCol.id + '/' + fileRec.id + '/' + filename;
          var reuploadableFile = fs.getReuploadableFile(fileKey, true);
          var newFile = new Record(fCol);
          newFile.set('invoice_id', copy.id);
          newFile.set('organization_id', copyOrg);
          newFile.set('name', srcName);
          newFile.set('file', reuploadableFile);
          $app.save(newFile);
          copied = true;
          break;
        } finally {
          fs.close();
        }
      } catch (err) {
        lastErr = err;
        console.error(
          '[invoices:file-copy] sync attempt ' +
            attempt +
            '/3 to=' +
            copy.id +
            ' name=' +
            srcName +
            ': ' +
            String(err),
        );
      }
    }
    if (!copied) {
      console.error(
        '[invoices:file-copy][LOUD] sync failed copy=' +
          copy.id +
          ' name=' +
          srcName +
          ' err=' +
          String(lastErr),
      );
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
    if (!invId) {
      return;
    }

    var invoice = $app.findRecordById('invoices', invId);
    if (!invoice || invoice.get('original_invoice_id')) {
      return;
    }

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

    function fileDedupKey(name, size) {
      return String(name || '') + '::' + String(size == null ? '' : size);
    }
    function getFileSize(fileCollectionId, recordId, fname) {
      var sfs = $app.newFilesystem();
      try {
        var attrs = sfs.attributes(fileCollectionId + '/' + recordId + '/' + fname);
        return attrs && typeof attrs.size === 'number' ? attrs.size : -1;
      } catch (_) {
        return -1;
      } finally {
        sfs.close();
      }
    }
    var existing = {};
    var curFiles = $app.findRecordsByFilter(
      'invoice_files',
      'invoice_id = "' + copy.id + '" && is_deleted != true',
      '',
      0,
      0,
    );
    for (var ci = 0; ci < curFiles.length; ci++) {
      var cur = curFiles[ci];
      var curFile = cur.get('file');
      if (!curFile) continue;
      var curSize = getFileSize(fCol.id, cur.id, curFile);
      existing[fileDedupKey(cur.get('name'), curSize)] = true;
      if (curSize < 0) existing[fileDedupKey(cur.get('name'), -1)] = true;
    }
    var srcName = fileRec.get('name') || filename || 'файл';
    var srcSize = getFileSize(fCol.id, fileRec.id, filename);
    var key = fileDedupKey(srcName, srcSize);
    if (existing[key] || (srcSize < 0 && existing[fileDedupKey(srcName, -1)])) continue;

    var copied = false;
    var lastErr = null;
    for (var attempt = 1; attempt <= 3; attempt++) {
      try {
        var fs = $app.newFilesystem();
        try {
          var fileKey = fCol.id + '/' + fileRec.id + '/' + filename;
          var reuploadableFile = fs.getReuploadableFile(fileKey, true);
          var newFile = new Record(fCol);
          newFile.set('invoice_id', copy.id);
          newFile.set('organization_id', copyOrg);
          newFile.set('name', srcName);
          newFile.set('file', reuploadableFile);
          $app.save(newFile);
          copied = true;
          break;
        } finally {
          fs.close();
        }
      } catch (err) {
        lastErr = err;
        console.error(
          '[invoices:file-copy] sync-upd attempt ' +
            attempt +
            '/3 to=' +
            copy.id +
            ' name=' +
            srcName +
            ': ' +
            String(err),
        );
      }
    }
    if (!copied) {
      console.error(
        '[invoices:file-copy][LOUD] sync-upd failed copy=' +
          copy.id +
          ' name=' +
          srcName +
          ' err=' +
          String(lastErr),
      );
    }
    }
  } catch (err) {
    console.error('[invoices:file-copy] sync-upd ' + String(err));
  }
}, 'invoice_files');
