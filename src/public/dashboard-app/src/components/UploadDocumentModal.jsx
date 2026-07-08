import { useEffect, useRef, useState } from 'react';

const ACCEPT_EXTENSIONS = [
  '.txt', '.md', '.markdown',
  '.pdf', '.rtf', '.epub',
  '.doc', '.docx',
  '.ppt', '.pptx',
  '.xls', '.xlsx',
  '.odt', '.ods', '.odp',
  '.csv', '.tsv',
  '.html', '.htm', '.xml', '.json',
];

// Mirrors src/lib/markitdown.js SUPPORTED_EXTENSIONS — files MarkItDown converts.
// Plain text / markdown are passthrough and never need conversion.
const CONVERTIBLE_EXTENSIONS = new Set([
  '.pdf',
  '.doc', '.docx',
  '.ppt', '.pptx',
  '.xls', '.xlsx',
  '.csv', '.tsv',
  '.html', '.htm', '.xml',
  '.json',
  '.epub',
  '.rtf',
  '.odt', '.ods', '.odp',
]);

const TEXTLIKE_EXTENSIONS = new Set(['.txt', '.md', '.markdown']);

function getExt(name) {
  const i = (name || '').lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UploadDocumentModal({ open, onClose, onUpload, uploading, uploadProgress }) {
  const [file, setFile] = useState(null);
  const [convert, setConvert] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setConvert(false);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && open && !uploading) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, uploading, onClose]);

  if (!open) return null;

  const ext = file ? getExt(file.name) : '';
  const isTextLike = TEXTLIKE_EXTENSIONS.has(ext);
  const isConvertible = CONVERTIBLE_EXTENSIONS.has(ext);
  const needsConversion = !!file && !isTextLike && isConvertible;
  const canSubmit = !!file && (!needsConversion || convert) && !uploading;

  const handlePick = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setConvert(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onUpload(file, { convertToMarkdown: needsConversion ? convert : false });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={() => { if (!uploading) onClose(); }}
    >
      <div
        className="card w-full mx-4"
        style={{ maxWidth: '560px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b hairline">
          <div>
            <div className="micro mb-1">KNOWLEDGE BASE</div>
            <h2 className="font-serif text-[20px] leading-tight ink font-medium">Import a document</h2>
          </div>
          <button
            onClick={onClose}
            disabled={uploading}
            className="btn btn-ghost text-[12px] px-2 py-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-5">
          {/* File picker */}
          {!file && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full rounded bg-sunk hairline px-5 py-8 text-center hover:bg-raised transition-colors"
            >
              <div className="ink text-[14px] mb-1">Choose a file to import</div>
              <div className="ink-3 text-[12px]">
                .txt · .md · .pdf · .docx · .pptx · .xlsx · .html · .csv · and more
              </div>
              <div className="ink-4 text-[11.5px] mt-2">Max 10 MB</div>
            </button>
          )}

          {file && (
            <div className="rounded bg-sunk hairline px-4 py-3 flex items-center gap-3">
              <span className="w-10 h-10 border hairline bg-raised grid place-items-center mono text-[10px] ink-3 shrink-0">
                {(ext.replace('.', '') || 'file').slice(0, 3)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="ink text-[13.5px] truncate">{file.name}</div>
                <div className="ink-3 text-[11.5px] mono">{formatBytes(file.size)}</div>
              </div>
              <button
                onClick={() => { setFile(null); setConvert(false); }}
                disabled={uploading}
                className="btn btn-ghost text-[11px] px-2 py-1"
              >
                Change
              </button>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_EXTENSIONS.join(',')}
            onChange={handlePick}
            className="hidden"
          />

          {/* Convert checkbox + copy — only for files MarkItDown can convert */}
          {needsConversion && (
            <div className="rounded bg-raised hairline p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={convert}
                  onChange={(e) => setConvert(e.target.checked)}
                  disabled={uploading}
                  className="mt-1 w-4 h-4 shrink-0 accent-[color:var(--accent)]"
                />
                <span className="ink text-[14px] font-medium">
                  Convert to Markdown (.md) for AI
                </span>
              </label>
              <p className="ink-2 text-[12.5px] leading-relaxed mt-2 ml-7 max-w-[52ch]">
                Agents read Markdown best — clean structure, no binary noise, fewer tokens. We
                convert this {ext.replace('.', '').toUpperCase() || 'document'} server-side via
                Microsoft MarkItDown so headings, lists, and tables stay intact. Required to
                ingest non-text formats; .txt and .md pass through unchanged.
              </p>
            </div>
          )}

          {file && isTextLike && (
            <p className="ink-3 text-[12px]">
              This file is already text — it will be ingested as-is, no conversion needed.
            </p>
          )}

          {/* Progress */}
          {uploading && (
            <div className="rounded bg-sunk hairline p-3">
              <div className="flex items-center justify-between text-[12px] ink-2 mb-2">
                <span>Uploading…</span>
                <span className="mono">{uploadProgress}%</span>
              </div>
              <div className="w-full h-1.5 rounded overflow-hidden" style={{ background: 'var(--line)' }}>
                <div
                  className="h-full transition-all"
                  style={{ width: `${uploadProgress}%`, background: 'var(--green)' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t hairline">
          <button
            onClick={onClose}
            disabled={uploading}
            className="btn flex-1"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="btn btn-primary flex-1"
            title={
              file && needsConversion && !convert
                ? 'Enable "Convert to Markdown (.md) for AI" to upload this file'
                : undefined
            }
          >
            {uploading ? 'Uploading…' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default UploadDocumentModal;
