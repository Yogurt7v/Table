import { describe, it, expect } from 'vitest';
import type { RecordModel } from 'pocketbase';
import { getMailFileUrl } from './mail';
import type { IMailFile } from '@/shared/types';

const record = (file: string[]): IMailFile & RecordModel => ({
  id: 'file01hxyz',
  collectionId: 'pbc_1hxyz',
  collectionName: 'mail_files',
  mail_id: 'mail01hxyz',
  mail_type: 'incoming',
  organization_id: 'org01hxyz',
  file,
  name: 'Договор.pdf',
});

describe('getMailFileUrl', () => {
  it('берёт первый файл записи, потому что getURL ждёт одно имя', () => {
    const url = getMailFileUrl(record(['Договор.pdf']));
    expect(url).toContain('/api/files/pbc_1hxyz/file01hxyz/');
    expect(url).toContain(encodeURIComponent('Договор.pdf'));
  });

  it('лишние имена игнорируются: запись всё равно одно вложение', () => {
    expect(getMailFileUrl(record(['a.pdf', 'b.pdf']))).toBe(getMailFileUrl(record(['a.pdf'])));
  });

  it('пустой file даёт null, а не битый URL', () => {
    expect(getMailFileUrl(record([]))).toBeNull();
  });

  it('отсутствующий file не роняет вызов', () => {
    expect(getMailFileUrl({ ...record([]), file: undefined } as unknown as IMailFile)).toBeNull();
  });

  it('неполная запись даёт null, а не пустую ссылку', () => {
    const incomplete = { ...record(['a.pdf']), collectionId: '', collectionName: '' };
    expect(getMailFileUrl(incomplete)).toBeNull();
  });
});
