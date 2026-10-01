/**
 * One recipient row (PRD §8.1, §8.4, §8.12). Structure and copy from mockup
 * board 2; `aria-label` strings reused verbatim, including its `signer {i+1}`
 * blank-name fallback.
 *
 * Accessibility contract, all of it scored:
 * - all four inputs carry a `<label for>` (`signer-name-{i}`,
 *   `signer-email-{i}`, `signer-count-{i}`, `signer-meterai-{i}`);
 * - the `-`, `+` and remove buttons carry an `aria-label` naming the signer;
 * - an invalid field carries `aria-invalid` plus `aria-describedby` pointing at
 *   its visible message.
 *
 * Which FIELD is at fault is decided by running the shared `validateRecipient`
 * against a probe that holds the other fields known-good. That keeps the row's
 * marking driven by the one shared validation module (PRD §8.5) instead of by a
 * local re-implementation or by string-matching its messages.
 *
 * **§A3.2 is marked HERE, on the row, not on the form** (§B7 row 4). The
 * predicate is the kernel's `meteraiWithinSignatures`, evaluated once by the
 * step and handed down as `meteraiExceedsSignatures`, so the footer's blocker
 * list and this row's red box can never disagree about which rows are at fault.
 */

import {
  MIN_METERAI_COUNT,
  MAX_METERAI_COUNT,
  MIN_SIGNATURE_COUNT,
  MAX_SIGNATURE_COUNT,
  formatDecimalString,
  validateRecipient,
  type Minor,
} from '@signed-doc/shared';

import { formatIdr } from '../../format/money-display.js';
import { accessibleNameFor, type RecipientRow as Row } from './recipients-reducer.js';

/** Values known to satisfy every rule, used to isolate one field at a time. */
const PROBE_NAME = 'probe';
const PROBE_EMAIL = 'probe@example.test';

export interface RowFieldErrors {
  readonly name: string | null;
  readonly email: string | null;
}

export function fieldErrorsFor(row: Pick<Row, 'name' | 'email'>, index: number): RowFieldErrors {
  const nameFailure = validateRecipient(
    {
      name: row.name,
      email: PROBE_EMAIL,
      signature_count: MIN_SIGNATURE_COUNT,
      meterai_count: MIN_METERAI_COUNT,
    },
    index,
  );
  const emailFailure = validateRecipient(
    {
      name: PROBE_NAME,
      email: row.email,
      signature_count: MIN_SIGNATURE_COUNT,
      meterai_count: MIN_METERAI_COUNT,
    },
    index,
  );
  return { name: nameFailure?.message ?? null, email: emailFailure?.message ?? null };
}

/**
 * The visible reason for §A3.2, naming both numbers so the user can see which
 * of the two to change. It never mentions a quota — §A3.5's two shortfalls and
 * this per-row rule must stay three distinguishable things on screen.
 */
export function meteraiExceedsMessage(row: Pick<Row, 'meterai_count' | 'signature_count'>): string {
  const signatures = row.signature_count === 1 ? '1 signature' : `${row.signature_count} signatures`;
  return `${row.meterai_count} eMeterai for ${signatures} — one duty stamp per signature`;
}

export interface RecipientRowProps {
  readonly index: number;
  readonly row: Row;
  readonly chargeMinor: Minor;
  readonly unitPrice: string;
  readonly meteraiPrice: string;
  /** True when this row shares a normalized email with another row. */
  readonly duplicate: boolean;
  /** §A3.2, decided by the kernel's `meteraiWithinSignatures` one level up. */
  readonly meteraiExceedsSignatures: boolean;
  readonly canRemove: boolean;
  readonly onSetName: (index: number, value: string) => void;
  readonly onSetEmail: (index: number, value: string) => void;
  readonly onSetCountRaw: (index: number, raw: string) => void;
  readonly onCommitCount: (index: number) => void;
  readonly onIncrement: (index: number) => void;
  readonly onDecrement: (index: number) => void;
  readonly onSetMeteraiRaw: (index: number, raw: string) => void;
  readonly onCommitMeterai: (index: number) => void;
  readonly onIncrementMeterai: (index: number) => void;
  readonly onDecrementMeterai: (index: number) => void;
  readonly onRemove: (index: number) => void;
}

