/**
 * Step 3 — Place fields, wired (`test_2_en.md` §A4, §B7 rows 10-14 and 19).
 *
 * The companion of `field-placement.test.ts`: that suite owns the rules, this
 * one owns the WIRING — that the palette reaches the reducer, that the §A4.6
 * panel reaches the kernel, that the §A4.13 flags reach the screen, and that
 * the §B4 payload reaches the transport with `fields` on it. `fetch` is stubbed
 * to the §B4 wire contract rather than to a real process, because `apps/server`
 * was mid-change under a concurrent agent while this was written (see
 * `docs/evidence/web-tests.txt`).
 *
 * **§B7 row 19 is asserted on `document.activeElement`**, by a path that is
 * keyboard-only end to end: `Tab` to the palette control, `Enter` to activate
 * it. The focus restore in `FieldsStep` was disabled on purpose to confirm the
 * assertion FAILS without it, so it is testing the implementation and not a
 * jsdom coincidence.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { App } from '../App.js';

const RINA = 'rina.halim@example.test';
const BUDI = 'budi.santoso@example.test';
const DOC = 'vendor-service-agreement.pdf';

interface PreviewBody {
  readonly order_mode: string;
  readonly recipients: readonly { signature_count: number; meterai_count: number }[];
  readonly fields?: readonly { id: string; kind: string; recipient_email: string }[];
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function envelope() {
  return {
    envelope_id: 'env_01',
    document: { filename: DOC, size_bytes: 1_468_006, page_count: 1 },
    price: { signature: '5000.00', meterai: '10000.10' },
    quota: { signature: 8, meterai: 3 },
  };
}

/**
 * A `200` computed from whatever was sent, so one handler serves every payload
 * this suite walks through — including the ones produced by going `Back`,
 * editing a count and coming forward again.
 *
 * `field_count` is reported as what was SENT, which is what §B4 says it is, and
 * is `0` for a body that submitted no `fields` key at all.
 */
function previewOk(body: PreviewBody): Response {
  const signatures = body.recipients.reduce((n, r) => n + r.signature_count, 0);
  const meterai = body.recipients.reduce((n, r) => n + r.meterai_count, 0);
  return json(200, {
    order_mode: body.order_mode,
    steps: [{ step: 1, recipient_emails: [RINA, BUDI] }],
    recipient_count: body.recipients.length,
    total_signatures: signatures,
    total_meterai: meterai,
    field_count: body.fields?.length ?? 0,
    price: { signature: '5000.00', meterai: '10000.10' },
    charges: { signature: `${signatures * 5000}.00`, meterai: '0.00' },
    total_charge: `${signatures * 5000}.00`,
    quota: { signature: 8, meterai: 3 },
    quota_remaining: { signature: Math.max(0, 8 - signatures), meterai: Math.max(0, 3 - meterai) },
  });
}

function stubApi(preview: (body: PreviewBody) => Response = previewOk) {
  const bodies: PreviewBody[] = [];

  const impl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const path = String(input);
    if (path.endsWith('/charge-preview')) {
      const body = JSON.parse(String(init?.body)) as PreviewBody;
      bodies.push(body);
      return preview(body);
    }
    return json(201, envelope());
  };

  vi.stubGlobal('fetch', vi.fn(impl));
  return bodies;
}

const continueButton = () => screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;
const signerSelect = () => document.getElementById('field-signer') as HTMLSelectElement;
const paletteButton = (kind: 'signature' | 'meterai') =>
  document.getElementById(`field-palette-${kind}`) as HTMLButtonElement;
const fieldBoxes = () => [...document.querySelectorAll<HTMLElement>('.field-box')];
const canvas = () => document.getElementById('document-canvas') as HTMLElement;
const reconcileLines = () =>
  [...document.querySelectorAll('.reconcile__line')].map((node) => node.textContent);
/**
 * The §A4.6 panel, queried on its own.
 *
 * A live shortfall or excess is DELIBERATELY on screen twice — once as this
 * panel's per-recipient marker and once as the footer gate's reason, which is
 * also the `aria-describedby` target of the disabled `Check charges` (the same
 * two-place treatment §A3.5's quota shortfalls already get). So the panel is
 * scoped rather than searched for globally, and the gate copy is asserted
 * separately through `describedByText`.
 */
