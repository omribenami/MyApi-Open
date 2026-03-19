import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';

const TYPE_CONFIG = {
  persona: { label: 'Persona', color: 'bg-purple-900 bg-opacity-60 text-purple-300 border-purple-700' },
  api: { label: 'API', color: 'bg-blue-900 bg-opacity-60 text-blue-300 border-blue-700' },
  skill: { label: 'Skill', color: 'bg-green-900 bg-opacity-60 text-green-300 border-green-700' },
  template: { label: 'Template', color: 'bg-sky-900 bg-opacity-60 text-sky-300 border-sky-700' },
  connector: { label: 'Connector', color: 'bg-teal-900 bg-opacity-60 text-teal-300 border-teal-700' },
};

function extractScanner(content) {
  if (!content) return null;
  const parsed = typeof content === 'string' ? (() => {
    try { return JSON.parse(content); } catch { return null; }
  })() : content;

  if (!parsed || typeof parsed !== 'object') return null;
  const scanner = parsed.scanner || parsed?.config_json?.scanner;
  return scanner && typeof scanner === 'object' ? scanner : null;
}

function StarRating({ value, count, size = 'sm' }) {
  const stars = [1, 2, 3, 4, 5];
  const sz = size === 'lg' ? 'text-xl' : 'text-sm';
  return (
    <span className={`flex items-center gap-1 ${sz}`}>
      {stars.map(s => (
        <span key={s} className={s <= Math.round(value) ? 'text-amber-400' : 'text-slate-600'}>★</span>
      ))}
      {count > 0 && <span className="text-slate-400 text-xs ml-1">{value.toFixed(1)} ({count})</span>}
      {count === 0 && <span className="text-slate-500 text-xs ml-1">No ratings</span>}
    </span>
  );
}

