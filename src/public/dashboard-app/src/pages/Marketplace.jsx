import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';

const TYPE_CONFIG = {
  persona: { label: 'Persona', color: 'bg-purple-900 bg-opacity-60 text-purple-300 border-purple-700' },
  api: { label: 'API', color: 'bg-blue-900 bg-opacity-60 text-blue-300 border-blue-700' },
  skill: { label: 'Skill', color: 'bg-green-900 bg-opacity-60 text-green-300 border-green-700' },
};

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

function RatingWidget({ listingId, onRated, masterToken }) {
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(0);
  const [review, setReview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/marketplace/${listingId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${masterToken}` },
        body: JSON.stringify({ rating: selected, review: review || undefined }),
      });
      if (res.ok) {
        setDone(true);
        onRated && onRated();
      }
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
    </div>
  );
}

function ListingModal({ listing, onClose, onInstall, masterToken }) {
  const [detail, setDetail] = useState(listing);
  const [installing, setInstalling] = useState(false);

  const [installSuccess, setInstallSuccess] = useState(false);

  async function handleInstall() {
    setInstalling(true);
    try {
      // Track install
      await fetch(`/api/v1/marketplace/${listing.id}/install`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${masterToken}` },
      });

      // For personas: create a local copy
      if (detail.type === 'persona' && detail.content) {
        const content = typeof detail.content === 'string' ? JSON.parse(detail.content) : detail.content;
        await fetch('/api/v1/personas', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${masterToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: detail.title,
            description: detail.description || '',
            soul_content: content.soul_content || '',
          }),
        });
      }

      setInstallSuccess(true);
      onInstall && onInstall();
      setDetail(d => ({ ...d, installCount: (d.installCount || 0) + 1 }));
    } finally {
      setInstalling(false);
    }
  }

  async function refreshDetail() {
    try {
      const res = await fetch(`/api/v1/marketplace/${listing.id}`);
      if (res.ok) {
        const data = await res.json();
        setDetail(data.listing);
      }
    } catch {}
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black bg-opacity-70" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <TypeBadge type={detail.type} />
            <h2 className="text-xl font-bold text-white">{detail.title}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none ml-4">×</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
            <span>by <span className="text-slate-200">{detail.ownerName}</span></span>
            <StarRating value={detail.avgRating || 0} count={detail.ratingCount || 0} size="sm" />
            <span>{detail.installCount || 0} installs</span>
            <span className="text-green-400">{detail.price === 'free' ? 'Free' : detail.price}</span>
          </div>

          {/* Tags */}
          {detail.tags && detail.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {detail.tags.map(tag => (
                <span key={tag} className="px-2 py-0.5 bg-slate-800 text-slate-300 text-xs rounded-full border border-slate-700">{tag}</span>
              ))}
            </div>
          )}

          {/* Description */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Description</h3>
            <p className="text-slate-400 text-sm leading-relaxed">{detail.description || 'No description provided.'}</p>
          </div>

          {/* Content preview */}
          {detail.content && (
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-2">Details</h3>
              <div className="bg-slate-800 rounded-lg p-4 text-sm">
                {detail.type === 'persona' && (
                  <p className="text-slate-300 whitespace-pre-wrap">{
                    typeof detail.content === 'object' ? (detail.content.soul_content || JSON.stringify(detail.content, null, 2)) : detail.content
                  }</p>
                )}
                {detail.type === 'api' && (
                  <div className="space-y-2 text-slate-300">
                    {typeof detail.content === 'object' ? (
                      <>
                        {detail.content.endpoint && <div><span className="text-slate-500">Endpoint: </span>{detail.content.endpoint}</div>}
                        {detail.content.method && <div><span className="text-slate-500">Method: </span><span className="text-blue-300">{detail.content.method}</span></div>}
                        {detail.content.auth_type && <div><span className="text-slate-500">Auth: </span>{detail.content.auth_type}</div>}
                        {detail.content.api_description && <div><span className="text-slate-500">About: </span>{detail.content.api_description}</div>}
                      </>
                    ) : <p>{detail.content}</p>}
                  </div>
                )}
                {detail.type === 'skill' && (
                  <div className="space-y-2 text-slate-300">
                    {typeof detail.content === 'object' ? (
                      <>
                        {detail.content.skill_name && <div><span className="text-slate-500">Skill: </span>{detail.content.skill_name}</div>}
                        {detail.content.proficiency && <div><span className="text-slate-500">Level: </span>{detail.content.proficiency}</div>}
                        {detail.content.years && <div><span className="text-slate-500">Experience: </span>{detail.content.years} years</div>}
                        {detail.content.portfolio && <div><span className="text-slate-500">Portfolio: </span><a href={detail.content.portfolio} className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">{detail.content.portfolio}</a></div>}
                      </>
                    ) : <p>{detail.content}</p>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Install button */}
          {masterToken && !installSuccess && (
            <button
              onClick={handleInstall}
              disabled={installing}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-all shadow-lg"
            >
              {installing ? 'Installing...' : `Install / Use (${detail.installCount || 0})`}
            </button>
          )}

          {installSuccess && (
            <div className="bg-green-900 bg-opacity-30 border border-green-700 rounded-lg p-4 space-y-2">
              <p className="text-green-300 font-medium">✓ {detail.type === 'persona' ? 'Persona installed!' : 'Added!'}</p>
              {detail.type === 'persona' && (
                <>
                  <p className="text-sm text-slate-400">This persona is now available in your Personas page.</p>
                  <div className="bg-slate-800 rounded p-3 mt-2">
                    <p className="text-xs text-slate-400 mb-1">API Endpoint:</p>
                    <code className="text-xs text-green-300 font-mono">GET /api/v1/context</code>
                    <p className="text-xs text-slate-500 mt-1">Use your master token to access this persona via the API.</p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Ratings */}
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
            ) : (
              <p className="text-slate-500 text-sm">No reviews yet. Be the first!</p>
            )}

            {masterToken && (
              <div className="border-t border-slate-800 pt-4">
                <RatingWidget listingId={detail.id} masterToken={masterToken} onRated={refreshDetail} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ListingCard({ listing, onClick }) {
  return (
    <div
      onClick={() => onClick(listing)}
      className="bg-white bg-opacity-5 border border-white border-opacity-10 rounded-xl p-5 cursor-pointer hover:border-blue-500 hover:border-opacity-50 hover:bg-opacity-10 transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <TypeBadge type={listing.type} />
        <span className="text-xs text-green-400">{listing.price === 'free' ? 'Free' : listing.price}</span>
      </div>
      <h3 className="font-semibold text-white group-hover:text-blue-300 transition-colors line-clamp-1 mb-1">{listing.title}</h3>
      <p className="text-slate-400 text-sm line-clamp-2 mb-3">{listing.description || 'No description.'}</p>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>by {listing.ownerName}</span>
        <span>{listing.installCount || 0} installs</span>
      </div>
      <div className="mt-2">
        <StarRating value={listing.avgRating || 0} count={listing.ratingCount || 0} />
      </div>
      {listing.tags && listing.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {listing.tags.slice(0, 3).map(tag => (
            <span key={tag} className="px-2 py-0.5 bg-slate-800 text-slate-400 text-xs rounded-full">{tag}</span>
          ))}
          {listing.tags.length > 3 && <span className="text-slate-500 text-xs">+{listing.tags.length - 3}</span>}
        </div>
      )}
      <div className="mt-4">
        <span className="text-xs font-medium text-blue-400 group-hover:text-blue-300 transition-colors">View Details →</span>
      </div>
    </div>
  );
}

export default function Marketplace() {
  const masterToken = useAuthStore(s => s.masterToken);
  const [listings, setListings] = useState([]);
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
        setListings(data.listings || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, sort, search]);

  useEffect(() => {
    const t = setTimeout(fetchListings, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchListings]);

  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'persona', label: 'Personas' },
    { id: 'api', label: 'APIs' },
    { id: 'skill', label: 'Skills' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Marketplace</h1>
        <p className="text-slate-400 mt-1">Discover and share personas, APIs, and skills with the community</p>
      </div>

      {/* Search + Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
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
          <option value="newest">Newest</option>
          <option value="popular">Top Rated</option>
          <option value="most_used">Most Used</option>
        </select>
      </div>

      {/* Type filter tabs */}
      <div className="flex gap-1 bg-slate-800 bg-opacity-50 p-1 rounded-lg w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setTypeFilter(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              typeFilter === tab.id
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <p className="text-4xl mb-3">🏪</p>
          <p className="text-lg font-medium text-slate-400">No listings found</p>
          <p className="text-sm mt-1">Be the first to publish something!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {listings.map(listing => (
            <ListingCard key={listing.id} listing={listing} onClick={setSelected} />
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <ListingModal
          listing={selected}
          masterToken={masterToken}
          onClose={() => setSelected(null)}
          onInstall={fetchListings}
        />
      )}
    </div>
  );
}
