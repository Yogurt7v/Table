/// <reference path="../pb_data/types.d.ts" />

// 🔧 Вспомогательная функция для получения автора
function getAuthor(e) {
  // В PB 0.38.2 авторизованный пользователь доступен через e.request.auth.record
  const authRecord = e.request?.auth?.record;
  if (authRecord) {
    return authRecord.get('email') || authRecord.getId();
  }

  // Для админов (если нужно)
  // const admin = $app.adminAuth()?.record; // опционально
  // if (admin) return admin.email || 'admin';

  return 'system';
}

// 🔥 Правильное объявление хука: глобальная переменная + присваивание
onRecordBeforeUpdate = (e) => {
  // Фильтрация коллекции внутри хука
  if (e.collection.name !== 'invoices') return;

  try {
    const record = e.record;
    const original = record.original(); // Состояние записи ДО изменений

    // Если original() вернул null (редко, но бывает) — выходим
    if (!original) return;

    // Собираем старые значения
    const oldData = {};
    const fields = [
      'counterparty',
      'purpose',
      'contract_no',
      'invoice_no',
      'amount',
      'paid',
      'paid_date',
      'comment',
      'seq',
    ];
    for (const field of fields) {
      oldData[field] = original.get(field);
    }

    const author = getAuthor(e);

    // Находим коллекцию истории
    const historyCollection = $app.findCollectionByNameOrId('invoice_history');

    // 🔥 Правильное создание записи в PB 0.38.2:
    const newHistory = new Record(historyCollection);
    newHistory.set('invoice_id', record.getId());
    newHistory.set('author', author);
    newHistory.set('changed_at', new Date().toISOString());
    newHistory.set('previous_data', JSON.stringify(oldData));

    // Сохраняем через DAO (обходит API Rules, что правильно для аудита)
    $app.dao().saveRecord(newHistory);
  } catch (err) {
    console.error('[audit_hook] error:', err);
    // Не пробрасываем ошибку, чтобы не ломать основное обновление инвойса
  }
};
