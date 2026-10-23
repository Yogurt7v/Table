import PocketBase from 'pocketbase';
import { describe, expect, it } from 'vitest';

const enabled = Boolean(
  process.env.PB_TEST_URL && process.env.PB_TEST_SUPERUSER && process.env.PB_TEST_PASSWORD,
);

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Не задан ${name}`);
  return value;
}

describe.skipIf(!enabled)('organization_users.objects на живом PocketBase', () => {
  it('принимает 100 объектов и отклоняет 101', async () => {
    const pb = new PocketBase(env('PB_TEST_URL'));
    const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const created: Array<{ collection: string; id: string }> = [];

    try {
      await pb
        .collection('_superusers')
        .authWithPassword(env('PB_TEST_SUPERUSER'), env('PB_TEST_PASSWORD'));

      const org = await pb.collection('organizations').create({ name: `atlas-test-${stamp}` });
      created.push({ collection: 'organizations', id: org.id });

      const user = await pb.collection('users').create({
        login: `atlas_${stamp}`,
        password: 'integration-pass-123',
        passwordConfirm: 'integration-pass-123',
        email: `atlas_${stamp}@local.test`,
        name: 'Atlas integration',
      });
      created.push({ collection: 'users', id: user.id });

      const objectIds: string[] = [];
      for (let i = 0; i < 101; i++) {
        const object = await pb.collection('accounting_objects').create({
          organization_id: org.id,
          name: `Объект ${i + 1}`,
          sort: i,
          is_active: true,
        });
        objectIds.push(object.id);
      }

      const assignment = await pb.collection('organization_users').create({
        user_id: user.id,
        organization_id: org.id,
        role: 'user',
        objects: objectIds.slice(0, 100),
      });
      created.push({ collection: 'organization_users', id: assignment.id });

      expect(assignment.objects).toHaveLength(100);

      await expect(
        pb.collection('organization_users').update(assignment.id, { objects: objectIds }),
      ).rejects.toMatchObject({
        status: 400,
        response: {
          data: {
            objects: { code: 'validation_too_many_values' },
          },
        },
      });

      const reread = await pb.collection('organization_users').getOne<{ objects: string[] }>(
        assignment.id,
      );
      expect(reread.objects).toHaveLength(100);
    } finally {
      for (const { collection, id } of created.reverse()) {
        await pb
          .collection(collection)
          .delete(id)
          .catch(() => undefined);
      }
    }
  }, 60_000);
});
