import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

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

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'skills', label: 'Skills' },
  { id: 'prompt', label: 'System Prompt' },
];

function PersonaDetailModal({ persona, onClose, onEdit, onSetActive, onDelete }) {
  const [tab, setTab] = useState('overview');
  const [attachedDocuments, setAttachedDocuments] = useState([]);
  const [attachedSkills, setAttachedSkills] = useState([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showFullPrompt, setShowFullPrompt] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);

  useEffect(() => {
    if (persona?.id) {
      fetchResources();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona?.id]);

  const fetchResources = async () => {
    setLoadingResources(true);
    const token = useAuthStore.getState().masterToken;
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [docRes, skillRes] = await Promise.all([
        fetch(`/api/v1/personas/${persona.id}/documents`, { headers }),
        fetch(`/api/v1/personas/${persona.id}/skills`, { headers }),
      ]);

      if (docRes.ok) {
        const data = await docRes.json();
        setAttachedDocuments(data.data || []);
      }
      if (skillRes.ok) {
        const data = await skillRes.json();
        setAttachedSkills(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch persona resources:', err);
    } finally {
      setLoadingResources(false);
    }
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(persona.soul_content || '');
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  if (!persona) return null;

  const templateData = persona.template_data && typeof persona.template_data === 'object'
    ? persona.template_data
    : null;

  const soulContent = persona.soul_content || '';
  const shouldCollapsePrompt = soulContent.length > 600;

  const knowledgeTabLabel = loadingResources
    ? 'Knowledge'
    : attachedDocuments.length > 0
      ? `Knowledge (${attachedDocuments.length})`
      : 'Knowledge';

  const skillsTabLabel = loadingResources
    ? 'Skills'
    : attachedSkills.length > 0
      ? `Skills (${attachedSkills.length})`
      : 'Skills';

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'knowledge', label: knowledgeTabLabel },
    { id: 'skills', label: skillsTabLabel },
    { id: 'prompt', label: 'System Prompt' },
  ];

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl">

        {/* ── Header ─────────────────────────────────────── */}
        <div className="flex-shrink-0 px-6 pt-6 pb-0">
          <div className="flex items-start justify-between gap-4 mb-5">
            {/* Avatar + identity */}
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-lg font-bold shadow-lg flex-shrink-0"
                style={{ background: getAvatarGradient(persona.name) }}
              >
                {getInitials(persona.name)}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-semibold text-white">{persona.name}</h2>
                  {persona.active ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/15 text-blue-400 border border-blue-500/25">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-500 border border-slate-700">
                      Inactive
                    </span>
                  )}
                </div>
                {templateData?.title && (
                  <p className="text-sm text-slate-400 mt-0.5">{templateData.title}</p>
                )}
                {persona.description && !templateData?.title && (
                  <p className="text-sm text-slate-400 mt-0.5 line-clamp-1">{persona.description}</p>
                )}
              </div>
            </div>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Resource summary bar */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <span className={attachedDocuments.length > 0 ? 'text-slate-300 font-medium' : ''}>
                {loadingResources ? '…' : attachedDocuments.length} doc{attachedDocuments.length !== 1 ? 's' : ''}
              </span>
            </div>
            <span className="text-slate-700">·</span>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
              <span className={attachedSkills.length > 0 ? 'text-slate-300 font-medium' : ''}>
                {loadingResources ? '…' : attachedSkills.length} skill{attachedSkills.length !== 1 ? 's' : ''}
              </span>
            </div>
            <span className="text-slate-700">·</span>
            <span className="text-xs text-slate-600">
              Updated {new Date(persona.updated_at || persona.created_at).toLocaleDateString()}
            </span>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 border-b border-slate-800 overflow-x-auto">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${
                  tab === t.id
                    ? 'text-blue-400 border-blue-500'
                    : 'text-slate-500 border-transparent hover:text-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab Content ─────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* OVERVIEW TAB */}
          {tab === 'overview' && (
            <div className="space-y-5">
              {/* Description */}
              {persona.description && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-2">Description</p>
                  <p className="text-sm text-slate-300 leading-relaxed">{persona.description}</p>
                </div>
              )}

              {/* Key persona fields from template_data */}
              {templateData && (
                <div className="space-y-4">
                  {templateData.field || templateData.yearsExperience ? (
                    <div className="grid grid-cols-2 gap-3">
                      {templateData.field && (
                        <div className="bg-slate-800/60 border border-slate-800 rounded-lg px-4 py-3">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Domain</p>
                          <p className="text-sm text-slate-200">{templateData.field}</p>
                        </div>
                      )}
                      {templateData.yearsExperience && (
                        <div className="bg-slate-800/60 border border-slate-800 rounded-lg px-4 py-3">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Experience</p>
                          <p className="text-sm text-slate-200">{templateData.yearsExperience}</p>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {templateData.coreGoal && (
                    <div className="bg-slate-800/60 border border-slate-800 rounded-lg px-4 py-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Core Goal</p>
                      <p className="text-sm text-slate-200 leading-relaxed">{templateData.coreGoal}</p>
                    </div>
                  )}

                  {templateData.achievement && (
                    <div className="bg-slate-800/60 border border-slate-800 rounded-lg px-4 py-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Background</p>
                      <p className="text-sm text-slate-200 leading-relaxed">{templateData.achievement}</p>
                    </div>
                  )}

                  {(templateData.tone || templateData.communicationStyle || templateData.traits) && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-2">Personality</p>
                      <div className="flex flex-wrap gap-2">
                        {templateData.tone && (
                          <span className="px-2.5 py-1 bg-violet-500/10 border border-violet-500/20 text-violet-300 rounded-md text-xs">
                            {templateData.tone}
                          </span>
                        )}
                        {templateData.communicationStyle && (
                          <span className="px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 rounded-md text-xs">
                            {templateData.communicationStyle}
                          </span>
                        )}
                        {templateData.traits && templateData.traits.split(',').map(trait => trait.trim()).filter(Boolean).map(trait => (
                          <span key={trait} className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-slate-300 rounded-md text-xs">
                            {trait}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {templateData.greeting && (
                    <div className="bg-slate-800/60 border border-slate-800 rounded-lg px-4 py-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Greeting</p>
                      <p className="text-sm text-slate-300 italic">"{templateData.greeting}"</p>
                    </div>
                  )}

                  {(templateData.doNotActions || templateData.alwaysActions) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {templateData.doNotActions && (
                        <div className="bg-red-950/20 border border-red-900/30 rounded-lg px-4 py-3">
                          <p className="text-[10px] text-red-500 uppercase tracking-wider mb-2">Do Not</p>
                          {templateData.doNotActions.split('\n').filter(Boolean).map((a, i) => (
                            <p key={i} className="text-xs text-red-300 leading-relaxed">— {a.trim()}</p>
                          ))}
                        </div>
                      )}
                      {templateData.alwaysActions && (
                        <div className="bg-green-950/20 border border-green-900/30 rounded-lg px-4 py-3">
                          <p className="text-[10px] text-green-500 uppercase tracking-wider mb-2">Always</p>
                          {templateData.alwaysActions.split('\n').filter(Boolean).map((a, i) => (
                            <p key={i} className="text-xs text-green-300 leading-relaxed">— {a.trim()}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {!templateData && !persona.description && (
                <p className="text-sm text-slate-500">No overview details available for this persona.</p>
              )}
            </div>
          )}

          {/* KNOWLEDGE TAB */}
          {tab === 'knowledge' && (
            <div>
              {loadingResources ? (
                <div className="flex items-center gap-2 text-slate-500 text-sm py-8 justify-center">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Loading documents…
                </div>
              ) : attachedDocuments.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-3">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-600">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </div>
                  <p className="text-sm text-slate-500">No knowledge base documents attached.</p>
                  <p className="text-xs text-slate-600 mt-1">Edit this persona to attach documents.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {attachedDocuments.map((doc) => (
                    <button
                      key={doc.documentId}
                      type="button"
                      onClick={() => setSelectedDoc(doc)}
                      className="w-full text-left flex items-start gap-3 p-4 bg-slate-800/50 border border-slate-800 rounded-xl hover:border-slate-600 hover:bg-slate-800 transition-all group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                          <line x1="16" y1="13" x2="8" y2="13"/>
                          <line x1="16" y1="17" x2="8" y2="17"/>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">{doc.title}</p>
                        {doc.source && (
                          <p className="text-xs text-slate-500 truncate mt-0.5">{doc.source}</p>
                        )}
                        {doc.preview && (
                          <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">{doc.preview}</p>
                        )}
                      </div>
                      <span className="text-xs text-slate-600 group-hover:text-blue-400 transition-colors flex-shrink-0 mt-0.5">
                        Preview →
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SKILLS TAB */}
          {tab === 'skills' && (
            <div>
              {loadingResources ? (
                <div className="flex items-center gap-2 text-slate-500 text-sm py-8 justify-center">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Loading skills…
                </div>
              ) : attachedSkills.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-3">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-600">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                    </svg>
                  </div>
                  <p className="text-sm text-slate-500">No skills attached.</p>
                  <p className="text-xs text-slate-600 mt-1">Edit this persona to attach skills.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {attachedSkills.map((skill) => (
                    <div
                      key={skill.skillId}
                      className="flex items-start gap-3 p-4 bg-slate-800/50 border border-slate-800 rounded-xl"
                    >
                      <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-violet-400">
                          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-slate-200">{skill.name}</p>
                          {skill.category && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 border border-slate-700 text-slate-500">
                              {skill.category}
                            </span>
                          )}
                          {skill.version && (
                            <span className="text-[10px] text-slate-600">v{skill.version}</span>
                          )}
                        </div>
                        {skill.description && (
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">{skill.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SYSTEM PROMPT TAB */}
          {tab === 'prompt' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>{soulContent.split('\n').length} lines</span>
                  <span>·</span>
                  <span>{soulContent.length} chars</span>
                </div>
                <button
                  onClick={copyPrompt}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    promptCopied
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {promptCopied ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      Copied
                    </>
                  ) : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                      Copy
                    </>
                  )}
                </button>
              </div>

              {soulContent ? (
                <div className="relative">
                  <div
                    className={`bg-slate-950/60 border border-slate-800 rounded-xl p-4 overflow-hidden transition-all ${
                      shouldCollapsePrompt && !showFullPrompt ? 'max-h-72' : ''
                    }`}
                  >
                    <pre className="whitespace-pre-wrap break-words font-mono text-xs text-slate-300 leading-relaxed">
                      {soulContent}
                    </pre>
                  </div>
                  {shouldCollapsePrompt && !showFullPrompt && (
                    <div className="absolute bottom-0 left-0 w-full h-16 bg-gradient-to-t from-slate-900 to-transparent pointer-events-none rounded-b-xl" />
                  )}
                  {shouldCollapsePrompt && (
                    <button
                      onClick={() => setShowFullPrompt(!showFullPrompt)}
                      className="mt-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showFullPrompt ? 'Show less ↑' : 'Show full prompt ↓'}
                    </button>
                  )}
                </div>
              ) : (
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                  <p className="text-xs text-slate-500">No system prompt configured yet.</p>
                </div>
              )}
            </div>
          )}

        </div>

        {/* ── Actions Footer ─────────────────────────────── */}
        <div className="flex-shrink-0 border-t border-slate-800 px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {!persona.active && (
              <button
                onClick={onSetActive}
                className="px-4 py-2 min-h-[38px] bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Set as Active
              </button>
            )}
            <button
              onClick={onEdit}
              className="px-4 py-2 min-h-[38px] bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg transition-colors border border-slate-700"
            >
              Edit
            </button>
          </div>
          <button
            onClick={onDelete}
            className="px-4 py-2 min-h-[38px] text-red-400 hover:text-red-300 hover:bg-red-950/40 text-sm font-medium rounded-lg transition-colors border border-transparent hover:border-red-900/40"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Document Preview Overlay */}
      {selectedDoc && (
        <div className="fixed inset-0 z-[60] bg-slate-950/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-800">
              <div>
                <p className="text-sm font-medium text-slate-100">{selectedDoc.title}</p>
                {selectedDoc.source && (
                  <p className="text-xs text-slate-500 mt-0.5">{selectedDoc.source}</p>
                )}
              </div>
              <button
                onClick={() => setSelectedDoc(null)}
                className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto p-5">
              <pre className="whitespace-pre-wrap text-xs text-slate-300 font-mono leading-relaxed">
                {selectedDoc.preview || 'No preview available.'}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PersonaDetailModal;
