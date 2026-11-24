'use client';

import { useMemo } from 'react';
import katex from 'katex';

/**
 * MathRenderer Component
 *
 * High-performance mathematical typesetting component built on KaTeX.
 * Parses and formats complex mathematical notation, chemical formulas,
 * and academic problem statements for STEM curricula (JEE Advanced, NEET, etc.).
 *
 * Supported Notation Delimiters:
 * - Block Math: `$$...$$` and `\[...\]` (Display mode, centered)
 * - Inline Math: `$...$` and `\(...\)` (Inline text flow)
 * - Basic Markdown: bold (`**`), italic (`*`), code (`...`), line breaks
 *
 * @param {object} props
 * @param {string|number} [props.content] - String containing LaTeX equations or mixed markdown
 * @param {string|number} [props.text] - Alias for content
 * @param {string} [props.math] - Pure LaTeX string to render directly in KaTeX mode
 * @param {React.ReactNode} [props.children] - Children fallback if props.content is omitted
 * @param {boolean} [props.display=false] - When true and props.math is passed, renders in display mode
 * @returns {React.ReactElement|null}
 */
export function MathRenderer({ content, text, math, children, display = false }) {
  const rawInput = math ?? content ?? text ?? (typeof children === 'string' ? children : '') ?? '';

  const html = useMemo(() => {
    if (!rawInput && rawInput !== 0) return '';

    let inputStr = typeof rawInput === 'string' ? rawInput : JSON.stringify(rawInput);

    // Direct math mode (pure LaTeX equation)
    if (math) {
      try {
        return katex.renderToString(inputStr, {
          displayMode: display,
          throwOnError: false,
        });
      } catch {
        return inputStr;
      }
    }

    // 1. Process block display formulas ($$...$$)
    inputStr = inputStr.replace(/\$\$([\s\S]+?)\$\$/g, (_, eq) => {
      try {
        return katex.renderToString(eq.trim(), { displayMode: true, throwOnError: false });
      } catch {
        return eq;
      }
    });

    // 2. Process LaTeX bracket display formulas (\[...\])
    inputStr = inputStr.replace(/\\\[([\s\S]+?)\\\]/g, (_, eq) => {
      try {
        return katex.renderToString(eq.trim(), { displayMode: true, throwOnError: false });
      } catch {
        return eq;
      }
    });

    // 3. Process inline formulas ($...$)
    inputStr = inputStr.replace(/\$([^\$\n\r]+?)\$/g, (_, eq) => {
      try {
        return katex.renderToString(eq.trim(), { displayMode: false, throwOnError: false });
      } catch {
        return eq;
      }
    });

    // 4. Process LaTeX parentheses inline formulas (\(...\))
    inputStr = inputStr.replace(/\\\(([\s\S]+?)\\\)/g, (_, eq) => {
      try {
        return katex.renderToString(eq.trim(), { displayMode: false, throwOnError: false });
      } catch {
        return eq;
      }
    });

    // 5. Lightweight markdown enhancement for pedagogy explanations
    inputStr = inputStr
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-on-surface">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
      .replace(/`([^`]+)`/g, '<code class="bg-surface-container px-1 py-0.5 rounded text-xs font-mono">$1</code>')
      .replace(/\n/g, '<br/>');

    return inputStr;
  }, [rawInput, math, display]);

  if (!rawInput && rawInput !== 0) return null;

  return (
    <span
      className="math-renderer inline-block align-baseline"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

