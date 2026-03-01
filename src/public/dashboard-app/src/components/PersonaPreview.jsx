import { useState } from 'react';

function PersonaPreview({ persona, showEditButton = false, onEdit = null }) {
  const [showFullContent, setShowFullContent] = useState(false);

  if (!persona) return null;

  // Parse markdown-style content
  const renderContent = (content) => {
    if (!content) return null;

    const lines = content.split('\n');
    const elements = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Headings
      if (line.startsWith('## ')) {
        const title = line.substring(3).trim();
        elements.push(
          <div key={i} className="mt-6 mb-3 first:mt-0">
            <h2 className="text-xl font-semibold text-slate-200 pb-1 border-b border-slate-700/50">
              {title}
            </h2>
          </div>
        );
      } else if (line.startsWith('# ')) {
        const title = line.substring(2).trim();
        elements.push(
          <h1 key={i} className="text-2xl font-semibold text-white mb-2">
            {title}
          </h1>
        );
      } else if (line.startsWith('### ')) {
        const title = line.substring(4).trim();
        elements.push(
          <h3 key={i} className="text-md font-medium text-slate-300 mt-4 mb-2">
            {title}
          </h3>
        );
      }
      // Bold text with definition (e.g., **Tone:** value)
      else if (line.includes('**') && line.includes(':')) {
        const parts = line.split(/\*\*(.*?)\*\:/).filter(Boolean);

        if (parts.length >= 2) {
          const label = parts[0];
          const value = line.substring(line.indexOf(':') + 1).trim();

          elements.push(
            <div key={i} className="mb-2 ml-4">
              <p className="text-slate-300 text-sm">
                <span className="font-medium text-slate-200">{label}:</span>{' '}
                <span>{value}</span>
              </p>
            </div>
          );
        } else {
          elements.push(
            <p key={i} className="text-slate-300 text-sm mb-2 leading-relaxed">
              {line}
            </p>
          );
        }
      }
      // Bullet points
      else if (line.startsWith('- ')) {
        const bulletText = line.substring(2).trim();
        elements.push(
          <div key={i} className="flex gap-2 mb-1.5 ml-4">
            <span className="text-slate-500 flex-shrink-0">•</span>
            <p className="text-slate-300 text-sm">{bulletText}</p>
          </div>
        );
      }
      // Empty lines (spacing)
      else if (line.trim() === '') {
        elements.push(<div key={i} className="h-1.5" />);
      }
      // Regular text
      else if (line.trim()) {
        elements.push(
          <p key={i} className="text-slate-300 text-sm mb-2 leading-relaxed">
            {line}
          </p>
        );
      }

      i++;
    }

    return elements;
  };

  const soulContent = persona.soul_content || '';
  const shouldCollapse = soulContent.length > 420 || soulContent.split('\n').length > 14;

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

      {/* Status badge */}
      <div className="mb-6">
        <span
          className={`inline-block px-3 py-1 rounded-md text-xs font-medium ${
            persona.active
              ? 'bg-slate-800 text-slate-200 border border-slate-600'
              : 'bg-slate-800/50 text-slate-400 border border-slate-700'
          }`}
        >
          {persona.active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Main content area */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-md p-6">
        {/* Soul content */}
        {soulContent ? (
          <div className="prose prose-invert max-w-none">
            <div className={`text-slate-300 overflow-hidden relative ${shouldCollapse && !showFullContent ? 'max-h-48' : ''}`}>
              {renderContent(soulContent)}
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
        {persona.template_data && (showFullContent || !shouldCollapse) && (
          <div className="mt-8 pt-6 border-t border-slate-700/50">
            <h2 className="text-lg font-medium text-slate-200 mb-4">
              Template Data
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {persona.template_data.name && (
                <div className="bg-slate-800/80 p-3 rounded-md border border-slate-700/50">
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Name</p>
                  <p className="text-slate-300 text-sm">{persona.template_data.name}</p>
                </div>
              )}
              {persona.template_data.title && (
                <div className="bg-slate-800/80 p-3 rounded-md border border-slate-700/50">
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Title</p>
                  <p className="text-slate-300 text-sm">{persona.template_data.title}</p>
                </div>
              )}
              {persona.template_data.tone && (
                <div className="bg-slate-800/80 p-3 rounded-md border border-slate-700/50">
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Tone</p>
                  <p className="text-slate-300 text-sm">{persona.template_data.tone}</p>
                </div>
              )}
              {persona.template_data.traits && (
                <div className="bg-slate-800/80 p-3 rounded-md border border-slate-700/50">
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Traits</p>
                  <p className="text-slate-300 text-sm">{persona.template_data.traits}</p>
                </div>
              )}
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
