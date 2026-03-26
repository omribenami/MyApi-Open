import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import PersonaDetailModal from '../components/PersonaDetailModal';
import EnhancedPersonaBuilder from '../components/EnhancedPersonaBuilder';

function Personas() {
  const token = useAuthStore((state) => state.masterToken);
  const currentWorkspace = useAuthStore((state) => state.currentWorkspace);
  const [personas, setPersonas] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedPersona, setSelectedPersona] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPersona, setEditingPersona] = useState(null);
  const [, setLoadingDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('updated_desc');

  useEffect(() => {
    fetchPersonas();
  }, [token, currentWorkspace?.id]);

  const handleSelectPersona = async (persona) => {
    setLoadingDetail(true);
    try {
      // Fetch full persona details including soul_content
      const response = await fetch(`/api/v1/personas/${persona.id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedPersona(data.data);
      } else {
        setSelectedPersona(persona);
      }
    } catch (err) {
      console.error('Failed to fetch full persona:', err);
      setSelectedPersona(persona);
    } finally {
      setLoadingDetail(false);
    }
  };

  const fetchPersonas = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/v1/personas', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setPersonas(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch personas:', err);
      setError('Failed to load personas');
    } finally {
      setIsLoading(false);
    }
  };

  const syncPersonaDocuments = async (personaId, nextDocumentIds = []) => {
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    const response = await fetch(`/api/v1/personas/${personaId}/documents`, { headers: { 'Authorization': `Bearer ${token}` } });
    const payload = response.ok ? await response.json() : { data: [] };
    const currentIds = (payload.data || []).map((doc) => doc.documentId);

    const toAttach = nextDocumentIds.filter((id) => !currentIds.includes(id));
    const toDetach = currentIds.filter((id) => !nextDocumentIds.includes(id));

    await Promise.all([
      ...toAttach.map((documentId) => fetch(`/api/v1/personas/${personaId}/documents`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ documentId }),
      })),
      ...toDetach.map((docId) => fetch(`/api/v1/personas/${personaId}/documents/${docId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      })),
    ]);
  };

  const syncPersonaSkills = async (personaId, nextSkillIds = []) => {
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    const response = await fetch(`/api/v1/personas/${personaId}/skills`, { headers: { 'Authorization': `Bearer ${token}` } });
    const payload = response.ok ? await response.json() : { data: [] };
    const currentIds = (payload.data || []).map((skill) => skill.skillId);

    const toAttach = nextSkillIds.filter((id) => !currentIds.includes(id));
    const toDetach = currentIds.filter((id) => !nextSkillIds.includes(id));

    await Promise.all([
      ...toAttach.map((skillId) => fetch(`/api/v1/personas/${personaId}/skills`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ skillId }),
      })),
      ...toDetach.map((skillId) => fetch(`/api/v1/personas/${personaId}/skills/${skillId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      })),
    ]);
  };

  const handleCreatePersona = async (data) => {
    try {
      const response = await fetch('/api/v1/personas', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const created = await response.json();
        await syncPersonaDocuments(created?.data?.id, data.attachedDocuments || []);
        await syncPersonaSkills(created?.data?.id, data.attachedSkills || []);
        setShowCreateModal(false);
        await fetchPersonas();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create persona');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEditPersona = async (data) => {
    if (!editingPersona) return;

    try {
      const response = await fetch(`/api/v1/personas/${editingPersona.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        await syncPersonaDocuments(editingPersona.id, data.attachedDocuments || []);
        await syncPersonaSkills(editingPersona.id, data.attachedSkills || []);
        setEditingPersona(null);
        await fetchPersonas();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update persona');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSetActive = async (personaId) => {
    try {
      const response = await fetch(`/api/v1/personas/${personaId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ active: true }),
      });

      if (response.ok) {
        await fetchPersonas();
        setSelectedPersona(null);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeletePersona = async (personaId) => {
    if (!confirm('Are you sure? This cannot be undone.')) return;

    try {
      const response = await fetch(`/api/v1/personas/${personaId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        await fetchPersonas();
        setSelectedPersona(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete persona');
      }
    } catch (err) {
      setError(err.message);
    }
  };



  const filteredPersonas = useMemo(() => {
    let list = [...personas];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.soul_content || '').toLowerCase().includes(q)
      );
    }

    if (statusFilter === 'active') list = list.filter((p) => p.active);
    if (statusFilter === 'inactive') list = list.filter((p) => !p.active);

    const [key, dir] = sortBy.split('_');
    list.sort((a, b) => {
      let av;
      let bv;
      if (key === 'name') {
        av = (a.name || '').toLowerCase();
        bv = (b.name || '').toLowerCase();
      } else {
        av = new Date(a.updated_at || a.created_at).getTime();
        bv = new Date(b.updated_at || b.created_at).getTime();
      }
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [personas, searchQuery, statusFilter, sortBy]);
  return (
    <div className="min-h-screen bg-slate-900 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">AI Personas</h1>
          <p className="text-slate-400">
            Switch between different AI personalities for different tasks and conversations
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-4">
            <p className="text-red-200">{error}</p>
            <button
              onClick={() => setError('')}
              className="text-sm text-red-300 hover:text-red-200 mt-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Create button */}
        <div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="ui-button-primary px-6 py-3"
          >
            Create New Persona
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search personas..."
            className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="updated_desc">Recently updated</option>
            <option value="updated_asc">Oldest updated</option>
            <option value="name_asc">Name A-Z</option>
            <option value="name_desc">Name Z-A</option>
          </select>
        </div>

        {/* Personas Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-slate-400">Loading personas...</p>
          </div>
        ) : filteredPersonas.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400">No personas yet. Create one to get started!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPersonas.map((persona) => (
              <div
                key={persona.id}
                onClick={() => handleSelectPersona(persona)}
                className="bg-slate-800/90 border border-slate-700 rounded-lg p-5 hover:border-blue-500/70 hover:bg-slate-800 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-blue-900/20"
              >
                {/* Header */}
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-white truncate">{persona.name}</h3>
                  <span
                    className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-medium border ${
                      persona.active
                        ? 'bg-slate-700 text-slate-200 border-slate-600'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {persona.active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Description */}
                <p className="text-slate-400 text-sm mb-3 line-clamp-2">
                  {persona.description || 'No description yet.'}
                </p>

                {/* Preview of soul content */}
                <div className="bg-slate-900/80 rounded border border-slate-700/50 p-3 mb-3 text-xs text-slate-300 max-h-24 overflow-hidden">
                  <pre className="whitespace-pre-wrap break-words font-mono text-slate-400">
                    {(persona.soul_content || 'No SOUL.md content yet.').substring(0, 180)}
                    {(persona.soul_content || '').length > 180 ? '…' : ''}
                  </pre>
                </div>

                {/* Meta info */}
                <p className="text-xs text-slate-500">
                  Updated {new Date(persona.updated_at || persona.created_at).toLocaleDateString()}
                </p>

                {/* Click hint */}
                <p className="text-xs text-blue-400 mt-2 font-medium">Click to view full details →</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedPersona && (
        <PersonaDetailModal
          persona={selectedPersona}
          onClose={() => setSelectedPersona(null)}
          onEdit={async () => {
            try {
              const [docRes, skillRes] = await Promise.all([
                fetch(`/api/v1/personas/${selectedPersona.id}/documents`, {
                  headers: { 'Authorization': `Bearer ${token}` },
                }),
                fetch(`/api/v1/personas/${selectedPersona.id}/skills`, {
                  headers: { 'Authorization': `Bearer ${token}` },
                }),
              ]);

              const docsData = docRes.ok ? await docRes.json() : { data: [] };
              const skillsData = skillRes.ok ? await skillRes.json() : { data: [] };

              setEditingPersona({
                ...selectedPersona,
                attachedDocuments: (docsData.data || []).map((doc) => doc.documentId),
                attachedSkills: (skillsData.data || []).map((skill) => skill.skillId),
              });
            } catch {
              setEditingPersona(selectedPersona);
            }
            setSelectedPersona(null);
          }}
          onSetActive={() => handleSetActive(selectedPersona.id)}
          onDelete={() => handleDeletePersona(selectedPersona.id)}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-4xl w-full max-h-[95vh] overflow-y-auto p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Create New Persona</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-300 text-2xl"
              >
                ✕
              </button>
            </div>

            <EnhancedPersonaBuilder
              onSave={handleCreatePersona}
              isLoading={isLoading}
            />

            <div className="mt-4">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingPersona && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-4xl w-full max-h-[95vh] overflow-y-auto p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Edit Persona: {editingPersona.name}</h2>
              <button
                onClick={() => setEditingPersona(null)}
                className="text-slate-400 hover:text-slate-300 text-2xl"
              >
                ✕
              </button>
            </div>

            <EnhancedPersonaBuilder
              initialData={{
                ...(editingPersona.template_data || {}),
                name: editingPersona.name,
                attachedDocuments: editingPersona.attachedDocuments || [],
                attachedSkills: editingPersona.attachedSkills || [],
              }}
              onSave={handleEditPersona}
              isLoading={isLoading}
            />

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setEditingPersona(null)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Personas;
