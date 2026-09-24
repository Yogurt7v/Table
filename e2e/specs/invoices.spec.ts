import { test, expect } from '../fixtures';
import { loginViaUi } from '../utils/ui';
import { uniqueMarker } from '../fixtures';
import { authAs, createInvoice, findInvoiceByMarker, payInvoiceFull } from '../utils/pb';

test.describe('Счета: создание, поиск, оплата', () => {
  test('создание счёта через API + проверка в БД', async ({ page, orgId, objectId }) => {
    const marker = uniqueMarker('Счёт');
    await loginViaUi(page, 'moderator');
    const pb = await authAs('moderator');
    // АПИ-создание (без UI-формы), проверяем что счёт реально в коллекции
    const inv = await createInvoice(pb, {
      orgId,
      objectId,
      counterparty: marker,
      purpose: 'Оплата по договору',
      amount: 150000,
      date: '2025-01-15',
    });
    expect(inv.id).toBeTruthy();
    const found = await findInvoiceByMarker(pb, marker);
    expect(found.id).toBe(inv.id);
    expect(found.amount).toBe(150000);
  });

  test('полная оплата через API: paid + paid_date', async ({ page, orgId, objectId }) => {
    const marker = uniqueMarker('Оплата');
    await loginViaUi(page, 'moderator');
    const pb = await authAs('moderator');
    const inv = await createInvoice(pb, { orgId, objectId, counterparty: marker, amount: 90000 });
    await payInvoiceFull(inv.id as string, '2025-02-10', 'Модератор');
    const updated = await pb.collection('invoices').getOne(inv.id as string);
    expect(updated.paid).toBe(true);
    expect(String(updated.paid_date).slice(0, 10)).toBe('2025-02-10');
  });
});
