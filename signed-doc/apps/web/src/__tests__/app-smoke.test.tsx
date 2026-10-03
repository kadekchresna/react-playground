/**
 * Wiring evidence for the rows that only exist once the components are mounted.
 *
 * LD-32 makes state/controller tests the primary evidence and a manual browser
 * pass the wiring evidence, with a thin render test named as the first
 * nice-to-have. `EPIC-1-ST-2` is still in flight, so no server exists to drive a
 * manual pass against — this suite is that nice-to-have, brought forward, with
 * `fetch` stubbed to the PLAN.md wire contract rather than to a real process.
 *
 * It therefore proves the components are wired to the reducers and to the
 * contract. It does NOT prove the server honours that contract; that is
 * `EPIC-1-ST-2`'s evidence, and the integration gate in `docs/verification.md`
 * is where the two meet.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { App } from '../App.js';

const XSS_NAME = '<img src=x onerror=alert(1)>.pdf';

function envelope(filename: string, pageCount: number) {
  return {
    envelope_id: 'env_01',
    document: { filename, size_bytes: 1_468_006, page_count: pageCount },
    // §B1: both prices and both allowances, server-issued (ADR-003).
    price: { signature: '5000.00', meterai: '10000.10' },
    quota: { signature: 8, meterai: 3 },
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Stub the wire contract from PLAN.md §API Spec. */
function stubApi(handlers: {
  upload?: () => Response;
  preview?: (body: { recipients: { signature_count: number }[] }) => Response;
}) {
  const calls: { path: string; body?: unknown }[] = [];

  const impl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const path = String(input);
    if (path.endsWith('/charge-preview')) {
      const body = JSON.parse(String(init?.body)) as { recipients: { signature_count: number }[] };
      calls.push({ path, body });
      return handlers.preview?.(body) ?? json(500, {});
    }
    calls.push({ path });
    return handlers.upload?.() ?? json(500, {});
  };

  vi.stubGlobal('fetch', vi.fn(impl));
  return calls;
}

function selectFile(name: string): void {
  const input = document.getElementById('document-file') as HTMLInputElement;
  const file = new File([new Uint8Array(1024)], name, { type: 'application/pdf' });
  fireEvent.change(input, { target: { files: [file] } });
}

function continueButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;
}

