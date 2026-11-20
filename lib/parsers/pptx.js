/**
 * PPTX parser using jszip.
 * Extracts slide text from ppt/slides/slideN.xml in numeric order,
 * plus notesSlides text if present. Returns [{ page, text }].
 */

import JSZip from 'jszip';

export async function parsePptx(buffer) {
  // Check magic bytes: PK\x03\x04 (0x50 0x4B 0x03 0x04)
  if (
    buffer.length < 4 ||
    buffer[0] !== 0x50 ||
    buffer[1] !== 0x4B ||
    buffer[2] !== 0x03 ||
    buffer[3] !== 0x04
  ) {
    throw new Error('Invalid PPTX file format (magic bytes mismatch)');
  }

  let zip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (err) {
    throw new Error(`Failed to read PPTX archive: ${err.message}`);
  }

  // Find all slide XML files
  const slideFiles = [];
  zip.forEach((relativePath) => {
    const match = relativePath.match(/^ppt\/slides\/slide(\d+)\.xml$/);
    if (match) {
      slideFiles.push({ path: relativePath, num: parseInt(match[1], 10) });
    }
  });

  if (slideFiles.length === 0) {
    throw new Error('No slides found in PPTX presentation');
  }

  // Sort by slide number
  slideFiles.sort((a, b) => a.num - b.num);

  const pages = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const { path, num } = slideFiles[i];
    const xml = await zip.file(path).async('string');

    // Extract text inside <a:t> tags
    const textMatches = xml.match(/<a:t[^>]*>(.*?)<\/a:t>/gs) || [];
    const textPieces = textMatches.map((t) => t.replace(/<[^>]+>/g, '').trim()).filter(Boolean);

    // Check matching notes slide
    const notesFile = zip.file(`ppt/notesSlides/notesSlide${num}.xml`);
    if (notesFile) {
      const notesXml = await notesFile.async('string');
      const notesMatches = notesXml.match(/<a:t[^>]*>(.*?)<\/a:t>/gs) || [];
      const notesPieces = notesMatches.map((t) => t.replace(/<[^>]+>/g, '').trim()).filter(Boolean);
      textPieces.push(...notesPieces);
    }

    pages.push({
      page: i + 1,
      text: textPieces.join('\n').trim(),
    });
  }

  const hasText = pages.some((p) => p.text.length > 0);
  if (!hasText) {
    throw new Error('PPTX presentation contains no extractable text');
  }

  return pages;
}
