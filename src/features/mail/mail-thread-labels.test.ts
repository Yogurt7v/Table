import { describe, it, expect } from 'vitest';
import {
  MAIL_CHAIN_DIRECTION_LABELS,
  MAIL_CHAIN_ROOT_LABEL,
  mailChainDirectionLabel,
} from './mail-thread-labels';

/**
 * Шапка письма — единственное место в переписке, где человек видит, что письмо
 * значит для цепочки. Ошибка здесь не бросается в глаза: «ответ на» на письме
 * без родителя звучит как обычный текст, пока человек не попробует найти то,
 * на что оно отвечает. Поэтому подпись проверяется здесь — чистой функцией, без
 * рендера: правило «начало значит родитель, а не номер строки» целостнее видно
 * в списке случаев, чем в готовом окне.
 */

describe('mailChainDirectionLabel: подпись шапки письма', () => {
  it('письмо без родителя вверх — начало цепочки, а не «ответ на»', () => {
    expect(mailChainDirectionLabel('up', true)).toBe(MAIL_CHAIN_ROOT_LABEL);
    expect(mailChainDirectionLabel('up', true)).not.toBe('ответ на');
  });

  it('тот же шаг вверх внутри цепочки по-прежнему «ответ на»', () => {
    expect(mailChainDirectionLabel('up', false)).toBe('ответ на');
  });

  it('вниз по-прежнему «ответ» — снятое с переписки письмо началом не становится', () => {
    expect(mailChainDirectionLabel('down', false)).toBe('ответ');
    expect(mailChainDirectionLabel('down', true)).toBe('ответ');
  });

  it('открытое письмо остаётся текущим, даже когда оно же начало цепочки', () => {
    expect(mailChainDirectionLabel('anchor', true)).toBe('текущее письмо');
    expect(mailChainDirectionLabel('anchor', false)).toBe('текущее письмо');
  });

  it('подпись совпадает с направлением для всех троих шагов без начала цепочки', () => {
    for (const direction of ['anchor', 'up', 'down'] as const) {
      expect(mailChainDirectionLabel(direction, false)).toBe(
        MAIL_CHAIN_DIRECTION_LABELS[direction],
      );
    }
  });

  it('новое начало отличается от прежних подписей — иначе правка не видна', () => {
    const labels = Object.values(MAIL_CHAIN_DIRECTION_LABELS);
    expect(labels).not.toContain(MAIL_CHAIN_ROOT_LABEL);
  });
});
