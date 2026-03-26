import { useState, useRef } from 'react';

function ImportConfirmationDialog({ isOpen, onConfirm, onCancel, isConfirming }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-yellow-700 rounded-lg max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-yellow-900 bg-opacity-50 flex items-center justify-center flex-shrink-0">
            <span className="text-yellow-400 text-lg">⚠️</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Confirm Import</h2>
            <p className="text-sm text-yellow-400">Please review before importing</p>
          </div>
        </div>

        {/* Info about what will be imported */}
        <div className="bg-yellow-900 bg-opacity-20 border border-yellow-800 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-yellow-300 mb-2">This import will restore:</p>
          <ul className="text-sm text-yellow-200 space-y-1 list-disc list-inside">
            <li>Personas and their configurations</li>
            <li>Skills and their scripts</li>
            <li>Profile information</li>
            <li>Settings and preferences</li>
          </ul>
        </div>

        {/* Security warning */}
        <div className="bg-red-900 bg-opacity-20 border border-red-800 rounded-lg p-3 mb-6">
          <p className="text-xs text-red-300">
            🔒 Import will <span className="font-semibold">NOT</span> restore tokens or API credentials for security reasons.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isConfirming}
            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isConfirming}
            className="flex-1 px-4 py-2 bg-yellow-700 hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {isConfirming ? 'Importing...' : 'Proceed with Import'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ImportExport() {
  // Import state
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [importLog, setImportLog] = useState([]);

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState('');

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.zip')) {
      setImportError('Please select a valid .zip file');
      return;
    }

    if (file.size > 100 * 1024 * 1024) { // 100MB limit
      setImportError('File size exceeds 100MB limit');
      return;
    }

    setSelectedFile(file);
    setImportError('');
    setImportSuccess('');
    setImportLog([]);
  };

  const handleImportClick = () => {
    if (!selectedFile) {
      setImportError('Please select a file to import');
      return;
    }
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
        
        // Handle specific error cases
        if (response.status === 400) {
          throw new Error(errorData.error || errorData.message || 'Invalid or corrupted ZIP file');
        } else if (response.status === 401) {
          throw new Error('Unauthorized. Please log in again.');
        } else if (response.status === 403) {
          // Cross-account import error - show detailed message
          if (errorData.message) {
            throw new Error(`${errorData.error}\n\n${errorData.message}\n\n${errorData.solution || ''}`);
          }
          throw new Error('You do not have permission to import data');
        } else if (response.status === 500) {
          throw new Error(errorData.error || 'Server error. Please try again later.');
        } else {
          throw new Error(errorData.error || errorData.message || `Import failed with status ${response.status}`);
        }
      }

      const result = await response.json();
      
      // Update progress
      setImportProgress(100);
      
      // Process import results and create log
      const log = [];
      if (result.imported) {
        const imported = result.imported;
        
        // Handle personas (can be array or number)
        const personasCount = Array.isArray(imported.personas) ? imported.personas.length : imported.personas;
        if (personasCount > 0) {
          log.push(`✅ Imported ${personasCount} persona(s)`);
        }
        
        // Handle skills (can be array or number)
        const skillsCount = Array.isArray(imported.skills) ? imported.skills.length : imported.skills;
        if (skillsCount > 0) {
          log.push(`✅ Imported ${skillsCount} skill(s)`);
        }
        
        // Handle profile
        if (imported.profile) {
          log.push('✅ Imported profile data');
        }
        
        // Handle settings
        if (imported.settings) {
          log.push('✅ Imported settings');
        }
      }
      
      // Add skipped info if any
      if (result.skipped) {
        const skipped = result.skipped;
        if (skipped.personas > 0 || skipped.skills > 0) {
          log.push(`⚠️ Skipped ${skipped.personas} persona(s) and ${skipped.skills} skill(s) (name conflicts)`);
        }
      }

      setImportLog(log);
      const message = result.message || `Data imported successfully! ${log.length} sections updated.`;
      setImportSuccess(message);
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
      if (!blob || blob.size === 0) {
        throw new Error('Export returned an empty file');
      }

      // Create download link and trigger download
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

      // Show file info
      const fileSizeKB = (blob.size / 1024).toFixed(2);
      const createdDate = new Date().toLocaleString();
      setExportSuccess(`Export downloaded (${fileSizeKB} KB) - Created: ${createdDate}`);
    } catch (error) {
      setImportError(error.message || 'Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files?.length > 0) {
      handleFileSelect({ target: { files } });
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Data & Privacy</h1>
        <p className="text-slate-400 mt-1">Import and export your personal data</p>
      </div>

      {/* Import Section */}
      <div className="rounded-lg p-6 bg-slate-800 border border-slate-700">
        <h2 className="text-xl font-semibold text-white mb-4">Import Data</h2>
        
        {/* Info banner */}
        <div className="bg-blue-900 bg-opacity-20 border border-blue-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-300">
            📦 Upload a ZIP file previously exported from MyApi to restore your data. Tokens and credentials are not included for security.
          </p>
        </div>

        {/* Error message */}
        {importError && (
          <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-4 mb-4 flex items-start gap-3">
            <span className="text-red-400 flex-shrink-0">❌</span>
            <div className="flex-1">
              <p className="text-red-200 text-sm font-medium">Import failed</p>
              <p className="text-red-300 text-sm mt-1">{importError}</p>
            </div>
            <button
              onClick={() => setImportError('')}
              className="text-red-400 hover:text-red-300 flex-shrink-0 text-lg leading-none"
            >
              ✕
            </button>
          </div>
        )}

        {/* Success message */}
        {importSuccess && (
          <div className="bg-green-900 bg-opacity-30 border border-green-700 rounded-lg p-4 mb-4 flex items-start gap-3">
            <span className="text-green-400 flex-shrink-0">✅</span>
            <div className="flex-1">
              <p className="text-green-200 text-sm font-medium">Import successful</p>
              <p className="text-green-300 text-sm mt-1">{importSuccess}</p>
            </div>
            <button
              onClick={() => setImportSuccess('')}
              className="text-green-400 hover:text-green-300 flex-shrink-0 text-lg leading-none"
            >
              ✕
            </button>
          </div>
        )}

        {/* File upload area */}
        <div className="mb-6">
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            onChange={handleFileSelect}
            className="hidden"
            id="import-file-input"
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-slate-600 rounded-lg bg-slate-900 bg-opacity-50 hover:border-blue-500 hover:bg-slate-900 transition-colors cursor-pointer active:border-blue-400"
          >
            <span className="text-4xl">📁</span>
            <div className="text-center">
              <p className="text-white font-medium">
                {selectedFile ? selectedFile.name : 'Drag and drop your ZIP file or click to browse'}
              </p>
              <p className="text-slate-400 text-sm mt-1">Maximum file size: 100 MB</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-3 w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white font-medium rounded-lg transition-colors"
          >
            Select File
          </button>
        </div>

        {/* Progress bar */}
        {isImporting && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-300">Importing...</p>
              <p className="text-sm text-slate-400">{importProgress}%</p>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${importProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Import log */}
        {importLog.length > 0 && (
          <div className="bg-slate-900 rounded-lg p-4 mb-6">
            <p className="text-sm font-medium text-slate-300 mb-3">Import Summary:</p>
            <div className="space-y-2">
              {importLog.map((entry, idx) => (
                <p key={idx} className="text-sm text-slate-400">{entry}</p>
              ))}
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleImportClick}
            disabled={!selectedFile || isImporting}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {isImporting ? 'Importing...' : 'Import Data'}
          </button>
          <button
            onClick={() => {
              setSelectedFile(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
              setImportError('');
              setImportSuccess('');
            }}
            disabled={isImporting}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Export Section */}
      <div className="rounded-lg p-6 bg-slate-800 border border-slate-700">
        <h2 className="text-xl font-semibold text-white mb-4">Export Data</h2>
        
        {/* Info banner */}
        <div className="bg-blue-900 bg-opacity-20 border border-blue-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-300">
            ⬇️ Download a copy of your personal data, including personas, skills, documents, and settings. This creates a v3 ZIP file you can import later.
          </p>
        </div>

        {/* Success message */}
        {exportSuccess && (
          <div className="bg-green-900 bg-opacity-30 border border-green-700 rounded-lg p-4 mb-4 flex items-start gap-3">
            <span className="text-green-400 flex-shrink-0">✅</span>
            <div className="flex-1">
              <p className="text-green-200 text-sm font-medium">Export successful</p>
              <p className="text-green-300 text-sm mt-1">{exportSuccess}</p>
            </div>
            <button
              onClick={() => setExportSuccess('')}
              className="text-green-400 hover:text-green-300 flex-shrink-0 text-lg leading-none"
            >
              ✕
            </button>
          </div>
        )}

        {/* Export info */}
        <div className="bg-slate-900 rounded-lg p-4 mb-6 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Format</span>
            <span className="text-white font-medium">ZIP (v3)</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Includes</span>
            <span className="text-white font-medium">Personas, Skills, Documents, Settings, Identity</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Excludes</span>
            <span className="text-white font-medium">Tokens & API credentials (for security)</span>
          </div>
        </div>

        {/* Export button */}
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
        >
          {isExporting ? 'Generating Export...' : 'Export My Data'}
        </button>
      </div>

      {/* Confirmation dialog */}
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
