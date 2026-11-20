/**
 * Generates sample test fixtures in tests/fixtures/.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function createFixtures() {
  const dir = __dirname;
  const writeIfMissing = (file, data, enc) => {
    if (!fs.existsSync(file)) {
      if (enc) fs.writeFileSync(file, data, enc);
      else fs.writeFileSync(file, data);
    }
  };

  // 1. TXT fixture
  const txtContent = `Newton's First Law
An object at rest remains at rest, and an object in motion remains in motion at constant speed and in a straight line unless acted upon by an unbalanced force.

Newton's Second Law
The acceleration of an object depends on the mass of the object and the amount of force applied. Force equals mass times acceleration (F = ma).

Newton's Third Law
Whenever one object exerts a force on another object, the second object exerts an equal and opposite force on the first. For every action, there is an equal and opposite reaction.`;

  writeIfMissing(path.join(dir, 'sample.txt'), txtContent, 'utf-8');

  // 2. PDF fixture (valid 1-page PDF with text)
  const validPdf = `%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj <</Length 62>> stream
BT /F1 24 Tf 100 700 Td (Classical Mechanics: Newton Laws of Motion) Tj ET
endstream endobj
5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000357 00000 n 
trailer <</Size 6 /Root 1 0 R>>
startxref
431
%%EOF`;

  writeIfMissing(path.join(dir, 'sample.pdf'), Buffer.from(validPdf));

  // 3. Scanned PDF (valid PDF structure but no text stream)
  const scannedPdf = `%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R>> endobj
4 0 obj <</Length 0>> stream
endstream endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000206 00000 n 
trailer <</Size 5 /Root 1 0 R>>
startxref
254
%%EOF`;

  writeIfMissing(path.join(dir, 'scanned.pdf'), Buffer.from(scannedPdf));

  // 4. Corrupt file
  writeIfMissing(path.join(dir, 'corrupt.pdf'), Buffer.from('NOT A PDF FILE AT ALL'));

  // 5. PPTX fixture
  if (!fs.existsSync(path.join(dir, 'sample.pptx'))) {
    const pptxZip = new JSZip();
    pptxZip.file('[Content_Types].xml', '<Types></Types>');
    pptxZip.file(
      'ppt/slides/slide1.xml',
      '<p:sp><p:txBody><a:p><a:r><a:t>Slide 1: Kinetic and Potential Energy Concepts</a:t></a:r></a:p></p:txBody></p:sp>'
    );
    pptxZip.file(
      'ppt/slides/slide2.xml',
      '<p:sp><p:txBody><a:p><a:r><a:t>Slide 2: Conservation of Mechanical Energy Principles</a:t></a:r></a:p></p:txBody></p:sp>'
    );
    const pptxBuf = await pptxZip.generateAsync({ type: 'nodebuffer' });
    fs.writeFileSync(path.join(dir, 'sample.pptx'), pptxBuf);
  }

  // 6. DOCX fixture
  if (!fs.existsSync(path.join(dir, 'sample.docx'))) {
    const docxZip = new JSZip();
    docxZip.file(
      'word/document.xml',
      '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Thermodynamics: Heat and Work exchange in closed physical systems.</w:t></w:r></w:p></w:body></w:document>'
    );
    const docxBuf = await docxZip.generateAsync({ type: 'nodebuffer' });
    fs.writeFileSync(path.join(dir, 'sample.docx'), docxBuf);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createFixtures().then(() => console.log('Fixtures generated successfully.'));
}
