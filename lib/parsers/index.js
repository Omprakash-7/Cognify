/**
 * Parser router for Cognify documents.
 * Dispatches by fileType: pdf, pptx, docx, txt.
 */

import { parsePdf } from './pdf.js';
import { parsePptx } from './pptx.js';
import { parseDocx } from './docx.js';
import { parseTxt } from './txt.js';

/**
 * Parse a file buffer according to its file type.
 * @param {Buffer} buffer
 * @param {'pdf'|'pptx'|'docx'|'txt'} fileType
 * @returns {Promise<Array<{ page: number, text: string }>>}
 */
export async function parseDocument(buffer, fileType) {
  switch (fileType?.toLowerCase()) {
    case 'pdf':
      return parsePdf(buffer);
    case 'pptx':
      return parsePptx(buffer);
    case 'docx':
      return parseDocx(buffer);
    case 'txt':
      return parseTxt(buffer);
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}