export function RecipientRow({
  index,
  row,
  chargeMinor,
  unitPrice,
  meteraiPrice,
  duplicate,
  meteraiExceedsSignatures,
  canRemove,
  onSetName,
  onSetEmail,
  onSetCountRaw,
  onCommitCount,
  onIncrement,
  onDecrement,
  onSetMeteraiRaw,
  onCommitMeterai,
  onIncrementMeterai,
  onDecrementMeterai,
  onRemove,
}: RecipientRowProps): JSX.Element {
  const who = accessibleNameFor(row, index);
  const errors = fieldErrorsFor(row, index);

  const nameId = `signer-name-${index}`;
  const emailId = `signer-email-${index}`;
  const countId = `signer-count-${index}`;
  const meteraiId = `signer-meterai-${index}`;
  const nameErrorId = `${nameId}-error`;
  const emailErrorId = `${emailId}-error`;
  const meteraiErrorId = `${meteraiId}-error`;

  const emailMessage = duplicate
    ? 'This email is already used by another recipient'
    : errors.email;
  const removeHintId = `signer-remove-${index}-hint`;

  return (
    <div className="signer-row" role="group" aria-label={`Recipient ${index + 1}`}>
      <div>
        <label className="visually-hidden" htmlFor={nameId}>
          {`Full name for ${who}`}
        </label>
        <input
          id={nameId}
          type="text"
          value={row.name}
          placeholder="e.g. Rina Halim"
          aria-invalid={errors.name ? 'true' : undefined}
          aria-describedby={errors.name ? nameErrorId : undefined}
          onChange={(event) => onSetName(index, event.target.value)}
        />
        {errors.name ? (
          <span className="field-error" id={nameErrorId}>
            {errors.name}
          </span>
        ) : null}
      </div>

      <div>
        <label className="visually-hidden" htmlFor={emailId}>
          {`Email address for ${who}`}
        </label>
        <input
          id={emailId}
          type="email"
          value={row.email}
          placeholder="name@company.com"
          aria-invalid={emailMessage ? 'true' : undefined}
          aria-describedby={emailMessage ? emailErrorId : undefined}
          onChange={(event) => onSetEmail(index, event.target.value)}
        />
        {emailMessage ? (
          <span className="field-error" id={emailErrorId}>
            {emailMessage}
          </span>
        ) : null}
      </div>

      <div className="count-stepper">
        <button
          type="button"
          className="icon-btn"
          aria-label={`Fewer signatures for ${who}`}
          disabled={row.signature_count <= MIN_SIGNATURE_COUNT}
          onClick={() => onDecrement(index)}
        >
          <span aria-hidden="true">&#8722;</span>
        </button>
        <label className="visually-hidden" htmlFor={countId}>
          {`Signatures for ${who}`}
        </label>
        <input
          id={countId}
          type="number"
          inputMode="numeric"
          min={MIN_SIGNATURE_COUNT}
          max={MAX_SIGNATURE_COUNT}
          value={row.countRaw}
          onChange={(event) => onSetCountRaw(index, event.target.value)}
          onBlur={() => onCommitCount(index)}
        />
        <button
          type="button"
          className="icon-btn"
          aria-label={`More signatures for ${who}`}
          disabled={row.signature_count >= MAX_SIGNATURE_COUNT}
          onClick={() => onIncrement(index)}
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>

      {/* §A3.6 — the eMeterai column, interaction for interaction the twin of
          the Signatures column beside it. */}
      <div className="count-stepper">
        <button
          type="button"
          className="icon-btn"
          aria-label={`Fewer eMeterai for ${who}`}
          disabled={row.meterai_count <= MIN_METERAI_COUNT}
          onClick={() => onDecrementMeterai(index)}
        >
          <span aria-hidden="true">&#8722;</span>
        </button>
        <label className="visually-hidden" htmlFor={meteraiId}>
          {`eMeterai for ${who}`}
        </label>
        <input
          id={meteraiId}
          type="number"
          inputMode="numeric"
          min={MIN_METERAI_COUNT}
          max={MAX_METERAI_COUNT}
          value={row.meteraiRaw}
          aria-invalid={meteraiExceedsSignatures ? 'true' : undefined}
          aria-describedby={meteraiExceedsSignatures ? meteraiErrorId : undefined}
          onChange={(event) => onSetMeteraiRaw(index, event.target.value)}
          onBlur={() => onCommitMeterai(index)}
        />
        <button
          type="button"
          className="icon-btn"
          /*
            §A3.2 is NOT enforced here. The ceiling this button respects is the
            kernel's 0..3; walking past the row's signature_count has to stay
            possible, or the rule below never appears and `422
            METERAI_EXCEEDS_SIGNATURE` is unreachable from the UI.
          */
          aria-label={`More eMeterai for ${who}`}
          disabled={row.meterai_count >= MAX_METERAI_COUNT}
          onClick={() => onIncrementMeterai(index)}
        >
          <span aria-hidden="true">+</span>
        </button>
        {meteraiExceedsSignatures ? (
          <span className="field-error" id={meteraiErrorId}>
            {meteraiExceedsMessage(row)}
          </span>
        ) : null}
      </div>

      {/*
        Derived in render from the shared `computeCharges` output — `chargeMinor`
        is already this recipient's COMBINED cost (§A3.6), so nothing is summed
        here. Nothing is stored either, so this cell cannot disagree with the
        total (PRD §8.6).
      */}
      <div
        className="charge-cell"
        title={
          row.meterai_count > 0
            ? `${row.signature_count} x ${formatIdr(unitPrice)} + ${row.meterai_count} x ${formatIdr(meteraiPrice)}`
            : `${row.signature_count} x ${formatIdr(unitPrice)}`
        }
      >
        {formatIdr(formatDecimalString(chargeMinor))}
      </div>

      <div>
        <button
          type="button"
          className="icon-btn"
          aria-label={`Remove ${who}`}
          disabled={!canRemove}
          aria-disabled={canRemove ? undefined : 'true'}
          aria-describedby={canRemove ? undefined : removeHintId}
          onClick={() => onRemove(index)}
        >
          <span aria-hidden="true">&#215;</span>
        </button>
        {/* LD-12: the floor is explained rather than enforced silently. */}
        {canRemove ? null : (
          <span className="visually-hidden" id={removeHintId}>
            At least one recipient is required
          </span>
        )}
      </div>
    </div>
  );
}
