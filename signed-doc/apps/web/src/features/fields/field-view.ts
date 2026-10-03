/**
 * How a placed field is LABELLED and LAID OUT. Pure, React-free, uncached —
 * recomputed in render like `derive.ts` and `step-groups.ts` beside it, so a
 * box on screen can no more drift from the state than a total can.
 *
 * **It decides nothing about geometry.** Every number that reaches a `style`
 * comes from the kernel's `CONTENT_AREA`, `PAGE_SIZE`, `PAGE_PADDING` and
 * `FIELD_SIZES`. §B2's `632 x 588` content area is itself derived in the kernel
 * from the page size and the padding, so a literal `632` anywhere in this
 * package would be a second source of truth for a number that already has one.
 *
 * **§A4.3 — a box says its kind AND its owner, in TEXT.** Colour alone is not
 * enough, so every box carries three readable things: the kind's name, the
 * owner's initials, and the owner's full identity. The initials are the
 * mockup's own treatment (board 3 draws a small round avatar inside the box);
 * they are an addition to the name, never a replacement for it.
 */

import {
  CONTENT_AREA,
  FIELD_SIZES,
  PAGE_PADDING,
  PAGE_SIZE,
  fieldSizeOf,
  normalizeEmail,
  type FieldInput,
  type FieldKind,
} from '@signed-doc/shared';

/**
 * §A4.1/§A4.3/§B5 — what each kind is CALLED on screen.
 *
 * `eMeterai` is capitalized exactly as the brief and the mockup write it, and
 * exactly as the kernel's own rejection messages write it, so the palette
 * button, the box, the progress line and a `422` all name one thing.
 */
export const FIELD_KIND_LABEL: Readonly<Record<FieldKind, string>> = {
  signature: 'Signature',
  meterai: 'eMeterai',
};

/** The owner's initials for the box's avatar — at most two, upper case. */
export function initialsOf(name: string, fallback: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    const stem = fallback.trim();
    return stem === '' ? '?' : stem.slice(0, 1).toUpperCase();
  }
  return parts
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join('');
}

/**
 * §A4.4 — the remove button's accessible name, which must name the KIND and the
 * OWNER. Worded verbatim from mockup board 3 (`Remove {kind} field for
 * {owner}`), so the string a screen reader hears is the string the design
 * specified.
 */
export function removeFieldLabel(kind: FieldKind, owner: string): string {
  return `Remove ${FIELD_KIND_LABEL[kind]} field for ${owner}`;
}

/** The focusable box's accessible name — kind, owner and position (§A4.3/§A4.5). */
export function fieldBoxLabel(field: FieldInput, owner: string): string {
  return `${FIELD_KIND_LABEL[field.kind]} field for ${owner}, at x ${field.x}, y ${field.y}`;
}

/** The DOM id of one placed box, so focus can be restored to it (§B7.19). */
export function fieldBoxId(fieldId: string): string {
  return `field-box-${fieldId}`;
}

/** §B2 — the page, exactly as the kernel sizes it. No literal dimension here. */
export const pageStyle = {
  width: `${PAGE_SIZE.width}px`,
  height: `${PAGE_SIZE.height}px`,
  paddingTop: `${PAGE_PADDING.top}px`,
  paddingRight: `${PAGE_PADDING.right}px`,
  paddingBottom: `${PAGE_PADDING.bottom}px`,
  paddingLeft: `${PAGE_PADDING.left}px`,
} as const;

/**
 * §B2 — the content area `x`/`y` are relative to, as its own positioned box.
 *
 * This is what makes "the field's top-left coordinates relative to the content
 * area, not the viewport" true of the DOM rather than only of the state: the
 * boxes are absolutely positioned inside THIS element, so `left: x` is `x`
 * content-area units and nothing has to subtract the padding back out.
 */
export const contentAreaStyle = {
  position: 'relative',
  width: `${CONTENT_AREA.width}px`,
  height: `${CONTENT_AREA.height}px`,
} as const;

/** One box: its kind's size (§B2) at its own clamped position (§B3). */
export function fieldStyle(field: FieldInput): {
  readonly left: string;
  readonly top: string;
  readonly width: string;
  readonly height: string;
} {
  const size = fieldSizeOf(field.kind);
  return {
    left: `${field.x}px`,
    top: `${field.y}px`,
    width: `${size.width}px`,
    height: `${size.height}px`,
  };
}

/** The palette button's size hint — `212 × 88` / `112 × 112`, read from §B2. */
export function fieldSizeHint(kind: FieldKind): string {
  const { width, height } = FIELD_SIZES[kind];
  return `${width} × ${height}`;
}

/**
 * Who a field belongs to, as a person rather than an address.
 *
 * The recipient's typed name when there is one, their email when there is not,
 * and the stored address when they are not on the list at all — which is the
 * orphan case (§A4.10/§B7.13) and the one where showing the raw email is the
 * most useful thing the box can say.
 */
export function ownerDisplayName(
  email: string,
  recipients: readonly { readonly name: string; readonly email: string }[],
): string {
  const normalized = normalizeEmail(email);
  const owner = recipients.find((r) => normalizeEmail(r.email) === normalized);
  if (!owner) return normalized === '' ? 'nobody' : normalized;
  const name = owner.name.trim();
  return name === '' ? normalized : name;
}
