/// <reference path="../pb_data/types.d.ts" />

// Document notifications are created server-side: `notifications.createRule` is
// null, so a browser cannot insert them. The helpers below are deliberately
// side-effect-only: a failed notification must never abort a document save.

function truncate(value, max) {
  var text = value === null || value === undefined ? '' : String(value);
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

function actorNameOf(app, id) {
  if (!id) return '';
  try {
    return require(__hooks + '/lib-actor.js').resolveActorName(app, [id]) || '';
  } catch (_) {
    return '';
  }
}

function objectNameOf(app, id) {
  if (!id) return '';
  try {
    var object = app.findRecordById('accounting_objects', String(id));
    return object ? String(object.get('name') || '') : '';
  } catch (_) {
    return '';
  }
}

function amountText(amount) {
  var value = Number(amount);
  if (!isFinite(value)) return '0';
  return String(Math.round(value));
}

/**
 * Notify the responsible user plus admins/moderators. Boss and guest are excluded
 * by role, and the actor never receives their own action. Stable recipients are
 * de-duplicated because the responsible user is often also an admin.
 */
function notifyDocument(app, document, type, text, actorId, actorName) {
  var organizationId = String(document.get('organization_id') || '');
  var responsibleId = String(document.get('responsible_id') || '');
  if (!organizationId) return;

  var actor = String(actorId || '');
  var author = actorName || actorNameOf(app, actor) || 'Пользователь';
  var rows = app.findRecordsByFilter(
    'organization_users',
    'organization_id = "' + organizationId + '"',
    '',
    0,
    0,
  );
  var seen = {};
  for (var i = 0; i < rows.length; i++) {
    var userId = String(rows[i].get('user_id') || '');
    var role = String(rows[i].get('role') || '');
    if (!userId || userId === actor || seen[userId]) continue;
    if (role === 'boss' || role === 'guest') continue;
    if (role !== 'admin' && role !== 'moderator' && userId !== responsibleId) continue;
    seen[userId] = true;

    try {
      var collection = app.findCollectionByNameOrId('notifications');
      var notification = new Record(collection);
      notification.set('organization_id', organizationId);
      notification.set('user_id', userId);
      notification.set('type', type);
      notification.set('event', truncate(text, 500));
      notification.set('message', truncate(text, 2000));
      notification.set('actor_name', truncate(author, 255));
      notification.set('read', false);
      notification.set('object_name', objectNameOf(app, document.get('accounting_object_id')));
      notification.set('amount', Number(document.get('amount')) || 0);
      notification.set('paid', false);
      notification.set('invoice_date', document.get('payment_date') || '');
      app.save(notification);
    } catch (err) {
      console.error('[documents:notify]', String(err));
    }
  }
}

function documentLabel(document) {
  var counterparty = String(document.get('counterparty') || '');
  var amount = amountText(document.get('amount'));
  return counterparty + (amount !== '0' ? ', ' + amount + ' ₽' : '');
}

function notifyDocumentCreated(app, document) {
  var actorId = String(document.get('created_by') || '');
  var actorName = String(document.get('created_by_name') || '') || actorNameOf(app, actorId);
  var suffix = document.get('creation_mode') === 'auto' ? ' (автоматически)' : '';
  notifyDocument(
    app,
    document,
    'document_created',
    'Создан документ: ' + documentLabel(document) + suffix,
    actorId,
    actorName,
  );
}

function notifyDocumentUpdate(app, oldDocument, document, auth) {
  if (!oldDocument) return;
  var actorId = auth ? String(auth.id) : String(document.get('created_by') || '');
  var actorName = auth
    ? String(auth.get('name') || auth.get('login') || auth.get('email') || '')
    : String(document.get('created_by_name') || '');
  var label = documentLabel(document);

  var oldResponsible = String(oldDocument.get('responsible_id') || '');
  var newResponsible = String(document.get('responsible_id') || '');
  if (oldResponsible !== newResponsible) {
    var responsibleName =
      String(document.get('responsible_name') || '') || actorNameOf(app, newResponsible) || '—';
    notifyDocument(
      app,
      document,
      'document_assigned',
      'Ответственный документа: ' + label + ' — ' + responsibleName,
      actorId,
      actorName,
    );
  }

  var oldProvided = oldDocument.get('provided') === true;
  var newProvided = document.get('provided') === true;
  var oldConfirmed = oldDocument.get('confirmed') === true;
  var newConfirmed = document.get('confirmed') === true;
  if (oldProvided !== newProvided || oldConfirmed !== newConfirmed) {
    var parts = [];
    if (oldProvided !== newProvided) parts.push('Предоставлен: ' + (newProvided ? 'да' : 'нет'));
    if (oldConfirmed !== newConfirmed) parts.push('Подтверждён: ' + (newConfirmed ? 'да' : 'нет'));
    notifyDocument(
      app,
      document,
      'document_status',
      'Статус документа: ' + label + ' — ' + parts.join(', '),
      actorId,
      actorName,
    );
  }

  var oldObject = String(oldDocument.get('accounting_object_id') || '');
  var newObject = String(document.get('accounting_object_id') || '');
  if (oldObject !== newObject) {
    notifyDocument(
      app,
      document,
      'document_moved',
      'Документ перенесён: ' + label + ' — ' + (objectNameOf(app, newObject) || 'другой объект'),
      actorId,
      actorName,
    );
  }

  var oldDeleted = oldDocument.get('is_deleted') === true;
  var newDeleted = document.get('is_deleted') === true;
  if (oldDeleted !== newDeleted) {
    if (newDeleted) {
      var reason = String(document.get('deletion_reason') || '');
      notifyDocument(
        app,
        document,
        'document_archived',
        'Документ удалён в архив: ' + label + (reason ? ' — ' + reason : ''),
        actorId,
        actorName,
      );
    } else {
      notifyDocument(
        app,
        document,
        'document_restored',
        'Документ восстановлен: ' + label,
        actorId,
        actorName,
      );
    }
  }

  var oldCancelled = oldDocument.get('payment_cancelled') === true;
  var newCancelled = document.get('payment_cancelled') === true;
  if (oldCancelled !== newCancelled) {
    notifyDocument(
      app,
      document,
      'document_payment_cancelled',
      (newCancelled ? 'Оплата отменена: ' : 'Оплата возобновлена: ') + label,
      actorId,
      actorName,
    );
  }
}

function notifyComment(app, comment, type, prefix) {
  var documentId = String(comment.get('document_id') || '');
  if (!documentId) return;
  var document = null;
  try {
    document = app.findRecordById('documents', documentId);
  } catch (_) {
    return;
  }
  if (!document) return;
  var actorId = String(comment.get('author') || '');
  var actorName =
    String(comment.get('author_name') || '') || actorNameOf(app, actorId) || 'Пользователь';
  var text = truncate(comment.get('text') || '', 200);
  notifyDocument(
    app,
    document,
    type,
    prefix + ': ' + documentLabel(document) + (text ? ' — ' + text : ''),
    actorId,
    actorName,
  );
}

module.exports = {
  notifyDocument: notifyDocument,
  notifyDocumentCreated: notifyDocumentCreated,
  notifyDocumentUpdate: notifyDocumentUpdate,
  notifyComment: notifyComment,
  actorNameOf: actorNameOf,
};