const panel = () => within(document.querySelector('.reconcile') as HTMLElement);

/** The text an `aria-describedby` actually resolves to on screen. */
function describedByText(element: HTMLElement): string {
  return (element.getAttribute('aria-describedby') ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');
}

/** Step 1 -> Step 2 -> (server confirm) -> Step 3, the way a user does it. */
async function reachStepThree(preview?: (body: PreviewBody) => Response) {
  const bodies = stubApi(preview);
  render(<App />);

  const input = document.getElementById('document-file') as HTMLInputElement;
  fireEvent.change(input, {
    target: { files: [new File([new Uint8Array(1024)], DOC, { type: 'application/pdf' })] },
  });
  await screen.findByText(DOC);

  fireEvent.click(continueButton());
  await screen.findByRole('heading', { name: 'Who signs it?' });

  // §A4 — `Continue` is two-phase: ask the server, then advance.
  fireEvent.click(continueButton());
  await screen.findByText('Server-confirmed');
  fireEvent.click(continueButton());
  await screen.findByRole('heading', { name: 'Place the fields' });

  return bodies;
}

/** Back to Step 2, run `edit`, then forward to Step 3 again. */
async function roundTripThroughStepTwo(edit: () => void): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  await screen.findByRole('heading', { name: 'Who signs it?' });
  edit();
  fireEvent.click(continueButton());
  await screen.findByText('Server-confirmed');
  fireEvent.click(continueButton());
  await screen.findByRole('heading', { name: 'Place the fields' });
}

/** Place one box for the currently selected signer, by pointer. */
function place(kind: 'signature' | 'meterai'): void {
  fireEvent.click(paletteButton(kind));
}

