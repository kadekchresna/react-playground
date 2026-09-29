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

import type { RecipientsState } from './recipients-reducer.js';

export function createSeedState(): RecipientsState {
  return {
    rows: [
      {
        id: 'r0',
        name: 'Rina Halim',
        email: 'rina.halim@example.test',
        signature_count: 2,
        countRaw: '2',
      },
      {
        id: 'r1',
        name: 'Budi Santoso',
        email: 'budi.santoso@example.test',
        signature_count: 1,
        countRaw: '1',
      },
    ],
    nextId: 2,
  };
}
