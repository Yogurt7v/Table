import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/mocks/test-utils';
import { MailFormModal } from './MailFormModal';
import type { MailFormState } from './mail-form';
import type { IIncomingMail, MailType } from '@/shared/types';

/**
 * Форма письма: обязательные поля, смена регистра и защита от ухода со страницы.
 *
 * Проверяется модалка целиком, а не `validateMailForm`: правила полей уже
 * закрыты в `mail-form.test.ts`, а здесь важна цепочка, которой у чистой функции
 * нет — ошибка показана у поля, отправка заблокирована, правка поля убирает
 * ровно свою ошибку, а заполненное состояние доезжает до `onSave` в том виде, в
 * каком его ждёт `MailSection`.
 *
 * Набор обязательных полей сверен со схемой (`pb_migrations/1815000001` и
 * `1815000002`): у входящего `date`/`subject`/`sender`/`responsible`, у исходящего
 * дополнительно `outgoing_number`. Отсюда два наблюдения, которые тест и
 * фиксирует: номер у входящего ошибкой не помечается, а дата ошибкой не
 * помечается никогда — в новой форме она предзаполнена сегодняшним днём.
 *
 * Два приёма, вынужденные разметкой Mantine:
 *
 * - выпадающие списки ищутся через `getByLabelText(..., { selector: 'input' })`:
 *   сам список `Autocomplete` помечен `aria-labelledby` тем же `label` и тоже
 *   находится по подписи, а по роли его не отличить — в `Mantine 7.17.8` поле
 *   `Autocomplete`/`MultiSelect`/`Select` не несёт `role="combobox"`;
 * - вложенная модалка подтверждения появляется не в том же такте, что и клик
 *   (`Mantine` монтирует её через переход), поэтому после клика используется
 *   `findBy*` — ровно как в `MailSection.delete-reason.test.tsx`.
 *
 * Обязательные поля ищутся регулярным выражением от начала строки: `Mantine`
 * дописывает в подпись звёздочку ` *`.
 */

const COUNTERPARTY = 'ООО «Ромашка»';
const RESPONSIBLE = [
  { value: 'user1', label: 'Иванов И. И.' },
  { value: 'user2', label: 'Петров П. П.' },
];

const incomingMail: IIncomingMail = {
  id: 'inc01hxyz',
  organization_id: 'org01hxyz',
  date: '2026-10-07 00:00:00.000Z',
  number: 'ВХ-77',
  sender_outgoing_number: 'ИСХ-12',
  subject: 'Счёт на оплату',
  sender: COUNTERPARTY,
  responsible: 'user1',
  comment: '',
};

type SaveHandler = (mailType: MailType, form: MailFormState, parentKey: string | null) => void;

interface HarnessProps {
  initialType?: MailType;
  mail?: IIncomingMail | null;
  copying?: boolean;
  allowedTypes?: MailType[];
  canLink?: boolean;
  onSave?: SaveHandler;
  onClose?: () => void;
}

/**
 * Регистр живёт в состоянии обёртки — ровно как в `MailSection`, где
 * `onTypeChange` меняет вкладку. Заглушка без состояния доказала бы только то,
 * что колбэк вызван, но не то, что форма переехала в другой регистр.
 */
function renderForm({
  initialType = 'incoming',
  mail = null,
  copying = false,
  allowedTypes = ['incoming', 'outgoing'],
  canLink = true,
  onSave = vi.fn(),
  onClose = vi.fn(),
}: HarnessProps = {}) {
  function Harness() {
    const [mailType, setMailType] = useState<MailType>(initialType);
    return (
      <MailFormModal
        opened
        onClose={onClose}
        mailType={mailType}
        mail={mail}
        copying={copying}
        allowedTypes={allowedTypes}
        accountingObjects={[{ value: 'obj1', label: 'Основной счёт' }]}
        responsibleOptions={RESPONSIBLE}
        counterpartyOptions={[COUNTERPARTY, 'ИП Петров']}
        saving={false}
        candidates={undefined}
        parentEdges={undefined}
        canLink={canLink}
        onTypeChange={setMailType}
        onSave={onSave}
        onOpenThread={vi.fn()}
      />
    );
  }

  renderWithProviders(<Harness />);
  return { onSave, onClose };
}

type User = ReturnType<typeof userEvent.setup>;

const counterpartyField = () =>
  screen.getByLabelText(/^(Отправитель|Получатель)/, { selector: 'input' });
const subjectField = () => screen.getByRole('textbox', { name: /^Тема/ });
const numberField = () => screen.getByRole('textbox', { name: /^(Номер письма|Исходящий номер)/ });
const responsibleField = () => screen.getByLabelText(/^Ответственный/, { selector: 'input' });
const deliveryField = () => screen.getByLabelText('Способ доставки', { selector: 'input' });
const objectField = () => screen.getByLabelText('Объект учёта', { selector: 'input' });

