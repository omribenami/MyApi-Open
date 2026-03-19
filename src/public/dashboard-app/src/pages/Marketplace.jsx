import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';

const TYPE_CONFIG = {
  persona: { label: 'Persona', color: 'bg-purple-900 bg-opacity-60 text-purple-300 border-purple-700' },
  api: { label: 'API', color: 'bg-blue-900 bg-opacity-60 text-blue-300 border-blue-700' },
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
  // Defensive: validate listing object
  if (!listing || typeof listing !== 'object') {
    return null;
  }

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
        });
        if (!res.ok) return;
        const payload = await res.json();
        const skillsData = Array.isArray(payload?.data) ? payload.data : [];
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
  const detailTitle = detail?.title || '(Untitled)';
  const detailOwnerName = detail?.ownerName || 'Unknown';
  const detailAvgRating = detail?.avgRating || 0;
  const detailRatingCount = detail?.ratingCount || 0;
  const detailInstallCount = detail?.installCount || 0;
  const detailPrice = detail?.price || 'price unknown';
  const detailDescription = detail?.description || 'No description provided.';
  const detailContent = detail?.content;
  const detailTags = Array.isArray(detail?.tags) ? detail.tags : [];
  const detailRatings = Array.isArray(detail?.ratings) ? detail.ratings : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black bg-opacity-70" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <TypeBadge type={detailType} />
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
            {detailType === 'skill' && scanner && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${scanner.safe_to_use ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700' : 'bg-amber-900/40 text-amber-300 border-amber-700'}`}
                title="Skill scanner checks README/SKILL.md/package.json for risky patterns."
              >
                {scanner.safe_to_use ? 'Safe' : 'Review'} · score {scanner.score}
              </span>
            )}
          </div>

          {/* Tags */}
          {detailTags && detailTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {detailTags.map(tag => (
                <span key={tag} className="px-2 py-0.5 bg-slate-800 text-slate-300 text-xs rounded-full border border-slate-700">{tag}</span>
              ))}
            </div>
          )}

          {/* Description */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Description</h3>
            <p className="text-slate-400 text-sm leading-relaxed">{detailDescription}</p>
          </div>

          {/* Content preview */}
          {detailContent && (
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-2">Details</h3>
              <div className="bg-slate-800 rounded-lg p-4 text-sm">
                {detailType === 'persona' && (
                  <p className="text-slate-300 whitespace-pre-wrap">{
                    typeof detailContent === 'object' ? (detailContent?.soul_content || JSON.stringify(detailContent, null, 2)) : String(detailContent)
                  }</p>
                )}
                {detailType === 'api' && (
                  <div className="space-y-2 text-slate-300">
                    {typeof detailContent === 'object' ? (
                      <>
                        {detailContent?.endpoint && <div><span className="text-slate-500">Endpoint: </span>{detailContent.endpoint}</div>}
                        {detailContent?.method && <div><span className="text-slate-500">Method: </span><span className="text-blue-300">{detailContent.method}</span></div>}
                        {detailContent?.auth_type && <div><span className="text-slate-500">Auth: </span>{detailContent.auth_type}</div>}
                        {detailContent?.api_description && <div><span className="text-slate-500">About: </span>{detailContent.api_description}</div>}
                      </>
                    ) : <p>{String(detailContent)}</p>}
                  </div>
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
  // Defensive: ensure listing is valid
  if (!listing || typeof listing !== 'object') {
    return null;
  }

  const listingId = listing?.id;
  const listingType = listing?.type || 'unknown';
  const listingTitle = listing?.title || '(Untitled)';
  const listingDescription = listing?.description || 'No description.';
  const listingPrice = listing?.price || 'price unknown';
  const listingOwnerName = listing?.ownerName || 'Unknown';
  const listingInstallCount = listing?.installCount || 0;
  const listingAvgRating = listing?.avgRating || 0;
  const listingRatingCount = listing?.ratingCount || 0;
  const listingTags = listing?.tags || [];

  const scanner = listingType === 'skill' ? extractScanner(listing.content) : null;
  const [quickError, setQuickError] = useState('');

  async function handleQuickInstall(e) {
    e.stopPropagation();
    if (!masterToken || isInstalled || quickInstalling || !listingId) return;

    setQuickError('');
    try {
      const res = await fetch(`/api/v1/marketplace/${listingId}/install`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${masterToken}` },
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
      <div className="flex items-start justify-between mb-3">
        <TypeBadge type={listingType} />
        <div className="flex items-center gap-2">
          {isInstalled && (
            <span className="text-[10px] text-emerald-300 border border-emerald-700 rounded-full px-2 py-0.5">Installed</span>
          )}
          <span className="text-xs text-green-400">{listingPrice === 'free' ? 'Free' : listingPrice}</span>
        </div>
      </div>
      <h3 className="font-semibold text-white group-hover:text-blue-300 transition-colors line-clamp-1 mb-1">{listingTitle}</h3>
      <p className="text-slate-400 text-sm line-clamp-2 mb-3">{listingDescription}</p>
      {scanner && (
        <div
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border mb-3 ${scanner.safe_to_use ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700' : 'bg-amber-900/40 text-amber-300 border-amber-700'}`}
          title="Skill scanner checks README/SKILL.md/package.json for risky patterns."
        >
          {scanner.safe_to_use ? 'Safe' : 'Review'} · score {scanner.score}
        </div>
      )}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>by {listingOwnerName}</span>
        <span>{listingInstallCount} installs</span>
      </div>
      <div className="mt-2">
        <StarRating value={listingAvgRating} count={listingRatingCount} />
      </div>
      {listingTags && Array.isArray(listingTags) && listingTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {listingTags.slice(0, 3).map(tag => (
            <span key={tag} className="px-2 py-0.5 bg-slate-800 text-slate-400 text-xs rounded-full">{tag}</span>
          ))}
          {listingTags.length > 3 && <span className="text-slate-500 text-xs">+{listingTags.length - 3}</span>}
        </div>
      )}
      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-blue-400 group-hover:text-blue-300 transition-colors">View Details →</span>
        {masterToken && (
          <button
            onClick={handleQuickInstall}
            disabled={isInstalled || quickInstalling}
            className="px-3 py-1.5 text-xs rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white"
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
  const [listings, setListings] = useState([]);
  const [installedSkillListingIds, setInstalledSkillListingIds] = useState(() => new Set());
  const [quickInstallingIds, setQuickInstallingIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [selected, setSelected] = useState(null);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (sort !== 'newest') params.set('sort', sort);
      if (search) params.set('search', search);
      const res = await fetch(`/api/v1/marketplace?${params}`);
      if (res.ok) {
        const data = await res.json();
        // Defensive: ensure listings is array
        const fetchedListings = Array.isArray(data?.listings) ? data.listings : [];
        setListings(fetchedListings);
      }
    } catch (err) {
      console.error('[Marketplace] fetchListings error:', err);
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, sort, search]);

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
      });
      if (!res.ok) return;
      const payload = await res.json();
      const ids = (payload.data || [])
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
  }, [fetchInstalledSkills]);

  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'persona', label: 'Personas' },
    { id: 'api', label: 'APIs' },
    { id: 'skill', label: 'Skills' },
  ];

  const handleQuickInstall = async ({ listingId, type }) => {
    setQuickInstallingIds(prev => new Set([...prev, String(listingId)]));
    try {
      if (type === 'skill') {
        setInstalledSkillListingIds(prev => new Set([...prev, String(listingId)]));
      }
      await fetchListings();
    } finally {
      setQuickInstallingIds(prev => {
        const next = new Set(prev);
        next.delete(String(listingId));
        return next;
      });
    }
  };

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

        {/* Search + Sort + Reset */}
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
          {(search || typeFilter !== 'all' || sort !== 'newest') && (
            <button
              onClick={() => {
                setSearch('');
                setTypeFilter('all');
                setSort('newest');
              }}
              className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors whitespace-nowrap"
            >
              Reset Filters
            </button>
          )}
        </div>

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
            {(listings || []).map(listing => {
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
                  isInstalled={listing.type === 'skill' && installedSkillListingIds.has(String(listing.id))}
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
            initiallyInstalled={selected?.type === 'skill' && installedSkillListingIds.has(String(selected?.id))}
            onClose={() => setSelected(null)}
            onInstall={({ listingId, type }) => {
              if (type === 'skill') {
                setInstalledSkillListingIds(prev => new Set([...prev, String(listingId)]));
              }
              fetchListings();
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
