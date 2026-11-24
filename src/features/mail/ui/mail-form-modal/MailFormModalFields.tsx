import {
  Autocomplete,
  Box,
  Button,
  Grid,
  Group,
  MultiSelect,
  Select,
  Stack,
  Textarea,
  TextInput,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconHistory } from '@tabler/icons-react';
import type { DeliveryMethod, MailType } from '@/shared/types';
import { dateKeyToLocalDate, localDateToDateKey } from '@/features/mail/model/mail-date';
import {
  MAIL_COUNTERPARTY_FIELD_LABELS,
  MAIL_COUNTERPARTY_NUMBER_FIELD_LABELS,
  MAIL_NUMBER_FIELD_LABELS,
} from '@/features/mail/model/mail-labels';
import { MailParentHint } from '@/features/mail/ui/parent/MailParentHint';
import type { MailFormErrors, MailFormState } from '@/features/mail/model/mail-form';
import type {
  MailCandidate,
  MailCandidateLookup,
  ParentIntent,
} from '@/features/mail/model/mail-parent';
import { suggestParent } from '@/features/mail/model/mail-parent';
import {
  DELIVERY_OPTIONS,
  DROPDOWN_MAX_HEIGHT,
  rankCounterpartyOptions,
} from './mail-form-modal-constants';
import { parseResponsible } from './mail-form-modal-utils';
import { MailFormSection } from './MailFormSection';

interface MailFormModalFieldsProps {
  mailType: MailType;
  form: MailFormState;
  errors: MailFormErrors;
  counterpartyOptions: string[];
  debouncedNumber: string;
  suggestion: ReturnType<typeof suggestParent>;
  intent: ParentIntent;
  namedParent: MailCandidate | null;
  canLink: boolean;
  parentOptions: { value: string; label: string }[];
  candidates: MailCandidateLookup | undefined;
  responsibleOptions: { value: string; label: string }[];
  accountingObjects: { value: string; label: string }[];
  onPatch: (next: Partial<MailFormState>) => void;
  onConfirmParent: (candidate: MailCandidate) => void;
  onDeclineParent: () => void;
  onOpenThread: (mailType: MailType, mailId: string) => void;
}

/** Поля письма: контрагент/тема, дата/номер, связь с родителем, дополнительные поля. */
export function MailFormModalFields({
  mailType,
  form,
  errors,
  counterpartyOptions,
  debouncedNumber,
  suggestion,
  intent,
  namedParent,
  canLink,
  parentOptions,
  candidates,
  responsibleOptions,
  accountingObjects,
  onPatch,
  onConfirmParent,
  onDeclineParent,
  onOpenThread,
}: MailFormModalFieldsProps) {
  return (
    <Stack gap="lg" style={{ flexShrink: 0 }}>
      <MailFormSection title="Кому и о чём">
        <Autocomplete
          label={MAIL_COUNTERPARTY_FIELD_LABELS[mailType]}
          placeholder={MAIL_COUNTERPARTY_FIELD_LABELS[mailType]}
          required
          value={form.counterparty}
          onChange={(value) => onPatch({ counterparty: value })}
          data={counterpartyOptions}
          filter={rankCounterpartyOptions}
          limit={8}
          maxDropdownHeight={DROPDOWN_MAX_HEIGHT}
          error={errors.counterparty}
        />
        <TextInput
          label="Тема"
          placeholder="Кратко о письме"
          required
          value={form.subject}
          onChange={(e) => onPatch({ subject: e.currentTarget.value })}
          error={errors.subject}
        />
      </MailFormSection>

      {/*<MailFormSection title="Когда и под каким номером">*/}
      <Group grow align="flex-start" wrap="nowrap">
        <DatePickerInput
          label="Дата письма"
          placeholder="Выберите дату"
          valueFormat="DD.MM.YYYY"
          required
          value={dateKeyToLocalDate(form.date)}
          onChange={(value) => onPatch({ date: localDateToDateKey(value) })}
          error={errors.date}
        />
        <TextInput
          label={MAIL_NUMBER_FIELD_LABELS[mailType]}
          placeholder="Например, 12/25"
          required={mailType === 'outgoing'}
          value={form.number}
          onChange={(e) => onPatch({ number: e.currentTarget.value })}
          error={errors.number}
        />
      </Group>

      <TextInput
        label={MAIL_COUNTERPARTY_NUMBER_FIELD_LABELS[mailType]}
        placeholder="Номер письма контрагента"
        value={form.counterpartyNumber}
        onChange={(e) => onPatch({ counterpartyNumber: e.currentTarget.value })}
      />

      <MailParentHint
        mailType={mailType}
        counterpartyNumber={debouncedNumber}
        suggestion={suggestion}
        intent={intent}
        parent={namedParent}
        canLink={canLink}
        onConfirm={onConfirmParent}
        onDecline={onDeclineParent}
      />

      {canLink && (
        <Box>
          <Select
            label="Ответ на"
            placeholder="Письмо, на которое это ответ"
            searchable
            clearable
            limit={8}
            maxDropdownHeight={DROPDOWN_MAX_HEIGHT}
            data={parentOptions}
            value={namedParent?.key ?? null}
            onChange={(value) => {
              if (!value) {
                onDeclineParent();
                return;
              }
              // Ключ приходит из наших же опций, поэтому и письмо ищется в
              // том же `all`: разбирать `MailNodeKey` обратно на регистр и id
              // ради одного клика не нужно, а приведения типов — тем более.
              const picked = candidates?.all.find((candidate) => candidate.key === value);
              if (picked) onConfirmParent(picked);
            }}
          />
          {namedParent && (
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              mt={4}
              px={0}
              leftSection={<IconHistory size={14} />}
              onClick={() => onOpenThread(namedParent.type, namedParent.id)}
            >
              Открыть переписку
            </Button>
          )}
        </Box>
      )}
      {/*</MailFormSection>*/}

      <MailFormSection title="Дополнительно">
        {/* `Grid`, а не `Group`: `Group` не складывается, а три поля подряд на
          широком окне экономят строку, которой на узком экране всё равно нет. */}
        <Grid gutter="md" align="flex-start">
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <MultiSelect
              label="Ответственный"
              placeholder="Выберите сотрудников"
              searchable
              required
              hidePickedOptions
              maxValues={6}
              data={responsibleOptions}
              value={parseResponsible(form.responsible)}
              onChange={(values) => onPatch({ responsible: values.join(',') })}
              error={errors.responsible}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <Select
              label="Объект учёта"
              placeholder="Без объекта учёта"
              clearable
              searchable
              data={accountingObjects}
              value={form.accountingObjectId || null}
              onChange={(value) => onPatch({ accountingObjectId: value ?? '' })}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <Select
              label="Способ доставки"
              placeholder="Не указан"
              clearable
              data={DELIVERY_OPTIONS}
              value={form.deliveryMethod}
              onChange={(value) =>
                onPatch({ deliveryMethod: (value as DeliveryMethod | null) ?? null })
              }
            />
          </Grid.Col>
        </Grid>
        <Textarea
          label="Комментарий"
          placeholder="Комментарий к письму"
          autosize
          minRows={2}
          maxLength={2000}
          value={form.comment}
          onChange={(e) => onPatch({ comment: e.currentTarget.value })}
        />
      </MailFormSection>
    </Stack>
  );
}