const submitButton = (name: 'Добавить' | 'Сохранить') => screen.getByRole('button', { name });

async function pickResponsible(user: User, label: string) {
  await user.click(responsibleField());
  await user.click(await screen.findByRole('option', { name: label }));
}

async function pickOption(user: User, input: HTMLElement, optionLabel: string) {
  await user.click(input);
  await user.click(await screen.findByRole('option', { name: optionLabel }));
}

/** Заполняет ровно те поля, которые схема объявляет обязательными. */
async function fillRequired(user: User) {
  await user.type(counterpartyField(), COUNTERPARTY);
  await user.type(subjectField(), 'Счёт на оплату');
  await pickResponsible(user, 'Иванов И. И.');
}

/** `beforeunload` в jsdom — обычное отменяемое событие: гасится через `preventDefault`. */
function dispatchBeforeUnload(): Event {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event;
}

describe('MailFormModal — обязательные поля входящего письма', () => {
  it('пустая форма показывает ошибки контрагента, темы и ответственного и не отправляется', async () => {
    const user = userEvent.setup();
    const { onSave } = renderForm();

    await user.click(submitButton('Добавить'));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Укажите отправителя или получателя')).toBeInTheDocument();
    expect(screen.getByText('Укажите тему письма')).toBeInTheDocument();
    expect(screen.getByText('Укажите ответственного')).toBeInTheDocument();
  });

  it('номер у входящего письма ошибкой не помечается — он необязателен в схеме', async () => {
    const user = userEvent.setup();
    const { onSave } = renderForm();

    await user.click(submitButton('Добавить'));

    expect(screen.queryByText('Укажите исходящий номер')).not.toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('MailFormModal — обязательные поля исходящего письма', () => {
  it('к обязательным полям добавляется исходящий номер', async () => {
    const user = userEvent.setup();
    const { onSave } = renderForm({ initialType: 'outgoing' });

    expect(numberField()).toBeRequired();
    await user.click(submitButton('Добавить'));

    expect(screen.getByText('Укажите исходящий номер')).toBeInTheDocument();
    expect(screen.getByText('Укажите отправителя или получателя')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('заполненное исходящее письмо уходит в onSave со своим регистром', async () => {
    const user = userEvent.setup();
    const { onSave } = renderForm({ initialType: 'outgoing' });

    await fillRequired(user);
    await user.type(numberField(), 'ИСХ-101');
    await user.click(submitButton('Добавить'));

    expect(onSave).toHaveBeenCalledWith(
      'outgoing',
      expect.objectContaining({ subject: 'Счёт на оплату', number: 'ИСХ-101' }),
      null,
    );
  });
});

describe('MailFormModal — ошибки полей', () => {
  it('пробелы вместо темы ошибку не снимают', async () => {
    const user = userEvent.setup();
    const { onSave } = renderForm();

    await user.type(counterpartyField(), COUNTERPARTY);
    await user.type(subjectField(), '   ');
    await pickResponsible(user, 'Иванов И. И.');
    await user.click(submitButton('Добавить'));

    expect(screen.getByText('Укажите тему письма')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('правка поля убирает только его ошибку', async () => {
    const user = userEvent.setup();
    const { onSave } = renderForm();

    await user.click(submitButton('Добавить'));
    await user.type(counterpartyField(), COUNTERPARTY);

    expect(screen.queryByText('Укажите отправителя или получателя')).not.toBeInTheDocument();
    expect(screen.getByText('Укажите тему письма')).toBeInTheDocument();
    expect(screen.getByText('Укажите ответственного')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('MailFormModal — передача заполненной формы', () => {
  it('выбранный способ доставки доезжает до onSave', async () => {
    const user = userEvent.setup();
    const { onSave } = renderForm();

    await fillRequired(user);
    await pickOption(user, deliveryField(), 'Курьер');
    await user.click(submitButton('Добавить'));

    expect(onSave).toHaveBeenCalledWith(
      'incoming',
      expect.objectContaining({ deliveryMethod: 'courier' }),
      null,
    );
  });

  it('выбранный объект учёта доезжает до onSave', async () => {
    const user = userEvent.setup();
    const { onSave } = renderForm();

    await fillRequired(user);
    await pickOption(user, objectField(), 'Основной счёт');
    await user.click(submitButton('Добавить'));

    expect(onSave).toHaveBeenCalledWith(
      'incoming',
      expect.objectContaining({ accountingObjectId: 'obj1' }),
      null,
    );
  });

  it('правка сохраняет загруженное письмо как есть, а способ доставки — как null', async () => {
    const user = userEvent.setup();
    const { onSave } = renderForm({ mail: incomingMail });

    await user.click(submitButton('Сохранить'));

    expect(onSave).toHaveBeenCalledWith(
      'incoming',
      expect.objectContaining({
        subject: 'Счёт на оплату',
        date: '2026-10-07',
        deliveryMethod: null,
      }),
      null,
    );
  });

  it('не названная связь сохраняется как null', async () => {
    const user = userEvent.setup();
    const { onSave } = renderForm();

    await fillRequired(user);
    await user.click(submitButton('Добавить'));

    expect(onSave).toHaveBeenCalledWith('incoming', expect.any(Object), null);
  });

  it('Enter в текстовом поле отправляет форму', async () => {
    const user = userEvent.setup();
    const { onSave } = renderForm();

    await fillRequired(user);
    await user.click(subjectField());
    await user.keyboard('{Enter}');

    expect(onSave).toHaveBeenCalledTimes(1);
  });
});

describe('MailFormModal — смена регистра', () => {
  it('подписи полей следуют за регистром', async () => {
    const user = userEvent.setup();
    renderForm();

    expect(counterpartyField()).toHaveAccessibleName(/^Отправитель/);
    expect(numberField()).toHaveAccessibleName(/^Номер письма/);
    expect(screen.getByLabelText('Номер отправителя')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Исходящее письмо'));

    expect(counterpartyField()).toHaveAccessibleName(/^Получатель/);
    expect(numberField()).toHaveAccessibleName(/^Исходящий номер/);
    expect(screen.getByLabelText('Номер контрагента')).toBeInTheDocument();
    expect(screen.queryByLabelText('Номер отправителя')).not.toBeInTheDocument();
  });

  it('у сохранённого письма переключателя нет — письмо не переезжает между коллекциями', () => {
    renderForm({ mail: incomingMail });

    expect(screen.queryByLabelText('Исходящее письмо')).not.toBeInTheDocument();
  });

  it('при создании письма смена регистра очищает форму', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(subjectField(), 'Черновик');
    await user.click(screen.getByLabelText('Исходящее письмо'));

    expect(subjectField()).toHaveValue('');
  });

  it('копия переносит реквизиты в другой регистр, но теряет номер', async () => {
    const user = userEvent.setup();
    const { onSave } = renderForm({ mail: incomingMail, copying: true });

    expect(screen.getByText('Копия письма')).toBeInTheDocument();
    expect(subjectField()).toHaveValue('Счёт на оплату');

    await user.click(screen.getByLabelText('Исходящее письмо'));

    expect(counterpartyField()).toHaveValue(COUNTERPARTY);
    expect(subjectField()).toHaveValue('Счёт на оплату');
    // Номер в другом регистре значит другое поле, поэтому копия его не везёт.
    expect(numberField()).toHaveValue('');

    await user.click(submitButton('Добавить'));

    expect(screen.getByText('Укажите исходящий номер')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('MailFormModal — несохранённые изменения', () => {
  it('правка спрашивает подтверждение закрытия', async () => {
    const user = userEvent.setup();
    const { onClose } = renderForm();

    await user.type(subjectField(), 'Черновик');
    await user.click(screen.getByRole('button', { name: 'Отмена' }));

    expect(await screen.findByText('Несохранённые изменения')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Закрыть без сохранения' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('чистая форма закрывается без вопроса', async () => {
    const user = userEvent.setup();
    const { onClose } = renderForm();

    await user.click(screen.getByRole('button', { name: 'Отмена' }));

    expect(screen.queryByText('Несохранённые изменения')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('уход со страницы гасится только при несохранённых правках', async () => {
    const user = userEvent.setup();
    renderForm();

    expect(dispatchBeforeUnload().defaultPrevented).toBe(false);

    await user.type(subjectField(), 'Черновик');

    expect(dispatchBeforeUnload().defaultPrevented).toBe(true);
  });
});

describe('MailFormModal — редактирование письма', () => {
  it('правка сохраняется подписью «Сохранить»', () => {
    renderForm({ mail: incomingMail });

    expect(screen.getByText('Редактирование письма')).toBeInTheDocument();
    expect(submitButton('Сохранить')).toBeInTheDocument();
  });

  it('строка ответственных из базы читается по обоим значениям', () => {
    // Пробел перед вторым идентификатором: без обрезки он не нашёл бы подписи в
    // `responsibleOptions`, и второй ответственный отрисовался бы своим id.
    renderForm({ mail: { ...incomingMail, responsible: 'user1, user2 ' } });

    // Выбранные значения `hidePickedOptions` убирает из выпадающего списка, так
    // что подпись принадлежит именно пилюле выбора — искать больше негде.
    expect(screen.getByText('Иванов И. И.')).toBeInTheDocument();
    expect(screen.getByText('Петров П. П.')).toBeInTheDocument();
  });

  it('без права на связь поля родителя нет', () => {
    renderForm({ canLink: false });

    expect(screen.queryByLabelText('Ответ на')).not.toBeInTheDocument();
  });
});
