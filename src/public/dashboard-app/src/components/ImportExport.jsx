import { useState, useRef } from 'react';

function ImportConfirmationDialog({ isOpen, onConfirm, onCancel, isConfirming }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="ui-card rounded-lg max-w-md w-full p-6" style={{ border: '1px solid var(--amber)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--amber-bg)' }}>
            <svg className="w-4 h-4" style={{ color: 'var(--amber)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold ink">Confirm Import</h2>
            <p className="text-xs ink-3 mt-0.5">Please review before importing</p>
          </div>
        </div>

        <div className="rounded p-4 mb-4 text-sm" style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber)' }}>
          <p className="font-medium mb-2" style={{ color: 'var(--amber)' }}>This import will restore:</p>
          <ul className="space-y-1 ink-2 list-disc list-inside">
            <li>Personas and their configurations</li>
            <li>Skills and their scripts</li>
            <li>Profile information</li>
            <li>Settings and preferences</li>
          </ul>
        </div>

        <div className="rounded p-3 mb-5 text-xs" style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red)' }}>
          Import will <strong>NOT</strong> restore tokens or API credentials for security reasons.
        </div>

        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isConfirming} className="ui-button flex-1">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isConfirming}
            className="flex-1 px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: 'var(--amber)', color: '#000' }}
          >
            {isConfirming ? 'Importing…' : 'Proceed with Import'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ImportExport() {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [importLog, setImportLog] = useState([]);

  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState('');
  const [exportError, setExportError] = useState('');

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.zip')) {
      setImportError('Please select a valid .zip file');
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setImportError('File size exceeds 100MB limit');
      return;
    }
    setSelectedFile(file);
    setImportError('');
    setImportSuccess('');
    setImportLog([]);
  };

  const handleImportClick = () => {
    if (!selectedFile) { setImportError('Please select a file to import'); return; }
    setShowConfirmation(true);
  };

  const handleConfirmImport = async () => {
    if (!selectedFile) return;
    setIsConfirming(true);
    setIsImporting(true);
    setImportProgress(0);
    setImportLog([]);
    setImportError('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/v1/import', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 403 && errorData.message) {
          throw new Error(`${errorData.error}\n\n${errorData.message}\n\n${errorData.solution || ''}`);
        }
        throw new Error(errorData.error || errorData.message || `Import failed with status ${response.status}`);
      }

      const result = await response.json();
      setImportProgress(100);

      const log = [];
      if (result.imported) {
        const { imported } = result;
        const personasCount = Array.isArray(imported.personas) ? imported.personas.length : imported.personas;
        if (personasCount > 0) log.push(`Imported ${personasCount} persona(s)`);
        const skillsCount = Array.isArray(imported.skills) ? imported.skills.length : imported.skills;
        if (skillsCount > 0) log.push(`Imported ${skillsCount} skill(s)`);
        if (imported.profile) log.push('Imported profile data');
        if (imported.settings) log.push('Imported settings');
      }
      if (result.skipped) {
        const { skipped } = result;
        if (skipped.personas > 0 || skipped.skills > 0) {
          log.push(`Skipped ${skipped.personas} persona(s) and ${skipped.skills} skill(s) due to name conflicts`);
        }
      }

      setImportLog(log);
      setImportSuccess(result.message || `Data imported successfully! ${log.length} sections updated.`);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setShowConfirmation(false);
    } catch (error) {
      setImportError(error.message || 'Failed to import data');
      setImportLog([]);
    } finally {
      setIsImporting(false);
      setIsConfirming(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportSuccess('');
    setExportError('');

    try {
      const response = await fetch('/api/v1/export?format=zip&includeFiles=true', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to generate export');
      }

      const blob = await response.blob();
      if (!blob || blob.size === 0) throw new Error('Export returned an empty file');

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const contentDisposition = response.headers.get('content-disposition') || '';
      const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
      a.download = fileNameMatch?.[1] || `myapi-export-v3-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const fileSizeKB = (blob.size / 1024).toFixed(2);
      setExportSuccess(`Export downloaded (${fileSizeKB} KB) — ${new Date().toLocaleString()}`);
    } catch (error) {
      setExportError(error.message || 'Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files?.length > 0) handleFileSelect({ target: { files } });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="micro mb-2">SETTINGS · DATA & PRIVACY</div>
        <h1 className="font-serif text-[20px] sm:text-[28px] font-medium tracking-tight ink">Data &amp; Privacy.</h1>
        <p className="mt-1 text-sm ink-3">Import and export your personal data</p>
      </div>

      {/* Import */}
      <div className="ui-card rounded-lg p-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold ink">Import Data</h2>
          <p className="text-xs ink-3 mt-0.5">Restore from a MyApi v3 ZIP export</p>
        </div>

        <div className="rounded p-3 text-sm" style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent)' }}>
          Tokens and credentials are excluded from imports for security.
        </div>

        {importError && (
          <div className="flex items-start gap-3 rounded p-3 text-sm" style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red)' }}>
            <span className="flex-1">{importError}</span>
            <button onClick={() => setImportError('')} className="flex-shrink-0 leading-none" style={{ color: 'var(--red)' }}>✕</button>
          </div>
        )}

        {importSuccess && (
          <div className="flex items-start gap-3 rounded p-3 text-sm" style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green)' }}>
            <span className="flex-1">{importSuccess}</span>
            <button onClick={() => setImportSuccess('')} className="flex-shrink-0 leading-none" style={{ color: 'var(--green)' }}>✕</button>
          </div>
        )}

        {/* Drop zone */}
        <div>
          <input ref={fileInputRef} type="file" accept=".zip" onChange={handleFileSelect} className="hidden" id="import-file-input" />
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="flex flex-col items-center justify-center gap-2 p-6 rounded cursor-pointer transition-colors"
            style={{ border: '2px dashed var(--line)', background: 'var(--bg-sunk)' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--line)'}
          >
            <svg className="w-8 h-8 ink-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/>
            </svg>
            <div className="text-center">
              <p className="text-sm font-medium ink">
                {selectedFile ? selectedFile.name : 'Drag & drop ZIP or click to browse'}
              </p>
              <p className="text-xs ink-4 mt-0.5">Maximum 100 MB</p>
            </div>
          </div>
        </div>

        {isImporting && (
          <div>
            <div className="flex justify-between mb-1.5">
              <span className="text-xs ink-3">Importing…</span>
              <span className="text-xs ink-3">{importProgress}%</span>
            </div>
            <div className="w-full rounded-full h-1.5 bg-sunk">
              <div className="h-1.5 rounded-full transition-all duration-300" style={{ width: `${importProgress}%`, background: 'var(--accent)' }} />
            </div>
          </div>
        )}

        {importLog.length > 0 && (
          <div className="rounded p-3 bg-sunk">
            <p className="text-xs font-medium ink-2 mb-2">Import summary</p>
            <div className="space-y-1">
              {importLog.map((entry, idx) => (
                <p key={idx} className="text-xs ink-3 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: 'var(--green)' }} />
                  {entry}
                </p>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleImportClick}
            disabled={!selectedFile || isImporting}
            className="ui-button ui-button-primary flex-1"
          >
            {isImporting ? 'Importing…' : 'Import Data'}
          </button>
          <button
            onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; setImportError(''); setImportSuccess(''); }}
            disabled={isImporting}
            className="ui-button"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Export */}
      <div className="ui-card rounded-lg p-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold ink">Export Data</h2>
          <p className="text-xs ink-3 mt-0.5">Download a copy of your personal data</p>
        </div>

        <div className="rounded p-3 text-sm" style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent)' }}>
          Creates a v3 ZIP you can import later. Tokens and credentials are excluded.
        </div>

        {exportError && (
          <div className="flex items-start gap-3 rounded p-3 text-sm" style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red)' }}>
            <span className="flex-1">{exportError}</span>
            <button onClick={() => setExportError('')} className="flex-shrink-0 leading-none" style={{ color: 'var(--red)' }}>✕</button>
          </div>
        )}

        {exportSuccess && (
          <div className="flex items-start gap-3 rounded p-3 text-sm" style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green)' }}>
            <span className="flex-1">{exportSuccess}</span>
            <button onClick={() => setExportSuccess('')} className="flex-shrink-0 leading-none" style={{ color: 'var(--green)' }}>✕</button>
          </div>
        )}

        <div className="rounded bg-sunk hairline divide-y" style={{ borderColor: 'var(--line)' }}>
          {[
            ['Format', 'ZIP (v3)'],
            ['Includes', 'Personas, Skills, Documents, Settings, Identity'],
            ['Excludes', 'Tokens & API credentials'],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between px-3 py-2.5 text-sm gap-4">
              <span className="ink-3 flex-shrink-0">{label}</span>
              <span className="ink text-right text-xs">{value}</span>
            </div>
          ))}
        </div>

        <button
          onClick={handleExport}
          disabled={isExporting}
          className="ui-button ui-button-primary w-full"
        >
          {isExporting ? 'Generating Export…' : 'Export My Data'}
        </button>
      </div>

      <ImportConfirmationDialog
        isOpen={showConfirmation}
        onConfirm={handleConfirmImport}
        onCancel={() => setShowConfirmation(false)}
        isConfirming={isConfirming}
      />
    </div>
  );
}

export default ImportExport;
