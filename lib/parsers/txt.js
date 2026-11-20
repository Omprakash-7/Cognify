/**
 * Plain text parser.
 * Reads UTF-8 text and splits into pseudo-pages of ~3000 chars on paragraph boundaries.
 * Returns [{ page, text }].
 */

import { splitIntoPseudoPages } from './docx.js';

export async function parseTxt(buffer) {
  const text = buffer.toString('utf-8').trim();
  if (!text) {
    throw new Error('Text file is empty');
  }

  return splitIntoPseudoPages(text);
}
