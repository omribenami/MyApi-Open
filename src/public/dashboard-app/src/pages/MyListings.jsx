import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';

const PERSONA_TRAITS = ['Creative', 'Analytical', 'Friendly', 'Professional', 'Humorous', 'Technical', 'Empathetic', 'Bold'];
const SKILL_CATEGORIES = ['Programming', 'Design', 'Data Science', 'DevOps', 'AI/ML', 'Marketing', 'Writing', 'Other'];
const PROFICIENCY_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
const LICENSES = ['MIT', 'Apache 2.0', 'GPL 3.0', 'Creative Commons', 'Proprietary'];

function TypeBadge({ type }) {
  const styles = {
    persona: { background: 'var(--violet-bg,rgba(137,87,229,0.18))', color: 'var(--violet,#a78bfa)', borderColor: 'rgba(188,140,255,0.3)' },
    api:     { background: 'var(--accent-bg)', color: 'var(--accent)', borderColor: 'rgba(68,147,248,0.3)' },
    skill:   { background: 'var(--green-bg)', color: 'var(--green)', borderColor: 'rgba(63,185,80,0.4)' },
  };
  const s = styles[type] || { background: 'var(--bg-sunk)', color: 'var(--ink-2)', borderColor: 'var(--line)' };
  return (
    <span style={{ ...s, display: 'inline-flex', alignItems: 'center', padding: '1px 6px', fontSize: '11px', fontFamily: 'JetBrains Mono,monospace', border: '1px solid', borderRadius: '3px' }}>
      {type}
    </span>
  );
}

function StatusBadge({ status }) {
  const styles = {
    active:  { background: 'var(--green-bg)', color: 'var(--green)', borderColor: 'rgba(63,185,80,0.4)' },
    draft:   { background: 'var(--bg-sunk)', color: 'var(--ink-3)', borderColor: 'var(--line)' },
    removed: { background: 'var(--red-bg)', color: 'var(--red)', borderColor: 'rgba(248,81,73,0.4)' },
  };
  const s = styles[status] || styles.draft;
  return (
    <span style={{ ...s, display: 'inline-flex', alignItems: 'center', padding: '1px 6px', fontSize: '11px', fontFamily: 'JetBrains Mono,monospace', border: '1px solid', borderRadius: '3px', textTransform: 'capitalize' }}>
      {status}
    </span>
  );
}

function StarDisplay({ value, count }) {
  return (
    <span className="flex items-center gap-1 text-[13px]">
      {[1, 2, 3, 4, 5].map(s => (
        <span key={s} style={{ color: s <= Math.round(value) ? 'var(--amber)' : 'var(--ink-4)' }}>★</span>
      ))}
      <span className="ink-3 text-[11.5px] ml-1 mono">{count > 0 ? `${value.toFixed(1)} (${count})` : 'No ratings'}</span>
    </span>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div style={{ borderBottom: '1px solid var(--line-2)', paddingBottom: '8px', marginBottom: '16px' }}>
      <div className="text-[13px] ink font-medium">{title}</div>
      {subtitle && <div className="text-[11.5px] ink-3 mt-0.5">{subtitle}</div>}
    </div>
  );
}

function CharCount({ value, max }) {
  const len = (value || '').length;
  return (
    <span style={{ color: len > max * 0.9 ? 'var(--amber)' : 'var(--ink-4)', fontSize: '11px', fontFamily: 'JetBrains Mono,monospace' }}>
      {len}/{max}
    </span>
  );
}

