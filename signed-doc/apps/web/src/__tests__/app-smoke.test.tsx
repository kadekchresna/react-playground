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
    price: { signature: '5000.00' },
    quota: { signature: 8 },
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
  it('renders three pills with Place fields locked, non-focusable and not navigable', () => {
    stubApi({});
    const { container } = render(<App />);

    const pills = container.querySelectorAll('.stepper__pill');
    expect(pills).toHaveLength(3);

    const locked = pills[2] as HTMLElement;
    expect(locked.textContent).toContain('Place fields');
    expect(locked.getAttribute('aria-disabled')).toBe('true');
    expect(locked.tagName).toBe('LI'); // no button, no link, no handler
    expect(locked.querySelectorAll('a, button, input, [tabindex]')).toHaveLength(0);
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
        recipient_count: 2,
        total_signatures: 3,
        price: { signature: '5000.00' },
        charges: { signature: '15000.00' },
        total_charge: '15000.00',
        quota: { signature: 8 },
        quota_remaining: { signature: 5 },
      }),
    );

    fireEvent.click(continueButton());
    await screen.findByText('Server-confirmed');

    const body = calls.at(-1)?.body as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(['recipients']);
    expect(Object.keys((body.recipients as Record<string, unknown>[])[0] ?? {}).sort()).toEqual([
      'email',
      'name',
      'signature_count',
    ]);

    expect(screen.getByText('Rp15.000,00')).toBeTruthy();
    expect(screen.getByText('5 of 8')).toBeTruthy();
    // ADR-005 / LD-13: no navigation, and Step 3 stays locked.
    expect(screen.getByRole('heading', { name: 'Who signs it?' })).toBeTruthy();
    expect(document.querySelectorAll('.stepper__pill')[2]?.getAttribute('aria-disabled')).toBe('true');
  });

  it('drops the server-confirmed label as soon as the data changes (§8.10)', async () => {
    await reachStepTwo(() =>
      json(200, {
        recipient_count: 2,
        total_signatures: 3,
        price: { signature: '5000.00' },
        charges: { signature: '15000.00' },
        total_charge: '15000.00',
        quota: { signature: 8 },
        quota_remaining: { signature: 5 },
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
            recipient_count: 2,
            total_signatures: 3,
            price: { signature: '5000.00' },
            charges: { signature: '15000.00' },
            total_charge: '15000.00',
            quota: { signature: 8 },
            quota_remaining: { signature: 5 },
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
  it('holds for the name, email and signature inputs of every row', async () => {
    const { container } = render(<div />);
    void container;
    await reachStepTwo();

    const inputs = document.querySelectorAll('.signer-row input');
    expect(inputs.length).toBe(6);
    for (const input of inputs) {
      expect(document.querySelector(`label[for="${input.id}"]`)).not.toBeNull();
    }
    expect(document.getElementById('signer-name-0')).not.toBeNull();
    expect(document.getElementById('signer-email-0')).not.toBeNull();
    expect(document.getElementById('signer-count-0')).not.toBeNull();
  });
});
