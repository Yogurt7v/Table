import { useQuery } from '@tanstack/react-query';
import { getOrgCounterpartyVocabulary } from '@/api/mail';

/**
 * Постоянная пустая ссылка вместо `?? []` в месте вызова: пока словарь не пришёл,
 * модалка всё равно ничего не предлагает, но `data` не должен менять идентичность
 * на каждом рендере — иначе `Autocomplete` пересобирает выпадающий список впустую.
 */
const NO_COUNTERPARTIES: string[] = [];

/**
 * Словарь контрагентов организации — подсказки для поля «Отправитель»/
 * «Получатель». Один словарь на обе вкладки: отдельных коллекций отправителей,
 * получателей и контрагентов нет, это три поля трёх регистров
 * (`incoming_mails.sender`, `outgoing_mails.recipient`, `invoices.counterparty`),
 * и в почте назвать нового контрагента можно и там, где он до этого не встречался.
 *
 * Задержку, которую видно в счетах (`useCounterpartySearch`), создаёт не сам
 * `Autocomplete`, а формат данных: там после каждой нажатой клавиши летит запрос
 * в сервер, который заново скачивает весь реестр и уже у себя отбирает подходящее
 * (`searchCounterparties` в `src/api/collections.ts`) — с ожиданием 700 мс поверх
 * этого оборота. Здесь оборота нет: словарь приезжает один раз на организацию, а
 * `Autocomplete` фильтрует уже полученный список локально, тем же
 * `toLowerCase().includes()`, который корректно сворачивает регистр кириллицы.
 * Поэтому здесь НЕТ никакого debounce — задерживать нечего, а таймер перед
 * локальной фильтрацией только добавил бы её сам.
 *
 * `staleTime` в 10 минут — по той же причине: словарь меняется, только когда кто-то
 * вводит нового контрагента, и за подсказкой он всё равно уедет к серверу при
 * следующем открытии формы.
 *
 * `enabled` приходит от вызывающей стороны (`formTarget !== null` в
 * `MailSection`): форму открывают чаще, чем вводят контрагента, и словарь не
 * должен качаться при каждом открытии `/mail`. Ровно тот же приём, что у
 * `useAllIncomingMails`.
 */
export function useOrgCounterparties(orgId: string, enabled = true) {
  const query = useQuery({
    queryKey: ['mailCounterpartyVocabulary', orgId],
    queryFn: () => getOrgCounterpartyVocabulary(orgId),
    enabled: !!orgId && enabled,
    staleTime: 10 * 60_000,
  });

  return { ...query, counterpartyOptions: query.data ?? NO_COUNTERPARTIES };
}
