import { useState } from 'react';
import { usePersonaStore } from '../stores/personaStore';

function CreatePersonaModal({ onSuccess }) {
  const { showCreateModal, closeCreateModal, setError } =
    usePersonaStore();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    vibe: '',
    emoji: '🤖',
    soul_content: '',
    traits: [],
  });

  const [traitsInput, setTraitsInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setLocalError] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleTraitsChange = (e) => {
    setTraitsInput(e.target.value);
  };

  const handleAddTrait = () => {
    if (traitsInput.trim()) {
      const traits = traitsInput.split(',').map((t) => t.trim());
      setFormData((prev) => ({
        ...prev,
        traits: [...prev.traits, ...traits.filter((t) => t && !prev.traits.includes(t))],
      }));
      setTraitsInput('');
    }
  };

  const handleRemoveTrait = (index) => {
    setFormData((prev) => ({
      ...prev,
      traits: prev.traits.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);

    if (!formData.name.trim()) {
      setLocalError('Persona name is required');
      return;
    }

    setSaving(true);

    try {
      const submitData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        vibe: formData.vibe.trim() || null,
        emoji: formData.emoji || '🤖',
        soul_content: formData.soul_content.trim() || null,
        traits: formData.traits,
      };

      const success = await onSuccess(submitData);

      if (success) {
        // Reset form
        setFormData({
          name: '',
          description: '',
          vibe: '',
          emoji: '🤖',
          soul_content: '',
          traits: [],
        });
        setTraitsInput('');
        closeCreateModal();
      }
    } catch (err) {
      console.error('Form submission error:', err);
      setLocalError(err.message || 'Failed to create persona');
    } finally {
      setSaving(false);
    }
  };

  if (!showCreateModal) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-slate-700 bg-slate-800">
          <h2 className="text-xl font-bold text-white">Create New Persona</h2>
          <button
            onClick={closeCreateModal}
            disabled={saving}
            className="text-slate-400 hover:text-white text-2xl leading-none disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error message */}
          {(error || setError) && (
            <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-3 text-red-200 text-sm">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Persona Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="e.g., Friendly Assistant"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={saving}
              required
            />
          </div>

          {/* Emoji */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Emoji
            </label>
            <input
              type="text"
              name="emoji"
              value={formData.emoji}
              onChange={handleInputChange}
              placeholder="🤖"
              maxLength={2}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={saving}
            />
          </div>

          {/* Vibe */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Vibe / Personality
            </label>
            <input
              type="text"
              name="vibe"
              value={formData.vibe}
              onChange={handleInputChange}
              placeholder="e.g., Friendly, helpful, witty"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={saving}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Brief description of this persona"
              rows={3}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              disabled={saving}
            />
          </div>

          {/* Traits */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Traits / Characteristics
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={traitsInput}
                onChange={handleTraitsChange}
                placeholder="Enter traits (comma-separated)"
                className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={saving}
              />
              <button
                type="button"
                onClick={handleAddTrait}
                disabled={saving || !traitsInput.trim()}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                Add
              </button>
            </div>
            {formData.traits.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.traits.map((trait, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-sm rounded-full"
                  >
                    {trait}
                    <button
                      type="button"
                      onClick={() => handleRemoveTrait(index)}
                      disabled={saving}
                      className="ml-1 text-blue-200 hover:text-white"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Soul Content */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Soul Content (YAML/Markdown)
            </label>
            <textarea
              name="soul_content"
              value={formData.soul_content}
              onChange={handleInputChange}
              placeholder="Paste your soul content here (YAML or Markdown format)"
              rows={6}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm"
              disabled={saving}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={closeCreateModal}
              disabled={saving}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors font-medium"
            >
              {saving ? 'Creating...' : 'Create Persona'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreatePersonaModal;
