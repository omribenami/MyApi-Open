import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

function EnhancedPersonaBuilder({ onSave, isLoading, initialData = null }) {
  const [tab, setTab] = useState('identity'); // identity, personality, rules, preview
  const defaultFormData = {
    // Identity
    name: '',
    title: '',
    field: '',
    yearsExperience: '',
    achievement: '',
    coreGoal: '',

    // Personality & Tone
    tone: '',
    communicationStyle: '',
    traits: '',
    vocabulary: '',
    avoidWords: '',

    // Operational Rules
    formatting: '',
    knowledgeLimit: '',
    knowledgeLimitTopic: '',
    knowledgeLimitRedirect: '',
    internalLogic: '',
    greeting: '',

    // Constraints
    doNotActions: '',
    alwaysActions: '',

    // Documents + Skills
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
  const masterToken = useAuthStore((state) => state.masterToken);
  const currentWorkspace = useAuthStore((state) => state.currentWorkspace);

  useEffect(() => {
    fetchDocuments();
    fetchSkills();
  }, [masterToken, currentWorkspace?.id]);

  const authHeaders = () => {
    const h = {};
    if (masterToken) h['Authorization'] = `Bearer ${masterToken}`;
    if (currentWorkspace?.id) h['X-Workspace-ID'] = currentWorkspace.id;
    return h;
  };

  const fetchDocuments = async () => {
    try {
      const response = await fetch('/api/v1/brain/knowledge-base', {
        headers: authHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableDocuments(data.data || data.documents || data || []);
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    }
  };

  const fetchSkills = async () => {
    try {
      const response = await fetch('/api/v1/skills', {
        headers: authHeaders(),
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableSkills(data.skills || data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch skills:', err);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleDocumentToggle = (docId) => {
    setFormData(prev => ({
      ...prev,
      attachedDocuments: prev.attachedDocuments.includes(docId)
        ? prev.attachedDocuments.filter(id => id !== docId)
        : [...prev.attachedDocuments, docId]
    }));
  };

  const handleSkillToggle = (skillId) => {
    setFormData(prev => ({
      ...prev,
      attachedSkills: prev.attachedSkills.includes(skillId)
        ? prev.attachedSkills.filter(id => id !== skillId)
        : [...prev.attachedSkills, skillId]
    }));
  };

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
        const actions = formData.doNotActions.split('\n').filter(a => a.trim());
        actions.forEach(action => {
          prompt += `- DO NOT ${action.trim()}\n`;
        });
        prompt += `\n`;
      }
      if (formData.alwaysActions) {
        const actions = formData.alwaysActions.split('\n').filter(a => a.trim());
        actions.forEach(action => {
          prompt += `- ALWAYS ${action.trim()}\n`;
        });
        prompt += `\n`;
      }
    }

    return prompt;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name) {
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
        description: `${formData.title || 'Custom Persona'} - ${formData.coreGoal || 'Expert AI'}`,
        attachedDocuments: formData.attachedDocuments,
        attachedSkills: formData.attachedSkills,
        templateData: {
          ...formData,
          createdAt: new Date().toISOString()
        }
      });
    } catch (err) {
      setError(err.message || 'Failed to save persona');
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-700 overflow-x-auto pb-1 no-scrollbar">
        {[
          { id: 'identity', label: '👤 Identity' },
          { id: 'personality', label: '🎭 Personality' },
          { id: 'rules', label: '⚙️ Rules' },
          { id: 'documents', label: '📚 Knowledge' },
          { id: 'preview', label: '👁️ Preview' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 font-medium text-sm transition-colors ${
              tab === t.id
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Form Sections */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identity Tab */}
        {tab === 'identity' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Persona Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="e.g., Bugs Bunny, Dr. Ada Lovelace"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Title/Role
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="e.g., Senior Full-Stack Developer, Data Scientist"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Field/Domain
                </label>
                <input
                  type="text"
                  value={formData.field}
                  onChange={(e) => handleInputChange('field', e.target.value)}
                  placeholder="e.g., Software Engineering"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Years of Experience
                </label>
                <input
                  type="text"
                  value={formData.yearsExperience}
                  onChange={(e) => handleInputChange('yearsExperience', e.target.value)}
                  placeholder="e.g., 15 years since the 90s"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Background/Achievement
              </label>
              <textarea
                value={formData.achievement}
                onChange={(e) => handleInputChange('achievement', e.target.value)}
                placeholder="e.g., Founded 3 startups, authored 2 technical books"
                rows="3"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Core Goal/Mission
              </label>
              <textarea
                value={formData.coreGoal}
                onChange={(e) => handleInputChange('coreGoal', e.target.value)}
                placeholder="e.g., review code with brutal honesty but high technical accuracy"
                rows="3"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Personality Tab */}
        {tab === 'personality' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Tone
              </label>
              <input
                type="text"
                value={formData.tone}
                onChange={(e) => handleInputChange('tone', e.target.value)}
                placeholder="e.g., Cynical, tired, but secretly helpful"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Communication Style
              </label>
              <input
                type="text"
                value={formData.communicationStyle}
                onChange={(e) => handleInputChange('communicationStyle', e.target.value)}
                placeholder="e.g., Short, direct, and slightly condescending"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Key Traits (comma-separated)
              </label>
              <input
                type="text"
                value={formData.traits}
                onChange={(e) => handleInputChange('traits', e.target.value)}
                placeholder="e.g., Impatient, brilliant, caffeinated"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Vocabulary/Jargon
              </label>
              <textarea
                value={formData.vocabulary}
                onChange={(e) => handleInputChange('vocabulary', e.target.value)}
                placeholder="e.g., old-school dev slang like 'spaghetti code' and 'RTFM'"
                rows="2"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Words/Topics to Avoid
              </label>
              <textarea
                value={formData.avoidWords}
                onChange={(e) => handleInputChange('avoidWords', e.target.value)}
                placeholder="e.g., emojis, corporate jargon"
                rows="2"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Rules Tab */}
        {tab === 'rules' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Formatting Rules
              </label>
              <input
                type="text"
                value={formData.formatting}
                onChange={(e) => handleInputChange('formatting', e.target.value)}
                placeholder="e.g., Bullet points, code blocks, tables"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Knowledge Limit Topic
                </label>
                <input
                  type="text"
                  value={formData.knowledgeLimitTopic}
                  onChange={(e) => handleInputChange('knowledgeLimitTopic', e.target.value)}
                  placeholder="e.g., No-Code tools"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Redirect To
                </label>
                <input
                  type="text"
                  value={formData.knowledgeLimitRedirect}
                  onChange={(e) => handleInputChange('knowledgeLimitRedirect', e.target.value)}
                  placeholder="e.g., Low-code frameworks"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Internal Logic / Roleplay
              </label>
              <textarea
                value={formData.internalLogic}
                onChange={(e) => handleInputChange('internalLogic', e.target.value)}
                placeholder="e.g., Act like you're typing from a dark basement office"
                rows="2"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Greeting / Opening Message
              </label>
              <textarea
                value={formData.greeting}
                onChange={(e) => handleInputChange('greeting', e.target.value)}
                placeholder="e.g., 'Sup, what are we fixing today?'"
                rows="2"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                DO NOT Actions (one per line)
              </label>
              <textarea
                value={formData.doNotActions}
                onChange={(e) => handleInputChange('doNotActions', e.target.value)}
                placeholder="use emojis&#10;give medical advice&#10;be diplomatic"
                rows="3"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                ALWAYS Actions (one per line)
              </label>
              <textarea
                value={formData.alwaysActions}
                onChange={(e) => handleInputChange('alwaysActions', e.target.value)}
                placeholder="ask a follow-up question&#10;provide code examples&#10;stay technical"
                rows="3"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Documents Tab */}
        {tab === 'documents' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Attach knowledge base documents to this persona for context-aware responses.
            </p>
            {availableDocuments.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <p>No documents in knowledge base yet.</p>
                <p className="text-sm mt-2">Create documents first in the Knowledge Base tab.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {availableDocuments.map((doc) => (
                  <label
                    key={doc.id}
                    className="flex items-center gap-3 p-3 bg-slate-700 hover:bg-slate-600 rounded-lg cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={formData.attachedDocuments.includes(doc.id)}
                      onChange={() => handleDocumentToggle(doc.id)}
                      className="w-4 h-4 accent-blue-500"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-white">{doc.title}</p>
                      <p className="text-xs text-slate-400">{doc.source}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="pt-4 border-t border-slate-700">
              <p className="text-sm text-slate-400 mb-3">
                Attach skills to this persona. Persona-scoped tokens will include these skills and their attached docs in context.
              </p>
              {availableSkills.length === 0 ? (
                <div className="text-center py-4 text-slate-400 text-sm">No skills found.</div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {availableSkills.map((skill) => (
                    <label
                      key={skill.id}
                      className="flex items-center gap-3 p-3 bg-slate-700 hover:bg-slate-600 rounded-lg cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={formData.attachedSkills.includes(skill.id)}
                        onChange={() => handleSkillToggle(skill.id)}
                        className="w-4 h-4 accent-blue-500"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-white">{skill.name}</p>
                        <p className="text-xs text-slate-400">{skill.category || 'custom'}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Preview Tab */}
        {tab === 'preview' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Generated System Prompt</h3>
              <div className="bg-slate-800 rounded p-4 text-slate-300 whitespace-pre-wrap font-mono text-sm max-h-96 overflow-y-auto">
                {generateSystemPrompt() || '(Complete the form to see your system prompt)'}
              </div>
            </div>

            {formData.attachedDocuments.length > 0 && (
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Attached Documents</h3>
                <div className="space-y-2">
                  {formData.attachedDocuments.map((docId) => {
                    const doc = availableDocuments.find(d => d.id === docId);
                    return (
                      <div key={docId} className="flex items-center gap-2 text-slate-300 text-sm">
                        <span>📄</span>
                        <span>{doc?.title}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {formData.attachedSkills.length > 0 && (
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Attached Skills</h3>
                <div className="space-y-2">
                  {formData.attachedSkills.map((skillId) => {
                    const skill = availableSkills.find((s) => s.id === skillId);
                    return (
                      <div key={skillId} className="flex items-center gap-2 text-slate-300 text-sm">
                        <span>🧩</span>
                        <span>{skill?.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-4">
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Saving...' : 'Save Persona'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default EnhancedPersonaBuilder;
