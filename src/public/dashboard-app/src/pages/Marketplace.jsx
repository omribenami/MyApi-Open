import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';

const TYPE_CONFIG = {
  persona: {
    label: 'Persona',
    style: { background: 'var(--violet-bg)', color: 'var(--violet)', border: '1px solid rgba(188,140,255,0.35)' },
  },
  api: {
    label: 'Token',
    style: { background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid rgba(68,147,248,0.35)' },
  },
  token: {
    label: 'Token',
    style: { background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid rgba(68,147,248,0.35)' },
  },
  skill: {
    label: 'Skill',
    style: { background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid rgba(63,185,80,0.35)' },
  },
};

function extractScanner(content) {
  // Defensive: handle undefined/null content
  if (!content) return null;

  let parsed;
  if (typeof content === 'string') {
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      console.warn('[extractScanner] failed to parse string content:', err.message);
      return null;
    }
  } else {
    parsed = content;
  }

  if (!parsed || typeof parsed !== 'object') return null;

  const scanner = parsed?.scanner || parsed?.config_json?.scanner;
  return scanner && typeof scanner === 'object' ? scanner : null;
}

function parseContent(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return typeof raw === 'object' ? raw : null;
}

// Resolve a display name — hide raw user IDs (usr_…)
function resolveOwnerName(listing, content) {
  const fromListing = listing?.ownerName;
  const fromContent = content?.owner_display_name;
  if (fromListing && !String(fromListing).startsWith('usr_')) return fromListing;
  return fromContent || fromListing || 'Unknown';
}

const SCOPE_LABELS = {
  basic: 'Basic Profile',
  professional: 'Professional Info',
  availability: 'Availability',
  personas: 'Personas',
  knowledge: 'Knowledge Base',
  chat: 'Chat',
  memory: 'Memory',
  'skills:read': 'Skills (Read)',
  'skills:write': 'Skills (Write)',
  'services:read': 'Services (Read)',
  'services:write': 'Services (Write)',
};

function scopeLabel(scope) {
  if (SCOPE_LABELS[scope]) return SCOPE_LABELS[scope];
  // per-service: services:google:read → Google (Read)
  const m = scope.match(/^services:([^:]+):(read|write|\*)$/);
  if (m) return `${m[1].charAt(0).toUpperCase() + m[1].slice(1)} (${m[2] === '*' ? 'All' : m[2].charAt(0).toUpperCase() + m[2].slice(1)})`;
  return scope;
}

function scopeStyle(scope) {
  if (scope === 'personas') return { background: 'var(--violet-bg)', color: 'var(--violet)' };
  if (scope === 'knowledge' || scope === 'chat' || scope === 'memory') return { background: 'var(--accent-bg)', color: 'var(--accent)' };
  if (scope === 'skills:read' || scope === 'skills:write') return { background: 'var(--green-bg)', color: 'var(--green)' };
  if (scope.startsWith('services:')) return { background: 'rgba(210,153,34,0.16)', color: 'var(--amber)' };
  return { background: 'var(--bg-hover)', color: 'var(--ink-2)' };
}

function ScopeBadges({ scopes, limit }) {
  if (!Array.isArray(scopes) || scopes.length === 0) return null;
  const shown = limit ? scopes.slice(0, limit) : scopes;
  const remaining = limit ? scopes.length - shown.length : 0;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map(s => (
        <span
          key={s}
          style={scopeStyle(s)}
          className="px-2 py-0.5 rounded text-[10px] font-medium"
        >
          {scopeLabel(s)}
        </span>
      ))}
      {remaining > 0 && (
        <span
          style={{ background: 'var(--bg-hover)', color: 'var(--ink-3)' }}
          className="px-2 py-0.5 rounded text-[10px] font-medium"
        >
          +{remaining} more
        </span>
      )}
    </div>
  );
}

function Collapsible({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: '6px', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ background: 'var(--bg-raised)' }}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors"
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-raised)'}
      >
        <span style={{ color: 'var(--ink-2)' }}>{title}</span>
        <svg
          className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ color: 'var(--ink-3)' }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div style={{ background: 'var(--bg-sunk)', color: 'var(--ink-2)' }} className="px-4 py-3 text-sm space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}

function StarRating({ value = 0, count = 0, size = 'sm' }) {
  const stars = [1, 2, 3, 4, 5];
  const sz = size === 'lg' ? 'text-xl' : 'text-sm';
  // Defensive: ensure value is a valid number
  const safeValue = Number.isFinite(value) ? value : 0;
  const safeCount = Number.isFinite(count) ? Math.max(0, count) : 0;

  return (
    <span className={`flex items-center gap-1 ${sz}`}>
      {stars.map(s => (
        <span key={s} style={{ color: s <= Math.round(safeValue) ? 'var(--amber)' : 'var(--ink-4)' }}>★</span>
      ))}
      {safeCount > 0 && <span style={{ color: 'var(--ink-3)' }} className="text-xs ml-1">{safeValue.toFixed(1)} ({safeCount})</span>}
      {safeCount === 0 && <span style={{ color: 'var(--ink-4)' }} className="text-xs ml-1">No ratings</span>}
    </span>
  );
}

function TypeBadge({ type = 'unknown' }) {
  // Defensive: handle missing or invalid type
  const safeType = String(type || 'unknown').toLowerCase();
  const cfg = TYPE_CONFIG[safeType] || {
    label: safeType,
    style: { background: 'var(--bg-hover)', color: 'var(--ink-2)', border: '1px solid var(--line)' },
  };
  return (
    <span
      style={{ ...cfg.style, borderRadius: '4px' }}
      className="inline-flex items-center px-2 py-0.5 text-xs font-semibold"
    >
      {cfg.label}
    </span>
  );
}

