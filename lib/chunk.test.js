/**
 * Tests for chunkPages using node:assert.
 * Run: node lib/chunk.test.js
 */

import assert from 'node:assert/strict';
import { chunkPages } from './chunk.js';

// ── Test 1: page numbers are preserved ──
{
  const pages = [
    { page: 3, text: 'Hello world on page three.' },
    { page: 7, text: 'Content on page seven.' },
  ];
  const chunks = chunkPages(pages);
  assert.equal(chunks[0].pageNumber, 3, 'first chunk should be page 3');
  assert.equal(chunks[1].pageNumber, 7, 'second chunk should be page 7');
  console.log('[PASS] page numbers kept');
}

// ── Test 2: max length is respected ──
{
  const longText = 'word '.repeat(500); // ~2500 chars
  const pages = [{ page: 1, text: longText }];
  const chunks = chunkPages(pages, { maxChars: 200, overlap: 30 });
  for (const c of chunks) {
    assert.ok(
      c.content.length <= 210, // small tolerance for word boundaries
      `chunk ${c.chunkIndex} length ${c.content.length} exceeds limit`
    );
  }
  console.log('[PASS] max length respected');
}

// ── Test 3: empty pages are skipped ──
{
  const pages = [
    { page: 1, text: 'Real content.' },
    { page: 2, text: '' },
    { page: 3, text: '   \n\n  ' },
    { page: 4, text: 'More content.' },
  ];
  const chunks = chunkPages(pages);
  const pageNumbers = chunks.map((c) => c.pageNumber);
  assert.ok(!pageNumbers.includes(2), 'page 2 should be skipped');
  assert.ok(!pageNumbers.includes(3), 'page 3 should be skipped');
  console.log('[PASS] empty pages skipped');
}

// ── Test 4: long text is split ──
{
  const longText = 'word '.repeat(1000); // ~5000 chars
  const pages = [{ page: 1, text: longText }];
  const chunks = chunkPages(pages, { maxChars: 1200, overlap: 150 });
  assert.ok(chunks.length > 1, 'long text should produce multiple chunks');
  console.log('[PASS] long text split');
}

// ── Test 5: sequential chunk indexes ──
{
  const pages = [
    { page: 1, text: 'First page with some text.\n\nAnother paragraph.' },
    { page: 2, text: 'Second page.' },
    { page: 3, text: 'Third page has content too.' },
  ];
  const chunks = chunkPages(pages);
  for (let i = 0; i < chunks.length; i++) {
    assert.equal(
      chunks[i].chunkIndex,
      i,
      `chunkIndex should be ${i}, got ${chunks[i].chunkIndex}`
    );
  }
  console.log('[PASS] sequential indexes');
}

console.log('\nAll chunk tests passed ✓');
