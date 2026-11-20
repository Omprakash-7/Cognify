/**
 * DOCX parser using mammoth.
 * Extracts raw text and splits into pseudo-pages by headings or ~3000 chars.
 * Returns [{ page, text }].
 */

import mammoth from 'mammoth';

export async function parseDocx(buffer) {
  // Check magic bytes: PK\x03\x04 (0x50 0x4B 0x03 0x04)
  if (
    buffer.length < 4 ||
    buffer[0] !== 0x50 ||
    buffer[1] !== 0x4B ||
    buffer[2] !== 0x03 ||
    buffer[3] !== 0x04
  ) {
    throw new Error('Invalid DOCX file format (magic bytes mismatch)');
  }

  let result;
  try {
    result = await mammoth.extractRawText({ buffer });
  } catch (err) {
    throw new Error(`Failed to parse DOCX: ${err.message}`);
  }

  const rawText = (result.value || '').trim();
  if (!rawText) {
    throw new Error('DOCX document contains no text');
  }

  return splitIntoPseudoPages(rawText);
}

/**
 * Split text into pseudo-pages of ~3000 characters on paragraph boundaries.
 * @param {string} text
 * @param {number} [targetChars=3000]
 * @returns {Array<{ page: number, text: string }>}
 */
export function splitIntoPseudoPages(text, targetChars = 3000) {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) return [];

  const pages = [];
  let buffer = '';

  for (const para of paragraphs) {
    if (buffer && buffer.length + para.length + 2 > targetChars) {
      pages.push({ page: pages.length + 1, text: buffer });
      buffer = para;
    } else {
      buffer = buffer ? `${buffer}\n\n${para}` : para;
    }
  }

  if (buffer) {
    pages.push({ page: pages.length + 1, text: buffer });
  }

  return pages;
}