function selectSigner(email: string): void {
  fireEvent.change(signerSelect(), { target: { value: email } });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('§A4 — the screen, following mockup board 3', () => {
  it('unlocks stepper pill 3 and marks Place fields as the current step', async () => {
    await reachStepThree();

    const pills = [...document.querySelectorAll('.stepper__pill')];
    expect(pills).toHaveLength(3);
    expect(document.querySelector('[aria-current="step"]')?.textContent).toContain('Place fields');
    // The first two are complete, and none of the three is locked any more.
    expect(pills.map((pill) => pill.getAttribute('data-state'))).toEqual([
      'complete',
      'complete',
      'active',
    ]);
    for (const pill of pills) expect(pill.getAttribute('aria-disabled')).toBeNull();
  });

  it('§A4.1 — a labelled signer selector and a Signature + eMeterai palette', async () => {
    await reachStepThree();

    // PRD §8.12 carries over: every input has an associated label.
    expect(document.querySelector('label[for="field-signer"]')?.textContent).toContain('Signer');
    expect([...signerSelect().options].map((option) => option.value)).toEqual([RINA, BUDI]);
    expect(signerSelect().value).toBe(RINA);

    expect(paletteButton('signature').textContent).toContain('Signature');
    expect(paletteButton('meterai').textContent).toContain('eMeterai');
    // §B2's sizes are shown, read from the kernel.
    expect(paletteButton('signature').textContent).toContain('212 × 88');
    expect(paletteButton('meterai').textContent).toContain('112 × 112');
  });

  it('§A4.7 — Preview, Save as draft and Send are disabled WITH an explanation', async () => {
    await reachStepThree();

    for (const id of ['fields-preview', 'fields-save-as-draft', 'fields-send']) {
      const control = document.getElementById(id) as HTMLButtonElement;
      expect(control.disabled).toBe(true);
      expect(control.getAttribute('aria-disabled')).toBe('true');
      // Not a dead control: the reason is visible text the button points at.
      expect(describedByText(control).length).toBeGreaterThan(10);
    }

    // §A4.7 is explicit that `Send` does not send: the reason has to say so.
    const send = document.getElementById('fields-send') as HTMLButtonElement;
    const reason = describedByText(send);
    expect(reason).toContain('reserve quota');
    expect(reason).toContain('no email');
    expect(describedByText(document.getElementById('fields-preview') as HTMLButtonElement)).toContain(
      'outside this exercise',
    );
  });

  it('§B2 — the canvas is one page, sized and padded from the kernel', async () => {
    await reachStepThree();

    const page = document.querySelector('.doc-page') as HTMLElement;
    expect(page.style.width).toBe('760px');
    expect(page.style.height).toBe('700px');
    expect(page.style.paddingTop).toBe('56px');
    expect(page.style.paddingLeft).toBe('64px');

    // The content area the coordinates are relative to: 632 x 588.
    expect(canvas().style.width).toBe('632px');
    expect(canvas().style.height).toBe('588px');
  });
});

describe('§A4.2 / §B7 row 19 — placing a field entirely by keyboard', () => {
  it('reaches the palette by Tab, places with Enter, and does NOT lose focus', async () => {
    const user = userEvent.setup();
    await reachStepThree();

    // Keyboard only, from wherever the browser left focus: Tab until the
    // palette's Signature control has it. Nothing is clicked.
    document.body.focus();
    for (let i = 0; i < 12 && document.activeElement !== paletteButton('signature'); i += 1) {
      await user.tab();
    }
    expect(document.activeElement).toBe(paletteButton('signature'));

    await user.keyboard('{Enter}');

    // The box exists...
    expect(fieldBoxes()).toHaveLength(1);
    const box = fieldBoxes()[0]!;

    // ...and focus is NOT lost. Both halves are asserted: the literal §B7.19
    // requirement, and where focus actually went — the new box, which is the
    // part that fails if the restore effect in `FieldsStep` is disabled.
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(box);
    expect(box.id).toBe('field-box-f0');
  });

  it('places with Space as well, and keeps placing without a pointer', async () => {
    const user = userEvent.setup();
    await reachStepThree();

    paletteButton('signature').focus();
    await user.keyboard(' ');
    expect(fieldBoxes()).toHaveLength(1);
    expect(document.activeElement).not.toBe(document.body);

    // Shift+Tab back onto the palette and place a second one: the whole loop is
    // keyboard-operable, not just the first press.
    paletteButton('signature').focus();
    await user.keyboard('{Enter}');
    expect(fieldBoxes()).toHaveLength(2);
    expect(document.activeElement).toBe(fieldBoxes()[1]);
  });

  it('§A4.5 — the arrow keys nudge the focused box, and the clamp still applies', async () => {
    const user = userEvent.setup();
    await reachStepThree();

    place('signature');
    const box = fieldBoxes()[0]!;
    box.focus();

    // The cascade puts the first signature box at the derived centre, 210/250.
    expect(box.getAttribute('aria-label')).toContain('at x 210, y 250');

    await user.keyboard('{ArrowRight}');
    expect(fieldBoxes()[0]?.getAttribute('aria-label')).toContain('at x 218, y 250');
    await user.keyboard('{ArrowUp}');
    expect(fieldBoxes()[0]?.getAttribute('aria-label')).toContain('at x 218, y 242');

    // Walk hard into the right edge: a signature's x stops at 420, never past.
    for (let i = 0; i < 60; i += 1) await user.keyboard('{ArrowRight}');
    expect(fieldBoxes()[0]?.getAttribute('aria-label')).toContain('at x 420');
    // And focus survived every one of those moves.
    expect(document.activeElement).toBe(fieldBoxes()[0]);
  });

  it('restores focus after a REMOVAL, where the focused element stops existing', async () => {
    await reachStepThree();

    place('signature');
    const remove = screen.getByRole('button', { name: 'Remove Signature field for Rina Halim' });
    remove.focus();
    fireEvent.click(remove);

    expect(fieldBoxes()).toHaveLength(0);
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(paletteButton('signature'));
  });
});

describe('§A4.3 / §A4.4 — what a placed box says', () => {
  it('§A4.3 — shows its kind AND its owner as TEXT, not only as a colour', async () => {
    await reachStepThree();
    place('signature');
    selectSigner(BUDI);
    place('meterai');

    const [signature, meterai] = fieldBoxes();

    expect(within(signature!).getByText('Signature')).toBeTruthy();
    // The owner's full identity, in text, plus the mockup's initials beside it.
    expect(within(signature!).getByText('Rina Halim')).toBeTruthy();
    expect(signature!.querySelector('.field-box__initials')?.textContent).toBe('RH');

    expect(within(meterai!).getByText('eMeterai')).toBeTruthy();
    expect(within(meterai!).getByText('Budi Santoso')).toBeTruthy();
    expect(meterai!.querySelector('.field-box__initials')?.textContent).toBe('BS');

    // The accessible name carries both facts too, so the box is identifiable
    // without reading the colour or the layout.
    expect(signature!.getAttribute('aria-label')).toContain('Signature field for Rina Halim');
    expect(meterai!.getAttribute('aria-label')).toContain('eMeterai field for Budi Santoso');
  });

  it('§A4.4 — every box has a remove button naming the kind and the owner', async () => {
    await reachStepThree();
    place('signature');
    selectSigner(BUDI);
    place('meterai');

    const removes = [...document.querySelectorAll('.field-box__remove')].map((node) =>
      node.getAttribute('aria-label'),
    );
    expect(removes).toEqual([
      'Remove Signature field for Rina Halim',
      'Remove eMeterai field for Budi Santoso',
    ]);

    // And it removes that one box, by name.
    fireEvent.click(screen.getByRole('button', { name: 'Remove Signature field for Rina Halim' }));
    expect(fieldBoxes()).toHaveLength(1);
    expect(
      screen.getByRole('button', { name: 'Remove eMeterai field for Budi Santoso' }),
    ).toBeTruthy();
  });

  it('§A4.11 — the eMeterai palette button is refused for a signer outside step 1', async () => {
    await reachStepThree();

    // Switch to sequential on Step 2, which seeds one step per row, then come
    // back: Budi is in step 2 and may not carry a duty stamp (§A3.3/§A4.11).
    await roundTripThroughStepTwo(() => {
      fireEvent.click(screen.getByLabelText('One step after another (sequential)'));
    });

    selectSigner(BUDI);
    const button = paletteButton('meterai');
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(describedByText(button)).toContain('only step 1 may carry eMeterai');
    // Signature placement is unaffected — the rule is about duty stamps.
    expect(paletteButton('signature').disabled).toBe(false);

    // Rina is in step 1, so for her the same button is live.
    selectSigner(RINA);
    expect(paletteButton('meterai').disabled).toBe(false);
  });
});

describe('§A4.6 / §B7 rows 10 and 11 — reconciliation on screen', () => {
  it('row 10 — shows the brief\'s own `Signature 1/2` shortfall before submitting', async () => {
    await reachStepThree();

    // Nothing placed yet: the shortfall is the whole of both lines.
    expect(reconcileLines()).toEqual([
      'Rina Halim — Signature 0/2 · eMeterai 0/0',
      'Budi Santoso — Signature 0/1 · eMeterai 0/0',
    ]);

    place('signature');
    expect(reconcileLines()[0]).toBe('Rina Halim — Signature 1/2 · eMeterai 0/0');
    // Both rows are one signature short at this point, each with its own
    // marker under its own line — the note is per recipient, not per screen.
    const rows = [...document.querySelectorAll<HTMLElement>('.reconcile__row')];
    expect(rows.map((row) => row.getAttribute('data-state'))).toEqual(['short', 'short']);
    expect(within(rows[0]!).getByText('1 Signature field still to place')).toBeTruthy();

    // §B7 row 10 also requires the server never to be asked in this state.
    const check = screen.getByRole('button', { name: 'Check charges' }) as HTMLButtonElement;
    expect(check.disabled).toBe(true);
    expect(describedByText(check)).toContain('1 Signature field still to place');
  });

  it('row 11 — shows the EXCESS, with its own marker, when too many are placed', async () => {
    await reachStepThree();

    place('signature');
    place('signature');
    place('signature');

    expect(reconcileLines()[0]).toBe('Rina Halim — Signature 3/2 · eMeterai 0/0');
    expect(panel().getByText(/1 Signature field too many/)).toBeTruthy();
    expect(document.querySelector('.reconcile__row[data-state="excess"]')).not.toBeNull();

    // The excess box itself is marked, in words, and it is the LATER one.
    const flagged = fieldBoxes().filter((box) => box.getAttribute('data-flag') === 'excess');
    expect(flagged).toHaveLength(1);
    expect(flagged[0]?.id).toBe('field-box-f2');
    expect(within(flagged[0]!).getByText('Excess')).toBeTruthy();
  });

  it('marks a satisfied row as complete, so silence is never the signal', async () => {
    await reachStepThree();

    place('signature');
    place('signature');
    selectSigner(BUDI);
    place('signature');

    expect(reconcileLines()).toEqual([
      'Rina Halim — Signature 2/2 · eMeterai 0/0',
      'Budi Santoso — Signature 1/1 · eMeterai 0/0',
    ]);
    expect(screen.getAllByText('Complete')).toHaveLength(2);
    expect(screen.getByText('Matches the counts')).toBeTruthy();
    expect(fieldBoxes().filter((box) => box.hasAttribute('data-flag'))).toHaveLength(0);
    expect((screen.getByRole('button', { name: 'Check charges' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('§A4.12 — says out loud that the charge comes from the counts, not the boxes', async () => {
    await reachStepThree();
    expect(
      screen.getByText(/The charge is computed from the counts on Step 2, never from the number of boxes/),
    ).toBeTruthy();
  });
});

describe('§A4.13 / §B7 rows 13 and 14 — flagged, never dropped', () => {
  it('row 14 — lowering a count below the placed boxes FLAGS the excess and deletes nothing', async () => {
    await reachStepThree();

    place('signature');
    place('signature');
    expect(reconcileLines()[0]).toBe('Rina Halim — Signature 2/2 · eMeterai 0/0');

    await roundTripThroughStepTwo(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Fewer signatures for Rina Halim' }));
    });

    // Both boxes are still on the page — nothing was silently destroyed.
    expect(fieldBoxes()).toHaveLength(2);
    expect(reconcileLines()[0]).toBe('Rina Halim — Signature 2/1 · eMeterai 0/0');

    // And the state is NOTIFIED, not merely inconsistent: the row is marked,
    // the later box is marked in words, and the gate names the fix.
    expect(panel().getByText(/1 Signature field too many/)).toBeTruthy();
    const flagged = fieldBoxes().filter((box) => box.getAttribute('data-flag') === 'excess');
    expect(flagged.map((box) => box.id)).toEqual(['field-box-f1']);
    expect(within(flagged[0]!).getByText('Excess')).toBeTruthy();

    const check = screen.getByRole('button', { name: 'Check charges' }) as HTMLButtonElement;
    expect(check.disabled).toBe(true);
    expect(describedByText(check)).toContain('too many');

    // The user removes it by hand, and the document is valid again. Both of
    // Rina's boxes carry the same accessible name, which is correct — they are
    // the same kind for the same owner — so the flagged one is taken by id.
    const removes = screen.getAllByRole('button', {
      name: 'Remove Signature field for Rina Halim',
    });
    expect(removes).toHaveLength(2);
    fireEvent.click(within(flagged[0]!).getByRole('button'));
    expect(fieldBoxes()).toHaveLength(1);
    expect(fieldBoxes()[0]?.id).toBe('field-box-f0');
    expect(reconcileLines()[0]).toBe('Rina Halim — Signature 1/1 · eMeterai 0/0');
  });

  it('row 13 — a recipient deleted while owning boxes ORPHANS them, visibly', async () => {
    await reachStepThree();

    selectSigner(BUDI);
    place('signature');
    expect(within(fieldBoxes()[0]!).getByText('Budi Santoso')).toBeTruthy();

    await roundTripThroughStepTwo(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Remove Budi Santoso' }));
    });

    // The box survived the deletion of its owner.
    expect(fieldBoxes()).toHaveLength(1);
    const orphan = fieldBoxes()[0]!;
    expect(orphan.getAttribute('data-flag')).toBe('orphan');
    expect(within(orphan).getByText('Orphaned')).toBeTruthy();
    // With nobody to name it, the box falls back to the address it holds.
    expect(within(orphan).getByText(BUDI)).toBeTruthy();

    // And the panel explains what happened and what to do about it.
    expect(
      panel().getByText('1 box belongs to somebody who is no longer a recipient'),
    ).toBeTruthy();
    expect(screen.getByText(/kept exactly where you placed them rather than deleted/)).toBeTruthy();

    const check = screen.getByRole('button', { name: 'Check charges' }) as HTMLButtonElement;
    expect(check.disabled).toBe(true);
    expect(describedByText(check)).toContain('not on the recipient list');

    // Budi's own progress row is gone with him; Rina's is untouched.
    expect(reconcileLines()).toEqual(['Rina Halim — Signature 0/2 · eMeterai 0/0']);
  });

  it('keeps every placed box across a Back/forward round trip (§A2.8, §A4)', async () => {
    await reachStepThree();

    place('signature');
    selectSigner(BUDI);
    place('meterai');

    await roundTripThroughStepTwo(() => {
      fireEvent.change(screen.getByLabelText('Full name for Rina Halim'), {
        target: { value: 'Rina H' },
      });
    });

    expect(fieldBoxes()).toHaveLength(2);
    // The renamed owner follows the box, because ownership is an email.
    expect(within(fieldBoxes()[0]!).getByText('Rina H')).toBeTruthy();
    expect(within(fieldBoxes()[1]!).getByText('Budi Santoso')).toBeTruthy();
  });
});

describe('§B4 — the payload, and the staleness guard with fields in it', () => {
  it('Step 2 omits `fields` ENTIRELY, and Step 3 sends them', async () => {
    const bodies = await reachStepThree();

    // The Step-2 preview. Absent, not `[]`: `[]` would be a real Step 3 with
    // nothing placed and would fail FIELD_COUNT_MISMATCH on the spot.
    expect(Object.keys(bodies[0]!)).toEqual(['order_mode', 'recipients']);
    expect('fields' in bodies[0]!).toBe(false);

    place('signature');
    place('signature');
    selectSigner(BUDI);
    place('signature');
    fireEvent.click(screen.getByRole('button', { name: 'Check charges' }));
    await screen.findByText(/The server accepted 3 fields/);

    const body = bodies.at(-1)!;
    expect(Object.keys(body)).toEqual(['order_mode', 'recipients', 'fields']);
    expect(body.fields).toEqual([
      { id: 'f0', kind: 'signature', recipient_email: RINA, page: 1, x: 210, y: 250 },
      { id: 'f1', kind: 'signature', recipient_email: RINA, page: 1, x: 234, y: 274 },
      { id: 'f2', kind: 'signature', recipient_email: BUDI, page: 1, x: 258, y: 298 },
    ]);
    // Still no commercial key anywhere in the Step-3 body (ADR-003).
    const serialized = JSON.stringify(body);
    for (const forbidden of ['price', 'quota', 'total_charge', 'charges']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('a field edit invalidates a confirmed preview (§8.10, seam S5)', async () => {
    await reachStepThree();

    place('signature');
    place('signature');
    selectSigner(BUDI);
    place('signature');

    fireEvent.click(screen.getByRole('button', { name: 'Check charges' }));
    await screen.findByText(/The server accepted 3 fields/);

    // MOVING a box is a change to the payload, so the server's answer for the
    // old payload becomes unreadable — the key it is filed under stops matching.
    fieldBoxes()[0]!.focus();
    fireEvent.keyDown(fieldBoxes()[0]!, { key: 'ArrowRight' });
    expect(screen.queryByText(/The server accepted/)).toBeNull();

    // Confirm again, then REMOVE a box: same guard, same reason.
    fireEvent.click(screen.getByRole('button', { name: 'Check charges' }));
    await screen.findByText(/The server accepted 3 fields/);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Signature field for Budi Santoso' }));
    expect(screen.queryByText(/The server accepted/)).toBeNull();

    // And placing one does it too.
    selectSigner(BUDI);
    place('signature');
    fireEvent.click(screen.getByRole('button', { name: 'Check charges' }));
    await screen.findByText(/The server accepted 3 fields/);
    place('signature');
    expect(screen.queryByText(/The server accepted/)).toBeNull();
  });

  it('a pending field preview is superseded, not queued, when a box changes', async () => {
    let settle: ((response: Response) => void) | null = null;
    await reachStepThree(
      (body) =>
        // Resolve the first Step-2 request immediately; hold the Step-3 one.
        body.fields === undefined
          ? previewOk(body)
          : (new Promise<Response>((resolve) => {
              settle = resolve;
            }) as unknown as Response),
    );

    place('signature');
    place('signature');
    selectSigner(BUDI);
    place('signature');

    fireEvent.click(screen.getByRole('button', { name: 'Check charges' }));
    await screen.findByText(/Asking the server to check the fields/);

    // The user keeps working. The in-flight request is for a payload that no
    // longer exists, so its loading state is dropped rather than left spinning.
    place('signature');
    expect(screen.queryByText(/Asking the server to check the fields/)).toBeNull();
    expect(settle).not.toBeNull();
  });

  it('surfaces a server rejection by code, with a retry that loses no box', async () => {
    let attempt = 0;
    await reachStepThree((body) => {
      if (body.fields === undefined) return previewOk(body);
      attempt += 1;
      return attempt === 1
        ? json(422, {
            error: {
              code: 'FIELD_COUNT_MISMATCH',
              message: `${RINA} has 2 of 2 signature fields placed - 0 still to place`,
              details: { recipient_index: 0, recipient_email: RINA },
            },
          })
        : previewOk(body);
    });

    place('signature');
    place('signature');
    selectSigner(BUDI);
    place('signature');
    fireEvent.click(screen.getByRole('button', { name: 'Check charges' }));

    await screen.findByText('Server response: FIELD_COUNT_MISMATCH');
    expect(fieldBoxes()).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText(/The server accepted 3 fields/);
    expect(fieldBoxes()).toHaveLength(3);
  });
});

describe('§A4 — Step 2 keeps its contract while leading to Step 3', () => {
  it('the first Continue asks the server and stays put; the second advances', async () => {
    const bodies = stubApi();
    render(<App />);

    const input = document.getElementById('document-file') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array(1024)], DOC, { type: 'application/pdf' })] },
    });
    await screen.findByText(DOC);
    fireEvent.click(continueButton());
    await screen.findByRole('heading', { name: 'Who signs it?' });

    // Phase 1: the gate says what the press will do, and it does not navigate.
    expect(describedByText(continueButton())).toContain('asks the server');
    fireEvent.click(continueButton());
    await screen.findByText('Server-confirmed');
    expect(screen.getByRole('heading', { name: 'Who signs it?' })).toBeTruthy();
    expect(bodies).toHaveLength(1);

    // Phase 2: the gate says so, and the press advances without a second request.
    expect(describedByText(continueButton())).toContain('goes on to Step 3');
    fireEvent.click(continueButton());
    await screen.findByRole('heading', { name: 'Place the fields' });
    expect(bodies).toHaveLength(1);
  });

  it('an edit after the confirmation puts Continue back in phase 1', async () => {
    stubApi();
    render(<App />);

    const input = document.getElementById('document-file') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array(1024)], DOC, { type: 'application/pdf' })] },
    });
    await screen.findByText(DOC);
    fireEvent.click(continueButton());
    await screen.findByRole('heading', { name: 'Who signs it?' });

    fireEvent.click(continueButton());
    await screen.findByText('Server-confirmed');

    fireEvent.click(screen.getByRole('button', { name: 'More signatures for Rina Halim' }));
    expect(describedByText(continueButton())).toContain('asks the server');

    // So a stale confirmation can never carry the user forward.
    fireEvent.click(continueButton());
    expect(screen.getByRole('heading', { name: 'Who signs it?' })).toBeTruthy();
  });

  it('the stale Case-1 copy is gone from the confirmed summary', async () => {
    stubApi();
    render(<App />);

    const input = document.getElementById('document-file') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array(1024)], DOC, { type: 'application/pdf' })] },
    });
    await screen.findByText(DOC);
    fireEvent.click(continueButton());
    await screen.findByRole('heading', { name: 'Who signs it?' });
    fireEvent.click(continueButton());
    await screen.findByText('Server-confirmed');

    expect(document.body.textContent).not.toContain('outside this exercise');
    expect(document.body.textContent).not.toContain('the flow stops');
    expect(document.body.textContent).toContain('now goes on to Step 3');
  });

  it('removing the document from Step 3 returns to Step 1 rather than stranding', async () => {
    await reachStepThree();
    place('signature');

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await screen.findByRole('heading', { name: 'Who signs it?' });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await screen.findByRole('heading', { name: 'What needs to be signed?' });

    fireEvent.click(screen.getByRole('button', { name: `Remove ${DOC}` }));
    expect(document.querySelector('[aria-current="step"]')?.textContent).toContain(
      'Upload document',
    );
  });
});
