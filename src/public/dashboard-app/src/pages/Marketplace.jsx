import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';

const TYPE_CONFIG = {
  persona: { label: 'Persona', color: 'bg-purple-900 bg-opacity-60 text-purple-300 border-purple-700' },
  api: { label: 'Token', color: 'bg-cyan-900 bg-opacity-60 text-cyan-300 border-cyan-700' },
  token: { label: 'Token', color: 'bg-cyan-900 bg-opacity-60 text-cyan-300 border-cyan-700' },
  skill: { label: 'Skill', color: 'bg-green-900 bg-opacity-60 text-green-300 border-green-700' },
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

const SCOPE_COLORS = {
  basic: 'bg-slate-700 text-slate-200',
  professional: 'bg-slate-700 text-slate-200',
  availability: 'bg-slate-700 text-slate-200',
  personas: 'bg-purple-900/60 text-purple-300',
  knowledge: 'bg-blue-900/60 text-blue-300',
  chat: 'bg-blue-900/60 text-blue-300',
  memory: 'bg-blue-900/60 text-blue-300',
  'skills:read': 'bg-green-900/60 text-green-300',
  'skills:write': 'bg-green-900/60 text-green-300',
  'services:read': 'bg-orange-900/60 text-orange-300',
  'services:write': 'bg-orange-900/60 text-orange-300',
};

function scopeLabel(scope) {
  if (SCOPE_LABELS[scope]) return SCOPE_LABELS[scope];
  // per-service: services:google:read → Google (Read)
  const m = scope.match(/^services:([^:]+):(read|write|\*)$/);
  if (m) return `${m[1].charAt(0).toUpperCase() + m[1].slice(1)} (${m[2] === '*' ? 'All' : m[2].charAt(0).toUpperCase() + m[2].slice(1)})`;
  return scope;
}

function scopeColor(scope) {
  if (SCOPE_COLORS[scope]) return SCOPE_COLORS[scope];
  if (scope.startsWith('services:')) return 'bg-orange-900/60 text-orange-300';
  return 'bg-slate-700 text-slate-300';
}

function ScopeBadges({ scopes, limit }) {
  if (!Array.isArray(scopes) || scopes.length === 0) return null;
  const shown = limit ? scopes.slice(0, limit) : scopes;
  const remaining = limit ? scopes.length - shown.length : 0;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map(s => (
        <span key={s} className={`px-2 py-0.5 rounded text-[10px] font-medium ${scopeColor(s)}`}>
          {scopeLabel(s)}
        </span>
      ))}
      {remaining > 0 && (
        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-700 text-slate-400">
          +{remaining} more
        </span>
      )}
    </div>
  );
}

function Collapsible({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 hover:bg-slate-750 text-sm font-medium text-slate-200 transition-colors"
      >
        <span>{title}</span>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-4 py-3 bg-slate-900 text-sm text-slate-300 space-y-2">
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
        <span key={s} className={s <= Math.round(safeValue) ? 'text-amber-400' : 'text-slate-600'}>★</span>
      ))}
      {safeCount > 0 && <span className="text-slate-400 text-xs ml-1">{safeValue.toFixed(1)} ({safeCount})</span>}
      {safeCount === 0 && <span className="text-slate-500 text-xs ml-1">No ratings</span>}
    </span>
  );
}