function TypeBadge({ type }) {
  const cfg = TYPE_CONFIG[type] || { label: type, color: 'bg-slate-800 text-slate-300 border-slate-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function PricingBadge({ listing }) {
  const pricingModel = listing.pricingModel || (listing.price === 'free' ? 'free' : 'one_time');
  if (pricingModel === 'free') return <span className="text-xs text-green-400">Free</span>;
  const amount = Number.isFinite(listing.priceCents) ? `${listing.currency || 'USD'} ${(listing.priceCents / 100).toFixed(2)}` : 'Paid';
  return <span className="text-xs text-amber-300">{amount}</span>;
}

function OriginBadge({ originType }) {
  const val = (originType || 'community').toLowerCase();
  const map = {
    official: 'bg-blue-900/40 text-blue-300 border-blue-700',
    community: 'bg-slate-800 text-slate-300 border-slate-700',
    fork: 'bg-indigo-900/40 text-indigo-300 border-indigo-700',
  };
  return <span className={`text-[10px] border rounded-full px-2 py-0.5 ${map[val] || map.community}`}>{val}</span>;
}

function SummaryRow({ summary }) {
  const items = [
    ['Total Products', summary.total],
    ['Skills', summary.skills],
    ['Personas', summary.personas],
    ['APIs', summary.apis],
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map(([label, value]) => (
        <div key={label} className="bg-white bg-opacity-5 border border-white border-opacity-10 rounded-xl p-4">
          <p className="text-xs text-slate-400">{label}</p>
          <p className="text-2xl font-bold text-white mt-1">{value || 0}</p>
        </div>
      ))}
    </div>
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
    if (!selected) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/marketplace/${listingId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${masterToken}` },
        body: JSON.stringify({ rating: selected, review: review || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to submit rating');
      setDone(true);
      onRated && onRated(data);
    } catch (err) {
      setError(err.message || 'Failed to submit rating');
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
            className={`text-2xl ${s <= (hovered || selected) ? 'text-amber-400' : 'text-slate-600'}`}
          >★</button>
        ))}
      </div>
      <textarea value={review} onChange={e => setReview(e.target.value)} placeholder="Leave a review (optional)" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" rows={2} />
      <button onClick={submit} disabled={!selected || submitting} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg">
        {submitting ? 'Submitting...' : 'Submit Rating'}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

function ListingModal({ listing, onClose, onInstall, onRated, masterToken, initiallyInstalled = false }) {
  const [detail, setDetail] = useState(listing);
  const scanner = extractScanner(listing?.content) || extractScanner(detail?.content);
  const [installing, setInstalling] = useState(false);
  const [isInstalled, setIsInstalled] = useState(initiallyInstalled);
  const [installSuccess, setInstallSuccess] = useState(false);
  const [installError, setInstallError] = useState('');
  const [installInfo, setInstallInfo] = useState(null);

  useEffect(() => { setIsInstalled(initiallyInstalled); if (initiallyInstalled) setInstallSuccess(true); }, [initiallyInstalled]);

  async function handleInstall() {
    if (isInstalled) return;

    const isPaid = (detail.pricingModel && detail.pricingModel !== 'free') || (detail.price && detail.price !== 'free');
    if (isPaid) {
      setInstallError('Paid product checkout is coming soon. Free products can be installed now.');
      return;
    }

    setInstalling(true);
    setInstallError('');
    try {
      const installRes = await fetch(`/api/v1/marketplace/${listing.id}/install`, { method: 'POST', headers: { 'Authorization': `Bearer ${masterToken}` } });
      const installData = await installRes.json().catch(() => ({}));
      if (!installRes.ok) throw new Error(installData?.error || 'Failed to install listing');
      const alreadyInstalled = !!(installData?.alreadyInstalled || installData?.already_installed);
      setInstallInfo(installData?.provisioned || null);
      setIsInstalled(true);
      setInstallSuccess(true);
      onInstall && onInstall({ listingId: listing.id, type: listing.type, alreadyInstalled });
      setDetail(d => ({ ...d, installCount: Number.isFinite(installData?.installCount) ? installData.installCount : ((d.installCount || 0) + (alreadyInstalled ? 0 : 1)) }));
    } catch (err) {
      setInstallError(err.message || 'Install failed');
    } finally {
      setInstalling(false);
    }
  }

  async function refreshDetail() {
    try {
      const res = await fetch(`/api/v1/marketplace/${listing.id}`);
      if (res.ok) setDetail((await res.json()).listing);
    } catch {}
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black bg-opacity-70" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <TypeBadge type={detail.productType || detail.type} />
            <h2 className="text-xl font-bold text-white">{detail.title}</h2>
            {detail.official && <span className="text-[10px] border border-blue-700 text-blue-300 rounded-full px-2 py-0.5">Official</span>}
            {detail.verifiedSource && <span className="text-[10px] border border-emerald-700 text-emerald-300 rounded-full px-2 py-0.5">Verified</span>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none ml-4">×</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
            <span>by <span className="text-slate-200">{detail.ownerName}</span></span>
            {detail.providerName && <span className="text-slate-300">Provider: {detail.providerName}</span>}
            <OriginBadge originType={detail.originType} />
            <PricingBadge listing={detail} />
            <StarRating value={detail.avgRating || 0} count={detail.ratingCount || 0} size="sm" />
            <span>{detail.installCount || 0} installs</span>
          </div>

          {detail.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {detail.tags.map(tag => <span key={tag} className="px-2 py-0.5 bg-slate-800 text-slate-300 text-xs rounded-full border border-slate-700">{tag}</span>)}
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Description</h3>
            <p className="text-slate-400 text-sm leading-relaxed">{detail.description || 'No description provided.'}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
            <div className="bg-slate-800 rounded-lg p-3">
              <p><span className="text-slate-500">Origin:</span> {detail.originType || 'community'}</p>
              <p><span className="text-slate-500">License:</span> {detail.license || 'Not specified'}</p>
              {detail.sourceUrl && <p><a href={detail.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Source link</a></p>}
            </div>
            <div className="bg-slate-800 rounded-lg p-3">
              <p><span className="text-slate-500">Trust score:</span> {Math.round(detail.trustScore || 0)}</p>
              <p><span className="text-slate-500">Visibility:</span> {detail.visibility || 'public'}</p>
              <p><span className="text-slate-500">Status:</span> {detail.status || 'active'}</p>
            </div>
          </div>

          {detail.type === 'skill' && scanner && (
            <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${scanner.safe_to_use ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700' : 'bg-amber-900/40 text-amber-300 border-amber-700'}`}>
              {scanner.safe_to_use ? 'Safe' : 'Review'} · score {scanner.score}
            </div>
          )}

          {masterToken && (
            <>
              <button onClick={handleInstall} disabled={installing || isInstalled} className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg">
                {installing ? 'Installing...' : isInstalled ? 'Installed' : 'Install'}
              </button>
              {installError && <p className="text-sm text-red-400">{installError}</p>}
            </>
          )}

          {installSuccess && (
            <div className="bg-green-900 bg-opacity-30 border border-green-700 rounded-lg p-4 space-y-2">
              <p className="text-green-300 font-medium">✓ Installed</p>
              {detail.type === 'api' && installInfo && <code className="text-xs text-green-300 font-mono break-all">{installInfo.endpoint}</code>}
            </div>
          )}

          <div className="border-t border-slate-800 pt-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-300">Reviews ({(detail.ratings || []).length})</h3>
            {(detail.ratings || []).length > 0 ? (
              <div className="space-y-3">
                {detail.ratings.map(r => (
                  <div key={r.id} className="bg-slate-800 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-200">{r.reviewerName}</span>
                      <StarRating value={r.rating} count={0} size="sm" />
                    </div>
                    {r.review && <p className="text-slate-400 text-sm">{r.review}</p>}
                  </div>
                ))}
              </div>
            ) : <p className="text-slate-500 text-sm">No reviews yet. Be the first!</p>}

            {masterToken && (
              <div className="border-t border-slate-800 pt-4">
                <RatingWidget listingId={detail.id} masterToken={masterToken} onRated={() => { refreshDetail(); onRated && onRated(detail.id); }} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ListingCard({ listing, onClick, isInstalled = false, masterToken, onQuickInstall, quickInstalling = false }) {
  const scanner = (listing.productType || listing.type) === 'skill' ? extractScanner(listing.content) : null;
  const [quickError, setQuickError] = useState('');

  async function handleQuickInstall(e) {
    e.stopPropagation();
    if (!masterToken || isInstalled || quickInstalling) return;

    const isPaid = (listing.pricingModel && listing.pricingModel !== 'free') || (listing.price && listing.price !== 'free');
    if (isPaid) {
      setQuickError('Paid product coming soon');
      return;
    }

    setQuickError('');
    try {
      const res = await fetch(`/api/v1/marketplace/${listing.id}/install`, { method: 'POST', headers: { 'Authorization': `Bearer ${masterToken}` } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Install failed');
      onQuickInstall && onQuickInstall({ listingId: listing.id, type: listing.productType || listing.type, data });
    } catch (err) {
      setQuickError(err.message || 'Install failed');
    }
  }

  return (
    <div onClick={() => onClick(listing)} className="bg-white bg-opacity-5 border border-white border-opacity-10 rounded-xl p-5 cursor-pointer hover:border-blue-500 hover:border-opacity-50">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <TypeBadge type={listing.productType || listing.type} />
          <OriginBadge originType={listing.originType} />
          {listing.official && <span className="text-[10px] border border-blue-700 text-blue-300 rounded-full px-2 py-0.5">Official</span>}
        </div>
        <div className="flex items-center gap-2">
          {isInstalled && <span className="text-[10px] text-emerald-300 border border-emerald-700 rounded-full px-2 py-0.5">Installed</span>}
          <PricingBadge listing={listing} />
        </div>
      </div>
      <h3 className="font-semibold text-white line-clamp-1 mb-1">{listing.title}</h3>
      <p className="text-slate-400 text-sm line-clamp-2 mb-3">{listing.description || 'No description.'}</p>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{listing.providerName ? `Provider: ${listing.providerName}` : `by ${listing.ownerName}`}</span>
        <span>{listing.installCount || 0} installs</span>
      </div>
      <div className="mt-2"><StarRating value={listing.avgRating || 0} count={listing.ratingCount || 0} /></div>
      {scanner && <div className="mt-2 text-xs text-slate-500">Scanner score: {scanner.score}</div>}
      {listing.tags?.length > 0 && <div className="flex flex-wrap gap-1 mt-3">{listing.tags.slice(0, 3).map(tag => <span key={tag} className="px-2 py-0.5 bg-slate-800 text-slate-400 text-xs rounded-full">{tag}</span>)}</div>}
      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-blue-400">View Details →</span>
        {masterToken && <button onClick={handleQuickInstall} disabled={isInstalled || quickInstalling} className="px-3 py-1.5 text-xs rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white">{quickInstalling ? 'Installing...' : isInstalled ? 'Installed' : 'Install'}</button>}
      </div>
      {quickError && <p className="mt-2 text-xs text-red-400">{quickError}</p>}
    </div>
  );
}

export default function Marketplace() {
  const masterToken = useAuthStore(s => s.masterToken);
  const [listings, setListings] = useState([]);
  const [summary, setSummary] = useState({ total: 0, skills: 0, personas: 0, apis: 0 });
  const [providers, setProviders] = useState([]);
  const [installedSkillListingIds, setInstalledSkillListingIds] = useState(() => new Set());
  const [quickInstallingIds, setQuickInstallingIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [officialOnly, setOfficialOnly] = useState(false);
  const [priceFilter, setPriceFilter] = useState('all');
  const [fieldTagFilter, setFieldTagFilter] = useState('');
  const [sort, setSort] = useState('popular');
  const [selected, setSelected] = useState(null);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/marketplace/providers');
      if (!res.ok) return;
      const data = await res.json();
      setProviders((data.providers || []).map(p => p.providerName).filter(Boolean));
    } catch {}
  }, []);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (providerFilter !== 'all') params.set('provider', providerFilter);
      if (officialOnly) params.set('official', 'true');
      if (priceFilter !== 'all') params.set('pricing', priceFilter);
      if (fieldTagFilter) params.set('field', fieldTagFilter);
      if (sort) params.set('sort', sort);
      if (search) params.set('search', search);

      const res = await fetch(`/api/v1/marketplace?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      const next = data.listings || [];
      setListings(next);
      setSummary(data.summary || next.reduce((acc, l) => {
        acc.total += 1;
        const t = l.productType || l.type;
        if (t === 'skill') acc.skills += 1;
        if (t === 'persona') acc.personas += 1;
        if (t === 'api') acc.apis += 1;
        return acc;
      }, { total: 0, skills: 0, personas: 0, apis: 0 }));
    } finally {
      setLoading(false);
    }
  }, [typeFilter, providerFilter, officialOnly, priceFilter, fieldTagFilter, sort, search]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  useEffect(() => {
    const t = setTimeout(fetchListings, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [fetchListings]);

  const fetchInstalledSkills = useCallback(async () => {
    if (!masterToken) return setInstalledSkillListingIds(new Set());
    try {
      const res = await fetch('/api/v1/skills', { headers: { 'Authorization': `Bearer ${masterToken}` } });
      if (!res.ok) return;
      const payload = await res.json();
      const ids = (payload.data || []).map((s) => s?.config_json?.marketplace_listing_id ? String(s.config_json.marketplace_listing_id) : null).filter(Boolean);
      setInstalledSkillListingIds(new Set(ids));
    } catch {}
  }, [masterToken]);

  useEffect(() => { fetchInstalledSkills(); }, [fetchInstalledSkills]);

  const allFieldTags = useMemo(() => {
    const set = new Set();
    listings.forEach((l) => (l.tags || []).forEach((t) => set.add(t)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [listings]);

  const activeFilters = [typeFilter !== 'all', providerFilter !== 'all', officialOnly, priceFilter !== 'all', !!fieldTagFilter, !!search].filter(Boolean).length;

  const handleQuickInstall = async ({ listingId, type }) => {
    setQuickInstallingIds(prev => new Set([...prev, String(listingId)]));
    try {
      if (type === 'skill') setInstalledSkillListingIds(prev => new Set([...prev, String(listingId)]));
      await fetchListings();
    } finally {
      setQuickInstallingIds(prev => { const n = new Set(prev); n.delete(String(listingId)); return n; });
    }
  };

  const resetFilters = () => {
    setTypeFilter('all');
    setProviderFilter('all');
    setOfficialOnly(false);
    setPriceFilter('all');
    setFieldTagFilter('');
    setSort('popular');
    setSearch('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Marketplace</h1>
        <p className="text-slate-400 mt-1">Discover verified products and community builds</p>
      </div>

      <SummaryRow summary={summary} />

      <div className="grid grid-cols-1 lg:grid-cols-6 gap-3">
        <input type="text" placeholder="Search listings..." value={search} onChange={e => setSearch(e.target.value)} className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm" />

        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm">
          <option value="all">All types</option>
          <option value="skill">Skills</option>
          <option value="persona">Personas</option>
          <option value="api">APIs</option>
          <option value="template">Templates</option>
          <option value="connector">Connectors</option>
        </select>

        <select value={providerFilter} onChange={e => setProviderFilter(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm">
          <option value="all">All providers</option>
          {providers.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <select value={fieldTagFilter} onChange={e => setFieldTagFilter(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm">
          <option value="">All fields/tags</option>
          {allFieldTags.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select value={sort} onChange={e => setSort(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm">
          <option value="popular">Most Popular</option>
          <option value="recent">Most Recent</option>
          <option value="rating">Highest Rated</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={officialOnly} onChange={e => setOfficialOnly(e.target.checked)} /> Official only
        </label>
        <select value={priceFilter} onChange={e => setPriceFilter(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm">
          <option value="all">All pricing</option>
          <option value="free">Free</option>
          <option value="paid">Paid</option>
        </select>
        {activeFilters > 0 && <button onClick={resetFilters} className="text-xs px-3 py-1.5 rounded bg-slate-800 border border-slate-700 text-slate-300">Reset filters</button>}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" /></div>
      ) : listings.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-white bg-opacity-5 border border-white border-opacity-10 rounded-xl">
          <p className="text-4xl mb-3">🏪</p>
          <p className="text-lg font-medium text-slate-400">No listings match your filters</p>
          <p className="text-sm mt-1">{activeFilters > 0 ? `You have ${activeFilters} active filter${activeFilters > 1 ? 's' : ''}.` : 'Try adjusting your search.'}</p>
          {activeFilters > 0 && <button onClick={resetFilters} className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg">Clear filters</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {listings.map(listing => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onClick={setSelected}
              masterToken={masterToken}
              onQuickInstall={handleQuickInstall}
              quickInstalling={quickInstallingIds.has(String(listing.id))}
              isInstalled={(listing.productType || listing.type) === 'skill' && installedSkillListingIds.has(String(listing.id))}
            />
          ))}
        </div>
      )}

      {selected && (
        <ListingModal
          listing={selected}
          masterToken={masterToken}
          initiallyInstalled={(selected.productType || selected.type) === 'skill' && installedSkillListingIds.has(String(selected.id))}
          onClose={() => setSelected(null)}
          onInstall={({ listingId, type }) => { if (type === 'skill') setInstalledSkillListingIds(prev => new Set([...prev, String(listingId)])); fetchListings(); }}
          onRated={() => fetchListings()}
        />
      )}
    </div>
  );
}
