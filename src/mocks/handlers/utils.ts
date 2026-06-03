import { http, HttpResponse } from 'msw';
import type { DB } from '@/mocks/db';

type CollectionName = keyof DB['collections'];

type Entity = { id: string };

function getStore(db: DB, name: string) {
  const store = db.collections[name as CollectionName];
  if (!store) throw new Error(`Unknown collection: ${name}`);
  return store as unknown as { all: () => Entity[]; get: (id: string) => Entity | undefined; set: (item: Entity) => Entity; delete: (id: string) => boolean };
}

export function buildRecordUrl(collection: string) {
  return `http://127.0.0.1:8090/api/collections/${collection}/records`;
}

export function buildRecordIdUrl(collection: string) {
  return `http://127.0.0.1:8090/api/collections/${collection}/records/:id`;
}

function applyFilter<T extends Entity>(items: T[], filter: string): T[] {
  if (!filter) return items;
  const conditions = filter.split('&&').map(s => s.trim());

  return items.filter(item => {
    return conditions.every(cond => {
      const eqMatch = cond.match(/^(\w+)\s*=\s*"([^"]*)"$/);
      if (eqMatch) {
        const [, field, value] = eqMatch;
        return String((item as Record<string, unknown>)[field!]) === value;
      }
      const notEqMatch = cond.match(/^(\w+)\s*!=\s*"([^"]*)"$/);
      if (notEqMatch) {
        const [, field, value] = notEqMatch;
        return String((item as Record<string, unknown>)[field!]) !== value;
      }
      const tildeMatch = cond.match(/^(\w+)\s*~\s*"([^"]*)"$/);
      if (tildeMatch) {
        const [, field, value] = tildeMatch;
        return String((item as Record<string, unknown>)[field!] || '').toLowerCase().includes(value!.toLowerCase());
      }
      const lteMatch = cond.match(/^(\w+)\s*<=\s*"([^"]*)"$/);
      if (lteMatch) {
        const [, field, value] = lteMatch;
        const itemVal = (item as Record<string, unknown>)[field!];
        return itemVal != null && String(itemVal) <= value!;
      }
      return true;
    });
  });
}

function applySort<T extends Entity>(items: T[], sort: string): T[] {
  if (!sort) return items;
  const fields = sort.split(',').map(s => s.trim());
  return [...items].sort((a, b) => {
    for (const field of fields) {
      const desc = field.startsWith('-');
      const f = desc ? field.slice(1) : field;
      const va = String((a as Record<string, unknown>)[f] ?? '');
      const vb = String((b as Record<string, unknown>)[f] ?? '');
      const cmp = va.localeCompare(vb, 'ru');
      if (cmp !== 0) return desc ? -cmp : cmp;
    }
    return 0;
  });
}

export function createListHandler(db: DB, collection: CollectionName) {
  return http.get(buildRecordUrl(collection as string), ({ request }) => {
    const url = new URL(request.url);
    const filter = url.searchParams.get('filter') || '';
    const sort = url.searchParams.get('sort') || '';
    const fields = url.searchParams.get('fields') || '';
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const perPage = parseInt(url.searchParams.get('perPage') || '50', 10);

    const store = getStore(db, collection as string);
    let items = store.all();
    items = applyFilter(items, filter);
    items = applySort(items, sort);

    if (fields) {
      const fieldList = fields.split(',').map(f => f.trim());
      items = items.map(item => {
        const partial: Record<string, unknown> = {};
        for (const f of fieldList) {
          if (f in item) partial[f] = (item as Record<string, unknown>)[f];
        }
        return partial as unknown as Entity;
      });
    }

    const totalItems = items.length;
    const totalPages = Math.ceil(totalItems / perPage);
    const start = (page - 1) * perPage;
    const paged = items.slice(start, start + perPage);

    return HttpResponse.json({
      page, perPage, totalItems, totalPages,
      items: paged.map(item => enrich(item, collection as string)),
    });
  });
}

export function createGetOneHandler(db: DB, collection: CollectionName) {
  return http.get(buildRecordIdUrl(collection as string), ({ params }) => {
    const store = getStore(db, collection as string);
    const item = store.get(params.id as string);
    if (!item) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(enrich(item, collection as string));
  });
}

export function createPostHandler(db: DB, collection: CollectionName) {
  return http.post(buildRecordUrl(collection as string), async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const store = getStore(db, collection as string);
    const id = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const item: Entity = {
      id,
      ...body,
      created: now,
      updated: now,
      collectionId: `pbc_${collection}`,
      collectionName: collection,
    } as unknown as Entity;
    store.set(item);
    return HttpResponse.json(enrich(item, collection as string), { status: 201 });
  });
}

export function createPatchHandler(db: DB, collection: CollectionName) {
  return http.patch(buildRecordIdUrl(collection as string), async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const store = getStore(db, collection as string);
    const existing = store.get(params.id as string);
    if (!existing) return new HttpResponse(null, { status: 404 });

    const updated: Entity = {
      ...existing,
      ...body,
      id: existing.id,
      updated: new Date().toISOString(),
    } as unknown as Entity;
    store.set(updated);
    return HttpResponse.json(enrich(updated, collection as string));
  });
}

export function createDeleteHandler(db: DB, collection: CollectionName) {
  return http.delete(buildRecordIdUrl(collection as string), ({ params }) => {
    const store = getStore(db, collection as string);
    if (!store.get(params.id as string)) return new HttpResponse(null, { status: 404 });
    store.delete(params.id as string);
    return HttpResponse.json({});
  });
}

function enrich(item: Entity, collectionName: string): Entity {
  return {
    ...item,
    collectionId: `pbc_${collectionName}`,
    collectionName,
  };
}

export function createCrudHandlers(db: DB, collection: CollectionName) {
  return [
    createListHandler(db, collection),
    createGetOneHandler(db, collection),
    createPostHandler(db, collection),
    createPatchHandler(db, collection),
    createDeleteHandler(db, collection),
  ];
}
