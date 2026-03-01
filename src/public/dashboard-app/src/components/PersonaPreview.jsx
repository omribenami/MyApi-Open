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
          <div key={i} className="mt-8 mb-4 first:mt-0">
            <h2 className="text-2xl font-bold text-blue-400 pb-2 border-b border-slate-700">
              {title}
            </h2>
          </div>
        );
      } else if (line.startsWith('# ')) {
        const title = line.substring(2).trim();
        elements.push(
          <h1 key={i} className="text-3xl font-bold text-white mb-2">
            {title}
          </h1>
        );
      } else if (line.startsWith('### ')) {
        const title = line.substring(4).trim();
        elements.push(
          <h3 key={i} className="text-lg font-semibold text-slate-300 mt-4 mb-2">
            {title}
          </h3>
        );
      }
      // Bold text with definition (e.g., **Tone:** value)
      else if (line.includes('**') && line.includes(':')) {
        const formatted = line.replace(/\*\*(.*?)\*\:/g, '<strong className="text-slate-100">$1:</strong>');
        const parts = line.split(/\*\*(.*?)\*\:/).filter(Boolean);

        if (parts.length >= 2) {
          const label = parts[0];
          const value = line.substring(line.indexOf(':') + 1).trim();

          elements.push(
            <div key={i} className="mb-2 ml-4">
              <p className="text-slate-200">
                <span className="font-semibold text-blue-300">{label}:</span>{' '}
                <span className="text-slate-300">{value}</span>
              </p>
            </div>
          );
        } else {
          elements.push(
            <p key={i} className="text-slate-300 mb-2 leading-relaxed">
              {line}
            </p>
          );
        }
      }
      // Bullet points
      else if (line.startsWith('- ')) {
        const bulletText = line.substring(2).trim();
        elements.push(
          <div key={i} className="flex gap-3 mb-2 ml-4">
            <span className="text-blue-400 flex-shrink-0">•</span>
            <p className="text-slate-300">{bulletText}</p>
          </div>
        );
      }
      // Empty lines (spacing)
      else if (line.trim() === '') {
        elements.push(<div key={i} className="h-2" />);
      }
      // Regular text
      else if (line.trim()) {
        elements.push(
          <p key={i} className="text-slate-300 mb-2 leading-relaxed">
            {line}
          </p>
        );
      }

      i++;
    }

    return elements;
  };

  return (
    <div className="w-full">
      {/* Header with actions */}
      <div className="mb-6 pb-4 border-b border-slate-700 flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">{persona.name}</h1>
          <p className="text-slate-400">{persona.description}</p>
        </div>
        {showEditButton && onEdit && (
          <button
            onClick={onEdit}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            ✏️ Edit Persona
          </button>
        )}
      </div>

      {/* Status badge */}
      <div className="mb-6">
        <span
          className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
            persona.active
              ? 'bg-green-900 text-green-200'
              : 'bg-slate-700 text-slate-300'
          }`}
        >
          {persona.active ? '✓ Active' : 'Inactive'}
        </span>
      </div>

      {/* Main content area */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 space-y-6">
        {/* Soul content */}
        {persona.soul_content && (
          <div className="prose prose-invert max-w-none">
            <div className="text-slate-300 space-y-4">
              {renderContent(persona.soul_content)}
            </div>
          </div>
        )}

        {/* Template data if available */}
        {persona.template_data && (
          <div className="mt-8 pt-8 border-t border-slate-700">
            <h2 className="text-2xl font-bold text-blue-400 pb-2 border-b border-slate-700 mb-4">
              Template Data
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {persona.template_data.name && (
                <div className="bg-slate-800 p-4 rounded-lg">
                  <p className="text-slate-400 text-xs uppercase">Name</p>
                  <p className="text-slate-100 font-semibold">{persona.template_data.name}</p>
                </div>
              )}
              {persona.template_data.title && (
                <div className="bg-slate-800 p-4 rounded-lg">
                  <p className="text-slate-400 text-xs uppercase">Title</p>
                  <p className="text-slate-100 font-semibold">{persona.template_data.title}</p>
                </div>
              )}
              {persona.template_data.tone && (
                <div className="bg-slate-800 p-4 rounded-lg">
                  <p className="text-slate-400 text-xs uppercase">Tone</p>
                  <p className="text-slate-100">{persona.template_data.tone}</p>
                </div>
              )}
              {persona.template_data.traits && (
                <div className="bg-slate-800 p-4 rounded-lg">
                  <p className="text-slate-400 text-xs uppercase">Traits</p>
                  <p className="text-slate-100">{persona.template_data.traits}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="mt-8 pt-8 border-t border-slate-700">
          <h3 className="text-sm font-semibold text-slate-400 uppercase mb-3">Metadata</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500 uppercase">Created</p>
              <p className="text-slate-300 text-sm">
                {new Date(persona.created_at).toLocaleDateString()}
              </p>
            </div>
            {persona.updated_at && (
              <div>
                <p className="text-xs text-slate-500 uppercase">Updated</p>
                <p className="text-slate-300 text-sm">
                  {new Date(persona.updated_at).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full content toggle for modal */}
      {!showFullContent && (
        <button
          onClick={() => setShowFullContent(true)}
          className="mt-4 text-blue-400 hover:text-blue-300 text-sm"
        >
          Show full content →
        </button>
      )}
    </div>
  );
}

export default PersonaPreview;
