import { useState } from 'react';

const EXPORT_OPTIONS = [
  { key: 'profile', label: 'Profile & Identity', description: 'USER.md and identity fields', icon: '👤' },
  { key: 'tokens', label: 'Token Metadata', description: 'Token labels and scopes (not secrets)', icon: '🔐' },
  { key: 'personas', label: 'Personas & SOUL.md', description: 'All AI persona configurations', icon: '🤖' },
  { key: 'knowledge', label: 'Knowledge Base', description: 'All documents and files', icon: '🧠' },
  { key: 'settings', label: 'Settings & Preferences', description: 'Privacy and account settings', icon: '⚙️' },
];

function ExportDataModal({ isOpen, onClose }) {
  const [selected, setSelected] = useState({ profile: true, tokens: true, personas: true, knowledge: true, settings: true });
  const [isExporting, setIsExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);

  const toggleOption = (key) => {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Build query params for selected sections
      const selectedSections = Object.keys(selected)
        .filter((k) => selected[k])
        .map((k) => `${k}=true`)
        .join('&');

      const response = await fetch(`/api/v1/export?${selectedSections}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate export');
      }

      // Get the JSON data
      const exportData = await response.json();

      // Create a blob from the JSON data
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      
      // Create download link and trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `myapi-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setIsExporting(false);
      setExportDone(true);
    } catch (error) {
      console.error('Export error:', error);
      alert(`Export failed: ${error.message}`);
      setIsExporting(false);
    }
  };

  const handleClose = () => {
    setExportDone(false);
    setSelected({ profile: true, tokens: true, personas: true, knowledge: true, settings: true });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-lg w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Export Your Data</h2>
            <p className="text-sm text-slate-400 mt-1">Download a copy of your account data</p>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-200 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {exportDone ? (
          <div className="py-8 text-center">
            <div className="text-5xl mb-4">✅</div>
            <h3 className="text-lg font-semibold text-white mb-2">Export Complete</h3>
            <p className="text-slate-400 text-sm mb-6">Your data has been downloaded successfully.</p>
            <button
              onClick={handleClose}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Options */}
            <div className="space-y-2 mb-6">
              <p className="text-sm font-medium text-slate-300 mb-3">Select data to include:</p>
              {EXPORT_OPTIONS.map((opt) => (
                <label
                  key={opt.key}
                  className="flex items-center gap-3 p-3 bg-slate-900 border border-slate-700 rounded-lg cursor-pointer hover:border-slate-600 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selected[opt.key]}
                    onChange={() => toggleOption(opt.key)}
                    className="w-4 h-4 rounded accent-blue-500"
                  />
                  <span className="text-lg">{opt.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{opt.label}</p>
                    <p className="text-xs text-slate-400">{opt.description}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* Info note */}
            <div className="bg-blue-900 bg-opacity-20 border border-blue-800 rounded-lg p-3 mb-6">
              <p className="text-xs text-blue-300">
                Your export will be a JSON file. Token secrets are never included in exports for security.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                disabled={isExporting}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={isExporting || !Object.values(selected).some(Boolean)}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                {isExporting ? 'Generating...' : 'Download Export'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ExportDataModal;
