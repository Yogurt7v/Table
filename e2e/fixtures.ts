import { test as base } from '@playwright/test';
import type { PocketBase } from 'pocketbase';
import { uniqueMarker as dataUniqueMarker } from './data';
import { authAs, resolveTestOrgId, firstObjectId } from './utils/pb';

// ── Баррель E2E: реэкспорт хелперов единым фронтом из '../fixtures' ──
export { loginViaUi, logoutViaUi } from './utils/ui';
export { E2E_USERS, E2E_PASSWORD, ORGS, uniqueMarker } from './data';
export type { TestRole } from './types';
export { uniqueMarker as dataUniqueMarker } from './data';

export const test = base.extend<TestFixtures>({
  marker: async ({}, use) => { await use(dataUniqueMarker('E2E')); },
  client: async ({}, use) => { await use(await authAs('admin')); },
  orgId: async ({}, use) => { const pb = await authAs('admin'); await use(await resolveTestOrgId(pb)); },
  objectId: async ({ orgId }, use) => { const pb = await authAs('admin'); await use(await firstObjectId(pb, orgId)); },
}
);

export interface TestFixtures {
  client: PocketBase;
  orgId: string;
  objectId: string;
  marker: string;
}

export { expect } from '@playwright/test';
