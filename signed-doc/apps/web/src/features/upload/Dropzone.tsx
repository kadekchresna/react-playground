/**
 * The Step 1 dropzone (PRD §7.1). Copy taken verbatim from mockup board 1.
 *
 * Keyboard reachability is the scored property (PRD §8.12), so `Browse` is a
 * real `<label for>` bound to a visually hidden `input[type=file]`, given
 * `tabIndex={0}` and an Enter/Space handler. The input itself is clipped rather
 * than `display: none` — it still exists for the label to drive — but it is
 * taken out of the tab order so there is no focus stop with no visible ring.
 * The `Upload document` field label is associated with the same input, so the
 * "every input has a `<label>`" rule holds by construction.
 *
 * Drag-and-drop is optional per PRD §7.1 and ships here as an addition; the
 * file-input path works on its own and is what the keyboard uses.
 */

import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react';

import { ALLOWED_EXTENSIONS } from '@signed-doc/shared';

import { DisabledControl } from '../../components/DisabledControl.js';

/** Built from the shared rule list, so the picker filter cannot drift from it. */
const ACCEPT = ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(',');

const HELPER_TEXT = 'One document per request. PDF, JPG, JPEG, PNG, DOC or DOCX.';

export const DOCUMENT_INPUT_ID = 'document-file';

export interface DropzoneProps {
  readonly onSelectFile: (file: File) => void;
  /** Blocks selection while a request is in flight. */
  readonly busy: boolean;
}

export function Dropzone({ onSelectFile, busy }: DropzoneProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  // Exactly one file, always: only the first entry is ever read, so a
  // multi-file drop cannot smuggle a second document in (PRD §7.1).
  const takeFirst = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onSelectFile(file);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (!busy) takeFirst(event.dataTransfer.files);
  };

  const onBrowseKeyDown = (event: KeyboardEvent<HTMLLabelElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    inputRef.current?.click();
  };

  return (
    <div className="upload-field">
      <label className="field-label" htmlFor={DOCUMENT_INPUT_ID}>
        Upload document
      </label>

      <div
        className="dropzone"
        data-dragging={dragging ? 'true' : 'false'}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          id={DOCUMENT_INPUT_ID}
          className="visually-hidden"
          type="file"
          tabIndex={-1}
          accept={ACCEPT}
          disabled={busy}
          onChange={(event) => {
            takeFirst(event.target.files);
            // Reset, so choosing the SAME file twice still fires `change` —
            // otherwise a retry-by-reselect would silently do nothing.
            event.target.value = '';
          }}
        />

        <span className="dropzone__glyph" aria-hidden="true">
          &#8679;
        </span>
        <p className="dropzone__prompt">
          Drop your file here or{' '}
          <label
            className="dropzone__browse"
            htmlFor={DOCUMENT_INPUT_ID}
            tabIndex={busy ? -1 : 0}
            onKeyDown={onBrowseKeyDown}
          >
            Browse
          </label>
        </p>
        <p className="dropzone__hint">{HELPER_TEXT}</p>

        <p className="dropzone__divider">OR</p>
        {/* LD-05: out of scope, rendered honestly rather than removed. */}
        <DisabledControl id="from-cloud" label="From cloud" />
      </div>
    </div>
  );
}
