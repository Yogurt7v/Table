/// <reference path="../pb_data/types.d.ts" />

// ── Fill actor fields on request ──

// `created_by`/`updated_by` store an id that stops resolving once the user is
// deleted, and never resolves for superusers (absent from `users`). The matching
// `*_by_name` fields snapshot the display name alongside the id so the
// "Инициатор" column survives both cases.

onRecordCreateRequest((e) => {
  if (e.auth) {
    e.record.set('created_by', e.auth.id);
    e.record.set('created_by_name', e.auth.get('name') || e.auth.get('login') || e.auth.get('email') || '');
  }
  e.next();
}, 'invoices');

onRecordUpdateRequest((e) => {
  if (e.auth) {
    e.record.set('updated_by', e.auth.id);
    e.record.set('updated_by_name', e.auth.get('name') || e.auth.get('login') || e.auth.get('email') || '');
  }
  e.next();
}, 'invoices');

// ── Invoice Created (seq + notification) ──

onRecordCreate((e) => {
  // --- Seq auto-numbering ---
  try {
    var seqRecord = e.record;
    if (!(seqRecord.get('seq') > 0)) {
      var seqOrgId = seqRecord.get('organization_id');
      var seqDate = seqRecord.get('date');
      if (seqOrgId && seqDate) {
        var seqRecords = $app.findRecordsByFilter(
          'invoices',
          'organization_id = "' + seqOrgId + '" && date = "' + seqDate + '"',
          '-seq',
          1,
          0,
        );
        var seqMax = seqRecords.length > 0 ? parseInt(seqRecords[0].get('seq') || '0', 10) : 0;
        seqRecord.set('seq', seqMax + 1);
      }
    }
  } catch (err) {
    console.error('[notify:seq]', String(err));
  }

  // --- Actor name snapshot (internal saves bypass the request hook) ---
  try {
    var actorRec = e.record;
    if (!actorRec.get('created_by_name') && actorRec.get('created_by')) {
      actorRec.set('created_by_name', require(__hooks + '/lib-actor.js').resolveActorName($app, [actorRec.get('created_by')]));
    }
    if (actorRec.get('updated_by') && !actorRec.get('updated_by_name')) {
      actorRec.set('updated_by_name', require(__hooks + '/lib-actor.js').resolveActorName($app, [actorRec.get('updated_by')]));
    }
  } catch (err) {
    console.error('[notify:actor-name]', String(err));
  }

  // --- Notification ---
  try {
    var rec = e.record;
    if (rec.get('original_invoice_id')) { e.next(); return; }
    var invOrgId = rec.get('organization_id');
    var invId = rec.id;
    var actorId = rec.get('created_by') || (e.auth ? e.auth.id : '');
    var actorName = require(__hooks + '/lib-actor.js').resolveActorName($app, [
      actorId,
      e.auth ? e.auth.id : '',
    ]) || 'Пользователь';
    var counterparty = rec.get('counterparty');
    var amount = rec.get('amount');
    var amtStr = amount !== null && amount !== undefined ? String(Math.round(Number(amount))) : '0';
    var eventText = 'Создан счёт: ' + counterparty + ', ' + amtStr + ' \u20BD';

    var objName = '';
    try {
      var obj = $app.findRecordById('accounting_objects', rec.get('accounting_object_id'));
      objName = obj ? (obj.get('name') || '') : '';
    } catch (_) {
      objName = '';
    }

    var invPaid = rec.get('paid') || false;
    var invDate = rec.get('date') || '';

    var orgUsers = $app.findRecordsByFilter(
      'organization_users',
      '(role = "admin" || role = "moderator") && organization_id = "' + invOrgId + '"',
      '',
      0,
      0,
    );
    for (var i = 0; i < orgUsers.length; i++) {
      var userId = orgUsers[i].get('user_id');
      if (userId === actorId) continue;
      var notifCol = $app.findCollectionByNameOrId('notifications');
      var notifRec = new Record(notifCol);
      notifRec.set('organization_id', invOrgId);
      notifRec.set('user_id', userId);
      notifRec.set('invoice_id', invId);
      notifRec.set('type', 'invoice_created');
      notifRec.set('event', eventText);
      notifRec.set('message', eventText);
      notifRec.set('actor_name', actorName);
      notifRec.set('read', false);
      notifRec.set('object_name', objName);
      notifRec.set('amount', amount);
      notifRec.set('paid', invPaid);
      notifRec.set('invoice_date', invDate);
      $app.save(notifRec);
    }
  } catch (err) {
    console.error('[notify:create]', String(err));
  }

  e.next();
}, 'invoices');

// ── Invoice Updated (notification) ──

