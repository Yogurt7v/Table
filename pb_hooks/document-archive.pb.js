/// <reference path="../pb_data/types.d.ts" />

// Server-side hook for document archiving and restoration.
// Detects is_deleted transitions on the `documents` collection and writes
// history + notifications. Complements the frontend API which performs the
// actual update; this hook ensures server-side audit trail even when updates
// originate outside the UI.

onRecordUpdateRequest((e) => {
  try {
    var lib = require(__hooks + '/lib-documents.js');
    var notifyLib = require(__hooks + '/lib-document-notify.js');

    var oldDocument = null;
    try {
      oldDocument = e.record.original();
    } catch (_) {
      oldDocument = null;
    }

    var oldDeleted = oldDocument ? oldDocument.get('is_deleted') === true : false;
    var newDeleted = e.record.get('is_deleted') === true;

    if (oldDeleted === newDeleted) {
      e.next();
      return;
    }

    var actorId = e.auth ? String(e.auth.id) : String(e.record.get('created_by') || '');
    var actorName = e.auth
      ? String(e.auth.get('name') || e.auth.get('login') || e.auth.get('email') || '')
      : String(e.record.get('created_by_name') || '');

    if (newDeleted) {
      // Archiving: require a deletion reason
      var reason = String(e.record.get('deletion_reason') || '');
      if (!reason) {
        // Abort the update if no reason provided
        e.next();
        return;
      }

      // Write history
      try {
        var historyCollection = e.app.findCollectionByNameOrId('document_history');
        var historyRecord = new Record(historyCollection);
        historyRecord.set('document_id', e.record.id);
        historyRecord.set('organization_id', e.record.get('organization_id'));
        historyRecord.set('author', actorId);
        historyRecord.set('author_name', actorName);
        historyRecord.set('changed_at', new Date().toISOString());
        historyRecord.set('type', 'document_archived');
        historyRecord.set('previous_data', { reason: reason });
        e.app.save(historyRecord);
      } catch (err) {
        console.error('[document-archive:history]', String(err));
      }

      // Notify
      try {
        notifyLib.notifyDocument(
          e.app,
          e.record,
          'document_archived',
          'Документ удалён в архив: ' + String(e.record.get('counterparty') || '') + ' — ' + reason,
          actorId,
          actorName,
        );
      } catch (err) {
        console.error('[document-archive:notify]', String(err));
      }
    } else {
      // Restoring: assign a new seq in the same object
      try {
        var organizationId = String(e.record.get('organization_id') || '');
        var objectId = String(e.record.get('accounting_object_id') || '');
        var records = e.app.findRecordsByFilter(
          'documents',
          'organization_id = "' + organizationId + '" && accounting_object_id = "' + objectId + '"',
          '-seq',
          1,
          0,
        );
        var maxSeq = records.length > 0 ? parseInt(records[0].get('seq') || '0', 10) : 0;
        e.record.set('seq', maxSeq + 1);
      } catch (err) {
        console.error('[document-archive:seq]', String(err));
      }

      // Clear deletion fields
      e.record.set('deleted_by', '');
      e.record.set('deleted_by_name', '');
      e.record.set('deleted_at', '');
      e.record.set('deletion_reason', '');

      // Write history
      try {
        var historyCollection = e.app.findCollectionByNameOrId('document_history');
        var historyRecord = new Record(historyCollection);
        historyRecord.set('document_id', e.record.id);
        historyRecord.set('organization_id', e.record.get('organization_id'));
        historyRecord.set('author', actorId);
        historyRecord.set('author_name', actorName);
        historyRecord.set('changed_at', new Date().toISOString());
        historyRecord.set('type', 'document_restored');
        historyRecord.set('previous_data', { restored: true });
        e.app.save(historyRecord);
      } catch (err) {
        console.error('[document-archive:history-restore]', String(err));
      }

      // Notify
      try {
        notifyLib.notifyDocument(
          e.app,
          e.record,
          'document_restored',
          'Документ восстановлен: ' + String(e.record.get('counterparty') || ''),
          actorId,
          actorName,
        );
      } catch (err) {
        console.error('[document-archive:notify-restore]', String(err));
      }
    }

    e.next();
  } catch (err) {
    console.error('[document-archive]', String(err));
    e.next();
  }
}, 'documents');
