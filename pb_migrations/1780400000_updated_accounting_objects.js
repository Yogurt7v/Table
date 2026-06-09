/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId('pbc_3787447598')

  // add sort field
  collection.fields.addAt(3, new Field({
    name: 'sort',
    type: 'number',
    required: false,
    onlyInt: true,
    min: null,
    max: null,
    noDecimal: true,
  }))

  app.save(collection)

  // backfill existing objects with sort = order by created within organization
  const records = app.findRecordsByFilter(
    'accounting_objects',
    'sort = null',
    'created',
    0,
    0,
  )

  var byOrg = {}
  for (var j = 0; j < records.length; j++) {
    var r = records[j]
    var oid = r.getString('organization_id')
    if (!byOrg[oid]) byOrg[oid] = []
    byOrg[oid].push(r)
  }

  var orgIds = Object.keys(byOrg)
  for (var k = 0; k < orgIds.length; k++) {
    var group = byOrg[orgIds[k]]
    for (var m = 0; m < group.length; m++) {
      group[m].set('sort', m + 1)
      app.save(group[m])
    }
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId('pbc_3787447598')

  // remove sort field
  for (var i = collection.fields.length - 1; i >= 0; i--) {
    if (collection.fields[i].name === 'sort') {
      collection.fields.removeById(collection.fields[i].id)
      break
    }
  }

  app.save(collection)
})