onRecordUpdate((e) => {
  try {
    var rec = e.record;
    if (rec.get('original_invoice_id')) { e.next(); return; }
    var oldRec = $app.findRecordById('invoices', rec.id);
    if (!oldRec) { e.next(); return; }

    // --- Actor name snapshot (internal saves bypass the request hook) ---
    try {
      if (rec.get('updated_by') && !rec.get('updated_by_name')) {
        rec.set('updated_by_name', require(__hooks + '/lib-actor.js').resolveActorName($app, [rec.get('updated_by')]));
      }
      if (rec.get('created_by') && !rec.get('created_by_name')) {
        rec.set('created_by_name', require(__hooks + '/lib-actor.js').resolveActorName($app, [rec.get('created_by')]));
      }
    } catch (err) {
      console.error('[notify:actor-name]', String(err));
    }

    var invOrgId = rec.get('organization_id');
    var invId = rec.id;
    var actorId = rec.get('updated_by');
    var actorName = rec.get('updated_by_name')
      || require(__hooks + '/lib-actor.js').resolveActorName($app, [actorId])
      || 'Пользователь';
    var counterparty = rec.get('counterparty');
    var amount = rec.get('amount');
    var amtStr = amount !== null && amount !== undefined ? String(Math.round(Number(amount))) : '0';

    var objName = '';
    try {
      var obj = $app.findRecordById('accounting_objects', rec.get('accounting_object_id'));
      objName = obj ? (obj.get('name') || '') : '';
    } catch (_) {
      objName = '';
    }

    var invPaid = rec.get('paid') || false;
    var invDate = rec.get('date') || '';

    var paidChanged = String(oldRec.get('paid')) !== String(rec.get('paid'));
    var notifType, eventText;

    if (paidChanged) {
      notifType = 'payment_marked';
      if (rec.get('paid')) {
        eventText = 'Счёт оплачен: ' + counterparty;
      } else {
        eventText = 'Оплата отменена: ' + counterparty;
      }
    } else {
      notifType = 'invoice_updated';
      eventText = 'Счёт изменён: ' + counterparty + ', ' + amtStr + ' \u20BD';
    }

    var orgUsers = $app.findRecordsByFilter(
      'organization_users',
      '(role = "admin" || role = "moderator") && organization_id = "' + invOrgId + '"',
      '',
      0,
      0,
    );
    for (var i = 0; i < orgUsers.length; i++) {
      var userId = orgUsers[i].get('user_id');
      if (userId === actorId) continue;
      var notifCol = $app.findCollectionByNameOrId('notifications');
      var notifRec = new Record(notifCol);
      notifRec.set('organization_id', invOrgId);
      notifRec.set('user_id', userId);
      notifRec.set('invoice_id', invId);
      notifRec.set('type', notifType);
      notifRec.set('event', eventText);
      notifRec.set('message', eventText);
      notifRec.set('actor_name', actorName);
      notifRec.set('read', false);
      notifRec.set('object_name', objName);
      notifRec.set('amount', amount);
      notifRec.set('paid', invPaid);
      notifRec.set('invoice_date', invDate);
      $app.save(notifRec);
    }
  } catch (err) {
    console.error('[notify:update]', String(err));
  }

  e.next();
}, 'invoices');

// ── Invoice Restored (notification) ──

onRecordCreateRequest((e) => {
  e.next();
  try {
    if (!e.auth) return;
    if (e.record.get('type') !== 'invoice_restored') return;
    var invId = e.record.get('invoice_id');
    if (!invId) return;
    var rec = $app.findRecordById('invoices', invId);
    if (!rec) return;

    var invOrgId = rec.get('organization_id');
    var actorId = e.auth.id;
    var actorName = require(__hooks + '/lib-actor.js').resolveActorName($app, [actorId]) || 'Пользователь';
    var counterparty = rec.get('counterparty');
    var amount = rec.get('amount');
    var amtStr = amount !== null && amount !== undefined ? String(Math.round(Number(amount))) : '0';
    var eventText = 'Счёт восстановлен из архива: ' + counterparty + ', ' + amtStr + ' \u20BD';

    var objName = '';
    try {
      var obj = $app.findRecordById('accounting_objects', rec.get('accounting_object_id'));
      objName = obj ? (obj.get('name') || '') : '';
    } catch (_) {
      objName = '';
    }

    var invPaid = rec.get('paid') || false;
    var invDate = rec.get('date') || '';

    var orgUsers = $app.findRecordsByFilter(
      'organization_users',
      '(role = "admin" || role = "moderator") && organization_id = "' + invOrgId + '"',
      '',
      0,
      0,
    );
    for (var i = 0; i < orgUsers.length; i++) {
      var userId = orgUsers[i].get('user_id');
      if (userId === actorId) continue;
      var notifCol = $app.findCollectionByNameOrId('notifications');
      var notifRec = new Record(notifCol);
      notifRec.set('organization_id', invOrgId);
      notifRec.set('user_id', userId);
      notifRec.set('invoice_id', invId);
      notifRec.set('type', 'invoice_restored');
      notifRec.set('event', eventText);
      notifRec.set('message', eventText);
      notifRec.set('actor_name', actorName);
      notifRec.set('read', false);
      notifRec.set('object_name', objName);
      notifRec.set('amount', amount);
      notifRec.set('paid', invPaid);
      notifRec.set('invoice_date', invDate);
      $app.save(notifRec);
    }
  } catch (err) {
    console.error('[notify:restore]', String(err));
  }
}, 'invoice_history');

// ── Payment Mark Created (notification) ──

