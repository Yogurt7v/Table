/// <reference path="../pb_data/types.d.ts" />

// Устанавливает срок действия токена аутентификации для users в 24 часа (86400 сек).
// Влияет только на вновь выдаваемые токены; уже выданные сессии остаются
// действительными до истечения их исходного срока (по умолчанию 720ч).
migrate((app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  unmarshal({
    "authToken": {
      "duration": 86400
    }
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  unmarshal({
    "authToken": {
      "duration": 2592000
    }
  }, collection)

  return app.save(collection)
})