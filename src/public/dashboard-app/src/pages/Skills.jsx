import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useSkillStore } from '../stores/skillStore';
import SkillDetailModal from '../components/SkillDetailModal';

const CATEGORIES = [
  { value: 'automation', label: '⚡ Automation' },
  { value: 'integration', label: '🔗 Integration' },
  { value: 'analytics', label: '📊 Analytics' },
  { value: 'security', label: '🔒 Security' },
  { value: 'communication', label: '💬 Communication' },
  { value: 'productivity', label: '📈 Productivity' },
  { value: 'custom', label: '🛠️ Custom' },
];

function CreateEditModal({ isEdit, skill, onSave, onClose, masterToken }) {
  const [form, setForm] = useState({
    name: skill?.name || '',
    description: skill?.description || '',
    version: skill?.version || '1.0.0',
    author: skill?.author || '',
    category: skill?.category || 'custom',
    repo_url: skill?.repo_url || '',
    script_content: skill?.script_content || '',
    config_json: skill?.config_json
      ? typeof skill.config_json === 'object'
        ? JSON.stringify(skill.config_json, null, 2)
        : skill.config_json
      : '{}',
  });
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [scanner, setScanner] = useState(skill?.config_json?.scanner || null);

  const handleScan = async () => {
    if (!form.repo_url?.trim()) {
      setError('Repository URL is required');
      return;
    }
    setScanning(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/skills/scan-repo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${masterToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: form.repo_url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to scan repository');

      const meta = data.metadata || {};
      setScanner(data.scanner || null);
      setForm((prev) => ({
        ...prev,
        ...meta,
        config_json: JSON.stringify(meta.config_json || {}, null, 2),
      }));
    } catch (err) {
      setError(err.message || 'Failed to scan repository');
    } finally {
      setScanning(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save skill');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-slate-700 bg-slate-800 z-10">
          <h2 className="text-xl font-bold text-white">{isEdit ? '✏️ Edit Skill' : '➕ Add Skill from Git Repo'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-3 text-red-200 text-sm">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">GitHub Repository URL *</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={form.repo_url}
                onChange={(e) => setForm({ ...form, repo_url: e.target.value })}
                className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://github.com/user/repo"
                required={!isEdit}
              />
              <button type="button" onClick={handleScan} disabled={scanning} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50">
                {scanning ? 'Scanning...' : 'Scan & Parse'}
              </button>
            </div>
          </div>

          {scanner && (
            <div className={`rounded-lg p-3 border ${scanner.safe_to_use ? 'bg-green-900/30 border-green-700 text-green-200' : 'bg-amber-900/30 border-amber-700 text-amber-200'}`}>
              <p className="font-medium">
                {scanner.safe_to_use ? '✅ Safe to use' : '⚠️ Scanner found potential risks'}
                <span className="ml-2 text-xs opacity-80">
                  score: {scanner.score}
                  <span
                    className="ml-1 cursor-help underline decoration-dotted"
                    title="Score starts at 100. The scanner checks README/SKILL.md/package.json text for risky patterns (rm -rf /, curl|sh, wget|bash, eval(), child_process, encoded PowerShell, miner/keylogger terms). It subtracts 35 per match, adds +5 if license is detected, and +5 if repo stars > 3."
                    aria-label="How score is calculated"
                  >
                    *
                  </span>
                </span>
              </p>
              {scanner.findings?.length > 0 && <p className="text-xs mt-1">{scanner.findings.join(' • ')}</p>}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-300 mb-1">Name *</label><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white" /></div>
            <div><label className="block text-sm font-medium text-slate-300 mb-1">Version</label><input type="text" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white" /></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-300 mb-1">Author</label><input type="text" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white" /></div>
            <div><label className="block text-sm font-medium text-slate-300 mb-1">Category</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white">{CATEGORIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}</select></div>
          </div>

          <div><label className="block text-sm font-medium text-slate-300 mb-1">Description</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white resize-none" /></div>
          <div><label className="block text-sm font-medium text-slate-300 mb-1">Script Content</label><textarea value={form.script_content} onChange={(e) => setForm({ ...form, script_content: e.target.value })} rows={8} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-green-300 font-mono text-sm resize-y" /></div>
          <div><label className="block text-sm font-medium text-slate-300 mb-1">Configuration (JSON)</label><textarea value={form.config_json} onChange={(e) => setForm({ ...form, config_json: e.target.value })} rows={4} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-amber-300 font-mono text-sm resize-y" /></div>

          <div className="flex gap-3 pt-4 border-t border-slate-700">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50">{saving ? '⏳ Saving...' : isEdit ? 'Update Skill' : 'Create Skill'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ onConfirm, onClose }) {
  const [deleting, setDeleting] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-slate-800 rounded-lg shadow-xl max-w-sm w-full mx-4 p-6">
        <h3 className="text-lg font-bold text-white mb-2">Delete Skill?</h3>
        <p className="text-slate-400 text-sm mb-6">This action cannot be undone.</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium">
            Cancel
          </button>
          <button
            onClick={async () => {
              setDeleting(true);
              await onConfirm();
              onClose();
            }}
            disabled={deleting}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50"
          >
            {deleting ? '⏳ Deleting...' : '🗑️ Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Skills() {
  const masterToken = useAuthStore((s) => s.masterToken);
  const {
    skills, isLoading, error, setSkills, setIsLoading, setError, clearError,
    showCreateModal, openCreateModal, closeCreateModal,
    showEditModal, selectedSkill, openEditModal, closeEditModal,
    showDetailModal, openDetailModal,
    showDeleteConfirmation, targetSkillId, openDeleteConfirmation, closeDeleteConfirmation,
  } = useSkillStore();

  const navigate = useNavigate();
  const [fetchError, setFetchError] = useState(null);
  const [skillTokens, setSkillTokens] = useState({});
  const [publishingId, setPublishingId] = useState(null);
  const [generatingTokenId, setGeneratingTokenId] = useState(null);

  useEffect(() => {
    if (masterToken) fetchSkills();
  }, [masterToken]);

  const fetchSkills = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/v1/skills', {
        headers: { Authorization: `Bearer ${masterToken}` },
      });
      if (!res.ok) throw new Error('Failed to fetch skills');
      const data = await res.json();
      setSkills(data.data || []);
    } catch (err) {
      setFetchError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (formData) => {
    const res = await fetch('/api/v1/skills', {
      method: 'POST',
      headers: { Authorization: `Bearer ${masterToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create skill');
    }
    fetchSkills();
  };

  const handleUpdate = async (formData) => {
    const res = await fetch(`/api/v1/skills/${selectedSkill.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${masterToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update skill');
    }
    fetchSkills();
  };

  const handleDelete = async () => {
    const res = await fetch(`/api/v1/skills/${targetSkillId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${masterToken}` },
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete skill');
    }
    fetchSkills();
  };

  const handleActivate = async (skillId) => {
    const res = await fetch(`/api/v1/skills/${skillId}/activate`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${masterToken}` },
    });
    if (res.ok) fetchSkills();
  };

  const handlePublish = async (skill) => {
    setPublishingId(skill.id);
    try {
      const res = await fetch('/api/v1/marketplace', {
        method: 'POST',
        headers: { Authorization: `Bearer ${masterToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'skill',
          title: skill.name,
          description: skill.description || '',
          content: JSON.stringify({
            script_content: skill.script_content || '',
            config_json: skill.config_json || {},
            version: skill.version,
            category: skill.category,
            repo_url: skill.repo_url || '',
            scanner: skill?.config_json?.scanner || null,
          }),
          tags: skill.category || '',
        }),
      });
      if (res.ok) navigate('/my-listings');
      else {
        const err = await res.json();
        setError(err.error || 'Failed to publish');
      }
    } catch {
      setError('Failed to publish to marketplace');
    } finally {
      setPublishingId(null);
    }
  };

  const handleGenerateToken = async (skill) => {
    setGeneratingTokenId(skill.id);
    try {
      const res = await fetch('/api/v1/tokens', {
        method: 'POST',
        headers: { Authorization: `Bearer ${masterToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: `Skill: ${skill.name}`,
          scopes: ['skills', 'read'],
          expiresInHours: null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const token = data.data?.token || data.token;
        setSkillTokens((prev) => ({ ...prev, [skill.id]: { token, copied: false } }));
      } else {
        const err = await res.json();
        setError(err.error || 'Failed to generate token');
      }
    } catch {
      setError('Failed to generate token');
    } finally {
      setGeneratingTokenId(null);
    }
  };

  const handleCopyToken = async (skillId) => {
    const t = skillTokens[skillId];
    if (!t?.token) return;
    try {
      await navigator.clipboard.writeText(t.token);
      setSkillTokens((prev) => ({ ...prev, [skillId]: { ...prev[skillId], copied: true } }));
      setTimeout(() => {
        setSkillTokens((prev) => ({ ...prev, [skillId]: { ...prev[skillId], copied: false } }));
      }, 2000);
    } catch {}
  };

  const categoryLabel = (cat) => CATEGORIES.find((c) => c.value === cat)?.label || cat;

  if (isLoading && skills.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">🧩 Skills</h1>
          <p className="text-slate-400 mt-1">Create and manage agent skills</p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors whitespace-nowrap"
        >
          ➕ Create Skill
        </button>
      </div>

      {/* Errors */}
      {(error || fetchError) && (
        <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-4 text-red-200 flex items-start justify-between gap-4">
          <div>
            <p className="font-medium">Error</p>
            <p className="text-sm mt-1">{error || fetchError}</p>
          </div>
          <button onClick={clearError} className="text-red-200 hover:text-red-100">✕</button>
        </div>
      )}

      {/* Skills grid */}
      {skills.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-4">🧩</p>
          <h2 className="text-2xl font-bold text-white mb-2">No Skills Yet</h2>
          <p className="text-slate-400 mb-6">Create your first agent skill to get started</p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            ➕ Create Your First Skill
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {skills.map((skill) => (
            <div
              key={skill.id}
              className={`rounded-lg border p-6 transition-all duration-200 ${
                skill.active
                  ? 'bg-slate-800 border-green-500 shadow-lg shadow-green-500/20'
                  : 'bg-slate-800 border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white">{skill.name}</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="inline-block px-2 py-0.5 bg-blue-900 bg-opacity-50 text-blue-300 text-xs rounded-full border border-blue-700">
                      {categoryLabel(skill.category)}
                    </span>
                    {skill.version && (
                      <span className="text-xs text-slate-400">v{skill.version}</span>
                    )}
                    {skill.active && (
                      <span className="inline-block px-2 py-0.5 bg-green-600 text-green-100 text-xs font-medium rounded">
                        ✓ Active
                      </span>
                    )}
                    {skill?.config_json?.scanner?.safe_to_use && (
                      <span className="inline-block px-2 py-0.5 bg-emerald-700 text-emerald-100 text-xs font-medium rounded border border-emerald-500">
                        🛡 Safe to use
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {skill.author && (
                <p className="text-xs text-slate-500 mb-2">by {skill.author}</p>
              )}

              {skill.description && (
                <p className="text-slate-300 text-sm mb-4 line-clamp-2">{skill.description}</p>
              )}

              {/* Token display */}
              {skillTokens[skill.id] && (
                <div className="mb-4 p-3 bg-slate-900 rounded-lg border border-slate-700">
                  <p className="text-xs text-slate-400 mb-2">Skill Token — copy it now</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs text-green-300 font-mono break-all bg-slate-800 p-2 rounded">
                      {skillTokens[skill.id].token}
                    </code>
                    <button
                      onClick={() => handleCopyToken(skill.id)}
                      className="px-3 py-1.5 text-xs text-blue-400 hover:text-blue-300 bg-slate-700 rounded flex-shrink-0"
                    >
                      {skillTokens[skill.id].copied ? '✓ Copied!' : '📋 Copy'}
                    </button>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-slate-700">
                <button
                  onClick={() => openDetailModal(skill)}
                  className="flex-1 px-3 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
                >
                  👁 View
                </button>
                <button
                  onClick={() => openEditModal(skill)}
                  className="flex-1 px-3 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={() => openDeleteConfirmation(skill.id)}
                  className="flex-1 px-3 py-2 text-sm font-medium text-red-400 hover:text-red-200 hover:bg-red-900 hover:bg-opacity-30 rounded transition-colors"
                >
                  🗑️ Delete
                </button>
              </div>

              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => handlePublish(skill)}
                  disabled={publishingId === skill.id}
                  className="flex-1 px-3 py-2 text-sm font-medium text-purple-400 hover:text-purple-200 hover:bg-purple-900 hover:bg-opacity-30 rounded transition-colors border border-transparent hover:border-purple-700 disabled:opacity-50"
                >
                  {publishingId === skill.id ? '⏳ Publishing...' : '🏪 Publish'}
                </button>
                <button
                  onClick={() => handleGenerateToken(skill)}
                  disabled={generatingTokenId === skill.id}
                  className="flex-1 px-3 py-2 text-sm font-medium text-amber-400 hover:text-amber-200 hover:bg-amber-900 hover:bg-opacity-30 rounded transition-colors border border-transparent hover:border-amber-700 disabled:opacity-50"
                >
                  {generatingTokenId === skill.id ? '⏳ Generating...' : '🔑 Get Token'}
                </button>
              </div>

              {!skill.active && (
                <button
                  onClick={() => handleActivate(skill.id)}
                  className="w-full mt-2 px-3 py-2 text-sm font-medium text-green-400 hover:text-green-200 hover:bg-green-900 hover:bg-opacity-30 rounded transition-colors border border-transparent hover:border-green-700"
                >
                  ⭐ Set as Active
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateEditModal isEdit={false} onSave={handleCreate} onClose={closeCreateModal} masterToken={masterToken} />
      )}
      {showEditModal && selectedSkill && (
        <CreateEditModal isEdit={true} skill={selectedSkill} onSave={handleUpdate} onClose={closeEditModal} masterToken={masterToken} />
      )}
      {showDeleteConfirmation && (
        <DeleteConfirmModal onConfirm={handleDelete} onClose={closeDeleteConfirmation} />
      )}
      <SkillDetailModal />
    </div>
  );
}

export default Skills;