onRecordCreate((e) => {
  try {
    var pm = e.record;
    var pmInvId = pm.get('invoice_id');
    var inv = $app.findRecordById('invoices', pmInvId);
    if (!inv) { e.next(); return; }

    var invOrgId = inv.get('organization_id');
    var actorId = pm.get('created_by');
    var actorName = require(__hooks + '/lib-actor.js').resolveActorName($app, [actorId]) || 'Пользователь';
    var counterparty = inv.get('counterparty');
    var pmAmount = pm.get('amount');
    var pmComment = pm.get('comment');

    var objName = '';
    try {
      var obj = $app.findRecordById('accounting_objects', inv.get('accounting_object_id'));
      objName = obj ? (obj.get('name') || '') : '';
    } catch (_) {
      objName = '';
    }

    var invAmount = inv.get('amount');
    var invPaid = inv.get('paid') || false;
    var invDate = inv.get('date') || '';
    var eventText;
    if (pmAmount !== null && pmAmount !== undefined && pmAmount !== 0) {
      eventText = 'Отметка об оплате: ' + counterparty + ', ' + String(pmAmount) + ' \u20BD';
    } else if (pmComment) {
      eventText = 'Отметка об оплате: ' + counterparty + ', ' + pmComment;
    } else {
      var fallbackAmt = invAmount !== null && invAmount !== undefined
        ? String(Math.round(Number(invAmount)))
        : '0';
      eventText = 'Отметка об оплате: ' + counterparty + ', ' + fallbackAmt + ' \u20BD';
    }
    var notifAmount =
      pmAmount !== null && pmAmount !== undefined && pmAmount !== 0
        ? pmAmount
        : invAmount;

    var orgUsers = $app.findRecordsByFilter(
      'organization_users',
      '(role = "admin" || role = "moderator") && organization_id = "' + invOrgId + '"',
      '',
      0,
      0,
    );
    for (var i = 0; i < orgUsers.length; i++) {
      var userId = orgUsers[i].get('user_id');
      if (userId === actorId) continue;
      var notifCol = $app.findCollectionByNameOrId('notifications');
      var notifRec = new Record(notifCol);
      notifRec.set('organization_id', invOrgId);
      notifRec.set('user_id', userId);
      notifRec.set('invoice_id', pmInvId);
      notifRec.set('type', 'payment_marked');
      notifRec.set('event', eventText);
      notifRec.set('message', eventText);
      notifRec.set('actor_name', actorName);
      notifRec.set('read', false);
      notifRec.set('object_name', objName);
      notifRec.set('amount', notifAmount);
      notifRec.set('paid', invPaid);
      notifRec.set('invoice_date', invDate);
      $app.save(notifRec);
    }
  } catch (err) {
    console.error('[notify:payment]', String(err));
  }

  e.next();
}, 'payment_marks');

// ── Invoice Deleted (notification) ──

onRecordDeleteRequest((e) => {
  try {
    var rec = e.record;
    var invOrgId = rec.get('organization_id');
    var invId = rec.id;
    var actorId = (e.auth ? e.auth.id : '') || rec.get('updated_by') || rec.get('created_by');
    var actorName = require(__hooks + '/lib-actor.js').resolveActorName($app, [
      actorId,
      rec.get('updated_by'),
      rec.get('created_by'),
    ]) || 'Пользователь';

    var counterparty = rec.get('counterparty');
    var amount = rec.get('amount');
    var amtStr = amount !== null && amount !== undefined ? String(Math.round(Number(amount))) : '0';
    var eventText = 'Счёт удалён: ' + counterparty + ', ' + amtStr + ' \u20BD';
    var messageText = eventText;

    var objName = '';
    try {
      var obj = $app.findRecordById('accounting_objects', rec.get('accounting_object_id'));
      objName = obj ? (obj.get('name') || '') : '';
    } catch (_) {
      objName = '';
    }

    var invPaid = rec.get('paid') || false;
    var invDate = rec.get('date') || '';

    var orgUsers = $app.findRecordsByFilter(
      'organization_users',
      '(role = "admin" || role = "moderator") && organization_id = "' + invOrgId + '"',
      '',
      0,
      0,
    );
    for (var i = 0; i < orgUsers.length; i++) {
      var userId = orgUsers[i].get('user_id');
      if (userId === actorId) continue;
      var notifCol = $app.findCollectionByNameOrId('notifications');
      var notifRec = new Record(notifCol);
      notifRec.set('organization_id', invOrgId);
      notifRec.set('user_id', userId);
      notifRec.set('invoice_id', invId);
      notifRec.set('type', 'invoice_deleted');
      notifRec.set('event', eventText);
      notifRec.set('message', messageText);
      notifRec.set('actor_name', actorName);
      notifRec.set('read', false);
      notifRec.set('object_name', objName);
      notifRec.set('amount', amount);
      notifRec.set('paid', invPaid);
      notifRec.set('invoice_date', invDate);
      $app.save(notifRec);
    }
  } catch (err) {
    console.error('[notify:delete]', String(err));
  }

  e.next();
}, 'invoices');
