import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import PersonaDetailModal from '../components/PersonaDetailModal';
import EnhancedPersonaBuilder from '../components/EnhancedPersonaBuilder';
import PersonaCard from '../components/PersonaCard'; // kept per instructions

const TINTS = ['#4493f8','#3fb950','#bc8cff','#d29922','#f85149','#2ea043','#1f6feb','#8957e5'];
const getTint = (name) => TINTS[((name || '?').charCodeAt(0)) % TINTS.length];

function Personas() {
  const token = useAuthStore((state) => state.masterToken);
  const currentWorkspace = useAuthStore((state) => state.currentWorkspace);
  const [personas, setPersonas] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedPersona, setSelectedPersona] = useState(null);
  const [selectedPersonaCounts, setSelectedPersonaCounts] = useState({ docs: 0, skills: 0 });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPersona, setEditingPersona] = useState(null);
  const [, setLoadingDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter] = useState('all');
  const [sortBy] = useState('updated_desc');

  useEffect(() => {
    fetchPersonas();
  }, [token, currentWorkspace?.id]);

  const handleSelectPersona = async (persona) => {
    setLoadingDetail(true);
    try {
      const [detailRes, docRes, skillRes] = await Promise.all([
        fetch(`/api/v1/personas/${persona.id}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/v1/personas/${persona.id}/documents`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/v1/personas/${persona.id}/skills`, { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);
      if (detailRes.ok) {
        const data = await detailRes.json();
        setSelectedPersona(data.data);
      } else {
        setSelectedPersona(persona);
      }
      const docsData = docRes.ok ? await docRes.json() : { data: [] };
      const skillsData = skillRes.ok ? await skillRes.json() : { data: [] };
      setSelectedPersonaCounts({
        docs: (docsData.data || []).length,
        skills: (skillsData.data || []).length,
      });
    } catch (err) {
      console.error('Failed to fetch full persona:', err);
      setSelectedPersona(persona);
      setSelectedPersonaCounts({ docs: 0, skills: 0 });
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
        method: 'POST', headers, body: JSON.stringify({ documentId }),
      })),
      ...toDetach.map((docId) => fetch(`/api/v1/personas/${personaId}/documents/${docId}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` },
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
        method: 'POST', headers, body: JSON.stringify({ skillId }),
      })),
      ...toDetach.map((skillId) => fetch(`/api/v1/personas/${personaId}/skills/${skillId}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` },
      })),
    ]);
  };

  const handleCreatePersona = async (data) => {
    try {
      const response = await fetch('/api/v1/personas', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
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
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
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
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
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

  const openEditModal = async (persona) => {
    try {
      const [docRes, skillRes] = await Promise.all([
        fetch(`/api/v1/personas/${persona.id}/documents`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/v1/personas/${persona.id}/skills`, { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);
      const docsData = docRes.ok ? await docRes.json() : { data: [] };
      const skillsData = skillRes.ok ? await skillRes.json() : { data: [] };
      setEditingPersona({
        ...persona,
        attachedDocuments: (docsData.data || []).map((doc) => doc.documentId),
        attachedSkills: (skillsData.data || []).map((skill) => skill.skillId),
      });
    } catch {
      setEditingPersona(persona);
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
      let av, bv;
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

  const selTint = selectedPersona ? getTint(selectedPersona.name) : '#4493f8';

  const activeChipStyle = {
    background: 'var(--green-bg)',
    color: 'var(--green)',
    borderColor: 'rgba(63,185,80,0.4)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    padding: '1px 8px',
    fontSize: '11px',
    border: '1px solid',
    borderRadius: '3px',
  };

  return (
    <div className="space-y-8">
      {/* Section head */}
      <div className="flex flex-col sm:flex-row items-start gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <div className="micro mb-2">AI BRAIN · PERSONAS</div>
          <h1 className="font-serif text-[22px] sm:text-[34px] leading-[1.05] tracking-tight ink font-medium">One brain, many voices.</h1>
          <p className="mt-2 text-[15px] ink-2 max-w-[60ch]">Each persona is a soul file plus the knowledge and skills attached to it. The active persona shapes every API response until you switch.</p>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>+ New persona</button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded p-4" style={{ background: 'var(--red-bg)', border: '1px solid var(--red)' }}>
          <p style={{ color: 'var(--red)' }}>{error}</p>
          <button onClick={() => setError('')} className="text-sm mt-2" style={{ color: 'var(--red)' }}>Dismiss</button>
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-[color:var(--line)] border-t-[color:var(--accent)] rounded-full animate-spin" />
        </div>
      ) : (
        /* 2-col grid */
        <div className="grid grid-cols-12 gap-6">
          {/* Left: persona list */}
          <div className="col-span-12 lg:col-span-4 space-y-2">
            <input
              className="ui-input mb-3 w-full"
              placeholder="Search personas…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {filteredPersonas.length === 0 ? (
              <div className="card p-6 text-center">
                <p className="ink-3 text-[13.5px]">No personas yet. Create one to get started.</p>
              </div>
            ) : (
              filteredPersonas.map((px) => {
                const isActive = px.active;
                const isSel = selectedPersona?.id === px.id;
                const tint = getTint(px.name);
                return (
                  <button
                    key={px.id}
                    onClick={() => handleSelectPersona(px)}
                    className="w-full card p-4 text-left transition hover:bg-sunk"
                    style={isSel ? { borderColor: 'var(--ink)' } : {}}
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div
                        className="w-9 h-9 border hairline bg-sunk grid place-items-center shrink-0"
                        style={{ borderRadius: '4px', color: tint }}
                      >
                        <span className="font-serif text-[17px]" style={{ color: tint }}>{px.name[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="ink text-[15px]">{px.name}</span>
                          {isActive && (
                            <span style={activeChipStyle}>
                              <span className="tick" style={{ background: 'var(--green)' }} /> active
                            </span>
                          )}
                        </div>
                        <div className="text-[11.5px] ink-3 mt-0.5 truncate">
                          {px.description ? `"${px.description.slice(0, 60)}…"` : px.name}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Right: detail panel */}
          <div className="col-span-12 lg:col-span-8">
            {selectedPersona ? (
              <div className="card">
                {/* Header */}
                <div className="p-6 border-b hairline">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 border hairline bg-sunk grid place-items-center shrink-0"
                      style={{ borderRadius: '4px', boxShadow: `inset 0 0 0 3px ${selTint}22` }}
                    >
                      <span className="font-serif text-[22px]" style={{ color: selTint }}>{selectedPersona.name[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-serif text-[26px] ink">{selectedPersona.name}</div>
                      <div className="text-[12px] ink-3 mono">persona/{selectedPersona.id}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedPersona.active
                        ? <span style={activeChipStyle}>active</span>
                        : <button className="btn btn-primary" onClick={() => handleSetActive(selectedPersona.id)}>Make active</button>
                      }
                      <button className="btn" onClick={() => openEditModal(selectedPersona)}>Edit</button>
                    </div>
                  </div>
                </div>

                {/* Body: 2-col */}
                <div className="grid grid-cols-12">
                  {/* SOUL.md preview */}
                  <div className="col-span-7 p-6 border-r hairline">
                    <div className="micro mb-2">SOUL.md</div>
                    {(selectedPersona.soul_content || selectedPersona.description) ? (
                      <pre className="mono text-[12.5px] ink-2 whitespace-pre-wrap leading-relaxed" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                        {selectedPersona.soul_content || selectedPersona.description}
                      </pre>
                    ) : (
                      <p className="text-[13px] ink-3 italic">No soul defined yet.</p>
                    )}
                  </div>

                  {/* Attached stats */}
                  <div className="col-span-5 p-6 space-y-5">
                    <div>
                      <div className="micro mb-2">ATTACHED KNOWLEDGE</div>
                      <div className="font-serif text-[22px] ink">{selectedPersonaCounts.docs}</div>
                      <div className="text-[12.5px] ink-3">documents</div>
                    </div>
                    <div style={{ borderTop: '1px solid var(--line-2)', paddingTop: '16px' }}>
                      <div className="micro mb-2">SKILLS</div>
                      <div className="font-serif text-[22px] ink">{selectedPersonaCounts.skills}</div>
                      <div className="text-[12.5px] ink-3">active skill modules</div>
                    </div>
                    <div style={{ borderTop: '1px solid var(--line-2)', paddingTop: '16px' }}>
                      <div className="micro mb-1">CREATED</div>
                      <div className="text-[12.5px] ink-2">
                        {selectedPersona.created_at
                          ? new Date(selectedPersona.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                          : '—'}
                      </div>
                      <div className="mono text-[11px] ink-3 mt-1 truncate">id: {selectedPersona.id}</div>
                    </div>
                    <div style={{ borderTop: '1px solid var(--line-2)', paddingTop: '16px' }}>
                      <div className="flex gap-2 mt-2">
                        <button className="btn text-[12px]" onClick={() => openEditModal(selectedPersona)}>Edit persona</button>
                        <button className="btn btn-ghost text-[12px] accent" onClick={() => handleDeletePersona(selectedPersona.id)}>Delete</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card p-12 flex flex-col items-center justify-center text-center">
                <div className="stripes w-16 h-16 border hairline mb-4" />
                <div className="ink font-medium">Select a persona</div>
                <p className="ink-3 text-[13.5px] mt-1">Choose one from the list to view its soul file and settings.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="card max-w-4xl w-full max-h-[95vh] overflow-y-auto p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-serif text-[22px] ink">Create New Persona</h2>
              <button onClick={() => setShowCreateModal(false)} className="ink-3 text-2xl leading-none" style={{ lineHeight: 1 }}>✕</button>
            </div>
            <EnhancedPersonaBuilder onSave={handleCreatePersona} isLoading={isLoading} />
            <div className="mt-4">
              <button onClick={() => setShowCreateModal(false)} className="btn">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingPersona && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="card max-w-4xl w-full max-h-[95vh] overflow-y-auto p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-serif text-[22px] ink">Edit Persona: {editingPersona.name}</h2>
              <button onClick={() => setEditingPersona(null)} className="ink-3 text-2xl leading-none" style={{ lineHeight: 1 }}>✕</button>
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
              <button onClick={() => setEditingPersona(null)} className="btn">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Personas;
