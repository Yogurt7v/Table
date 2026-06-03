import { http, HttpResponse } from 'msw';
import type { DB } from '@/mocks/db';
import type { IUser } from '@/shared/types';

export function createAuthHandlers(db: DB) {
  return [
    http.post('http://127.0.0.1:8090/api/collections/users/auth-with-password', async ({ request }) => {
      const body = (await request.json()) as { identity: string; password?: string };
      const users = db.collections.users.all();
      const user = users.find(u => u.login === body.identity);

      if (!user || body.password !== 'test123') {
        return HttpResponse.json(
          { message: 'Failed to authenticate.', code: 400, data: {} },
          { status: 400 },
        );
      }

      const token = `mock_token_${user.id}`;
      return HttpResponse.json({
        token,
        record: {
          ...user,
          '@collectionId': 'pbc_users',
          '@collectionName': 'users',
        },
      });
    }),

    http.get('http://127.0.0.1:8090/api/collections/users/records/:id', ({ params }) => {
      const user = db.collections.users.get(params.id as string);
      if (!user) return new HttpResponse(null, { status: 404 });
      return HttpResponse.json({
        ...user,
        collectionId: 'pbc_users',
        collectionName: 'users',
      });
    }),

    http.post('http://127.0.0.1:8090/api/collections/users/records', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      const id = `user_${Date.now()}`;
      const now = new Date().toISOString();
      const user = {
        id,
        ...body,
        created: now,
        updated: now,
        avatar: '',
        verified: false,
        emailVisibility: false,
      };
      db.collections.users.set(user as unknown as IUser);
      return HttpResponse.json({
        ...user,
        collectionId: 'pbc_users',
        collectionName: 'users',
      }, { status: 201 });
    }),

    http.patch('http://127.0.0.1:8090/api/collections/users/records/:id', async ({ params, request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      const existing = db.collections.users.get(params.id as string);
      if (!existing) return new HttpResponse(null, { status: 404 });
      const updated = { ...existing, ...body, id: existing.id, updated: new Date().toISOString() };
      db.collections.users.set(updated as unknown as IUser);
      return HttpResponse.json({ ...updated, collectionId: 'pbc_users', collectionName: 'users' });
    }),

    http.delete('http://127.0.0.1:8090/api/collections/users/records/:id', ({ params }) => {
      if (!db.collections.users.get(params.id as string)) return new HttpResponse(null, { status: 404 });
      db.collections.users.delete(params.id as string);
      return HttpResponse.json({});
    }),
  ];
}
