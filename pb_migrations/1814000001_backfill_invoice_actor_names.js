/// <reference path="../pb_data/types.d.ts" />

// Бэкфилл имени инициатора для счетов, созданных до появления created_by_name.
// Имя берётся из users/_superusers. Если пользователя уже удалили, остаётся
// пусто — восстановить имя для таких записей нечем, и фронтенд покажет «—».

// Ищет пользователя в users, затем в _superusers (это разные коллекции).
function resolveName(app, id) {
  for (const collection of ['users', '_superusers']) {
    try {
      const user = app.findRecordById(collection, id);
      if (user) {
        return user.get('name') || user.get('login') || user.get('email') || '';
      }
    } catch (_) {
      // нет в этой коллекции — пробуем следующую
    }
  }
  return '';
}

migrate((app) => {
  const invoices = app.findRecordsByFilter('invoices', '', '', 0, 0);

  for (const invoice of invoices) {
    let changed = false;

    if (invoice.get('created_by') && !invoice.get('created_by_name')) {
      const name = resolveName(app, invoice.get('created_by'));
      if (name) {
        invoice.set('created_by_name', name);
        changed = true;
      }
    }

    if (invoice.get('updated_by') && !invoice.get('updated_by_name')) {
      const name = resolveName(app, invoice.get('updated_by'));
      if (name) {
        invoice.set('updated_by_name', name);
        changed = true;
      }
    }

    if (changed) app.save(invoice);
  }
}, (app) => {
  // Обратной операции нет: исходные значения нигде не сохранялись.
  const invoices = app.findRecordsByFilter('invoices', '', '', 0, 0);
  for (const invoice of invoices) {
    invoice.set('created_by_name', '');
    invoice.set('updated_by_name', '');
    app.save(invoice);
  }
});