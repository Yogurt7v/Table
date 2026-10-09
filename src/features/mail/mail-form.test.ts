import { describe, it, expect } from 'vitest';
import type { IIncomingMail, IOutgoingMail } from '@/shared/types';
import { carryOverForRegisterSwitch, toMailForm, validateMailForm } from './mail-form';

const incoming: IIncomingMail = {
  id: 'abc123',
  organization_id: 'org1',
  accounting_object_id: 'obj1',
  number: 'ИСХ-77',
  date: '2026-10-07 00:00:00.000Z',
  sender_outgoing_number: 'ИСХ-12',
  subject: 'Счёт на оплату',
  sender: 'ООО «Ромашка»',
  responsible: 'user1',
  delivery_method: 'email',
  comment: 'перезвонить в четверг',
};

const outgoing: IOutgoingMail = {
  id: 'def456',
  organization_id: 'org1',
  accounting_object_id: 'obj1',
  outgoing_number: 'ИСХ-101',
  date: '2026-10-09 00:00:00.000Z',
  counterparty_incoming_number: 'ВХ-5',
  subject: 'Ответ по договору',
  recipient: 'ИП Петров',
  responsible: 'user2',
  comment: '',
};

describe('mail-form: toMailForm', () => {
  it('разбирает входящее письмо в состояние формы', () => {
    const form = toMailForm('incoming', incoming);
    expect(form.date).toBe('2026-10-07');
    expect(form.number).toBe('ИСХ-77');
    expect(form.counterparty).toBe('ООО «Ромашка»');
    expect(form.counterpartyNumber).toBe('ИСХ-12');
    expect(form.subject).toBe('Счёт на оплату');
    expect(form.accountingObjectId).toBe('obj1');
    expect(form.comment).toBe('перезвонить в четверг');
  });

  it('разбирает исходящее письмо', () => {
    const form = toMailForm('outgoing', outgoing);
    expect(form.number).toBe('ИСХ-101');
    expect(form.counterparty).toBe('ИП Петров');
    expect(form.counterpartyNumber).toBe('ВХ-5');
  });

  it('без письма даёт пустую форму', () => {
    const form = toMailForm('incoming', null);
    expect(form.counterparty).toBe('');
    expect(form.number).toBe('');
  });

  it('копия сохраняет дату оригинала, но очищает номер', () => {
    const form = toMailForm('incoming', incoming, { clearNumber: true });
    expect(form.date).toBe('2026-10-07');
    expect(form.number).toBe('');
    expect(form.counterparty).toBe('ООО «Ромашка»');
    expect(form.subject).toBe('Счёт на оплату');
  });

  it('копия исходящего тоже теряет номер — иначе форма не сохранится', () => {
    const form = toMailForm('outgoing', outgoing, { clearNumber: true });
    expect(form.number).toBe('');
    expect(validateMailForm(form, 'outgoing').number).toBe('Укажите исходящий номер');
  });
});

describe('mail-form: carryOverForRegisterSwitch', () => {
  it('со входящего на исходящий сохраняет контрагента, тему и дату', () => {
    const copied = toMailForm('incoming', incoming, { clearNumber: true });
    const switched = carryOverForRegisterSwitch({ ...copied, number: 'ИСХ-77' });

    expect(switched.counterparty).toBe('ООО «Ромашка»');
    expect(switched.subject).toBe('Счёт на оплату');
    expect(switched.date).toBe('2026-10-07');
    expect(switched.counterpartyNumber).toBe('ИСХ-12');
    expect(switched.number).toBe('');
  });

  it('с исходящего на входящий ведёт себя так же', () => {
    const copied = toMailForm('outgoing', outgoing, { clearNumber: true });
    const switched = carryOverForRegisterSwitch({ ...copied, number: 'ИСХ-101' });

    expect(switched.counterparty).toBe('ИП Петров');
    expect(switched.subject).toBe('Ответ по договору');
    expect(switched.date).toBe('2026-10-09');
    expect(switched.counterpartyNumber).toBe('ВХ-5');
    expect(switched.number).toBe('');
  });

  it('очищенный номер остаётся обязательным для исходящего', () => {
    const switched = carryOverForRegisterSwitch(toMailForm('outgoing', outgoing));
    expect(validateMailForm(switched, 'outgoing').number).toBe('Укажите исходящий номер');
    expect(validateMailForm(switched, 'incoming').number).toBeUndefined();
  });

  it('правка письма через этот путь не проходит — номер остаётся прежним', () => {
    expect(toMailForm('outgoing', outgoing).number).toBe('ИСХ-101');
    expect(toMailForm('incoming', incoming).number).toBe('ИСХ-77');
  });
});
