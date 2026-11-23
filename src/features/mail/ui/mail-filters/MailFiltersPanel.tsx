import type { ReactNode } from 'react';
import { Box, Text, TextInput } from '@mantine/core';
import { IconFileOff, IconLink, IconPaperclip, IconX } from '@tabler/icons-react';
import {
  MAIL_ATTACHMENT_FILTER_LABELS,
  MAIL_COUNTERPARTY_FIELD_LABELS,
  MAIL_FILTER_GROUP_LABELS,
  MAIL_NO_ACCOUNTING_OBJECT_LABEL,
  MAIL_NO_DELIVERY_METHOD_LABEL,
  // MAIL_PERIOD_PRESET_LABELS,
} from '@/features/mail/model/mail-labels';
import { MAIL_DELIVERY_METHOD_NAMES } from '@/shared/types';
import type { MailAttachmentFilter, UseMailFiltersResult } from '@/features/mail/hooks/useMailFilters';
import { CheckMarker, FilterColumn, FilterOption } from './FilterOption';
import { DELIVERY_METHODS } from './mail-filters-constants';

// const PERIOD_ITEMS = ['today', 'week', 'month', 'all'] as const;

interface MailFiltersPanelProps {
  filters: UseMailFiltersResult;
  mailType: 'incoming' | 'outgoing';
  accountingObjects: { id: string; name: string }[];
  responsibleOptions: { id: string; name: string }[];
  onClose: () => void;
}

interface AttachmentFilterItemProps {
  value: Exclude<MailAttachmentFilter, 'any'>;
  current: MailAttachmentFilter;
  onSelect: (value: MailAttachmentFilter) => void;
  onClose: () => void;
}

const ATTACHMENT_MARKERS: Record<Exclude<MailAttachmentFilter, 'any'>, ReactNode> = {
  with: <IconPaperclip size={16} />,
  without: <IconFileOff size={16} />,
};

/** Пункт-переключатель «с файлами»/«без файлов»: повторный клик снимает отбор. */
function AttachmentFilterItem({ value, current, onSelect, onClose }: AttachmentFilterItemProps) {
  const isActive = current === value;
  return (
    <FilterOption
      active={isActive}
      marker={isActive ? <CheckMarker active /> : ATTACHMENT_MARKERS[value]}
      onSelect={() => onSelect(isActive ? 'any' : value)}
      onClose={onClose}
    >
      {MAIL_ATTACHMENT_FILTER_LABELS[value]}
    </FilterOption>
  );
}

/**
 * Сетка колонок панели фильтров и подвал со сбросом. Семь групп, отметок и
 * одно поле входа; открывается из `MailFilters`.
 */
