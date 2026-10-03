/**
 * §A4.6 — per-recipient reconciliation progress, plus §A4.13's flags.
 *
 * **Every figure here is the kernel's.** The panel is handed one
 * `FieldReconciliation` value, computed in render by `reconcileFields` from the
 * recipient rows and the placed boxes, and it reads `required`, `placed`,
 * `missing`, `excess`, `excess_field_ids` and `orphan_field_ids` off it. There
 * is no counting, no subtraction and no comparison anywhere in this file: the
 * invariant §A4.9 states is the kernel's to answer, and this is the rendering of
 * that answer. Nothing is stored, so the panel cannot disagree with the boxes
 * on the page (§A3.9, one case later).
 *
 * The line is §A4.6's own example, verbatim in shape:
 *
 *     Rina Halim — Signature 1/2 · eMeterai 0/1
 *
 * and both directions are marked, because §A4.6 asks for both: a SHORTFALL says
 * how many are still to place, an EXCESS says how many to remove and names
 * them. A satisfied row says so rather than saying nothing, so "complete" and
 * "not yet looked at" are never the same rendering.
 *
 * **§A4.12 is stated on screen, not only in a comment.** The charge comes from
 * the counts and never from the number of boxes; mismatched boxes make the
 * document invalid, they do not change the bill. That sentence is here because
 * this is the one screen where a user can see the two numbers differ and would
 * otherwise reasonably assume the smaller one is what they pay for.
 *
 * **§A4.13 / §B7.13 — flagged, never dropped.** Excess boxes and orphaned
 * boxes are listed by owner with the kind and the count, in words. The decision
 * is stated in the panel itself, because "we kept your boxes and you need to
 * remove some" is only a notification if the user is told it.
 */

import type { FieldReconciliation, RecipientInput } from '@signed-doc/shared';

import { accessibleNameFor } from '../recipients/recipients-reducer.js';
import { FIELD_KIND_LABEL } from './field-view.js';

export const RECONCILIATION_REASON_ID = 'fields-reconciliation-reason';

export interface ReconciliationPanelProps {
  readonly report: FieldReconciliation;
  readonly recipients: readonly RecipientInput[];
}

/** §A4.6's line, as one string so it can be asserted as one string. */
export function progressLine(
  who: string,
  row: FieldReconciliation['rows'][number],
): string {
  return (
    `${who} — ${FIELD_KIND_LABEL.signature} ${row.placed.signature}/${row.required.signature}` +
    ` · ${FIELD_KIND_LABEL.meterai} ${row.placed.meterai}/${row.required.meterai}`
  );
}

/** A shortfall, worded per kind. `null` when this kind is not short. */
export function shortfallNote(kind: 'signature' | 'meterai', missing: number): string | null {
  if (missing <= 0) return null;
  const label = FIELD_KIND_LABEL[kind];
  return missing === 1
    ? `1 ${label} field still to place`
    : `${missing} ${label} fields still to place`;
}

/** An excess, worded per kind, and it says what to do about it (§A4.13). */
export function excessNote(kind: 'signature' | 'meterai', excess: number): string | null {
  if (excess <= 0) return null;
  const label = FIELD_KIND_LABEL[kind];
  return excess === 1
    ? `1 ${label} field too many — remove it, or raise the count on Step 2`
    : `${excess} ${label} fields too many — remove them, or raise the count on Step 2`;
}

export function ReconciliationPanel({ report, recipients }: ReconciliationPanelProps): JSX.Element {
  const orphanCount = report.orphan_field_ids.length;

  return (
    <section className="reconcile" aria-labelledby="reconcile-heading">
      <div className="reconcile__head">
        <h2 id="reconcile-heading">Fields placed</h2>
        <span className={report.satisfied ? 'reconcile__badge reconcile__badge--ok' : 'reconcile__badge'}>
          {report.satisfied ? 'Matches the counts' : 'Does not match yet'}
        </span>
      </div>

      {/* Both totals, each naming its own resource, as §A3.8 does for quota. */}
      <p className="reconcile__totals">
        {`${FIELD_KIND_LABEL.signature} ${report.placed.signature}/${report.required.signature}` +
          ` · ${FIELD_KIND_LABEL.meterai} ${report.placed.meterai}/${report.required.meterai}` +
          ` · ${report.field_count} ${report.field_count === 1 ? 'box' : 'boxes'} on the page`}
      </p>

      <ul className="reconcile__rows">
        {report.rows.map((row) => {
          const recipient = recipients[row.recipient_index];
          const who = recipient
            ? accessibleNameFor(recipient, row.recipient_index)
            : row.recipient_email;
          const state = row.satisfied
            ? 'satisfied'
            : row.excess.signature + row.excess.meterai > 0
              ? 'excess'
              : 'short';

          const notes = [
            shortfallNote('signature', row.missing.signature),
            shortfallNote('meterai', row.missing.meterai),
            excessNote('signature', row.excess.signature),
            excessNote('meterai', row.excess.meterai),
          ].filter((note): note is string => note !== null);

          return (
            <li className="reconcile__row" key={row.recipient_index} data-state={state}>
              <span className="reconcile__line">{progressLine(who, row)}</span>
              {row.satisfied ? (
                <span className="reconcile__marker reconcile__marker--ok">Complete</span>
              ) : (
                <ul className="reconcile__notes">
                  {notes.map((note) => (
                    <li className="reconcile__marker" key={note}>
                      {note}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {/*
        §A4.10 / §B7.13 — boxes whose owner is not on the list. They are kept
        and reported, never cascade-deleted; the kernel's `orphan_field_ids` is
        that decision made renderable.
      */}
      {orphanCount > 0 ? (
        <div className="reconcile__orphans" role="status">
          <p className="reconcile__orphans-head">
            {orphanCount === 1
              ? '1 box belongs to somebody who is no longer a recipient'
              : `${orphanCount} boxes belong to somebody who is no longer a recipient`}
          </p>
          <p className="reconcile__orphans-body">
            They were kept exactly where you placed them rather than deleted. Remove them with the
            × on each box, or add that recipient back on Step 2.
          </p>
        </div>
      ) : null}

      {/* §A4.12 — said out loud on the one screen where it could be doubted. */}
      <p className="reconcile__note">
        The charge is computed from the counts on Step 2, never from the number of boxes here.
        Boxes that do not match the counts make the document invalid; they do not change the bill.
      </p>
    </section>
  );
}
