const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

// Extensions MarkItDown can meaningfully convert to Markdown.
// Plain text / markdown are handled directly by the caller.
const SUPPORTED_EXTENSIONS = new Set([
  '.pdf',
  '.docx', '.doc',
  '.pptx', '.ppt',
  '.xlsx', '.xls',
  '.csv', '.tsv',
  '.html', '.htm', '.xml',
  '.json',
  '.epub',
  '.rtf',
  '.odt', '.ods', '.odp',
]);

function resolveMarkitdownBinary() {
  if (process.env.MARKITDOWN_BIN && fs.existsSync(process.env.MARKITDOWN_BIN)) {
    return process.env.MARKITDOWN_BIN;
  }
  // Bundled project virtualenv at repo root (see README / setup).
  const venvBin = path.resolve(__dirname, '..', '..', '.venv', 'bin', 'markitdown');
  if (fs.existsSync(venvBin)) return venvBin;
  return 'markitdown';
}

function isSupportedExtension(ext) {
  return SUPPORTED_EXTENSIONS.has((ext || '').toLowerCase());
}

/**
 * Convert a file buffer to Markdown using MarkItDown.
 * Writes to a temp file (markitdown dispatches by extension) and invokes the CLI.
 *
 * @param {Buffer} buffer
 * @param {string} originalName  used for extension / temp file suffix
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs=60000]
 * @returns {Promise<{ markdown: string, binary: string }>}
 */
function convertBufferToMarkdown(buffer, originalName, opts = {}) {
  const timeoutMs = opts.timeoutMs || 60000;
  const binary = resolveMarkitdownBinary();
  const ext = path.extname(originalName || '') || '.bin';
  const tmpPath = path.join(
    os.tmpdir(),
    `markitdown-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`
  );

  fs.writeFileSync(tmpPath, buffer);

  return new Promise((resolve, reject) => {
    const child = spawn(binary, [tmpPath], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill('SIGKILL'); } catch (_) { /* noop */ }
      cleanup();
      reject(new Error(`MarkItDown timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      fs.promises.unlink(tmpPath).catch(() => {});
    };

    child.stdout.on('data', (d) => { stdout += d.toString('utf8'); });
    child.stderr.on('data', (d) => { stderr += d.toString('utf8'); });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`Failed to run MarkItDown (${binary}): ${err.message}`));
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (code === 0) {
        resolve({ markdown: stdout, binary });
      } else {
        const snippet = (stderr || '').slice(0, 500).trim();
        reject(new Error(`MarkItDown exited with code ${code}${snippet ? `: ${snippet}` : ''}`));
      }
    });
  });
}

module.exports = {
  SUPPORTED_EXTENSIONS,
  isSupportedExtension,
  resolveMarkitdownBinary,
  convertBufferToMarkdown,
};
