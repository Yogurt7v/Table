/// <reference path="../pb_data/types.d.ts" />

// ── Archive mail letters on delete (safety net) ──
// The frontend handles archiving for normal deletions.
// This hook is a fallback for API calls or cascade deletes.
//
// The frontend creates the archive row first and then deletes the original, so
// the dedup guard below is mandatory: without it every frontend-driven deletion
// would produce two archive rows.
//
// History is NOT written here: `mail_history` rows are written by the frontend
// API layer, exactly like `invoice_history`. The hook creates the archive row
// only.
//
// NOTE on the shared handler below: PocketBase runs every hook handler in a
// fresh JSVM runtime, so module-scope declarations are invisible *inside* a
// handler body — only the registration call itself sees them. The handler is
// therefore registered once here and made self-contained: it reads the source
// collection from `e.collection` instead of closing over a module variable.
// `lib-actor.js` must be required inside the handler.

function archiveMailOnDelete(e) {
  var mail = e.record;

  // Archive rows live in their own collections and carry `original_id`;
  // a record that already has one is itself an archived copy.
  if (mail.get('original_id')) {
    e.next();
    return;
  }

  try {
    // --- Which archive collection, and which fields ---
    var srcName = e.collection.name;
    var archiveName = '';
    var fields = [];
    if (srcName === 'incoming_mails') {
      archiveName = 'deleted_incoming_mails';
      fields = [
        'organization_id', 'accounting_object_id', 'seq', 'number', 'date',
        'sender_outgoing_number', 'subject', 'sender', 'responsible',
        'responsible_name', 'delivery_method', 'comment', 'created_by',
        'created_by_name', 'updated_by', 'updated_by_name',
      ];
    } else if (srcName === 'outgoing_mails') {
      archiveName = 'deleted_outgoing_mails';
      fields = [
        'organization_id', 'accounting_object_id', 'seq', 'date',
        'outgoing_number', 'counterparty_incoming_number', 'subject',
        'recipient', 'responsible', 'responsible_name', 'delivery_method',
        'comment', 'created_by', 'created_by_name', 'updated_by',
        'updated_by_name',
      ];
    } else {
      e.next();
      return;
    }

    // --- Dedup guard: the frontend may have archived it already ---
    var existing = $app.findRecordsByFilter(
      archiveName,
      'original_id = "' + mail.id + '"',
      '',
      1,
      0,
    );
    if (existing.length > 0) {
      e.next();
      return;
    }

    var authId = e.auth ? e.auth.id : '';

    var deletedCol = $app.findCollectionByNameOrId(archiveName);
    var deletedRec = new Record(deletedCol);

    for (var i = 0; i < fields.length; i++) {
      var val = mail.get(fields[i]);
      if (val !== undefined && val !== null) {
        deletedRec.set(fields[i], val);
      }
    }

    deletedRec.set('original_id', mail.id);
    deletedRec.set('deleted_by', String(authId).slice(0, 15));
    var deletedByName = '';
    if (e.auth) {
      deletedByName = String(
        require(__hooks + '/lib-actor.js').resolveActorName($app, [authId]) ||
          e.auth.get('name') ||
          e.auth.get('email') ||
          ''
      ).slice(0, 200);
    }
    deletedRec.set('deleted_by_name', deletedByName);
    deletedRec.set('deleted_at', new Date().toISOString());
    $app.save(deletedRec);
  } catch (err) {
    console.error('[mail:archive]', String(err));
  }

  e.next();
}

onRecordDeleteRequest(archiveMailOnDelete, 'incoming_mails');
onRecordDeleteRequest(archiveMailOnDelete, 'outgoing_mails');