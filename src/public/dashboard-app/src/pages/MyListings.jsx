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

const PERSONA_TRAITS = ['Creative', 'Analytical', 'Friendly', 'Professional', 'Humorous', 'Technical', 'Empathetic', 'Bold'];
const SKILL_CATEGORIES = ['Programming', 'Design', 'Data Science', 'DevOps', 'AI/ML', 'Marketing', 'Writing', 'Other'];
const PROFICIENCY_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
const LICENSES = ['MIT', 'Apache 2.0', 'GPL 3.0', 'Creative Commons', 'Proprietary'];

function SectionHeader({ title, subtitle }) {
  return (
    <div className="border-b border-slate-700 pb-2 mb-4">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function CharCount({ value, max }) {
  const len = (value || '').length;
  return <span className={`text-xs ${len > max ? 'text-red-400' : 'text-slate-500'}`}>{len}/{max}</span>;
}

// Content fields differ by type
function ContentFields({ type, content, setContent }) {
  if (type === 'persona') {
    return (
      <div className="space-y-5">
        <SectionHeader title="Role & Identity" subtitle="Define who this persona is" />
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Name / Title</label>
          <input
            type="text"
            value={content.role_name || ''}
            onChange={e => setContent({ ...content, role_name: e.target.value })}
            placeholder='e.g. "Bugs" Bunny — Senior Full-Stack Developer'
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Field / Domain</label>
            <input type="text" value={content.domain || ''} onChange={e => setContent({ ...content, domain: e.target.value })}
              placeholder="e.g. Code Review, Creative Writing" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Years of Experience</label>
            <input type="text" value={content.experience || ''} onChange={e => setContent({ ...content, experience: e.target.value })}
              placeholder="e.g. 15+" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Core Mission / Purpose</label>
          <input type="text" value={content.mission || ''} onChange={e => setContent({ ...content, mission: e.target.value })}
            placeholder="e.g. Review code with brutal honesty but high technical accuracy"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm" />
        </div>

        <SectionHeader title="Personality & Tone" subtitle="How this persona communicates" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Tone</label>
            <input type="text" value={content.tone || ''} onChange={e => setContent({ ...content, tone: e.target.value })}
              placeholder="e.g. Cynical, tired, but secretly helpful"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Communication Style</label>
            <input type="text" value={content.comm_style || ''} onChange={e => setContent({ ...content, comm_style: e.target.value })}
              placeholder="e.g. Short, direct, slightly condescending"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Vocabulary Style</label>
          <input type="text" value={content.vocabulary || ''} onChange={e => setContent({ ...content, vocabulary: e.target.value })}
            placeholder='e.g. Use old-school dev slang like "spaghetti code" and "RTFM"'
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Personality Traits</label>
          <div className="flex flex-wrap gap-2">
            {PERSONA_TRAITS.map(trait => (
              <button key={trait} type="button"
                onClick={() => {
                  const traits = content.traits || [];
                  setContent({ ...content, traits: traits.includes(trait) ? traits.filter(t => t !== trait) : [...traits, trait] });
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  (content.traits || []).includes(trait)
                    ? 'bg-purple-700 border-purple-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
                }`}
              >{trait}</button>
            ))}
          </div>
        </div>

        <SectionHeader title="Operational Rules" subtitle="How the persona behaves" />
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Greeting / Catchphrase</label>
          <input type="text" value={content.greeting || ''} onChange={e => setContent({ ...content, greeting: e.target.value })}
            placeholder='e.g. "Let me look at this mess..."'
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Response Rules (DO / DO NOT)</label>
          <textarea value={content.rules || ''} onChange={e => setContent({ ...content, rules: e.target.value })}
            placeholder={"DO NOT use emojis\nDO NOT give medical advice\nALWAYS find at least one thing to complain about\nALWAYS ask a follow-up question"}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 resize-none focus:outline-none focus:border-blue-500 text-sm font-mono"
            rows={4} />
        </div>

        <SectionHeader title="Full Soul Content" subtitle="The complete system prompt (auto-generated or custom)" />
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-medium text-slate-300">Soul Content (SOUL.md)</label>
            <CharCount value={content.soul_content} max={5000} />
          </div>
          <textarea
            value={content.soul_content || ''}
            onChange={e => setContent({ ...content, soul_content: e.target.value })}
            placeholder={"# Persona Name\n\n## Core Identity\nYou are...\n\n## Voice & Style\n- ...\n\n## Expertise\n- ...\n\n## Values\n- ..."}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 resize-none focus:outline-none focus:border-blue-500 text-sm font-mono"
            rows={10}
          />
        </div>

        <SectionHeader title="Examples & Use Cases" subtitle="Help users understand what this persona can do" />
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Use Cases</label>
          <textarea value={content.use_cases || ''} onChange={e => setContent({ ...content, use_cases: e.target.value })}
            placeholder={"- Code reviews with honest feedback\n- Architecture discussions\n- Debugging complex issues\n- Mentoring junior developers"}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 resize-none focus:outline-none focus:border-blue-500 text-sm"
            rows={4} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Example Conversation</label>
          <textarea value={content.example || ''} onChange={e => setContent({ ...content, example: e.target.value })}
            placeholder={"User: Can you review my React component?\nPersona: *sighs* Let me see what we're working with...\n\nUser: Here's my useEffect...\nPersona: Oh no. Oh no no no. Who taught you this?"}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 resize-none focus:outline-none focus:border-blue-500 text-sm font-mono"
            rows={5} />
        </div>
      </div>
    );
  }
  if (type === 'api') {
    return (
      <div className="space-y-5">
        <SectionHeader title="API Configuration" />
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Base URL</label>
          <input type="text" value={content.endpoint || ''} onChange={e => setContent({ ...content, endpoint: e.target.value })}
            placeholder="https://api.example.com/v1" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Method</label>
            <select value={content.method || 'GET'} onChange={e => setContent({ ...content, method: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm">
              {['GET','POST','PUT','PATCH','DELETE'].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Auth Type</label>
            <select value={content.auth_type || 'none'} onChange={e => setContent({ ...content, auth_type: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm">
              {['none','api_key','bearer','oauth2','basic'].map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
          <textarea value={content.api_description || ''} onChange={e => setContent({ ...content, api_description: e.target.value })}
            placeholder="What does this API do?" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 resize-none focus:outline-none focus:border-blue-500 text-sm" rows={3} />
        </div>
        <SectionHeader title="Examples" />
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Example Request</label>
          <textarea value={content.example_request || ''} onChange={e => setContent({ ...content, example_request: e.target.value })}
            placeholder={'curl -X POST https://api.example.com/v1/chat \\\n  -H "Authorization: Bearer YOUR_TOKEN" \\\n  -d \'{"message": "hello"}\''}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 resize-none focus:outline-none focus:border-blue-500 text-sm font-mono" rows={4} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Example Response</label>
          <textarea value={content.example_response || ''} onChange={e => setContent({ ...content, example_response: e.target.value })}
            placeholder={'{\n  "response": "Hello! How can I help?",\n  "status": "ok"\n}'}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 resize-none focus:outline-none focus:border-blue-500 text-sm font-mono" rows={4} />
        </div>
      </div>
    );
  }
  if (type === 'skill') {
    return (
      <div className="space-y-5">
        <SectionHeader title="Skill Details" />
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Category</label>
          <select value={content.category || ''} onChange={e => setContent({ ...content, category: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm">
            <option value="">Select category...</option>
            {SKILL_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Proficiency Level</label>
          <div className="flex gap-2">
            {PROFICIENCY_LEVELS.map(level => (
              <button key={level} type="button"
                onClick={() => setContent({ ...content, proficiency: level.toLowerCase() })}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  content.proficiency === level.toLowerCase()
                    ? 'bg-green-700 border-green-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
                }`}
              >{level}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Years of Experience</label>
          <input type="number" min="0" value={content.years || ''} onChange={e => setContent({ ...content, years: e.target.value })}
            placeholder="3" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Tools & Technologies</label>
          <input type="text" value={content.tools || ''} onChange={e => setContent({ ...content, tools: e.target.value })}
            placeholder="React, TypeScript, Node.js, PostgreSQL (comma separated)"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Portfolio / Links</label>
          <input type="text" value={content.portfolio || ''} onChange={e => setContent({ ...content, portfolio: e.target.value })}
            placeholder="https://github.com/yourprofile"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm" />
        </div>
      </div>
    );
  }
  return null;
}

function ListingForm({ initial, onSave, onCancel, saving }) {
  const [type, setType] = useState(initial?.type || 'persona');
  const [title, setTitle] = useState(initial?.title || '');
  const [tagline, setTagline] = useState(initial?.content?.tagline || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [tags, setTags] = useState(
    initial?.tags ? (Array.isArray(initial.tags) ? initial.tags.join(', ') : initial.tags) : ''
  );
  const [version, setVersion] = useState(initial?.content?.version || '1.0.0');
  const [license, setLicense] = useState(initial?.content?.license || 'MIT');
  const [content, setContent] = useState(
    initial?.content && typeof initial.content === 'object' ? initial.content : {}
  );

  function handleSubmit(e) {
    e.preventDefault();
    const fullContent = { ...content, tagline, version, license };
    onSave({ type, title, description, tags, content: JSON.stringify(fullContent) });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Type */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Listing Type</label>
        <div className="flex gap-3">
          {['persona', 'api', 'skill'].map(t => (
            <button key={t} type="button"
              onClick={() => { setType(t); setContent({}); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                type === t
                  ? t === 'persona' ? 'bg-purple-700 border-purple-500 text-white'
                    : t === 'api' ? 'bg-blue-700 border-blue-500 text-white'
                    : 'bg-green-700 border-green-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >{t === 'persona' ? '🤖 Persona' : t === 'api' ? '🔌 API' : '⚡ Skill'}</button>
          ))}
        </div>
      </div>

      <SectionHeader title="Basic Info" subtitle="The public face of your listing" />

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Title <span className="text-red-400">*</span></label>
        <input required type="text" value={title} onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Grumpy Senior Developer"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-lg font-semibold placeholder-slate-500 focus:outline-none focus:border-blue-500" />
      </div>

      {/* Tagline */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="block text-sm font-medium text-slate-300">Tagline</label>
          <CharCount value={tagline} max={120} />
        </div>
        <input type="text" value={tagline} onChange={e => setTagline(e.target.value)} maxLength={120}
          placeholder="A witty one-liner that describes your listing"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm" />
      </div>

      {/* Description */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="block text-sm font-medium text-slate-300">Description (README)</label>
          <CharCount value={description} max={2000} />
        </div>
        <textarea value={description} onChange={e => setDescription(e.target.value)}
          placeholder={"## Overview\nWhat does this do and why is it useful?\n\n## Features\n- Feature 1\n- Feature 2\n\n## Getting Started\nHow to use this..."}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 resize-none focus:outline-none focus:border-blue-500 text-sm"
          rows={8} />
      </div>

      {/* Tags + Version + License */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Tags</label>
          <input type="text" value={tags} onChange={e => setTags(e.target.value)}
            placeholder="coding, review, mentor"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Version</label>
          <input type="text" value={version} onChange={e => setVersion(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">License</label>
          <select value={license} onChange={e => setLicense(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm">
            {LICENSES.map(l => <option key={l}>{l}</option>)}
          </select>
        </div>
      </div>

      {/* Type-specific content */}
      <ContentFields type={type} content={content} setContent={setContent} />

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-slate-700">
        <button type="submit" disabled={saving}
          className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-all text-sm">
          {saving ? 'Publishing...' : initial ? 'Save Changes' : '🚀 Publish Listing'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-medium rounded-lg transition-colors text-sm">
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
  const currentWorkspace = useAuthStore(s => s.currentWorkspace);
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
    } catch { /* ignored */ }
    finally { setLoading(false); }
  }, [masterToken]);

  useEffect(() => { fetchListings(); }, [fetchListings, currentWorkspace?.id]);

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
    } catch { /* ignored */ }
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
