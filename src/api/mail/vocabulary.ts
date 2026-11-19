/** Словарь контрагентов организации для автодополнения в формах почты. */

import { pb } from '../client.ts';
import type { IIncomingMail, IInvoice, IOutgoingMail } from '@/shared/types';
import { foldSearchText } from '@/shared/utils/search-text';
import { MAIL_INCOMING_COLLECTION, MAIL_OUTGOING_COLLECTION } from './constants.ts';
import { qTag } from './shared.ts';

/**
 * Merges every counterparty the organization has already named into one sorted
 * list of display-ready strings.
 *
 * NO TEXT FILTER IS PUSHED TO THE SERVER, BECAUSE NONE WOULD WORK. PocketBase
 * `~` is SQLite `LIKE`, which folds case for ASCII only, so Cyrillic comes back
 * case-SENSITIVE. Measured live on the dev org `yvyg08lk9b61me0`:
 *
 *   sender ~ "ленметрострой"   → 0 rows
 *   sender ~ "Ленметрострой"   → 1 row
 *
 * A server-side `~` would therefore match only the substring the user happened
 * to type, case and all — as an autocomplete it would return nothing for
 * "ленмет" and something for "Ленмет", which is worse than no suggestion
 * because it looks broken. So the vocabulary is read once per organization and
 * filtered in the browser, where `toLowerCase()` handles Cyrillic the way a
 * reader expects.
 *
 * The dedupe key is `foldSearchText`, NOT `toLowerCase()`. Company names in this
 * data are full of «» quotes and non-breaking / thin spaces (U+00A0 among them),
 * and `toLowerCase()` leaves NBSP distinct from an ordinary space — so
 * "ООО\u00a0«Ленметрострой»" and "ООО «Ленметрострой»" are two different keys and
 * both would reach the dropdown. `foldSearchText` collapses every invisible
 * space to a plain one first, which makes this key agree with what the two
 * filters downstream do with the same name: `matchesFolded` for the register
 * search, and `defaultOptionsFilter` (also `toLowerCase`-based) inside
 * `Autocomplete`'s own dropdown.
 *
 * The FIRST spelling seen is the one kept, hence the caller feeds senders
 * before recipients before invoice counterparties: when one and the same
 * organization appears in all three, the letter is where the full legal name
 * is written.
 *
 * Sorting is `localeCompare(…, 'ru')`, not the default code-point order: "ООО …"
 * has to sort as a word rather than by code unit, and «Ё» must land beside «Е»
 * instead of behind every «Я» row, which code-point order would do.
 */
export function mergeCounterpartyVocabulary(
  sources: readonly (readonly (string | null | undefined)[])[],
): string[] {
  const byFolded = new Map<string, string>();
  for (const source of sources) {
    for (const raw of source) {
      const name = raw?.trim();
      if (!name) continue;
      const folded = foldSearchText(name);
      if (!byFolded.has(folded)) byFolded.set(folded, name);
    }
  }
  return [...byFolded.values()].sort((a, b) => a.localeCompare(b, 'ru'));
}

/**
 * The organization's whole counterparty vocabulary, as one array. The mail form
 * hands the whole thing to `Autocomplete` as `data` and lets Mantine's own
 * dropdown filter it — that filter is `label.toLowerCase().includes(search…)`,
 * which is Cyrillic-safe, so nothing has to round-trip per keystroke.
 *
 * Three one-column reads, no text filter, `skipTotal` so PocketBase does not
 * spend an extra COUNT per batch (its `totalItems` is discarded anyway).
 * Deliberately unpaginated, and small by construction: the distinct cardinality
 * of `sender` ∪ `recipient` ∪ `counterparty` is bounded by the number of
 * counterparties the organization has, not by the number of letters or invoices
 * it has — measured on `yvyg08lk9b61me0`, 9 incoming + 5 outgoing + 90 invoices
 * collapse to 83 distinct names.
 *
 * `invoices` has no collection constant of its own (same as
 * `src/api/collections.ts`), so it is spelled literally here. The org filter
 * goes through `qTag` exactly like `buildMailFilter`, so a `"` in an org id
 * could not terminate the operand.
 */
export async function getOrgCounterpartyVocabulary(orgId: string): Promise<string[]> {
  const filter = `organization_id = "${qTag(orgId)}"`;
  const [incoming, outgoing, invoices] = await Promise.all([
    pb.collection(MAIL_INCOMING_COLLECTION).getFullList<IIncomingMail>({
      filter,
      fields: 'organization_id,sender',
      skipTotal: true,
    }),
    pb.collection(MAIL_OUTGOING_COLLECTION).getFullList<IOutgoingMail>({
      filter,
      fields: 'organization_id,recipient',
      skipTotal: true,
    }),
    pb.collection('invoices').getFullList<IInvoice>({
      filter,
      fields: 'organization_id,counterparty',
      skipTotal: true,
    }),
  ]);

  return mergeCounterpartyVocabulary([
    incoming.map((mail) => mail.sender),
    outgoing.map((mail) => mail.recipient),
    invoices.map((invoice) => invoice.counterparty),
  ]);
}
