/// <reference path="../pb_data/types.d.ts" />

// ── Cascade delete user relations ──

onRecordDelete((e) => {
  var id = e.record.id;

  var collections = [
    { name: 'organization_users', field: 'user_id' },
    { name: 'user_settings', field: 'user_id' },
    { name: 'notifications', field: 'user_id' },
  ];

  for (var i = 0; i < collections.length; i++) {
    var col = collections[i];
    var records = $app.findRecordsByFilter(col.name, col.field + ' = "' + id + '"', '', 0, 0);
    for (var j = 0; j < records.length; j++) {
      try {
        $app.delete(records[j]);
      } catch (err) {
        console.log('[user-cascade] delete ' + col.name + ' error: ' + String(err));
      }
    }
  }

  e.next();
}, 'users');
