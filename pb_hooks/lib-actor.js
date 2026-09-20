/// <reference path="../pb_data/types.d.ts" />

// Resolves a human-readable name for the user who performed an action.
//
// Must be required from inside a hook handler:
//   var actorLib = require(__hooks + '/lib-actor.pb.js');
//
// PocketBase runs every hook handler in a fresh JSVM runtime, so module-level
// declarations are not visible inside handlers and a top-level `require` is
// lost by the time the handler runs.

function nameFromCollection(app, collection, id) {
  try {
    var rec = app.findRecordById(collection, id);
    if (!rec) return '';
    return rec.get('name') || rec.get('login') || rec.get('email') || '';
  } catch (_) {
    return '';
  }
}

// `ids` is a list of candidate user ids ordered by relevance. Auth users and
// superusers are separate collections, so both are tried for each id.
function resolveActorName(app, ids) {
  for (var i = 0; i < (ids || []).length; i++) {
    var id = ids[i];
    if (!id) continue;
    var name = nameFromCollection(app, 'users', id) || nameFromCollection(app, '_superusers', id);
    if (name) return name;
  }
  return '';
}

module.exports = { resolveActorName: resolveActorName };