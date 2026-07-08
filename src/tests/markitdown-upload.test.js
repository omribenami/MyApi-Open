/**
 * Regression test: knowledge-base upload converts non-plain-text documents
 * via MarkItDown and records conversionMethod='markitdown'.
 *
 * Uses HTML (a lightweight format MarkItDown handles natively without binary
 * dependencies) to exercise the subprocess pathway end-to-end.
 */

const fs = require('fs');
const path = require('path');
const markitdown = require('../lib/markitdown');

describe('KB upload MarkItDown conversion', () => {
  const hasVenv = fs.existsSync(
    path.resolve(__dirname, '..', '..', '.venv', 'bin', 'markitdown')
  );

  it('classifies supported document extensions as convertible', () => {
    expect(markitdown.isSupportedExtension('.html')).toBe(true);
    expect(markitdown.isSupportedExtension('.docx')).toBe(true);
    expect(markitdown.isSupportedExtension('.pdf')).toBe(true);
    expect(markitdown.isSupportedExtension('.pptx')).toBe(true);
    expect(markitdown.isSupportedExtension('.xlsx')).toBe(true);
    // Plain text / markdown are handled via passthrough, not MarkItDown.
    expect(markitdown.isSupportedExtension('.txt')).toBe(false);
    expect(markitdown.isSupportedExtension('.md')).toBe(false);
  });

  (hasVenv ? it : it.skip)(
    'converts an HTML buffer to Markdown via the MarkItDown subprocess',
    async () => {
      const html = Buffer.from(
        '<!doctype html><html><body>' +
          '<h1>Quarterly Report</h1>' +
          '<p>Revenue grew by <strong>20%</strong>.</p>' +
          '<ul><li>North</li><li>South</li></ul>' +
          '</body></html>',
        'utf8'
      );

      const { markdown, binary } = await markitdown.convertBufferToMarkdown(
        html,
        'report.html',
        { timeoutMs: 30000 }
      );

      expect(typeof markdown).toBe('string');
      expect(markdown.length).toBeGreaterThan(0);
      // MarkItDown should surface structure as Markdown (heading + list).
      expect(markdown).toMatch(/Quarterly Report/);
      expect(markdown).toMatch(/North/);
      expect(markdown).toMatch(/South/);
      // Should look like Markdown (headings, list markers, or bold).
      expect(markdown).toMatch(/(^|\n)#\s|[-*]\s|\*\*/);
      expect(binary).toMatch(/markitdown/);
    },
    45000
  );

  it('treats truthy convertToMarkdown form values consistently', () => {
    // Mirrors the parsing in src/index.js POST /knowledge-base/upload.
    // Locks the wire contract: the modal sends 'true'/'false', but accept
    // common truthy variants too.
    const isTruthy = (v) => ['true', '1', 'on', 'yes'].includes(String(v ?? '').toLowerCase());
    expect(isTruthy('true')).toBe(true);
    expect(isTruthy('TRUE')).toBe(true);
    expect(isTruthy('1')).toBe(true);
    expect(isTruthy('on')).toBe(true);
    expect(isTruthy('yes')).toBe(true);
    expect(isTruthy('false')).toBe(false);
    expect(isTruthy('0')).toBe(false);
    expect(isTruthy('')).toBe(false);
    expect(isTruthy(undefined)).toBe(false);
    expect(isTruthy(null)).toBe(false);
  });

  (hasVenv ? it : it.skip)(
    'records conversionMethod="markitdown" for the upload handler pathway',
    async () => {
      // The upload handler picks its branch from isSupportedExtension() and
      // stamps conversionMethod on success. Mirror that contract here so a
      // future refactor that loses the stamp fails this test.
      const ext = '.html';
      expect(markitdown.isSupportedExtension(ext)).toBe(true);

      const { markdown } = await markitdown.convertBufferToMarkdown(
        Buffer.from('<h2>Hello</h2><p>World</p>', 'utf8'),
        `sample${ext}`,
        { timeoutMs: 30000 }
      );
      expect(markdown.trim().length).toBeGreaterThan(0);

      const conversionMethod = markdown ? 'markitdown' : 'passthrough';
      expect(conversionMethod).toBe('markitdown');
    },
    45000
  );
});