// Content fields differ by type
function ContentFields({ type, content, setContent }) {
  if (type === 'persona') {
    return (
      <div className="space-y-5">
        <SectionHeader title="Role & Identity" subtitle="Define who this persona is" />
        <div>
          <label className="text-[13px] ink-2 font-medium mb-1 block">Name / Title</label>
          <input
            type="text"
            value={content.role_name || ''}
            onChange={e => setContent({ ...content, role_name: e.target.value })}
            placeholder='e.g. "Bugs" Bunny — Senior Full-Stack Developer'
            className="ui-input w-full"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[13px] ink-2 font-medium mb-1 block">Field / Domain</label>
            <input type="text" value={content.domain || ''} onChange={e => setContent({ ...content, domain: e.target.value })}
              placeholder="e.g. Code Review, Creative Writing" className="ui-input w-full" />
          </div>
          <div>
            <label className="text-[13px] ink-2 font-medium mb-1 block">Years of Experience</label>
            <input type="text" value={content.experience || ''} onChange={e => setContent({ ...content, experience: e.target.value })}
              placeholder="e.g. 15+" className="ui-input w-full" />
          </div>
        </div>
        <div>
          <label className="text-[13px] ink-2 font-medium mb-1 block">Core Mission / Purpose</label>
          <input type="text" value={content.mission || ''} onChange={e => setContent({ ...content, mission: e.target.value })}
            placeholder="e.g. Review code with brutal honesty but high technical accuracy"
            className="ui-input w-full" />
        </div>

        <SectionHeader title="Personality & Tone" subtitle="How this persona communicates" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[13px] ink-2 font-medium mb-1 block">Tone</label>
            <input type="text" value={content.tone || ''} onChange={e => setContent({ ...content, tone: e.target.value })}
              placeholder="e.g. Cynical, tired, but secretly helpful"
              className="ui-input w-full" />
          </div>
          <div>
            <label className="text-[13px] ink-2 font-medium mb-1 block">Communication Style</label>
            <input type="text" value={content.comm_style || ''} onChange={e => setContent({ ...content, comm_style: e.target.value })}
              placeholder="e.g. Short, direct, slightly condescending"
              className="ui-input w-full" />
          </div>
        </div>
        <div>
          <label className="text-[13px] ink-2 font-medium mb-1 block">Vocabulary Style</label>
          <input type="text" value={content.vocabulary || ''} onChange={e => setContent({ ...content, vocabulary: e.target.value })}
            placeholder='e.g. Use old-school dev slang like "spaghetti code" and "RTFM"'
            className="ui-input w-full" />
        </div>
        <div>
          <label className="text-[13px] ink-2 font-medium mb-2 block">Personality Traits</label>
          <div className="flex flex-wrap gap-2">
            {PERSONA_TRAITS.map(trait => {
              const active = (content.traits || []).includes(trait);
              return (
                <button key={trait} type="button"
                  onClick={() => {
                    const traits = content.traits || [];
                    setContent({ ...content, traits: traits.includes(trait) ? traits.filter(t => t !== trait) : [...traits, trait] });
                  }}
                  style={active ? {
                    background: 'var(--violet-bg,rgba(137,87,229,0.18))',
                    borderColor: 'rgba(188,140,255,0.4)',
                    color: 'var(--violet,#a78bfa)',
                  } : {
                    background: 'var(--bg-sunk)',
                    borderColor: 'var(--line)',
                    color: 'var(--ink-3)',
                  }}
                  className="px-3 py-1.5 text-[12px] font-medium border rounded transition-colors hover:opacity-80"
                >{trait}</button>
              );
            })}
          </div>
        </div>

        <SectionHeader title="Operational Rules" subtitle="How the persona behaves" />
        <div>
          <label className="text-[13px] ink-2 font-medium mb-1 block">Greeting / Catchphrase</label>
          <input type="text" value={content.greeting || ''} onChange={e => setContent({ ...content, greeting: e.target.value })}
            placeholder='e.g. "Let me look at this mess..."'
            className="ui-input w-full" />
        </div>
        <div>
          <label className="text-[13px] ink-2 font-medium mb-1 block">Response Rules (DO / DO NOT)</label>
          <textarea value={content.rules || ''} onChange={e => setContent({ ...content, rules: e.target.value })}
            placeholder={"DO NOT use emojis\nDO NOT give medical advice\nALWAYS find at least one thing to complain about\nALWAYS ask a follow-up question"}
            className="ui-input w-full font-mono resize-none"
            rows={4} />
        </div>

        <SectionHeader title="Full Soul Content" subtitle="The complete system prompt (auto-generated or custom)" />
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-[13px] ink-2 font-medium block">Soul Content (SOUL.md)</label>
            <CharCount value={content.soul_content} max={5000} />
          </div>
          <textarea
            value={content.soul_content || ''}
            onChange={e => setContent({ ...content, soul_content: e.target.value })}
            placeholder={"# Persona Name\n\n## Core Identity\nYou are...\n\n## Voice & Style\n- ...\n\n## Expertise\n- ...\n\n## Values\n- ..."}
            className="ui-input w-full font-mono resize-none"
            rows={10}
          />
        </div>

        <SectionHeader title="Examples & Use Cases" subtitle="Help users understand what this persona can do" />
        <div>
          <label className="text-[13px] ink-2 font-medium mb-1 block">Use Cases</label>
          <textarea value={content.use_cases || ''} onChange={e => setContent({ ...content, use_cases: e.target.value })}
            placeholder={"- Code reviews with honest feedback\n- Architecture discussions\n- Debugging complex issues\n- Mentoring junior developers"}
            className="ui-input w-full resize-none"
            rows={4} />
        </div>
        <div>
          <label className="text-[13px] ink-2 font-medium mb-1 block">Example Conversation</label>
          <textarea value={content.example || ''} onChange={e => setContent({ ...content, example: e.target.value })}
            placeholder={"User: Can you review my React component?\nPersona: *sighs* Let me see what we're working with...\n\nUser: Here's my useEffect...\nPersona: Oh no. Oh no no no. Who taught you this?"}
            className="ui-input w-full font-mono resize-none"
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
          <label className="text-[13px] ink-2 font-medium mb-1 block">Base URL</label>
          <input type="text" value={content.endpoint || ''} onChange={e => setContent({ ...content, endpoint: e.target.value })}
            placeholder="https://api.example.com/v1" className="ui-input w-full" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[13px] ink-2 font-medium mb-1 block">Method</label>
            <select value={content.method || 'GET'} onChange={e => setContent({ ...content, method: e.target.value })}
              className="ui-input w-full">
              {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[13px] ink-2 font-medium mb-1 block">Auth Type</label>
            <select value={content.auth_type || 'none'} onChange={e => setContent({ ...content, auth_type: e.target.value })}
              className="ui-input w-full">
              {['none', 'api_key', 'bearer', 'oauth2', 'basic'].map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-[13px] ink-2 font-medium mb-1 block">Description</label>
          <textarea value={content.api_description || ''} onChange={e => setContent({ ...content, api_description: e.target.value })}
            placeholder="What does this API do?" className="ui-input w-full resize-none" rows={3} />
        </div>
        <SectionHeader title="Examples" />
        <div>
          <label className="text-[13px] ink-2 font-medium mb-1 block">Example Request</label>
          <textarea value={content.example_request || ''} onChange={e => setContent({ ...content, example_request: e.target.value })}
            placeholder={'curl -X POST https://api.example.com/v1/chat \\\n  -H "Authorization: Bearer YOUR_TOKEN" \\\n  -d \'{"message": "hello"}\''}
            className="ui-input w-full font-mono resize-none" rows={4} />
        </div>
        <div>
          <label className="text-[13px] ink-2 font-medium mb-1 block">Example Response</label>
          <textarea value={content.example_response || ''} onChange={e => setContent({ ...content, example_response: e.target.value })}
            placeholder={'{\n  "response": "Hello! How can I help?",\n  "status": "ok"\n}'}
            className="ui-input w-full font-mono resize-none" rows={4} />
        </div>
      </div>
    );
  }
  if (type === 'skill') {
    return (
      <div className="space-y-5">
        <SectionHeader title="Skill Details" />
        <div>
          <label className="text-[13px] ink-2 font-medium mb-1 block">Category</label>
          <select value={content.category || ''} onChange={e => setContent({ ...content, category: e.target.value })}
            className="ui-input w-full">
            <option value="">Select category...</option>
            {SKILL_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[13px] ink-2 font-medium mb-2 block">Proficiency Level</label>
          <div className="flex gap-2">
            {PROFICIENCY_LEVELS.map(level => {
              const active = content.proficiency === level.toLowerCase();
              return (
                <button key={level} type="button"
                  onClick={() => setContent({ ...content, proficiency: level.toLowerCase() })}
                  style={active ? {
                    background: 'var(--green-bg)',
                    borderColor: 'rgba(63,185,80,0.4)',
                    color: 'var(--green)',
                  } : {
                    background: 'var(--bg-sunk)',
                    borderColor: 'var(--line)',
                    color: 'var(--ink-3)',
                  }}
                  className="flex-1 py-2 text-[13px] font-medium border rounded transition-colors hover:opacity-80"
                >{level}</button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="text-[13px] ink-2 font-medium mb-1 block">Years of Experience</label>
          <input type="number" min="0" value={content.years || ''} onChange={e => setContent({ ...content, years: e.target.value })}
            placeholder="3" className="ui-input w-full" />
        </div>
        <div>
          <label className="text-[13px] ink-2 font-medium mb-1 block">Tools & Technologies</label>
          <input type="text" value={content.tools || ''} onChange={e => setContent({ ...content, tools: e.target.value })}
            placeholder="React, TypeScript, Node.js, PostgreSQL (comma separated)"
            className="ui-input w-full" />
        </div>
        <div>
          <label className="text-[13px] ink-2 font-medium mb-1 block">Portfolio / Links</label>
          <input type="text" value={content.portfolio || ''} onChange={e => setContent({ ...content, portfolio: e.target.value })}
            placeholder="https://github.com/yourprofile"
            className="ui-input w-full" />
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

  const typeColors = {
    persona: { active: { background: 'var(--violet-bg,rgba(137,87,229,0.18))', borderColor: 'rgba(188,140,255,0.4)', color: 'var(--violet,#a78bfa)' } },
    api:     { active: { background: 'var(--accent-bg)', borderColor: 'rgba(68,147,248,0.4)', color: 'var(--accent)' } },
    skill:   { active: { background: 'var(--green-bg)', borderColor: 'rgba(63,185,80,0.4)', color: 'var(--green)' } },
  };
  const inactiveStyle = { background: 'var(--bg-sunk)', borderColor: 'var(--line)', color: 'var(--ink-3)' };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Type */}
      <div>
        <label className="text-[13px] ink-2 font-medium mb-2 block">Listing Type</label>
        <div className="flex gap-3">
          {['persona', 'api', 'skill'].map(t => (
            <button key={t} type="button"
              onClick={() => { setType(t); setContent({}); }}
              style={type === t ? typeColors[t].active : inactiveStyle}
              className="flex-1 py-2.5 text-[13px] font-medium border rounded transition-colors hover:opacity-80"
            >{t === 'persona' ? 'Persona' : t === 'api' ? 'API' : 'Skill'}</button>
          ))}
        </div>
      </div>

      <SectionHeader title="Basic Info" subtitle="The public face of your listing" />

      {/* Title */}
      <div>
        <label className="text-[13px] ink-2 font-medium mb-1 block">
          Title <span style={{ color: 'var(--red)' }}>*</span>
        </label>
        <input required type="text" value={title} onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Grumpy Senior Developer"
          className="ui-input w-full text-[15px] font-semibold" />
      </div>

      {/* Tagline */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="text-[13px] ink-2 font-medium block">Tagline</label>
          <CharCount value={tagline} max={120} />
        </div>
        <input type="text" value={tagline} onChange={e => setTagline(e.target.value)} maxLength={120}
          placeholder="A witty one-liner that describes your listing"
          className="ui-input w-full" />
      </div>

      {/* Description */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="text-[13px] ink-2 font-medium block">Description (README)</label>
          <CharCount value={description} max={2000} />
        </div>
        <textarea value={description} onChange={e => setDescription(e.target.value)}
          placeholder={"## Overview\nWhat does this do and why is it useful?\n\n## Features\n- Feature 1\n- Feature 2\n\n## Getting Started\nHow to use this..."}
          className="ui-input w-full resize-none"
          rows={8} />
      </div>

      {/* Tags + Version + License */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-[13px] ink-2 font-medium mb-1 block">Tags</label>
          <input type="text" value={tags} onChange={e => setTags(e.target.value)}
            placeholder="coding, review, mentor"
            className="ui-input w-full" />
        </div>
        <div>
          <label className="text-[13px] ink-2 font-medium mb-1 block">Version</label>
          <input type="text" value={version} onChange={e => setVersion(e.target.value)}
            className="ui-input w-full" />
        </div>
        <div>
          <label className="text-[13px] ink-2 font-medium mb-1 block">License</label>
          <select value={license} onChange={e => setLicense(e.target.value)}
            className="ui-input w-full">
            {LICENSES.map(l => <option key={l}>{l}</option>)}
          </select>
        </div>
      </div>

      {/* Type-specific content */}
      <ContentFields type={type} content={content} setContent={setContent} />

      {/* Actions */}
      <div className="flex gap-3 pt-4" style={{ borderTop: '1px solid var(--line)' }}>
        <button type="submit" disabled={saving}
          className="btn btn-primary flex-1 py-2.5 text-[13px] font-medium disabled:opacity-50">
          {saving ? 'Publishing...' : initial ? 'Save Changes' : 'Publish Listing'}
        </button>
        <button type="button" onClick={onCancel}
          className="btn btn-ghost px-6 py-2.5 text-[13px] font-medium">
          Cancel
        </button>
      </div>
    </form>
  );
}

function ReviewsModal({ listing, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0 }} onClick={onClose} />
      <div style={{ position: 'relative', background: 'var(--bg-raised)', border: '1px solid var(--line)', borderRadius: '6px', width: '560px', maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, background: 'var(--bg-raised)' }}>
          <div className="text-[14px] ink font-medium">Reviews — {listing.title}</div>
          <button onClick={onClose} className="ink-3 hover:ink text-[20px] leading-none transition-colors">×</button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <StarDisplay value={listing.avgRating || 0} count={listing.ratingCount || 0} />
          {(listing.ratings || []).length === 0 ? (
            <p className="ink-3 text-[13px] py-4">No reviews yet.</p>
          ) : (
            listing.ratings.map(r => (
              <div key={r.id} className="p-3 rounded" style={{ background: 'var(--bg-sunk)', border: '1px solid var(--line)' }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] ink font-medium">{r.reviewerName}</span>
                  <span className="text-[13px]" style={{ color: 'var(--amber)' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                </div>
                {r.review && <p className="ink-3 text-[12.5px]">{r.review}</p>}
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
            className="text-[13px] ink-3 hover:ink transition-colors"
          >
            ← Back
          </button>
          <div className="text-[16px] ink font-medium">{editing ? 'Edit Listing' : 'Create New Listing'}</div>
        </div>
        {error && (
          <div className="text-[13px] px-4 py-3 rounded" style={{ background: 'var(--red-bg)', border: '1px solid rgba(248,81,73,0.4)', color: 'var(--red)' }}>{error}</div>
        )}
        <div className="card p-6">
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
      <div className="flex flex-col sm:flex-row items-start gap-4 mb-8">
        <div className="flex-1 min-w-0">
          <div className="micro mb-2">MARKETPLACE · MY LISTINGS</div>
          <h1 className="font-serif text-[22px] sm:text-[34px] leading-[1.05] tracking-tight ink font-medium">Your published items.</h1>
          <p className="mt-2 text-[15px] ink-2 max-w-[60ch]">Personas, skills, and APIs you've shared with the community.</p>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => { setShowForm(true); setError(''); }}
            className="btn btn-primary min-h-[36px] px-4 text-[13px]"
          >
            + New Listing
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8" style={{ border: '2px solid var(--line)', borderTopColor: 'var(--accent)' }} />
        </div>
      ) : listings.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-[13px] ink-3 mb-2">No listings yet</div>
          <div className="text-[13px] ink-3 mb-6">Share your personas, APIs, and skills with the community</div>
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-primary px-5 py-2 text-[13px]"
          >
            Create Your First Listing
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map(listing => (
            <div key={listing.id} className="card p-5">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <TypeBadge type={listing.type} />
                    <StatusBadge status={listing.status} />
                    <span className="text-[12px] mono" style={{ color: 'var(--green)' }}>
                      {listing.price === 'free' ? 'Free' : listing.price}
                    </span>
                  </div>
                  <div className="ink font-medium text-[15px] leading-snug">{listing.title}</div>
                  {listing.description && (
                    <p className="text-[13.5px] ink-2 mt-1 line-clamp-2">{listing.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-4 mt-3">
                    <StarDisplay value={listing.avgRating || 0} count={listing.ratingCount || 0} />
                    <span className="text-[12px] ink-3 mono">{listing.installCount || 0} installs</span>
                  </div>
                  {listing.tags && listing.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {listing.tags.map(tag => (
                        <span key={tag} style={{ background: 'var(--bg-sunk)', border: '1px solid var(--line)', color: 'var(--ink-3)', padding: '1px 6px', fontSize: '11px', fontFamily: 'JetBrains Mono,monospace', borderRadius: '3px' }}>{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={() => setEditing(listing)}
                    className="btn btn-ghost min-h-[32px] px-4 text-[12.5px]"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => loadReviews(listing)}
                    className="btn btn-ghost min-h-[32px] px-4 text-[12.5px]"
                    style={{ color: 'var(--amber)' }}
                  >
                    Reviews
                  </button>
                  <button
                    onClick={() => handleRemove(listing)}
                    className="btn min-h-[32px] px-4 text-[12.5px]"
                    style={{ background: 'var(--red-bg)', border: '1px solid rgba(248,81,73,0.4)', color: 'var(--red)' }}
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