function TypeBadge({ type = 'unknown' }) {
  // Defensive: handle missing or invalid type
  const safeType = String(type || 'unknown').toLowerCase();
  const cfg = TYPE_CONFIG[safeType] || { label: safeType, color: 'bg-slate-800 text-slate-300 border-slate-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.color}`}>
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

  if (done) return <p className="text-green-400 text-sm">Thanks for your rating!</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-300 font-medium">Rate this listing</p>
      <div className="flex gap-1">
        {[1,2,3,4,5].map(s => (
          <button
            key={s}
            onMouseEnter={() => setHovered(s)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => setSelected(s)}
            className={`text-2xl transition-transform hover:scale-110 ${s <= (hovered || selected) ? 'text-amber-400' : 'text-slate-600'}`}
          >★</button>
        ))}
      </div>
      <textarea
        value={review}
        onChange={e => setReview(e.target.value)}
        placeholder="Leave a review (optional)"
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:border-blue-500"
        rows={2}
      />
      <button
        onClick={submit}
        disabled={!selected || submitting}
        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {submitting ? 'Submitting...' : 'Submit Rating'}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
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
      <div className="absolute inset-0 bg-black bg-opacity-70" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-start justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <TypeBadge type={detailType} />
            {isBundle && (
              <span className="text-xs font-semibold text-purple-300 border border-purple-600 rounded-full px-2 py-0.5 bg-purple-900/40">
                Bundle
              </span>
            )}
            <h2 className="text-xl font-bold text-white">{detailTitle}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none ml-4">×</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
            <span>by <span className="text-slate-200">{detailOwnerName}</span></span>
            <StarRating value={detailAvgRating} count={detailRatingCount} size="sm" />
            <span>{detailInstallCount} installs</span>
            <span className="text-green-400">{detailPrice === 'free' ? 'Free' : detailPrice}</span>
            {isInstalled && <span className="text-emerald-300 text-xs border border-emerald-700 rounded-full px-2 py-0.5">Installed</span>}
            {tokenRequiresApproval && (
              <span className="text-amber-300 text-xs border border-amber-700 rounded-full px-2 py-0.5">Requires Approval</span>
            )}
            {detailType === 'skill' && scanner && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${scanner.safe_to_use ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700' : 'bg-amber-900/40 text-amber-300 border-amber-700'}`}
                title="Skill scanner checks README/SKILL.md/package.json for risky patterns."
              >
                {scanner.safe_to_use ? 'Safe' : 'Review'} · score {scanner.score}
              </span>
            )}
            {tokenExpiresAt && (
              <span className="text-slate-400 text-xs">Expires: {new Date(tokenExpiresAt).toLocaleDateString()}</span>
            )}
          </div>

          {/* Tags (non-token) */}
          {!isTokenType && detailTags && detailTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {detailTags.map(tag => (
                <span key={tag} className="px-2 py-0.5 bg-slate-800 text-slate-300 text-xs rounded-full border border-slate-700">{tag}</span>
              ))}
            </div>
          )}

          {/* Description */}
          {detailDescription && (
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-2">Description</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{detailDescription}</p>
            </div>
          )}

          {/* TOKEN-SPECIFIC SECTIONS */}
          {isTokenType && (
            <div className="space-y-3">
              {/* Access Scopes */}
              {tokenScopes.length > 0 && (
                <Collapsible title={`Access Scopes (${tokenScopes.length})`} defaultOpen={true}>
                  <ScopeBadges scopes={tokenScopes} />
                  <p className="text-xs text-slate-500 mt-1">
                    These scopes define what data this token can access on the owner's API.
                  </p>
                </Collapsible>
              )}

              {/* Persona */}
              {tokenPersona && (
                <Collapsible title={`Persona: ${tokenPersona.name || 'Unnamed'}`}>
                  {tokenPersona.description && (
                    <p className="text-slate-300 leading-relaxed">{tokenPersona.description}</p>
                  )}
                  {!tokenPersona.description && (
                    <p className="text-slate-500 italic">No description provided for this persona.</p>
                  )}
                </Collapsible>
              )}

              {/* Knowledge Base files */}
              {kbDocs && Array.isArray(kbDocs) && kbDocs.length > 0 && (
                <Collapsible title={`Knowledge Base (${kbDocs.length} file${kbDocs.length !== 1 ? 's' : ''})`}>
                  <ul className="space-y-1">
                    {kbDocs.map((doc, i) => (
                      <li key={doc.id || doc || i} className="flex items-center gap-2">
                        <svg className="w-3 h-3 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-slate-300 text-xs">{doc.title || doc.name || doc.id || doc}</span>
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
                        <svg className="w-3 h-3 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                        </svg>
                        <span className="text-slate-300 text-xs">{skill.name || skill.id || skill}</span>
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
              <h3 className="text-sm font-semibold text-slate-300 mb-2">Details</h3>
              <div className="bg-slate-800 rounded-lg p-4 text-sm">
                {detailType === 'persona' && (
                  <p className="text-slate-300 whitespace-pre-wrap">{
                    typeof detailContent === 'object' ? (detailContent?.soul_content || JSON.stringify(detailContent, null, 2)) : String(detailContent)
                  }</p>
                )}
                {detailType === 'skill' && (
                  <div className="space-y-2 text-slate-300">
                    {typeof detailContent === 'object' ? (
                      <>
                        {detailContent?.skill_name && <div><span className="text-slate-500">Skill: </span>{detailContent.skill_name}</div>}
                        {detailContent?.proficiency && <div><span className="text-slate-500">Level: </span>{detailContent.proficiency}</div>}
                        {detailContent?.years && <div><span className="text-slate-500">Experience: </span>{detailContent.years} years</div>}
                        {detailContent?.portfolio && <div><span className="text-slate-500">Portfolio: </span><a href={String(detailContent.portfolio)} className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">{detailContent.portfolio}</a></div>}
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
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-all shadow-lg"
              >
                {installing ? 'Installing...' : isInstalled ? 'Installed' : `Install / Use (${detailInstallCount})`}
              </button>
              {installError && (
                <p className="text-sm text-red-400">{installError}</p>
              )}
            </>
          )}

          {installSuccess && (
            <div className="bg-green-900 bg-opacity-30 border border-green-700 rounded-lg p-4 space-y-2">
              <p className="text-green-300 font-medium">✓ {isInstalled ? 'Installed' : (detailType === 'persona' ? 'Persona installed!' : 'Added!')}</p>
              {detailType === 'persona' && (
                <>
                  <p className="text-sm text-slate-400">This persona is now available in your Personas page.</p>
                  <div className="bg-slate-800 rounded p-3 mt-2">
                    <p className="text-xs text-slate-400 mb-1">API Endpoint:</p>
                    <code className="text-xs text-green-300 font-mono">GET /api/v1/context</code>
                    <p className="text-xs text-slate-500 mt-1">Use your master token to access this persona via the API.</p>
                  </div>
                </>
              )}
              {detailType === 'api' && installInfo && (
                <div className="bg-slate-800 rounded p-3 mt-2 space-y-1">
                  <p className="text-xs text-slate-400">Local service provisioned:</p>
                  <p className="text-sm text-slate-200 font-medium">{installInfo?.serviceName || 'Service'}</p>
                  <code className="text-xs text-green-300 font-mono break-all">{installInfo?.endpoint || 'Loading...'}</code>
                </div>
              )}
            </div>
          )}

          {/* Ratings */}
          <div className="border-t border-slate-800 pt-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-300">Reviews ({detailRatings.length})</h3>
            {detailRatings.length > 0 ? (
              <div className="space-y-3">
                {detailRatings.map(r => {
                  if (!r || !r.id) return null;
                  return (
                    <div key={r.id} className="bg-slate-800 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-200">{r?.reviewerName || 'Anonymous'}</span>
                        <StarRating value={r?.rating || 0} count={0} size="sm" />
                      </div>
                      {r?.review && <p className="text-slate-400 text-sm">{r.review}</p>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">No reviews yet. Be the first!</p>
            )}

            {masterToken && listingId && (
              <div className="border-t border-slate-800 pt-4">
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
      className="bg-white bg-opacity-5 border border-white border-opacity-10 rounded-xl p-5 cursor-pointer hover:border-blue-500 hover:border-opacity-50 hover:bg-opacity-10 transition-all group"
    >
      {/* Header row: type badge + badges */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <TypeBadge type={listingType} />
          {isBundle && (
            <span className="text-[10px] font-semibold text-purple-300 border border-purple-600 rounded-full px-2 py-0.5 bg-purple-900/40">
              Bundle
            </span>
          )}
          {listing?.official && (
            <span className="text-[10px] text-emerald-300 border border-emerald-700 rounded-full px-2 py-0.5 bg-emerald-900 bg-opacity-30" title="Official / Verified">✓ Official</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isInstalled && (
            <span className="text-[10px] text-emerald-300 border border-emerald-700 rounded-full px-2 py-0.5">Installed</span>
          )}
          <span className="text-xs text-green-400">{listingPrice === 'free' ? 'Free' : listingPrice}</span>
        </div>
      </div>

      {/* Title */}
      <h3 className="font-semibold text-white group-hover:text-blue-300 transition-colors line-clamp-1 mb-1">
        {listingTitle}
      </h3>

      {/* Persona sub-label for token listings */}
      {isTokenType && persona?.name && (
        <p className="text-xs text-purple-400 mb-1">Persona: {persona.name}</p>
      )}

      {/* Description */}
      {listingDescription && (
        <p className="text-slate-400 text-sm line-clamp-2 mb-3">{listingDescription}</p>
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
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border mb-3 ${scanner.safe_to_use ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700' : 'bg-amber-900/40 text-amber-300 border-amber-700'}`}
          title="Skill scanner checks README/SKILL.md/package.json for risky patterns."
        >
          {scanner.safe_to_use ? 'Safe' : 'Review'} · score {scanner.score}
        </div>
      )}

      {/* Meta row */}
      <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
        <span>by <span className="text-slate-300">{listingOwnerName}</span></span>
        <span>{listingInstallCount} installs</span>
      </div>

      {/* Tags (non-token types) */}
      {!isTokenType && listingTags && Array.isArray(listingTags) && listingTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 mb-2">
          {listingTags.slice(0, 3).map(tag => (
            <span key={tag} className="px-2 py-0.5 bg-slate-800 text-slate-400 text-xs rounded-full">{tag}</span>
          ))}
          {listingTags.length > 3 && <span className="text-slate-500 text-xs">+{listingTags.length - 3}</span>}
        </div>
      )}

      <div className="mt-2">
        <StarRating value={listingAvgRating} count={listingRatingCount} />
      </div>

      <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span className="text-xs font-medium text-blue-400 group-hover:text-blue-300 transition-colors hidden sm:block">View Details →</span>
        {masterToken && (
          <button
            onClick={handleQuickInstall}
            disabled={isInstalled || quickInstalling}
            className="w-full sm:w-auto px-3 py-1.5 text-xs rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium"
          >
            {quickInstalling ? 'Installing...' : isInstalled ? 'Installed' : 'Install'}
          </button>
        )}
      </div>
      {quickError && <p className="mt-2 text-xs text-red-400">{quickError}</p>}
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
        <div className="bg-red-900 bg-opacity-20 border border-red-700 rounded-lg p-6 text-red-300 space-y-2">
          <p className="font-semibold">⚠ Something went wrong loading the Marketplace</p>
          <p className="text-sm text-red-400">{this.state.error?.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-sm rounded-lg"
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
    apis: (listings || []).filter(l => l?.type === 'api').length,
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
        <div>
          <h1 className="text-3xl font-bold text-white">Marketplace</h1>
          <p className="text-slate-400 mt-1">Discover and share personas, APIs, and skills with the community</p>
        </div>

        {/* Top Summary Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
            <p className="text-slate-400 text-xs font-medium">Total Products</p>
            <p className="text-2xl font-bold text-blue-400 mt-1">{currentCounts.total}</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
            <p className="text-slate-400 text-xs font-medium">Skills</p>
            <p className="text-2xl font-bold text-green-400 mt-1">{currentCounts.skills}</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
            <p className="text-slate-400 text-xs font-medium">Personas</p>
            <p className="text-2xl font-bold text-purple-400 mt-1">{currentCounts.personas}</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
            <p className="text-slate-400 text-xs font-medium">APIs</p>
            <p className="text-2xl font-bold text-indigo-400 mt-1">{currentCounts.apis}</p>
          </div>
        </div>

        {/* Search + Sort */}
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 12a7.5 7.5 0 0012.15 4.65z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search listings..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="newest">Most Recent</option>
            <option value="popular">Most Popular</option>
            <option value="most_used">Most Used</option>
          </select>
        </div>

        {/* Enhanced Filter Bar */}
        <div className="bg-slate-800 bg-opacity-50 border border-slate-700 rounded-lg p-4 space-y-4">
          {/* Filter Row 1: Field, Provider, Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Field/Category Filter */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">Field / Category</label>
              <select
                value={fieldFilter}
                onChange={e => setFieldFilter(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Fields</option>
                {availableFields.map(field => (
                  <option key={field} value={field}>{field}</option>
                ))}
              </select>
            </div>

            {/* Provider Filter */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">Provider</label>
              <select
                value={providerFilter}
                onChange={e => setProviderFilter(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Providers</option>
                {availableProviders.map(provider => (
                  <option key={provider} value={provider}>{provider}</option>
                ))}
              </select>
            </div>

            {/* Price Filter */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">Price</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setPriceFilter('all')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    priceFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setPriceFilter('free')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    priceFilter === 'free'
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                  }`}
                >
                  Free
                </button>
                <button
                  onClick={() => setPriceFilter('paid')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    priceFilter === 'paid'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                  }`}
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
              <label className="block text-xs font-medium text-slate-400 mb-2">Rating</label>
              <button
                onClick={() => setRatingFilter(ratingFilter === '4+' ? 'all' : '4+')}
                className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  ratingFilter === '4+'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                }`}
              >
                ★★★★+ (4+ Stars)
              </button>
            </div>

            {/* Official/Verified Filter */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">Verification</label>
              <button
                onClick={() => setOfficialFilter(!officialFilter)}
                className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  officialFilter
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                }`}
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
                className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors relative ${
                  activeFilterCount > 0
                    ? 'bg-red-700 hover:bg-red-600 text-white'
                    : 'bg-slate-700 text-slate-500 cursor-default'
                }`}
                disabled={activeFilterCount === 0}
              >
                Clear All
                {activeFilterCount > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-red-500 rounded-full">
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
            <span className="text-xs text-slate-400 font-medium">Active filters ({activeFilterCount}):</span>
            {search && (
              <div className="inline-flex items-center gap-2 bg-blue-900 bg-opacity-50 text-blue-300 px-3 py-1.5 rounded-full border border-blue-700 text-xs">
                <span>Search: {search}</span>
                <button onClick={() => setSearch('')} className="text-blue-400 hover:text-blue-200 font-bold">×</button>
              </div>
            )}
            {typeFilter !== 'all' && (
              <div className="inline-flex items-center gap-2 bg-purple-900 bg-opacity-50 text-purple-300 px-3 py-1.5 rounded-full border border-purple-700 text-xs">
                <span>Type: {typeFilter}</span>
                <button onClick={() => setTypeFilter('all')} className="text-purple-400 hover:text-purple-200 font-bold">×</button>
              </div>
            )}
            {fieldFilter !== 'all' && (
              <div className="inline-flex items-center gap-2 bg-green-900 bg-opacity-50 text-green-300 px-3 py-1.5 rounded-full border border-green-700 text-xs">
                <span>Field: {fieldFilter}</span>
                <button onClick={() => setFieldFilter('all')} className="text-green-400 hover:text-green-200 font-bold">×</button>
              </div>
            )}
            {providerFilter !== 'all' && (
              <div className="inline-flex items-center gap-2 bg-indigo-900 bg-opacity-50 text-indigo-300 px-3 py-1.5 rounded-full border border-indigo-700 text-xs">
                <span>Provider: {providerFilter}</span>
                <button onClick={() => setProviderFilter('all')} className="text-indigo-400 hover:text-indigo-200 font-bold">×</button>
              </div>
            )}
            {priceFilter !== 'all' && (
              <div className="inline-flex items-center gap-2 bg-amber-900 bg-opacity-50 text-amber-300 px-3 py-1.5 rounded-full border border-amber-700 text-xs">
                <span>Price: {priceFilter}</span>
                <button onClick={() => setPriceFilter('all')} className="text-amber-400 hover:text-amber-200 font-bold">×</button>
              </div>
            )}
            {ratingFilter !== 'all' && (
              <div className="inline-flex items-center gap-2 bg-yellow-900 bg-opacity-50 text-yellow-300 px-3 py-1.5 rounded-full border border-yellow-700 text-xs">
                <span>Rating: {ratingFilter}</span>
                <button onClick={() => setRatingFilter('all')} className="text-yellow-400 hover:text-yellow-200 font-bold">×</button>
              </div>
            )}
            {officialFilter && (
              <div className="inline-flex items-center gap-2 bg-emerald-900 bg-opacity-50 text-emerald-300 px-3 py-1.5 rounded-full border border-emerald-700 text-xs">
                <span>Official Only</span>
                <button onClick={() => setOfficialFilter(false)} className="text-emerald-400 hover:text-emerald-200 font-bold">×</button>
              </div>
            )}
            {sort !== 'newest' && (
              <div className="inline-flex items-center gap-2 bg-cyan-900 bg-opacity-50 text-cyan-300 px-3 py-1.5 rounded-full border border-cyan-700 text-xs">
                <span>Sort: {sort === 'popular' ? 'Most Popular' : 'Most Used'}</span>
                <button onClick={() => setSort('newest')} className="text-cyan-400 hover:text-cyan-200 font-bold">×</button>
              </div>
            )}
          </div>
        )}

        {/* Type filter tabs */}
        <div className="flex gap-1 bg-slate-800 bg-opacity-50 p-1 rounded-lg w-fit">
          {(tabs || []).map(tab => (
            <button
              key={tab?.id || 'unknown'}
              onClick={() => setTypeFilter(tab?.id || 'all')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                typeFilter === tab?.id
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab?.label || 'Unknown'}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
          </div>
        ) : (listings || []).length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <p className="text-4xl mb-3">🏪</p>
            <p className="text-lg font-medium text-slate-400">No listings found</p>
            <p className="text-sm mt-1">Be the first to publish something!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {(listings || []).filter(l => {
              if (typeFilter === 'all') return true;
              // Map 'token' tab to show 'api' type listings
              if (typeFilter === 'token') return l?.type === 'api';
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
