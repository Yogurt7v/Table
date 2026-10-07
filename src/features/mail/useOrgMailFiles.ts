import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { pb } from '@/api/client';
import { MAIL_FILES_COLLECTION, MAIL_RELATIONS_COLLECTION } from '@/api/mail';
import type { IMailFile, IMailRelation, MailType } from '@/shared/types';

/**
 * Все вложения организации, одним запросом — по образцу `useOrgInvoiceFiles`.
 * `src/api/mail.ts` читает вложения только по одному письму (`getMailFiles`),
 * потому что `mail_files` намеренно полиморфен и не expandable; для реестра
 * такой запрос означал бы N+1, а для фильтра «Без вложений» — вообще
 * невозможен: `MailListParams` умеет только `withFiles`.
 *
 * Забирается ещё и `name` — то, что приложение пишет при загрузке, то есть
 * исходное имя файла, а не сгенерированное хранилищем (`14fe4ylaef_5rkmxywj5j.pdf`).
 * Поле не «лишнее» ради ссылок на скачивание: колонка «Файлы» печатает имя в
 * ячейке, поэтому счётчика без названия ей недостаточно. Дополнительного
 * запроса не появляется — имена и счётчик считаются из одного и того же
 * массива двумя мемо, а ссылки по-прежнему строит модалка через `useMailFiles`.
 *
 * `uploadMailFiles` создаёт по записи на каждый файл, поэтому у записи в норме
 * ровно одно `name`; `file` — multiple до десяти файлов, и если запись заводят
 * мимо загрузчика, имён на неё всё равно столько же, сколько записей.
 * Отсчёт по записям, а не по `file.length`, — на нём стоит фильтр
 * «Без вложений», и менять эту величину нельзя.
 */
export function useOrgMailFiles(orgId: string) {
  const query = useQuery({
    queryKey: ['mail_files_org', orgId],
    queryFn: () =>
      pb.collection(MAIL_FILES_COLLECTION).getFullList<IMailFile>({
        filter: `organization_id = "${orgId}"`,
        fields: 'id,mail_id,mail_type,organization_id,file,name,created',
      }),
    enabled: !!orgId,
  });

  /** `mailId → число вложений`, только для текущего регистра. */
  const countsByMailId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const file of query.data ?? []) {
      counts.set(file.mail_id, (counts.get(file.mail_id) ?? 0) + 1);
    }
    return counts;
  }, [query.data]);

  /**
   * `mailId → отображаемые имена вложений`, из того же ответа и в том же
   * порядке, что записи. Пустое имя пропускается — но только здесь: запись с
   * таким именем обязана остаться в `countsByMailId`, иначе письмо с вложением
   * выпало бы из фильтра «Без вложений».
   */
  const namesByMailId = useMemo(() => {
    const names = new Map<string, string[]>();
    for (const file of query.data ?? []) {
      const name = (file.name || '').trim();
      if (!name) continue;
      const list = names.get(file.mail_id);
      if (list) {
        list.push(name);
      } else {
        names.set(file.mail_id, [name]);
      }
    }
    return names;
  }, [query.data]);

  return { ...query, countsByMailId, namesByMailId };
}

/**
 * Письма организации, участвующие хотя бы в одной связи, — по одному запросу
 * на организацию вместо запроса на каждое письмо.
 *
 * Существует по той же причине, что и `useOrgMailFiles`: фильтр «Есть связанные
 * письма» должен знать, у каких писем есть связь, а перебирать реестр по одному
 * письму нельзя. Возвращаются оба регистра сразу — строка связи хранит четыре
 * id, и выбирается нужная пара по `mailType`.
 */
export function useOrgMailRelationIds(orgId: string) {
  const query = useQuery({
    queryKey: ['mail_relations_org', orgId],
    queryFn: () =>
      pb.collection(MAIL_RELATIONS_COLLECTION).getFullList<IMailRelation>({
        filter: `organization_id = "${orgId}"`,
        fields:
          'id,parent_incoming_mail_id,child_incoming_mail_id,parent_outgoing_mail_id,child_outgoing_mail_id',
      }),
    enabled: !!orgId,
  });

  const linkedByType = useMemo(() => {
    const map: Record<MailType, Set<string>> = {
      incoming: new Set<string>(),
      outgoing: new Set<string>(),
    };
    for (const relation of query.data ?? []) {
      for (const id of [relation.parent_incoming_mail_id, relation.child_incoming_mail_id]) {
        if (id) map.incoming.add(id);
      }
      for (const id of [relation.parent_outgoing_mail_id, relation.child_outgoing_mail_id]) {
        if (id) map.outgoing.add(id);
      }
    }
    return map;
  }, [query.data]);

  return { ...query, linkedByType };
}

/**
 * Отбор по вложениям для уже загруженной страницы. Пока организация не
 * загружена, ничего не убирается — иначе на первом рендере таблица моргнула бы
 * пустой.
 *
 * Фильтр применяется здесь, а не через `withFiles` в `MailListParams`:
 * `applyClientOnlyMailFlags` ищет вложения фильтром `mail_id ?= {id1,id2,…}`,
 * а PocketBase отвечает на список в `?=` ошибкой 400 — запрос реестра падал
 * целиком и таблица выглядела пустой. Свойство API верное, форма фильтра —
 * нет, и правится это в `src/api/mail.ts`, который здесь не трогается.
 */
export function filterByAttachments<T extends { id: string }>(
  items: T[],
  countsByMailId: Map<string, number>,
  mode: 'any' | 'with' | 'without',
  loaded: boolean,
): T[] {
  if (mode === 'any' || !loaded) return items;
  return mode === 'with'
    ? items.filter((item) => countsByMailId.has(item.id))
    : items.filter((item) => !countsByMailId.has(item.id));
}

/** То же для связей; причина локального отбора — та же, что у вложений. */
export function filterByRelations<T extends { id: string }>(
  items: T[],
  linkedIds: Set<string>,
  enabled: boolean,
): T[] {
  if (!enabled) return items;
  return items.filter((item) => linkedIds.has(item.id));
}
