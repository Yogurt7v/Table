import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/mocks/test-utils';
import { MailFilters } from './MailFilters';
import { useMailFilters } from './useMailFilters';
import type { MailSortDirection } from './useMailFilters';

/**
 * Переключатель порядка живого реестра в панели фильтров.
 *
 * Настоящий хук, а не заглушка: проверяется вся цепочка сразу — клик по кнопке
 * меняет направление в состоянии, а смена направления меняет подпись и иконку
 * той же кнопки. Подделка `UseMailFiltersResult` доказала бы только то, что
 * кнопка вызывает переданный колбэк.
 */

function renderToolbar(sortDirection?: MailSortDirection) {
  function Harness() {
    const filters = useMailFilters(sortDirection ? { sortDirection } : undefined);
    return (
      <MailFilters
        filters={filters}
        mailType="incoming"
        accountingObjects={[]}
        responsibleOptions={[]}
        chips={[]}
      />
    );
  }

  return renderWithProviders(<Harness />);
}

/** Подпись и aria-label читаются с самой кнопки по её `data-` маркеру. */
function sortToggle() {
  return document.querySelector<HTMLButtonElement>('[data-mail-sort-toggle]');
}

function filterTrigger() {
  return screen.getByRole('button', { name: /^Фильтр/ });
}

describe('MailFilters — переключатель порядка', () => {
  it('по умолчанию стоит сразу за «Фильтр» и обещает сначала новые', () => {
    renderToolbar();

    const toggle = sortToggle();
    expect(toggle).not.toBeNull();
    expect(toggle).toHaveTextContent('Сначала новые');
    // aria-label описывает ДЕЙСТВИЕ, а не состояние: сейчас показано «сначала
    // новые», значит клик покажет «сначала старые».
    expect(toggle).toHaveAttribute('aria-label', 'Показать сначала старые письма');
  });

  it('клик переключает и подпись, и следующий шаг', async () => {
    const user = userEvent.setup();
    renderToolbar();

    await user.click(sortToggle()!);

    expect(sortToggle()).toHaveTextContent('Сначала старые');
    expect(sortToggle()).toHaveAttribute('aria-label', 'Показать сначала новые письма');

    await user.click(sortToggle()!);

    expect(sortToggle()).toHaveTextContent('Сначала новые');
  });

  it('обратный порядок открывается сразу в состоянии «сначала старые»', () => {
    renderToolbar('asc');

    expect(sortToggle()).toHaveTextContent('Сначала старые');
  });

  it('кнопка «Фильтр» от переключателя не меняется', () => {
    renderToolbar('asc');

    // Направление — не фильтр: подпись и цвет соседней кнопки те же, что при
    // состоянии по умолчанию, без счётчика групп.
    expect(filterTrigger()).toHaveTextContent('Фильтр');
    expect(filterTrigger().className).not.toContain('blue');
  });

  it('клик по переключателю не захлопывает открытую панель фильтров', async () => {
    const user = userEvent.setup();
    renderToolbar();

    await user.click(filterTrigger());
    await screen.findByText('Есть связанные письма');
    expect(filterTrigger()).toHaveAttribute('aria-expanded', 'true');

    await user.click(sortToggle()!);

    // Признак открытой панели, а не присутствие её пунктов: уходящая панель
    // Mantine ещё несколько сотен миллисекунд висит в DOM, и проверка по
    // тексту прошла бы и после закрытия.
    expect(filterTrigger()).toHaveAttribute('aria-expanded', 'true');
  });
});
