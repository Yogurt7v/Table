/// <reference path="../pb_data/types.d.ts" />

function isoDate(value) {
  return value ? String(value).slice(0, 10) : '';
}

function resolveName(app, ids) {
  try {
    return require(__hooks + '/lib-actor.js').resolveActorName(app, ids || []);
  } catch (_) {
    return '';
  }
}

function findRootInvoice(app, invoice) {
  var current = invoice;
  for (var i = 0; i < 20; i++) {
    var parentId = current.get('original_invoice_id');
    if (!parentId) break;
    try {
      var parent = app.findRecordById('invoices', String(parentId));
      if (!parent) break;
      current = parent;
    } catch (_) {
      break;
    }
  }
  return current;
}

function findActiveDocument(app, rootId) {
  var records = app.findRecordsByFilter(
    'documents',
    'source_invoice_id = "' + rootId + '" && is_deleted != true',
    '-created',
    1,
    0,
  );
  return records.length > 0 ? records[0] : null;
}

function findActiveAutoDocument(app, rootId) {
  var records = app.findRecordsByFilter(
    'documents',
    'source_invoice_id = "' + rootId + '" && creation_mode = "auto" && is_deleted != true',
    '-created',
    1,
    0,
  );
  return records.length > 0 ? records[0] : null;
}

function nextSeq(app, organizationId, objectId) {
  var records = app.findRecordsByFilter(
    'documents',
    'organization_id = "' + organizationId + '" && accounting_object_id = "' + objectId + '"',
    '-seq',
    1,
    0,
  );
  var max = records.length > 0 ? parseInt(records[0].get('seq') || '0', 10) : 0;
  return max + 1;
}

function actorIdFrom(e, invoice) {
  if (e && e.auth) return e.auth.id;
  return invoice.get('updated_by') || invoice.get('created_by') || '';
}

function actorNameFrom(app, e, invoice, actorId) {
  if (e && e.auth) {
    var name = e.auth.get('name') || e.auth.get('login') || e.auth.get('email') || '';
    if (name) return name;
  }
  return resolveName(app, [
    actorId,
    invoice.get('updated_by'),
    invoice.get('created_by'),
  ]);
}

function writeHistory(app, document, type, data, actorId, actorName) {
  try {
    var collection = app.findCollectionByNameOrId('document_history');
    var record = new Record(collection);
    record.set('document_id', document.id);
    record.set('organization_id', document.get('organization_id'));
    record.set('author', actorId);
    record.set('author_name', actorName || '');
    record.set('changed_at', new Date().toISOString());
    record.set('type', type);
    record.set('previous_data', data || {});
    app.save(record);
  } catch (err) {
    console.error('[documents:history]', String(err));
  }
}

function applyInvoiceFields(document, invoice, root) {
  var changed = false;
  var values = {
    payment_date: isoDate(invoice.get('paid_date') || invoice.get('date')),
    counterparty: String(root.get('counterparty') || invoice.get('counterparty') || ''),
    purpose: String(root.get('purpose') || ''),
    contract_no: String(root.get('contract_no') || ''),
    invoice_no: String(root.get('invoice_no') || ''),
    amount: Number(root.get('amount')) || 0,
    source_invoice_id: root.id,
    source_invoice_no: String(root.get('invoice_no') || ''),
  };

  for (var key in values) {
    var current = document.get(key);
    if (current === null || current === undefined) current = '';
    var next = values[key];
    if (next === null || next === undefined) next = '';
    if (String(current) !== String(next)) {
      document.set(key, values[key]);
      changed = true;
    }
  }
  return changed;
}

