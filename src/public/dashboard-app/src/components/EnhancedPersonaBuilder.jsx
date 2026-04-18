import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

const TABS = [
  {
    id: 'identity',
    label: 'Identity',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
  {
    id: 'personality',
    label: 'Personality',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
        <line x1="9" y1="9" x2="9.01" y2="9"/>
        <line x1="15" y1="9" x2="15.01" y2="9"/>
      </svg>
    ),
  },
  {
    id: 'rules',
    label: 'Rules',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="9 11 12 14 22 4"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
  },
  {
    id: 'knowledge',
    label: 'Knowledge',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      </svg>
    ),
  },
  {
    id: 'preview',
    label: 'Preview',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    ),
  },
];

function Field({ label, hint, required, children }) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1.5">
        <label className="text-sm font-medium text-slate-200">
          {label}
          {required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        {hint && <span className="text-xs text-slate-500">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:bg-slate-800 transition-colors';
const textareaCls = `${inputCls} resize-none`;

function EnhancedPersonaBuilder({ onSave, isLoading, initialData = null }) {
  const [tab, setTab] = useState('identity');

  const defaultFormData = {
    name: '',
    title: '',
    field: '',
    yearsExperience: '',
    achievement: '',
    coreGoal: '',
    tone: '',
    communicationStyle: '',
    traits: '',
    vocabulary: '',
    avoidWords: '',
    formatting: '',
    knowledgeLimit: '',
    knowledgeLimitTopic: '',
    knowledgeLimitRedirect: '',
    internalLogic: '',
    greeting: '',
    doNotActions: '',
    alwaysActions: '',
    attachedDocuments: [],
    attachedSkills: [],
  };

  const [formData, setFormData] = useState({
    ...defaultFormData,
    ...(initialData || {}),
    attachedDocuments: Array.isArray(initialData?.attachedDocuments) ? initialData.attachedDocuments : [],
    attachedSkills: Array.isArray(initialData?.attachedSkills) ? initialData.attachedSkills : [],
  });

  const [error, setError] = useState('');
  const [availableDocuments, setAvailableDocuments] = useState([]);
  const [availableSkills, setAvailableSkills] = useState([]);
  const [docSearch, setDocSearch] = useState('');
  const [skillSearch, setSkillSearch] = useState('');
  const [promptCopied, setPromptCopied] = useState(false);
  const masterToken = useAuthStore((state) => state.masterToken);
  const currentWorkspace = useAuthStore((state) => state.currentWorkspace);

  useEffect(() => {
    fetchDocuments();
    fetchSkills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterToken, currentWorkspace?.id]);

  const authHeaders = () => {
    const h = {};
    if (masterToken) h['Authorization'] = `Bearer ${masterToken}`;
    if (currentWorkspace?.id) h['X-Workspace-ID'] = currentWorkspace.id;
    return h;
  };

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/v1/brain/knowledge-base', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAvailableDocuments(data.data || data.documents || data || []);
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    }
  };

  const fetchSkills = async () => {
    try {
      const res = await fetch('/api/v1/skills', { headers: authHeaders(), credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAvailableSkills(data.skills || data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch skills:', err);
    }
  };

  const set = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const toggleDoc = (id) => setFormData(prev => ({
    ...prev,
    attachedDocuments: prev.attachedDocuments.includes(id)
      ? prev.attachedDocuments.filter(x => x !== id)
      : [...prev.attachedDocuments, id],
  }));

  const toggleSkill = (id) => setFormData(prev => ({
    ...prev,
    attachedSkills: prev.attachedSkills.includes(id)
      ? prev.attachedSkills.filter(x => x !== id)
      : [...prev.attachedSkills, id],
  }));

  const generateSystemPrompt = () => {
    let prompt = '';

    if (formData.name || formData.title) {
      prompt += `## Role & Identity\n\n`;
      prompt += `You are ${formData.name || 'an AI'}`;
      if (formData.title) prompt += `, a ${formData.title}`;
      if (formData.yearsExperience) prompt += ` with ${formData.yearsExperience} years of experience`;
      if (formData.field) prompt += ` in ${formData.field}`;
      prompt += `. `;
      if (formData.achievement) prompt += `Your background includes ${formData.achievement}. `;
      if (formData.coreGoal) prompt += `Your primary goal is to ${formData.coreGoal}.`;
      prompt += `\n\n`;
    }

    if (formData.tone || formData.communicationStyle || formData.traits) {
      prompt += `## Personality & Tone\n\n`;
      if (formData.tone) prompt += `**Tone:** ${formData.tone}\n\n`;
      if (formData.communicationStyle) prompt += `**Communication Style:** ${formData.communicationStyle}\n\n`;
      if (formData.traits) prompt += `**Traits:** You are ${formData.traits}\n\n`;
      if (formData.vocabulary) prompt += `**Vocabulary:** Use ${formData.vocabulary}`;
      if (formData.avoidWords) prompt += `. Avoid ${formData.avoidWords}`;
      prompt += `\n\n`;
    }

    if (formData.formatting || formData.knowledgeLimit || formData.internalLogic || formData.greeting) {
      prompt += `## Operational Rules\n\n`;
      if (formData.formatting) prompt += `**Formatting:** Always present data using ${formData.formatting}\n\n`;
      if (formData.knowledgeLimit && formData.knowledgeLimitTopic) {
        prompt += `**Knowledge Limit:** If asked about "${formData.knowledgeLimitTopic}"`;
        if (formData.knowledgeLimitRedirect) prompt += `, politely redirect to "${formData.knowledgeLimitRedirect}"`;
        prompt += `\n\n`;
      }
      if (formData.internalLogic) prompt += `**Internal Logic:** ${formData.internalLogic}\n\n`;
      if (formData.greeting) prompt += `**Greeting:** Start every interaction with: "${formData.greeting}"\n\n`;
    }

    if (formData.doNotActions || formData.alwaysActions) {
      prompt += `## Response Constraints\n\n`;
      if (formData.doNotActions) {
        formData.doNotActions.split('\n').filter(a => a.trim()).forEach(a => {
          prompt += `- DO NOT ${a.trim()}\n`;
        });
        prompt += `\n`;
      }
      if (formData.alwaysActions) {
        formData.alwaysActions.split('\n').filter(a => a.trim()).forEach(a => {
          prompt += `- ALWAYS ${a.trim()}\n`;
        });
        prompt += `\n`;
      }
    }

    return prompt;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Persona name is required');
      return;
    }

    const systemPrompt = generateSystemPrompt();
    if (!systemPrompt.trim()) {
      setError('Please fill in at least some persona details');
      return;
    }

    try {
      await onSave({
        name: formData.name,
        soul_content: systemPrompt,
        description: `${formData.title || 'Custom Persona'} — ${formData.coreGoal || 'Expert AI'}`,
        attachedDocuments: formData.attachedDocuments,
        attachedSkills: formData.attachedSkills,
        templateData: { ...formData, createdAt: new Date().toISOString() },
      });
    } catch (err) {
      setError(err.message || 'Failed to save persona');
    }
  };

  const copyPrompt = async () => {
    const prompt = generateSystemPrompt();
    try {
      await navigator.clipboard.writeText(prompt);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
    } catch (_e) { /* clipboard not available */ }
  };

  const filteredDocs = availableDocuments.filter(d =>
    !docSearch || (d.title || '').toLowerCase().includes(docSearch.toLowerCase())
  );
  const filteredSkills = availableSkills.filter(s =>
    !skillSearch || (s.name || '').toLowerCase().includes(skillSearch.toLowerCase())
  );

  return (
    <div className="space-y-0">
      {/* Tab bar */}
      <div className="flex gap-0.5 border-b border-slate-700/60 overflow-x-auto mb-5">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? 'text-blue-400 border-blue-500'
                : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            <span className={tab === t.id ? 'text-blue-400' : 'text-slate-600'}>{t.icon}</span>
            {t.label}
            {t.id === 'knowledge' && (formData.attachedDocuments.length > 0 || formData.attachedSkills.length > 0) && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-400 font-medium">
                {formData.attachedDocuments.length + formData.attachedSkills.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── IDENTITY ── */}
        {tab === 'identity' && (
          <div className="space-y-4">
            <Field label="Persona Name" required>
              <input
                type="text"
                value={formData.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g., Dr. Ada Lovelace, Senior Coder"
                className={inputCls}
                autoFocus
              />
            </Field>

            <Field label="Title / Role" hint="optional">
              <input
                type="text"
                value={formData.title}
                onChange={e => set('title', e.target.value)}
                placeholder="e.g., Senior Full-Stack Developer"
                className={inputCls}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Domain / Field">
                <input
                  type="text"
                  value={formData.field}
                  onChange={e => set('field', e.target.value)}
                  placeholder="e.g., Software Engineering"
                  className={inputCls}
                />
              </Field>
              <Field label="Experience">
                <input
                  type="text"
                  value={formData.yearsExperience}
                  onChange={e => set('yearsExperience', e.target.value)}
                  placeholder="e.g., 15 years"
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="Background / Achievement">
              <textarea
                value={formData.achievement}
                onChange={e => set('achievement', e.target.value)}
                placeholder="e.g., Founded 3 startups, authored 2 technical books"
                rows={3}
                className={textareaCls}
              />
            </Field>

            <Field label="Core Goal / Mission">
              <textarea
                value={formData.coreGoal}
                onChange={e => set('coreGoal', e.target.value)}
                placeholder="e.g., review code with brutal honesty but high technical accuracy"
                rows={3}
                className={textareaCls}
              />
            </Field>
          </div>
        )}

        {/* ── PERSONALITY ── */}
        {tab === 'personality' && (
          <div className="space-y-4">
            <Field label="Tone" hint="overall emotional register">
              <input
                type="text"
                value={formData.tone}
                onChange={e => set('tone', e.target.value)}
                placeholder="e.g., Cynical, tired, but secretly helpful"
                className={inputCls}
              />
            </Field>

            <Field label="Communication Style">
              <input
                type="text"
                value={formData.communicationStyle}
                onChange={e => set('communicationStyle', e.target.value)}
                placeholder="e.g., Short, direct, and slightly condescending"
                className={inputCls}
              />
            </Field>

            <Field label="Key Traits" hint="comma-separated">
              <input
                type="text"
                value={formData.traits}
                onChange={e => set('traits', e.target.value)}
                placeholder="e.g., Impatient, brilliant, caffeinated"
                className={inputCls}
              />
            </Field>

            <Field label="Vocabulary / Jargon">
              <textarea
                value={formData.vocabulary}
                onChange={e => set('vocabulary', e.target.value)}
                placeholder="e.g., old-school dev slang like 'spaghetti code' and 'RTFM'"
                rows={2}
                className={textareaCls}
              />
            </Field>

            <Field label="Words / Topics to Avoid">
              <textarea
                value={formData.avoidWords}
                onChange={e => set('avoidWords', e.target.value)}
                placeholder="e.g., emojis, corporate jargon, buzzwords"
                rows={2}
                className={textareaCls}
              />
            </Field>
          </div>
        )}

        {/* ── RULES ── */}
        {tab === 'rules' && (
          <div className="space-y-4">
            <Field label="Formatting Rules">
              <input
                type="text"
                value={formData.formatting}
                onChange={e => set('formatting', e.target.value)}
                placeholder="e.g., Bullet points, code blocks, numbered steps"
                className={inputCls}
              />
            </Field>

            <div>
              <p className="text-sm font-medium text-slate-200 mb-2">Knowledge Limit</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500 mb-1.5">Avoid topic</p>
                  <input
                    type="text"
                    value={formData.knowledgeLimitTopic}
                    onChange={e => set('knowledgeLimitTopic', e.target.value)}
                    placeholder="e.g., No-Code tools"
                    className={inputCls}
                  />
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1.5">Redirect to</p>
                  <input
                    type="text"
                    value={formData.knowledgeLimitRedirect}
                    onChange={e => set('knowledgeLimitRedirect', e.target.value)}
                    placeholder="e.g., Low-code frameworks"
                    className={inputCls}
                  />
                </div>
              </div>
            </div>

            <Field label="Internal Logic / Roleplay" hint="scene-setting">
              <textarea
                value={formData.internalLogic}
                onChange={e => set('internalLogic', e.target.value)}
                placeholder="e.g., Act like you're typing from a dark basement office"
                rows={2}
                className={textareaCls}
              />
            </Field>

            <Field label="Opening Greeting">
              <textarea
                value={formData.greeting}
                onChange={e => set('greeting', e.target.value)}
                placeholder="e.g., 'Sup, what are we fixing today?'"
                rows={2}
                className={textareaCls}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="DO NOT Actions" hint="one per line">
                <textarea
                  value={formData.doNotActions}
                  onChange={e => set('doNotActions', e.target.value)}
                  placeholder={'use emojis\ngive medical advice\nbe diplomatic'}
                  rows={4}
                  className={textareaCls}
                />
              </Field>
              <Field label="ALWAYS Actions" hint="one per line">
                <textarea
                  value={formData.alwaysActions}
                  onChange={e => set('alwaysActions', e.target.value)}
                  placeholder={'ask a follow-up question\nprovide code examples\nstay technical'}
                  rows={4}
                  className={textareaCls}
                />
              </Field>
            </div>
          </div>
        )}

        {/* ── KNOWLEDGE ── */}
        {tab === 'knowledge' && (
          <div className="space-y-6">
            {/* Documents */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-medium text-slate-200">Knowledge Base Documents</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Attach documents for context-aware responses</p>
                </div>
                {formData.attachedDocuments.length > 0 && (
                  <span className="text-xs text-blue-400 font-medium">
                    {formData.attachedDocuments.length} selected
                  </span>
                )}
              </div>

              {availableDocuments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center">
                  <p className="text-sm text-slate-500">No documents in your knowledge base yet.</p>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={docSearch}
                    onChange={e => setDocSearch(e.target.value)}
                    placeholder="Search documents…"
                    className={`${inputCls} mb-2`}
                  />
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {filteredDocs.map(doc => {
                      const checked = formData.attachedDocuments.includes(doc.id);
                      return (
                        <label
                          key={doc.id}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                            checked
                              ? 'bg-blue-500/10 border border-blue-500/25'
                              : 'bg-slate-800/60 border border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleDoc(doc.id)}
                            className="w-4 h-4 accent-blue-500 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-200 truncate">{doc.title}</p>
                            {doc.source && <p className="text-xs text-slate-500 truncate">{doc.source}</p>}
                          </div>
                        </label>
                      );
                    })}
                    {filteredDocs.length === 0 && (
                      <p className="text-xs text-slate-600 py-3 text-center">No matches</p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Skills */}
            <div className="pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-medium text-slate-200">Skills</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Persona-scoped tokens will include these skills in context</p>
                </div>
                {formData.attachedSkills.length > 0 && (
                  <span className="text-xs text-violet-400 font-medium">
                    {formData.attachedSkills.length} selected
                  </span>
                )}
              </div>

              {availableSkills.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center">
                  <p className="text-sm text-slate-500">No skills found.</p>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={skillSearch}
                    onChange={e => setSkillSearch(e.target.value)}
                    placeholder="Search skills…"
                    className={`${inputCls} mb-2`}
                  />
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {filteredSkills.map(skill => {
                      const checked = formData.attachedSkills.includes(skill.id);
                      return (
                        <label
                          key={skill.id}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                            checked
                              ? 'bg-violet-500/10 border border-violet-500/25'
                              : 'bg-slate-800/60 border border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSkill(skill.id)}
                            className="w-4 h-4 accent-violet-500 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-200 truncate">{skill.name}</p>
                            <p className="text-xs text-slate-500 truncate">{skill.category || 'custom'}</p>
                          </div>
                        </label>
                      );
                    })}
                    {filteredSkills.length === 0 && (
                      <p className="text-xs text-slate-600 py-3 text-center">No matches</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── PREVIEW ── */}
        {tab === 'preview' && (
          <div className="space-y-4">
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Generated System Prompt</p>
                <button
                  type="button"
                  onClick={copyPrompt}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    promptCopied
                      ? 'bg-green-500/20 text-green-400'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {promptCopied ? (
                    <>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      Copied
                    </>
                  ) : (
                    <>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                      Copy
                    </>
                  )}
                </button>
              </div>
              <div className="p-4 max-h-72 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-xs text-slate-300 font-mono leading-relaxed">
                  {generateSystemPrompt() || '(Complete the Identity tab to generate your system prompt)'}
                </pre>
              </div>
            </div>

            {(formData.attachedDocuments.length > 0 || formData.attachedSkills.length > 0) && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Attached Resources</p>
                <div className="space-y-1.5">
                  {formData.attachedDocuments.map(id => {
                    const doc = availableDocuments.find(d => d.id === id);
                    return doc ? (
                      <div key={id} className="flex items-center gap-2 text-xs text-slate-400">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400 flex-shrink-0">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                        </svg>
                        <span className="truncate">{doc.title}</span>
                      </div>
                    ) : null;
                  })}
                  {formData.attachedSkills.map(id => {
                    const skill = availableSkills.find(s => s.id === id);
                    return skill ? (
                      <div key={id} className="flex items-center gap-2 text-xs text-slate-400">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-violet-400 flex-shrink-0">
                          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                        </svg>
                        <span className="truncate">{skill.name}</span>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-950/30 border border-red-800/50 rounded-lg px-4 py-3">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Submit */}
        <div className="pt-2 flex gap-3">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {isLoading ? 'Saving…' : 'Save Persona'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default EnhancedPersonaBuilder;
