/**
 * The "Your document" card (PRD §7.4). Copy from mockup board 1.
 *
 * The filename is untrusted input that the server deliberately does NOT launder
 * of `<` and `>` (see `sanitizeFilename`), so that the real defence is exercised
 * rather than bypassed. That defence is here: `{filename}` is a JSX expression,
 * which React escapes into a text node. `<img src=x onerror=alert(1)>.pdf`
 * therefore appears as visible characters and no element is created.
 *
 * There is no `dangerouslySetInnerHTML` in this file, and none anywhere in
 * `apps/web/src`.
 */

import { formatBytes } from '../../format/money-display.js';

export interface DocumentCardProps {
  readonly filename: string;
  readonly pageCount: number;
  readonly sizeBytes: number;
  readonly onRemove: () => void;
}

export function DocumentCard({
  filename,
  pageCount,
  sizeBytes,
  onRemove,
}: DocumentCardProps): JSX.Element {
  return (
    <div className="upload-field">
      <p className="field-label">Your document</p>
      <div className="doc-card">
        <span className="doc-card__glyph" aria-hidden="true">
          &#128196;
        </span>
        <div className="doc-card__body">
          {/* Text node only — never HTML (PRD §10 XSS row). */}
          <div className="doc-card__name">{filename}</div>
          <div className="doc-card__meta">
            {`Uploaded · ${pageCount} pages · ${formatBytes(sizeBytes)}`}
          </div>
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label={`Remove ${filename}`}
          onClick={onRemove}
        >
          <span aria-hidden="true">&#215;</span>
        </button>
      </div>
    </div>
  );
}
