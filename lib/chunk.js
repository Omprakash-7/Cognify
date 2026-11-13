/**
 * Text chunking for document pages.
 *
 * A chunk NEVER crosses a page boundary so every citation maps to one exact page.
 * Paragraphs are packed up to maxChars; oversized paragraphs are hard-split on
 * word boundaries with overlap.
 */

/**
 * @typedef {Object} Page
 * @property {number} page - 1-based page (or slide) number.
 * @property {string} text - Full text of the page.
 */

/**
 * @typedef {Object} Chunk
 * @property {number} pageNumber - Source page number.
 * @property {number} chunkIndex - Sequential index (0-based across all pages).
 * @property {string} content - Chunk text.
 */

/**
 * Split an array of pages into chunks.
 *
 * @param {Page[]} pages - Array of {page, text} objects.
 * @param {Object} [opts]
 * @param {number} [opts.maxChars=1200] - Maximum characters per chunk.
 * @param {number} [opts.overlap=150] - Character overlap for hard-split paragraphs.
 * @returns {Chunk[]}
 */
export function chunkPages(pages, { maxChars = 1200, overlap = 150 } = {}) {
  /** @type {Chunk[]} */
  const chunks = [];
  let chunkIndex = 0;

  for (const { page, text } of pages) {
    if (!text || !text.trim()) continue; // skip empty pages

    const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim());

    let buffer = '';

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;

      // If adding this paragraph fits within maxChars, pack it
      if (buffer && buffer.length + 1 + trimmed.length <= maxChars) {
        buffer += '\n' + trimmed;
        continue;
      }

      // Flush the current buffer if non-empty
      if (buffer) {
        chunks.push({ pageNumber: page, chunkIndex: chunkIndex++, content: buffer });
        buffer = '';
      }

      // If the paragraph itself fits, start a new buffer
      if (trimmed.length <= maxChars) {
        buffer = trimmed;
        continue;
      }

      // Hard-split oversized paragraph on word boundaries with overlap
      const words = trimmed.split(/\s+/);
      let segment = '';

      for (const word of words) {
        if (segment && segment.length + 1 + word.length > maxChars) {
          chunks.push({ pageNumber: page, chunkIndex: chunkIndex++, content: segment });

          // Build overlap: take trailing characters from segment
          const overlapStart = Math.max(0, segment.length - overlap);
          const tail = segment.slice(overlapStart);
          // Start the next segment from the last whole word boundary in the tail
          const lastSpace = tail.lastIndexOf(' ');
          segment = lastSpace >= 0 ? tail.slice(lastSpace + 1) : tail;
          segment += ' ' + word;
        } else {
          segment = segment ? segment + ' ' + word : word;
        }
      }

      if (segment) {
        buffer = segment;
      }
    }

    // Flush remaining buffer for this page
    if (buffer) {
      chunks.push({ pageNumber: page, chunkIndex: chunkIndex++, content: buffer });
      buffer = '';
    }
  }

  return chunks;
}