/** The text an `aria-describedby` actually resolves to on screen. */
function describedByText(element: HTMLElement): string {
  return (element.getAttribute('aria-describedby') ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');
}

async function reachStepTwo(previewHandler?: Parameters<typeof stubApi>[0]['preview']) {
  const calls = stubApi({ upload: () => json(201, envelope(XSS_NAME, 8)), preview: previewHandler });
  render(<App />);
  selectFile(XSS_NAME);
  await screen.findByText(XSS_NAME);
  fireEvent.click(continueButton());
  await screen.findByRole('heading', { name: 'Who signs it?' });
  return calls;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('stepper (ADR-005, LD-02, seam S1)', () => {
  /*
    Case 2 §A4 SUPERSEDES one clause of the Case-1 assertion this replaces:
    pill 3 was `aria-disabled="true"` with the copy `(locked in this exercise)`,
    because Step 3 was out of scope. It is a real step now, so a lock would be a
    lie. Every other clause is kept verbatim and the display-only one is
    STRENGTHENED from pill 3 alone to all three pills — the stepper is still not
    a navigation control, which was the point of the original test, and that is
    now asserted for the whole of it rather than for the one pill that happened
    to be locked.
  */
  it('renders three display-only pills: none focusable, none navigable, none locked', () => {
    stubApi({});
    const { container } = render(<App />);

    const pills = container.querySelectorAll('.stepper__pill');
    expect(pills).toHaveLength(3);

    const third = pills[2] as HTMLElement;
    expect(third.textContent).toContain('Place fields');

    for (const pill of pills) {
      expect(pill.tagName).toBe('LI'); // no button, no link, no handler
      expect(pill.querySelectorAll('a, button, input, [tabindex]')).toHaveLength(0);
      // §A4: Step 3 is reachable now, so nothing in the stepper is disabled.
      expect(pill.getAttribute('aria-disabled')).toBeNull();
    }

    expect(container.textContent).not.toContain('locked in this exercise');
  });

  it('marks the active pill with aria-current="step" and no other', () => {
    stubApi({});
    const { container } = render(<App />);
    const current = container.querySelectorAll('[aria-current="step"]');
    expect(current).toHaveLength(1);
    expect(current[0]?.textContent).toContain('Upload document');
  });
});

describe('Step 1 gating (PRD §7.6)', () => {
  it('disables Continue in the empty state with a visible, associated reason', () => {
    stubApi({});
    render(<App />);

    const button = continueButton();
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(describedByText(button)).toContain('Upload a valid document to continue');
  });

  it('renders the mockup copy and the disabled From cloud control (LD-05)', () => {
    stubApi({});
    render(<App />);

    expect(screen.getByRole('heading', { name: 'What needs to be signed?' })).toBeTruthy();
    expect(
      screen.getByText('One document per request. PDF, JPG, JPEG, PNG, DOC or DOCX.'),
    ).toBeTruthy();

    const fromCloud = screen.getByRole('button', { name: 'From cloud' }) as HTMLButtonElement;
    expect(fromCloud.disabled).toBe(true);
    expect(fromCloud.getAttribute('aria-disabled')).toBe('true');
    expect(describedByText(fromCloud)).toBe('Not available in this exercise');
  });

  it('every input on the step has an associated label (PRD §8.12)', () => {
    stubApi({});
    const { container } = render(<App />);
    for (const input of container.querySelectorAll('input')) {
      expect(container.querySelector(`label[for="${input.id}"]`)).not.toBeNull();
    }
  });
});

describe('Step 1 upload (PRD §7.2, §7.4, §7.5, §10 XSS row)', () => {
  it('renders the XSS-shaped filename as inert text and enables Continue', async () => {
    stubApi({ upload: () => json(201, envelope(XSS_NAME, 8)) });
    const { container } = render(<App />);

    selectFile(XSS_NAME);

    const name = await screen.findByText(XSS_NAME);
    // The characters are on screen; no element was created from them.
    expect(name.textContent).toBe(XSS_NAME);
    expect(container.querySelector('img')).toBeNull();
    expect(container.innerHTML).toContain('&lt;img');

    expect(screen.getByText(/Uploaded .* 8 pages .* 1\.4 MB/)).toBeTruthy();
    expect(screen.getByRole('button', { name: `Remove ${XSS_NAME}` })).toBeTruthy();
    expect(continueButton().disabled).toBe(false);
  });

  it('rejects a bad extension in the browser with a per-cause message and sends nothing', async () => {
    const calls = stubApi({ upload: () => json(201, envelope('payload.exe', 1)) });
    render(<App />);

    selectFile('invoice.pdf.exe');

    await screen.findByText('File type is not supported');
    expect(calls).toHaveLength(0); // never reached the network
    expect(continueButton().disabled).toBe(true);
    // A client-side rejection offers no `Try again`: the same file fails again.
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('renders a server rejection from its code, with a user-driven retry', async () => {
    let attempt = 0;
    stubApi({
      upload: () => {
        attempt += 1;
        return attempt === 1
          ? json(422, { error: { code: 'FILE_TOO_LARGE', message: 'File is larger than the 25 MB limit' } })
          : json(201, envelope('agreement-vendor-2026.pdf', 8));
      },
    });
    render(<App />);

    selectFile('agreement-vendor-2026.pdf');
    await screen.findByText('File is larger than the 25 MB limit');
    expect(screen.getByText(/FILE_TOO_LARGE/)).toBeTruthy();
    expect(continueButton().disabled).toBe(true);

    // Nothing retried itself (LD-29).
    expect(attempt).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('agreement-vendor-2026.pdf');
    expect(attempt).toBe(2);
    expect(continueButton().disabled).toBe(false);
  });

  it('replaces on re-upload — never two cards (PRD §7.5)', async () => {
    let next = 'nda-partner.pdf';
    stubApi({ upload: () => json(201, envelope(next, next === 'nda-partner.pdf' ? 3 : 8)) });
    const { container } = render(<App />);

    selectFile('nda-partner.pdf');
    await screen.findByText('nda-partner.pdf');

    // Remove, then choose a different document.
    fireEvent.click(screen.getByRole('button', { name: 'Remove nda-partner.pdf' }));
    expect(screen.queryByText('nda-partner.pdf')).toBeNull();
    expect(continueButton().disabled).toBe(true);

    next = 'agreement-vendor-2026.pdf';
    selectFile(next);
    await screen.findByText(next);

    expect(container.querySelectorAll('.doc-card')).toHaveLength(1);
    expect(screen.queryByText('nda-partner.pdf')).toBeNull();
  });
});

describe('Step 2 derived totals (PRD §8.6, §8.7, §10 row 6)', () => {
  it('shows the seeded list, its per-row charges and the estimated total', async () => {
    await reachStepTwo();

    expect((screen.getByLabelText(/Full name for Rina Halim/) as HTMLInputElement).value).toBe(
      'Rina Halim',
    );
    expect((screen.getByLabelText(/Signatures for Rina Halim/) as HTMLInputElement).value).toBe('2');

    expect(screen.getByText('3 signatures × Rp5.000,00 per signature')).toBeTruthy();
    expect(screen.getByText('Rp15.000,00')).toBeTruthy(); // total
    expect(screen.getByText('5 of 8')).toBeTruthy(); // remaining quota
  });

  it('recomputes in render — one click changes the row charge and the total together', async () => {
    await reachStepTwo();

    fireEvent.click(screen.getByRole('button', { name: 'More signatures for Rina Halim' }));

    expect(screen.getByText('4 signatures × Rp5.000,00 per signature')).toBeTruthy();
    expect(screen.getByText('Rp20.000,00')).toBeTruthy(); // total
    expect(screen.getByText('4 of 8')).toBeTruthy();
    // Rina's row cell now reads 3 x 5000.
    const rina = screen.getByRole('group', { name: 'Recipient 1' });
    expect(within(rina).getByText('Rp15.000,00')).toBeTruthy();
  });

  it('never lets the count become NaN, whatever is typed (PRD §8.3)', async () => {
    await reachStepTwo();
    const input = screen.getByLabelText(/Signatures for Rina Halim/) as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'abc' } });
    expect(screen.getByText('3 signatures × Rp5.000,00 per signature')).toBeTruthy();

    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByText('3 signatures × Rp5.000,00 per signature')).toBeTruthy();

    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.blur(input);
    expect(input.value).toBe('1');
    expect(screen.getByText('2 signatures × Rp5.000,00 per signature')).toBeTruthy();
  });
});

/**
 * Case 2 §A3 (P1) — the eMeterai column, on screen and wired.
 *
 * The arithmetic itself lives in `meterai.test.ts`, where it is asserted
 * without a DOM. What is proved here is the wiring: that the column exists,
 * that its stepper reaches the reducer, that the per-row cell shows the
 * COMBINED cost, that both quota usages are visible at once, and that the two
 * shortfalls read as two different problems.
 */
