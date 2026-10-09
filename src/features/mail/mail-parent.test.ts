import { describe, it, expect } from 'vitest';
import type { IIncomingMail, IOutgoingMail } from '@/shared/types';
import {
  buildCandidateLookup,
  intendedParentKey,
  parentOptionLabel,
  parentSelectOptions,
  PENDING_PARENT_INTENT,
} from './mail-parent';
import type { MailCandidate } from './mail-parent';

/**
 * Поле «Ответ на» целиком держится на двух чистых функциях: подпись письма и
 * список опций. Проверять их поведением рендера нечем — список писем приходит
 * org-wide выборкой, а форма рисует его только когда есть право на связь, — но
 * ошибка здесь стоит дорого: сдвинутый порядок прячет свежие письма за старыми,
 * а пропущенное исключение предлагает письму быть ответом на самого себя.
 */

const incoming = (id: string, overrides: Partial<IIncomingMail> = {}): IIncomingMail => ({
  id,
  organization_id: 'org1',
  date: '2026-10-07 00:00:00.000Z',
  subject: `Письмо ${id}`,
  sender: 'ООО «Ромашка»',
  responsible: 'user1',
  number: `ВХ-${id}`,
  ...overrides,
});

const outgoing = (id: string, overrides: Partial<IOutgoingMail> = {}): IOutgoingMail => ({
  id,
  organization_id: 'org1',
  date: '2026-10-07 00:00:00.000Z',
  subject: `Письмо ${id}`,
  recipient: 'ИП Петров',
  responsible: 'user1',
  outgoing_number: `ИСХ-${id}`,
  ...overrides,
});

const lookup = (incomingMails: IIncomingMail[] = [], outgoingMails: IOutgoingMail[] = []) =>
  buildCandidateLookup(incomingMails, outgoingMails);

describe('parentOptionLabel: подпись письма в поле «Ответ на»', () => {
  it('собирает строку из регистра, номера, контрагента и даты', () => {
    const candidate: MailCandidate = {
      key: 'outgoing:out1',
      type: 'outgoing',
      id: 'out1',
      number: '44/26',
      counterparty: 'ООО «Ромашка»',
      dateKey: '2026-10-07',
      subject: 'Счёт',
      seq: 1,
    };
    expect(parentOptionLabel(candidate)).toBe('Исходящее · № 44/26 · ООО «Ромашка» · 07.10.2026');
  });

  it('пустые номер и контрагент печатаются прочерком, а не пропадают', () => {
    const candidate: MailCandidate = {
      key: 'incoming:in1',
      type: 'incoming',
      id: 'in1',
      number: '',
      counterparty: '',
      dateKey: '2026-01-02',
      subject: '',
      seq: 1,
    };
    expect(parentOptionLabel(candidate)).toBe('Входящее · № — · — · 02.01.2026');
  });

  it('регистр различает два письма с одинаковым номером', () => {
    const [inLetter] = parentSelectOptions(lookup([incoming('a', { number: '12' })]), null);
    const [outLetter] = parentSelectOptions(
      lookup([], [outgoing('b', { outgoing_number: '12' })]),
      null,
    );
    expect(inLetter?.label.startsWith('Входящее')).toBe(true);
    expect(outLetter?.label.startsWith('Исходящее')).toBe(true);
  });
});

describe('parentSelectOptions: список родителей', () => {
  it('пустой индекс даёт пустой список, а не исключение', () => {
    expect(parentSelectOptions(undefined, null)).toEqual([]);
    expect(parentSelectOptions(lookup(), 'outgoing:out1')).toEqual([]);
  });

  it('свежие письма идут сверху, независимо от порядка в ответе', () => {
    const index = lookup([
      incoming('old', { date: '2026-01-05 00:00:00.000Z' }),
      incoming('new', { date: '2026-10-07 00:00:00.000Z' }),
      incoming('mid', { date: '2026-05-05 00:00:00.000Z' }),
    ]);
    const values = parentSelectOptions(index, null).map((option) => option.value);
    expect(values).toEqual(['incoming:new', 'incoming:mid', 'incoming:old']);
  });

  it('на равных датах сверху позже заведённое', () => {
    const index = lookup([incoming('a', { seq: 1 }), incoming('b', { seq: 9 })]);
    const values = parentSelectOptions(index, null).map((option) => option.value);
    expect(values).toEqual(['incoming:b', 'incoming:a']);
  });

  it('исходящие и входящие смешаны: письмо может отвечать на любое из них', () => {
    const index = lookup(
      [incoming('in1', { date: '2026-02-02 00:00:00.000Z' })],
      [outgoing('out1', { date: '2026-09-09 00:00:00.000Z' })],
    );
    expect(parentSelectOptions(index, null).map((option) => option.value)).toEqual([
      'outgoing:out1',
      'incoming:in1',
    ]);
  });

  it('редактируемое письмо исключено — оно не может быть ответом на себя', () => {
    const index = lookup([incoming('me'), incoming('other')], [outgoing('out1')]);
    const values = parentSelectOptions(index, 'incoming:me').map((option) => option.value);
    expect(values).not.toContain('incoming:me');
    expect(values).toEqual(['outgoing:out1', 'incoming:other']);
  });

  it('без письма на редактировании исключать нечего', () => {
    const index = lookup([incoming('me')]);
    expect(parentSelectOptions(index, null)).toHaveLength(1);
  });

  it('значение опции — ключ письма, а не подпись', () => {
    const index = lookup([], [outgoing('out1')]);
    const [option] = parentSelectOptions(index, null);
    expect(option?.value).toBe('outgoing:out1');
    expect(option?.label).not.toBe(option?.value);
  });
});

describe('intendedParentKey: что запишется в mail_relations', () => {
  it('отказ снимает связь, даже если она была записана', () => {
    expect(intendedParentKey({ kind: 'declined' }, 'outgoing:out1')).toBeNull();
  });

  it('выбор человека побеждает записанное', () => {
    expect(intendedParentKey({ kind: 'picked', key: 'outgoing:out2' }, 'outgoing:out1')).toBe(
      'outgoing:out2',
    );
  });

  it('без решения остаётся то, что уже записано', () => {
    expect(intendedParentKey(PENDING_PARENT_INTENT, 'outgoing:out1')).toBe('outgoing:out1');
    expect(intendedParentKey(PENDING_PARENT_INTENT, null)).toBeNull();
  });
});
