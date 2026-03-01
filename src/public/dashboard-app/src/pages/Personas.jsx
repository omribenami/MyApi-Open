import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { usePersonaStore } from '../stores/personaStore';
import CreatePersonaModal from '../components/CreatePersonaModal';
import EditPersonaModal from '../components/EditPersonaModal';
import PersonaDetailModal from '../components/PersonaDetailModal';
import SetActiveConfirmation from '../components/SetActiveConfirmation';
import DeletePersonaConfirmation from '../components/DeletePersonaConfirmation';

function Personas() {
  const masterToken = useAuthStore((state) => state.masterToken);
  const {
    personas,
    activePersonaId,
    isLoading,
    error,
    setPersonas,
    setActivePersonaId,
    setIsLoading,
    setError,
    clearError,
    openCreateModal,
    openEditModal,
    openDetailModal,
    openDeleteConfirmation,
    openSetActiveConfirmation,
  } = usePersonaStore();

  const navigate = useNavigate();
  const [fetchError, setFetchError] = useState(null);
  const [personaTokens, setPersonaTokens] = useState({}); // {personaId: {token, copied}}
  const [publishingId, setPublishingId] = useState(null);
  const [generatingTokenId, setGeneratingTokenId] = useState(null);

  useEffect(() => {
    if (masterToken) {
      fetchPersonas();
    }
  }, [masterToken]);

  const fetchPersonas = async () => {
    if (!masterToken) return;

    setIsLoading(true);
    setFetchError(null);
    try {
      const response = await fetch('/api/v1/personas', {
        headers: { 'Authorization': `Bearer ${masterToken}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch personas');
      }

      const data = await response.json();
      setPersonas(data.data || []);

      // Set active persona ID if available
      const active = data.data?.find((p) => p.active);
      if (active) {
        setActivePersonaId(active.id);
      }
    } catch (err) {
      console.error('Failed to fetch personas:', err);
      setFetchError('Failed to load personas');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePersona = async (formData) => {
    if (!masterToken) return;

    try {
      const response = await fetch('/api/v1/personas', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${masterToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create persona');
      }

      const data = await response.json();
      const newPersona = data.data;
      
      // Add to list and if it's the first one or should be active, set it as active
      const currentActive = personas.find((p) => p.active);
      if (!currentActive) {
        newPersona.active = true;
        setActivePersonaId(newPersona.id);
      }
      
      setPersonas([...personas, newPersona]);
      return true;
    } catch (err) {
      console.error('Persona creation error:', err);
      setError(err.message || 'Failed to create persona');
      throw err;
    }
  };

  const handleUpdatePersona = async (personaId, formData) => {
    if (!masterToken) return;

    try {
      const response = await fetch(`/api/v1/personas/${personaId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${masterToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update persona');
      }

      const data = await response.json();
      const updatedPersona = data.data;
      
      // Update in list
      setPersonas(personas.map((p) =>
        p.id === personaId ? updatedPersona : p
      ));
      
      // Update active if it was changed
      if (updatedPersona.active) {
        setActivePersonaId(personaId);
      }
      
      return true;
    } catch (err) {
      console.error('Persona update error:', err);
      setError(err.message || 'Failed to update persona');
      throw err;
    }
  };

  const handleDeletePersona = async (personaId) => {
    if (!masterToken) return;

    try {
      const response = await fetch(`/api/v1/personas/${personaId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${masterToken}` },
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete persona');
      }

      // Remove from list
      setPersonas(personas.filter((p) => p.id !== personaId));
      
      // If deleted persona was active, clear active
      if (activePersonaId === personaId) {
        setActivePersonaId(null);
        // Set first remaining persona as active
        const remaining = personas.filter((p) => p.id !== personaId);
        if (remaining.length > 0) {
          const newActive = remaining[0];
          await handleSetActive(newActive.id);
        }
      }
      
      return true;
    } catch (err) {
      console.error('Persona deletion error:', err);
      setError(err.message || 'Failed to delete persona');
      throw err;
    }
  };

  const handleSetActive = async (personaId) => {
    if (!masterToken) return;

    try {
      const response = await fetch(`/api/v1/personas/${personaId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${masterToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ active: true }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to set active persona');
      }

      const data = await response.json();
      const updatedPersona = data.data;
      
      // Update all personas - set all to inactive except the selected one
      setPersonas(personas.map((p) =>
        p.id === personaId
          ? { ...p, active: true }
          : { ...p, active: false }
      ));
      
      setActivePersonaId(personaId);
      return true;
    } catch (err) {
      console.error('Set active error:', err);
      setError(err.message || 'Failed to set active persona');
      throw err;
    }
  };

  const handlePublishToMarketplace = async (persona) => {
    setPublishingId(persona.id);
    try {
      const response = await fetch('/api/v1/marketplace', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${masterToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'persona',
          title: persona.name,
          description: persona.description || '',
          content: JSON.stringify({
            soul_content: persona.soul_content || '',
            traits: persona.traits || [],
          }),
          tags: (persona.traits || []).join(', '),
        }),
      });

      if (response.ok) {
        navigate('/my-listings');
      } else {
        const err = await response.json();
        setError(err.error || 'Failed to publish');
      }
    } catch (err) {
      setError('Failed to publish to marketplace');
    } finally {
      setPublishingId(null);
    }
  };

  const handleGenerateToken = async (persona) => {
    setGeneratingTokenId(persona.id);
    try {
      const response = await fetch('/api/v1/tokens', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${masterToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          label: `Persona: ${persona.name}`,
          scopes: ['personas', 'read', 'chat'],
          expiresInHours: null,
          allowedPersonas: [persona.id],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const token = data.data?.token || data.token;
        setPersonaTokens(prev => ({
          ...prev,
          [persona.id]: { token, copied: false },
        }));
      } else {
        const err = await response.json();
        setError(err.error || 'Failed to generate token');
      }
    } catch (err) {
      setError('Failed to generate token');
    } finally {
      setGeneratingTokenId(null);
    }
  };

  const handleCopyToken = async (personaId) => {
    const tokenData = personaTokens[personaId];
    if (!tokenData?.token) return;
    try {
      await navigator.clipboard.writeText(tokenData.token);
      setPersonaTokens(prev => ({
        ...prev,
        [personaId]: { ...prev[personaId], copied: true },
      }));
      setTimeout(() => {
        setPersonaTokens(prev => ({
          ...prev,
          [personaId]: { ...prev[personaId], copied: false },
        }));
      }, 2000);
    } catch {}
  };

  if (isLoading && personas.length === 0) {
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
          <h1 className="text-3xl font-bold text-white">AI Personas</h1>
          <p className="text-slate-400 mt-1">Create and manage your AI personas</p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 whitespace-nowrap"
        >
          <span>➕</span>
          Create Persona
        </button>
      </div>

      {/* Error messages */}
      {(error || fetchError) && (
        <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-4 text-red-200 flex items-start justify-between gap-4">
          <div>
            <p className="font-medium">Error</p>
            <p className="text-sm mt-1">{error || fetchError}</p>
          </div>
          <button
            onClick={clearError}
            className="text-red-200 hover:text-red-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Active persona selector */}
      {personas.length > 0 && (
        <div className="bg-slate-800 bg-opacity-50 border border-slate-700 rounded-lg p-4">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Current Active Persona
          </label>
          <select
            value={activePersonaId || ''}
            onChange={(e) => {
              const personaId = e.target.value;
              if (personaId) {
                openSetActiveConfirmation(personaId);
              }
            }}
            className="w-full max-w-xs px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select a persona...</option>
            {personas.map((persona) => (
              <option key={persona.id} value={persona.id}>
                {persona.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Personas grid */}
      {personas.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-4">🤖</p>
          <h2 className="text-2xl font-bold text-white mb-2">No Personas Yet</h2>
          <p className="text-slate-400 mb-6">
            Create your first AI persona to get started
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            <span>➕</span>
            Create Your First Persona
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {personas.map((persona) => (
            <div
              key={persona.id}
              className={`rounded-lg border p-6 transition-all duration-200 ${
                persona.active
                  ? 'bg-slate-800 border-green-500 shadow-lg shadow-green-500/20'
                  : 'bg-slate-800 border-slate-700 hover:border-slate-600'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3 flex-1">
                  <span className="text-3xl">{persona.emoji || '🤖'}</span>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white">
                      {persona.name}
                    </h3>
                    {persona.active && (
                      <span className="inline-block mt-1 px-2 py-1 bg-green-600 text-green-100 text-xs font-medium rounded">
                        ✓ Active
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Description */}
              {persona.description && (
                <p className="text-slate-300 text-sm mb-4 line-clamp-2">
                  {persona.description}
                </p>
              )}

              {/* Vibe */}
              {persona.vibe && (
                <p className="text-slate-400 text-xs mb-4">
                  <span className="text-slate-500">Vibe:</span> {persona.vibe}
                </p>
              )}

              {/* Traits/Tags */}
              {persona.traits && persona.traits.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {persona.traits.slice(0, 3).map((trait, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded"
                    >
                      {trait}
                    </span>
                  ))}
                  {persona.traits.length > 3 && (
                    <span className="px-2 py-1 bg-slate-700 text-slate-400 text-xs rounded">
                      +{persona.traits.length - 3}
                    </span>
                  )}
                </div>
              )}

              {/* Persona Token */}
              {personaTokens[persona.id] && (
                <div className="mb-4 p-3 bg-slate-900 rounded-lg border border-slate-700">
                  <p className="text-xs text-slate-400 mb-2">Persona Token — copy it now</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs text-green-300 font-mono break-all bg-slate-800 p-2 rounded">
                      {personaTokens[persona.id].token}
                    </code>
                    <button
                      onClick={() => handleCopyToken(persona.id)}
                      className="px-3 py-1.5 text-xs text-blue-400 hover:text-blue-300 bg-slate-700 rounded flex-shrink-0"
                    >
                      {personaTokens[persona.id].copied ? '✓ Copied!' : '📋 Copy'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    API: GET /api/v1/context • Scoped to this persona only
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-slate-700">
                <button
                  onClick={() => openDetailModal(persona)}
                  className="flex-1 px-3 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
                >
                  👁 Preview
                </button>
                <button
                  onClick={() => openEditModal(persona)}
                  className="flex-1 px-3 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={() => openDeleteConfirmation(persona.id)}
                  className="flex-1 px-3 py-2 text-sm font-medium text-red-400 hover:text-red-200 hover:bg-red-900 hover:bg-opacity-30 rounded transition-colors"
                >
                  🗑️ Delete
                </button>
              </div>

              {/* Publish & Token buttons */}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => handlePublishToMarketplace(persona)}
                  disabled={publishingId === persona.id}
                  className="flex-1 px-3 py-2 text-sm font-medium text-purple-400 hover:text-purple-200 hover:bg-purple-900 hover:bg-opacity-30 rounded transition-colors border border-transparent hover:border-purple-700 disabled:opacity-50"
                >
                  {publishingId === persona.id ? '⏳ Publishing...' : '🏪 Publish'}
                </button>
                <button
                  onClick={() => handleGenerateToken(persona)}
                  disabled={generatingTokenId === persona.id}
                  className="flex-1 px-3 py-2 text-sm font-medium text-amber-400 hover:text-amber-200 hover:bg-amber-900 hover:bg-opacity-30 rounded transition-colors border border-transparent hover:border-amber-700 disabled:opacity-50"
                >
                  {generatingTokenId === persona.id ? '⏳ Generating...' : '🔑 Get Token'}
                </button>
              </div>

              {/* Set Active Button */}
              {!persona.active && (
                <button
                  onClick={() => openSetActiveConfirmation(persona.id)}
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
      <CreatePersonaModal onSuccess={handleCreatePersona} />
      <EditPersonaModal onSuccess={handleUpdatePersona} />
      <PersonaDetailModal />
      <SetActiveConfirmation onConfirm={handleSetActive} />
      <DeletePersonaConfirmation onConfirm={handleDeletePersona} />
    </div>
  );
}

export default Personas;