describe('Step 2 eMeterai column (§A3.6–§A3.9)', () => {
  /**
   * Anchored on purpose: the `-` and `+` buttons beside the box are labelled
   * `Fewer/More eMeterai for {who}`, so an unanchored pattern would match three
   * controls. That it does is itself the §A3.6 accessibility contract holding.
   */
  const meteraiBox = (who: string) =>
    screen.getByLabelText(new RegExp(`^eMeterai for ${who}$`)) as HTMLInputElement;

  it('renders an eMeterai stepper per row, seeded at 0 and separately labelled', async () => {
    await reachStepTwo();

    expect(screen.getByText('eMeterai')).toBeTruthy(); // the column header
    expect(meteraiBox('Rina Halim').value).toBe('0');
    expect(meteraiBox('Budi Santoso').value).toBe('0');

    // The signature stepper is still its own control — two steppers, not one.
    expect((screen.getByLabelText(/Signatures for Rina Halim/) as HTMLInputElement).value).toBe('2');
    expect(screen.getByRole('button', { name: 'More eMeterai for Rina Halim' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fewer eMeterai for Rina Halim' })).toBeTruthy();
  });

  it('§B7 row 1 — one duty stamp changes the row charge, both lines and the total', async () => {
    await reachStepTwo();

    fireEvent.click(screen.getByRole('button', { name: 'More eMeterai for Rina Halim' }));

    // §A3.7: two separate priced lines, then the total.
    expect(screen.getByText('3 signatures × Rp5.000,00 per signature')).toBeTruthy();
    expect(screen.getByText('1 eMeterai × Rp10.000,10 per eMeterai')).toBeTruthy();
    expect(screen.getByText('= Rp15.000,00')).toBeTruthy();
    expect(screen.getByText('= Rp10.000,10')).toBeTruthy();
    expect(screen.getByText('Rp25.000,10')).toBeTruthy(); // the total

    // §A3.6: Rina's cell is her COMBINED cost, 2 x 5000.00 + 1 x 10000.10.
    const rina = screen.getByRole('group', { name: 'Recipient 1' });
    expect(within(rina).getByText('Rp20.000,10')).toBeTruthy();
    const budi = screen.getByRole('group', { name: 'Recipient 2' });
    expect(within(budi).getByText('Rp5.000,00')).toBeTruthy();

    // §A3.8: usage against BOTH quotas, each naming its own resource.
    expect(screen.getByText('Signature 3/8')).toBeTruthy();
    expect(screen.getByText('eMeterai 1/3')).toBeTruthy();
    expect(screen.getByText('2 of 3')).toBeTruthy(); // remaining eMeterai
  });

  it('never lets the eMeterai count become NaN, whatever is typed (§B1)', async () => {
    await reachStepTwo();
    const box = meteraiBox('Rina Halim');

    fireEvent.change(box, { target: { value: 'abc' } });
    expect(screen.getByText('0 eMeterai × Rp10.000,10 per eMeterai')).toBeTruthy();

    fireEvent.change(box, { target: { value: '' } });
    expect(screen.getByText('0 eMeterai × Rp10.000,10 per eMeterai')).toBeTruthy();

    fireEvent.change(box, { target: { value: '4' } });
    fireEvent.blur(box);
    expect(box.value).toBe('3'); // clamped down to §B1's ceiling
    expect(screen.getByText('3 eMeterai × Rp10.000,10 per eMeterai')).toBeTruthy();
  });

  it('§B7 row 4 — marks THAT row, not the whole form', async () => {
    await reachStepTwo();

    // Rina: 2 signatures, 3 duty stamps.
    fireEvent.change(meteraiBox('Rina Halim'), { target: { value: '3' } });

    const rina = meteraiBox('Rina Halim');
    const budi = meteraiBox('Budi Santoso');
    expect(rina.getAttribute('aria-invalid')).toBe('true');
    expect(budi.getAttribute('aria-invalid')).toBeNull(); // the clean row stays clean

    // The reason sits on the row and names both numbers.
    const rinaRow = screen.getByRole('group', { name: 'Recipient 1' });
    expect(
      within(rinaRow).getByText('3 eMeterai for 2 signatures — one duty stamp per signature'),
    ).toBeTruthy();
    expect(
      within(screen.getByRole('group', { name: 'Recipient 2' })).queryByText(/duty stamp/),
    ).toBeNull();

    const button = continueButton();
    expect(button.disabled).toBe(true);
    expect(describedByText(button)).toContain('one duty stamp per signature');
  });

  it('§A3.2 stays reachable — the stepper does not cap itself at signature_count', async () => {
    await reachStepTwo();

    fireEvent.change(screen.getByLabelText(/Signatures for Rina Halim/), { target: { value: '1' } });
    const plus = screen.getByRole('button', { name: 'More eMeterai for Rina Halim' });
    fireEvent.click(plus);
    fireEvent.click(plus);

    // 2 duty stamps against 1 signature: an invalid state the user can SEE,
    // which is the only way the server's 422 is ever provoked.
    expect(meteraiBox('Rina Halim').value).toBe('2');
    expect(meteraiBox('Rina Halim').getAttribute('aria-invalid')).toBe('true');
    expect(
      screen.getByText('2 eMeterai for 1 signature — one duty stamp per signature'),
    ).toBeTruthy();
  });

  it('§A3.5 — a meterai shortfall reads as a meterai shortfall, not a signature one', async () => {
    await reachStepTwo();

    // 4 duty stamps against an allowance of 3, signatures comfortably inside 8.
    fireEvent.change(screen.getByLabelText(/Signatures for Rina Halim/), { target: { value: '3' } });
    fireEvent.change(meteraiBox('Rina Halim'), { target: { value: '3' } });
    fireEvent.change(meteraiBox('Budi Santoso'), { target: { value: '1' } });

    expect(screen.getAllByText('4 of 3 eMeterai — 1 over your eMeterai quota')).toHaveLength(2);
    expect(screen.queryByText(/over your quota$/)).toBeNull(); // no signature message
    expect(screen.getByText('eMeterai 4/3')).toBeTruthy();
    expect(screen.getByText('0 of 3')).toBeTruthy(); // clamped, never -1

    const button = continueButton();
    expect(button.disabled).toBe(true);
    expect(describedByText(button)).toContain('over your eMeterai quota');
  });

  it('§A3.5 — both shortfalls are on screen at once, as two distinct sentences', async () => {
    await reachStepTwo();

    fireEvent.change(screen.getByLabelText(/Signatures for Rina Halim/), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText(/Signatures for Budi Santoso/), { target: { value: '3' } });
    fireEvent.change(meteraiBox('Rina Halim'), { target: { value: '3' } });
    fireEvent.change(meteraiBox('Budi Santoso'), { target: { value: '1' } });

    expect(screen.getAllByText('9 of 8 signatures — 1 over your quota')).toHaveLength(2);
    expect(screen.getAllByText('4 of 3 eMeterai — 1 over your eMeterai quota')).toHaveLength(2);

    const reasons = describedByText(continueButton());
    expect(reasons).toContain('1 over your quota');
    expect(reasons).toContain('1 over your eMeterai quota');
  });

  it('an eMeterai change invalidates a server-confirmed total (§8.10, staleness guard)', async () => {
    const calls = await reachStepTwo(() =>
      json(200, {
        // §B4 — a `200` always carries both, in either mode.
        order_mode: 'parallel',
        steps: [{ step: 1, recipient_emails: ['rina.halim@example.test', 'budi.santoso@example.test'] }],
        recipient_count: 2,
        total_signatures: 3,
        total_meterai: 0,
        price: { signature: '5000.00', meterai: '10000.10' },
        charges: { signature: '15000.00', meterai: '0.00' },
        total_charge: '15000.00',
        quota: { signature: 8, meterai: 3 },
        quota_remaining: { signature: 5, meterai: 3 },
      }),
    );

    fireEvent.click(continueButton());
    await screen.findByText('Server-confirmed');

    // The sent payload carries the fourth key (§B4).
    const body = calls.at(-1)?.body as { recipients: Record<string, unknown>[] };
    expect(body.recipients[0]?.meterai_count).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: 'More eMeterai for Rina Halim' }));

    expect(screen.queryByText('Server-confirmed')).toBeNull();
    expect(screen.getByText('Estimate')).toBeTruthy();
    expect(screen.getByText('Rp25.000,10')).toBeTruthy(); // back to the local estimate
  });
});

