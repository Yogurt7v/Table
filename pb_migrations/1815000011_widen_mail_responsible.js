/// <reference path="../pb_data/types.d.ts" />

// Widen the `responsible` fields of the mail subsystem.
//
// The bug: `responsible` was created as `type: "text", max: 15` (see
// `1815000001_created_incoming_mails.js` and its three twins), but the storage
// contract is a comma-joined list of PocketBase user ids, not a single id.
// `MailFormModal.tsx` is a Mantine `MultiSelect` with `maxValues={6}` and
// `MailSection.handleSave` persists the selection as `values.join(',')`.
// A PocketBase id is `[a-z0-9]{15}` — exactly 15 characters — so `max: 15`
// held precisely one person and the separator overflowed the column on the
// second one. Verified live against org `yvyg08lk9b61me0`, collection
// `incoming_mails`:
//
//   responsible = "1jyvy0zckcg8qij"                -> 200, record created
//   responsible = "1jyvy0zckcg8qij,3i4nu9zbh4j9260" -> 400
//     data.responsible = { code: "validation_max_text_constraint",
//                          message: "Must be no more than 15 character(s).",
//                          params: { max: 15 } }
//
// Nothing on the client needed changing: `toMailForm` / `incomingToForm` /
// `outgoingToForm` pass `mail.responsible` through verbatim, the modal splits
// on `,`, `buildMailFilter` already emits `(responsible ~ "u1") || ...`, and
// the table and cards render the joined `responsible_name`. The column was the
// only thing lying about how many people fit.
//
// Sizing, from the actual data rather than from a guess:
//   responsible      6 ids worst case = 6 * 15 + 5 separators      = 95 chars
//   responsible_name `users.name` allows max 255, and the UI joins with
//                    ", ", so 6 names worst case = 6 * 255 + 5 * 2   = 1540 chars
// The realistic joined-names value in this org is 106 chars and would have fit
// the old 200, but 200 is not a bound the schema can guarantee: the joined
// length is the sum of values the schema never constrained together, so a 200
// cap is the same latent 400 one rename away. Hence 1600 (a round number just
// above the 1540 worst case) rather than 200.
//
// Why the archives are in the list: `deleteIncomingMail` / `deleteOutgoingMail`
// in `src/api/mail.ts` snapshot `responsible` and `responsible_name` verbatim
// into `deleted_incoming_mails` / `deleted_outgoing_mails`, and
// `restoreDeletedIncomingMail` / `restoreDeletedOutgoingMail` write them back.
// Leaving the two archives at `max: 15` would mean a two-person letter can be
// created and read but neither deleted nor archived, nor restored back — the
// error would simply move to the next write in the flow.
//
// Fields are looked up with `getByName` and mutated in place (no remove/add
// pair): PocketBase reuses an existing text field whose constraint changed, so
// the column and its data survive. A missing collection or field makes
// `findCollectionByNameOrId` / `getByName` throw and aborts the migration
// loudly — deliberately no `if (!collection) continue`, which would hide a typo
// in MAIL_COLLECTIONS behind a silently skipped collection.

const RESPONSIBLE_MAX = 200
const RESPONSIBLE_NAME_MAX = 1600

// Values before this migration, restored by the `down` half.
const RESPONSIBLE_MAX_PREV = 15
const RESPONSIBLE_NAME_MAX_PREV = 200

const MAIL_COLLECTIONS = [
  'incoming_mails',
  'outgoing_mails',
  'deleted_incoming_mails',
  'deleted_outgoing_mails',
]

migrate(
  (app) => {
    for (const name of MAIL_COLLECTIONS) {
      const collection = app.findCollectionByNameOrId(name)

      collection.fields.getByName('responsible').max = RESPONSIBLE_MAX
      collection.fields.getByName('responsible_name').max = RESPONSIBLE_NAME_MAX

      app.save(collection)
    }
  },
  (app) => {
    for (const name of MAIL_COLLECTIONS) {
      const collection = app.findCollectionByNameOrId(name)

      collection.fields.getByName('responsible').max = RESPONSIBLE_MAX_PREV
      collection.fields.getByName('responsible_name').max = RESPONSIBLE_NAME_MAX_PREV

      app.save(collection)
    }
  },
)
