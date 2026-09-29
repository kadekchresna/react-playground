/**
 * Send a file part under a filename the CLIENT has not already cleaned up.
 *
 * `superagent.attach(field, bytes, { filename })` runs the name through
 * `path.basename` before it leaves the test process, so `../../etc/passwd.pdf`
 * would arrive at the server as `passwd.pdf` and a path-traversal test would
 * prove nothing. form-data's `filepath` option skips that and writes the name
 * into `Content-Disposition` verbatim, which is exactly the hostile input the
 * server is supposed to survive (PRD §7.8).
 *
 * `@types/supertest` models only `{ filename, contentType }`, so the option is
 * cast at this single site rather than at every call. That is the one typing
 * gap in this package and it is confined to test support code.
 */

import type request from 'supertest';

export interface RawAttachOptions {
  /** Written to `Content-Disposition` as-is — path components and all. */
  readonly filepath: string;
  /**
   * Deliberately independent of the extension: PRD §7.9 forbids the server
   * from judging the file type by what the client declares here.
   */
  readonly contentType?: string;
}

type SupertestAttachOptions = { filename?: string; contentType?: string };

export function attachRaw(
  test: request.Test,
  bytes: Buffer,
  options: RawAttachOptions,
): request.Test {
  return test.attach('file', bytes, options as unknown as SupertestAttachOptions);
}