describe('Step 2 gating (PRD §8.8, §10 rows 7 and 8, LD-17)', () => {
  it('disables Continue over quota, clamps remaining at 0 and names the numbers', async () => {
    await reachStepTwo();

    // 2 + 1 seeded -> take Rina to 6 and Budi to 3 for a total of 9.
    const rina = screen.getByLabelText(/Signatures for Rina Halim/) as HTMLInputElement;
    const budi = screen.getByLabelText(/Signatures for Budi Santoso/) as HTMLInputElement;
    fireEvent.change(rina, { target: { value: '6' } });
    fireEvent.change(budi, { target: { value: '3' } });

    // Deliberately in two places: on the summary panel (LD-17) and in the
    // footer's blocker list, which is the `Continue` describedby target (§8.8).
    expect(screen.getAllByText('9 of 8 signatures — 1 over your quota')).toHaveLength(2);
    expect(screen.getByText('0 of 8')).toBeTruthy(); // clamped, never -1

    const button = continueButton();
    expect(button.disabled).toBe(true);
    expect(describedByText(button)).toContain('1 over your quota');
  });

  it('marks BOTH colliding rows on a case- and whitespace-insensitive duplicate', async () => {
    await reachStepTwo();

    fireEvent.change(screen.getByLabelText(/Email address for Budi Santoso/), {
      target: { value: '  Rina.Halim@Example.test ' },
    });

    const rina = screen.getByLabelText(/Email address for Rina Halim/);
    const budi = screen.getByLabelText(/Email address for Budi Santoso/);
    expect(rina.getAttribute('aria-invalid')).toBe('true');
    expect(budi.getAttribute('aria-invalid')).toBe('true');

    const button = continueButton();
    expect(button.disabled).toBe(true);
    expect(describedByText(button)).toContain('use the same email address');
  });

  it('keeps two simultaneous blockers both visible rather than collapsing them', async () => {
    await reachStepTwo();

    fireEvent.change(screen.getByLabelText(/Full name for Rina Halim/), { target: { value: '   ' } });
    fireEvent.change(screen.getByLabelText(/Signatures for Budi Santoso/), { target: { value: '9' } });

    const reasons = describedByText(continueButton());
    expect(reasons).toContain('Full name is required');
    expect(reasons).toContain('over your quota');
  });

  it('disables Add signer at ten rows with the reason next to it (LD-16)', async () => {
    await reachStepTwo();

    const add = () => screen.getByRole('button', { name: /Add signer/ }) as HTMLButtonElement;
    for (let i = 0; i < 8; i += 1) fireEvent.click(add());

    expect(screen.getAllByRole('group', { name: /^Recipient / })).toHaveLength(10);
    expect(add().disabled).toBe(true);
    expect(describedByText(add())).toBe('Maximum 10 recipients per document');
  });

  it('disables remove on the last remaining row (LD-12)', async () => {
    await reachStepTwo();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Budi Santoso' }));
    const remove = screen.getByRole('button', { name: 'Remove Rina Halim' }) as HTMLButtonElement;

    expect(remove.disabled).toBe(true);
    expect(describedByText(remove)).toBe('At least one recipient is required');
  });

  it('labels a blank row\'s controls with the mockup\'s signer {i+1} fallback', async () => {
    await reachStepTwo();
    fireEvent.click(screen.getByRole('button', { name: /Add signer/ }));
    expect(screen.getByRole('button', { name: 'Remove signer 3' })).toBeTruthy();
  });
});

