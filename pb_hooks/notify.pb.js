/// <reference path="../pb_data/types.d.ts" />

// ── Fill actor fields on request ──

onRecordCreateRequest((e) => {
  if (e.auth) {
    e.record.set('created_by', e.auth.id);
  }
  e.next();
}, 'invoices');

onRecordUpdateRequest((e) => {
  if (e.auth) {
    e.record.set('updated_by', e.auth.id);
  }
  e.next();
}, 'invoices');

// ── Invoice Created (seq + notification) ──

onRecordCreate((e) => {
  // --- Seq auto-numbering ---
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

  // --- Notification ---
  try {
    var rec = e.record;
    var invOrgId = rec.get('organization_id');
    var invId = rec.id;
    var actorId = rec.get('created_by');
    var actorName = 'Пользователь';
    if (actorId) {
      try {
        var actorUser = $app.findRecordById('users', actorId);
        if (actorUser) actorName = actorUser.get('name') || actorUser.get('email') || 'Пользователь';
      } catch (_) {}
    }
    var counterparty = rec.get('counterparty');
    var amount = rec.get('amount');
    var amtStr = amount !== null && amount !== undefined ? String(Math.round(Number(amount))) : '0';
    var eventText = 'Создан счёт: ' + counterparty + ', ' + amtStr + ' \u20BD';

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
    var oldRec = $app.findRecordById('invoices', rec.id);
    if (!oldRec) { e.next(); return; }

    var invOrgId = rec.get('organization_id');
    var invId = rec.id;
    var actorId = rec.get('updated_by');
    var actorName = 'Пользователь';
    if (actorId) {
      try {
        var actorUser = $app.findRecordById('users', actorId);
        if (actorUser) actorName = actorUser.get('name') || actorUser.get('email') || 'Пользователь';
      } catch (_) {}
    }
    var counterparty = rec.get('counterparty');
    var amount = rec.get('amount');
    var amtStr = amount !== null && amount !== undefined ? String(Math.round(Number(amount))) : '0';

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
      $app.save(notifRec);
    }
  } catch (err) {
    console.error('[notify:update]', String(err));
  }

  e.next();
}, 'invoices');

// ── Payment Mark Created (notification) ──

onRecordCreate((e) => {
  try {
    var pm = e.record;
    var pmInvId = pm.get('invoice_id');
    var inv = $app.findRecordById('invoices', pmInvId);
    if (!inv) { e.next(); return; }

    var invOrgId = inv.get('organization_id');
    var actorId = pm.get('created_by');
    var actorName = 'Пользователь';
    if (actorId) {
      try {
        var actorUser = $app.findRecordById('users', actorId);
        if (actorUser) actorName = actorUser.get('name') || actorUser.get('email') || 'Пользователь';
      } catch (_) {}
    }
    var counterparty = inv.get('counterparty');
    var pmAmount = pm.get('amount');
    var pmComment = pm.get('comment');
    var eventText;
    if (pmAmount !== null && pmAmount !== undefined && pmAmount !== 0) {
      eventText = 'Отметка об оплате: ' + counterparty + ', ' + String(pmAmount) + ' \u20BD';
    } else if (pmComment) {
      eventText = 'Отметка об оплате: ' + counterparty + ', ' + pmComment;
    } else {
      var fallbackAmt = inv.get('amount') !== null && inv.get('amount') !== undefined
        ? String(Math.round(Number(inv.get('amount'))))
        : '0';
      eventText = 'Отметка об оплате: ' + counterparty + ', ' + fallbackAmt + ' \u20BD';
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
      notifRec.set('invoice_id', pmInvId);
      notifRec.set('type', 'payment_marked');
      notifRec.set('event', eventText);
      notifRec.set('message', eventText);
      notifRec.set('actor_name', actorName);
      notifRec.set('read', false);
      $app.save(notifRec);
    }
  } catch (err) {
    console.error('[notify:payment]', String(err));
  }

  e.next();
}, 'payment_marks');
