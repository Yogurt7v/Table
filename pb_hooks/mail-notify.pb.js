/// <reference path="../pb_data/types.d.ts" />

// ── Mail subsystem: actor name snapshots + seq auto-numbering ──
//
// `incoming_mails` / `outgoing_mails` / `mail_files` / `mail_relations`.
//
// `created_by`/`updated_by` store an id that stops resolving once the user is
// deleted, and never resolves for superusers (absent from `users`). The matching
// `*_by_name` fields snapshot the display name alongside the id so the
// "Кто создал" column survives both cases.
//
// `seq` is a counter scoped to `organization_id` only: unlike `invoices.seq` it
// is NOT restarted per date, so a register read top-to-bottom keeps counting
// within one organization while a second organization starts from 1.
//
// NOTE on how a handler gets its values: PocketBase stores a handler as SOURCE
// TEXT and re-evaluates it in a fresh JSVM runtime on every call. Inside the body
// you therefore see neither module-scope declarations of this file nor the
// variables a factory closed over — both die with a `ReferenceError`, swallowed
// by the `try`/`catch` (a broken hook must never block a save) and thus silent.
// A handler can use only: literals written in its own body, the `e` it is called
// with, and `require`d modules — which is why `lib-actor.js` is `require`d inside
// the body. `notify.pb.js` hardcodes `'invoices'` for the same reason.
//
// Mind the event flavour when you need the collection name. A model-level event
// — `onRecordCreate` / `onRecordUpdate`, i.e. `core.RecordEvent` — extends
// `baseRecordEventData`, which declares only `record` and `tags()`. It has NO
// `collection` property, so `e.collection` is `undefined` and `e.collection.name`
// throws. Only `core.RecordRequestEvent` (`onRecordCreateRequest` /
// `onRecordUpdateRequest` / `onRecordDeleteRequest`) extends
// `baseCollectionEventData` and exposes `collection`. So for a model-level event
// the name must be written literally at the registration site — one handler per
// letter register below, rather than one shared handler taking it as an argument.

// ── Fill actor fields on request ──

function fillMailActorsOnCreateRequest(e) {
  if (e.auth) {
    e.record.set('created_by', e.auth.id);
    e.record.set('created_by_name', String(e.auth.get('name') || e.auth.get('login') || e.auth.get('email') || '').slice(0, 200));
  }
  e.next();
}

onRecordCreateRequest(fillMailActorsOnCreateRequest, 'incoming_mails');
onRecordCreateRequest(fillMailActorsOnCreateRequest, 'outgoing_mails');
onRecordCreateRequest(fillMailActorsOnCreateRequest, 'mail_files');
onRecordCreateRequest(fillMailActorsOnCreateRequest, 'mail_relations');

function fillMailActorsOnUpdateRequest(e) {
  if (e.auth) {
    e.record.set('updated_by', e.auth.id);
    e.record.set('updated_by_name', String(e.auth.get('name') || e.auth.get('login') || e.auth.get('email') || '').slice(0, 200));
  }
  e.next();
}

onRecordUpdateRequest(fillMailActorsOnUpdateRequest, 'incoming_mails');
onRecordUpdateRequest(fillMailActorsOnUpdateRequest, 'outgoing_mails');
onRecordUpdateRequest(fillMailActorsOnUpdateRequest, 'mail_files');
onRecordUpdateRequest(fillMailActorsOnUpdateRequest, 'mail_relations');

// ── Seq auto-numbering (org-scoped) + actor name snapshot ──

function mailActorsAndSeqOnCreateIncoming(e) {
  // --- Seq auto-numbering ---
  try {
    var seqRecord = e.record;
    if (!(seqRecord.get('seq') > 0)) {
      var seqOrgId = seqRecord.get('organization_id');
      if (seqOrgId) {
        var seqRecords = $app.findRecordsByFilter(
          'incoming_mails',
          'organization_id = "' + seqOrgId + '"',
          '-seq',
          1,
          0,
        );
        var seqMax = seqRecords.length > 0 ? parseInt(seqRecords[0].get('seq') || '0', 10) : 0;
        seqRecord.set('seq', seqMax + 1);
      }
    }
  } catch (err) {
    console.error('[mail:seq]', String(err));
  }

  // --- Actor name snapshot (internal saves bypass the request hook) ---
  try {
    var actorRec = e.record;
    if (!actorRec.get('created_by_name') && actorRec.get('created_by')) {
      actorRec.set(
        'created_by_name',
        String(require(__hooks + '/lib-actor.js').resolveActorName($app, [actorRec.get('created_by')])).slice(0, 200),
      );
    }
    if (actorRec.get('updated_by') && !actorRec.get('updated_by_name')) {
      actorRec.set(
        'updated_by_name',
        String(require(__hooks + '/lib-actor.js').resolveActorName($app, [actorRec.get('updated_by')])).slice(0, 200),
      );
    }
  } catch (err) {
    console.error('[mail:actor-name]', String(err));
  }

  e.next();
}

