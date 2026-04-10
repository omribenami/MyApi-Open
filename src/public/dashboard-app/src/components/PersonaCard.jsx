function getAvatarGradient(name = '') {
  const gradients = [
    ['#3b82f6', '#6366f1'],
    ['#8b5cf6', '#a855f7'],
    ['#06b6d4', '#0891b2'],
    ['#f59e0b', '#f97316'],
    ['#10b981', '#059669'],
    ['#ec4899', '#db2777'],
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const [a, b] = gradients[Math.abs(hash) % gradients.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function PersonaCard({ persona, onClick }) {
  const templateData = persona.template_data && typeof persona.template_data === 'object'
    ? persona.template_data
    : null;

  const docCount = Array.isArray(templateData?.attachedDocuments)
    ? templateData.attachedDocuments.length
    : 0;
  const skillCount = Array.isArray(templateData?.attachedSkills)
    ? templateData.attachedSkills.length
    : 0;

  const soulPreview = (persona.soul_content || '').substring(0, 160).trim();

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left group relative bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-600 hover:bg-slate-800/60 cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
    >
      {/* Active glow */}
      {persona.active && (
        <div className="absolute inset-0 rounded-xl ring-1 ring-blue-500/30 pointer-events-none" />
      )}

      {/* Header row */}
      <div className="flex items-center gap-3 mb-3">
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-inner"
          style={{ background: getAvatarGradient(persona.name) }}
        >
          {getInitials(persona.name)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-slate-100 truncate">{persona.name}</h3>
            {persona.active && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/15 text-blue-400 border border-blue-500/25 flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
                Active
              </span>
            )}
          </div>
          {templateData?.title && (
            <p className="text-xs text-slate-500 truncate mt-0.5">{templateData.title}</p>
          )}
        </div>
      </div>

      {/* Description */}
      {persona.description && (
        <p className="text-xs text-slate-400 mb-3 line-clamp-2 leading-relaxed">
          {persona.description}
        </p>
      )}

      {/* Soul preview */}
      {soulPreview && (
        <div className="bg-slate-950/60 rounded-lg border border-slate-800 px-3 py-2 mb-3">
          <p className="text-[11px] text-slate-500 font-mono leading-relaxed line-clamp-3">
            {soulPreview}{soulPreview.length < (persona.soul_content || '').length ? '…' : ''}
          </p>
        </div>
      )}

      {/* Footer: resource counts + date */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {docCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-slate-400 bg-slate-800 border border-slate-700">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              {docCount} doc{docCount !== 1 ? 's' : ''}
            </span>
          )}
          {skillCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-slate-400 bg-slate-800 border border-slate-700">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
              {skillCount} skill{skillCount !== 1 ? 's' : ''}
            </span>
          )}
          {docCount === 0 && skillCount === 0 && (
            <span className="text-[10px] text-slate-600">No resources attached</span>
          )}
        </div>
        <span className="text-[10px] text-slate-600">
          {new Date(persona.updated_at || persona.created_at).toLocaleDateString()}
        </span>
      </div>
    </button>
  );
}

export default PersonaCard;