function RatingWidget({ listingId, onRated, masterToken }) {
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(0);
  const [review, setReview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!selected || !listingId || !masterToken) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/marketplace/${listingId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${masterToken}` },
        body: JSON.stringify({ rating: selected, review: review || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || (res.status === 401 ? 'Session expired. Please sign in again.' : 'Failed to submit rating'));
      }
      setDone(true);
      onRated && onRated(data);
    } catch (err) {
      setError(err.message || 'Failed to submit rating');
      console.error('[RatingWidget] submit error:', err);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) return <p style={{ color: 'var(--green)' }} className="text-sm">Thanks for your rating!</p>;

  return (
    <div className="space-y-3">
      <p style={{ color: 'var(--ink-2)' }} className="text-sm font-medium">Rate this listing</p>
      <div className="flex gap-1">
        {[1,2,3,4,5].map(s => (
          <button
            key={s}
            onMouseEnter={() => setHovered(s)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => setSelected(s)}
            style={{ color: s <= (hovered || selected) ? 'var(--amber)' : 'var(--ink-4)' }}
            className="text-2xl transition-transform hover:scale-110"
          >★</button>
        ))}
      </div>
      <textarea
        value={review}
        onChange={e => setReview(e.target.value)}
        placeholder="Leave a review (optional)"
        className="ui-input w-full px-3 py-2 text-sm resize-none"
        rows={2}
      />
      <button
        onClick={submit}
        disabled={!selected || submitting}
        className="btn btn-primary px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {submitting ? 'Submitting...' : 'Submit Rating'}
      </button>
      {error && <p style={{ color: 'var(--red)' }} className="text-sm">{error}</p>}
    </div>
  );
}

function ListingModal({ listing, onClose, onInstall, onRated, masterToken, initiallyInstalled = false }) {
  const listingId = listing?.id;
  const listingType = listing?.type;

  const [detail, setDetail] = useState(listing || {});
  const scanner = extractScanner(listing?.content) || extractScanner(detail?.content);
  const [installing, setInstalling] = useState(false);
  const [isInstalled, setIsInstalled] = useState(initiallyInstalled);
  const [installSuccess, setInstallSuccess] = useState(false);
  const [installError, setInstallError] = useState('');
  const [installInfo, setInstallInfo] = useState(null);

  useEffect(() => {
    setIsInstalled(initiallyInstalled);
    if (initiallyInstalled) setInstallSuccess(true);
  }, [initiallyInstalled]);

  useEffect(() => {
    let cancelled = false;

    async function checkInstalled() {
      if (!masterToken || !listingId || listingType !== 'skill') return;
      try {
        const res = await fetch('/api/v1/skills', {
          headers: { 'Authorization': `Bearer ${masterToken}` },
          credentials: 'include',
        });
        if (!res.ok) return;
        const payload = await res.json();
        const skillsData = Array.isArray(payload?.skills) ? payload.skills : (Array.isArray(payload?.data) ? payload.data : []);
        const exists = skillsData.some((s) => {
          const cfg = s?.config_json && typeof s.config_json === 'object' ? s.config_json : null;
          return String(cfg?.marketplace_listing_id || '') === String(listingId);
        });
        if (!cancelled) {
          setIsInstalled(exists);
          if (exists) setInstallSuccess(true);
        }
      } catch (err) {
        console.warn('[ListingModal] checkInstalled error:', err);
      }
    }

    checkInstalled();
    return () => { cancelled = true; };
  }, [listingId, listingType, masterToken]);

  async function handleInstall() {
    if (isInstalled || !listingId || !masterToken) return;
    setInstalling(true);
    setInstallError('');
    try {
      const installRes = await fetch(`/api/v1/marketplace/${listingId}/install`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${masterToken}` },
        credentials: 'include',
      });
      const installData = await installRes.json().catch(() => ({}));
      if (!installRes.ok) {
        throw new Error(installData?.error || (installRes.status === 401 ? 'Session expired. Please sign in again.' : 'Failed to install listing'));
      }

      const alreadyInstalled = !!(installData?.alreadyInstalled || installData?.already_installed);
      setInstallInfo(installData?.provisioned || null);
      setIsInstalled(true);
      setInstallSuccess(true);
      onInstall && onInstall({ listingId, type: listingType, alreadyInstalled });

      setDetail(d => ({
        ...d,
        installCount: Number.isFinite(installData?.installCount)
          ? installData.installCount
          : ((d?.installCount || 0) + (alreadyInstalled ? 0 : 1)),
      }));
    } catch (err) {
      setInstallError(err.message || 'Install failed');
      console.error('[ListingModal] handleInstall error:', err);
    } finally {
      setInstalling(false);
    }
  }

  async function refreshDetail() {
    if (!listingId) return;
    try {
      const res = await fetch(`/api/v1/marketplace/${listingId}`);
      if (res.ok) {
        const data = await res.json();
        const newListing = data?.listing;
        if (newListing && typeof newListing === 'object') {
          setDetail(newListing);
        }
      }
    } catch (err) {
      console.warn('[ListingModal] refreshDetail error:', err);
    }
  }

  // Safe detail reading with defaults
  const detailType = detail?.type || 'unknown';
  const isTokenType = detailType === 'api' || detailType === 'token';
  const detailContent = parseContent(detail?.content);
  const detailTitle = isTokenType
    ? (detailContent?.token_label || detail?.title || '(Untitled)')
    : (detail?.title || '(Untitled)');
  const detailOwnerName = resolveOwnerName(detail, detailContent);
  const detailAvgRating = detail?.avgRating || 0;
  const detailRatingCount = detail?.ratingCount || 0;
  const detailInstallCount = detail?.installCount || 0;
  const detailPrice = detail?.price || 'free';
  const detailDescription = isTokenType
    ? (detailContent?.token_description || detail?.description || '')
    : (detail?.description || 'No description provided.');
  const detailTags = Array.isArray(detail?.tags) ? detail.tags : [];
  const detailRatings = Array.isArray(detail?.ratings) ? detail.ratings : [];

  // Token-specific content fields
  const tokenScopes = isTokenType && Array.isArray(detailContent?.scopes) ? detailContent.scopes : [];
  const isBundle = isTokenType && !!(detailContent?.is_bundle);
  const tokenPersona = isTokenType ? detailContent?.persona : null;
  const allowedResources = isTokenType ? detailContent?.allowed_resources : null;
  const kbDocs = allowedResources?.knowledge_docs || allowedResources?.kb_docs || null;
  const allowedSkillIds = allowedResources?.skills || null;
  const tokenExpiresAt = isTokenType ? detailContent?.expires_at : null;
  const tokenRequiresApproval = isTokenType ? !!(detailContent?.requires_approval) : false;

  // Defensive: validate listing object (after hooks to comply with rules-of-hooks)
  if (!listing || typeof listing !== 'object') {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: 'rgba(1,4,9,0.80)' }} onClick={onClose} />
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        style={{ background: 'var(--bg-raised)', border: '1px solid var(--line)', borderRadius: '6px' }}
      >
        <div
          className="sticky top-0 px-6 py-4 flex items-start justify-between"
          style={{ background: 'var(--bg-raised)', borderBottom: '1px solid var(--line)' }}
        >
          <div className="flex items-center gap-3 flex-wrap">
            <TypeBadge type={detailType} />
            {isBundle && (
              <span
                style={{ color: 'var(--violet)', border: '1px solid rgba(188,140,255,0.35)', background: 'var(--violet-bg)', borderRadius: '4px' }}
                className="text-xs font-semibold px-2 py-0.5"
              >
                Bundle
              </span>
            )}
            <h2 style={{ color: 'var(--ink)' }} className="text-xl font-bold">{detailTitle}</h2>
          </div>
          <button
            onClick={onClose}
            style={{ color: 'var(--ink-3)' }}
            className="text-2xl leading-none ml-4 hover:opacity-80"
          >×</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 text-sm" style={{ color: 'var(--ink-3)' }}>
            <span>by <span style={{ color: 'var(--ink-2)' }}>{detailOwnerName}</span></span>
            <StarRating value={detailAvgRating} count={detailRatingCount} size="sm" />
            <span>{detailInstallCount} installs</span>
            <span style={{ color: 'var(--green)' }}>{detailPrice === 'free' ? 'Free' : detailPrice}</span>
            {isInstalled && (
              <span
                style={{ color: 'var(--green)', border: '1px solid rgba(63,185,80,0.35)', borderRadius: '4px' }}
                className="text-xs px-2 py-0.5"
              >
                Installed
              </span>
            )}
            {tokenRequiresApproval && (
              <span
                style={{ color: 'var(--amber)', border: '1px solid rgba(210,153,34,0.35)', borderRadius: '4px' }}
                className="text-xs px-2 py-0.5"
              >
                Requires Approval
              </span>
            )}
            {detailType === 'skill' && scanner && (
              <span
                style={scanner.safe_to_use
                  ? { background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid rgba(63,185,80,0.35)', borderRadius: '4px' }
                  : { background: 'rgba(210,153,34,0.16)', color: 'var(--amber)', border: '1px solid rgba(210,153,34,0.35)', borderRadius: '4px' }
                }
                className="inline-flex items-center px-2 py-0.5 text-xs"
                title="Skill scanner checks README/SKILL.md/package.json for risky patterns."
              >
                {scanner.safe_to_use ? 'Safe' : 'Review'} · score {scanner.score}
              </span>
            )}
            {tokenExpiresAt && (
              <span style={{ color: 'var(--ink-3)' }} className="text-xs">Expires: {new Date(tokenExpiresAt).toLocaleDateString()}</span>
            )}
          </div>

          {/* Tags (non-token) */}
          {!isTokenType && detailTags && detailTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {detailTags.map(tag => (
                <span
                  key={tag}
                  style={{ background: 'var(--bg-hover)', color: 'var(--ink-2)', border: '1px solid var(--line)', borderRadius: '4px' }}
                  className="px-2 py-0.5 text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Description */}
          {detailDescription && (
            <div>
              <h3 style={{ color: 'var(--ink-2)' }} className="text-sm font-semibold mb-2">Description</h3>
              <p style={{ color: 'var(--ink-3)' }} className="text-sm leading-relaxed">{detailDescription}</p>
            </div>
          )}

          {/* TOKEN-SPECIFIC SECTIONS */}
          {isTokenType && (
            <div className="space-y-3">
              {/* Access Scopes */}
              {tokenScopes.length > 0 && (
                <Collapsible title={`Access Scopes (${tokenScopes.length})`} defaultOpen={true}>
                  <ScopeBadges scopes={tokenScopes} />
                  <p style={{ color: 'var(--ink-4)' }} className="text-xs mt-1">
                    These scopes define what data this token can access on the owner's API.
                  </p>
                </Collapsible>
              )}

              {/* Persona */}
              {tokenPersona && (
                <Collapsible title={`Persona: ${tokenPersona.name || 'Unnamed'}`}>
                  {tokenPersona.description && (
                    <p style={{ color: 'var(--ink-2)' }} className="leading-relaxed">{tokenPersona.description}</p>
                  )}
                  {!tokenPersona.description && (
                    <p style={{ color: 'var(--ink-4)' }} className="italic">No description provided for this persona.</p>
                  )}
                </Collapsible>
              )}

              {/* Knowledge Base files */}
              {kbDocs && Array.isArray(kbDocs) && kbDocs.length > 0 && (
                <Collapsible title={`Knowledge Base (${kbDocs.length} file${kbDocs.length !== 1 ? 's' : ''})`}>
                  <ul className="space-y-1">
                    {kbDocs.map((doc, i) => (
                      <li key={doc.id || doc || i} className="flex items-center gap-2">
                        <svg style={{ color: 'var(--accent)' }} className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span style={{ color: 'var(--ink-2)' }} className="text-xs">{doc.title || doc.name || doc.id || doc}</span>
                      </li>
                    ))}
                  </ul>
                </Collapsible>
              )}

              {/* Skills */}
              {allowedSkillIds && Array.isArray(allowedSkillIds) && allowedSkillIds.length > 0 && (
                <Collapsible title={`Skills (${allowedSkillIds.length})`}>
                  <ul className="space-y-1">
                    {allowedSkillIds.map((skill, i) => (
                      <li key={skill.id || skill || i} className="flex items-center gap-2">
                        <svg style={{ color: 'var(--green)' }} className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                        </svg>
                        <span style={{ color: 'var(--ink-2)' }} className="text-xs">{skill.name || skill.id || skill}</span>
                      </li>
                    ))}
                  </ul>
                </Collapsible>
              )}
            </div>
          )}

          {/* NON-TOKEN CONTENT PREVIEW */}
          {!isTokenType && detailContent && (
            <div>
              <h3 style={{ color: 'var(--ink-2)' }} className="text-sm font-semibold mb-2">Details</h3>
              <div style={{ background: 'var(--bg-sunk)', border: '1px solid var(--line)', borderRadius: '6px' }} className="p-4 text-sm">
                {detailType === 'persona' && (
                  <p style={{ color: 'var(--ink-2)' }} className="whitespace-pre-wrap">{
                    typeof detailContent === 'object' ? (detailContent?.soul_content || JSON.stringify(detailContent, null, 2)) : String(detailContent)
                  }</p>
                )}
                {detailType === 'skill' && (
                  <div className="space-y-2" style={{ color: 'var(--ink-2)' }}>
                    {typeof detailContent === 'object' ? (
                      <>
                        {detailContent?.skill_name && <div><span style={{ color: 'var(--ink-4)' }}>Skill: </span>{detailContent.skill_name}</div>}
                        {detailContent?.proficiency && <div><span style={{ color: 'var(--ink-4)' }}>Level: </span>{detailContent.proficiency}</div>}
                        {detailContent?.years && <div><span style={{ color: 'var(--ink-4)' }}>Experience: </span>{detailContent.years} years</div>}
                        {detailContent?.portfolio && <div><span style={{ color: 'var(--ink-4)' }}>Portfolio: </span><a href={String(detailContent.portfolio)} style={{ color: 'var(--accent)' }} className="hover:underline" target="_blank" rel="noopener noreferrer">{detailContent.portfolio}</a></div>}
                      </>
                    ) : <p>{String(detailContent)}</p>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Install button */}
          {masterToken && (
            <>
              <button
                onClick={handleInstall}
                disabled={installing || isInstalled}
                className="btn btn-primary w-full py-3 font-semibold disabled:opacity-50"
              >
                {installing ? 'Installing...' : isInstalled ? 'Installed' : `Install / Use (${detailInstallCount})`}
              </button>
              {installError && (
                <p style={{ color: 'var(--red)' }} className="text-sm">{installError}</p>
              )}
            </>
          )}

          {installSuccess && (
            <div
              style={{ background: 'var(--green-bg)', border: '1px solid rgba(63,185,80,0.35)', borderRadius: '6px' }}
              className="p-4 space-y-2"
            >
              <p style={{ color: 'var(--green)' }} className="font-medium">✓ {isInstalled ? 'Installed' : (detailType === 'persona' ? 'Persona installed!' : 'Added!')}</p>
              {detailType === 'persona' && (
                <>
                  <p style={{ color: 'var(--ink-3)' }} className="text-sm">This persona is now available in your Personas page.</p>
                  <div style={{ background: 'var(--bg-sunk)', border: '1px solid var(--line)', borderRadius: '4px' }} className="p-3 mt-2">
                    <p style={{ color: 'var(--ink-3)' }} className="text-xs mb-1">API Endpoint:</p>
                    <code style={{ color: 'var(--green)' }} className="text-xs mono">GET /api/v1/context</code>
                    <p style={{ color: 'var(--ink-4)' }} className="text-xs mt-1">Use your master token to access this persona via the API.</p>
                  </div>
                </>
              )}
              {detailType === 'api' && installInfo && (
                <div style={{ background: 'var(--bg-sunk)', border: '1px solid var(--line)', borderRadius: '4px' }} className="p-3 mt-2 space-y-1">
                  <p style={{ color: 'var(--ink-3)' }} className="text-xs">Local service provisioned:</p>
                  <p style={{ color: 'var(--ink)' }} className="text-sm font-medium">{installInfo?.serviceName || 'Service'}</p>
                  <code style={{ color: 'var(--green)' }} className="text-xs mono break-all">{installInfo?.endpoint || 'Loading...'}</code>
                </div>
              )}
            </div>
          )}

          {/* Ratings */}
          <div className="pt-5 space-y-4" style={{ borderTop: '1px solid var(--line)' }}>
            <h3 style={{ color: 'var(--ink-2)' }} className="text-sm font-semibold">Reviews ({detailRatings.length})</h3>
            {detailRatings.length > 0 ? (
              <div className="space-y-3">
                {detailRatings.map(r => {
                  if (!r || !r.id) return null;
                  return (
                    <div key={r.id} style={{ background: 'var(--bg-sunk)', border: '1px solid var(--line)', borderRadius: '6px' }} className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span style={{ color: 'var(--ink-2)' }} className="text-sm font-medium">{r?.reviewerName || 'Anonymous'}</span>
                        <StarRating value={r?.rating || 0} count={0} size="sm" />
                      </div>
                      {r?.review && <p style={{ color: 'var(--ink-3)' }} className="text-sm">{r.review}</p>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ color: 'var(--ink-4)' }} className="text-sm">No reviews yet. Be the first!</p>
            )}

            {masterToken && listingId && (
              <div className="pt-4" style={{ borderTop: '1px solid var(--line)' }}>
                <RatingWidget
                  listingId={listingId}
                  masterToken={masterToken}
                  onRated={() => {
                    refreshDetail();
                    onRated && onRated(listingId);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ListingCard({
  listing = {},
  onClick,
  isInstalled = false,
  masterToken,
  onQuickInstall,
  quickInstalling = false,
}) {
  const listingId = listing?.id;
  const listingType = listing?.type || 'unknown';
  const isTokenType = listingType === 'api' || listingType === 'token';
  const content = parseContent(listing?.content);

  // For token listings, prefer content fields; fall back to top-level listing fields
  const listingTitle = isTokenType
    ? (content?.token_label || listing?.title || '(Untitled)')
    : (listing?.title || '(Untitled)');
  const listingDescription = isTokenType
    ? (content?.token_description || listing?.description || '')
    : (listing?.description || 'No description.');
  const listingPrice = listing?.price || 'free';
  const listingOwnerName = resolveOwnerName(listing, content);
  const listingInstallCount = listing?.installCount || 0;
  const listingAvgRating = listing?.avgRating || 0;
  const listingRatingCount = listing?.ratingCount || 0;
  const listingTags = listing?.tags || [];

  const contentScopes = isTokenType && Array.isArray(content?.scopes) ? content.scopes : [];
  const isBundle = isTokenType && !!(content?.is_bundle);
  const persona = isTokenType ? content?.persona : null;

  const scanner = listingType === 'skill' ? extractScanner(listing?.content) : null;
  const [quickError, setQuickError] = useState('');

  // Defensive: ensure listing is valid (after hooks to comply with rules-of-hooks)
  if (!listing || typeof listing !== 'object') {
    return null;
  }

  async function handleQuickInstall(e) {
    e.stopPropagation();
    if (!masterToken || isInstalled || quickInstalling || !listingId) return;

    setQuickError('');
    try {
      const res = await fetch(`/api/v1/marketplace/${listingId}/install`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${masterToken}` },
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || (res.status === 401 ? 'Session expired. Please sign in again.' : 'Install failed'));
      }
      onQuickInstall && onQuickInstall({ listingId, type: listingType, data });
    } catch (err) {
      setQuickError(err.message || 'Install failed');
      console.error('[ListingCard] quickInstall error:', err);
    }
  }

  return (
    <div
      onClick={() => onClick && onClick(listing)}
      className="card p-5 cursor-pointer transition-all group"
      style={{ borderRadius: '6px' }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--accent-2)';
        e.currentTarget.style.background = 'var(--bg-hover)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--line)';
        e.currentTarget.style.background = 'var(--bg-raised)';
      }}
    >
      {/* Header row: type badge + badges */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <TypeBadge type={listingType} />
          {isBundle && (
            <span
              style={{ color: 'var(--violet)', border: '1px solid rgba(188,140,255,0.35)', background: 'var(--violet-bg)', borderRadius: '4px' }}
              className="text-[10px] font-semibold px-2 py-0.5"
            >
              Bundle
            </span>
          )}
          {listing?.official && (
            <span
              style={{ color: 'var(--green)', border: '1px solid rgba(63,185,80,0.35)', background: 'var(--green-bg)', borderRadius: '4px' }}
              className="text-[10px] px-2 py-0.5"
              title="Official / Verified"
            >
              ✓ Official
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isInstalled && (
            <span
              style={{ color: 'var(--green)', border: '1px solid rgba(63,185,80,0.35)', borderRadius: '4px' }}
              className="text-[10px] px-2 py-0.5"
            >
              Installed
            </span>
          )}
          <span style={{ color: 'var(--green)' }} className="text-xs">{listingPrice === 'free' ? 'Free' : listingPrice}</span>
        </div>
      </div>

      {/* Title */}
      <h3
        style={{ color: 'var(--ink)' }}
        className="font-semibold line-clamp-1 mb-1 transition-colors group-hover:text-[color:var(--accent)]"
      >
        {listingTitle}
      </h3>

      {/* Persona sub-label for token listings */}
      {isTokenType && persona?.name && (
        <p style={{ color: 'var(--violet)' }} className="text-xs mb-1">Persona: {persona.name}</p>
      )}

      {/* Description */}
      {listingDescription && (
        <p style={{ color: 'var(--ink-3)' }} className="text-sm line-clamp-2 mb-3">{listingDescription}</p>
      )}

      {/* Scope badges for token listings */}
      {isTokenType && contentScopes.length > 0 && (
        <div className="mb-3">
          <ScopeBadges scopes={contentScopes} limit={4} />
        </div>
      )}

      {/* Skill scanner badge */}
      {scanner && (
        <div
          style={scanner.safe_to_use
            ? { background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid rgba(63,185,80,0.35)', borderRadius: '4px' }
            : { background: 'rgba(210,153,34,0.16)', color: 'var(--amber)', border: '1px solid rgba(210,153,34,0.35)', borderRadius: '4px' }
          }
          className="inline-flex items-center px-2 py-0.5 text-xs mb-3"
          title="Skill scanner checks README/SKILL.md/package.json for risky patterns."
        >
          {scanner.safe_to_use ? 'Safe' : 'Review'} · score {scanner.score}
        </div>
      )}

      {/* Meta row */}
      <div className="flex items-center justify-between text-xs mb-2" style={{ color: 'var(--ink-4)' }}>
        <span>by <span style={{ color: 'var(--ink-2)' }}>{listingOwnerName}</span></span>
        <span>{listingInstallCount} installs</span>
      </div>

      {/* Tags (non-token types) */}
      {!isTokenType && listingTags && Array.isArray(listingTags) && listingTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 mb-2">
          {listingTags.slice(0, 3).map(tag => (
            <span
              key={tag}
              style={{ background: 'var(--bg-hover)', color: 'var(--ink-3)', borderRadius: '4px' }}
              className="px-2 py-0.5 text-xs"
            >
              {tag}
            </span>
          ))}
          {listingTags.length > 3 && <span style={{ color: 'var(--ink-4)' }} className="text-xs">+{listingTags.length - 3}</span>}
        </div>
      )}

      <div className="mt-2">
        <StarRating value={listingAvgRating} count={listingRatingCount} />
      </div>

      <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span style={{ color: 'var(--accent)' }} className="text-xs font-medium hidden sm:block">View Details →</span>
        {masterToken && (
          <button
            onClick={handleQuickInstall}
            disabled={isInstalled || quickInstalling}
            className="btn btn-primary w-full sm:w-auto px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          >
            {quickInstalling ? 'Installing...' : isInstalled ? 'Installed' : 'Install'}
          </button>
        )}
      </div>
      {quickError && <p style={{ color: 'var(--red)' }} className="mt-2 text-xs">{quickError}</p>}
    </div>
  );
}

// Error Boundary wrapper to catch render crashes gracefully
class MarketplaceErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Marketplace render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{ background: 'var(--red-bg)', border: '1px solid rgba(248,81,73,0.35)', borderRadius: '6px', color: 'var(--red)' }}
          className="p-6 space-y-2"
        >
          <p className="font-semibold">Something went wrong loading the Marketplace</p>
          <p style={{ color: 'var(--red)' }} className="text-sm opacity-80">{this.state.error?.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn mt-3 px-4 py-2 text-sm"
            style={{ color: 'var(--red)', borderColor: 'rgba(248,81,73,0.4)' }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Marketplace() {
  const masterToken = useAuthStore(s => s.masterToken);
  const currentWorkspace = useAuthStore(s => s.currentWorkspace);
  const [listings, setListings] = useState([]);
  const [installedSkillListingIds, setInstalledSkillListingIds] = useState(() => new Set());
  const [installedListingIds, setInstalledListingIds] = useState(() => new Set()); // all types
  const [quickInstallingIds, setQuickInstallingIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [selected, setSelected] = useState(null);

  // Enhanced filter states
  const [fieldFilter, setFieldFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [priceFilter, setPriceFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [officialFilter, setOfficialFilter] = useState(false);
  const [availableFields, setAvailableFields] = useState([]);
  const [availableProviders, setAvailableProviders] = useState([]);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (sort !== 'newest') params.set('sort', sort);
      if (search) params.set('search', search);
      if (fieldFilter !== 'all') params.set('tags', fieldFilter);
      if (providerFilter !== 'all') params.set('provider', providerFilter);
      if (priceFilter !== 'all') params.set('price', priceFilter);
      if (ratingFilter !== 'all') params.set('rating', ratingFilter);
      if (officialFilter) params.set('official', '1');

      const res = await fetch(`/api/v1/marketplace?${params}`);
      if (res.ok) {
        const data = await res.json();
        // Defensive: ensure listings is array
        const fetchedListings = Array.isArray(data?.listings) ? data.listings : [];
        setListings(fetchedListings);

        // Extract available fields and providers from listings
        const fields = new Set();
        const providers = new Set();
        fetchedListings.forEach(listing => {
          if (Array.isArray(listing.tags)) {
            listing.tags.forEach(tag => fields.add(tag));
          }
          if (listing.provider) {
            providers.add(listing.provider);
          }
        });
        setAvailableFields(Array.from(fields).sort());
        setAvailableProviders(Array.from(providers).sort());
      }
    } catch (err) {
      console.error('[Marketplace] fetchListings error:', err);
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, sort, search, fieldFilter, providerFilter, priceFilter, ratingFilter, officialFilter]);

  // Compute counters for current filtered results AND global totals
  const currentCounts = {
    total: (listings || []).length,
    skills: (listings || []).filter(l => l?.type === 'skill').length,
    personas: (listings || []).filter(l => l?.type === 'persona').length,
    tokens: (listings || []).filter(l => l?.type === 'token' || l?.type === 'api').length,
  };

  useEffect(() => {
    const t = setTimeout(fetchListings, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchListings]);

  const fetchInstalledSkills = useCallback(async () => {
    if (!masterToken) {
      setInstalledSkillListingIds(new Set());
      return;
    }

    try {
      const res = await fetch('/api/v1/skills', {
        headers: { 'Authorization': `Bearer ${masterToken}` },
        credentials: 'include',
      });
      if (!res.ok) return;
      const payload = await res.json();
      const ids = (payload.skills || payload.data || [])
        .map((s) => {
          const cfg = s.config_json && typeof s.config_json === 'object' ? s.config_json : null;
          return cfg?.marketplace_listing_id ? String(cfg.marketplace_listing_id) : null;
        })
        .filter(Boolean);
      setInstalledSkillListingIds(new Set(ids));
    } catch {
      // ignore non-critical installed-state failures
    }
  }, [masterToken]);

  useEffect(() => {
    fetchInstalledSkills();
  }, [fetchInstalledSkills, currentWorkspace?.id]);

  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'persona', label: 'Personas' },
    { id: 'token', label: 'Tokens' },
    { id: 'skill', label: 'Skills' },
  ];

  const handleQuickInstall = async ({ listingId, type }) => {
    setQuickInstallingIds(prev => new Set([...prev, String(listingId)]));
    try {
      setInstalledListingIds(prev => new Set([...prev, String(listingId)]));
      if (type === 'skill') {
        setInstalledSkillListingIds(prev => new Set([...prev, String(listingId)]));
      }
      await fetchListings();
      if (type === 'skill') await fetchInstalledSkills();
    } finally {
      setQuickInstallingIds(prev => {
        const next = new Set(prev);
        next.delete(String(listingId));
        return next;
      });
    }
  };

  const activeFilterCount = [
    search ? 1 : 0,
    typeFilter !== 'all' ? 1 : 0,
    fieldFilter !== 'all' ? 1 : 0,
    providerFilter !== 'all' ? 1 : 0,
    priceFilter !== 'all' ? 1 : 0,
    ratingFilter !== 'all' ? 1 : 0,
    officialFilter ? 1 : 0,
    sort !== 'newest' ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <MarketplaceErrorBoundary>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start gap-4 mb-2">
          <div className="flex-1 min-w-0">
            <div className="micro mb-2">MARKETPLACE</div>
            <h1 className="font-serif text-[22px] sm:text-[34px] leading-[1.05] tracking-tight ink font-medium">Discover <span className="accent" style={{ fontStyle: 'italic' }}>&</span> share.</h1>
            <p className="mt-2 text-[15px] ink-2 max-w-[60ch]">Browse personas, skills, and tokens built by the community.</p>
          </div>
        </div>

        {/* Top Summary Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card p-3">
            <p style={{ color: 'var(--ink-3)' }} className="text-xs font-medium">Total Products</p>
            <p style={{ color: 'var(--accent)' }} className="text-2xl font-bold mt-1">{currentCounts.total}</p>
          </div>
          <div className="card p-3">
            <p style={{ color: 'var(--ink-3)' }} className="text-xs font-medium">Skills</p>
            <p style={{ color: 'var(--green)' }} className="text-2xl font-bold mt-1">{currentCounts.skills}</p>
          </div>
          <div className="card p-3">
            <p style={{ color: 'var(--ink-3)' }} className="text-xs font-medium">Personas</p>
            <p style={{ color: 'var(--violet)' }} className="text-2xl font-bold mt-1">{currentCounts.personas}</p>
          </div>
          <div className="card p-3">
            <p style={{ color: 'var(--ink-3)' }} className="text-xs font-medium">Tokens</p>
            <p style={{ color: 'var(--accent)' }} className="text-2xl font-bold mt-1">{currentCounts.tokens}</p>
          </div>
        </div>

        {/* Search + Sort */}
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-3 flex items-center" style={{ color: 'var(--ink-3)' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 12a7.5 7.5 0 0012.15 4.65z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search listings..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="ui-input w-full pl-9 pr-4 py-2.5 text-sm"
            />
          </div>
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="ui-input px-3 py-2.5 text-sm"
          >
            <option value="newest">Most Recent</option>
            <option value="popular">Most Popular</option>
            <option value="most_used">Most Used</option>
          </select>
        </div>

        {/* Enhanced Filter Bar */}
        <div className="card p-4 space-y-4">
          {/* Filter Row 1: Field, Provider, Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Field/Category Filter */}
            <div>
              <label style={{ color: 'var(--ink-3)' }} className="block text-xs font-medium mb-2">Field / Category</label>
              <select
                value={fieldFilter}
                onChange={e => setFieldFilter(e.target.value)}
                className="ui-input w-full px-3 py-2 text-sm"
              >
                <option value="all">All Fields</option>
                {availableFields.map(field => (
                  <option key={field} value={field}>{field}</option>
                ))}
              </select>
            </div>

            {/* Provider Filter */}
            <div>
              <label style={{ color: 'var(--ink-3)' }} className="block text-xs font-medium mb-2">Provider</label>
              <select
                value={providerFilter}
                onChange={e => setProviderFilter(e.target.value)}
                className="ui-input w-full px-3 py-2 text-sm"
              >
                <option value="all">All Providers</option>
                {availableProviders.map(provider => (
                  <option key={provider} value={provider}>{provider}</option>
                ))}
              </select>
            </div>

            {/* Price Filter */}
            <div>
              <label style={{ color: 'var(--ink-3)' }} className="block text-xs font-medium mb-2">Price</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setPriceFilter('all')}
                  className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors btn ${priceFilter === 'all' ? 'btn-primary' : ''}`}
                  style={priceFilter !== 'all' ? { color: 'var(--ink-2)' } : {}}
                >
                  All
                </button>
                <button
                  onClick={() => setPriceFilter('free')}
                  className="flex-1 px-3 py-2 rounded text-sm font-medium transition-colors btn"
                  style={priceFilter === 'free'
                    ? { background: 'var(--green-bg)', color: 'var(--green)', borderColor: 'rgba(63,185,80,0.35)' }
                    : { color: 'var(--ink-2)' }
                  }
                >
                  Free
                </button>
                <button
                  onClick={() => setPriceFilter('paid')}
                  className="flex-1 px-3 py-2 rounded text-sm font-medium transition-colors btn"
                  style={priceFilter === 'paid'
                    ? { background: 'rgba(210,153,34,0.16)', color: 'var(--amber)', borderColor: 'rgba(210,153,34,0.35)' }
                    : { color: 'var(--ink-2)' }
                  }
                >
                  Paid
                </button>
              </div>
            </div>
          </div>

          {/* Filter Row 2: Rating, Official, Clear Button */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Rating Filter */}
            <div>
              <label style={{ color: 'var(--ink-3)' }} className="block text-xs font-medium mb-2">Rating</label>
              <button
                onClick={() => setRatingFilter(ratingFilter === '4+' ? 'all' : '4+')}
                className="btn w-full px-3 py-2 text-sm font-medium transition-colors"
                style={ratingFilter === '4+'
                  ? { background: 'rgba(210,153,34,0.16)', color: 'var(--amber)', borderColor: 'rgba(210,153,34,0.35)' }
                  : { color: 'var(--ink-2)' }
                }
              >
                ★★★★+ (4+ Stars)
              </button>
            </div>

            {/* Official/Verified Filter */}
            <div>
              <label style={{ color: 'var(--ink-3)' }} className="block text-xs font-medium mb-2">Verification</label>
              <button
                onClick={() => setOfficialFilter(!officialFilter)}
                className="btn w-full px-3 py-2 text-sm font-medium transition-colors"
                style={officialFilter
                  ? { background: 'var(--green-bg)', color: 'var(--green)', borderColor: 'rgba(63,185,80,0.35)' }
                  : { color: 'var(--ink-2)' }
                }
              >
                {officialFilter ? '✓ Official Only' : 'Show All'}
              </button>
            </div>

            {/* Clear Filters Button with count badge */}
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearch('');
                  setTypeFilter('all');
                  setFieldFilter('all');
                  setProviderFilter('all');
                  setPriceFilter('all');
                  setRatingFilter('all');
                  setOfficialFilter(false);
                  setSort('newest');
                }}
                className="btn w-full px-3 py-2 text-sm font-medium transition-colors relative"
                style={activeFilterCount > 0
                  ? { background: 'var(--red-bg)', color: 'var(--red)', borderColor: 'rgba(248,81,73,0.35)' }
                  : { color: 'var(--ink-4)', cursor: 'default', opacity: 0.6 }
                }
                disabled={activeFilterCount === 0}
              >
                Clear All
                {activeFilterCount > 0 && (
                  <span
                    style={{ background: 'var(--red)', color: '#fff' }}
                    className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded-full"
                  >
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Active Filters Chips */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span style={{ color: 'var(--ink-3)' }} className="text-xs font-medium">Active filters ({activeFilterCount}):</span>
            {search && (
              <div
                style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid rgba(68,147,248,0.35)', borderRadius: '4px' }}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs"
              >
                <span>Search: {search}</span>
                <button onClick={() => setSearch('')} className="font-bold hover:opacity-70">×</button>
              </div>
            )}
            {typeFilter !== 'all' && (
              <div
                style={{ background: 'var(--violet-bg)', color: 'var(--violet)', border: '1px solid rgba(188,140,255,0.35)', borderRadius: '4px' }}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs"
              >
                <span>Type: {typeFilter}</span>
                <button onClick={() => setTypeFilter('all')} className="font-bold hover:opacity-70">×</button>
              </div>
            )}
            {fieldFilter !== 'all' && (
              <div
                style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid rgba(63,185,80,0.35)', borderRadius: '4px' }}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs"
              >
                <span>Field: {fieldFilter}</span>
                <button onClick={() => setFieldFilter('all')} className="font-bold hover:opacity-70">×</button>
              </div>
            )}
            {providerFilter !== 'all' && (
              <div
                style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid rgba(68,147,248,0.35)', borderRadius: '4px' }}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs"
              >
                <span>Provider: {providerFilter}</span>
                <button onClick={() => setProviderFilter('all')} className="font-bold hover:opacity-70">×</button>
              </div>
            )}
            {priceFilter !== 'all' && (
              <div
                style={{ background: 'rgba(210,153,34,0.16)', color: 'var(--amber)', border: '1px solid rgba(210,153,34,0.35)', borderRadius: '4px' }}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs"
              >
                <span>Price: {priceFilter}</span>
                <button onClick={() => setPriceFilter('all')} className="font-bold hover:opacity-70">×</button>
              </div>
            )}
            {ratingFilter !== 'all' && (
              <div
                style={{ background: 'rgba(210,153,34,0.16)', color: 'var(--amber)', border: '1px solid rgba(210,153,34,0.35)', borderRadius: '4px' }}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs"
              >
                <span>Rating: {ratingFilter}</span>
                <button onClick={() => setRatingFilter('all')} className="font-bold hover:opacity-70">×</button>
              </div>
            )}
            {officialFilter && (
              <div
                style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid rgba(63,185,80,0.35)', borderRadius: '4px' }}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs"
              >
                <span>Official Only</span>
                <button onClick={() => setOfficialFilter(false)} className="font-bold hover:opacity-70">×</button>
              </div>
            )}
            {sort !== 'newest' && (
              <div
                style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid rgba(68,147,248,0.35)', borderRadius: '4px' }}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs"
              >
                <span>Sort: {sort === 'popular' ? 'Most Popular' : 'Most Used'}</span>
                <button onClick={() => setSort('newest')} className="font-bold hover:opacity-70">×</button>
              </div>
            )}
          </div>
        )}

        {/* Type filter tabs */}
        <div
          className="flex gap-1 p-1 rounded w-fit"
          style={{ background: 'var(--bg-sunk)', border: '1px solid var(--line)' }}
        >
          {(tabs || []).map(tab => (
            <button
              key={tab?.id || 'unknown'}
              onClick={() => setTypeFilter(tab?.id || 'all')}
              className="px-4 py-2 rounded text-sm font-medium transition-colors"
              style={typeFilter === tab?.id
                ? { background: 'var(--accent-2)', color: '#fff' }
                : { color: 'var(--ink-3)', background: 'transparent' }
              }
              onMouseEnter={e => { if (typeFilter !== tab?.id) e.currentTarget.style.color = 'var(--ink)'; }}
              onMouseLeave={e => { if (typeFilter !== tab?.id) e.currentTarget.style.color = 'var(--ink-3)'; }}
            >
              {tab?.label || 'Unknown'}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: 'var(--accent)' }} />
          </div>
        ) : (listings || []).length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--ink-4)' }}>
            <p className="text-4xl mb-3">🏪</p>
            <p style={{ color: 'var(--ink-3)' }} className="text-lg font-medium">No listings found</p>
            <p className="text-sm mt-1">Be the first to publish something!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {(listings || []).filter(l => {
              if (typeFilter === 'all') return true;
              // 'token' tab shows both 'token' and legacy 'api' type listings
              if (typeFilter === 'token') return l?.type === 'token' || l?.type === 'api';
              return l?.type === typeFilter;
            }).map(listing => {
              if (!listing || !listing.id) {
                console.warn('[Marketplace] Skipping invalid listing:', listing);
                return null;
              }
              return (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  onClick={setSelected}
                  masterToken={masterToken}
                  onQuickInstall={handleQuickInstall}
                  quickInstalling={quickInstallingIds.has(String(listing.id))}
                  isInstalled={installedListingIds.has(String(listing.id)) || (listing.type === 'skill' && installedSkillListingIds.has(String(listing.id)))}
                />
              );
            })}
          </div>
        )}

        {/* Detail modal */}
        {selected && (
          <ListingModal
            listing={selected}
            masterToken={masterToken}
            initiallyInstalled={installedListingIds.has(String(selected?.id)) || (selected?.type === 'skill' && installedSkillListingIds.has(String(selected?.id)))}
            onClose={() => setSelected(null)}
            onInstall={({ listingId, type }) => {
              setInstalledListingIds(prev => new Set([...prev, String(listingId)]));
              if (type === 'skill') {
                setInstalledSkillListingIds(prev => new Set([...prev, String(listingId)]));
              }
              fetchListings();
              if (type === 'skill') fetchInstalledSkills();
            }}
            onRated={() => {
              fetchListings();
            }}
          />
        )}
      </div>
    </MarketplaceErrorBoundary>
  );
}
