import { useState } from 'react';

function PersonaPreview({ persona, showEditButton = false, onEdit = null }) {
  const [showFullContent, setShowFullContent] = useState(false);

  if (!persona) return null;


  const soulContent = persona.soul_content || '';
  const shouldCollapse = soulContent.length > 420 || soulContent.split('\n').length > 14;
  const templateData = persona.template_data && typeof persona.template_data === 'object' ? persona.template_data : null;

    const renderValue = (value) => {
    if (value === null || value === undefined || value === '') return '—';
    if (Array.isArray(value)) {
      if (value.length === 0) return '—';
      return value.join(', ');
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const metadataStats = {
    lines: soulContent ? soulContent.split('\n').length : 0,
    chars: soulContent ? soulContent.length : 0,
    sections: soulContent ? soulContent.split('\n').filter((l) => l.startsWith('#')).length : 0,
  };
  return (
    <div className="w-full">
      {/* Header with actions */}
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-semibold text-white mb-2">{persona.name}</h1>
          <p className="text-slate-400 text-sm">{persona.description}</p>
        </div>
        {showEditButton && onEdit && (
          <button
            onClick={onEdit}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-md transition-colors border border-slate-600"
          >
            Edit Persona
          </button>
        )}
      </div>

      {/* Status + quick stats */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span
          className={`inline-block px-3 py-1 rounded-md text-xs font-medium ${
            persona.active
              ? 'bg-slate-800 text-slate-200 border border-slate-600'
              : 'bg-slate-800/50 text-slate-400 border border-slate-700'
          }`}
        >
          {persona.active ? 'Active' : 'Inactive'}
        </span>
        <span className="inline-block px-3 py-1 rounded-md text-xs border border-slate-700 text-slate-400">
          {metadataStats.sections} sections
        </span>
        <span className="inline-block px-3 py-1 rounded-md text-xs border border-slate-700 text-slate-400">
          {metadataStats.lines} lines
        </span>
        <span className="inline-block px-3 py-1 rounded-md text-xs border border-slate-700 text-slate-400">
          {metadataStats.chars} chars
        </span>
      </div>

      {/* Main content area */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-md p-6">
        {/* Soul content */}
        {soulContent ? (
          <div className="prose prose-invert max-w-none">
            <div className={`text-slate-300 overflow-hidden relative ${shouldCollapse && !showFullContent ? 'max-h-48' : ''}`}>
              <div className="rounded-md border border-slate-700/60 bg-slate-900/40 p-4">
                <pre className="whitespace-pre-wrap break-words font-mono text-sm text-slate-300 leading-relaxed">
                  {soulContent}
                </pre>
              </div>
              {shouldCollapse && !showFullContent && (
                <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-slate-800/90 to-transparent pointer-events-none"></div>
              )}
            </div>

            {/* Full content toggle */}
            {shouldCollapse && (
              <button
                onClick={() => setShowFullContent(!showFullContent)}
                className="mt-4 text-slate-400 hover:text-slate-300 text-sm font-medium transition-colors"
              >
                {showFullContent ? 'Show less ↑' : 'Show full details ↓'}
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-md border border-slate-700/60 bg-slate-900/60 p-4">
            <p className="text-sm text-slate-400">No SOUL.md content yet for this persona.</p>
          </div>
        )}

        {/* Template data if available */}
        {templateData && (showFullContent || !shouldCollapse) && (
          <div className="mt-8 pt-6 border-t border-slate-700/50">
            <h2 className="text-lg font-medium text-slate-200 mb-4">
              Persona Configuration
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(templateData).map(([key, value]) => (
                <div key={key} className="bg-slate-800/80 p-3 rounded-md border border-slate-700/50">
                  <p className="text-slate-500 text-xs font-mono mb-1">{key}</p>
                  {typeof value === 'object' && value !== null ? (
                    <pre className="text-slate-300 text-xs whitespace-pre-wrap font-mono leading-relaxed">
                      {renderValue(value)}
                    </pre>
                  ) : (
                    <p className="text-slate-300 text-sm whitespace-pre-wrap">{renderValue(value)}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="mt-6 pt-6 border-t border-slate-700/50">
          <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Metadata</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Created</p>
              <p className="text-slate-400 text-sm">
                {new Date(persona.created_at).toLocaleDateString()}
              </p>
            </div>
            {persona.updated_at && (
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Updated</p>
                <p className="text-slate-400 text-sm">
                  {new Date(persona.updated_at).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PersonaPreview;