export function MailFiltersPanel({
  filters,
  mailType,
  accountingObjects,
  responsibleOptions,
  onClose,
}: MailFiltersPanelProps) {
  const state = filters.filters;

  // Колонки сетки: объект учёта, доставка, ответственный, вложения,
  // контрагент, связи; период живёт отдельным пикером рядом с кнопкой.
  return (
    <>
      <Box className="mail-filters-grid">
        {/*<FilterColumn label={MAIL_FILTER_GROUP_LABELS.period}>
          <Box className="mail-filters-column__body">
            {PERIOD_ITEMS.map((preset) => (
              <FilterOption
                key={preset}
                active={state.period === preset}
                marker={<CheckMarker active={state.period === preset} />}
                onSelect={() => filters.setPeriod(preset)}
                onClose={onClose}
              >
                {MAIL_PERIOD_PRESET_LABELS[preset]}
              </FilterOption>
            ))}
          </Box>
        </FilterColumn>*/}

        <FilterColumn label={MAIL_FILTER_GROUP_LABELS.accountingObject}>
          <Box className="mail-filters-column__body">
            {accountingObjects.length === 0 && (
              <Text className="mail-filters-empty" size="sm">
                Нет доступных объектов
              </Text>
            )}
            {accountingObjects.map((obj) => (
              <FilterOption
                key={obj.id}
                active={state.accountingObjectIds.includes(obj.id)}
                marker={<CheckMarker active={state.accountingObjectIds.includes(obj.id)} />}
                onSelect={() => filters.toggleAccountingObject(obj.id)}
                onClose={onClose}
              >
                {obj.name}
              </FilterOption>
            ))}
            <FilterOption
              active={state.withoutAccountingObject}
              marker={<CheckMarker active={state.withoutAccountingObject} />}
              onSelect={filters.toggleWithoutAccountingObject}
              onClose={onClose}
            >
              {MAIL_NO_ACCOUNTING_OBJECT_LABEL}
            </FilterOption>
          </Box>
        </FilterColumn>

        <FilterColumn label={MAIL_FILTER_GROUP_LABELS.deliveryMethod}>
          <Box className="mail-filters-column__body">
            {DELIVERY_METHODS.map((method) => (
              <FilterOption
                key={method}
                active={state.deliveryMethods.includes(method)}
                marker={<CheckMarker active={state.deliveryMethods.includes(method)} />}
                onSelect={() => filters.toggleDeliveryMethod(method)}
                onClose={onClose}
              >
                {MAIL_DELIVERY_METHOD_NAMES[method]}
              </FilterOption>
            ))}
            <FilterOption
              active={state.withoutDeliveryMethod}
              marker={<CheckMarker active={state.withoutDeliveryMethod} />}
              onSelect={filters.toggleWithoutDeliveryMethod}
              onClose={onClose}
            >
              {MAIL_NO_DELIVERY_METHOD_LABEL}
            </FilterOption>
          </Box>
        </FilterColumn>

        <FilterColumn label={MAIL_FILTER_GROUP_LABELS.responsible}>
          <Box className="mail-filters-column__body">
            {responsibleOptions.length === 0 && (
              <Text className="mail-filters-empty" size="sm">
                Нет пользователей
              </Text>
            )}
            {responsibleOptions.map((option) => (
              <FilterOption
                key={option.id}
                active={state.responsibleIds.includes(option.id)}
                marker={<CheckMarker active={state.responsibleIds.includes(option.id)} />}
                onSelect={() => filters.toggleResponsible(option.id)}
                onClose={onClose}
              >
                {option.name}
              </FilterOption>
            ))}
          </Box>
        </FilterColumn>

        <FilterColumn label={MAIL_FILTER_GROUP_LABELS.attachments}>
          <Box className="mail-filters-column__body">
            <AttachmentFilterItem
              value="with"
              current={state.attachments}
              onSelect={filters.setAttachments}
              onClose={onClose}
            />
            <AttachmentFilterItem
              value="without"
              current={state.attachments}
              onSelect={filters.setAttachments}
              onClose={onClose}
            />
          </Box>
        </FilterColumn>

        <FilterColumn label={MAIL_FILTER_GROUP_LABELS.counterparty}>
          <TextInput
            size="xs"
            placeholder={`${MAIL_COUNTERPARTY_FIELD_LABELS[mailType]}…`}
            aria-label={MAIL_FILTER_GROUP_LABELS.counterparty}
            value={state.counterparty}
            onChange={(e) => filters.setCounterparty(e.currentTarget.value)}
          />
        </FilterColumn>

        <FilterColumn label={MAIL_FILTER_GROUP_LABELS.relations}>
          <Box className="mail-filters-column__body">
            <FilterOption
              active={state.hasRelations}
              marker={state.hasRelations ? <CheckMarker active /> : <IconLink size={16} />}
              onSelect={filters.toggleHasRelations}
              onClose={onClose}
            >
              Есть связанные письма
            </FilterOption>
          </Box>
        </FilterColumn>
      </Box>

      {/* Сброс всех групп — под сеткой, внутри панели. */}
      <Box className="mail-filters-footer">
        <FilterOption
          active={false}
          danger
          disabled={filters.activeCount === 0}
          marker={<IconX size={16} />}
          onSelect={filters.resetAll}
          closeOnSelect
          onClose={onClose}
        >
          Сбросить все фильтры
        </FilterOption>
      </Box>
    </>
  );
}