function createAutoDocument(app, e, invoice, root, actorId, actorName) {
  var collection = app.findCollectionByNameOrId('documents');
  var document = new Record(collection);
  var organizationId = invoice.get('organization_id');
  var objectId = root.get('accounting_object_id') || invoice.get('accounting_object_id');
  var responsibleId = root.get('created_by') || invoice.get('created_by') || actorId;

  if (!organizationId || !objectId || !responsibleId) {
    console.error('[documents:create] missing required relation for invoice ' + invoice.id);
    return null;
  }

  document.set('organization_id', organizationId);
  document.set('accounting_object_id', objectId);
  document.set('seq', nextSeq(app, organizationId, objectId));
  document.set('payment_date', isoDate(invoice.get('paid_date') || invoice.get('date')));
  document.set('counterparty', String(root.get('counterparty') || invoice.get('counterparty') || ''));
  document.set('purpose', String(root.get('purpose') || ''));
  document.set('contract_no', String(root.get('contract_no') || ''));
  document.set('invoice_no', String(root.get('invoice_no') || ''));
  document.set('amount', Number(root.get('amount')) || 0);
  document.set('responsible_id', responsibleId);
  document.set('responsible_name', resolveName(app, [responsibleId]));
  document.set('created_by', actorId || responsibleId);
  document.set('created_by_name', actorName || resolveName(app, [actorId || responsibleId]));
  document.set('source_invoice_id', root.id);
  document.set('source_invoice_no', String(root.get('invoice_no') || ''));
  document.set('creation_mode', 'auto');
  document.set('sync_locked', false);
  document.set('provided', false);
  document.set('confirmed', false);
  document.set('payment_cancelled', false);
  document.set('is_deleted', false);
  app.save(document);
  writeHistory(app, document, 'document_auto_created', {
    source_invoice_id: root.id,
    source_invoice_no: root.get('invoice_no') || '',
    amount: Number(root.get('amount')) || 0,
  }, actorId, actorName);
  return document;
}

function cancelPayment(app, e, document, actorId, actorName) {
  var files = app.findRecordsByFilter(
    'document_files',
    'document_id = "' + document.id + '"',
    '',
    1,
    0,
  );
  var comments = app.findRecordsByFilter(
    'document_comments',
    'document_id = "' + document.id + '"',
    '',
    1,
    0,
  );
  var hasActivity =
    files.length > 0 ||
    comments.length > 0 ||
    document.get('sync_locked') === true ||
    document.get('provided') === true ||
    document.get('confirmed') === true;

  if (!hasActivity) {
    document.set('is_deleted', true);
    document.set('deleted_by', actorId);
    document.set('deleted_by_name', actorName || '');
    document.set('deleted_at', new Date().toISOString());
    document.set('deletion_reason', 'Оплата отменена');
    document.set('payment_cancelled', true);
    app.save(document);
    writeHistory(app, document, 'document_archived', {
      reason: 'Оплата отменена',
      automatic: true,
    }, actorId, actorName);
    try {
      require(__hooks + '/lib-document-notify.js').notifyDocument(
        app,
        document,
        'document_archived',
        'Документ удалён в архив: ' + String(document.get('counterparty') || '') + ' — Оплата отменена',
        actorId,
        actorName,
      );
    } catch (notifyErr) {
      console.error('[documents:notify-cancel]', String(notifyErr));
    }
    return;
  }

  document.set('payment_cancelled', true);
  document.set('provided', false);
  document.set('confirmed', false);
  document.set('confirmed_file_id', '');
  app.save(document);
  writeHistory(app, document, 'payment_cancelled', {
    automatic: true,
  }, actorId, actorName);
  try {
    require(__hooks + '/lib-document-notify.js').notifyDocument(
      app,
      document,
      'document_payment_cancelled',
      'Оплата отменена: ' + String(document.get('counterparty') || ''),
      actorId,
      actorName,
    );
  } catch (notifyErr) {
    console.error('[documents:notify-cancel]', String(notifyErr));
  }
}

function handleInvoice(app, e, invoice, oldPaid) {
  var paid = invoice.get('paid') === true;
  var root = findRootInvoice(app, invoice);
  var active = findActiveDocument(app, root.id);
  var existing = findActiveAutoDocument(app, root.id);
  var actorId = actorIdFrom(e, invoice);
  var actorName = actorNameFrom(app, e, invoice, actorId);

  if (paid && oldPaid !== true) {
    if (!active) {
      // D38: any live document on the chain (auto or manual) suppresses auto-create.
      existing = createAutoDocument(app, e, invoice, root, actorId, actorName);
      active = existing;
    } else if (active.get('payment_cancelled') === true) {
      active.set('payment_cancelled', false);
      app.save(active);
      writeHistory(app, active, 'payment_resumed', { automatic: true }, actorId, actorName);
      existing = active.get('creation_mode') === 'auto' ? active : existing;
    }
  }

  if (paid && existing && existing.get('sync_locked') !== true) {
    if (applyInvoiceFields(existing, invoice, root)) {
      app.save(existing);
      writeHistory(app, existing, 'document_synced', {
        source_invoice_id: root.id,
        automatic: true,
      }, actorId, actorName);
    }
  }

  if (!paid && oldPaid === true && active && active.get('is_deleted') !== true) {
    cancelPayment(app, e, active, actorId, actorName);
  }
}

module.exports = { handleInvoice: handleInvoice };
