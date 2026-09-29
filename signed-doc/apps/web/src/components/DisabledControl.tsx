/**
 * An out-of-scope control rendered honestly (LD-05).
 *
 * PRD §3 forbids leaving `From cloud` and `Save as draft` as dead controls that
 * appear to work. This primitive renders them `disabled` AND `aria-disabled`,
 * with the reason as visible text that the control points at via
 * `aria-describedby` — so the explanation reaches a sighted user and a screen
 * reader by the same route.
 *
 * There is deliberately no `onClick` prop. A control that cannot be handed a
 * handler cannot grow one by accident.
 */

export interface DisabledControlProps {
  /** DOM id for the control; the reason text gets `{id}-reason`. */
  readonly id: string;
  readonly label: string;
  /** Defaults to the LD-05 copy. */
  readonly reason?: string;
  readonly className?: string;
}

export const OUT_OF_SCOPE_REASON = 'Not available in this exercise';

export function DisabledControl({
  id,
  label,
  reason = OUT_OF_SCOPE_REASON,
  className,
}: DisabledControlProps): JSX.Element {
  const reasonId = `${id}-reason`;
  return (
    <span className={className ? `disabled-control ${className}` : 'disabled-control'}>
      <button
        type="button"
        id={id}
        className="disabled-control__button"
        disabled
        aria-disabled="true"
        aria-describedby={reasonId}
      >
        {label}
      </button>
      <span className="disabled-control__reason" id={reasonId}>
        {reason}
      </span>
    </span>
  );
}