function mailActorsAndSeqOnCreateOutgoing(e) {
  // --- Seq auto-numbering ---
  try {
    var seqRecord = e.record;
    if (!(seqRecord.get('seq') > 0)) {
      var seqOrgId = seqRecord.get('organization_id');
      if (seqOrgId) {
        var seqRecords = $app.findRecordsByFilter(
          'outgoing_mails',
          'organization_id = "' + seqOrgId + '"',
          '-seq',
          1,
          0,
        );
        var seqMax = seqRecords.length > 0 ? parseInt(seqRecords[0].get('seq') || '0', 10) : 0;
        seqRecord.set('seq', seqMax + 1);
      }
    }
  } catch (err) {
    console.error('[mail:seq]', String(err));
  }

  // --- Actor name snapshot (internal saves bypass the request hook) ---
  try {
    var actorRec = e.record;
    if (!actorRec.get('created_by_name') && actorRec.get('created_by')) {
      actorRec.set(
        'created_by_name',
        String(require(__hooks + '/lib-actor.js').resolveActorName($app, [actorRec.get('created_by')])).slice(0, 200),
      );
    }
    if (actorRec.get('updated_by') && !actorRec.get('updated_by_name')) {
      actorRec.set(
        'updated_by_name',
        String(require(__hooks + '/lib-actor.js').resolveActorName($app, [actorRec.get('updated_by')])).slice(0, 200),
      );
    }
  } catch (err) {
    console.error('[mail:actor-name]', String(err));
  }

  e.next();
}

// Registered only on the two letter registers — `mail_files`/`mail_relations`
// have no `seq`. The two bodies are identical but for the collection name, which
// each one hardcodes: a model-level event carries no `collection`, and a handler
// cannot take the name as an argument either (see the note at the top).
onRecordCreate(mailActorsAndSeqOnCreateIncoming, 'incoming_mails');
onRecordCreate(mailActorsAndSeqOnCreateOutgoing, 'outgoing_mails');

// `mail_files`/`mail_relations` only get the actor-name backfill.
function mailActorsOnCreate(e) {
  try {
    var actorRec = e.record;
    if (!actorRec.get('created_by_name') && actorRec.get('created_by')) {
      actorRec.set(
        'created_by_name',
        String(require(__hooks + '/lib-actor.js').resolveActorName($app, [actorRec.get('created_by')])).slice(0, 200),
      );
    }
    if (actorRec.get('updated_by') && !actorRec.get('updated_by_name')) {
      actorRec.set(
        'updated_by_name',
        String(require(__hooks + '/lib-actor.js').resolveActorName($app, [actorRec.get('updated_by')])).slice(0, 200),
      );
    }
  } catch (err) {
    console.error('[mail:actor-name]', String(err));
  }

  e.next();
}

onRecordCreate(mailActorsOnCreate, 'mail_files');
onRecordCreate(mailActorsOnCreate, 'mail_relations');

// ── Actor name snapshot on update (internal saves) ──

function mailActorsOnUpdate(e) {
  try {
    var rec = e.record;
    if (rec.get('updated_by') && !rec.get('updated_by_name')) {
      rec.set(
        'updated_by_name',
        String(require(__hooks + '/lib-actor.js').resolveActorName($app, [rec.get('updated_by')])).slice(0, 200),
      );
    }
    if (rec.get('created_by') && !rec.get('created_by_name')) {
      rec.set(
        'created_by_name',
        String(require(__hooks + '/lib-actor.js').resolveActorName($app, [rec.get('created_by')])).slice(0, 200),
      );
    }
  } catch (err) {
    console.error('[mail:actor-name]', String(err));
  }

  e.next();
}

onRecordUpdate(mailActorsOnUpdate, 'incoming_mails');
onRecordUpdate(mailActorsOnUpdate, 'outgoing_mails');
onRecordUpdate(mailActorsOnUpdate, 'mail_files');
onRecordUpdate(mailActorsOnUpdate, 'mail_relations');