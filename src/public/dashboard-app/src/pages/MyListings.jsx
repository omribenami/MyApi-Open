import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';

const TYPE_CONFIG = {
  persona: { label: 'Persona', color: 'bg-purple-900 bg-opacity-60 text-purple-300 border-purple-700' },
  api: { label: 'API', color: 'bg-blue-900 bg-opacity-60 text-blue-300 border-blue-700' },
  skill: { label: 'Skill', color: 'bg-green-900 bg-opacity-60 text-green-300 border-green-700' },
};

const STATUS_CONFIG = {
  active: 'bg-green-900 bg-opacity-50 text-green-300 border-green-700',
  draft: 'bg-slate-700 text-slate-300 border-slate-600',
  removed: 'bg-red-900 bg-opacity-50 text-red-300 border-red-700',
};

function TypeBadge({ type }) {
  const cfg = TYPE_CONFIG[type] || { label: type, color: 'bg-slate-800 text-slate-300 border-slate-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const cls = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cls} capitalize`}>
      {status}
    </span>
  );
}

function StarDisplay({ value, count }) {
  return (
    <span className="flex items-center gap-1 text-sm">
      {[1,2,3,4,5].map(s => (
        <span key={s} className={s <= Math.round(value) ? 'text-amber-400' : 'text-slate-600'}>★</span>
      ))}
      <span className="text-slate-400 text-xs ml-1">{count > 0 ? `${value.toFixed(1)} (${count})` : 'No ratings'}</span>
    </span>
  );
}

