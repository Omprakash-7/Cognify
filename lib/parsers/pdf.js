/**
 * PDF parser using unpdf.
 * Returns an array of [{ page, text }] objects.
 */

import { extractText } from 'unpdf';

const MAX_PAGES = parseInt(process.env.MAX_PAGES || '300', 10);

export async function parsePdf(buffer) {
  // Check magic bytes: %PDF (0x25 0x50 0x44 0x46)
  if (
    buffer.length < 4 ||
    buffer[0] !== 0x25 ||
    buffer[1] !== 0x50 ||
    buffer[2] !== 0x44 ||
    buffer[3] !== 0x46
  ) {
    throw new Error('Invalid PDF file format (magic bytes mismatch)');
  }

  const { totalPages, text: pageTexts } = await extractText(buffer, { mergePages: false });

  if (totalPages > MAX_PAGES) {
    throw new Error(`Document page count (${totalPages}) exceeds maximum allowed limit of ${MAX_PAGES}`);
  }

  const pages = pageTexts.map((text, idx) => ({
    page: idx + 1,
    text: (text || '').trim(),
  }));

  // Check for scanned PDF (all pages empty)
  const hasText = pages.some((p) => p.text.length > 0);
  if (!hasText) {
    throw new Error('No selectable text found (scanned PDF not supported yet)');
  }

  return pages;
}
