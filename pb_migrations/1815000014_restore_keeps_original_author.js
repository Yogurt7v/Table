/// <reference path="../pb_data/types.d.ts" />

// Восстановление из архива возвращает запись В РЕЕСТР, а не создаёт новую:
// автор у неё должен остаться тем, кто создал её изначально. Но клиент присылает
// в `create` только счёт — без автора, — и серверный хук проставлял
// `created_by = e.auth.id`, то есть восстановителя. В колонке «Инициатор»
// возвращённый счёт выглядел так, будто его завёл тот, кто его разблокировал.
//
// Клиенту нельзя доверять назначение автора: если бы хук просто перестал
// перезаписывать присланное клиентом `created_by`, любой аутентифицированный
// пользователь смог бы POST-нуть счёт (или письмо) от чужого имени. Поэтому
// клиент шлёт ССЫЛКУ на архивную запись, а настоящего автора сервер достаёт из
// самой архивной копии — единственного места, где автору можно доверять.
//
// Поле намеренно `text`, а не `relation`. `relation` заставил бы PocketBase
// проверять существование записи и превратил бы «битая ссылка» в 400, а
// восстановление обязано уметь деградировать до автора восстановителя, если
// архивная строка не нашлась или в ней пустой автор (см. фолбэк в хуке).
// Формат поля повторяет `original_invoice_id` — такой же «ссылочный, но
// необязательный» текстовый id.
//
// Поля одинаковые для счёта и для писем: дефект одинаковый. В письмах он был
// ещё и незаметен — `mail.ts` честно слал `created_by: deleted.created_by` при
// восстановлении, но хук `fillMailActorsOnCreateRequest` в `mail-notify.pb.js`
// перезаписывал это значение безусловно, так что клиентский фолбэк был мёртвым
// кодом, а письмо всё равно показывало восстановителя автором.
//
// Ничего обязательного здесь нет: пустое поле означает «обычное создание», и
// хук в этом случае ведёт себя ровно как раньше.

const FIELDS = [
  { collection: 'invoices', field: 'restored_from_invoice_id', id: 'a32' },
  { collection: 'incoming_mails', field: 'restored_from_inmail_id', id: 'm22' },
  { collection: 'outgoing_mails', field: 'restored_from_outmail_id', id: 'm23' },
];

migrate(
  (app) => {
    for (const { collection, field, id } of FIELDS) {
      const col = app.findCollectionByNameOrId(collection);

      if (!col.fields.getByName(field)) {
        col.fields.add(
          new Field({
            autogeneratePattern: '',
            hidden: false,
            id,
            max: 15,
            min: null,
            name: field,
            pattern: '',
            presentable: false,
            primaryKey: false,
            required: false,
            system: false,
            type: 'text',
          }),
        );
      }

      app.save(col);
    }
  },
  (app) => {
    for (const { collection, field, id } of FIELDS) {
      const col = app.findCollectionByNameOrId(collection);

      const existing = col.fields.getByName(field);
      if (existing) col.fields.removeById(existing.id);
      else if (col.fields.get(id)) col.fields.removeById(id);

      app.save(col);
    }
  },
);