// Content fields differ by type
function ContentFields({ type, content, setContent }) {
  if (type === 'persona') {
    return (
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Soul / Personality</label>
        <textarea
          value={content.soul_content || ''}
          onChange={e => setContent({ ...content, soul_content: e.target.value })}
          placeholder="Describe the persona's personality, voice, and behavior..."
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 resize-none focus:outline-none focus:border-blue-500 text-sm"
          rows={5}
        />
      </div>
    );
  }
  if (type === 'api') {
    return (
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Endpoint URL</label>
          <input
            type="text"
            value={content.endpoint || ''}
            onChange={e => setContent({ ...content, endpoint: e.target.value })}
            placeholder="https://api.example.com/v1/endpoint"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Method</label>
            <select
              value={content.method || 'GET'}
              onChange={e => setContent({ ...content, method: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm"
            >
              {['GET','POST','PUT','PATCH','DELETE'].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Auth Type</label>
            <select
              value={content.auth_type || 'none'}
              onChange={e => setContent({ ...content, auth_type: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm"
            >
              {['none','api_key','bearer','oauth2','basic'].map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
          <textarea
            value={content.api_description || ''}
            onChange={e => setContent({ ...content, api_description: e.target.value })}
            placeholder="What does this API do?"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 resize-none focus:outline-none focus:border-blue-500 text-sm"
            rows={3}
          />
        </div>
      </div>
    );
  }
  if (type === 'skill') {
    return (
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Skill Name</label>
          <input
            type="text"
            value={content.skill_name || ''}
            onChange={e => setContent({ ...content, skill_name: e.target.value })}
            placeholder="e.g. React, Python, Machine Learning"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Proficiency</label>
            <select
              value={content.proficiency || 'intermediate'}
              onChange={e => setContent({ ...content, proficiency: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm"
            >
              {['beginner','intermediate','advanced','expert'].map(p => <option key={p} className="capitalize">{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Years of Experience</label>
            <input
              type="number"
              min="0"
              value={content.years || ''}
              onChange={e => setContent({ ...content, years: e.target.value })}
              placeholder="3"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Portfolio / Links</label>
          <input
            type="text"
            value={content.portfolio || ''}
            onChange={e => setContent({ ...content, portfolio: e.target.value })}
            placeholder="https://github.com/yourprofile"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
          />
        </div>
      </div>
    );
  }
  return null;
}

function ListingForm({ initial, onSave, onCancel, saving }) {
  const [type, setType] = useState(initial?.type || 'persona');
  const [title, setTitle] = useState(initial?.title || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [tags, setTags] = useState(
    initial?.tags ? (Array.isArray(initial.tags) ? initial.tags.join(', ') : initial.tags) : ''
  );
  const [content, setContent] = useState(
    initial?.content && typeof initial.content === 'object' ? initial.content : {}
  );

  function handleSubmit(e) {
    e.preventDefault();
    onSave({ type, title, description, tags, content: JSON.stringify(content) });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Type */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Type</label>
        <div className="flex gap-3">
          {['persona', 'api', 'skill'].map(t => (
            <button
              key={t}
              type="button"
              onClick={() => { setType(t); setContent({}); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors capitalize ${
                type === t
                  ? t === 'persona' ? 'bg-purple-700 border-purple-500 text-white'
                    : t === 'api' ? 'bg-blue-700 border-blue-500 text-white'
                    : 'bg-green-700 border-green-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              {t === 'persona' ? 'Persona' : t === 'api' ? 'API' : 'Skill'}
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Title <span className="text-red-400">*</span></label>
        <input
          required
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Give your listing a clear title"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What makes this listing useful or unique?"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 resize-none focus:outline-none focus:border-blue-500 text-sm"
          rows={3}
        />
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Tags</label>
        <input
          type="text"
          value={tags}
          onChange={e => setTags(e.target.value)}
          placeholder="e.g. assistant, creative, gpt (comma-separated)"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
        />
      </div>

      {/* Type-specific content */}
      <ContentFields type={type} content={content} setContent={setContent} />

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-all text-sm"
        >
          {saving ? 'Saving...' : initial ? 'Save Changes' : 'Publish Listing'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-medium rounded-lg transition-colors text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function ReviewsModal({ listing, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black bg-opacity-70" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-5 py-4 flex items-center justify-between">
          <h2 className="font-bold text-white">Reviews — {listing.title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <StarDisplay value={listing.avgRating || 0} count={listing.ratingCount || 0} />
          {(listing.ratings || []).length === 0 ? (
            <p className="text-slate-500 text-sm py-4">No reviews yet.</p>
          ) : (
            listing.ratings.map(r => (
              <div key={r.id} className="bg-slate-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-slate-200">{r.reviewerName}</span>
                  <span className="text-amber-400 text-sm">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                </div>
                {r.review && <p className="text-slate-400 text-sm">{r.review}</p>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function MyListings() {
  const masterToken = useAuthStore(s => s.masterToken);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [error, setError] = useState('');

  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${masterToken}` };

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/marketplace-my', { headers: { 'Authorization': `Bearer ${masterToken}` } });
      if (res.ok) {
        const data = await res.json();
        setListings(data.listings || []);
      }
    } catch {}
    finally { setLoading(false); }
  }, [masterToken]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  async function handleCreate(formData) {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/v1/marketplace', {
        method: 'POST',
        headers,
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowForm(false);
        fetchListings();
      } else {
        const d = await res.json();
        setError(d.error || 'Failed to create');
      }
    } finally { setSaving(false); }
  }

  async function handleEdit(formData) {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/marketplace/${editing.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setEditing(null);
        fetchListings();
      } else {
        const d = await res.json();
        setError(d.error || 'Failed to update');
      }
    } finally { setSaving(false); }
  }

  async function handleRemove(listing) {
    if (!window.confirm(`Remove "${listing.title}" from the marketplace?`)) return;
    const res = await fetch(`/api/v1/marketplace/${listing.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${masterToken}` },
    });
    if (res.ok) fetchListings();
  }

  async function loadReviews(listing) {
    try {
      const res = await fetch(`/api/v1/marketplace/${listing.id}`);
      if (res.ok) {
        const data = await res.json();
        setReviewTarget(data.listing);
      }
    } catch {}
  }

  if (showForm || editing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setShowForm(false); setEditing(null); setError(''); }}
            className="text-slate-400 hover:text-white transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-white">{editing ? 'Edit Listing' : 'Create New Listing'}</h1>
        </div>
        {error && (
          <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-3 text-red-300 text-sm">{error}</div>
        )}
        <div className="bg-white bg-opacity-5 border border-white border-opacity-10 rounded-xl p-6">
          <ListingForm
            initial={editing}
            onSave={editing ? handleEdit : handleCreate}
            onCancel={() => { setShowForm(false); setEditing(null); setError(''); }}
            saving={saving}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">My Listings</h1>
          <p className="text-slate-400 mt-1">Manage what you've published to the marketplace</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setError(''); }}
          className="min-h-[44px] px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-lg transition-all shadow-lg text-sm"
        >
          + New Listing
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-16 bg-white bg-opacity-5 border border-white border-opacity-10 rounded-xl">
          <p className="text-4xl mb-3">📦</p>
          <p className="text-lg font-medium text-slate-300">No listings yet</p>
          <p className="text-sm text-slate-500 mt-1 mb-5">Share your personas, APIs, and skills with the community</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors text-sm"
          >
            Create Your First Listing
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {listings.map(listing => (
            <div key={listing.id} className="bg-white bg-opacity-5 border border-white border-opacity-10 rounded-xl p-5">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <TypeBadge type={listing.type} />
                    <StatusBadge status={listing.status} />
                    <span className="text-green-400 text-xs">{listing.price === 'free' ? 'Free' : listing.price}</span>
                  </div>
                  <h3 className="font-semibold text-white text-lg leading-snug">{listing.title}</h3>
                  {listing.description && (
                    <p className="text-slate-400 text-sm mt-1 line-clamp-2">{listing.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-4 mt-3">
                    <StarDisplay value={listing.avgRating || 0} count={listing.ratingCount || 0} />
                    <span className="text-slate-500 text-sm">{listing.installCount || 0} installs</span>
                  </div>
                  {listing.tags && listing.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {listing.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-slate-800 text-slate-400 text-xs rounded-full">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex sm:flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={() => setEditing(listing)}
                    className="min-h-[36px] px-4 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => loadReviews(listing)}
                    className="min-h-[36px] px-4 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 text-sm font-medium rounded-lg transition-colors"
                  >
                    Reviews
                  </button>
                  <button
                    onClick={() => handleRemove(listing)}
                    className="min-h-[36px] px-4 py-1.5 bg-red-900 bg-opacity-30 hover:bg-opacity-50 border border-red-800 text-red-400 text-sm font-medium rounded-lg transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {reviewTarget && (
        <ReviewsModal listing={reviewTarget} onClose={() => setReviewTarget(null)} />
      )}
    </div>
  );
}
