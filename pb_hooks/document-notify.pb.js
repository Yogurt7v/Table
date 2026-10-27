/// <reference path="../pb_data/types.d.ts" />

onRecordCreate((e) => {
  try {
    require(__hooks + '/lib-document-notify.js').notifyDocumentCreated($app, e.record);
  } catch (err) {
    console.error('[documents:notify-create]', String(err));
  }
  e.next();
}, 'documents');

onRecordUpdateRequest((e) => {
  try {
    var oldDocument = null;
    try {
      oldDocument = e.record.original();
    } catch (_) {
      oldDocument = null;
    }
    require(__hooks + '/lib-document-notify.js').notifyDocumentUpdate(
      $app,
      oldDocument,
      e.record,
      e.auth,
    );
  } catch (err) {
    console.error('[documents:notify-update]', String(err));
  }
  e.next();
}, 'documents');

onRecordCreate((e) => {
  try {
    require(__hooks + '/lib-document-notify.js').notifyComment(
      $app,
      e.record,
      'document_comment_added',
      'Новый комментарий к документу',
    );
  } catch (err) {
    console.error('[documents:notify-comment]', String(err));
  }
  e.next();
}, 'document_comments');

onRecordDelete((e) => {
  try {
    require(__hooks + '/lib-document-notify.js').notifyComment(
      $app,
      e.record,
      'document_comment_deleted',
      'Комментарий удалён',
    );
  } catch (err) {
    console.error('[documents:notify-comment-delete]', String(err));
  }
  e.next();
}, 'document_comments');