describe('Step 2 Continue — the server is the authority (PRD §8.9, LD-13)', () => {
  it('sends only recipients, and swaps the estimate for the server\'s figures', async () => {
    const calls = await reachStepTwo(() =>
      json(200, {
        // §B4 — a `200` always carries both, in either mode.
        order_mode: 'parallel',
        steps: [{ step: 1, recipient_emails: ['rina.halim@example.test', 'budi.santoso@example.test'] }],
        recipient_count: 2,
        total_signatures: 3,
        total_meterai: 0,
        price: { signature: '5000.00', meterai: '10000.10' },
        charges: { signature: '15000.00', meterai: '0.00' },
        total_charge: '15000.00',
        quota: { signature: 8, meterai: 3 },
        quota_remaining: { signature: 5, meterai: 3 },
      }),
    );

    fireEvent.click(continueButton());
    await screen.findByText('Server-confirmed');

    const body = calls.at(-1)?.body as Record<string, unknown>;
    // §B4 added `order_mode`; the surface is still closed, and in `parallel`
    // there is still no `step` on any recipient (§B7 row 9).
    expect(Object.keys(body)).toEqual(['order_mode', 'recipients']);
    expect(body.order_mode).toBe('parallel');
    expect(Object.keys((body.recipients as Record<string, unknown>[])[0] ?? {}).sort()).toEqual([
      'email',
      'meterai_count',
      'name',
      'signature_count',
    ]);

    expect(screen.getByText('Rp15.000,00')).toBeTruthy();
    expect(screen.getByText('5 of 8')).toBeTruthy();
    /*
      LD-13: the FIRST press of `Continue` asks the server and does not
      navigate. Case 2 §A4 made Step 3 real, so "pill 3 is locked" is no longer
      the way to say that — the equivalent and stronger statement is that the
      flow is still ON Step 2, which is asserted by the heading AND by which
      pill is `aria-current`. Advancing is the SECOND press (see §A4 below).
    */
    expect(screen.getByRole('heading', { name: 'Who signs it?' })).toBeTruthy();
    expect(document.querySelector('[aria-current="step"]')?.textContent).toContain(
      'Set recipients',
    );
  });

  it('drops the server-confirmed label as soon as the data changes (§8.10)', async () => {
    await reachStepTwo(() =>
      json(200, {
        // §B4 — a `200` always carries both, in either mode.
        order_mode: 'parallel',
        steps: [{ step: 1, recipient_emails: ['rina.halim@example.test', 'budi.santoso@example.test'] }],
        recipient_count: 2,
        total_signatures: 3,
        total_meterai: 0,
        price: { signature: '5000.00', meterai: '10000.10' },
        charges: { signature: '15000.00', meterai: '0.00' },
        total_charge: '15000.00',
        quota: { signature: 8, meterai: 3 },
        quota_remaining: { signature: 5, meterai: 3 },
      }),
    );

    fireEvent.click(continueButton());
    await screen.findByText('Server-confirmed');

    fireEvent.click(screen.getByRole('button', { name: 'More signatures for Rina Halim' }));

    expect(screen.queryByText('Server-confirmed')).toBeNull();
    expect(screen.getByText('Estimate')).toBeTruthy();
    expect(screen.getByText('Rp20.000,00')).toBeTruthy(); // the local estimate
  });

  it('surfaces a 422 by code with a retry that loses nothing', async () => {
    let attempt = 0;
    await reachStepTwo(() => {
      attempt += 1;
      return attempt === 1
        ? json(422, {
            error: {
              code: 'DUPLICATE_RECIPIENT_EMAIL',
              message: 'Duplicate recipient email',
              details: { recipient_indexes: [0, 1] },
            },
          })
        : json(200, {
            order_mode: 'parallel',
            steps: [
              { step: 1, recipient_emails: ['rina.halim@example.test', 'budi.santoso@example.test'] },
            ],
            recipient_count: 2,
            total_signatures: 3,
            total_meterai: 0,
            price: { signature: '5000.00', meterai: '10000.10' },
            charges: { signature: '15000.00', meterai: '0.00' },
            total_charge: '15000.00',
            quota: { signature: 8, meterai: 3 },
            quota_remaining: { signature: 5, meterai: 3 },
          });
    });

    fireEvent.click(continueButton());
    await screen.findByText('Duplicate recipient email');
    expect(screen.getByText(/DUPLICATE_RECIPIENT_EMAIL/)).toBeTruthy();
    expect(attempt).toBe(1); // nothing retried itself

    // The server's details mark the rows it named (LD-26 reconciliation).
    await waitFor(() =>
      expect(screen.getByLabelText(/Email address for Rina Halim/).getAttribute('aria-invalid')).toBe(
        'true',
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('Server-confirmed');
    expect(attempt).toBe(2);
    // Nothing typed was lost.
    expect((screen.getByLabelText(/Full name for Rina Halim/) as HTMLInputElement).value).toBe(
      'Rina Halim',
    );
  });

  it('renders Save as draft as inert (LD-05)', async () => {
    await reachStepTwo();
    const draft = screen.getByRole('button', { name: 'Save as draft' }) as HTMLButtonElement;
    expect(draft.disabled).toBe(true);
    expect(draft.getAttribute('aria-disabled')).toBe('true');
    expect(describedByText(draft)).toBe('Not available in this exercise');
  });

  it('Back returns to Step 1 with the document still uploaded', async () => {
    await reachStepTwo();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    await screen.findByRole('heading', { name: 'What needs to be signed?' });
    expect(screen.getByText(XSS_NAME)).toBeTruthy();
    expect(continueButton().disabled).toBe(false);
  });
});

describe('every Step 2 input has an associated label (PRD §8.12)', () => {
  it('holds for the name, email, signature and eMeterai inputs of every row', async () => {
    const { container } = render(<div />);
    void container;
    await reachStepTwo();

    // Four inputs per row across two seeded rows, the eMeterai box included.
    const inputs = document.querySelectorAll('.signer-row input');
    expect(inputs.length).toBe(8);
    for (const input of inputs) {
      expect(document.querySelector(`label[for="${input.id}"]`)).not.toBeNull();
    }
    expect(document.getElementById('signer-name-0')).not.toBeNull();
    expect(document.getElementById('signer-email-0')).not.toBeNull();
    expect(document.getElementById('signer-count-0')).not.toBeNull();
    expect(document.getElementById('signer-meterai-0')).not.toBeNull();
  });

  it('gives every icon button on the row an aria-label naming the signer', async () => {
    await reachStepTwo();
    for (const label of [
      'Fewer signatures for Rina Halim',
      'More signatures for Rina Halim',
      'Fewer eMeterai for Rina Halim',
      'More eMeterai for Rina Halim',
      'Remove Rina Halim',
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
  });
});

/**
 * Case 2 §A2 (P2) — the signing order mode, on screen and wired.
 *
 * The step arithmetic itself lives in `signing-order.test.ts`, where it is
 * asserted without a DOM. What is proved here is the half of §A2 that only
 * exists once the components are mounted: that the mode selector sits above the
 * list, that `sequential` renders GROUPED with a visible step header, that the
 * reorder path is four real buttons naming the recipient they move — and above
 * all §A2.7, that **keyboard focus survives a move**, which is a property of
 * the rendered tree and cannot be asserted anywhere else.
 */
describe('Step 2 signing order (§A2.5–§A2.8, §A3.3)', () => {
  const sequentialRadio = () =>
    screen.getByLabelText('One step after another (sequential)') as HTMLInputElement;
  const parallelRadio = () =>
    screen.getByLabelText('Everyone at the same time (parallel)') as HTMLInputElement;

  /** Three named recipients on steps `[1,2,3]` — the smallest useful chain. */
  async function reachSequentialThree(
    previewHandler?: Parameters<typeof stubApi>[0]['preview'],
  ): Promise<{ path: string; body?: unknown }[]> {
    const calls = await reachStepTwo(previewHandler);
    fireEvent.click(screen.getByRole('button', { name: /Add signer/ }));
    fireEvent.change(screen.getByLabelText(/Full name for signer 3/), {
      target: { value: 'Citra Dewi' },
    });
    fireEvent.change(screen.getByLabelText(/Email address for Citra Dewi/), {
      target: { value: 'citra.dewi@example.test' },
    });
    fireEvent.click(sequentialRadio());
    return calls;
  }

  const stepHeads = (): string[] =>
    [...document.querySelectorAll('.step-group__number')].map((node) => node.textContent ?? '');

  /** Who is in which step group, read off the rendered tree rather than state. */
  const groupedNames = (): string[][] =>
    [...document.querySelectorAll('.step-group')].map((group) =>
      [...group.querySelectorAll('.signer-row')].map(
        (row) => (row.querySelector('input[type="text"]') as HTMLInputElement | null)?.value ?? '',
      ),
    );

  it('renders the selector ABOVE the recipient list, parallel by default', async () => {
    await reachStepTwo();

    expect(parallelRadio().checked).toBe(true);
    expect(sequentialRadio().checked).toBe(false);

    const selector = document.querySelector('.order-mode') as HTMLElement;
    const list = document.querySelector('.signers') as HTMLElement;
    // DOCUMENT_POSITION_FOLLOWING: the list comes after the selector.
    expect(selector.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // §A2: parallel is the Case-1 behaviour, so nothing about steps is rendered.
    expect(document.querySelectorAll('.step-group')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /^Move Rina Halim/ })).toBeNull();
  });

  it('§A2.5 — sequential groups the rows under a visible step header', async () => {
    await reachSequentialThree();

    expect(sequentialRadio().checked).toBe(true);
    expect(stepHeads()).toEqual(['Step 1', 'Step 2', 'Step 3']);
    expect(groupedNames()).toEqual([['Rina Halim'], ['Budi Santoso'], ['Citra Dewi']]);

    // Each step is a labelled region, so the grouping is announced, not implied.
    expect(screen.getByRole('region', { name: 'Step 1 — 1 recipient' })).toBeTruthy();
  });

  it('§A2.2/§A2.5 — a shared step says its members sign in parallel', async () => {
    await reachSequentialThree();

    fireEvent.click(screen.getByRole('button', { name: 'Merge Citra Dewi into the previous step' }));

    expect(stepHeads()).toEqual(['Step 1', 'Step 2']);
    expect(groupedNames()).toEqual([['Rina Halim'], ['Budi Santoso', 'Citra Dewi']]);
    expect(
      screen.getByText('2 recipients — they sign in parallel within this step'),
    ).toBeTruthy();
    expect(
      screen.getByRole('region', { name: 'Step 2 — 2 recipients signing in parallel' }),
    ).toBeTruthy();
  });

  it('§A2.6/§A2.7 — every reorder control names the recipient it moves', async () => {
    await reachSequentialThree();

    for (const label of [
      'Move Budi Santoso to an earlier step',
      'Move Budi Santoso to a later step',
      'Merge Budi Santoso into the previous step',
      'Merge Budi Santoso into the next step',
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
    // The keyboard path is not a fallback behind a drag handle: these ARE the
    // controls, they are native buttons, and nothing in the tree is draggable.
    expect(document.querySelectorAll('[draggable="true"]')).toHaveLength(0);
  });

  it('§A2.7 — focus STAYS on the control that moved the row', async () => {
    await reachSequentialThree();

    const earlier = screen.getByRole('button', { name: 'Move Citra Dewi to an earlier step' });
    earlier.focus();
    expect(document.activeElement).toBe(earlier);

    fireEvent.click(earlier);

    // Citra moved from step 3 to a step of her own before Budi's.
    expect(groupedNames()).toEqual([['Rina Halim'], ['Citra Dewi'], ['Budi Santoso']]);

    // The row changed DOM parent, so this node is NOT the one clicked — which
    // is exactly why focus has to be restored rather than assumed.
    const after = screen.getByRole('button', { name: 'Move Citra Dewi to an earlier step' });
    expect(document.activeElement).toBe(after);
    expect(document.activeElement).not.toBe(document.body);
  });

  it('§A2.7 — focus survives a move that disabled the control it was on', async () => {
    await reachSequentialThree();

    const earlier = () => screen.getByRole('button', { name: 'Move Citra Dewi to an earlier step' });
    earlier().focus();
    fireEvent.click(earlier()); // step 3 -> step 2
    fireEvent.click(earlier()); // step 2 -> step 1, which is the top of the chain

    expect(groupedNames()).toEqual([['Citra Dewi'], ['Rina Halim'], ['Budi Santoso']]);
    expect((earlier() as HTMLButtonElement).disabled).toBe(true);

    // Focus falls to the opposite direction on the SAME row, never to <body>.
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Move Citra Dewi to a later step' }),
    );
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).not.toBe(document.documentElement);
  });

  it('§A2.7 — a merge keeps focus on the merge control too', async () => {
    await reachSequentialThree();

    const merge = () => screen.getByRole('button', { name: 'Merge Citra Dewi into the previous step' });
    merge().focus();
    fireEvent.click(merge());

    expect(groupedNames()).toEqual([['Rina Halim'], ['Budi Santoso', 'Citra Dewi']]);
    expect(document.activeElement).toBe(merge());
    expect(document.activeElement).not.toBe(document.body);
  });

  it('§A2.8 — reordering loses nothing the user entered', async () => {
    await reachSequentialThree();

    // Put something distinctive on every row, including a box left mid-edit.
    fireEvent.change(screen.getByLabelText(/^Signatures for Citra Dewi$/), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'More eMeterai for Rina Halim' }));
    fireEvent.change(screen.getByLabelText(/Full name for Budi Santoso/), {
      target: { value: 'Budi  Santoso ' },
    });

    // Scoped INSIDE the step groups: the column-header strip also carries
    // `.signer-row`, and it holds no inputs.
    const snapshot = () =>
      [...document.querySelectorAll('.step-group .signer-row')].map((row) =>
        [...row.querySelectorAll('input')].map((input) => (input as HTMLInputElement).value),
      );

    // Read in STEP order before and after, following the row that moves.
    const before = snapshot();
    fireEvent.click(screen.getByRole('button', { name: 'Move Citra Dewi to an earlier step' }));
    const after = snapshot();

    // Rina stays first; Citra and Budi swap places, each carrying its values.
    expect(before[0]).toEqual(after[0]);
    expect(before[2]).toEqual(after[1]); // Citra, moved up
    expect(before[1]).toEqual(after[2]); // Budi, pushed down
    // Spelled out, because "lost nothing" is the claim being made.
    expect((screen.getByLabelText(/^Signatures for Citra Dewi$/) as HTMLInputElement).value).toBe('4');
    expect((screen.getByLabelText(/^eMeterai for Rina Halim$/) as HTMLInputElement).value).toBe('1');
    // The accessible name is trimmed and whitespace-normalized; the VALUE is
    // not touched, which is the §A2.8 claim.
    expect(
      (screen.getByLabelText(/Full name for Budi Santoso/) as HTMLInputElement).value,
    ).toBe('Budi  Santoso ');
  });

  it('§A3.3 — a meterai carrier moved out of step 1 is marked on THAT row', async () => {
    await reachSequentialThree();

    fireEvent.click(screen.getByRole('button', { name: 'More eMeterai for Rina Halim' }));
    // Step 1 is where a duty stamp belongs, so nothing is wrong yet.
    expect(screen.queryByText(/eMeterai in step/)).toBeNull();
    expect(continueButton().disabled).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Move Rina Halim to a later step' }));

    const reason =
      'eMeterai in step 2 — a duty stamp is affixed before the signing chain starts, ' +
      'so move this recipient to step 1 or set their eMeterai to 0';

    const rina = screen.getByRole('group', { name: 'Recipient 1' });
    expect(within(rina).getByText(reason)).toBeTruthy();
    expect(screen.getByLabelText(/^eMeterai for Rina Halim$/).getAttribute('aria-invalid')).toBe('true');
    // The clean rows stay clean — the row is marked, not the form (§B7 row 4's rule).
    expect(screen.getByLabelText(/^eMeterai for Budi Santoso$/).getAttribute('aria-invalid')).toBeNull();

    const button = continueButton();
    expect(button.disabled).toBe(true);
    expect(describedByText(button)).toContain(reason);
  });

  it('§A3.3 — merging the carrier back into step 1 clears it', async () => {
    await reachSequentialThree();

    fireEvent.click(screen.getByRole('button', { name: 'More eMeterai for Rina Halim' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move Rina Halim to a later step' }));
    expect(continueButton().disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Merge Rina Halim into the previous step' }));

    expect(screen.queryByText(/eMeterai in step/)).toBeNull();
    expect(continueButton().disabled).toBe(false);
  });

  it('§B4 — the payload carries order_mode and a step per recipient in sequential', async () => {
    const calls = await reachSequentialThree(() =>
      json(200, {
        order_mode: 'sequential',
        steps: [
          { step: 1, recipient_emails: ['rina.halim@example.test'] },
          { step: 2, recipient_emails: ['budi.santoso@example.test'] },
          { step: 3, recipient_emails: ['citra.dewi@example.test'] },
        ],
        recipient_count: 3,
        total_signatures: 4,
        total_meterai: 0,
        price: { signature: '5000.00', meterai: '10000.10' },
        charges: { signature: '20000.00', meterai: '0.00' },
        total_charge: '20000.00',
        quota: { signature: 8, meterai: 3 },
        quota_remaining: { signature: 4, meterai: 3 },
      }),
    );

    fireEvent.click(continueButton());
    await screen.findByText('Server-confirmed');

    const body = calls.at(-1)?.body as {
      order_mode: string;
      recipients: Record<string, unknown>[];
    };
    expect(Object.keys(body)).toEqual(['order_mode', 'recipients']);
    expect(body.order_mode).toBe('sequential');
    expect(body.recipients.map((r) => r.step)).toEqual([1, 2, 3]);
    for (const recipient of body.recipients) {
      expect(Object.keys(recipient).sort()).toEqual([
        'email',
        'meterai_count',
        'name',
        'signature_count',
        'step',
      ]);
    }
  });

  it('§B7 row 9 — switching back to parallel stops sending step entirely', async () => {
    const calls = await reachSequentialThree(() =>
      json(200, {
        order_mode: 'parallel',
        steps: [
          {
            step: 1,
            recipient_emails: [
              'rina.halim@example.test',
              'budi.santoso@example.test',
              'citra.dewi@example.test',
            ],
          },
        ],
        recipient_count: 3,
        total_signatures: 4,
        total_meterai: 0,
        price: { signature: '5000.00', meterai: '10000.10' },
        charges: { signature: '20000.00', meterai: '0.00' },
        total_charge: '20000.00',
        quota: { signature: 8, meterai: 3 },
        quota_remaining: { signature: 4, meterai: 3 },
      }),
    );

    // Arrange a chain first, so there IS a step that could leak.
    fireEvent.click(screen.getByRole('button', { name: 'Merge Citra Dewi into the previous step' }));
    fireEvent.click(parallelRadio());

    expect(document.querySelectorAll('.step-group')).toHaveLength(0);
    fireEvent.click(continueButton());
    await screen.findByText('Server-confirmed');

    const serialized = JSON.stringify(calls.at(-1)?.body);
    expect(serialized).not.toContain('step');
    expect(JSON.parse(serialized).order_mode).toBe('parallel');
  });

  it('a mode change invalidates a server-confirmed total (§8.10, staleness guard)', async () => {
    await reachStepTwo(() =>
      json(200, {
        order_mode: 'parallel',
        steps: [{ step: 1, recipient_emails: ['rina.halim@example.test', 'budi.santoso@example.test'] }],
        recipient_count: 2,
        total_signatures: 3,
        total_meterai: 0,
        price: { signature: '5000.00', meterai: '10000.10' },
        charges: { signature: '15000.00', meterai: '0.00' },
        total_charge: '15000.00',
        quota: { signature: 8, meterai: 3 },
        quota_remaining: { signature: 5, meterai: 3 },
      }),
    );

    fireEvent.click(continueButton());
    await screen.findByText('Server-confirmed');

    fireEvent.click(sequentialRadio());

    expect(screen.queryByText('Server-confirmed')).toBeNull();
    expect(screen.getByText('Estimate')).toBeTruthy();
  });

  it('a step change invalidates a server-confirmed total too', async () => {
    await reachSequentialThree(() =>
      json(200, {
        order_mode: 'sequential',
        steps: [
          { step: 1, recipient_emails: ['rina.halim@example.test'] },
          { step: 2, recipient_emails: ['budi.santoso@example.test'] },
          { step: 3, recipient_emails: ['citra.dewi@example.test'] },
        ],
        recipient_count: 3,
        total_signatures: 4,
        total_meterai: 0,
        price: { signature: '5000.00', meterai: '10000.10' },
        charges: { signature: '20000.00', meterai: '0.00' },
        total_charge: '20000.00',
        quota: { signature: 8, meterai: 3 },
        quota_remaining: { signature: 4, meterai: 3 },
      }),
    );

    fireEvent.click(continueButton());
    await screen.findByText('Server-confirmed');

    // Nothing about WHO signs changed — only the order. The guard still fires.
    fireEvent.click(screen.getByRole('button', { name: 'Merge Citra Dewi into the previous step' }));

    expect(screen.queryByText('Server-confirmed')).toBeNull();
    expect(screen.getByText('Estimate')).toBeTruthy();
  });

  it('the mode radios keep their label association (PRD §8.12)', async () => {
    await reachStepTwo();
    for (const radio of document.querySelectorAll('.order-mode input')) {
      expect(document.querySelector(`label[for="${radio.id}"]`)).not.toBeNull();
    }
    // P2 adds no navigation of its own. Case 2 §A4 unlocked Step 3, so the
    // assertion is now "we are still on Step 2" rather than "pill 3 is locked".
    expect(document.querySelector('[aria-current="step"]')?.textContent).toContain(
      'Set recipients',
    );
  });
});
