import { ensureTestBaseData } from './utils/pb';

export default async function globalSetup(): Promise<void> {
  await ensureTestBaseData();
}
