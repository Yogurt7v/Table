import PocketBase from 'pocketbase';
import 'dotenv/config';

const pb = new PocketBase('http://127.0.0.1:8090');

async function seed() {
  const email = process.env.PB_EMAIL!;
  const password = process.env.PB_PASSWORD!;

  await pb.admins.authWithPassword(email, password);

  // 1. Organizations
  const org1 = await pb.collection('organizations').create({
    name: 'ООО "Тестовая компания"',
    color: '#228be6',
  });
  const org2 = await pb.collection('organizations').create({
    name: 'ИП Иванов И.И.',
    color: '#40c057',
  });

  // 2. Bank accounts
  await pb.collection('bank_accounts').create({
    organization_id: org1.id,
    account_number: '40702810123450000001',
    balance: 1250000,
  });
  await pb.collection('bank_accounts').create({
    organization_id: org1.id,
    account_number: '40702840123450000002',
    balance: 45000,
  });
  await pb.collection('bank_accounts').create({
    organization_id: org2.id,
    account_number: '40802810987650000001',
    balance: 850000,
  });

  // 3. Accounting objects
  const obj1 = await pb.collection('accounting_objects').create({
    organization_id: org1.id,
    name: 'Строительство жилого дома',
  });
  const obj2 = await pb.collection('accounting_objects').create({
    organization_id: org1.id,
    name: 'Поставка оборудования',
  });
  await pb.collection('accounting_objects').create({
    organization_id: org2.id,
    name: 'Розничная торговля',
  });

  // 4. Invoices
  const today = '2026-05-12';
  const invoices = [
    { org: org1.id, obj: obj1.id, seq: 1, counterparty: 'ООО "Ромашка"', purpose: 'Фундаментные работы', contract_no: 'Д-2024/01', invoice_no: 'СФ-001', amount: 2500000, paid: true, paid_date: '2026-05-10', comment: '' },
    { org: org1.id, obj: obj1.id, seq: 2, counterparty: 'ООО "Ромашка"', purpose: 'Кровельные работы', contract_no: 'Д-2024/01', invoice_no: 'СФ-004', amount: 1800000, paid: false, paid_date: '', comment: 'Ожидается оплата' },
    { org: org1.id, obj: obj1.id, seq: 3, counterparty: 'ИП Сидоров', purpose: 'Отделочные материалы', contract_no: 'Д-2025/03', invoice_no: 'СФ-012', amount: 890000, paid: true, paid_date: '2026-05-11', comment: '' },
    { org: org1.id, obj: obj2.id, seq: 4, counterparty: 'ООО "ТехноСнаб"', purpose: 'Станки ЧПУ', contract_no: 'Д-2025/07', invoice_no: 'СФ-018', amount: 5000000, paid: false, paid_date: '', comment: 'Доставка в июне' },
    { org: org1.id, obj: obj2.id, seq: 5, counterparty: 'ООО "ТехноСнаб"', purpose: 'Комплектующие', contract_no: 'Д-2025/08', invoice_no: 'СФ-021', amount: 1200000, paid: true, paid_date: '2026-05-12', comment: '' },
    { org: org1.id, obj: obj2.id, seq: 6, counterparty: 'АО "ЭлектроМир"', purpose: 'Кабельная продукция', contract_no: 'Д-2025/10', invoice_no: 'СФ-025', amount: 450000, paid: false, paid_date: '', comment: '' },
  ];

  for (const inv of invoices) {
    await pb.collection('invoices').create({
      organization_id: inv.org,
      accounting_object_id: inv.obj,
      date: today,
      seq: inv.seq,
      counterparty: inv.counterparty,
      purpose: inv.purpose,
      contract_no: inv.contract_no,
      invoice_no: inv.invoice_no,
      amount: inv.amount,
      paid: inv.paid,
      paid_date: inv.paid_date || null,
      comment: inv.comment,
    });
  }

  console.log('Seed completed!');
  console.log(`  Organizations: ${2}`);
  console.log(`  Bank accounts: ${3}`);
  console.log(`  Accounting objects: ${3}`);
  console.log(`  Invoices: ${invoices.length}`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
