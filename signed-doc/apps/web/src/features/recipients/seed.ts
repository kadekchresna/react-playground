/**
 * Frontend initial state for Step 2 (LD-15).
 *
 * The two recipients PRD §6 names, exactly as it names them. This is a
 * convenience for a reviewer opening the app — the server never assumes a
 * recipient exists, and nothing here is sent until the user asks for a preview.
 *
 * Only `@example.test` fixture addresses appear, per PRD §5: no real personal
 * data anywhere in source, bundle, logs or documents.
 */

import { DEFAULT_ORDER_MODE } from '@signed-doc/shared';

import type { RecipientsState } from './recipients-reducer.js';

export function createSeedState(): RecipientsState {
  return {
    // §A2 — `parallel` is the default, and parallel rows carry no `step`
    // (§B4: sending one is `422 UNKNOWN_FIELD`). The seed therefore looks
    // exactly as it did in Case 1 until the user picks the other mode.
    orderMode: DEFAULT_ORDER_MODE,
    rows: [
      {
        id: 'r0',
        name: 'Rina Halim',
        email: 'rina.halim@example.test',
        signature_count: 2,
        countRaw: '2',
        // §A3.1: the default is 0. The seed states the default rather than
        // choosing a billable value on the user's behalf.
        meterai_count: 0,
        meteraiRaw: '0',
      },
      {
        id: 'r1',
        name: 'Budi Santoso',
        email: 'budi.santoso@example.test',
        signature_count: 1,
        countRaw: '1',
        meterai_count: 0,
        meteraiRaw: '0',
      },
    ],
    nextId: 2,
  };
}
